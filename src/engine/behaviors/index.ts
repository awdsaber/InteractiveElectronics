// Behavior registry: lesson-specific dynamics (sensors, driver ICs, brown-out...) that the
// netlist alone can't express. A lesson lists them in `behaviors`; the bench instantiates
// each one with its own params and a BehaviorContext (see src/engine/types.ts).
//
// Add a behavior: write `src/engine/behaviors/<id>.ts` exporting a `Behavior`, then add it to
// `registry` below. Keep behaviors framework-free and test them headless through createBench.

import type { Behavior, BehaviorRef } from '../types'

export const registry: Record<string, Behavior> = {}

export function registerBehavior(b: Behavior): void {
  registry[b.id] = b
}

export interface ResolvedBehavior {
  /** registry id */
  id: string
  /** instance name for readouts / tweaks (`behavior:<instance>.<param>`); defaults to the id */
  instance: string
  params: Record<string, number | string | boolean>
}

export function resolveBehaviorRef(ref: BehaviorRef): ResolvedBehavior {
  if (typeof ref === 'string') return { id: ref, instance: ref, params: {} }
  return { id: ref.id, instance: ref.instance ?? ref.id, params: { ...(ref.params ?? {}) } }
}
