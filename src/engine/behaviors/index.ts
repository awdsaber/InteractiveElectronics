// Behavior registry: lesson-specific dynamics (sensors, driver ICs, brown-out...) that the
// netlist alone can't express. See README.md in this folder for the full API.
//
// Behaviors register themselves: every `src/engine/behaviors/<id>.ts` exporting
// `behavior: Behavior` is picked up by the glob below, so parallel authors never edit this file.

import type { Behavior, BehaviorRef } from '../types'

const modules = import.meta.glob<{ behavior?: Behavior }>(['./*.ts', '!./index.ts', '!./*.test.ts'], { eager: true })

export const registry: Record<string, Behavior> = {}

for (const [path, m] of Object.entries(modules)) {
  if (!m.behavior) throw new Error(`${path} must export \`behavior\``)
  if (registry[m.behavior.id]) throw new Error(`duplicate behavior id "${m.behavior.id}" (${path})`)
  registry[m.behavior.id] = m.behavior
}

/** for tests and tools; lessons should rely on the file-based registration */
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
