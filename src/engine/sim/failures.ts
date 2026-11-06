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

/** apply patches in order; never mutates the input */
export function applyPatches(netlist: Netlist, patches: readonly FailurePatch[]): Netlist {
  let els: Element[] = netlist.elements.slice()
  for (const p of patches) {
    switch (p.op) {
      case 'remove':
        els = els.filter((e) => e.id !== p.elementId)
        break
      case 'set':
        els = els.map((e) => (e.id === p.elementId ? ({ ...e, [p.key]: p.value } as Element) : e))
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

/** the two nodes a failed part opens or shorts: C-E / D-S for transistors, out-GND for op-amps */
function failureNodes(el: Element): [NodeId, NodeId] {
  switch (el.type) {
    case 'NPN':
    case 'PNP':
    case 'NMOS':
    case 'PMOS':
      return [el.nodes[0], el.nodes[2]]
    case 'OPAMP':
      return [el.nodes[2], '0']
    default:
      return [el.nodes[0], el.nodes[1]]
  }
}

/**
 * Replace a burnt element by its failure: 'open' (default) -> 1 GΩ, 'short' -> 0.01 Ω,
 * keeping its id and partId (so the 3D part can render as burnt) and dropping its rating.
 */
export function applyBurn(netlist: Netlist, burn: BurnEvent): Netlist {
  const elements = netlist.elements.map((el): Element => {
    if (el.id !== burn.elementId) return el
    const mode = effectiveRating(el)?.failMode ?? 'open'
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
