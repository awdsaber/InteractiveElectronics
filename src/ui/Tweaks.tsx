import { useRef } from 'react'
import { isOn, momentaryValues } from '../engine/bench/tweaks'
import type { Tweak } from '../engine/types'
import { siLabel, sliderToValue, valueToSlider } from './format'

export interface TweaksProps {
  tweaks: Tweak[]
  /** current value per tweak, keyed `${elementId}.${key}` */
  values: Record<string, number>
  /** the lesson's starting values (a momentary button rests at its own) */
  defaults?: Record<string, number>
  onTweak: (tweak: Tweak, value: number) => void
}

export const tweakKey = (t: Tweak): string => `${t.elementId}.${t.key}`

function Slider({ t, v, onTweak }: { t: Tweak; v: number; onTweak: TweaksProps['onTweak'] }) {
  const pos = valueToSlider(v, t.min, t.max, t.log)
  return (
    <label className="tweak">
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
}

function ToggleTweak({ t, v, onTweak }: { t: Tweak; v: number; onTweak: TweaksProps['onTweak'] }) {
  const on = isOn(t, v)
  return (
    <div className="tweak tweak-row">
      <span className="tweak-top">
        <span>{t.label}</span>
      </span>
      <button type="button" role="switch" aria-checked={on} className="toggle" onClick={() => onTweak(t, on ? t.min : t.max)}>
        <span className="switch-track" aria-hidden="true">
          <span className="knob" />
        </span>
        {on ? 'on' : 'off'}
      </button>
    </div>
  )
}

function EnumTweak({ t, v, onTweak }: { t: Tweak; v: number; onTweak: TweaksProps['onTweak'] }) {
  return (
    <div className="tweak">
      <span className="tweak-top">
        <span>{t.label}</span>
        <output>{t.options?.find((o) => o.value === v)?.label ?? siLabel(v, t.unit)}</output>
      </span>
      <div className="seg" role="radiogroup" aria-label={t.label}>
        {t.options?.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={o.value === v} onClick={() => onTweak(t, o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** press and hold: pointer (captured, so sliding off doesn't drop it) or Space / Enter */
function MomentaryTweak({ t, v, rest, onTweak }: { t: Tweak; v: number; rest: number; onTweak: TweaksProps['onTweak'] }) {
  const { held } = momentaryValues(t, rest)
  const down = useRef(false)
  const press = () => {
    if (down.current) return
    down.current = true
    onTweak(t, held)
  }
  const release = () => {
    if (!down.current) return
    down.current = false
    onTweak(t, rest)
  }
  const pressed = v === held && v !== rest
  return (
    <div className="tweak tweak-row">
      <span className="tweak-top">
        <span>{t.label}</span>
      </span>
      <button
        type="button"
        className="momentary"
        aria-pressed={pressed}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture?.(e.pointerId)
          press()
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={release}
        onKeyDown={(e) => {
          if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
            e.preventDefault()
            press()
          }
        }}
        onKeyUp={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault()
            release()
          }
        }}
        onBlur={release}
        onContextMenu={(e) => e.preventDefault()}
      >
        {pressed ? 'held…' : 'press & hold'}
      </button>
    </div>
  )
}

export function Tweaks({ tweaks, values, defaults, onTweak }: TweaksProps) {
  return (
    <section className="note" aria-labelledby="tweak-h">
      <h2 id="tweak-h" className="note-head">
        <span>B</span> Tweak it
      </h2>
      <div className="tweaks">
        {tweaks.map((t) => {
          const k = tweakKey(t)
          const v = values[k] ?? t.min
          switch (t.kind) {
            case 'toggle':
              return <ToggleTweak key={k} t={t} v={v} onTweak={onTweak} />
            case 'enum':
              return <EnumTweak key={k} t={t} v={v} onTweak={onTweak} />
            case 'momentary':
              return <MomentaryTweak key={k} t={t} v={v} rest={defaults?.[k] ?? t.min} onTweak={onTweak} />
            default:
              return <Slider key={k} t={t} v={v} onTweak={onTweak} />
          }
        })}
      </div>
    </section>
  )
}
