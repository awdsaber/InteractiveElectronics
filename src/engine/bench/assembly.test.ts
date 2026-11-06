import { describe, expect, it } from 'vitest'
import type { BurnEvent, Lesson, PartPlacement } from '../types'
import {
  type AssemblyState,
  initialAssembly,
  isPowered,
  needsSolder,
  reduceAssembly,
  remainingParts,
  benchStatus,
  readyToPower,
} from './assembly'

const part = (id: string, mount: PartPlacement['mount'], extra: Partial<PartPlacement> = {}): PartPlacement => ({
  id,
  kind: mount === 'smd' ? 'resistor-smd' : mount === 'module' ? 'module' : 'resistor',
  pos: [0, 0],
  mount,
  role: `${id} does a job`,
  ...extra,
})

function lesson(parts: PartPlacement[], extra: Partial<Lesson> = {}): Lesson {
  return {
    id: 't',
    fig: 1,
    track: 'T0',
    title: 'Test',
    subtitle: '',
    tagline: '',
    board: { name: 'T', size: [4, 4], parts },
    circuit: {
      elements: [
        { id: 'V1', type: 'V', nodes: ['a', '0'], value: 5 },
        { id: 'R1', type: 'R', nodes: ['a', '0'], value: 100 },
      ],
    },
    powerElementId: 'V1',
    readouts: [],
    failures: [
      { id: 'f1', label: 'Short it', explain: 'It shorts.', patches: [{ op: 'short', a: 'a', b: '0' }] },
      { id: 'f2', label: 'Swap R', explain: 'Wrong value.', patches: [{ op: 'set', elementId: 'R1', key: 'value', value: 1 }] },
    ],
    meet: '',
    mechanicalAnalogy: '',
    proTips: [],
    quiz: [],
    ...extra,
  }
}

const pcbLesson = lesson([part('U1', 'smd'), part('C1', 'smd'), part('R1', 'tht', { circuitIds: ['R1'] }), part('J1', 'tht'), part('M1', 'module'), part('W1', 'offboard')])
const bbLesson = lesson([part('UNO', 'module'), part('BB', 'offboard'), part('R1', 'tht'), part('D1', 'tht')], {
  board: { name: 'BB', size: [4, 4], base: 'breadboard-only', parts: [part('UNO', 'module'), part('BB', 'offboard'), part('R1', 'tht'), part('D1', 'tht')] },
})

const run = (l: Lesson, actions: Parameters<typeof reduceAssembly>[2][], s: AssemblyState = initialAssembly(l)) => {
  const notes: string[] = []
  for (const a of actions) {
    const r = reduceAssembly(l, s, a)
    s = r.state
    notes.push(...r.notes.map((n) => n.text))
  }
  return { s, notes }
}

const burn = (elementId: string, reason: BurnEvent['reason'] = 'overcurrent'): BurnEvent => ({ elementId, reason, value: 0.12, limit: 0.03, t: 1 })

describe('assembly reducer', () => {
  it('starts fully assembled and unpowered (the finished board), READY', () => {
    const s = initialAssembly(pcbLesson)
    expect(s.placed.size).toBe(6)
    expect(s.soldered).toBe(true)
    expect(isPowered(pcbLesson, s)).toBe(false)
    expect(benchStatus(pcbLesson, s)).toBe('READY')
  })

  it('strip gives a bare PCB with nothing placed, soldered or powered', () => {
    const { s } = run(pcbLesson, ['power', 'strip'])
    expect(s.placed.size).toBe(0)
    expect(s.soldered).toBe(false)
    expect(isPowered(pcbLesson, s)).toBe(false)
    expect(s.running).toBe(false)
    expect(benchStatus(pcbLesson, s)).toBe('BARE PCB')
    expect(remainingParts(pcbLesson, s).map((p) => p.id)).toEqual(['R1', 'J1', 'M1', 'W1'])
  })

  it('pick-place drops every SMD part and nothing else', () => {
    const { s, notes } = run(pcbLesson, ['strip', 'pick-place'])
    expect([...s.placed].sort()).toEqual(['C1', 'U1'])
    expect(benchStatus(pcbLesson, s)).toBe('ASSEMBLING')
    expect(notes.at(-1)).toMatch(/2 SMD parts/)
  })

  it('placing one part toasts its role; placing it twice is a no-op', () => {
    const { s, notes } = run(pcbLesson, ['strip', 'place:R1', 'place:R1', 'place:nope'])
    expect([...s.placed]).toEqual(['R1'])
    expect(notes.filter((n) => n.includes('R1 does a job'))).toHaveLength(1)
  })

  it('smd parts cannot be placed one by one', () => {
    const { s } = run(pcbLesson, ['strip', 'place:U1'])
    expect(s.placed.has('U1')).toBe(false)
  })

  it('place-all places every remaining hand-placed part (not SMD)', () => {
    const { s } = run(pcbLesson, ['strip', 'place-all'])
    expect([...s.placed].sort()).toEqual(['J1', 'M1', 'R1', 'W1'])
    expect(remainingParts(pcbLesson, s)).toEqual([])
  })

  it('solder names what is missing and does not solder', () => {
    const { s, notes } = run(pcbLesson, ['strip', 'place:R1', 'solder'])
    expect(s.soldered).toBe(false)
    expect(notes.at(-1)).toMatch(/^Solder needs: /)
    expect(notes.at(-1)).toMatch(/SMD parts/)
    expect(notes.at(-1)).toMatch(/J1/)
    expect(notes.at(-1)).not.toMatch(/R1/)
  })

  it('solders once everything is placed: READY', () => {
    const { s } = run(pcbLesson, ['strip', 'pick-place', 'place-all', 'solder'])
    expect(s.soldered).toBe(true)
    expect(benchStatus(pcbLesson, s)).toBe('READY')
  })

  it('power needs solder on a PCB lesson', () => {
    const { s, notes } = run(pcbLesson, ['strip', 'pick-place', 'place-all', 'power'])
    expect(isPowered(pcbLesson, s)).toBe(false)
    expect(notes.at(-1)).toMatch(/^Power needs: soldered joints/)
  })

  it('power toggles: POWERED, then off again', () => {
    const { s } = run(pcbLesson, ['strip', 'pick-place', 'place-all', 'solder', 'power'])
    expect(s.powered.V1).toBe(true)
    expect(benchStatus(pcbLesson, s)).toBe('POWERED')
    const off = run(pcbLesson, ['power'], s).s
    expect(isPowered(pcbLesson, off)).toBe(false)
    expect(benchStatus(pcbLesson, off)).toBe('READY')
  })

  it('a breadboard lesson skips the solder step', () => {
    expect(needsSolder(bbLesson)).toBe(false)
    expect(needsSolder(pcbLesson)).toBe(true)
    const { s, notes } = run(bbLesson, ['strip', 'place-all', 'solder'])
    expect(notes.at(-1)).toMatch(/breadboard/i)
    expect(readyToPower(bbLesson, s)).toBe(true)
    expect(benchStatus(bbLesson, s)).toBe('READY')
    expect(run(bbLesson, ['power'], s).s.powered.V1).toBe(true)
  })

  it('a lesson with no THT parts never needs solder', () => {
    const l = lesson([part('U1', 'smd'), part('M1', 'module')])
    expect(needsSolder(l)).toBe(false)
  })

  it('power still needs every part placed on a breadboard', () => {
    const { s, notes } = run(bbLesson, ['strip', 'place:UNO', 'power'])
    expect(isPowered(bbLesson, s)).toBe(false)
    expect(notes.at(-1)).toMatch(/^Power needs: .*BB.*R1.*D1/)
  })

  it('upload needs power and a sketch, and gives RUNNING', () => {
    const noSketch = run(pcbLesson, ['power', 'upload'])
    expect(noSketch.s.running).toBe(false)
    const withSketch = lesson(pcbLesson.board.parts, {
      sketch: { title: 'Blink', code: '', pins: {}, vcc: 5, board: 'uno' },
    })
    const cold = run(withSketch, ['upload'])
    expect(cold.s.running).toBe(false)
    expect(cold.notes.at(-1)).toMatch(/power/i)
    const { s } = run(withSketch, ['power', 'upload'])
    expect(s.running).toBe(true)
    expect(benchStatus(withSketch, s)).toBe('RUNNING')
    const off = run(withSketch, ['power'], s).s
    expect(off.running).toBe(false)
  })

  it('stripping while powered cuts the power', () => {
    const { s } = run(pcbLesson, ['power', 'strip'])
    expect(s.powered.V1).toBe(false)
  })

  it('explode toggles', () => {
    expect(run(pcbLesson, ['explode']).s.exploded).toBe(true)
    expect(run(pcbLesson, ['explode', 'explode']).s.exploded).toBe(false)
  })

  it('break adds a failure once; unknown ids are ignored; repair clears failures, burns and disabled parts', () => {
    const { s } = run(pcbLesson, ['break:f1', 'break:f1', 'break:zz', 'break:f2'])
    expect(s.failures).toEqual(['f1', 'f2'])
    const burnt = run(pcbLesson, [{ type: 'burn', burn: burn('R1') }, { type: 'thermal', elementId: 'R1', off: true }], s).s
    expect(burnt.burns).toHaveLength(1)
    expect(burnt.disabled.has('R1')).toBe(true)
    const fixed = run(pcbLesson, ['repair'], burnt).s
    expect(fixed.failures).toEqual([])
    expect(fixed.burns).toEqual([])
    expect(fixed.disabled.size).toBe(0)
  })

  it('a burnt part means FAULT, even while running', () => {
    const { s, notes } = run(pcbLesson, ['power', { type: 'burn', burn: burn('R1') }])
    expect(benchStatus(pcbLesson, s)).toBe('FAULT')
    expect(notes.at(-1)).toMatch(/R1 burnt/)
  })

  it('a part burns only once', () => {
    const { s } = run(pcbLesson, [{ type: 'burn', burn: burn('R1') }, { type: 'burn', burn: burn('R1', 'overpower') }])
    expect(s.burns).toHaveLength(1)
  })

  it('thermal shutdown disables a part without a FAULT, and recovery re-enables it', () => {
    const { s } = run(pcbLesson, ['power', { type: 'thermal', elementId: 'R1', off: true }])
    expect(s.disabled.has('R1')).toBe(true)
    expect(benchStatus(pcbLesson, s)).toBe('POWERED')
    expect(run(pcbLesson, [{ type: 'thermal', elementId: 'R1', off: false }], s).s.disabled.has('R1')).toBe(false)
  })

  it('stopped ends RUNNING (sketch error)', () => {
    const l = lesson(pcbLesson.board.parts, { sketch: { title: 'B', code: '', pins: {}, vcc: 5, board: 'uno' } })
    const { s } = run(l, ['power', 'upload', { type: 'stopped' }])
    expect(s.running).toBe(false)
    expect(benchStatus(l, s)).toBe('POWERED')
  })

  it('extra power sources toggle independently; the MCU supply is the main one', () => {
    const l = lesson(pcbLesson.board.parts, {
      circuit: {
        elements: [
          { id: 'V1', type: 'V', nodes: ['a', '0'], value: 5 },
          { id: 'VM', type: 'V', nodes: ['m', '0'], value: 9 },
          { id: 'R1', type: 'R', nodes: ['a', 'm'], value: 100 },
        ],
      },
      extraPower: [{ elementId: 'VM', label: 'Connect battery' }],
    })
    const { s } = run(l, ['power:VM'])
    expect(s.powered).toEqual({ V1: false, VM: true })
    expect(isPowered(l, s)).toBe(true)
    expect(run(l, ['power'], s).s.powered).toEqual({ V1: true, VM: true })
  })

  it('never mutates the previous state', () => {
    const s0 = initialAssembly(pcbLesson)
    const placed = [...s0.placed]
    reduceAssembly(pcbLesson, s0, 'strip')
    reduceAssembly(pcbLesson, s0, 'break:f1')
    expect([...s0.placed]).toEqual(placed)
    expect(s0.failures).toEqual([])
  })
})
