// Shared wrapper for every registered part: placement (pos, rot, exploded
// lift), visibility, burnt tint + smoke, solder fillets from the footprint,
// and the callout tag.

import { useMemo, type ComponentType } from 'react'
import type { PartPlacement } from '../../engine/types'
import { Bake } from '../bake'
import { Callout } from '../Callout'
import { G, geo, mergedBoxes } from '../geometry'
import { InkContext, InkInstances, type InkInstance } from '../ink'
import { C } from '../palette'
import { Smoke } from '../Smoke'
import { footprint } from './footprints'
import { partPosition, type PartComponent, type PartProps, type PartRenderState } from './types'

export interface PartMeta {
  /** approximate top of the part (callout anchor, smoke origin) */
  height: number | ((part: PartPlacement) => number)
  /**
   * Discrete live state that changes baked geometry (button pressed, switch
   * position). Continuous values (servo angle, pot, readings) must not go
   * here: they live on unbaked (`noBake`) or textured meshes.
   */
  bakeValue?: (state: PartRenderState) => unknown
}

/**
 * Key that triggers a rebake of a part's merged geometry. Pure; only static
 * look plus discrete states belong in it, so live values never rebake.
 */
export function partBakeKey(part: PartPlacement, state: PartRenderState, meta: Pick<PartMeta, 'bakeValue'>): string {
  return JSON.stringify([
    part.kind,
    part.mount,
    part.color,
    part.params,
    state.burnt,
    state.soldered,
    state.glow > 0.01,
    meta.bakeValue ? meta.bakeValue(state) : null,
  ])
}

const filletWedge = () =>
  geo('fillet-wedge', () =>
    // a low ramp: tall at the part end (−x), thin at the pad's outer edge (+x)
    mergedBoxes([
      [-0.25, 0.35, 0, 0.5, 0.7, 1],
      [0.25, 0.15, 0, 0.5, 0.3, 1],
    ]),
  )

/** Solder fillets: cones on THT pads, low ramps on SMD pads. */
export function SolderJoints({ part }: { part: PartPlacement }) {
  const { cones, ramps } = useMemo(() => {
    const fp = footprint(part)
    const c: InkInstance[] = []
    const r: InkInstance[] = []
    for (const pad of fp.pads) {
      if (pad.smd) {
        const [ox, oz] = pad.out ?? [Math.sign(pad.x) || 1, 0]
        const alongX = Math.abs(ox) >= Math.abs(oz)
        const len = (alongX ? pad.w : pad.d) * 0.75
        const wid = (alongX ? pad.d : pad.w) * 0.85
        const ry = alongX ? (ox >= 0 ? 0 : Math.PI) : oz >= 0 ? -Math.PI / 2 : Math.PI / 2
        r.push({ p: [pad.x + ox * len * 0.25, 0.001, pad.z + oz * len * 0.25], r: [0, ry, 0], s: [len, 0.045, wid] })
      } else {
        const rad = Math.min(pad.w, pad.d) * 0.48
        c.push({ p: [pad.x, 0.0375, pad.z], s: [rad, 0.075, rad] })
      }
    }
    return { cones: c, ramps: r }
  }, [part])
  return (
    <>
      {cones.length > 0 && (
        <InkInstances geometry={G.cone(0.32, 10)} items={cones} color={C.tin} outline={1} noChar />
      )}
      {ramps.length > 0 && <InkInstances geometry={filletWedge()} items={ramps} color={C.tin} outline={1} noChar />}
    </>
  )
}

/** Wrap a body component with the standard part frame. */
export function definePart(Body: ComponentType<PartProps>, meta: PartMeta): PartComponent {
  function Part({ part, state }: PartProps) {
    if (!state.visible) return null
    const [x, y, z] = partPosition(part)
    const h = typeof meta.height === 'function' ? meta.height(part) : meta.height
    const rot = ((part.rot ?? 0) * Math.PI) / 180
    // Anything that changes static geometry or colour must be in the key.
    const bakeKey = partBakeKey(part, state, meta)
    return (
      <group position={[x, y + state.explodedOffset, z]} userData={{ partId: part.id, kind: part.kind }}>
        <group rotation={[0, rot, 0]}>
          <Bake bakeKey={bakeKey}>
            <InkContext.Provider value={{ burnt: state.burnt }}>
              <Body part={part} state={state} />
            </InkContext.Provider>
            {state.soldered && <SolderJoints part={part} />}
          </Bake>
        </group>
        {state.burnt && <Smoke position={[0, h, 0]} scale={Math.min(2, 0.6 + h * 0.5)} />}
        {state.showLabel && part.label && <Callout text={part.label} anchor={[0, h, 0]} tone={state.burnt ? 'warn' : 'ink'} />}
      </group>
    )
  }
  Part.displayName = `Part(${Body.displayName ?? Body.name})`
  metas.set(Part, meta)
  return Part
}

const metas = new WeakMap<PartComponent, PartMeta>()

/** The rebake key a registered part component would use (for tests and tools). */
export function bakeKeyOf(comp: PartComponent, part: PartPlacement, state: PartRenderState): string {
  return partBakeKey(part, state, metas.get(comp) ?? {})
}
