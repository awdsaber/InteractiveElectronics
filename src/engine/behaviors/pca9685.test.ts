import { describe, expect, it } from 'vitest'
import type { I2cDevice } from '../mcu/virtualMcu'
import type { BehaviorContext, Element, Netlist, Solution } from '../types'
import { REG, behavior, freqActual, prescaleFor, usToDeg } from './pca9685'

// A hand-driven context: tests set node voltages directly, drive the chip through the library
// class or raw register writes on the attached I²C devices, and read back setParam / publish.

function netlist(withGndLink = true, extra: Element[] = []): Netlist {
  const els: Element[] = [
    { id: 'r_sda', type: 'R', nodes: ['5v', 'sda'], value: 10e3 },
    { id: 'r_scl', type: 'R', nodes: ['5v', 'scl'], value: 10e3 },
    { id: 'psu', type: 'V', nodes: ['psu_p', 'psu_n'], value: 5, rInternal: 0.05 },
    { id: 'psu_sw', type: 'SW', nodes: ['psu_p', 'vplus'], closed: true },
    { id: 's0', type: 'R', nodes: ['vplus', 'psu_n'], value: 500 },
    { id: 's1', type: 'R', nodes: ['vplus', 'psu_n'], value: 500 },
    ...extra,
  ]
  if (withGndLink) els.push({ id: 'gnd_link', type: 'R', nodes: ['psu_n', '0'], value: 0.01 })
  return { elements: els }
}

interface Fake {
  ctx: BehaviorContext
  nodeV: Record<string, number>
  current: Record<string, number>
  set: Record<string, number | boolean>
  pub: Record<string, number>
  bus: Map<number, I2cDevice>
  calls: string[]
  tick(dt?: number): void
  run(seconds: number, dt?: number): void
  /** a raw Wire transaction: [register, ...data] to `addr`; returns 0 (ACK) or 2 (NACK) */
  wire(addr: number, bytes: number[]): number
  pwm(addr?: number): Driver
}

interface Driver {
  begin(): boolean
  setOscillatorFrequency(hz: number): void
  setPWMFreq(f: number): void
  setPWM(ch: number, on: number, off: number): number
  writeMicroseconds(ch: number, us: number): void
  readPrescale(): number
  getPWM(ch: number, off?: boolean): number
  sleep(): void
  wakeup(): void
}

function fake(params: Record<string, number | string | boolean> = {}, net: Netlist = netlist()): Fake {
  const nodeV: Record<string, number> = { '5v': 5, sda: 5, scl: 5, vplus: 5, psu_n: 0, psu_p: 5 }
  const current: Record<string, number> = {}
  const set: Record<string, number | boolean> = {}
  const pub: Record<string, number> = {}
  const bus = new Map<number, I2cDevice>()
  const calls: string[] = []
  const solution: Solution = { ok: true, nodeV, current, power: {}, extra: {} }
  const base = { vdd: '5v', sda: 'sda', scl: 'scl', vplus: 'vplus', servoGnd: 'psu_n', servos: 's0,s1', startDeg: 0, seed: 3 }
  let running = true
  const ctx: BehaviorContext = {
    t: 0,
    solution,
    pins: {},
    powered: true,
    params: { ...base, ...params },
    netlist: net,
    v: (n, ref) => (nodeV[n] ?? 0) - (ref ? (nodeV[ref] ?? 0) : 0),
    publish: (k, v) => {
      pub[k] = v
    },
    setParam: (id, key, value) => {
      set[`${id}.${key}`] = value
    },
    setMotorLoad: () => {},
    burn: () => {},
    events: { push: () => {} },
    mcu: {
      hold() {
        calls.push('hold')
        running = false
      },
      release() {
        calls.push('release')
        running = true
      },
      reset() {
        calls.push('reset')
      },
      injectEdge() {},
      serialIn() {},
      serialOut() {},
      attachI2c(a, d) {
        bus.set(a, d as I2cDevice)
      },
      attachSpi() {},
      timeMicros: 0,
      get running() {
        return running
      },
    },
  }
  behavior.init!(ctx)
  const lib = behavior.libraries!(ctx) as { Adafruit_PWMServoDriver: new (addr?: number) => Driver }
  const f: Fake = {
    ctx,
    nodeV,
    current,
    set,
    pub,
    bus,
    calls,
    tick(dt = 1 / 60) {
      ctx.t += dt
      behavior.tick!(ctx, dt)
    },
    run(seconds, dt = 1 / 60) {
      for (let k = 0; k < Math.round(seconds / dt); k++) f.tick(dt)
    },
    wire(addr, bytes) {
      const d = bus.get(addr)
      if (!d || d.ack?.() === false) return 2
      d.write?.(bytes)
      return 0
    },
    pwm: (addr = 0x40) => new lib.Adafruit_PWMServoDriver(addr),
  }
  return f
}

/** the curriculum's setup(): 25 MHz nominal, 50 Hz */
function setup50(f: Fake, addr = 0x40): Driver {
  const p = f.pwm(addr)
  p.begin()
  p.setOscillatorFrequency(25_000_000)
  p.setPWMFreq(50)
  return p
}

describe('pca9685 math', () => {
  it('prescale = round(osc / (4096 f)) - 1, clamped to 3..255', () => {
    expect(prescaleFor(25e6, 50)).toBe(121)
    expect(prescaleFor(25e6, 1000)).toBe(5)
    expect(prescaleFor(25e6, 1)).toBe(255)
    expect(prescaleFor(25e6, 3500)).toBe(3)
  })

  it('actual frame rate from the real oscillator: 50.03 Hz at 25 MHz, 6 % fast at 26.5 MHz', () => {
    expect(freqActual(25e6, 121)).toBeCloseTo(50.03, 2)
    expect(freqActual(26.5e6, 121) / freqActual(25e6, 121)).toBeCloseTo(1.06, 3)
  })

  it('pulse width to angle: 500..2500 µs is 0..180°, clamped', () => {
    expect(usToDeg(500)).toBe(0)
    expect(usToDeg(1500)).toBe(90)
    expect(usToDeg(2500)).toBe(180)
    expect(usToDeg(3000)).toBe(180)
    expect(usToDeg(100)).toBe(0)
  })
})

describe('pca9685 registers over I²C', () => {
  it('attaches to every address the A0..A5 jumpers can select (0x40..0x7F)', () => {
    const f = fake()
    expect(f.bus.has(0x40)).toBe(true)
    expect(f.bus.has(0x7f)).toBe(true)
    expect(f.bus.size).toBe(64)
  })

  it('library: begin + setPWMFreq(50) programs PRESCALE 121; setPWM(0, 0, 307) is a 1.5 ms pulse', () => {
    const f = fake()
    const p = setup50(f)
    expect(p.readPrescale()).toBe(121)
    expect(p.setPWM(0, 0, 307)).toBe(0)
    expect(p.getPWM(0, true)).toBe(307)
    f.tick()
    expect(f.pub.prescale).toBe(121)
    expect(f.pub.freq_actual).toBeCloseTo(50.03, 2)
    expect(f.pub.ch0_us).toBeCloseTo(1498.4, 0)
    expect(f.pub.ch0_s).toBeCloseTo(f.pub.ch0_us * 1e-6, 12)
  })

  it('raw registers: PRESCALE only takes while SLEEP is set; LEDn_ON/OFF auto-increment needs MODE1.AI', () => {
    const f = fake()
    expect(f.wire(0x40, [REG.PRESCALE, 121])).toBe(0) // power-on MODE1 = 0x11: asleep, so it takes
    expect(f.wire(0x40, [REG.MODE1, 0x00])).toBe(0) // wake, no auto-increment
    expect(f.wire(0x40, [REG.PRESCALE, 30])).toBe(0) // ignored: awake
    f.tick()
    expect(f.pub.prescale).toBe(121)
    // without AI every data byte lands in LED0_ON_L
    f.wire(0x40, [REG.LED0, 0x00, 0x00, 0x33, 0x01])
    f.tick()
    expect(f.pub.ch0_us).toBe(0) // OFF_H still has its power-on full-off bit
    f.wire(0x40, [REG.MODE1, 0x20]) // AI
    f.wire(0x40, [REG.LED0, 0x00, 0x00, 0x33, 0x01]) // on 0, off 0x133 = 307
    f.tick()
    expect(f.pub.ch0_us).toBeCloseTo(1498.4, 0)
  })

  it('ALL_LED registers write every channel; full-off and full-on bits give no servo pulse', () => {
    const f = fake()
    setup50(f)
    f.wire(0x40, [REG.ALL_LED, 0, 0, 0x33, 0x01])
    f.tick()
    expect(f.pub.ch1_us).toBeCloseTo(1498.4, 0)
    const p = f.pwm()
    p.setPWM(1, 4096, 0) // full on: a constant HIGH, no pulse
    p.setPWM(0, 0, 4096) // full off
    f.tick()
    expect(f.pub.ch0_us).toBe(0)
    expect(f.pub.ch1_us).toBe(0)
  })

  it('sleep() stops every output; wakeup() restores them', () => {
    const f = fake()
    const p = setup50(f)
    p.setPWM(0, 0, 307)
    p.sleep()
    f.tick()
    expect(f.pub.ch0_us).toBe(0)
    p.wakeup()
    f.tick()
    expect(f.pub.ch0_us).toBeCloseTo(1498.4, 0)
  })

  it('writeMicroseconds converts with the sketch oscillator value, like the Adafruit library', () => {
    const f = fake()
    const p = setup50(f)
    p.writeMicroseconds(0, 1500)
    expect(p.getPWM(0, true)).toBe(307)
  })

  it('the real oscillator at 26.5 MHz makes every pulse about 6 % short', () => {
    const f = fake({ oscActual: 26.5e6 })
    const p = setup50(f)
    p.setPWM(0, 0, 307)
    f.tick()
    expect(f.pub.freq_actual).toBeCloseTo(53.03, 1)
    expect(f.pub.ch0_us).toBeCloseTo(1413.6, 0)
  })

  it('a wrong address NACKs: the call does nothing and i2c_errors counts it', () => {
    const f = fake()
    const p = setup50(f, 0x41)
    expect(p.setPWM(0, 0, 307)).toBe(2)
    f.tick()
    expect(f.pub.ch0_us).toBe(0)
    expect(f.pub.i2c_errors).toBeGreaterThanOrEqual(2)
    expect(f.pub.addr).toBe(0x40)
  })

  it('the A0 jumper node HIGH moves the chip to 0x41', () => {
    const f = fake({ addrNodes: 'a0' })
    f.nodeV.a0 = 5
    expect(f.wire(0x40, [REG.MODE1])).toBe(2)
    expect(f.wire(0x41, [REG.MODE1])).toBe(0)
    f.tick()
    expect(f.pub.addr).toBe(0x41)
  })

  it('answers the All-Call address 0x70 only while MODE1.ALLCALL is set (power-on yes, after begin no)', () => {
    const f = fake()
    expect(f.wire(0x70, [REG.MODE1])).toBe(0)
    f.pwm().begin() // reset() writes MODE1 = RESTART, which clears ALLCALL
    expect(f.wire(0x70, [REG.MODE1])).toBe(2)
  })

  it('no pull-ups (SDA/SCL near 0 V) or no VDD: every transaction fails', () => {
    const f = fake()
    f.nodeV.sda = 0.02
    f.nodeV.scl = 0.02
    const p = f.pwm()
    expect(p.begin()).toBe(false)
    expect(p.setPWM(0, 0, 307)).toBe(2)
    f.tick()
    expect(f.pub.i2c_errors).toBe(2) // begin's probe, then setPWM
    f.nodeV.sda = 5
    f.nodeV.scl = 5
    f.nodeV['5v'] = 2.0
    expect(f.wire(0x40, [REG.MODE1])).toBe(2)
  })

  it('VDD below 2.3 V is a power-on reset: the registers return to their defaults', () => {
    const f = fake()
    const p = setup50(f)
    p.setPWM(0, 0, 307)
    f.tick()
    expect(f.pub.ch0_us).toBeGreaterThan(0)
    f.nodeV['5v'] = 1.0
    f.tick()
    f.nodeV['5v'] = 5
    f.tick()
    expect(f.pub.ch0_us).toBe(0)
    expect(f.pub.prescale).toBe(30) // power-on PRESCALE 0x1E: 200 Hz
    expect(f.pub.sleep).toBe(1)
  })
})

describe('pca9685 servo model', () => {
  it('slews at about 600 °/s at 4.8 V and settles on the commanded angle', () => {
    const f = fake({ vNom: 5 })
    const p = setup50(f)
    p.writeMicroseconds(0, 1500) // 90°
    f.run(0.1)
    const after100 = f.pub.ch0_deg
    // 0.1 s per 60° → about 60° in 0.1 s (a little less: the motor has to spin up)
    expect(after100).toBeGreaterThan(45)
    expect(after100).toBeLessThan(65)
    f.run(0.3)
    expect(f.pub.ch0_deg).toBeCloseTo(usToDeg(1498.4), 0)
  })

  it('draws a ~0.65 A surge at the start of a move, ~0.25 A at full speed, ~10 mA idle', () => {
    const f = fake({ load: 0 })
    const p = setup50(f)
    f.tick()
    expect(f.pub.ch0_A).toBeCloseTo(0.01, 3) // no pulse yet: limp, electronics only
    p.writeMicroseconds(0, 2500)
    f.tick(1 / 600)
    expect(f.pub.ch0_A).toBeGreaterThan(0.5)
    expect(f.pub.ch0_A).toBeLessThan(0.7)
    f.run(0.12, 1 / 600)
    expect(f.pub.ch0_A).toBeGreaterThan(0.2)
    expect(f.pub.ch0_A).toBeLessThan(0.3)
    f.run(0.5)
    expect(f.pub.ch0_A).toBeCloseTo(0.01, 2)
  })

  it('holding a load on the horn costs load × stall current; a blocked servo draws stall current', () => {
    const f = fake({ load: 0.3, blocked: 2 })
    const p = setup50(f)
    p.writeMicroseconds(0, 1500)
    p.writeMicroseconds(1, 1500)
    f.run(0.6)
    expect(f.pub.ch0_A).toBeCloseTo(0.01 + 0.3 * 0.65, 2)
    expect(f.pub.ch1_deg).toBe(0) // blocked at its start angle
    expect(f.pub.ch1_A).toBeGreaterThan(0.6)
  })

  it('a slowly moving command draws about the same current at 60 fps and at 10 fps', () => {
    const avg = (dt: number) => {
      const f = fake({ load: 0.3, startDeg: 45 })
      const p = setup50(f)
      let sum = 0
      let n = 0
      for (let t = 0; t < 2; t += dt) {
        p.writeMicroseconds(0, 500 + ((45 + 45 * t) / 180) * 2000) // 45° → 135° at 45 °/s
        f.tick(dt)
        if (t > 0.3) {
          sum += f.pub.ch0_A
          n++
        }
      }
      return sum / n
    }
    const fast = avg(1 / 60)
    const slow = avg(0.1)
    expect(fast).toBeGreaterThan(0.2)
    expect(Math.abs(slow - fast) / fast).toBeLessThan(0.15)
  })

  it('sets each servo element to V+ / I so the circuit carries the current', () => {
    const f = fake({ load: 0.3 })
    const p = setup50(f)
    p.writeMicroseconds(0, 1500)
    f.run(0.6)
    const r = f.set['s0.value'] as number
    expect(5 / r).toBeCloseTo(0.205, 2)
  })

  it('publishes the circuit servo current total and V+', () => {
    const f = fake()
    f.current.s0 = 0.3
    f.current.s1 = 0.2
    f.nodeV.vplus = 4.9
    f.tick()
    expect(f.pub.servo_A_total).toBeCloseTo(0.5, 6)
    expect(f.pub.vplus_V).toBeCloseTo(4.9, 6)
  })

  it('no common ground: the commanded angle is ignored and the servo twitches at random', () => {
    const f = fake({}, netlist(false))
    const p = setup50(f)
    p.writeMicroseconds(0, 1500)
    const seen = new Set<number>()
    for (let k = 0; k < 120; k++) {
      f.tick()
      seen.add(Math.round(f.pub.ch0_deg / 10))
    }
    expect(f.pub.gnd_ok).toBe(0)
    expect(seen.size).toBeGreaterThan(4)
  })

  it('V+ under 3.5 V twitches too; under 2 V the servo is dead', () => {
    const f = fake()
    const p = setup50(f)
    p.writeMicroseconds(0, 1500)
    f.nodeV.vplus = 3.2
    const seen = new Set<number>()
    for (let k = 0; k < 120; k++) {
      f.tick()
      seen.add(Math.round(f.pub.ch0_deg / 10))
    }
    expect(seen.size).toBeGreaterThan(4)
    f.nodeV.vplus = 1.5
    const at = f.pub.ch0_deg
    f.run(0.5)
    expect(f.pub.ch0_deg).toBe(at)
    expect(f.pub.ch0_A).toBe(0)
  })

  it('reset forgets the registers and the servo positions', () => {
    const f = fake()
    const p = setup50(f)
    p.writeMicroseconds(0, 1500)
    f.run(0.5)
    behavior.reset!(f.ctx)
    f.tick()
    expect(f.pub.ch0_us).toBe(0)
    expect(f.pub.ch0_deg).toBe(0)
    expect(f.pub.i2c_errors).toBe(0)
  })
})
