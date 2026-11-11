import { describe, expect, it } from 'vitest'
import type { BoardDynamic } from '../engine/types'
import { dynamicPose, easePose, poseMatrix, ridesOnBody } from './dynamicPose'

const SPEC: BoardDynamic = { lift: 4.5, pivot: [0, -1.2, 0], pitchKey: 'bot.pitch', travelKey: 'bot.x_m', maxTravel: 8 }

describe('dynamic board pose', () => {
  it('reads the pitch (degrees → radians) and the travel (metres → board units, 100 per m)', () => {
    const p = dynamicPose(SPEC, { 'bot.pitch': 30, 'bot.x_m': 0.05 })
    expect(p.pitch).toBeCloseTo(Math.PI / 6, 9)
    expect(p.travel).toBeCloseTo(5, 9)
  })

  it('clamps the drawn travel to ±maxTravel, and rests at zero with nothing published', () => {
    expect(dynamicPose(SPEC, { 'bot.x_m': 0.5 }).travel).toBe(8)
    expect(dynamicPose(SPEC, { 'bot.x_m': -0.5 }).travel).toBe(-8)
    expect(dynamicPose(SPEC, {})).toEqual({ pitch: 0, travel: 0 })
    expect(dynamicPose({ ...SPEC, unitsPerM: 50 }, { 'bot.x_m': 0.1 }).travel).toBeCloseTo(5, 9)
  })

  it('a forward pitch swings a point above the pivot toward +x, about the pivot, then lifts and travels', () => {
    // a point 10 units above the pivot, pitched 90° forward, ends 10 units ahead of it at pivot height
    const m = poseMatrix(SPEC, { pitch: Math.PI / 2, travel: 2 })
    const [x, y, z] = m([0, -1.2 + 10, 0.5])
    expect(x).toBeCloseTo(10 + 2, 9)
    expect(y).toBeCloseTo(-1.2 + 4.5, 9)
    expect(z).toBeCloseTo(0.5, 9)
    // the pivot itself only lifts and travels
    const q = m([0, -1.2, 0])
    expect(q[0]).toBeCloseTo(2, 9)
    expect(q[1]).toBeCloseTo(3.3, 9)
  })

  it('eases toward the target (snapshots arrive at ~15 Hz) and lands on it', () => {
    const cur = { pitch: 0, travel: 0 }
    easePose(cur, { pitch: 1, travel: 4 }, 0.04)
    expect(cur.pitch).toBeGreaterThan(0.3)
    expect(cur.pitch).toBeLessThan(1)
    for (let i = 0; i < 100; i++) easePose(cur, { pitch: 1, travel: 4 }, 0.016)
    expect(cur.pitch).toBe(1)
    expect(cur.travel).toBe(4)
  })

  it('every part rides on the body except the fixed ones', () => {
    expect(ridesOnBody({ ...SPEC, fixed: ['mat'] }, 'uno')).toBe(true)
    expect(ridesOnBody({ ...SPEC, fixed: ['mat'] }, 'mat')).toBe(false)
  })
})
