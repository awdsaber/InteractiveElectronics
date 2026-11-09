// thermal-network: a three-node junction - case - heatsink thermal RC network, driven by the
// solved power of one element (a TO-220 linear regulator, a power MOSFET), with thermal shutdown.
//
// The analogy is exact, node for node:      electrical        thermal
//                                           V  (volts)        T  (°C)
//                                           I  (amps)         P  (watts)
//                                           R  (V/A)          θ  (°C/W)
//                                           C  (Q = C·V)      C_th (J/K: Q = C_th·ΔT, heat stored)
//   Tj = Ta + P·(θjc + θcs + θsa) at steady state; τ = C_th·θ while it settles.
//
//        P ──► [Tj] ──θjc──► [Tc] ──θcs──► [Ths] ──θsa──► Ta (ambient, the ground node)
//              C_j=0.05      C_c=0.8       C_s (the sink's mass)
//
// With no heatsink the tab is in free air: θcs is gone, the sink node collapses onto the case and
// θja (65 °C/W for the onsemi MC7805 TO-220, 50 °C/W for the ST L7805, both from the datasheets) is
// the whole path: θca = θja − θjc. A fan multiplies the convective resistance (θsa, or θca bare)
// by `fanFactor`. Thermal pad and grease set θcs.
//
// Each tick integrates the network with backward Euler (unconditionally stable) in substeps of
// at most 20 ms, so any sim speed is safe. Thermal shutdown (protect = 1, the default): Tj >= tsdOn
// disables the element (it dissipates nothing and the output collapses) until Tj < tsdOff, then it
// restarts. Because the die sits P·θjc above the tab only while it dissipates, the junction falls to
// the tab temperature within a second of a trip, so a hot regulator chatters on and off every few
// seconds until the tab itself is above tsdOff (the chatter of a real overloaded regulator). protect = 0 (a part with no
// thermal protection) burns the element through ctx.burn at tMax instead.
//
// Params (defaults):
//   element ('reg')                the element whose power drives the network
//   ambientC (25)
//   sink (1)                       0 none (bare tab), 1 small clip-on, 2 large finned
//   pad (1)                        0 dry tab (no compound), 1 silicone pad, 2 thermal grease
//   fan (0)                        1 = forced air
//   rthJC (5)                      °C/W junction-to-case (TO-220: 5 in the ST and onsemi datasheets)
//   rthJA (65)                     °C/W junction-to-ambient bare, free air (onsemi MC7805; ST L7805: 50)
//   rthSA (0)  cSink (0)           override the selected sink's θsa (still air, °C/W) and mass (J/K) when > 0
//   rthCS (0)                      override the selected pad's θcs (°C/W) when > 0
//   fanFactor (0.45)               forced-air multiplier on θsa / θca (illustrative: heatsink curves vary)
//   cJ (0.05) cC (0.8)             die and tab heat capacity, J/K
//   tsdOn (150) tsdOff (130)       shutdown / restart junction temperature (model values: the datasheets say only
//                                  "thermal overload protection", with no number)
//   tMax (150)                     burn temperature when protect = 0
//   tLimit (125)                   datasheet operating maximum, for pmax_W (derating)
//   protect (1)
//
// Illustrative parts: the small sink is a 10 g aluminium clip-on (12 °C/W in still air, 9 J/K);
// the large one a 30 g finned extrusion (5 °C/W, 27 J/K: the class of the common Aavid TO-220
// vertical sinks); interface values (dry 3, silicone pad 1, grease 0.5 °C/W) are typical
// of TO-220 tables, not a specific part.
//
// Publishes: p_W (the element's power), tj, tc, ths (°C), rth_total (θjc+θcs+θsa, °C/W), tj_ss and
//   ths_ss (steady state at the present power), tau_s ((C_j+C_c+C_s)·θsa: the slow time constant),
//   pmax_W ((tLimit − Ta)/rth_total: the power the chain allows, the derating line), tsd (0/1),
//   tsd_count (trips since power-on), tc_rise, margin_C (tLimit − Tj).
// Allocates nothing per tick (state lives in fixed fields; the substep solve is scalar locals).

import type { Behavior, BehaviorContext } from '../types'

/** still-air θsa, °C/W, and mass, J/K, per sink choice (index = `sink`; 0 is the bare tab) */
const SINK_RTH = [0, 12, 5]
const SINK_C = [0, 9, 27]
/** θcs, °C/W, per pad choice (index = `pad`): dry tab, silicone pad, thermal grease */
const PAD_RTH = [3, 1, 0.5]
/** the longest substep, s */
const H_MAX = 0.02
const N_MAX = 64

interface State {
  tj: number
  tc: number
  ts: number
  tsd: boolean
  count: number
  burnt: boolean
  /** last real power while the element was running, W */
  pLive: number
}

const states = new WeakMap<BehaviorContext, State>()
function stateOf(ctx: BehaviorContext): State {
  let s = states.get(ctx)
  if (!s) {
    s = { tj: 25, tc: 25, ts: 25, tsd: false, count: 0, burnt: false, pLive: 0 }
    states.set(ctx, s)
  }
  return s
}

const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d)
const idx = (v: unknown, d: number, max: number) => Math.min(max, Math.max(0, Math.round(num(v, d))))

function elementId(ctx: BehaviorContext): string {
  return String(ctx.params.element ?? 'reg')
}

function coldStart(ctx: BehaviorContext) {
  const s = stateOf(ctx)
  const ta = num(ctx.params.ambientC, 25)
  s.tj = s.tc = s.ts = ta
  s.tsd = false
  s.count = 0
  s.burnt = false
  s.pLive = 0
  ctx.setParam(elementId(ctx), 'disabled', false)
}

export const behavior: Behavior = {
  id: 'thermal-network',
  init: coldStart,
  reset: coldStart,
  onEvent(ctx, ev) {
    if (ev === 'power-on' || ev === 'power-off' || ev === 'repair' || ev === 'strip') coldStart(ctx)
  },

  tick(ctx, dt) {
    const p = ctx.params
    const s = stateOf(ctx)
    const id = elementId(ctx)
    const ta = num(p.ambientC, 25)
    const protect = num(p.protect, 1) !== 0
    const tsdOn = num(p.tsdOn, 150)
    const tsdOff = num(p.tsdOff, 130)
    const tMax = num(p.tMax, 150)

    // the network, from this tick's selections
    const sink = idx(p.sink, 1, 2)
    const bare = sink === 0
    const air = num(p.fan, 0) > 0.5 ? num(p.fanFactor, 0.45) : 1
    const rJC = Math.max(1e-3, num(p.rthJC, 5))
    let rCS = 0.001
    let cS = 0.02
    let rSA = Math.max(1e-3, num(p.rthJA, 65) - rJC) * air
    if (!bare) {
      const rs = num(p.rthSA, 0)
      const cs = num(p.cSink, 0)
      const rc = num(p.rthCS, 0)
      rCS = Math.max(1e-3, rc > 0 ? rc : PAD_RTH[idx(p.pad, 1, 2)])
      rSA = Math.max(1e-3, rs > 0 ? rs : SINK_RTH[sink]) * air
      cS = cs > 0 ? cs : SINK_C[sink]
    }
    const cJ = Math.max(1e-6, num(p.cJ, 0.05))
    const cC = Math.max(1e-6, num(p.cC, 0.8))
    const gJC = 1 / rJC
    const gCS = 1 / rCS
    const gSA = 1 / rSA

    // power: the solved dissipation while the element runs; the last real value is kept for the
    // substeps after a restart (the solver has not seen the re-enabled part yet)
    const sol = ctx.solution
    if (sol && ctx.powered && !s.tsd && !s.burnt) {
      const w = sol.powerOf ? sol.powerOf(id) : (sol.power[id] ?? 0)
      s.pLive = w > 0 ? w : 0
    }

    if (dt > 0 && ctx.powered) {
      let n = Math.ceil(dt / H_MAX)
      if (n > N_MAX) n = N_MAX
      if (n < 1) n = 1
      const h = dt / n
      const kJ = cJ / h
      const kC = cC / h
      const kS = cS / h
      // matrix rows are constant over the substeps (the power only changes the right side)
      const a11 = kJ + gJC
      const w1 = -gJC / a11
      const b22 = kC + gJC + gCS + gJC * w1 // row 2 with Tj eliminated (w1 < 0)
      const w2 = -gCS / b22
      const b33 = kS + gCS + gSA + gCS * w2 // a33 - a32*w2, a32 = -gCS
      for (let i = 0; i < n; i++) {
        const pw = s.tsd || s.burnt ? 0 : s.pLive
        const d1 = (kJ * s.tj + pw) / a11
        const d2 = (kC * s.tc + gJC * d1) / b22
        const d3 = (kS * s.ts + gSA * ta + gCS * d2) / b33
        s.ts = d3
        s.tc = d2 - w2 * d3
        s.tj = d1 - w1 * s.tc
        if (protect) {
          if (!s.tsd && s.tj >= tsdOn) {
            s.tsd = true
            s.count++
            ctx.setParam(id, 'disabled', true)
          } else if (s.tsd && s.tj < tsdOff) {
            s.tsd = false
            ctx.setParam(id, 'disabled', false)
          }
        } else if (!s.burnt && s.tj >= tMax) {
          s.burnt = true
          ctx.burn(id, 'overtemp', { value: s.tj, limit: tMax })
        }
      }
    }

    const rth = rJC + (bare ? 0 : rCS) + rSA
    ctx.publish('p_W', s.tsd || s.burnt ? 0 : s.pLive)
    ctx.publish('tj', s.tj)
    ctx.publish('tc', s.tc)
    ctx.publish('ths', s.ts)
    ctx.publish('rth_total', bare ? rJC + rSA : rth)
    ctx.publish('tj_ss', ta + s.pLive * (bare ? rJC + rSA : rth))
    ctx.publish('ths_ss', ta + s.pLive * rSA)
    ctx.publish('tau_s', (cJ + cC + cS) * rSA)
    ctx.publish('pmax_W', Math.max(0, (num(p.tLimit, 125) - ta) / (bare ? rJC + rSA : rth)))
    ctx.publish('tsd', s.tsd ? 1 : 0)
    ctx.publish('tsd_count', s.count)
    ctx.publish('tc_rise', s.tc - ta)
    ctx.publish('margin_C', num(p.tLimit, 125) - s.tj)
  },
}
