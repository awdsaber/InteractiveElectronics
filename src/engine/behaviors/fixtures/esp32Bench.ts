// Test fixture (not a behavior: the registry glob only reads ./*.ts): a minimal ESP32-S3 bench
// for the ws2812 / wifi-sim / esp32-boot unit tests.

import { createBench, type Bench, type BenchSnapshot } from '../../bench/simLoop'
import type { Behavior, BehaviorRef, Element, Lesson } from '../../types'

export const FRAME = 1 / 60

export function esp32Lesson(code: string, behaviors: BehaviorRef[], extra: Element[] = []): Lesson {
  return {
    id: 'esp32-fixture',
    fig: 1,
    track: 'T4',
    title: 'ESP32 fixture',
    subtitle: 'test',
    tagline: 'test',
    board: { name: 'FX', size: [8, 4], base: 'breadboard-only', parts: [{ id: 'devkit', kind: 'module', pos: [0, 0], mount: 'module', role: 'board' }] },
    circuit: {
      elements: [
        { id: 'v_usb', type: 'V', nodes: ['usb_vbus', '0'], value: 5, rInternal: 0.3 },
        { id: 'usb_plug', type: 'SW', nodes: ['usb_vbus', '5v'], closed: false },
        { id: 'ldo', type: 'OPAMP', nodes: ['5v', '3v3', '3v3'], vPos: 3.3, vNeg: 0 },
        { id: 'i_module', type: 'I', nodes: ['3v3', '0'], value: 0.045 },
        { id: 'pin_rgb', type: 'PIN', nodes: ['g48', '0'], pin: 48, vcc: 3.3 },
        { id: 'i_rgb', type: 'I', nodes: ['3v3', '0'], value: 0 },
        { id: 'r_pu0', type: 'R', nodes: ['3v3', 'g0'], value: 45000 },
        { id: 'pin0', type: 'PIN', nodes: ['g0', '0'], pin: 0, vcc: 3.3 },
        { id: 'v_sig', type: 'V', nodes: ['s5', '0'], value: 5 },
        { id: 'r_dtop', type: 'R', nodes: ['s5', 'g4'], value: 10000 },
        { id: 'r_dbot', type: 'R', nodes: ['g4', '0'], value: 20000 },
        ...extra,
      ],
    },
    powerElementId: 'usb_plug',
    readouts: [{ label: '3V3', source: { kind: 'voltage', node: '3v3' }, unit: 'V' }],
    sketch: { title: 'fx', code, pins: { 48: 'pin_rgb', 0: 'pin0' }, vcc: 3.3, board: 'esp32s3' },
    failures: [
      {
        id: 'boot-held',
        label: 'Hold BOOT',
        explain: 'GPIO0 low at reset.',
        patches: [{ op: 'add', element: { id: 'boot_held', type: 'SW', nodes: ['g0', '0'], closed: true } }],
      },
    ],
    meet: 'm',
    mechanicalAnalogy: 'm',
    proTips: [],
    quiz: [],
    behaviors,
    transient: true,
  }
}

export function benchOf(code: string, registry: Record<string, Behavior>, behaviors: BehaviorRef[] = Object.keys(registry), extra: Element[] = []): Bench {
  return createBench(esp32Lesson(code, behaviors, extra), { registry })
}

/** power the (already assembled) fixture and upload its sketch */
export function powerAndRun(b: Bench): void {
  b.dispatch('power')
  b.upload()
}

export async function runFor(b: Bench, seconds: number): Promise<BenchSnapshot> {
  const n = Math.ceil(seconds / FRAME - 1e-9)
  for (let i = 0; i < n; i++) await b.frame(FRAME)
  return b.snapshot()
}

export async function runUntil(b: Bench, pred: (s: BenchSnapshot) => boolean, maxSim = 5): Promise<BenchSnapshot> {
  const t0 = b.t
  for (;;) {
    await b.frame(FRAME)
    const s = b.snapshot()
    if (pred(s)) return s
    if (b.t - t0 > maxSim) throw new Error(`condition not reached in ${maxSim}s of sim time (t=${b.t})`)
  }
}
