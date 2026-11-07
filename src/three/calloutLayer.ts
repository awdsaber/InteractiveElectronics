// The callout layer: one store per canvas that every <Callout> registers its tag with.
// A single DOM overlay (<CalloutHost>, outside the r3f tree) draws the tags, and each
// Callout writes its projected screen position here every frame. Pure TS, no React.
//
// Why not drei <Html> per tag: each <Html> creates its own React root and recreates it
// when its target element changes. r3f connects its event source right after the first
// commit, so every <Html> re-ran its effect inside a render, unmounted its root
// synchronously ("Attempted to synchronously unmount a root while React was already
// rendering") and mounted a new root on the same element; the deferred unmount then
// wiped the first tag. One stable overlay has no nested roots, so no race.

export type CalloutTone = 'ink' | 'accent' | 'warn' | 'ok'

export interface CalloutEntry {
  id: string
  text: string
  tone: CalloutTone
  hidden: boolean
}

export interface CalloutPlacement {
  /** px from the canvas' top-left corner */
  x: number
  y: number
  /** on screen and every ancestor visible */
  visible: boolean
  /** stacking order, larger is nearer the camera */
  z: number
}

export interface CalloutLayer {
  /** add or update a tag; listeners fire only when something changed */
  set(entry: CalloutEntry): void
  remove(id: string): void
  /** registered tags in registration order (stable reference between changes) */
  list(): readonly CalloutEntry[]
  subscribe(fn: () => void): () => void
  /** the overlay hands over (or drops) the element that draws a tag */
  bind(id: string, el: HTMLElement | null): void
  /** a Callout reports where its tag is on screen */
  place(id: string, p: CalloutPlacement): void
  placement(id: string): CalloutPlacement | undefined
}

function apply(el: HTMLElement, p: CalloutPlacement | undefined): void {
  if (!p) {
    el.style.visibility = 'hidden'
    return
  }
  el.style.transform = `translate3d(${p.x}px,${p.y}px,0) translate(-50%,-50%)`
  el.style.visibility = p.visible ? 'visible' : 'hidden'
  el.style.zIndex = String(p.z)
}

const same = (a: CalloutPlacement | undefined, b: CalloutPlacement) =>
  !!a && a.visible === b.visible && a.z === b.z && Math.abs(a.x - b.x) < 0.05 && Math.abs(a.y - b.y) < 0.05

export function createCalloutLayer(): CalloutLayer {
  const entries = new Map<string, CalloutEntry>()
  const listeners = new Set<() => void>()
  const els = new Map<string, HTMLElement>()
  const places = new Map<string, CalloutPlacement>()
  let snapshot: readonly CalloutEntry[] = []
  const changed = () => {
    snapshot = [...entries.values()]
    for (const fn of [...listeners]) fn()
  }
  return {
    set(entry) {
      const cur = entries.get(entry.id)
      if (cur && cur.text === entry.text && cur.tone === entry.tone && cur.hidden === entry.hidden) return
      entries.set(entry.id, { ...entry })
      changed()
    },
    remove(id) {
      places.delete(id)
      if (entries.delete(id)) changed()
    },
    list: () => snapshot,
    subscribe(fn) {
      listeners.add(fn)
      return () => {
        listeners.delete(fn)
      }
    },
    bind(id, el) {
      if (!el) {
        els.delete(id)
        return
      }
      els.set(id, el)
      apply(el, places.get(id))
    },
    place(id, p) {
      if (same(places.get(id), p)) return
      places.set(id, p)
      const el = els.get(id)
      if (el) apply(el, p)
    },
    placement: (id) => places.get(id),
  }
}
