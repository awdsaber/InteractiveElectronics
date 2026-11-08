// Tweak logic, framework-free: what value a control may take (slider / toggle / enum /
// momentary), what a momentary button holds while pressed, and where a (ganged) tweak's value goes.

import type { Tweak, TweakTarget } from '../types'

export const tweakKey = (t: Pick<Tweak, 'elementId' | 'key'>): string => `${t.elementId}.${t.key}`

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** the nearest value this tweak's control can produce */
export function snapTweak(t: Tweak, v: number): number {
  if (!Number.isFinite(v)) return t.min
  const kind = t.kind ?? 'slider'
  if (kind === 'toggle' || kind === 'momentary') return v >= (t.min + t.max) / 2 ? t.max : t.min
  if (kind === 'enum' && t.options?.length) {
    let best = t.options[0].value
    for (const o of t.options) if (Math.abs(o.value - v) < Math.abs(best - v)) best = o.value
    return best
  }
  let x = clamp(v, t.min, t.max)
  if (t.step && !t.log) x = clamp(t.min + Math.round((x - t.min) / t.step) * t.step, t.min, t.max)
  return x
}

/** a toggle (or a momentary button) reads "on" in the upper half of min..max */
export const isOn = (t: Tweak, v: number): boolean => v >= (t.min + t.max) / 2

/**
 * A momentary button rests at the circuit's own value and, while held, goes to the end of
 * min..max away from it (normally open 0 → 1, normally closed 1 → 0).
 */
export function momentaryValues(t: Tweak, rest: number): { rest: number; held: number } {
  return { rest, held: rest === t.max ? t.min : t.max }
}

/** where a tweak's value goes: the tweak's own element/key, then each ganged link */
export function tweakTargets(t: Tweak): Required<TweakTarget>[] {
  return [{ elementId: t.elementId, key: t.key, scale: 1 }, ...(t.link ?? []).map((l) => ({ elementId: l.elementId, key: l.key, scale: l.scale ?? 1 }))]
}

/** every (target, value) the current tweak values set, in tweak order */
export function tweakAssignments(tweaks: readonly Tweak[], values: Readonly<Record<string, number>>): { elementId: string; key: string; value: number }[] {
  const out: { elementId: string; key: string; value: number }[] = []
  for (const t of tweaks) {
    const v = values[tweakKey(t)]
    if (v === undefined) continue
    for (const g of tweakTargets(t)) out.push({ elementId: g.elementId, key: g.key, value: v * g.scale })
  }
  return out
}
