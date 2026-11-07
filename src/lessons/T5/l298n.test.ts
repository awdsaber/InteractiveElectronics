import { describe, expect, it } from 'vitest'
import { L298_MODE as M } from '../../engine/behaviors/l298n'
import { type Bench, type BenchSnapshot, createBench } from '../../engine/bench/simLoop'
import { validateLesson } from '../../engine/lessonSchema'
import type { Lesson } from '../../engine/types'
import { lesson as def } from './l298n'

const lesson: Lesson = { ...def, fig: def.fig ?? 6 }
const FRAME = 1 / 60

// readout indices
const VS = 0
const V_MOTOR = 1
const DROP = 2
const I_MOTOR = 3
const HEAT = 4
const TJ = 5
const RPM = 6
const EFF = 7

/** within ±15 % of the curriculum's number */
const near = (v: number, want: number) => expect(Math.abs(v - want)).toBeLessThanOrEqual(Math.abs(want) * 0.15)

function build(opts: { battery?: boolean; code?: string } = {}): Bench {
  const b = createBench(lesson)
  b.dispatch('pick-place')
  b.dispatch('place-all')
  b.dispatch('solder')
  b.dispatch('power')
  if (opts.battery !== false) b.dispatch('power:bat_sw')
  b.upload(opts.code)
  return b
}

async function run(b: Bench, seconds: number, each?: (s: BenchSnapshot) => void): Promise<BenchSnapshot> {
  const end = b.t + seconds
  while (b.t < end - 1e-9) {
    await b.frame(FRAME)
    if (each) each(b.snapshot())
  }
  return b.snapshot()
}

/** a test sketch: `body` in setup, loop idles */
const hold = (body: string) => `
void setup() {
  pinMode(5, OUTPUT); pinMode(7, OUTPUT); pinMode(8, OUTPUT);
  ${body}
}
void loop() { delay(10); }
`
const FWD = (pwm: number) => hold(`digitalWrite(7, HIGH); digitalWrite(8, LOW); analogWrite(5, ${pwm});`)

describe('T5 l298n lesson', () => {
  it('validates and reaches RUNNING with both supplies', async () => {
    expect(validateLesson(lesson)).toEqual([])
    const b = build()
    const s = await run(b, 0.5)
    expect(s.sketchError).toBeNull()
    expect(s.status).toBe('RUNNING')
    expect(s.assembly.powered).toEqual({ usb_plug: true, bat_sw: true })
    expect(s.serial.some((l) => l.startsWith('L298N'))).toBe(true)
    b.dispose()
  })

  it('100 % forward on 7.4 V, no load: ≈ 5.8 V on the motor (the 1.4 V offset still applies), ≈ 0.15 A', async () => {
    const b = build({ code: FWD(255) })
    const s = await run(b, 2.5)
    near(s.values[V_MOTOR], 7.4 - 0.15 * 0.15 - (1.4 + 0.15 * 1.15))
    near(s.values[DROP], 1.4 + 0.15 * 1.15)
    // GM-48 no-load
    near(s.values[I_MOTOR], 0.15)
    near(s.values[VS], 7.4)
    expect(s.published['l298n.mode']).toBe(M.CW)
    // GM-48 on ≈ 5.8 V: ≈ 9 200 rpm at the motor, ≈ 190 rpm at the 48:1 output
    near(s.values[RPM], 190)
    near(s.extra['m1.rpm'], 190 * 48)
    b.dispose()
  })

  it('a 1 A load on 7.4 V: motor ≈ 4.7 V, drop ≈ 2.55 V (typical), bridge heat ≈ 2.55 W + 7.4 V × 50 mA, efficiency ≈ 62 %', async () => {
    const b = build({ code: FWD(255) })
    b.setTweak('m1.load', 0.0053)
    const s = await run(b, 2)
    near(s.values[I_MOTOR], 1)
    near(s.values[V_MOTOR], 7.4 - 0.15 - 2.55)
    near(s.values[DROP], 2.55)
    near(s.values[HEAT], 2.55 + 7.4 * 0.05)
    near(s.values[EFF], 62)
    expect(s.values[VS] - s.values[V_MOTOR]).toBeCloseTo(s.values[DROP], 1)
    b.dispose()
  })

  it('EN-PWM coasts in the off phase: 20 % duty spins an unloaded motor well above 20 % of full speed (rise-time corrected)', async () => {
    const b = build({ code: FWD(51) })
    const s = await run(b, 3)
    const full = 190
    expect(s.values[RPM]).toBeGreaterThan(0.4 * full)
    expect(s.values[RPM]).toBeLessThan(full)
    near(s.published['l298n.duty'], 0.2)
    b.dispose()
  })

  it('EN low coasts, IN1 = IN2 brakes: brake stops the wheel far faster', async () => {
    const stopAfter = async (stop: string) => {
      const c = build({ code: `${FWD(255).replace('void loop() { delay(10); }', '')}\nvoid loop() { delay(1500); ${stop} delay(100000); }` })
      await run(c, 1.45)
      const before = c.snapshot().values[RPM]
      await run(c, 0.35)
      const s = c.snapshot()
      c.dispose()
      return { ratio: s.values[RPM] / before, mode: s.published['l298n.mode'] }
    }
    const brake = await stopAfter('digitalWrite(7, LOW);')
    const coast = await stopAfter('analogWrite(5, 0);')
    expect(brake.mode).toBe(M.BRAKE)
    expect(coast.mode).toBe(M.COAST)
    expect(brake.ratio).toBeLessThan(0.1)
    expect(coast.ratio).toBeGreaterThan(0.25)
  }, 60_000)

  it('the lesson sketch steps the duty forward and back, brakes and coasts, and stays cool unloaded', async () => {
    const b = build()
    const modes = new Set<number>()
    let maxRpm = 0
    let minRpm = 0
    const s = await run(b, 32, (x) => {
      modes.add(x.published['l298n.mode'])
      maxRpm = Math.max(maxRpm, x.values[RPM])
      minRpm = Math.min(minRpm, x.values[RPM])
    })
    for (const m of [M.CW, M.BRAKE, M.CCW, M.COAST]) expect(modes.has(m)).toBe(true)
    near(maxRpm, 190)
    near(minRpm, -190)
    expect(s.published['serial.duty_pct']).toBeDefined()
    expect(s.values[TJ]).toBeLessThan(60)
    expect(s.assembly.burns).toEqual([])
    expect(s.status).toBe('RUNNING')
    b.dispose()
  }, 120_000)

  it('F1 no flyback diodes: the first PWM off edge kills the outputs (short), then a drive command shorts Vs', async () => {
    const b = build()
    await run(b, 0.5)
    b.dispatch('break:no-flyback')
    let s = await run(b, 2.3) // the 20 % step starts at t = 3 s
    expect(s.assembly.burns).toEqual([]) // full-EN brake at 0 % has no PWM edges
    s = await run(b, 0.6)
    const burnt = s.assembly.burns.map((x) => x.elementId)
    expect(burnt).toContain('en_a')
    expect(s.assembly.burns.find((x) => x.elementId === 'en_a')?.reason).toBe('overvoltage')
    expect(s.partBurnt.u1).toBe(true)
    expect(s.status).toBe('FAULT')
    expect(s.partVisible.d1).toBe(false)
    s = await run(b, 0.3)
    expect(s.published['l298n.dead']).toBe(1)
    expect(s.published['l298n.mode']).toBe(M.DEAD)
    // shoot-through: (Vs − 1.4 V) / 1.15 Ω ≈ 5 A, some 30–40 W into the package, the battery sags
    expect(s.values[HEAT]).toBeGreaterThan(20)
    expect(s.values[VS]).toBeLessThan(7.0)
    expect(Math.abs(s.values[RPM])).toBeLessThan(5)
    // …until the overtemperature shutdown opens everything
    let tripped = false
    await run(b, 3, (x) => {
      if (x.published['l298n.tsd_active'] === 1) tripped = true
    })
    expect(tripped).toBe(true)
    b.dispose()
  }, 60_000)

  it('F1 with full EN: the coast at EN low (engine transient, no PWM edges) also breaks the outputs down', async () => {
    const b = build({ code: `${FWD(255).replace('void loop() { delay(10); }', '')}\nvoid loop() { delay(1500); analogWrite(5, 0); delay(100000); }` })
    await run(b, 0.3)
    b.dispatch('break:no-flyback')
    const s = await run(b, 1.5)
    const burnt = s.assembly.burns.map((x) => x.elementId)
    expect(burnt.some((id) => id === 'en_a' || id === 'en_b')).toBe(true)
    expect(s.assembly.burns.every((x) => x.reason === 'overvoltage')).toBe(true)
    b.dispose()
  }, 60_000)

  it('F2 two motors at ≈ 1.5 A on 12 V without the heatsink: ≈ 9.4 W, thermal shutdown within seconds, motors pulse', async () => {
    const b = build({ code: FWD(255) })
    await run(b, 0.3)
    b.dispatch('break:two-motors-bare')
    const t0 = b.t
    // the loaded steady state, before the junction gets to 150 °C
    const st = await run(b, 1.5)
    near(st.values[I_MOTOR], 1.5)
    near(st.published['l298n.motor_b_A'], 1.5)
    near(st.values[HEAT], 9.4)
    let peakTj = 0
    let trips = 0
    let firstTrip = -1
    let was = false
    const s = await run(b, 13.5, (x) => {
      peakTj = Math.max(peakTj, x.values[TJ])
      const on = x.published['l298n.tsd_active'] === 1
      if (on && !was) {
        trips++
        if (firstTrip < 0) firstTrip = x.t - t0
      }
      was = on
    })
    expect(s.published['l298n.heatsink']).toBe(0)
    expect(s.partVisible.mot2).toBe(true)
    expect(s.partVisible.hs).toBe(false)
    expect(firstTrip).toBeGreaterThan(0)
    expect(firstTrip).toBeLessThan(6)
    expect(trips).toBeGreaterThanOrEqual(2)
    expect(peakTj).toBeGreaterThanOrEqual(150)
    expect(s.assembly.burns).toEqual([])
    b.dispose()
  }, 60_000)

  it('F2 with the lesson sketch: the shutdown also trips during the high-duty steps', async () => {
    const b = build()
    b.dispatch('break:two-motors-bare')
    let trips = 0
    let was = false
    await run(b, 20, (x) => {
      const on = x.published['l298n.tsd_active'] === 1
      if (on && !was) trips++
      was = on
    })
    expect(trips).toBeGreaterThanOrEqual(1)
    b.dispose()
  }, 60_000)

  it('F3 single Li-ion cell (3.7 V) with a 0.3 A load: ≈ 1.9 V on the motor, ≈ 26 rpm, the bridge takes about half', async () => {
    const b = build({ code: FWD(255) })
    await run(b, 0.3)
    b.dispatch('break:one-cell')
    const s = await run(b, 3)
    near(s.values[I_MOTOR], 0.3)
    near(s.values[V_MOTOR], 3.7 - 0.3 * 0.15 - (1.4 + 0.3 * 1.15))
    expect(s.values[RPM]).toBeGreaterThan(15)
    expect(s.values[RPM]).toBeLessThan(40)
    expect(100 - s.values[EFF]).toBeGreaterThan(40)
    b.dispose()
  }, 60_000)

  it('the heatsink tweak changes the steady temperature: Rθsa 30 runs hotter than 2', async () => {
    const tjWith = async (rth: number) => {
      const b = build({ code: FWD(255) })
      b.setTweak('m1.load', 0.0053)
      b.setTweak('behavior:l298n.rthSA', rth)
      const s = await run(b, 12)
      b.dispose()
      return s.values[TJ]
    }
    const hot = await tjWith(30)
    const cool = await tjWith(2)
    // ≈ 2.92 W (2.55 + 7.4 × 0.05): 25 + 2.92 × 34 ≈ 124 °C versus 25 + 2.92 × 6 ≈ 43 °C
    near(hot, 25 + 2.92 * 34)
    near(cool, 25 + 2.92 * 6)
  }, 60_000)
})
