import { PALETTES } from './types'
import type { PaletteId, Settings } from './types'

export type SettingChange =
  | { key: 'wobble'; value: number }
  | { key: 'palette'; value: PaletteId }
  | { key: 'labels' | 'lofi' | 'effects'; value: boolean }

export interface ControlsProps {
  settings: Settings
  onSetting: (change: SettingChange) => void
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} className="toggle" onClick={() => onChange(!on)}>
      <span className="track" aria-hidden="true">
        <span className="knob" />
      </span>
      {label}
    </button>
  )
}

export function Controls({ settings, onSetting }: ControlsProps) {
  return (
    <div className="controls" role="group" aria-label="Bench controls">
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
