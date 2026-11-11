// The PCB layer model (pure): which manufacturing layers a two-layer board is made of, the file
// each one becomes, and where each sheet sits in the 3D tour (assembled or peeled apart).

export type PcbLayerId = 'bottom-copper' | 'core' | 'top-copper' | 'mask' | 'silk' | 'drill'
export type TourView = 'all' | PcbLayerId

export interface PcbLayerInfo {
  id: PcbLayerId
  label: string
  /** the fabrication file it ships as (Protel-style Gerber extensions, Excellon for drill) */
  file: string
  note: string
}

/** bottom to top */
export const PCB_STACK: readonly PcbLayerInfo[] = [
  { id: 'bottom-copper', label: 'Bottom copper', file: 'Gerber .GBL', note: 'The ground pour, stitched to the top by vias.' },
  { id: 'core', label: 'FR-4 core', file: 'Outline .GKO', note: 'Woven glass in epoxy: the stiff, insulating substrate. Its outline is the board profile file.' },
  { id: 'top-copper', label: 'Top copper', file: 'Gerber .GTL', note: 'Pads and traces: every connection the schematic asked for.' },
  { id: 'mask', label: 'Solder mask', file: 'Gerber .GTS', note: 'A thin polymer coat with openings only where solder must wet.' },
  { id: 'silk', label: 'Silkscreen', file: 'Gerber .GTO', note: 'Ink: outlines, reference designators, polarity and pin-1 marks.' },
]

export const PCB_LAYERS: readonly PcbLayerInfo[] = [
  ...PCB_STACK,
  { id: 'drill', label: 'Drill', file: 'Excellon .DRL', note: 'Every hole, by tool size: plated through-holes, vias and mounting holes.' },
]

/** `pcb-tour` view param: 0 = the whole stack, then one isolated layer each */
export const TOUR_VIEWS: readonly TourView[] = ['all', ...PCB_LAYERS.map((l) => l.id)]

export function tourView(view: number): TourView {
  if (!Number.isFinite(view)) return 'all'
  const i = Math.min(TOUR_VIEWS.length - 1, Math.max(0, Math.round(view)))
  return TOUR_VIEWS[i]
}

export function layerVisible(view: TourView, id: PcbLayerId): boolean {
  return view === 'all' || view === id
}

/** core thickness (mm) of a two-layer board: finished thickness minus both copper foils (35 µm per oz) */
export function coreThicknessMm(thicknessMm: number, oz: number): number {
  return thicknessMm - 2 * oz * 0.035
}

/** board-unit gap between peeled sheets */
export const PEEL_GAP = 0.4
/** the PCB slab's thickness in board units (1.6 mm) */
const SLAB = 0.16
/** assembled films sit this far apart above the slab (just enough to draw in order) */
const FILM = 0.003

/** y (board units) of a sheet's top face */
export function layerY(id: PcbLayerId, peeled: boolean, view: TourView): number {
  if (view !== 'all') return 0
  const i = PCB_STACK.findIndex((l) => l.id === id)
  if (peeled) return id === 'drill' ? 0 : i * PEEL_GAP
  if (id === 'bottom-copper') return -SLAB - FILM
  if (id === 'core' || id === 'drill') return 0
  return (i - 1) * FILM
}

/** board-unit forward (+z) step between peeled sheets, so each lower sheet shows in front of the next */
export const PEEL_FAN = 0.42

/** z shift (board units) of a sheet: peeled, the lower sheets fan toward the viewer; the top one stays */
export function layerShift(id: PcbLayerId, peeled: boolean, view: TourView): number {
  if (!peeled || view !== 'all') return 0
  const i = id === 'drill' ? 0 : PCB_STACK.findIndex((l) => l.id === id)
  return (PCB_STACK.length - 1 - i) * PEEL_FAN
}

/** extra lift for the parts so they float above a peeled stack */
export function partsLift(peeled: boolean): number {
  return peeled ? (PCB_STACK.length - 1) * PEEL_GAP + 0.5 : 0
}
