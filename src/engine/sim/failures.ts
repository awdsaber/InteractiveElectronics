// Pure netlist transforms for "Break something" scenarios and burnt parts.

import type { BurnEvent, Element, FailurePatch, Netlist, NodeId } from '../types'
import { effectiveRating } from './ratings'

export const SHORT_R = 0.01
export const OPEN_R = 1e9

function uniqueId(base: string, taken: Set<string>): string {
  let id = base
  for (let k = 2; taken.has(id); k++) id = `${base}#${k}`
  return id
}

/**
 * Copy of `el` with `key` set. Dotted keys reach nested objects ('rating.maxP', 'wave.freq'),
 * copying each level on the way and creating missing ones. Never mutates `el`.
 */
export function setElementKey(el: Element, key: string, value: unknown): Element {
  const path = key.split('.')
  const write = (obj: Record<string, unknown> | undefined, i: number): Record<string, unknown> => {
    const copy: Record<string, unknown> = { ...(obj ?? {}) }
    const k = path[i]
    copy[k] = i === path.length - 1 ? value : write(copy[k] as Record<string, unknown> | undefined, i + 1)
    return copy
  }
  return write(el as unknown as Record<string, unknown>, 0) as unknown as Element
}

/** apply patches in order; never mutates the input */
export function applyPatches(netlist: Netlist, patches: readonly FailurePatch[]): Netlist {
  let els: Element[] = netlist.elements.slice()
  for (const p of patches) {
    switch (p.op) {
      case 'remove':
        els = els.filter((e) => e.id !== p.elementId)
        break
      case 'set':
        els = els.map((e) => (e.id === p.elementId ? setElementKey(e, p.key, p.value) : e))
        break
      case 'short': {
        const id = uniqueId(`short:${p.a}-${p.b}`, new Set(els.map((e) => e.id)))
        els.push({ id, type: 'R', nodes: [p.a, p.b], value: SHORT_R })
        break
      }
      case 'add':
        els.push({ ...p.element, nodes: [...p.element.nodes] } as Element)
        break
    }
  }
  return { ...netlist, elements: els }
}

/** the two nodes a failed part opens or shorts */
function failureNodes(el: Element): [NodeId, NodeId] {
  switch (el.type) {
    case 'NPN':
    case 'PNP':
    case 'NMOS':
    case 'PMOS':
      return [el.nodes[0], el.nodes[2]] // C-E / D-S
    case 'OPAMP':
      return [el.nodes[2], '0'] // out-GND
    case 'LOGIC':
      return [el.nodes[el.nodes.length - 1], '0'] // out-GND
    case 'POT':
    case 'REG':
      return [el.nodes[0], el.nodes[2]] // track end to end / in-out
    default:
      return [el.nodes[0], el.nodes[1]] // XFMR: primary
  }
}

/**
 * Apply a BurnEvent to the netlist:
 * - 'thermal-shutdown' / 'thermal-recover' set `disabled` true / false on the part;
 * - 'blown' sets `blown: true` on a fuse;
 * - anything else replaces the part by its failure: 'open' (default) -> 1 GΩ, 'short' ->
 *   0.01 Ω ('reverse-voltage' always shorts), keeping its id and partId (so the 3D part can
 *   render as burnt) and dropping its rating.
 */
export function applyBurn(netlist: Netlist, burn: BurnEvent): Netlist {
  const elements = netlist.elements.map((el): Element => {
    if (el.id !== burn.elementId) return el
    if (burn.reason === 'thermal-shutdown' || burn.reason === 'thermal-recover')
      return { ...el, disabled: burn.reason === 'thermal-shutdown' }
    if (burn.reason === 'blown' && el.type === 'FUSE') return { ...el, blown: true }
    const mode = burn.reason === 'reverse-voltage' ? 'short' : (effectiveRating(el)?.failMode ?? 'open')
    const replacement: Element = {
      id: el.id,
      type: 'R',
      nodes: failureNodes(el),
      value: mode === 'short' ? SHORT_R : OPEN_R,
    }
    if (el.partId !== undefined) replacement.partId = el.partId
    return replacement
  })
  return { ...netlist, elements }
}
