import { RadioSeg } from './RadioSeg'
import { PALETTES } from './types'
import type { PaletteId, Settings } from './types'

export type SettingChange =
  | { key: 'wobble'; value: number }
  | { key: 'palette'; value: PaletteId }
  | { key: 'labels' | 'lofi' | 'effects'; value: boolean }

export interface ControlsProps {
  settings: Settings
  onSetting: (change: SettingChange) => void
  /** sim speed: requested, achieved, and whether the per-frame step cap is holding it back */
  sim?: { speed: number; rate: number; capped: boolean; onSpeed: (x: number) => void }
  instruments?: { open: boolean; onToggle: (open: boolean) => void }
}

const SPEEDS = [0.01, 0.1, 1, 10, 100]
const speedLabel = (x: number) => `×${x}`

/** what the speed control says beside the buttons (empty while the sim keeps up) */
function speedNote(speed: number, rate: number, capped: boolean): string {
  if (!capped) return ''
  // slow motion is meant to be slower than real time: there, say how far below the request it is
  if (rate < 1 && speed >= 1) return `running slower than real time (×${Number(rate.toPrecision(2))})`
  return `capped at ×${Number(rate.toPrecision(2))} of ×${speed}`
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} className="toggle" onClick={() => onChange(!on)}>
      <span className="switch-track" aria-hidden="true">
        <span className="knob" />
      </span>
      {label}
    </button>
  )
}

export function Controls({ settings, onSetting, sim, instruments }: ControlsProps) {
  const note = sim ? speedNote(sim.speed, sim.rate, sim.capped) : ''
  return (
    <div className="controls" role="group" aria-label="Bench controls">
      {sim && (
        <div className="ctl speed">
          <span className="ctl-label">Sim speed</span>
          <RadioSeg label="Sim speed" options={SPEEDS.map((x) => ({ value: x, label: speedLabel(x) }))} value={sim.speed} onChange={sim.onSpeed} />
          {note && (
            <span className="speed-note" role="status">
              {note}
            </span>
          )}
        </div>
      )}
      {instruments && <Toggle label="Instruments" on={instruments.open} onChange={instruments.onToggle} />}
      <label className="ctl">
        <span className="ctl-label">Ink wobble</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={settings.wobble}
          onChange={(e) => onSetting({ key: 'wobble', value: Number(e.target.value) })}
          style={{ ['--fill' as string]: `${settings.wobble * 100}%` }}
        />
        <output>{settings.wobble.toFixed(2)}</output>
      </label>
      <div className="ctl">
        <span className="ctl-label">Palette</span>
        <div className="swatches" role="radiogroup" aria-label="PCB colour">
          {PALETTES.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={settings.palette === p.id}
              aria-label={p.label}
              title={p.label}
              className="swatch"
              style={{ background: p.color }}
              onClick={() => onSetting({ key: 'palette', value: p.id })}
            />
          ))}
        </div>
      </div>
      <Toggle label="Labels" on={settings.labels} onChange={(v) => onSetting({ key: 'labels', value: v })} />
      <div className="ctl sound">
        <span className="ctl-label">Sound</span>
        <Toggle label="Lo-fi loop" on={settings.lofi} onChange={(v) => onSetting({ key: 'lofi', value: v })} />
        <Toggle label="Effects" on={settings.effects} onChange={(v) => onSetting({ key: 'effects', value: v })} />
      </div>
    </div>
  )
}
