// Shared wrapper for every registered part: placement (pos, rot, exploded
// lift), visibility, burnt tint + smoke, solder fillets from the footprint,
// and the callout tag.

import { useMemo, type ComponentType } from 'react'
import type { PartPlacement } from '../../engine/types'
import { Bake } from '../bake'
import { Callout } from '../Callout'
import { G, geo, mergedBoxes } from '../geometry'
import { InkContext, InkInstances, type InkInstance, type Vec3 } from '../ink'
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
    // appended only when set, so every other part's key is unchanged
    ...(state.joint !== undefined ? [state.joint] : []),
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

// hand-soldered joint looks (PartRenderState.joint, from the `solder-joints` behavior)
const DULL_TIN = '#9c9d99' // a cold joint's grainy grey
const CHARRED = '#8a6f4e' // an overheated joint: dull solder under charred flux
const J_COLD = 1
const J_THIN = 2
const J_EXCESS = 3
const J_BRIDGE = 4
const J_HOT = 5
const J_LIFTED = 6

/** `params.jointPads`: the pad indices a joint quality applies to (default: every pad) */
function jointPads(part: PartPlacement): number[] | null {
  const v = part.params?.jointPads
  return Array.isArray(v) && v.every((x) => typeof x === 'number') ? (v as number[]) : null
}

/**
 * Solder fillets: cones on THT pads, low ramps on SMD pads. With a `joint` quality the THT pads it
 * applies to change shape: cold is a dull convex lump, insufficient a thin film, excess a ball,
 * a bridge adds a solder bar to the neighbouring pad, overheated is charred, and a lifted pad
 * stands proud of the board with the copper showing under it.
 */
export function SolderJoints({ part, joint }: { part: PartPlacement; joint?: number }) {
  const { cones, ramps, lumps, dull, charred, copper, bars } = useMemo(() => {
    const fp = footprint(part)
    const c: InkInstance[] = []
    const r: InkInstance[] = []
    const lump: InkInstance[] = []
    const d: InkInstance[] = []
    const ch: InkInstance[] = []
    const cu: InkInstance[] = []
    const bar: InkInstance[] = []
    const only = jointPads(part)
    fp.pads.forEach((pad, i) => {
      const q = joint !== undefined && joint > 0 && !pad.smd && (!only || only.includes(i)) ? joint : 0
      if (q) {
        const rad = Math.min(pad.w, pad.d) * 0.48
        if (q === J_COLD) d.push({ p: [pad.x, 0.005, pad.z], s: [rad * 0.8, 0.14, rad * 0.8] })
        else if (q === J_THIN) c.push({ p: [pad.x, 0.012, pad.z], s: [rad * 0.85, 0.025, rad * 0.85] })
        else if (q === J_EXCESS) lump.push({ p: [pad.x, rad * 0.75, pad.z], s: [rad * 1.05, rad * 0.95, rad * 1.05] })
        else if (q === J_HOT) ch.push({ p: [pad.x, 0.0375, pad.z], s: [rad, 0.075, rad] })
        else if (q === J_LIFTED) {
          cu.push({ p: [pad.x, 0.05, pad.z], r: [0.25, 0, 0.12], s: [rad * 1.15, 0.02, rad * 1.15] })
          d.push({ p: [pad.x, 0.06, pad.z], r: [0.25, 0, 0.12], s: [rad * 0.85, 0.09, rad * 0.85] })
        } else {
          c.push({ p: [pad.x, 0.0375, pad.z], s: [rad, 0.075, rad] })
          if (q === J_BRIDGE) {
            // a solder bar to the nearest other pad
            let best: { x: number; z: number } | null = null
            let bd = Infinity
            fp.pads.forEach((o, k) => {
              const dd = Math.hypot(o.x - pad.x, o.z - pad.z)
              if (k !== i && dd < bd) {
                bd = dd
                best = o
              }
            })
            if (best) {
              const o = best as { x: number; z: number }
              const len = Math.hypot(o.x - pad.x, o.z - pad.z)
              bar.push({
                p: [(o.x + pad.x) / 2, 0.035, (o.z + pad.z) / 2],
                r: [0, -Math.atan2(o.z - pad.z, o.x - pad.x), 0],
                s: [len, 0.06, rad * 0.9],
              })
            }
          }
        }
        return
      }
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
    })
    return { cones: c, ramps: r, lumps: lump, dull: d, charred: ch, copper: cu, bars: bar }
  }, [part, joint])
  return (
    <>
      {cones.length > 0 && (
        <InkInstances geometry={G.cone(0.32, 10)} items={cones} color={C.tin} outline={1} noChar />
      )}
      {ramps.length > 0 && <InkInstances geometry={filletWedge()} items={ramps} color={C.tin} outline={1} noChar />}
      {lumps.length > 0 && <InkInstances geometry={G.sphere(12, 8)} items={lumps} color={C.tin} outline={1} noChar />}
      {dull.length > 0 && <InkInstances geometry={G.dome(12, 5)} items={dull} color={DULL_TIN} outline={1} noChar />}
      {charred.length > 0 && <InkInstances geometry={G.cone(0.32, 10)} items={charred} color={CHARRED} outline={1} noChar />}
      {copper.length > 0 && <InkInstances geometry={G.cyl(14)} items={copper} color={C.copper} outline={1} noChar />}
      {bars.length > 0 && <InkInstances geometry={G.box()} items={bars} color={C.tin} outline={1} noChar />}
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
            {state.soldered && <SolderJoints part={part} joint={state.joint} />}
          </Bake>
        </group>
        {state.burnt && <Smoke position={[0, h, 0]} scale={Math.min(2, 0.6 + h * 0.5)} />}
        {state.showLabel && part.label && (
          <Callout text={part.label} anchor={[0, h, 0]} offset={calloutOffset(part)} tone={state.burnt ? 'warn' : 'ink'} />
        )}
      </group>
    )
  }
  Part.displayName = `Part(${Body.displayName ?? Body.name})`
  metas.set(Part, meta)
  return Part
}

const metas = new WeakMap<PartComponent, PartMeta>()

/** Approximate top of a registered part (callout anchor), in board units above its origin. */
export function partHeight(comp: PartComponent, part: PartPlacement): number {
  const h = metas.get(comp)?.height ?? 0.5
  return typeof h === 'function' ? h(part) : h
}

/** `params.callout`: [x, y, z] label offset (board units at the reference zoom) to untangle crowded labels. */
export function calloutOffset(part: PartPlacement): Vec3 | undefined {
  const c = part.params?.callout
  return Array.isArray(c) && c.length === 3 && c.every((v) => typeof v === 'number') ? (c as Vec3) : undefined
}

/** The rebake key a registered part component would use (for tests and tools). */
export function bakeKeyOf(comp: PartComponent, part: PartPlacement, state: PartRenderState): string {
  return partBakeKey(part, state, metas.get(comp) ?? {})
}
