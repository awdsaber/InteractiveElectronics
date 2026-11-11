// A board that moves as one rigid body (BoardSpec.dynamic): a balancing robot's chassis pitches about its
// axle and drives along x. Pure, so it is testable without WebGL; Board.tsx applies it to a group around
// the PCB and every part that is not `fixed`.
//
// Transform of a board point p: lift and travel ∘ rotate about z by −pitch ∘ (p − pivot) + pivot.
// A positive pitch tips the board's +y toward +x (a forward lean).

import type { BoardDynamic } from '../engine/types'

export interface Pose {
  /** rad, + leans toward +x */
  pitch: number
  /** board units along +x */
  travel: number
}

/** the pose the published values ask for (no smoothing) */
export function dynamicPose(d: BoardDynamic, published: Record<string, number>): Pose {
  const deg = d.pitchKey ? published[d.pitchKey] : undefined
  const m = d.travelKey ? published[d.travelKey] : undefined
  const lim = d.maxTravel ?? 8
  const travel = typeof m === 'number' && Number.isFinite(m) ? Math.max(-lim, Math.min(lim, m * (d.unitsPerM ?? 100))) : 0
  const pitch = typeof deg === 'number' && Number.isFinite(deg) ? (deg * Math.PI) / 180 : 0
  return { pitch, travel }
}

/** time constant of the easing between ~15 Hz snapshots, s */
export const POSE_TAU = 0.035

/** move `cur` toward `target` over dt seconds (first order, τ = POSE_TAU); snaps when within a hair */
export function easePose(cur: Pose, target: Pose, dt: number): boolean {
  const k = 1 - Math.exp(-Math.max(0, dt) / POSE_TAU)
  cur.pitch += (target.pitch - cur.pitch) * k
  cur.travel += (target.travel - cur.travel) * k
  if (Math.abs(target.pitch - cur.pitch) < 1e-4) cur.pitch = target.pitch
  if (Math.abs(target.travel - cur.travel) < 1e-3) cur.travel = target.travel
  return cur.pitch !== target.pitch || cur.travel !== target.travel
}

/** the board-to-world map for a pose (for tests and for placing things by hand) */
export function poseMatrix(d: BoardDynamic, pose: Pose): (p: [number, number, number]) => [number, number, number] {
  const [px, py, pz] = d.pivot
  const c = Math.cos(-pose.pitch)
  const s = Math.sin(-pose.pitch)
  const lift = d.lift ?? 0
  return ([x, y, z]) => {
    const dx = x - px
    const dy = y - py
    return [px + c * dx - s * dy + pose.travel, py + s * dx + c * dy + lift, z - pz + pz]
  }
}

export const ridesOnBody = (d: BoardDynamic, partId: string): boolean => !(d.fixed ?? []).includes(partId)
