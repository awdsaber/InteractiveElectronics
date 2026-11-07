// PCA9685 (NXP) 16-channel, 12-bit PWM controller on I²C, driving hobby servos.
//
// The chip is a register file behind the I²C bus: MODE1, MODE2, the 16 LEDn_ON/OFF pairs,
// ALL_LED and PRE_SCALE, with auto-increment and the datasheet's write rules (PRE_SCALE only
// takes while MODE1.SLEEP is set). The behavior attaches it to the virtual MCU's `Wire` bus at
// every address the A0..A5 jumpers can select (0x40..0x7F); only the selected one (and the
// All-Call 0x70 while MODE1.ALLCALL is set) acknowledges, and nothing acknowledges while the bus
// is electrically broken (SDA/SCL not pulled above 0.7 VDD, VDD below 2.3 V). The library class
// `Adafruit_PWMServoDriver` (constructor, begin, setPWMFreq, setPWM, writeMicroseconds, ...)
// talks to the same register file, transaction by transaction, like the Adafruit library.
//
// The outputs are not simulated as waveforms. Every tick the behavior works out each channel's
// pulse width from the registers and the real oscillator, moves a servo model per channel, and
// sets that servo's supply draw on the V+ rail (a resistor, value = V+ / I).
//
// Servo model (SG90-class micro servo; approximate, measure yours):
//   target = (pulse - 500 µs) / 2000 µs × 180°, clamped 0..180 (the 500..2500 µs convention)
//   drive d = clamp((target - angle) / band, -1, 1); motor speed ω (fraction of full slew) lags
//   d with time constant tauM; slew = 600 °/s × V+ / vNom (0.1 s per 60° at 4.8 V)
//   current = iIdle + iStall × clamp(|d - ω| + load, 0, 1) + iRun × |ω|
//   (armature current ∝ drive minus back-EMF, plus the torque to hold the horn's load):
//   about 0.65 A at the start of a move, 0.25 A at full speed, 10 mA idle and unloaded.
//   No valid pulse: limp (idle current). V+ < vErratic (3.5 V, until it is back above vOk 4.0 V)
//   or no common ground: random twitching. V+ < vDead (2 V): nothing.
//
// Params (defaults in brackets):
//   bus      addr [0x40] base address, addrNodes [''] comma list of the A0..A5 jumper nodes
//            (HIGH above 0.7 VDD adds 1, 2, 4, ...), vdd ['5v'], sda ['sda'], scl ['scl']
//   servos   servos ['s0,s1,s2,s3'] R elements on channels 0.., vplus ['vplus'], servoGnd ['0'],
//            startDeg [90], load [0] (fraction of stall torque held), blocked [0] (bit mask),
//            vNom [4.8], slew [600 °/s], band [4°], tauM [0.015 s], iIdle [0.01], iRun [0.24],
//            iStall [0.65], vOk [4.0], vErratic [3.5], vDead [2.0], seed [1]
//   chip     oscActual [25e6 Hz]: the real internal oscillator (the sketch states its own guess)
// Publishes: freq_actual, prescale, sleep, addr, i2c_errors, gnd_ok, vplus_V, servo_A_total,
//   and per servo channel n: ch<n>_us, ch<n>_s, ch<n>_deg (the horn angle), ch<n>_A.

import type { I2cDevice } from '../mcu/virtualMcu'
import type { Behavior, BehaviorContext, Netlist, Solution } from '../types'

export const REG = {
  MODE1: 0x00,
  MODE2: 0x01,
  ALLCALLADR: 0x05,
  LED0: 0x06,
  ALL_LED: 0xfa,
  PRESCALE: 0xfe,
} as const

const MODE1_ALLCALL = 0x01
const MODE1_SLEEP = 0x10
const MODE1_AI = 0x20
const MODE1_RESTART = 0x80
const MODE2_INVRT = 0x10
const FULL = 0x10
const OSC_NOMINAL = 25_000_000
const CHANNELS = 16
/** a servo accepts frames from about 20 to 500 Hz and pulses of about 0.3..2.8 ms */
const F_MIN = 20
const F_MAX = 500
const US_MIN = 300
const US_MAX = 2800
/** servo state is integrated in substeps of at most this, s */
const SUB = 0.002

/** Adafruit's prescale: round(osc / (4096 f)) - 1, clamped to the chip's 3..255 */
export function prescaleFor(osc: number, freq: number): number {
  const f = Math.min(3500, Math.max(1, freq))
  const p = Math.floor(osc / (f * 4096) + 0.5) - 1
  return Math.min(255, Math.max(3, p))
}

/** the frame rate the chip really makes from its real oscillator */
export const freqActual = (oscActual: number, prescale: number): number => oscActual / (4096 * (prescale + 1))

/** 500..2500 µs → 0..180°, clamped */
export const usToDeg = (us: number): number => Math.min(180, Math.max(0, ((us - 500) / 2000) * 180))

// ── state ──

interface Servo {
  el: string
  pos: number
  omega: number
  /** the target at the end of the last tick (NaN: no drive) */
  last: number
  /** current drawn this tick, A (the model's, before the circuit) */
  i: number
  erratic: boolean
  jitUntil: number
  jitTarget: number
  jitDrive: boolean
  kUs: string
  kS: string
  kDeg: string
  kA: string
}

interface State {
  regs: Uint8Array
  ptr: number
  errors: number
  /** VDD was seen below 2.3 V: the next good VDD is a power-on reset */
  vddLow: boolean
  rng: () => number
  servoList: string
  servos: Servo[]
  addrList: string
  addrNodes: string[]
  /** common-ground check, cached per netlist structure */
  gndNet: Netlist | null
  gndSig: number
  gndOk: boolean
  /** per-channel pulse width this tick, µs (0 = no valid pulse) */
  us: Float64Array
}

const states = new WeakMap<BehaviorContext, State>()

/** mulberry32: a small seeded PRNG, so the twitching is reproducible */
function prng(seed: number): () => number {
  let a = seed >>> 0 || 1
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const num = (ctx: BehaviorContext, k: string, d: number): number => {
  const v = ctx.params[k]
  return typeof v === 'number' ? v : typeof v === 'string' && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d
}
const str = (ctx: BehaviorContext, k: string, d: string): string => {
  const v = ctx.params[k]
  return typeof v === 'string' ? v : d
}
const list = (s: string): string[] =>
  s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)

/** startDeg: one number for all, or a comma list per channel */
function startDeg(ctx: BehaviorContext, k: number): number {
  const v = ctx.params.startDeg
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const parts = list(v)
    const x = Number(parts[Math.min(k, parts.length - 1)])
    if (Number.isFinite(x)) return x
  }
  return 90
}

function powerOnReset(regs: Uint8Array): void {
  regs.fill(0)
  regs[REG.MODE1] = MODE1_SLEEP | MODE1_ALLCALL
  regs[REG.MODE2] = 0x04
  regs[0x02] = 0xe2
  regs[0x03] = 0xe4
  regs[0x04] = 0xe8
  regs[REG.ALLCALLADR] = 0xe0
  for (let ch = 0; ch < CHANNELS; ch++) regs[REG.LED0 + 4 * ch + 3] = FULL // LEDn_OFF_H: full off
  regs[REG.PRESCALE] = 0x1e // 200 Hz
}

function makeServos(ctx: BehaviorContext, ids: string[]): Servo[] {
  return ids.slice(0, CHANNELS).map((el, n) => ({
    el,
    pos: startDeg(ctx, n),
    omega: 0,
    last: NaN,
    i: 0,
    erratic: false,
    jitUntil: -1,
    jitTarget: 90,
    jitDrive: false,
    kUs: `ch${n}_us`,
    kS: `ch${n}_s`,
    kDeg: `ch${n}_deg`,
    kA: `ch${n}_A`,
  }))
}

function state(ctx: BehaviorContext): State {
  let s = states.get(ctx)
  if (!s) {
    const regs = new Uint8Array(256)
    powerOnReset(regs)
    const servoList = str(ctx, 'servos', 's0,s1,s2,s3')
    const addrList = str(ctx, 'addrNodes', '')
    s = {
      regs,
      ptr: 0,
      errors: 0,
      vddLow: false,
      rng: prng(num(ctx, 'seed', 1)),
      servoList,
      servos: makeServos(ctx, list(servoList)),
      addrList,
      addrNodes: list(addrList),
      gndNet: null,
      gndSig: 0,
      gndOk: true,
      us: new Float64Array(CHANNELS),
    }
    states.set(ctx, s)
  }
  return s
}

// ── the bus ──

function vdd(ctx: BehaviorContext): number {
  return ctx.v(str(ctx, 'vdd', '5v'))
}

/** SDA and SCL idle HIGH (pulled above 0.7 VDD) and the chip has VDD */
function busOk(ctx: BehaviorContext): boolean {
  const vd = vdd(ctx)
  if (vd < 2.3) return false
  return ctx.v(str(ctx, 'sda', 'sda')) > 0.7 * vd && ctx.v(str(ctx, 'scl', 'scl')) > 0.7 * vd
}

/** the 7-bit address the jumpers select */
function address(ctx: BehaviorContext, st: State): number {
  const base = num(ctx, 'addr', 0x40)
  const al = str(ctx, 'addrNodes', '')
  if (al !== st.addrList) {
    st.addrList = al
    st.addrNodes = list(al)
  }
  const vh = 0.7 * vdd(ctx)
  let a = base
  for (let k = 0; k < st.addrNodes.length; k++) if (ctx.v(st.addrNodes[k]) > vh) a += 1 << k
  return a & 0x7f
}

function acks(ctx: BehaviorContext, a: number): boolean {
  const st = state(ctx)
  const ok = busOk(ctx) && (a === address(ctx, st) || ((st.regs[REG.MODE1] & MODE1_ALLCALL) !== 0 && a === st.regs[REG.ALLCALLADR] >> 1))
  if (!ok) st.errors++
  return ok
}

function writeReg(st: State, r: number, v: number): void {
  const regs = st.regs
  if (r === REG.MODE1) {
    regs[r] = v & ~MODE1_RESTART & 0xff // RESTART reads back 0 once the PWM has restarted
  } else if (r === REG.PRESCALE) {
    if (regs[REG.MODE1] & MODE1_SLEEP) regs[r] = Math.max(3, v) // the hardware forces a minimum of 3
  } else if (r >= REG.ALL_LED && r < REG.PRESCALE) {
    for (let ch = 0; ch < CHANNELS; ch++) regs[REG.LED0 + 4 * ch + (r - REG.ALL_LED)] = v
  } else if (r !== 0xff) regs[r] = v
}

/** with MODE1.AI the pointer advances, rolling over to MODE1 after LED15_OFF_H (0x45) and PRE_SCALE (0xFE) */
const nextPtr = (st: State, r: number) => (st.regs[REG.MODE1] & MODE1_AI ? (r === 0x45 || r === REG.PRESCALE ? 0 : (r + 1) & 0xff) : r)

function devWrite(ctx: BehaviorContext, bytes: number[]): void {
  const st = state(ctx)
  if (!bytes.length) return
  st.ptr = bytes[0] & 0xff
  for (let k = 1; k < bytes.length; k++) {
    writeReg(st, st.ptr, bytes[k] & 0xff)
    st.ptr = nextPtr(st, st.ptr)
  }
}

function devRead(ctx: BehaviorContext, n: number): number[] {
  const st = state(ctx)
  const out: number[] = []
  for (let k = 0; k < n; k++) {
    // ALL_LED reads back 0
    out.push(st.ptr >= REG.ALL_LED && st.ptr < REG.PRESCALE ? 0 : st.regs[st.ptr])
    st.ptr = nextPtr(st, st.ptr)
  }
  return out
}

function device(ctx: BehaviorContext, a: number): I2cDevice {
  return {
    ack: () => acks(ctx, a),
    write: (bytes) => devWrite(ctx, bytes),
    read: (n) => devRead(ctx, n),
  }
}

/** one master transaction to `a`; 0 = ACK, 2 = NACK (what Wire.endTransmission returns) */
function tx(ctx: BehaviorContext, a: number, bytes: number[]): number {
  if (!acks(ctx, a)) return 2
  devWrite(ctx, bytes)
  return 0
}

function rx(ctx: BehaviorContext, a: number, reg: number): number {
  if (tx(ctx, a, [reg]) !== 0) return 0
  if (!acks(ctx, a)) return 0
  return devRead(ctx, 1)[0]
}

/** The Adafruit PWM Servo Driver library's API, on this bench's chip. */
function makeLibrary(ctx: BehaviorContext) {
  return class Adafruit_PWMServoDriver {
    private readonly addr: number
    private osc = OSC_NOMINAL
    constructor(addr = 0x40, _wire?: unknown) {
      this.addr = Math.trunc(Number(addr)) & 0x7f
    }
    begin(prescale = 0): boolean {
      // the library probes the address first and gives up on a NACK
      if (!acks(ctx, this.addr)) return false
      this.reset()
      this.osc = OSC_NOMINAL
      if (prescale) {
        // PRE_SCALE only takes while asleep: sleep, write it, wake with auto-increment
        const old = this.read8(REG.MODE1)
        this.write8(REG.MODE1, (old & ~MODE1_RESTART) | MODE1_SLEEP)
        this.write8(REG.PRESCALE, prescale)
        this.write8(REG.MODE1, (old & ~MODE1_SLEEP) | MODE1_AI)
      }
      else this.setPWMFreq(1000)
      return true
    }
    reset(): void {
      this.write8(REG.MODE1, MODE1_RESTART)
    }
    sleep(): void {
      this.write8(REG.MODE1, this.read8(REG.MODE1) | MODE1_SLEEP)
    }
    wakeup(): void {
      this.write8(REG.MODE1, this.read8(REG.MODE1) & ~MODE1_SLEEP)
    }
    setOscillatorFrequency(hz: number): void {
      this.osc = Number(hz)
    }
    getOscillatorFrequency(): number {
      return this.osc
    }
    setPWMFreq(freq: number): void {
      const prescale = prescaleFor(this.osc, Number(freq))
      const old = this.read8(REG.MODE1)
      this.write8(REG.MODE1, (old & ~MODE1_RESTART) | MODE1_SLEEP) // PRESCALE only takes while asleep
      this.write8(REG.PRESCALE, prescale)
      this.write8(REG.MODE1, old)
      this.write8(REG.MODE1, old | MODE1_RESTART | MODE1_AI)
    }
    readPrescale(): number {
      return this.read8(REG.PRESCALE)
    }
    setOutputMode(totempole: boolean): void {
      const m2 = this.read8(REG.MODE2)
      this.write8(REG.MODE2, totempole ? m2 | 0x04 : m2 & ~0x04)
    }
    getPWM(ch: number, off = false): number {
      const r = REG.LED0 + 4 * (Math.trunc(ch) & 15) + (off ? 2 : 0)
      return this.read8(r) | ((this.read8(r + 1) & 0x1f) << 8)
    }
    setPWM(ch: number, on: number, off: number): number {
      const n = Math.trunc(ch) & 15
      const a = Math.trunc(on) & 0x1fff
      const b = Math.trunc(off) & 0x1fff
      return tx(ctx, this.addr, [REG.LED0 + 4 * n, a & 0xff, a >> 8, b & 0xff, b >> 8])
    }
    setPin(ch: number, val: number, invert = false): void {
      let v = Math.min(Math.max(Math.trunc(val), 0), 4095)
      if (invert) v = 4095 - v
      if (v === 4095) this.setPWM(ch, 4096, 0)
      else if (v === 0) this.setPWM(ch, 0, 4096)
      else this.setPWM(ch, 0, v)
    }
    writeMicroseconds(ch: number, us: number): void {
      // the library converts with the oscillator value the sketch gave it, not the real one
      const tick = (1e6 * (this.readPrescale() + 1)) / this.osc
      this.setPWM(ch, 0, Math.trunc(Number(us) / tick))
    }
    private read8(reg: number): number {
      return rx(ctx, this.addr, reg)
    }
    private write8(reg: number, v: number): void {
      tx(ctx, this.addr, [reg, v & 0xff])
    }
  }
}

// ── common ground (servo supply negative tied to the logic ground) ──

/** a cheap structural signature of the netlist: element ids, types, switch states, disables, blown fuses and\n * resistors at or above 1e8 Ω (the same conditions groundPath uses) */
function signature(net: Netlist): number {
  let h = net.elements.length
  for (const el of net.elements) {
    for (let k = 0; k < el.id.length; k++) h = (Math.imul(h, 31) + el.id.charCodeAt(k)) | 0
    h = (Math.imul(h, 7) + el.type.length + (el.disabled ? 3 : 0) + (el.type === 'SW' && el.closed ? 5 : 0) + (el.type === 'FUSE' && el.blown ? 11 : 0) + (el.type === 'R' && el.value >= 1e8 ? 13 : 0)) | 0
  }
  return h
}

/** DC path from `node` to ground through closed switches and resistors below 100 MΩ */
function groundPath(net: Netlist, node: string): boolean {
  if (node === '0') return true
  const parent = new Map<string, string>()
  const find = (n: string): string => {
    let r = n
    while (parent.has(r) && parent.get(r) !== r) r = parent.get(r)!
    parent.set(n, r)
    return r
  }
  for (const el of net.elements) {
    if (el.disabled || el.type === 'C' || el.type === 'I' || el.type === 'PROBE') continue
    if (el.type === 'SW' && !el.closed) continue
    if (el.type === 'R' && el.value >= 1e8) continue
    if (el.type === 'FUSE' && el.blown) continue
    for (let i = 1; i < el.nodes.length; i++) {
      const a = find(el.nodes[0])
      const b = find(el.nodes[i])
      if (a !== b) parent.set(a, b)
    }
  }
  return find(node) === find('0')
}

function gndOk(ctx: BehaviorContext, st: State, gnd: string): boolean {
  const net = ctx.netlist
  if (net === st.gndNet) return st.gndOk
  st.gndNet = net
  const sig = signature(net)
  // a new netlist object with the same structure (a live value changed) keeps the answer
  if (sig === st.gndSig && st.gndSig !== 0) return st.gndOk
  st.gndSig = sig
  st.gndOk = groundPath(net, gnd)
  return st.gndOk
}

// ── per tick ──

const curOf = (s: Solution, id: string) => (s.currentOf ? s.currentOf(id) : (s.current[id] ?? 0))
/** log-quantised to 2 % so a steady current doesn't rebuild the netlist every frame */
const quantLog = (x: number) => Math.exp(Math.round(Math.log(x) / 0.02) * 0.02)

/** fill st.us with each channel's servo pulse width, µs (0 = none); returns the actual frame rate */
function decode(ctx: BehaviorContext, st: State, powered: boolean): number {
  const regs = st.regs
  const f = freqActual(num(ctx, 'oscActual', OSC_NOMINAL), regs[REG.PRESCALE])
  const out = powered && !(regs[REG.MODE1] & MODE1_SLEEP)
  const inv = (regs[REG.MODE2] & MODE2_INVRT) !== 0
  for (let ch = 0; ch < CHANNELS; ch++) {
    const b = REG.LED0 + 4 * ch
    let counts: number
    if (regs[b + 3] & FULL) counts = 0
    else if (regs[b + 1] & FULL) counts = 4096
    else {
      const on = regs[b] | ((regs[b + 1] & 0x0f) << 8)
      const off = regs[b + 2] | ((regs[b + 3] & 0x0f) << 8)
      counts = (off - on + 4096) % 4096
    }
    if (inv) counts = 4096 - counts
    const us = (counts / 4096) * (1e6 / f)
    st.us[ch] = out && counts > 0 && counts < 4096 && f >= F_MIN && f <= F_MAX && us >= US_MIN && us <= US_MAX ? us : 0
  }
  return f
}


export const behavior: Behavior = {
  id: 'pca9685',

  libraries: (ctx) => ({ Adafruit_PWMServoDriver: makeLibrary(ctx) }),

  init(ctx) {
    state(ctx)
    for (let a = 0x40; a <= 0x7f; a++) ctx.mcu.attachI2c(a, device(ctx, a))
  },

  tick(ctx, dt) {
    const s = ctx.solution
    if (!s) return
    const st = state(ctx)

    // VDD: below 2.3 V the chip is unpowered; coming back is a power-on reset
    const vdOk = vdd(ctx) >= 2.3
    if (!vdOk) st.vddLow = true
    else if (st.vddLow) {
      powerOnReset(st.regs)
      st.vddLow = false
    }

    const f = decode(ctx, st, vdOk)

    const sl = str(ctx, 'servos', 's0,s1,s2,s3')
    if (sl !== st.servoList) {
      st.servoList = sl
      st.servos = makeServos(ctx, list(sl))
    }
    const vplus = str(ctx, 'vplus', 'vplus')
    const sgnd = str(ctx, 'servoGnd', '0')
    const gok = gndOk(ctx, st, sgnd)
    const vs = ctx.v(vplus, sgnd)

    const vNom = num(ctx, 'vNom', 4.8)
    const slew = (num(ctx, 'slew', 600) * Math.max(0, vs)) / vNom
    const band = num(ctx, 'band', 4)
    const tauM = num(ctx, 'tauM', 0.015)
    const iIdle = num(ctx, 'iIdle', 0.01)
    const iRun = num(ctx, 'iRun', 0.24)
    const iStall = num(ctx, 'iStall', 0.65)
    const load = Math.min(1, Math.max(0, num(ctx, 'load', 0)))
    const blocked = Math.trunc(num(ctx, 'blocked', 0))
    const vOk = num(ctx, 'vOk', 4.0)
    const vErr = num(ctx, 'vErratic', 3.5)
    const vDead = num(ctx, 'vDead', 2.0)

    const h0 = Math.max(0, dt)
    const nSub = Math.max(1, Math.ceil(h0 / SUB))
    const h = h0 / nSub
    const a = tauM > 0 ? 1 - Math.exp(-h / tauM) : 1

    let total = 0
    for (let k = 0; k < st.servos.length; k++) {
      const sv = st.servos[k]
      const dead = vs < vDead
      if (vs < vErr) sv.erratic = true
      else if (vs >= vOk) sv.erratic = false
      const twitch = !dead && (!gok || sv.erratic)

      let drive = false
      let target = sv.pos
      if (twitch) {
        // the signal has no reference (or the servo's electronics brown out): random moves
        if (ctx.t >= sv.jitUntil) {
          sv.jitTarget = st.rng() * 180
          sv.jitDrive = st.rng() > 0.3
          sv.jitUntil = ctx.t + 0.04 + st.rng() * 0.2
        }
        drive = sv.jitDrive
        target = sv.jitTarget
      } else if (!dead && st.us[k] > 0) {
        drive = true
        target = usToDeg(st.us[k])
      }
      const stuck = (blocked >> k) & 1

      let iSum = 0
      if (dead) {
        sv.omega = 0
      } else {
        // the sketch may have sent several commands since the last tick (a slow frame): ramp the
        // target from the last tick's over this one, so the servo sees a move, not a jump
        const from = drive && sv.last === sv.last ? sv.last : target
        for (let j = 0; j < nSub; j++) {
          const tgt = from + ((target - from) * (j + 1)) / nSub
          const err = tgt - sv.pos
          const d = drive ? Math.min(1, Math.max(-1, err / band)) : 0
          if (stuck) sv.omega = 0
          else sv.omega += (d - sv.omega) * a
          const step = sv.omega * slew * h
          if (drive && (err > 0 ? step > err : step < err)) {
            sv.pos = tgt
            sv.omega = 0
          } else sv.pos = Math.min(180, Math.max(0, sv.pos + step))
          const motor = Math.min(1, Math.abs(d - sv.omega) + (drive ? load : 0))
          iSum += iIdle + iStall * motor + iRun * Math.abs(sv.omega)
        }
      }
      sv.i = dead ? 0 : iSum / nSub
      sv.last = drive && !dead ? target : NaN

      // the supply draw as a resistor across V+: constant-current-like, and harmless if V+ collapses
      if (sv.el) ctx.setParam(sv.el, 'value', sv.i > 1e-6 ? quantLog(Math.max(0.5, vs) / sv.i) : 1e6)
      const cur = sv.el ? curOf(s, sv.el) : 0
      total += cur
      ctx.publish(sv.kUs, st.us[k])
      ctx.publish(sv.kS, st.us[k] * 1e-6)
      ctx.publish(sv.kDeg, sv.pos)
      ctx.publish(sv.kA, sv.i)
    }

    ctx.publish('freq_actual', vdOk ? f : 0)
    ctx.publish('prescale', st.regs[REG.PRESCALE])
    ctx.publish('sleep', st.regs[REG.MODE1] & MODE1_SLEEP ? 1 : 0)
    ctx.publish('addr', address(ctx, st))
    ctx.publish('i2c_errors', st.errors)
    ctx.publish('gnd_ok', gok ? 1 : 0)
    ctx.publish('vplus_V', vs)
    ctx.publish('servo_A_total', Math.abs(total) < 1e-6 ? 0 : total)
  },

  onEvent(ctx, ev) {
    const st = state(ctx)
    if (ev === 'power-off') {
      powerOnReset(st.regs)
      st.errors = 0
    }
  },

  reset(ctx) {
    states.delete(ctx)
    state(ctx)
  },

  dispose(ctx) {
    states.delete(ctx)
  },
}
