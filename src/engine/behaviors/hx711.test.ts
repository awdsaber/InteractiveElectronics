import { describe, expect, it } from 'vitest'
import { type Bench, createBench } from '../bench/simLoop'
import type { Lesson } from '../types'
import { CODE_MAX, CODE_MIN, behavior, codeFor, countsPerGram, creepStep, overloadSet } from './hx711'
import { behavior as plotter } from './serial-plotter'

const FRAME = 1 / 60

describe('hx711: conversion maths', () => {
  it('24-bit two\'s complement, ratiometric: code = Vin / AVDD × gain × 2^24, clamped', () => {
    // 1 mV/V at gain 128: 0.001 × 128 × 2^24 = 2 147 484 counts
    expect(codeFor(0.001, 128)).toBe(2147484)
    expect(codeFor(-0.001, 128)).toBe(-2147484)
    expect(codeFor(0.001, 64)).toBe(1073742)
    // full scale is ±0.5 × AVDD / gain: ±19.5 mV at AVDD 5 V, ±16.8 mV at 4.3 V
    expect(codeFor(0.5 / 128, 128)).toBe(CODE_MAX)
    expect(codeFor(-0.5 / 128, 128)).toBe(CODE_MIN)
    expect(CODE_MAX).toBe(0x7fffff)
    expect(CODE_MIN).toBe(-0x800000)
    expect(codeFor(-2, 128)).toBe(CODE_MIN)
  })

  it('counts per gram: rated output / capacity × gain × 2^24 × (E+ / AVDD)', () => {
    expect(countsPerGram(1.0, 1000, 128, 1)).toBeCloseTo(2147.48, 2)
    expect(countsPerGram(0.98, 1000, 128, 1)).toBeCloseTo(2104.53, 2)
    // excited from 5 V while the ADC still references 4.3 V: 16 % too many counts per gram
    expect(countsPerGram(1.0, 1000, 128, 5 / 4.3)).toBeCloseTo(2497.1, 1)
  })

  it('creep: a first-order rise that reaches creepPct of the load after 30 min, and recovers', () => {
    let c = 0
    for (let i = 0; i < 1800; i++) c = creepStep(c, 1000, 1, 0.05, 600)
    expect(c).toBeCloseTo(0.5, 6) // 0.05 % of 1000 g at 30 min
    for (let i = 0; i < 1800; i++) c = creepStep(c, 0, 1, 0.05, 600)
    expect(c).toBeLessThan(0.03) // creep recovery once unloaded
  })

  it('overload: permanent zero shift only beyond the safe overload', () => {
    expect(overloadSet(1200, 1200, 0.2)).toBe(0)
    expect(overloadSet(1100, 1200, 0.2)).toBe(0)
    expect(overloadSet(1400, 1200, 0.2)).toBeCloseTo(40, 9)
  })
})

// a bare bridge on a fixed 4.3 V AVDD, the library read by a tiny sketch
function bridgeLesson(code: string, params: Record<string, number | string> = {}): Lesson {
  return {
    id: 'hx-test',
    track: 'T6',
    fig: 99,
    title: 't',
    subtitle: 't',
    tagline: 't',
    board: { name: 'T', size: [8, 6], base: 'breadboard-only', parts: [] },
    circuit: {
      elements: [
        { id: 'v5', type: 'V', nodes: ['5v', '0'], value: 5 },
        { id: 'sw', type: 'SW', nodes: ['5v', 'vs'], closed: true },
        { id: 'r_load', type: 'R', nodes: ['vs', '0'], value: 1000 },
        { id: 'reg', type: 'OPAMP', nodes: ['vs', 'avdd', 'avdd'], vPos: 4.3, vNeg: 0 },
        { id: 'sg1', type: 'R', nodes: ['avdd', 'ap'], value: 1000 },
        { id: 'sg2', type: 'R', nodes: ['ap', '0'], value: 1000 },
        { id: 'sg3', type: 'R', nodes: ['avdd', 'an'], value: 1000 },
        { id: 'sg4', type: 'R', nodes: ['an', '0'], value: 1000 },
        { id: 'pin2', type: 'PIN', nodes: ['d2', '0'], pin: 2, vcc: 5 },
        { id: 'pin3', type: 'PIN', nodes: ['d3', '0'], pin: 3, vcc: 5 },
      ],
    },
    powerElementId: 'sw',
    sim: { dt: 2.5e-3 },
    readouts: [],
    sketch: { title: 't', code, pins: { 2: 'pin2', 3: 'pin3' }, vcc: 5, board: 'uno' },
    failures: [],
    meet: '',
    mechanicalAnalogy: '',
    proTips: [],
    quiz: [],
    behaviors: [
      { id: 'hx711', params: { supply: 'vs', massG: 0, mvPerV: 1.0, zeroMvV: 0, noiseNv: 0, railNoiseMv: 0, noiseEl: '', ...params } },
      { id: 'serial-plotter', instance: 'serial' },
    ],
  } as Lesson
}

const READ_RAW = `HX711 scale;
void setup() { Serial.begin(115200); scale.begin(3, 2); }
void loop() { delay(100); Serial.print("raw:"); Serial.print(scale.read()); Serial.print(",ready:"); Serial.println(scale.is_ready() ? 1 : 0); }`

function bench(code: string, params: Record<string, number | string> = {}): Bench {
  const b = createBench(bridgeLesson(code, params), { registry: { hx711: behavior, 'serial-plotter': plotter } })
  b.dispatch('power')
  b.upload()
  return b
}
async function run(b: Bench, sec: number) {
  const end = b.t + sec
  while (b.t < end - 1e-9) await b.frame(FRAME)
}
const pub = (b: Bench, k: string) => b.snapshot().published?.[k]

describe('hx711 behavior on a bench', () => {
  it('converts the solved bridge at 10 SPS, discarding the first 4 (400 ms settling)', async () => {
    const b = bench(READ_RAW, { massG: 500 })
    await run(b, 0.35)
    expect(pub(b, 'hx711.conversions')).toBe(0) // still settling
    await run(b, 1.65)
    // 2 s at 10 SPS: 20 periods, 4 discarded
    expect(pub(b, 'hx711.conversions')).toBeGreaterThanOrEqual(15)
    expect(pub(b, 'hx711.conversions')).toBeLessThanOrEqual(16)
    // 500 g on a 1 kg, 1.0 mV/V cell: s = 0.0005, V = 4.3 V × s = 2.15 mV, code = 0.0005 × 128 × 2^24
    const s = b.snapshot()
    expect(pub(b, 'hx711.vdiff_uV')).toBeCloseTo(2150, 0)
    // the MNA solve is good to a few ppm of the signal: ±5 counts of 1 073 742 (≈ 10 nV, 0.002 g)
    expect(Math.abs(pub(b, 'hx711.raw')! - codeFor(0.0005, 128))).toBeLessThanOrEqual(5)
    expect(s.serial.at(-1)).toMatch(/^raw:10737\d\d,ready:0/)
    b.dispose()
  })

  it('80 SPS converts 8 times as often and settles in 50 ms', async () => {
    const b = bench(READ_RAW, { rate: 80 })
    await run(b, 1.0)
    const n = pub(b, 'hx711.conversions')!
    expect(n).toBeGreaterThanOrEqual(75)
    expect(n).toBeLessThanOrEqual(78)
    expect(pub(b, 'hx711.sps')).toBe(80)
    b.dispose()
  })

  it('input noise: 50 nV rms at 10 SPS is about 25 counts rms at AVDD 4.3 V', async () => {
    const b = bench(`HX711 scale;
      void setup() { Serial.begin(115200); scale.begin(3, 2); }
      void loop() { delay(100); Serial.print("raw:"); Serial.println(scale.read()); }`, { noiseNv: 50 })
    const xs: number[] = []
    for (let i = 0; i < 600; i++) {
      await b.frame(FRAME)
      if (i % 6 === 0 && i > 60) xs.push(pub(b, 'hx711.raw')!)
    }
    const m = xs.reduce((a, c) => a + c, 0) / xs.length
    const sd = Math.sqrt(xs.reduce((a, c) => a + (c - m) ** 2, 0) / xs.length)
    expect(sd).toBeGreaterThan(15)
    expect(sd).toBeLessThan(37) // 50e-9 / (0.5 × 4.3 / 128 / 2^23) = 25
    b.dispose()
  })

  it('library: tare, set_scale, get_units, read_average, set_gain(64), power_down', async () => {
    const b = bench(`HX711 scale;
      void setup() {
        Serial.begin(115200);
        scale.begin(3, 2);
        delay(1500);
        scale.tare(10);
        scale.set_scale(2147.48);
        Serial.print("off:"); Serial.println(scale.get_offset());
      }
      void loop() {
        delay(500);
        Serial.print("g:"); Serial.print(scale.get_units(5), 2);
        Serial.print(",avg:"); Serial.print(scale.read_average(3));
        Serial.print(",sc:"); Serial.println(scale.get_scale(), 2);
      }`, { zeroMvV: 0.05 })
    await run(b, 2.2)
    expect(Math.abs(pub(b, 'serial.off')! - codeFor(0.00005, 128))).toBeLessThanOrEqual(3) // the zero balance, tared away
    b.setTweak('behavior:hx711.massG', 200)
    await run(b, 1.5)
    expect(pub(b, 'serial.g')).toBeCloseTo(200, 1)
    expect(pub(b, 'serial.sc')).toBeCloseTo(2147.48, 2)
    expect(Math.abs(pub(b, 'serial.avg')! - codeFor(0.00025, 128))).toBeLessThanOrEqual(5)
    b.dispose()
  })

  it('begin on the wrong pins never sees data ready; read() returns 0', async () => {
    const b = bench(`HX711 scale;
      void setup() { Serial.begin(115200); scale.begin(5, 6); }
      void loop() { delay(200); Serial.print("raw:"); Serial.print(scale.read()); Serial.print(",ready:"); Serial.println(scale.is_ready() ? 1 : 0); }`, { massG: 500 })
    await run(b, 1.5)
    expect(pub(b, 'serial.raw')).toBe(0)
    expect(pub(b, 'serial.ready')).toBe(0)
    b.dispose()
  })

  it('gain 64 halves the counts; power_down stops conversions', async () => {
    const b = bench(`HX711 scale;
      void setup() { Serial.begin(115200); scale.begin(3, 2, 64); }
      void loop() { delay(100); Serial.print("raw:"); Serial.println(scale.read()); }`, { massG: 500 })
    await run(b, 1.5)
    expect(Math.abs(pub(b, 'hx711.raw')! - codeFor(0.0005, 64))).toBeLessThanOrEqual(3)
    expect(pub(b, 'hx711.gain')).toBe(64)
    b.dispose()
    const c = bench(`HX711 scale;
      void setup() { Serial.begin(115200); scale.begin(3, 2); delay(800); scale.power_down(); }
      void loop() { delay(100); }`)
    await run(c, 1.0)
    const n = pub(c, 'hx711.conversions')!
    await run(c, 1.0)
    expect(pub(c, 'hx711.conversions')).toBe(n)
    expect(pub(c, 'hx711.down')).toBe(1)
    c.dispose()
  })

  it('sets the gauges from the mass: ΔR = R × rated output × m / capacity', async () => {
    const b = bench(READ_RAW, { massG: 1000 })
    await run(b, 0.2)
    expect(pub(b, 'hx711.dR')).toBeCloseTo(1.0, 6) // 1000 Ω × 0.001
    expect(pub(b, 'hx711.true_g')).toBe(1000)
    b.dispose()
  })
})
