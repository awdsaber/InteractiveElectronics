import { describe, expect, it } from 'vitest'
import { type Bench, type BenchSnapshot, createBench } from '../../engine/bench/simLoop'
import { validateLesson } from '../../engine/lessonSchema'
import { getLesson } from '../index'

const lesson = getLesson('adc-dac-pwm')!
const FRAME = 1 / 60

// readout indices (see the lesson)
const [A0, KNOB, SENSOR_V, SENSOR, DUTY, PIN9, FILT, RIPPLE, RIPPLE_PRED, CUTOFF, PWM_HZ, LOAD_I] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]

function build(opts: { failure?: string; tweaks?: Record<string, number> } = {}): Bench {
  const b = createBench(lesson, { tweaks: opts.tweaks })
  b.dispatch('place-all')
  b.dispatch('power')
  b.upload()
  if (opts.failure) b.dispatch(`break:${opts.failure}`)
  return b
}

async function run(b: Bench, seconds: number): Promise<BenchSnapshot> {
  const t1 = b.t + seconds
  while (b.t < t1 - 1e-9) await b.frame(FRAME)
  return b.snapshot()
}
const within = (got: number, want: number, tol: number) => Math.abs(got - want) <= tol * Math.abs(want)
/** the ATmega328P's transfer function: code = floor(Vin × 1024 / Vref), clipped to 0..1023 */
const ideal = (v: number, vref: number) => Math.min(1023, Math.max(0, (v * 1024) / vref))

describe('T3 adc-dac-pwm lesson', () => {
  it('validates; the Uno is wired to pin 9 (PWM), A0 and A1, with datasheet facts on the MCU', () => {
    expect(validateLesson(lesson)).toEqual([])
    expect(lesson.powerElementId).toBe('V_USB')
    expect(lesson.sketch?.board).toBe('uno')
    expect(lesson.sketch?.pins[9]).toBe('PIN9')
    expect(lesson.sketch?.analogPins).toEqual({ A0: 'wiper', A1: 'sig' })
    const facts = lesson.board.parts.find((p) => p.id === 'uno')!.facts!.join(' ')
    expect(facts).toMatch(/10-bit/)
    expect(facts).toMatch(/±2 LSB/)
    expect(facts).toMatch(/1\.1 V/)
    expect(facts).toMatch(/490 Hz/)
    expect(facts).toMatch(/980 Hz/)
    expect(lesson.instruments?.open).toBe(true)
    expect(lesson.instruments?.scope?.channels.length).toBe(2)
  })

  it('at the defaults: A0 = 2.50 V reads 512 (±1 LSB), duty 128, FILTERED = 128/255 × 5 V = 2.51 V, tau 0.1 s, fc 1.6 Hz, 490 Hz', async () => {
    const s = await run(build(), 1.5)
    expect(s.values[A0]).toBeCloseTo(2.5, 2)
    expect(Math.abs(s.values[KNOB] - ideal(2.5, 5))).toBeLessThanOrEqual(1)
    // the datasheet's floor(2.5 × 1024/5) is 512 and duty 128; the sim's round(V/Vref × 1023) gives 511 and
    // duty 127 at exactly mid travel (inside the chip's ±2 LSB): either way FILTERED = duty/255 × 5 V
    expect([127, 128]).toContain(s.values[DUTY])
    expect(s.values[FILT]).toBeCloseTo((s.values[DUTY] / 255) * 5, 2)
    expect(s.values[PIN9]).toBeCloseTo((s.values[DUTY] / 255) * 5, 1)
    expect(s.values[CUTOFF]).toBeCloseTo(1 / (2 * Math.PI * 0.1), 3)
    expect(s.values[PWM_HZ]).toBe(490)
  })

  it('across the knob, the ADC code is within 1 LSB of V × 1024 / 5 and the filtered DC equals duty × Vcc', async () => {
    for (const turn of [0, 7, 25, 50, 77, 100]) {
      const s = await run(build({ tweaks: { 'behavior:knob.turn': turn } }), 1.2)
      const v = s.values[A0]
      expect(v, `turn ${turn}`).toBeCloseTo((turn / 100) * 5, 2)
      expect(Math.abs(s.values[KNOB] - ideal(v, 5)), `turn ${turn}: code ${s.values[KNOB]} for ${v} V`).toBeLessThanOrEqual(1)
      const duty = s.values[DUTY]
      expect(duty).toBe(Math.floor(s.values[KNOB] / 4))
      // the 0 % and 100 % duty are plain DC; in between the average is duty/255 × 5 V
      expect(s.values[FILT], `turn ${turn}`).toBeCloseTo((duty / 255) * 5, 2)
    }
  })

  it('A1 (a small signal) at 5 V full scale: 0.300 V reads 61 counts, LSB 4.88 mV; the 1.1 V reference reads 279, LSB 1.07 mV', async () => {
    let s = await run(build(), 1)
    expect(s.values[SENSOR_V]).toBeCloseTo(0.3, 3)
    expect(Math.abs(s.values[SENSOR] - ideal(0.3, 5))).toBeLessThanOrEqual(1)
    s = await run(build({ tweaks: { 'SW_REF.closed': 1 } }), 1)
    expect(Math.abs(s.values[SENSOR] - ideal(0.3, 1.1))).toBeLessThanOrEqual(1)
    // the knob still reads against 5 V: the sketch only switches the reference for the sensor
    expect(Math.abs(s.values[KNOB] - 512)).toBeLessThanOrEqual(1)
    // 4 steps of the signal move the code by 4 LSB of 1.07 mV
    const a = await run(build({ tweaks: { 'SW_REF.closed': 1, 'V_SIG.value': 0.5 } }), 1)
    const c = await run(build({ tweaks: { 'SW_REF.closed': 1, 'V_SIG.value': 0.5 + 4 * (1.1 / 1024) } }), 1)
    expect(c.values[SENSOR] - a.values[SENSOR]).toBeGreaterThanOrEqual(3)
    expect(c.values[SENSOR] - a.values[SENSOR]).toBeLessThanOrEqual(5)
    // above 1.1 V the code pins at 1023
    const hi = await run(build({ tweaks: { 'SW_REF.closed': 1, 'V_SIG.value': 1.4 } }), 1)
    expect(hi.values[SENSOR]).toBe(1023)
  })

  it('the ripple follows the RC cutoff: 25 mV p-p at 10 kΩ / 10 µF, about 10x more at 1 µF, 10x less at 100 µF', async () => {
    const cases: [number, number][] = [[10e-6, 0.0255], [1e-6, 0.25], [100e-6, 0.00255]]
    const vpp: number[] = []
    for (const [c, want] of cases) {
      const b = build({ tweaks: { 'C_F.value': c } })
      const s = await run(b, 1.5 + 8 * 1e4 * c) // let the filter reach its steady state
      expect(s.values[CUTOFF]).toBeCloseTo(1 / (2 * Math.PI * 1e4 * c), 2)
      // the measured peak-to-peak ripple, the sim's own filter, against the closed form
      expect(within(s.values[RIPPLE_PRED], want, 0.1), `predicted ${s.values[RIPPLE_PRED]} for ${c}`).toBe(true)
      expect(within(s.values[RIPPLE], s.values[RIPPLE_PRED], 0.2), `measured ${s.values[RIPPLE]} vs predicted ${s.values[RIPPLE_PRED]} at ${c}`).toBe(true)
      vpp.push(s.values[RIPPLE])
    }
    expect(vpp[1] / vpp[0]).toBeGreaterThan(8)
    expect(vpp[1] / vpp[0]).toBeLessThan(12)
    expect(vpp[0] / vpp[2]).toBeGreaterThan(8)
    expect(vpp[0] / vpp[2]).toBeLessThan(12)
  })

  it('the raw pin is a 490 Hz, 5 V square wave: PIN 9 averages 2.51 V but the scope sees full-height pulses', async () => {
    const b = build()
    await run(b, 1)
    const ch = lesson.instruments!.scope!.channels
    expect(ch[0].source).toEqual({ kind: 'voltage', node: 'p9' })
    expect(ch[1].source).toEqual({ kind: 'voltage', node: 'f' })
    const s = b.snapshot()
    expect(s.values[PIN9]).toBeCloseTo((128 / 255) * 5, 1)
    const peaks = s.published
    expect(peaks['meter.vppB']).toBeGreaterThan(4.9)
    expect(peaks['meter.vppB']).toBeLessThan(5.1)
  })

  it('failure heavy-load: a 1 kΩ load pulls FILTERED from 2.51 V down to about 0.23 V', async () => {
    const b = build({ failure: 'heavy-load' })
    const s = await run(b, 2)
    expect(within(s.values[FILT], 2.51 * 1000 / 11025, 0.1), `filtered ${s.values[FILT]}`).toBe(true)
    expect(s.values[FILT]).toBeLessThan(0.3)
    expect(s.values[LOAD_I]).toBeGreaterThan(0.0002)
  })

  it('failure big-cap: with 1000 µF (tau 10 s) the output has barely moved 2 s after the knob does', async () => {
    const fast = build()
    await run(fast, 2)
    fast.setTweak('behavior:knob.turn', 100)
    const f = await run(fast, 2)
    expect(f.values[FILT]).toBeGreaterThan(4.9)
    const b = build({ failure: 'big-cap' })
    b.setTweak('behavior:knob.turn', 10)
    await run(b, 1)
    b.setTweak('behavior:knob.turn', 100)
    const s = await run(b, 2)
    expect(s.values[A0]).toBeCloseTo(5, 2)
    expect(s.values[DUTY]).toBe(255)
    // the RC step response from about 0.5 V: 5 - 4.5 e^(-2/10) is about 1.3 V, nowhere near 5 V
    expect(s.values[FILT]).toBeLessThan(2)
  })

  it('failure no-cap: FILTERED still averages 2.51 V on the meter, but the ripple is the whole 5 V swing', async () => {
    const b = build({ failure: 'no-cap' })
    const s = await run(b, 1.5)
    expect(s.values[FILT]).toBeCloseTo((128 / 255) * 5, 1)
    expect(s.values[RIPPLE]).toBeGreaterThan(4.8)
    expect(Number.isNaN(s.values[CUTOFF])).toBe(true)
  })
})
