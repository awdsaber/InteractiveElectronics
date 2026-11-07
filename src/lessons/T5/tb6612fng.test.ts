import { describe, expect, it } from 'vitest'
import { MODE } from '../../engine/behaviors/tb6612'
import { type Bench, type BenchSnapshot, createBench } from '../../engine/bench/simLoop'
import { validateLesson } from '../../engine/lessonSchema'
import type { Lesson } from '../../engine/types'
import { lesson as def } from './tb6612fng'

const lesson: Lesson = { ...def, fig: def.fig ?? 5 }
const FRAME = 1 / 60

// readout indices
const I_MOTOR = 0
const V_MOTOR = 1
const VM = 2
const RPM = 3
const TJ = 4
const LOSS = 5

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

/** a test sketch: STBY high, then `body` in setup (loop idles) */
const hold = (body: string) => `
void setup() {
  pinMode(4, OUTPUT); pinMode(5, OUTPUT); pinMode(7, OUTPUT); pinMode(8, OUTPUT);
  digitalWrite(4, HIGH);
  ${body}
}
void loop() { delay(10); }
`
const CW = (pwm: number) => hold(`digitalWrite(7, HIGH); digitalWrite(8, LOW); analogWrite(5, ${pwm});`)

describe('T5 tb6612fng lesson', () => {
  it('validates and reaches RUNNING with both supplies', async () => {
    expect(validateLesson(lesson)).toEqual([])
    const b = build()
    const s = await run(b, 0.5)
    expect(s.sketchError).toBeNull()
    expect(s.status).toBe('RUNNING')
    expect(s.assembly.powered).toEqual({ usb_plug: true, bat_sw: true })
    b.dispose()
  })

  it('the battery has its own power button, and the driver stays in standby until VM is up', async () => {
    const b = build({ battery: false, code: CW(255) })
    let s = await run(b, 0.5)
    expect(s.published['tb6612.mode']).toBe(MODE.STANDBY)
    b.dispatch('power:bat_sw')
    s = await run(b, 0.5)
    expect(s.assembly.powered.bat_sw).toBe(true)
    expect(s.published['tb6612.mode']).toBe(MODE.CW)
    b.dispose()
  })

  it('100 % CW, no load: ≈ 5.8 V on the motor, ≈ 190 rpm at the output, ≈ 0.15 A', async () => {
    const b = build({ code: CW(255) })
    const s = await run(b, 2.5)
    near(s.values[V_MOTOR], 5.8)
    near(s.values[RPM], 190)
    near(s.values[I_MOTOR], 0.15)
    near(s.values[VM], 6 - 0.15 * 0.6)
    expect(s.published['tb6612.mode']).toBe(MODE.CW)
    // the 3D wheel spins from the motor's own rpm (motor shaft, ≈ 9 200 rpm)
    near(s.extra['m1.rpm'], 9200)
    b.dispose()
  })

  it('analogWrite(PWMA, 128) on 6 V gives about 3.0 V average across the motor', async () => {
    const b = build({ code: CW(128) })
    const s = await run(b, 2)
    near(s.values[V_MOTOR], (128 / 255) * 6)
    near(s.published['tb6612.duty'], 128 / 255)
    b.dispose()
  })

  it('stall on the 6 V AA pack: 6 / (4 + 0.5 + 0.6) ≈ 1.18 A, bridge loss ≈ I² × 0.5', async () => {
    const b = build({ code: CW(255) })
    b.setTweak('m1.load', 0.05) // lock the wheel
    const s = await run(b, 1)
    near(s.values[I_MOTOR], 1.18)
    near(s.values[LOSS], 1.18 ** 2 * 0.5)
    expect(Math.abs(s.values[RPM])).toBeLessThan(2)
    b.dispose()
  })

  it('CCW reverses the motor; short brake stops it far faster than coasting', async () => {
    const b = build({ code: hold('digitalWrite(7, LOW); digitalWrite(8, HIGH); analogWrite(5, 255);') })
    const s = await run(b, 2)
    near(s.values[RPM], -190)
    expect(s.values[I_MOTOR]).toBeLessThan(0)

    const stopAfter = async (stop: string) => {
      const c = build({ code: `${CW(255).replace('void loop() { delay(10); }', '')}\nvoid loop() { delay(1500); ${stop} delay(100000); }` })
      await run(c, 1.45)
      const before = c.snapshot().values[RPM]
      await run(c, 0.35)
      const after = c.snapshot().values[RPM]
      c.dispose()
      return after / before
    }
    const brake = await stopAfter('digitalWrite(7, HIGH); digitalWrite(8, HIGH);')
    const coast = await stopAfter('digitalWrite(7, LOW); digitalWrite(8, LOW);')
    expect(brake).toBeLessThan(0.05)
    expect(coast).toBeGreaterThan(0.25)
    b.dispose()
  }, 60_000)

  it('STBY LOW is standby; with only USB connected, VM undervoltage holds it in standby too', async () => {
    const b = build({ code: hold('digitalWrite(4, LOW); digitalWrite(7, HIGH); analogWrite(5, 255);') })
    let s = await run(b, 1)
    expect(s.published['tb6612.mode']).toBe(MODE.STANDBY)
    expect(Math.abs(s.values[I_MOTOR])).toBeLessThan(1e-3)
    b.dispose()
    const u = build({ battery: false, code: CW(255) })
    s = await run(u, 1)
    expect(s.values[VM]).toBeLessThan(2.5)
    expect(s.published['tb6612.mode']).toBe(MODE.STANDBY)
    u.dispose()
  })

  it('the lesson sketch cycles CW, brake, CCW and coast', async () => {
    const b = build()
    const modes = new Set<number>()
    let maxRpm = 0
    let minRpm = 0
    const s = await run(b, 9, (x) => {
      modes.add(x.published['tb6612.mode'])
      maxRpm = Math.max(maxRpm, x.values[RPM])
      minRpm = Math.min(minRpm, x.values[RPM])
    })
    for (const m of [MODE.CW, MODE.BRAKE, MODE.CCW, MODE.COAST]) expect(modes.has(m)).toBe(true)
    near(maxRpm, 190)
    near(minRpm, -190)
    expect(s.serial.some((l) => l.startsWith('brake'))).toBe(true)
    expect(s.values[TJ]).toBeLessThan(60)
    expect(s.status).toBe('RUNNING')
    b.dispose()
  }, 60_000)

  it('F1 stall on 8.4 V: ≈ 1.8 A at full duty, thermal shutdown trips within seconds and the motor restarts', async () => {
    const b = build()
    b.dispatch('break:stall-2s')
    let peakI = 0
    let trips = 0
    let firstTrip = -1
    let wasOn = false
    let peakTj = 0
    await run(b, 25, (x) => {
      peakI = Math.max(peakI, Math.abs(x.values[I_MOTOR]))
      peakTj = Math.max(peakTj, x.values[TJ])
      const on = x.published['tb6612.tsd_active'] === 1
      if (on && !wasOn) {
        trips++
        if (firstTrip < 0) firstTrip = x.t
      }
      wasOn = on
    })
    near(peakI, 8.4 / (4 + 0.5 + 0.1))
    expect(firstTrip).toBeGreaterThan(0)
    expect(firstTrip).toBeLessThan(15)
    expect(trips).toBeGreaterThanOrEqual(2)
    expect(peakTj).toBeGreaterThanOrEqual(175)
    expect(b.snapshot().assembly.burns).toEqual([])
    b.dispose()
  }, 60_000) // 25 s of sim time

  it('F2 16.8 V on VM: the driver fails short at once', async () => {
    const b = build()
    await run(b, 0.5)
    b.dispatch('break:vm-4s')
    const s = await run(b, 0.3)
    expect(s.assembly.burns.map((x) => x.elementId)).toContain('i_vm')
    expect(s.assembly.burns.find((x) => x.elementId === 'i_vm')?.reason).toBe('overvoltage')
    expect(s.partBurnt.u1).toBe(true)
    expect(s.status).toBe('FAULT')
    b.dispose()
  })

  it('F3 no common ground: VM still reads 6 V but the inputs float and the motor twitches at random', async () => {
    const b = build()
    await run(b, 0.5)
    b.dispatch('break:no-common-gnd')
    const modes = new Set<number>()
    const s = await run(b, 3, (x) => modes.add(x.published['tb6612.mode']))
    expect(s.published['tb6612.gnd_ok']).toBe(0)
    near(s.values[VM], 6)
    expect(modes.size).toBeGreaterThanOrEqual(3)
    expect(s.partVisible.w_gnd).toBe(false)
    b.dispatch('repair')
    const r = await run(b, 0.5)
    expect(r.published['tb6612.gnd_ok']).toBe(1)
    b.dispose()
  }, 60_000)
})
