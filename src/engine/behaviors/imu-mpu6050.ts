// imu-mpu6050: TDK InvenSense MPU-6050 6-axis IMU (3-axis gyro + 3-axis accelerometer) on I²C.
// Reused by the capstone balancing robot, so the true pitch can come from a tweak, a scripted
// profile or another behavior.
//
// Each tick the behavior runs the chip's signal chain at a 1 kHz internal sample rate:
//   true motion   θ (pitch, about Y) and ω = dθ/dt, from `pitchSource`:
//                   'tweak'   (default) params.pitchDeg, slewed at params.slewDegS (200 °/s)
//                   'profile' params.profileAmp · sin(2π · params.profileHz · t)
//                   any other string: another behavior's published key (e.g. 'robot.pitch', degrees),
//                   read with ctx.read; its rate is `<key>_rate` (°/s) when published, else dθ/dt
//   gyro Y        ω + bias(T) + noise, bias(T) = gyroBias + biasTempco · (tempC − 25)
//   accelerometer ax = −sin θ + vib_x, ay = 0, az = cos θ + vib_z (in g), plus noise
//   DLPF          a first-order low-pass whose time constant is the datasheet delay of the
//                 DLPF_CFG setting; the white noise is band-limited to the setting's bandwidth
//                 (σ = density · √BW, as an AR(1) process), and the shaker's vibration
//                 (a sinusoid at the motor's shaft frequency, amplitude vibGain · ω_motor²) is
//                 attenuated by 1/√(1 + (f/BW)²)
// The last sample of each frame lands in a register file served over I²C (so a sketch polling
// faster than the frame rate reads repeated samples) (0x68, or 0x69 with AD0 high; WHO_AM_I =
// 0x68, PWR_MGMT_1 resets to 0x40 = asleep). The chip ACKs only while the bus is healthy
// (V(3v3) ≥ 2.375 V and SDA/SCL idle above 0.7 × V(3v3)) and at its own address.
//
// Sketch libraries: `MPU6050` (an i2cdevlib-style class, constructor address default 0x68) and
// `mpu`, an instance at params.addr. Raw register access works through Wire as on real hardware.
//
// A reference complementary filter (params.alpha 0.98 at params.refHz 100 Hz) runs on the same
// samples, calibrating the gyro for params.calSeconds (1 s) after power-on, upload and bus
// recovery, as the lesson sketch does. Publishes (degrees unless noted):
//   pitch_true, pitch_accel (atan2), pitch_gyro (raw rate integrated from power-up, no bias
//   correction), pitch_gyro_cal (bias-corrected with the power-up calibration),
//   pitch_filtered (the reference filter), gyro_bias_now (°/s), vib_g (rms plate vibration, g),
//   i2c_ok (1/0), addr_now (the chip's address), dlpf, temp_c, calibrating (1/0)
// The estimates read 0 while the chip is not found at params.addr (dead bus or AD0 mismatch). A failure that cuts the chip off the bus resets the
// MCU (a re-plug), and repair resets it again, so the sketch's setup() check runs each time.
//
// Params (defaults): pitchSource 'tweak', pitchDeg 0, slewDegS 200, profileAmp 20, profileHz 0.2,
//   mountOffsetDeg 0, gyroBias 2.1 °/s, biasTempco 0.03 °/s/°C (illustrative), tempC 25,
//   gyroNoise 0.005 °/s/√Hz, accelNoise 400e-6 g/√Hz (datasheet densities), vibGain 2.9e-7 g peak
//   per (rad/s)² (illustrative: 0.5 g rms at 1560 rad/s ≈ 15 000 rpm, a 3 V coin ERM),
//   motorId 'vib', dlpf 0..6 (applied to CONFIG when it changes), addr 0x68, alpha 0.98, refHz 100,
//   calSeconds 1, seed 1, and nodes sda 'sda', scl 'scl', vdd '3v3', ad0 'ad0'.
//   perStep 0: with 1 and a behavior key as pitchSource, sample and latch every solve (onStep) on that
//   behavior's value from the same step (ctx.readNow; list it first), adding its `<key>_ax_g` / `<key>_az_g`
//   (the robot's own acceleration at the sensor, g) to the accelerometer.

import type { Behavior, BehaviorContext } from '../types'

/** DLPF_CFG 0..6 (register map, CONFIG): bandwidth Hz and delay ms */
export const DLPF = {
  accelBw: [260, 184, 94, 44, 21, 10, 5],
  accelDelayMs: [0, 2.0, 3.0, 4.9, 8.5, 13.8, 19.0],
  gyroBw: [256, 188, 98, 42, 20, 10, 5],
  gyroDelayMs: [0.98, 1.9, 2.8, 4.8, 8.3, 13.4, 18.6],
} as const

/** LSB per °/s for FS_SEL 0..3 (±250, ±500, ±1000, ±2000 °/s) */
export const GYRO_LSB = [131, 65.5, 32.8, 16.4] as const
/** LSB per g for AFS_SEL 0..3 (±2, ±4, ±8, ±16 g) */
export const ACCEL_LSB = [16384, 8192, 4096, 2048] as const

/** complementary filter time constant τ = α·dt/(1 − α) */
export const complementaryTau = (alpha: number, dt: number): number => (alpha * dt) / (1 - alpha)

export const REG = {
  SMPLRT_DIV: 0x19,
  CONFIG: 0x1a,
  GYRO_CONFIG: 0x1b,
  ACCEL_CONFIG: 0x1c,
  ACCEL_XOUT_H: 0x3b,
  TEMP_OUT_H: 0x41,
  GYRO_XOUT_H: 0x43,
  PWR_MGMT_1: 0x6b,
  WHO_AM_I: 0x75,
} as const

const VDD_MIN = 2.375
const H = 1e-3 // internal sample period, s
const MAX_SAMPLES = 400
const D2R = Math.PI / 180
const R2D = 180 / Math.PI

/** mulberry32 */
function makeRng(seed: number) {
  let a = seed >>> 0 || 1
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface State {
  regs: Uint8Array
  ptr: number
  rand: () => number
  spare: number
  hasSpare: boolean
  // true motion
  theta: number
  thetaInit: boolean
  srcPrev: number
  srcKey: string
  rateKey: string
  // sensor chain
  gLp: number
  axLp: number
  azLp: number
  nG: number
  nGx: number
  nGz: number
  nX: number
  nY: number
  nZ: number
  phase: number
  vibRms: number
  // sensed values in physical units (last sample)
  gyroY: number
  ax: number
  ay: number
  az: number
  // bus
  busOk: boolean
  /** the chip answers at params.addr */
  found: boolean
  chipAddr: number
  dlpfParam: number
  motorKey: string
  motorId: string
  // reference filter
  refAcc: number
  calLeft: number
  calSum: number
  calN: number
  calBias: number
  started: boolean
  pGyro: number
  pGyroCal: number
  pFilt: number
  pAccel: number
  /** the signal chain's constants for one sample of k.h seconds */
  k: ChainConsts
  /** per-step mode: the last solve's time, and the source's linear-acceleration keys */
  stepT: number
  axKey: string
  azKey: string
  /** the shaker, from the last tick */
  vibA: number
  fVib: number
  omegaM: number
}

interface ChainConsts {
  h: number
  cfg: number
  kA: number
  kG: number
  aA: number
  aG: number
  sA: number
  sG: number
  vibSensed: number
  bias: number
  mount: number
  alpha: number
  refDt: number
}

const states = new WeakMap<BehaviorContext, State>()

const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d)
const str = (v: unknown, d: string) => (typeof v === 'string' && v ? v : d)

function resetRegs(s: State): void {
  s.regs.fill(0)
  s.regs[REG.PWR_MGMT_1] = 0x40 // SLEEP after power-on reset
  s.regs[REG.WHO_AM_I] = 0x68
  s.ptr = 0
  s.dlpfParam = NaN // re-apply params.dlpf
}

function restartReference(ctx: BehaviorContext, s: State): void {
  s.calLeft = num(ctx.params.calSeconds, 1)
  s.calSum = 0
  s.calN = 0
  s.calBias = 0
  s.started = false
  s.refAcc = 0
}

function state(ctx: BehaviorContext): State {
  let s = states.get(ctx)
  if (!s) {
    s = {
      regs: new Uint8Array(128),
      ptr: 0,
      rand: makeRng(num(ctx.params.seed, 1)),
      spare: 0,
      hasSpare: false,
      theta: 0,
      thetaInit: false,
      srcPrev: 0,
      srcKey: '',
      rateKey: '',
      gLp: 0,
      axLp: 0,
      azLp: 1,
      nG: 0,
      nGx: 0,
      nGz: 0,
      nX: 0,
      nY: 0,
      nZ: 0,
      phase: 0,
      vibRms: 0,
      gyroY: 0,
      ax: 0,
      ay: 0,
      az: 1,
      busOk: false,
      found: false,
      chipAddr: 0x68,
      dlpfParam: NaN,
      motorKey: '',
      motorId: '',
      refAcc: 0,
      calLeft: 1,
      calSum: 0,
      calN: 0,
      calBias: 0,
      started: false,
      pGyro: 0,
      pGyroCal: 0,
      pFilt: 0,
      pAccel: 0,
      k: { h: 0, cfg: -1, kA: 1, kG: 1, aA: 0, aG: 0, sA: 0, sG: 0, vibSensed: 0, bias: 0, mount: 0, alpha: 0.98, refDt: 0.01 },
      stepT: 0,
      axKey: '',
      azKey: '',
      vibA: 0,
      fVib: 0,
      omegaM: 0,
    }
    resetRegs(s)
    restartReference(ctx, s)
    states.set(ctx, s)
  }
  return s
}

/** standard normal (Box–Muller, the spare cached so nothing allocates) */
function gauss(s: State): number {
  if (s.hasSpare) {
    s.hasSpare = false
    return s.spare
  }
  let u = s.rand()
  while (u <= 1e-12) u = s.rand()
  const v = s.rand()
  const r = Math.sqrt(-2 * Math.log(u))
  s.spare = r * Math.sin(2 * Math.PI * v)
  s.hasSpare = true
  return r * Math.cos(2 * Math.PI * v)
}

const dlpfOf = (s: State) => Math.min(6, s.regs[REG.CONFIG] & 7)
const gyroLsb = (s: State) => GYRO_LSB[(s.regs[REG.GYRO_CONFIG] >> 3) & 3]
const accelLsb = (s: State) => ACCEL_LSB[(s.regs[REG.ACCEL_CONFIG] >> 3) & 3]

function put16(regs: Uint8Array, at: number, v: number): void {
  const x = Math.max(-32768, Math.min(32767, Math.round(v)))
  regs[at] = (x >> 8) & 0xff
  regs[at + 1] = x & 0xff
}

/** write the latest sample into the data registers (zeros while asleep) */
function latch(s: State, tempC: number): void {
  const r = s.regs
  if (r[REG.PWR_MGMT_1] & 0x40) {
    r.fill(0, REG.ACCEL_XOUT_H, REG.GYRO_XOUT_H + 6)
    return
  }
  const a = accelLsb(s)
  const g = gyroLsb(s)
  put16(r, REG.ACCEL_XOUT_H, s.ax * a)
  put16(r, REG.ACCEL_XOUT_H + 2, s.ay * a)
  put16(r, REG.ACCEL_XOUT_H + 4, s.az * a)
  put16(r, REG.TEMP_OUT_H, (tempC - 36.53) * 340) // datasheet: T = raw/340 + 36.53
  put16(r, REG.GYRO_XOUT_H, s.nGx * g) // X and Z: no motion, noise only
  put16(r, REG.GYRO_XOUT_H + 2, s.gyroY * g)
  put16(r, REG.GYRO_XOUT_H + 4, s.nGz * g)
}

function writeReg(ctx: BehaviorContext, s: State, reg: number, v: number): void {
  if (reg === REG.WHO_AM_I) return // read-only
  if (reg === REG.PWR_MGMT_1 && v & 0x80) {
    resetRegs(s) // DEVICE_RESET
    s.dlpfParam = num(ctx.params.dlpf, 0) // a software reset is not a tweak change
    return
  }
  s.regs[reg & 0x7f] = v & 0xff
}

function readReg(s: State, reg: number): number {
  return s.regs[reg & 0x7f]
}

/** the chip answers at `addr` right now */
const acks = (s: State, addr: number) => s.busOk && s.chipAddr === addr

function busRead16(s: State, addr: number, reg: number): number {
  if (!acks(s, addr)) return 0
  const v = (readReg(s, reg) << 8) | readReg(s, reg + 1)
  return v & 0x8000 ? v - 0x10000 : v
}

function busWriteBits(ctx: BehaviorContext, s: State, addr: number, reg: number, mask: number, value: number): void {
  if (!acks(s, addr)) return
  writeReg(ctx, s, reg, (readReg(s, reg) & ~mask) | (value & mask))
}

/** one I²C target at `addr`; the bus devices for 0x68 and 0x69 share the state */
function device(ctx: BehaviorContext, s: State, addr: number) {
  return {
    ack: () => acks(s, addr),
    write(bytes: number[]) {
      if (!bytes.length) return
      s.ptr = bytes[0] & 0x7f
      for (let i = 1; i < bytes.length; i++) {
        writeReg(ctx, s, s.ptr, bytes[i])
        s.ptr = (s.ptr + 1) & 0x7f
      }
    },
    read(n: number) {
      const out: number[] = []
      for (let i = 0; i < n; i++) {
        out.push(readReg(s, s.ptr))
        s.ptr = (s.ptr + 1) & 0x7f
      }
      return out
    },
  }
}

function makeLibrary(ctx: BehaviorContext) {
  const s = state(ctx)
  class MPU6050 {
    addr: number
    constructor(addr?: number) {
      this.addr = typeof addr === 'number' ? addr & 0x7f : 0x68
    }
    initialize() {
      // clock from the X gyro PLL, wake up; ±250 °/s; ±2 g (i2cdevlib initialize())
      busWriteBits(ctx, s, this.addr, REG.PWR_MGMT_1, 0xff, 0x01)
      busWriteBits(ctx, s, this.addr, REG.GYRO_CONFIG, 0x18, 0)
      busWriteBits(ctx, s, this.addr, REG.ACCEL_CONFIG, 0x18, 0)
    }
    testConnection() {
      return acks(s, this.addr) && readReg(s, REG.WHO_AM_I) === 0x68
    }
    getDeviceID() {
      return acks(s, this.addr) ? (readReg(s, REG.WHO_AM_I) >> 1) & 0x3f : 0
    }
    getAccelerationX() {
      return busRead16(s, this.addr, REG.ACCEL_XOUT_H)
    }
    getAccelerationY() {
      return busRead16(s, this.addr, REG.ACCEL_XOUT_H + 2)
    }
    getAccelerationZ() {
      return busRead16(s, this.addr, REG.ACCEL_XOUT_H + 4)
    }
    getTemperature() {
      return busRead16(s, this.addr, REG.TEMP_OUT_H)
    }
    getRotationX() {
      return busRead16(s, this.addr, REG.GYRO_XOUT_H)
    }
    getRotationY() {
      return busRead16(s, this.addr, REG.GYRO_XOUT_H + 2)
    }
    getRotationZ() {
      return busRead16(s, this.addr, REG.GYRO_XOUT_H + 4)
    }
    setDLPFMode(mode: number) {
      busWriteBits(ctx, s, this.addr, REG.CONFIG, 0x07, Math.trunc(mode))
    }
    getDLPFMode() {
      return acks(s, this.addr) ? readReg(s, REG.CONFIG) & 7 : 0
    }
    setFullScaleGyroRange(r: number) {
      busWriteBits(ctx, s, this.addr, REG.GYRO_CONFIG, 0x18, (Math.trunc(r) & 3) << 3)
    }
    getFullScaleGyroRange() {
      return acks(s, this.addr) ? (readReg(s, REG.GYRO_CONFIG) >> 3) & 3 : 0
    }
    setFullScaleAccelRange(r: number) {
      busWriteBits(ctx, s, this.addr, REG.ACCEL_CONFIG, 0x18, (Math.trunc(r) & 3) << 3)
    }
    getFullScaleAccelRange() {
      return acks(s, this.addr) ? (readReg(s, REG.ACCEL_CONFIG) >> 3) & 3 : 0
    }
    setSleepEnabled(on: unknown) {
      busWriteBits(ctx, s, this.addr, REG.PWR_MGMT_1, 0x40, on ? 0x40 : 0)
    }
    getSleepEnabled() {
      return acks(s, this.addr) ? (readReg(s, REG.PWR_MGMT_1) >> 6) & 1 : 0
    }
    setRate(div: number) {
      busWriteBits(ctx, s, this.addr, REG.SMPLRT_DIV, 0xff, Math.trunc(div))
    }
  }
  return { MPU6050, mpu: new MPU6050(num(ctx.params.addr, 0x68)) }
}

/** V(3v3) ≥ 2.375 V and SDA/SCL idle above 0.7 × V(3v3) */
function busHealthy(ctx: BehaviorContext): boolean {
  const p = ctx.params
  const vdd = ctx.v(str(p.vdd, '3v3'))
  return vdd >= VDD_MIN && ctx.v(str(p.sda, 'sda')) > 0.7 * vdd && ctx.v(str(p.scl, 'scl')) > 0.7 * vdd
}

/** 0x68, or 0x69 with AD0 above 0.7 × V(3v3) */
const chipAddress = (ctx: BehaviorContext) => 0x68 + (ctx.v(str(ctx.params.ad0, 'ad0')) > 0.7 * ctx.v(str(ctx.params.vdd, '3v3')) ? 1 : 0)

/** move the true pitch to the end of internal sample k of n; returns its rate ω, °/s */
function advanceTruth(ctx: BehaviorContext, s: State, mode: number, t: number, h: number, target: number, rate: number, k: number, n: number): number {
  if (mode === 0) {
    const slew = num(ctx.params.slewDegS, 200) * h
    const d = Math.max(-slew, Math.min(slew, target - s.theta))
    s.theta += d
    return d / h
  }
  if (mode === 1) {
    const amp = num(ctx.params.profileAmp, 20)
    const w = 2 * Math.PI * num(ctx.params.profileHz, 0.2)
    s.theta = amp * Math.sin(w * t)
    return amp * w * Math.cos(w * t)
  }
  // another behavior's value: linear between last tick's and this tick's
  s.theta = s.srcPrev + ((target - s.srcPrev) * (k + 1)) / n
  return rate
}

/** filter and noise constants for one internal sample of h seconds at the current DLPF setting (into s.k) */
function chainConstants(ctx: BehaviorContext, s: State, h: number): void {
  const p = ctx.params
  const k = s.k
  const cfg = dlpfOf(s)
  const tauA = DLPF.accelDelayMs[cfg] / 1000
  const tauG = DLPF.gyroDelayMs[cfg] / 1000
  const bwA = DLPF.accelBw[cfg]
  const bwG = DLPF.gyroBw[cfg]
  k.kA = tauA > 0 ? 1 - Math.exp(-h / tauA) : 1
  k.kG = tauG > 0 ? 1 - Math.exp(-h / tauG) : 1
  k.aA = Math.exp(-2 * Math.PI * bwA * h)
  k.aG = Math.exp(-2 * Math.PI * bwG * h)
  k.sA = num(p.accelNoise, 400e-6) * Math.sqrt(bwA) * Math.sqrt(1 - k.aA * k.aA)
  k.sG = num(p.gyroNoise, 0.005) * Math.sqrt(bwG) * Math.sqrt(1 - k.aG * k.aG)
  k.vibSensed = s.vibA / Math.sqrt(1 + (s.fVib / bwA) ** 2)
  k.bias = num(p.gyroBias, 2.1) + num(p.biasTempco, 0.03) * (num(p.tempC, 25) - 25)
  k.mount = num(p.mountOffsetDeg, 0)
  k.alpha = num(p.alpha, 0.98)
  k.refDt = 1 / num(p.refHz, 100)
  k.h = h
  k.cfg = cfg
}

/**
 * One internal sample of h seconds (constants in s.k): true rate w (°/s) at the current s.theta, plus the
 * sensor's non-gravity specific force (g, sensor axes) linAx / linAz; updates the sensed values and the
 * reference filter.
 */
function sampleOnce(s: State, w: number, linAx: number, linAz: number, omegaM: number, found: boolean): void {
  const k = s.k
  const h = k.h
  const th = (s.theta + k.mount) * D2R
  // gyro Y, °/s
  s.gLp += k.kG * (w + k.bias - s.gLp)
  s.nG = k.aG * s.nG + k.sG * gauss(s)
  s.gyroY = s.gLp + s.nG
  s.nGx = k.aG * s.nGx + k.sG * gauss(s)
  s.nGz = k.aG * s.nGz + k.sG * gauss(s)
  // accelerometer, g
  s.axLp += k.kA * (-Math.sin(th) + linAx - s.axLp)
  s.azLp += k.kA * (Math.cos(th) + linAz - s.azLp)
  s.nX = k.aA * s.nX + k.sA * gauss(s)
  s.nY = k.aA * s.nY + k.sA * gauss(s)
  s.nZ = k.aA * s.nZ + k.sA * gauss(s)
  s.phase += omegaM * h + 0.2 * gauss(s) * (omegaM > 0 ? 1 : 0) // ERM speed jitter
  if (s.phase > 2 * Math.PI) s.phase %= 2 * Math.PI
  s.ax = s.axLp + s.nX + k.vibSensed * Math.sin(s.phase)
  s.ay = s.nY
  s.az = s.azLp + s.nZ + 0.5 * k.vibSensed * Math.cos(s.phase)

  // reference filter at refHz, on the quantised samples
  s.refAcc += h
  if (found && s.refAcc >= k.refDt - 1e-9) {
    const refDt = k.refDt
    s.refAcc -= refDt
    const gl = gyroLsb(s)
    const al = accelLsb(s)
    const rateRaw = Math.round(s.gyroY * gl) / gl
    const pa = Math.atan2(-Math.round(s.ax * al), Math.round(s.az * al)) * R2D
    s.pAccel = pa
    if (!s.started) {
      s.started = true
      s.pGyro = pa
      s.pGyroCal = pa
      s.pFilt = pa
    } else s.pGyro += rateRaw * refDt
    if (s.calLeft > 0) {
      s.calSum += rateRaw
      s.calN++
      s.calLeft -= refDt
      s.pGyroCal = pa
      s.pFilt = pa
      if (s.calLeft <= 1e-9) s.calBias = s.calSum / s.calN
    } else {
      const r = rateRaw - s.calBias
      s.pGyroCal += r * refDt
      s.pFilt = k.alpha * (s.pFilt + r * refDt) + (1 - k.alpha) * pa
    }
  }
}

/** per-step mode: the source is another behavior and `perStep` is set, so every solve samples and latches */
const perStepMode = (ctx: BehaviorContext) => num(ctx.params.perStep, 0) >= 0.5 && !['tweak', 'profile'].includes(str(ctx.params.pitchSource, 'tweak'))

/**
 * Per-step sampling (params.perStep 1, pitchSource another behavior's key): one internal sample per solve,
 * on that behavior's value as published in this very step (ctx.readNow, so it must be listed before this
 * one), latched into the registers at once, so a sketch running 1 ms behind the circuit reads data at most
 * a step old instead of a frame old.
 */
function onStep(ctx: BehaviorContext, t: number): void {
  if (!perStepMode(ctx)) return
  const s = state(ctx)
  if (!s.thetaInit) return // the first tick sets up the source
  const h = t - s.stepT
  s.stepT = t
  if (!(h > 1e-9) || h > 0.05) return
  const src = s.srcKey
  const now = ctx.readNow?.(src)
  if (now === undefined) return
  const r = ctx.readNow?.(s.rateKey)
  const w = r ?? (now - s.theta) / h
  s.theta = now
  if (s.k.h !== h || s.k.cfg !== dlpfOf(s)) chainConstants(ctx, s, h)
  const lax = ctx.readNow?.(s.axKey) ?? 0
  const laz = ctx.readNow?.(s.azKey) ?? 0
  sampleOnce(s, w, lax, laz, s.omegaM, s.found)
  s.srcPrev = now
  latch(s, num(ctx.params.tempC, 25))
}

function tick(ctx: BehaviorContext, dt: number): void {
  const s = state(ctx)
  const p = ctx.params
  // ── source of the true pitch ──
  const srcName = str(p.pitchSource, 'tweak')
  const mode = srcName === 'tweak' ? 0 : srcName === 'profile' ? 1 : 2
  let target = num(p.pitchDeg, 0)
  let rate = 0
  if (mode === 2) {
    if (s.srcKey !== srcName) {
      s.srcKey = srcName
      s.rateKey = `${srcName}_rate`
      s.axKey = `${srcName}_ax_g`
      s.azKey = `${srcName}_az_g`
      s.srcPrev = ctx.read?.(srcName) ?? s.theta
    }
    target = ctx.read?.(srcName) ?? s.srcPrev
    const r = ctx.read?.(s.rateKey)
    rate = r ?? (dt > 0 ? (target - s.srcPrev) / dt : 0)
  }
  if (!s.thetaInit) {
    s.theta = mode === 0 ? target : mode === 2 ? target : 0
    s.srcPrev = s.theta
    s.thetaInit = true
  }

  // ── bus and supply ──
  const busOk = ctx.powered && busHealthy(ctx)
  s.chipAddr = chipAddress(ctx)
  // the reference filter stands for the sketch: it sees the chip only at the library's address
  const found = busOk && s.chipAddr === num(p.addr, 0x68)
  if (s.found && !found) restartReference(ctx, s)
  s.busOk = busOk
  s.found = found

  const dl = num(p.dlpf, 0)
  if (dl !== s.dlpfParam) {
    s.dlpfParam = dl
    s.regs[REG.CONFIG] = (s.regs[REG.CONFIG] & ~7) | (Math.max(0, Math.min(6, Math.round(dl))) & 7)
  }

  // ── shaker ──
  const mid = str(p.motorId, 'vib')
  if (mid !== s.motorId) {
    s.motorId = mid
    s.motorKey = `${mid}.omega`
  }
  const sol = ctx.solution
  const omegaM = Math.abs(sol ? (sol.extraOf ? sol.extraOf(mid, s.motorKey) : (sol.extra[s.motorKey] ?? 0)) || 0 : 0)
  const vibA = num(p.vibGain, 2.9e-7) * omegaM * omegaM // peak, g
  s.vibRms = vibA < 1e-6 ? 0 : vibA / Math.SQRT2 // a stopped motor's last µrad/s is no vibration
  s.vibA = vibA
  s.fVib = omegaM / (2 * Math.PI)
  s.omegaM = omegaM
  const cfg = dlpfOf(s)
  const tempC = num(p.tempC, 25)

  if (mode === 2 && perStepMode(ctx)) {
    // onStep samples and latches; the tick refreshes the constants (a DLPF, bias or alpha change) and publishes
    chainConstants(ctx, s, s.k.h > 0 ? s.k.h : H)
  } else {
    // ── filter constants for the current DLPF setting ──
    let n = Math.max(1, Math.round(dt / H))
    if (n > MAX_SAMPLES) n = MAX_SAMPLES
    const h = dt > 0 ? dt / n : H
    chainConstants(ctx, s, h)
    const t0 = ctx.t - dt
    const lax = mode === 2 ? (ctx.read?.(s.axKey) ?? 0) : 0
    const laz = mode === 2 ? (ctx.read?.(s.azKey) ?? 0) : 0
    for (let k = 0; k < n; k++) {
      const ts = t0 + (k + 1) * h
      const w = advanceTruth(ctx, s, mode, ts, h, target, rate, k, n)
      sampleOnce(s, w, lax, laz, omegaM, found)
    }
    if (mode === 2) s.srcPrev = target
    latch(s, tempC)
  }
  const bias = s.k.bias

  ctx.publish('pitch_true', s.theta)
  ctx.publish('pitch_accel', found ? s.pAccel : 0)
  ctx.publish('pitch_gyro', found ? s.pGyro : 0)
  ctx.publish('pitch_gyro_cal', found ? s.pGyroCal : 0)
  ctx.publish('pitch_filtered', found ? s.pFilt : 0)
  ctx.publish('gyro_bias_now', bias)
  ctx.publish('vib_g', s.vibRms)
  ctx.publish('i2c_ok', found ? 1 : 0)
  ctx.publish('addr_now', s.chipAddr)
  ctx.publish('dlpf', cfg)
  ctx.publish('temp_c', tempC)
  ctx.publish('calibrating', found && s.calLeft > 0 ? 1 : 0)
}

export const behavior: Behavior = {
  id: 'imu-mpu6050',
  libraries: (ctx) => makeLibrary(ctx),
  onStep,
  init(ctx) {
    const s = state(ctx)
    ctx.mcu.attachI2c(0x68, device(ctx, s, 0x68))
    ctx.mcu.attachI2c(0x69, device(ctx, s, 0x69))
  },
  tick,
  onEvent(ctx, ev) {
    const s = state(ctx)
    if (ev === 'power-on' || ev === 'power-off') {
      resetRegs(s)
      restartReference(ctx, s)
    } else if (ev === 'upload') restartReference(ctx, s)
    if (ev === 'power-on' || ev === 'upload') {
      // see the bus now: a sketch whose setup() runs before the next tick (an await between the upload and
      // the first frame) must find the chip, not the unpowered bus of the last tick
      s.busOk = ctx.powered && busHealthy(ctx)
      s.chipAddr = chipAddress(ctx)
    }
    else if (ev === 'break' || ev === 'repair') {
      // the wiring changed: see the new bus at once (the restarted setup() may probe it before
      // the next tick)
      s.busOk = ctx.powered && busHealthy(ctx)
      s.chipAddr = chipAddress(ctx)
      // rewiring a live board is a re-plug when it cuts the chip off the bus, so setup() runs its
      // testConnection() check again (a gyro-only change keeps running); repair presses RESET
      if (ev === 'repair' || !s.busOk || s.chipAddr !== num(ctx.params.addr, 0x68)) ctx.mcu.reset()
    }
  },
  reset(ctx) {
    const s = state(ctx)
    resetRegs(s)
    restartReference(ctx, s)
    s.thetaInit = false
    s.srcKey = ''
  },
}
