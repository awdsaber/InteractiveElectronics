import type { BenchStatus } from '../engine/types'
import { MenuButton } from './Menu'
import type { BenchAction, FailureChoice, PartChoice } from './types'

export interface BenchActionsProps {
  status: BenchStatus
  /** parts still to place by hand (THT/module) */
  remainingParts: PartChoice[]
  /** every THT part is on the board (enables Solder) */
  allPlaced: boolean
  /** SMD parts already dropped (disables Pick & place) */
  smdPlaced: boolean
  soldered: boolean
  powered: boolean
  exploded: boolean
  hasSketch: boolean
  /** "Plug USB" (default) or "Connect battery" */
  powerLabel?: string
  /** extra independently switched sources (one button each) */
  extraPower?: { id: string; label: string; on: boolean }[]
  failures: FailureChoice[]
  onAction: (action: BenchAction) => void
  /** a breadboard bench: no PCB, SMD or solder steps, and strip reads "Clear the breadboard" */
  breadboard?: boolean
}

export function BenchActions(p: BenchActionsProps) {
  const label = p.powerLabel ?? 'Plug USB'
  const unplug = label.startsWith('Plug') ? label.replace('Plug', 'Unplug') : label.replace('Connect', 'Disconnect')
  const bare = p.status === 'BARE PCB'
  const fire = (a: BenchAction) => () => p.onAction(a)
  const bb = !!p.breadboard

  return (
    <div className="bench-actions" role="toolbar" aria-label="Bench actions">
      <button type="button" className="pill" data-guide="strip" onClick={fire('strip')} disabled={bare}>
        <span className="num">1</span>
        {bb ? 'Clear the breadboard' : 'Strip to bare PCB'}
      </button>
      {!bb && (
        <button type="button" className="pill" data-guide="pick-place" onClick={fire('pick-place')} disabled={p.smdPlaced}>
          <span className="num">2</span>Pick &amp; place SMD
        </button>
      )}
      <MenuButton
        label={<><span className="num">{bb ? 2 : 3}</span>Place a part</>}
        header={p.remainingParts.length ? { id: 'place-all', label: 'Place all' } : undefined}
        items={p.remainingParts.map((x) => ({ id: x.id, label: x.label }))}
        emptyText="Every part is placed"
        guide="place"
        disabled={p.remainingParts.length === 0}
        onPick={(id) => p.onAction(id === 'place-all' ? 'place-all' : `place:${id}`)}
      />
      {!bb && (
        <button type="button" className="pill" data-guide="solder" onClick={fire('solder')} disabled={p.soldered} title={p.allPlaced ? '' : 'Place every part first'}>
          <span className="num">4</span>Solder joints
        </button>
      )}
      <button type="button" className="pill primary" data-guide="power" data-on={p.powered} onClick={fire('power')} aria-pressed={p.powered}>
        <span className="dot" aria-hidden="true" />
        {p.powered ? unplug : label}
      </button>
      {p.extraPower?.map((x) => (
        <button key={x.id} type="button" className="pill primary" data-on={x.on} onClick={fire(`power:${x.id}`)} aria-pressed={x.on}>
          <span className="dot" aria-hidden="true" />
          {x.on ? x.label.replace(/^Connect/, 'Disconnect').replace(/^Plug/, 'Unplug') : x.label}
        </button>
      ))}
      {p.hasSketch && (
        <button type="button" className="pill" data-guide="upload" onClick={fire('upload')} disabled={!p.powered}>
          Upload sketch
        </button>
      )}
      <button type="button" className="pill" data-guide="explode" data-on={p.exploded} aria-pressed={p.exploded} onClick={fire('explode')}>
        Exploded view
      </button>
      <MenuButton
        label="Break something"
        className="warn"
        guide="break"
        header={{ id: 'repair', label: 'Repair all' }}
        items={p.failures.map((f) => ({ id: f.id, label: f.label, danger: true }))}
        onPick={(id) => p.onAction(id === 'repair' ? 'repair' : `break:${id}`)}
      />
    </div>
  )
}
