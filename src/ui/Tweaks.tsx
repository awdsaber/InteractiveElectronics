import type { Tweak } from '../engine/types'
import { siLabel, sliderToValue, valueToSlider } from './format'

export interface TweaksProps {
  tweaks: Tweak[]
  /** current value per tweak, keyed `${elementId}.${key}` */
  values: Record<string, number>
  onTweak: (tweak: Tweak, value: number) => void
}

export const tweakKey = (t: Tweak): string => `${t.elementId}.${t.key}`

export function Tweaks({ tweaks, values, onTweak }: TweaksProps) {
  return (
    <section className="note" aria-labelledby="tweak-h">
      <h2 id="tweak-h" className="note-head">
        <span>B</span> Tweak it
      </h2>
      <div className="tweaks">
        {tweaks.map((t) => {
          const v = values[tweakKey(t)] ?? t.min
          const pos = valueToSlider(v, t.min, t.max, t.log)
          return (
            <label className="tweak" key={tweakKey(t)}>
              <span className="tweak-top">
                <span>{t.label}</span>
                <output>{siLabel(v, t.unit)}</output>
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.001}
                value={pos}
                aria-valuetext={siLabel(v, t.unit)}
                style={{ ['--fill' as string]: `${pos * 100}%` }}
                onChange={(e) => onTweak(t, sliderToValue(Number(e.target.value), t.min, t.max, t.log, t.step))}
              />
              <span className="tweak-range">
                <span>{siLabel(t.min, t.unit)}</span>
                <span>{t.log ? 'log scale' : 'linear'}</span>
                <span>{siLabel(t.max, t.unit)}</span>
              </span>
            </label>
          )
        })}
      </div>
    </section>
  )
}
