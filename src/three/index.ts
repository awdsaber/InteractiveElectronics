// Public API of the 3D layer (Task C). Board.tsx (Task E) composes these.

export { InkMesh, InkInstances, InkLights, InkContext, INK_PX } from './ink'
export type { InkMeshProps, InkInstancesProps, InkInstance, InkLookProps, Vec3 } from './ink'
export {
  WOBBLE_PX,
  setWobbleViewport,
  WobbleClock,
  applyWobble,
  getWobble,
  injectWobble,
  setWobble,
  tickWobble,
  wobbleUniforms,
} from './wobble'
export { IsoCamera, isoPosition, ISO_AZIMUTH_DEG, ISO_ELEVATION_DEG } from './IsoCamera'
export type { IsoCameraProps } from './IsoCamera'
export { Pcb, drawPcbArt } from './Pcb'
export type { PcbProps } from './Pcb'
export { BenchBase } from './BenchBase'
export type { BenchBaseProps } from './BenchBase'
export { Callout, CalloutHost } from './Callout'
export type { CalloutProps, CalloutTone } from './Callout'
export { Smoke } from './Smoke'
export type { SmokeProps } from './Smoke'
export * from './parts'
export { resistorBands, smdCode, capacitorCode, parseOhms, BAND_HEX } from './colorCode'
export type { BandColor } from './colorCode'
export { PCB_SWATCHES, DEFAULT_PCB, INK, PAPER, ACCENT, WARN, OK, LED_LOOK } from './palette'
