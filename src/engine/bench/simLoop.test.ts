import { describe, expect, it } from 'vitest'
import { ledResistor } from '../../lessons/T2/led-resistor'
import type { Behavior, Lesson, LessonDef } from '../types'
import { type Bench, type BenchSnapshot, createBench } from './simLoop'

const asLesson = (l: LessonDef, fig = 1): Lesson => ({ ...l, fig: l.fig ?? fig })
const LED = asLesson(ledResistor)

const FRAME = 1 / 60

async function runUntil(b: Bench, pred: (s: BenchSnapshot) => boolean, maxSim = 3): Promise<BenchSnapshot> {
  const t0 = b.t
  for (;;) {
    await b.frame(FRAME)
    const s = b.snapshot()
    if (pred(s)) return s
    if (b.t - t0 > maxSim) throw new Error(`condition not reached in ${maxSim}s of sim time (t=${b.t})`)
  }
}

const ledI = (s: BenchSnapshot) => s.values[0]
const pin13High = (s: BenchSnapshot) => s.pins[13]?.mode === 'OUTPUT' && s.pins[13].level === 1
const pin13Low = (s: BenchSnapshot) => s.pins[13]?.mode === 'OUTPUT' && s.pins[13].level === 0

/** a DC-only lesson: a battery, a switch-free divider */
const dcLesson: Lesson = {
  ...LED,
  id: 'dc',
  sketch: undefined,
  board: { name: 'DC', size: [4, 4], parts: [{ id: 'r1', kind: 'resistor', pos: [0, 0], mount: 'tht', role: 'r', circuitIds: ['R1'] }] },
  circuit: {
    elements: [
      { id: 'B1', type: 'V', nodes: ['v', '0'], value: 9 },
      { id: 'R1', type: 'R', nodes: ['v', 'm'], value: 1000 },
      { id: 'R2', type: 'R', nodes: ['m', '0'], value: 2000 },
    ],
  },
  powerElementId: 'B1',
  readouts: [
    { label: 'MID', source: { kind: 'voltage', node: 'm' }, unit: 'V' },
    { label: 'I', source: { kind: 'current', elementId: 'R1' }, unit: 'A' },
  ],
  tweaks: [{ label: 'R2', elementId: 'R2', key: 'value', min: 100, max: 10000, log: true, unit: 'Ω' }],
  failures: [{ id: 'short', label: 'Short R2', explain: 'R2 is bypassed.', patches: [{ op: 'short', a: 'm', b: '0' }] }],
  statusLines: [{ when: { kind: 'above', readout: 0, value: 5 }, text: 'POWERED: the midpoint is above 5 V' }],
  behaviors: undefined,
}

describe('createBench: led-resistor end to end (headless)', () => {
  it('strip → pick-place → place-all → solder → power → upload blinks the LED at 12–16 mA', async () => {
    const b = createBench(LED)
    expect(b.snapshot().status).toBe('READY')
    b.dispatch('strip')
    expect(b.snapshot().status).toBe('BARE PCB')
    b.dispatch('pick-place')
    b.dispatch('place-all')
    expect(b.snapshot().status).toBe('READY')
    b.dispatch('solder')
    b.dispatch('power')
    let s = b.snapshot()
    expect(s.status).toBe('POWERED')
    await b.frame(FRAME)
    s = b.snapshot()
    expect(Math.abs(ledI(s))).toBeLessThan(1e-6) // pins float until a sketch runs

    b.upload()
    expect(b.snapshot().status).toBe('RUNNING')
    s = await runUntil(b, pin13High)
    await b.frame(FRAME)
    s = b.snapshot()
    expect(pin13High(s)).toBe(true)
    expect(ledI(s)).toBeGreaterThan(0.012)
    expect(ledI(s)).toBeLessThan(0.016)
    expect(s.readouts[0].value).toMatch(/^1[2-5](\.\d)? mA$/)
    expect(s.values[1]).toBeGreaterThan(4.5) // pin 13 voltage
    expect(s.values[2]).toBeGreaterThan(1.6) // LED Vf
    expect(s.values[2]).toBeLessThan(2.1)
    expect(s.statusLine.text).toMatch(/pin 13 HIGH/)
    expect(s.serial.at(-1)).toBe('LED on')

    s = await runUntil(b, pin13Low)
    await b.frame(FRAME)
    s = b.snapshot()
    expect(Math.abs(ledI(s))).toBeLessThan(1e-6)
    expect(s.readouts[0].value).toBe('0.00 A')
    expect(s.statusLine.text).toMatch(/LOW/)
    expect(s.status).toBe('RUNNING')

    // break: leave the resistor out, right as the pin goes HIGH
    await runUntil(b, pin13High)
    b.dispatch('break:no-resistor')
    const tBreak = b.t
    s = await runUntil(b, (x) => x.status === 'FAULT', 0.5)
    expect(b.t - tBreak).toBeLessThanOrEqual(0.5)
    expect(s.assembly.burns.map((x) => x.elementId)).toContain('LED1')
    expect(s.statusLine.text).toMatch(/^FAULT: /)
    expect(s.statusLine.tone).toBe('warn')
    expect(s.readouts.every((r) => r.tone === 'warn')).toBe(true)
    b.dispose()
  })

  it('both the LED and pin 13 die without the resistor; Repair all brings them back', async () => {
    const b = createBench(LED)
    b.dispatch('power')
    b.upload()
    await runUntil(b, pin13High)
    b.dispatch('break:no-resistor')
    const s = await runUntil(b, (x) => x.assembly.burns.length >= 2, 1.5)
    expect(s.assembly.burns.map((x) => x.elementId).sort()).toEqual(['LED1', 'PIN13'])
    expect(s.partBurnt).toMatchObject({ led1: true, uno: true })
    b.dispatch('repair')
    expect(b.snapshot().status).toBe('RUNNING')
    const ok = await runUntil(b, pin13High)
    await b.frame(FRAME)
    expect(ledI(b.snapshot())).toBeGreaterThan(0.012)
    expect(ok.assembly.burns).toEqual([])
  })

  it('a 22 Ω resistor burns the LED (≈ 68 mA)', async () => {
    const b = createBench(LED)
    b.dispatch('power')
    b.upload()
    await runUntil(b, pin13High)
    b.dispatch('break:r-22')
    await b.frame(FRAME)
    expect(ledI(b.snapshot())).toBeGreaterThan(0.055)
    const s = await runUntil(b, (x) => x.status === 'FAULT', 0.6)
    expect(s.assembly.burns.map((x) => x.elementId)).toContain('LED1')
  })

  it('a reversed LED stays dark and survives, node a sits at 5 V', async () => {
    const b = createBench(LED)
    b.dispatch('power')
    b.dispatch('break:led-reversed')
    b.upload()
    await runUntil(b, pin13High)
    for (let i = 0; i < 30; i++) await b.frame(FRAME)
    const s = b.snapshot()
    if (pin13High(s)) expect(s.values[2]).toBeGreaterThan(4.9)
    expect(Math.abs(ledI(s))).toBeLessThan(1e-6)
    expect(s.status).toBe('RUNNING')
    expect(s.statusLine.text).toMatch(/blocks/)
  })

  it('unplugging stops the sketch and floats the pin', async () => {
    const b = createBench(LED)
    b.dispatch('power')
    b.upload()
    await runUntil(b, pin13High)
    b.dispatch('power')
    await b.frame(FRAME)
    const s = b.snapshot()
    expect(s.status).toBe('READY')
    expect(Math.abs(ledI(s))).toBeLessThan(1e-6)
    expect(s.pins[13]?.mode ?? 'INPUT').toBe('INPUT')
    expect(b.needsFrames()).toBe(false)
  })

  it('the resistor tweak changes the current (470 Ω ≈ 6.5 mA)', async () => {
    const b = createBench(LED)
    b.setTweak('R1.value', 470)
    expect(b.tweakValues()['R1.value']).toBe(470)
    b.dispatch('power')
    b.upload()
    await runUntil(b, pin13High)
    await b.frame(FRAME)
    const i = ledI(b.snapshot())
    expect(i).toBeGreaterThan(0.0055)
    expect(i).toBeLessThan(0.0075)
    expect(b.snapshot().elementValues['R1.value']).toBe(470)
  })

  it('a transpile error reports the line and leaves the board POWERED', () => {
    const b = createBench(LED)
    b.dispatch('power')
    b.upload('void setup() {\n  pinMode(13, OUTPUT)\n  int x = ;\n}\nvoid loop() {}\n')
    const s = b.snapshot()
    expect(s.status).toBe('POWERED')
    expect(s.sketchError).toMatch(/line \d+/)
  })

  it('steps about real time: one 60 Hz frame is 17 steps of 1 ms', async () => {
    const b = createBench(LED)
    b.dispatch('power')
    b.upload()
    await b.frame(FRAME)
    expect(b.t).toBeCloseTo(0.017, 6)
    b.setSpeed(0.5)
    await b.frame(FRAME)
    expect(b.t).toBeCloseTo(0.017 + 0.009, 6)
  })

  it('keeps the MCU in lockstep with sim time', async () => {
    const b = createBench(LED)
    b.dispatch('power')
    b.upload()
    for (let i = 0; i < 60; i++) await b.frame(FRAME)
    expect(Math.abs(b.mcuTimeMs() - b.t * 1000)).toBeLessThan(40)
  })

  it('throttles snapshots to about 15 Hz', async () => {
    const snaps: BenchSnapshot[] = []
    const b = createBench(LED, { onSnapshot: (s) => snaps.push(s) })
    b.dispatch('power')
    b.upload()
    snaps.length = 0
    for (let i = 0; i < 60; i++) await b.frame(FRAME)
    expect(snaps.length).toBeGreaterThanOrEqual(13)
    expect(snaps.length).toBeLessThanOrEqual(17)
  })

  it('reports notes for toasts', () => {
    const notes: string[] = []
    const b = createBench(LED, { onNote: (n) => notes.push(n.text) })
    b.dispatch('strip')
    b.dispatch('power')
    expect(notes.at(-1)).toMatch(/^Power needs: /)
  })
})

describe('createBench: DC lessons', () => {
  it('solves DC with no frames needed for the readouts', () => {
    const b = createBench(dcLesson)
    b.dispatch('power')
    const s = b.snapshot()
    expect(s.values[0]).toBeCloseTo(6, 3)
    expect(s.values[1]).toBeCloseTo(0.003, 6)
    expect(s.readouts[0].value).toBe('6.00 V')
    expect(s.statusLine.text).toMatch(/above 5 V/)
  })

  it('tweaks and failures re-solve immediately', () => {
    const b = createBench(dcLesson)
    b.dispatch('power')
    b.setTweak('R2.value', 1000)
    expect(b.snapshot().values[0]).toBeCloseTo(4.5, 3)
    b.dispatch('break:short')
    const s = b.snapshot()
    expect(s.values[0]).toBeLessThan(0.01)
    expect(s.statusLine.text).toMatch(/bypassed/)
  })

  it('unpowered readouts are zero', () => {
    const b = createBench(dcLesson)
    expect(b.snapshot().values[0]).toBe(0)
    expect(b.snapshot().status).toBe('READY')
  })

  it('a sustained overload still burns after 300 ms of frames', async () => {
    const l: Lesson = {
      ...dcLesson,
      circuit: {
        elements: [
          { id: 'B1', type: 'V', nodes: ['v', '0'], value: 9 },
          { id: 'R1', type: 'R', nodes: ['v', 'm'], value: 10, rating: { maxP: 0.25 } },
          { id: 'R2', type: 'R', nodes: ['m', '0'], value: 10 },
        ],
      },
    }
    const b = createBench(l)
    b.dispatch('power')
    await b.frame(FRAME)
    expect(b.snapshot().status).toBe('POWERED')
    for (let i = 0; i < 25; i++) await b.frame(FRAME)
    const s = b.snapshot()
    expect(s.status).toBe('FAULT')
    expect(s.partBurnt.r1).toBe(true)
    expect(s.values[1]).toBeLessThan(1e-6) // R1 open
  })
})

describe('createBench: behaviors', () => {
  const seen: { params?: Record<string, unknown>; libsCalled: number } = { libsCalled: 0 }
  const probe: Behavior = {
    id: 'probe',
    libraries: () => ({
      probe: {
        ping: () => {
          seen.libsCalled++
          return 7
        },
      },
    }),
    init(ctx) {
      ctx.publish('ready', 1)
    },
    tick(ctx) {
      seen.params = { ...ctx.params }
      ctx.publish('mid', ctx.v('m'))
      ctx.publish('gain', Number(ctx.params.gain))
      ctx.setParam('R2', 'value', Number(ctx.params.r2))
    },
  }
  const l: Lesson = {
    ...dcLesson,
    behaviors: [{ id: 'probe', instance: 'p', params: { gain: 2, r2: 2000 } }],
    readouts: [
      ...dcLesson.readouts,
      { label: 'MID (behavior)', source: { kind: 'behavior', key: 'p.mid' }, unit: 'V' },
      { label: 'GAIN', source: { kind: 'behavior', key: 'p.gain' }, unit: '' },
    ],
    tweaks: [{ label: 'R2 via behavior', elementId: 'behavior:p', key: 'r2', min: 100, max: 10000, unit: 'Ω' }],
    sketch: {
      title: 'Ping',
      code: 'void setup() { Serial.begin(9600); Serial.println(probe.ping()); }\nvoid loop() { delay(100); }\n',
      pins: {},
      vcc: 5,
      board: 'uno',
    },
  }

  it('publishes behavior readouts, reads node voltages and takes params from tweaks', async () => {
    const b = createBench(l, { registry: { probe } })
    b.dispatch('power')
    await b.frame(FRAME)
    let s = b.snapshot()
    expect(s.values[2]).toBeCloseTo(6, 2)
    expect(s.values[3]).toBe(2)
    expect(s.published['p.ready']).toBe(1)
    b.setTweak('behavior:p.r2', 1000)
    await b.frame(FRAME)
    await b.frame(FRAME)
    s = b.snapshot()
    expect(seen.params?.r2).toBe(1000)
    expect(s.values[0]).toBeCloseTo(4.5, 2)
  })

  it('hands libraries to the sketch', async () => {
    const b = createBench(l, { registry: { probe } })
    b.dispatch('power')
    b.upload()
    for (let i = 0; i < 5; i++) await b.frame(FRAME)
    expect(seen.libsCalled).toBeGreaterThan(0)
    expect(b.snapshot().serial).toContain('7')
  })

  it('ctx.burn fails a part like a rating would', async () => {
    const burner: Behavior = { id: 'burner', tick: (ctx) => ctx.t > 0.05 && ctx.burn('R1', 'overpower') }
    const b = createBench({ ...dcLesson, behaviors: ['burner'] }, { registry: { burner } })
    b.dispatch('power')
    for (let i = 0; i < 6; i++) await b.frame(FRAME)
    expect(b.snapshot().status).toBe('FAULT')
  })

  it('mcu.hold floats the pins until release', async () => {
    let hold = true
    const supply: Behavior = {
      id: 'supply',
      tick: (ctx) => (hold ? ctx.mcu.hold('brown-out') : ctx.mcu.release()),
    }
    const b = createBench({ ...LED, behaviors: ['supply'] }, { registry: { supply } })
    b.dispatch('power')
    b.upload()
    for (let i = 0; i < 70; i++) await b.frame(FRAME)
    expect(pin13High(b.snapshot()) || pin13Low(b.snapshot())).toBe(false)
    hold = false
    await runUntil(b, pin13High)
  })

  it('an unknown behavior id is reported, not thrown', () => {
    const warn: string[] = []
    const b = createBench({ ...dcLesson, behaviors: ['nope'] }, { registry: {}, onNote: (n) => warn.push(n.text) })
    expect(b.snapshot().warnings.join(' ')).toMatch(/nope/)
  })
})
