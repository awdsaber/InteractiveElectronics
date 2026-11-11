// solder-joints: hand-soldered joints whose quality comes from the technique used, and whose
// quality is a real circuit element.
//
// Each joint is one R element in the lesson's netlist (`joints`, in order: J1, J2, …). The learner
// picks a joint (`target`, 1-based), sets the technique (alloy, tip temperature, dwell, flux, how
// much solder is fed) and presses "solder this joint" (`go`, a momentary 0 → 1) or "wick this
// joint" (`wick`). A documented rule (`solderResult`, `wickResult`) turns the technique into a
// quality, and the quality into the element:
//
//   good          1 mΩ        concave fillet, wetted pad and lead
//   cold          0.6 Ω       grainy, convex, not wetted: a contact, not a bond. While the board
//                             vibrates (`vibration` 0..1) it opens (`coldOpenOhm`, 1 kΩ) in short
//                             random spells, at a rate proportional to the vibration
//   insufficient  10 mΩ       thin fillet, the hole visible
//   excess        1 mΩ        a balled fillet that hides whether it wetted (electrically fine)
//   bridge        1 mΩ        on a fine pad (`fine`), too much solder also joins the neighbour pad:
//                             the paired SW (`bridgeSw`) closes, shorting two nets
//   overheated    1 mΩ        charred flux, the pad's adhesive weakened. A second overheat lifts it
//   lifted        open (10 MΩ) the copper pad has torn off the laminate. No soldering fixes it;
//                             repair (a jumper wire, here "Repair all") does
//
// The rule is a lookup with real anchor numbers, not a thermal model (see `solderResult`).
//
// A param named after a joint (`j2: 'cold'`) forces that joint's quality whenever the param's
// value changes: a failure's `set` patch breaks it, and the joint stays reworkable while the
// failure is active. `esd` > 0 (a failure) zaps `esdPin` with `ctx.burn`.
//
// Params (defaults): joints 'j1', fine '', bridgeSw '' (paired with `fine`, same order), heat
//   (joints whose I²R is reported; default: every joint not in `fine`), target 1, alloy 0
//   (0 Sn63/Pb37, 1 SAC305), tipC 350, dwellS 3, flux 1, feed 1 (0 too little, 1 right, 2 too much),
//   go 0, wick 0, vibration 0, coldOpenOhm 1000, designA 0.5, esd 0, esdPin 'pin6', seed 11.
// Publishes: j<k>_q (index into QUALITIES), j<k>_ohm, j<k>_heats (heat cycles: solder, reflow,
//   wick), sel_q, sel_ohm (the selected joint), breaks (cold-joint opens since power-on or repair),
//   joint_W (the worst `heat` joint's I²R at `designA`), last_q (the result of the last action).

import type { Behavior, BehaviorContext } from '../types'

export const QUALITIES = ['good', 'cold', 'insufficient', 'excess', 'bridge', 'overheated', 'lifted'] as const
export type Quality = (typeof QUALITIES)[number]

/** joint resistance at rest, Ω */
export const JOINT_OHMS: Record<Quality, number> = {
  good: 0.001,
  cold: 0.6,
  insufficient: 0.01,
  excess: 0.001,
  bridge: 0.001,
  overheated: 0.001,
  lifted: 1e7,
}

/**
 * Solder alloys: melting range and the usual iron setpoint window.
 * Sn63/Pb37 is eutectic: it melts and freezes at one temperature, 183 °C.
 * SAC305 (Sn96.5 Ag3.0 Cu0.5) melts over about 217–220 °C.
 * The setpoint windows are typical bench practice, not a datasheet limit.
 */
export const ALLOYS = [
  { name: 'Sn63/Pb37', solidusC: 183, liquidusC: 183, lo: 330, hi: 370 },
  { name: 'SAC305', solidusC: 217, liquidusC: 220, lo: 350, hi: 400 },
] as const

/** how far outside the typical window the rule still forms a joint, °C */
export const WINDOW_SLACK_C = 20
/** THT dwell window, s: under it the pad and lead don't reach wetting temperature; over it, damage */
export const DWELL_MIN_S = 2
export const DWELL_MAX_S = 5

export function ironWindow(alloy: number): { coldBelow: number; hotAbove: number } {
  const a = ALLOYS[alloy >= 0.5 ? 1 : 0]
  return { coldBelow: a.lo - WINDOW_SLACK_C, hotAbove: a.hi + WINDOW_SLACK_C }
}

export interface Technique {
  /** 0 Sn63/Pb37, 1 SAC305 */
  alloy: number
  tipC: number
  dwellS: number
  flux: boolean
  /** 0 too little, 1 right, 2 too much */
  feed: number
}

const tooHot = (t: Technique) => t.tipC > ironWindow(t.alloy).hotAbove || t.dwellS > DWELL_MAX_S

/**
 * The joint-quality rule, first match wins:
 *  1. a lifted pad stays lifted (there is nothing left to wet);
 *  2. too hot (tip over the window + 20 °C) or too long (over 5 s): overheated, or lifted if the
 *     joint was already overheated;
 *  3. too cool (tip under the window − 20 °C), too short (under 2 s) or no flux: cold;
 *  4. too little solder: insufficient; too much: excess, or a bridge on a fine pad;
 *  5. otherwise good.
 */
export function solderResult(t: Technique, prior: Quality, fine: boolean): Quality {
  if (prior === 'lifted') return 'lifted'
  if (tooHot(t)) return prior === 'overheated' ? 'lifted' : 'overheated'
  if (t.tipC < ironWindow(t.alloy).coldBelow || t.dwellS < DWELL_MIN_S || !t.flux) return 'cold'
  if (t.feed < 0.5) return 'insufficient'
  if (t.feed > 1.5) return fine ? 'bridge' : 'excess'
  return 'good'
}

/** Desoldering braid: pulls the molten solder off (a bridge goes), leaving a thin film. Heat still counts. */
export function wickResult(t: Technique, prior: Quality): Quality {
  if (prior === 'lifted') return 'lifted'
  if (tooHot(t)) return prior === 'overheated' ? 'lifted' : 'overheated'
  return 'insufficient'
}

// ── behavior ──

const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d)
const list = (v: unknown, d: string) =>
  String(v ?? d)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
const asQuality = (v: unknown): Quality | null => (typeof v === 'string' && (QUALITIES as readonly string[]).includes(v) ? (v as Quality) : null)

interface Joint {
  id: string
  q: Quality
  heats: number
  /** the last value seen of the param named after this joint (a failure forcing a state) */
  forced: unknown
  /** cold joint: contact open right now, and the sim time left in this spell */
  open: boolean
  left: number
}

interface State {
  joints: Joint[]
  go: number
  wick: number
  breaks: number
  last: number
  rng: number
  zapped: boolean
}

const states = new WeakMap<BehaviorContext, State>()

function fresh(ctx: BehaviorContext): State {
  const seed = (Math.imul(Math.trunc(num(ctx.params.seed, 11)) | 0, 2654435761) ^ 0x9e3779b9) >>> 0
  const s: State = {
    joints: list(ctx.params.joints, 'j1').map((id) => ({ id, q: 'good', heats: 0, forced: undefined, open: false, left: -1 })),
    go: num(ctx.params.go, 0),
    wick: num(ctx.params.wick, 0),
    breaks: 0,
    last: 0,
    rng: seed || 1,
    zapped: false,
  }
  for (let i = 0; i < 8; i++) uniform(s)
  return s
}

function state(ctx: BehaviorContext): State {
  let s = states.get(ctx)
  if (!s) {
    s = fresh(ctx)
    states.set(ctx, s)
  }
  return s
}

/** xorshift32 → (0, 1) */
function uniform(s: State): number {
  let x = s.rng
  x ^= x << 13
  x >>>= 0
  x ^= x >>> 17
  x ^= x << 5
  x >>>= 0
  s.rng = x || 1
  return (s.rng + 0.5) / 4294967296
}

function technique(ctx: BehaviorContext): Technique {
  return {
    alloy: num(ctx.params.alloy, 0),
    tipC: num(ctx.params.tipC, 350),
    dwellS: num(ctx.params.dwellS, 3),
    flux: num(ctx.params.flux, 1) >= 0.5,
    feed: num(ctx.params.feed, 1),
  }
}

/** a joint param (`j2: 'cold'`) that changed since last seen forces that quality */
function applyForced(ctx: BehaviorContext, s: State): void {
  for (const j of s.joints) {
    const v = ctx.params[j.id]
    if (v === j.forced) continue
    j.forced = v
    const q = asQuality(v)
    if (q) j.q = q
  }
}

function ohmsOf(ctx: BehaviorContext, j: Joint): number {
  if (j.q === 'cold' && j.open) return num(ctx.params.coldOpenOhm, 1000)
  return JOINT_OHMS[j.q]
}

function apply(ctx: BehaviorContext, s: State): void {
  const fine = list(ctx.params.fine, '')
  const sws = list(ctx.params.bridgeSw, '')
  const heat = ctx.params.heat === undefined ? s.joints.map((j) => j.id).filter((id) => !fine.includes(id)) : list(ctx.params.heat, '')
  const designA = num(ctx.params.designA, 0.5)
  let worst = 0
  for (let k = 0; k < s.joints.length; k++) {
    const j = s.joints[k]
    const ohm = ohmsOf(ctx, j)
    ctx.setParam(j.id, 'value', ohm)
    ctx.publish(`${j.id}_q`, QUALITIES.indexOf(j.q))
    ctx.publish(`${j.id}_ohm`, ohm)
    ctx.publish(`${j.id}_heats`, j.heats)
    // an open joint carries no current, so it makes no heat
    if (heat.includes(j.id) && j.q !== 'lifted') worst = Math.max(worst, designA * designA * JOINT_OHMS[j.q])
    const f = fine.indexOf(j.id)
    if (f >= 0 && sws[f]) ctx.setParam(sws[f], 'closed', j.q === 'bridge')
  }
  const sel = s.joints[Math.min(s.joints.length, Math.max(1, Math.round(num(ctx.params.target, 1)))) - 1]
  ctx.publish('sel_q', sel ? QUALITIES.indexOf(sel.q) : 0)
  ctx.publish('sel_ohm', sel ? ohmsOf(ctx, sel) : 0)
  ctx.publish('breaks', s.breaks)
  ctx.publish('joint_W', worst)
  ctx.publish('last_q', s.last)
}

/** cold joints under vibration: closed spells average 0.25 s / vibration, open spells 30 ms (≥ 10 ms) */
function shake(ctx: BehaviorContext, s: State, dt: number): void {
  const vib = Math.min(1, Math.max(0, num(ctx.params.vibration, 0)))
  for (const j of s.joints) {
    if (j.q !== 'cold' || vib <= 0) {
      j.open = false
      j.left = -1
      continue
    }
    if (j.left < 0) j.left = -(0.25 / vib) * Math.log(uniform(s))
    j.left -= dt
    while (j.left <= 0) {
      j.open = !j.open
      if (j.open) s.breaks++
      j.left += j.open ? Math.max(0.01, -0.03 * Math.log(uniform(s))) : -(0.25 / vib) * Math.log(uniform(s))
    }
  }
}

function act(ctx: BehaviorContext, s: State, kind: 'go' | 'wick'): void {
  const fine = list(ctx.params.fine, '')
  const k = Math.round(num(ctx.params.target, 1)) - 1
  const j = s.joints[k]
  if (!j) return
  const t = technique(ctx)
  j.q = kind === 'go' ? solderResult(t, j.q, fine.includes(j.id)) : wickResult(t, j.q)
  j.heats++
  s.last = QUALITIES.indexOf(j.q)
}

export const behavior: Behavior = {
  id: 'solder-joints',

  init(ctx) {
    const s = state(ctx)
    applyForced(ctx, s)
    apply(ctx, s)
  },

  tick(ctx, dt) {
    const s = state(ctx)
    applyForced(ctx, s)
    const go = num(ctx.params.go, 0)
    const wick = num(ctx.params.wick, 0)
    if (go >= 0.5 && s.go < 0.5) act(ctx, s, 'go')
    if (wick >= 0.5 && s.wick < 0.5) act(ctx, s, 'wick')
    s.go = go
    s.wick = wick
    shake(ctx, s, dt)
    if (num(ctx.params.esd, 0) >= 0.5 && !s.zapped && ctx.powered) {
      s.zapped = true
      // a pin failure (not 'overvoltage'): the bench then marks the dead pin, not the whole module, as burnt
      ctx.burn(String(ctx.params.esdPin ?? 'pin6'), 'pin-overcurrent', {
        note: 'failed: an ESD discharge from an ungrounded hand or iron punched through its input protection',
      })
    }
    apply(ctx, s)
  },

  onEvent(ctx, ev) {
    if (ev === 'power-on') state(ctx).breaks = 0
  },

  reset(ctx) {
    // the bench rebuilds (and re-merges failure overrides) before reset: after repair the params are
    // the lesson's again, after strip a still-active failure re-applies its forced quality
    const s = fresh(ctx)
    states.set(ctx, s)
    applyForced(ctx, s)
    apply(ctx, s)
  },
}
