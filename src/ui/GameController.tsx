// The "Game controller" instrument tab: what the computer receives from a USB HID game controller
// (a `usb-hid` behavior instance's HidView): one bar per axis with its raw count, the buttons as
// lamps (a ghost, reported with no switch closed, is marked), the report descriptor in words and
// the last input report's bytes. Generic: any lesson with `instruments.hid` gets it.

import { useEffect, useState } from 'react'
import type { HidView } from '../engine/behaviors/usb-hid'
import type { Bench } from '../engine/bench/simLoop'

export interface GameControllerProps {
  bench: () => Bench
  /** the usb-hid behavior instance */
  instance: string
  /** the tab is showing (poll only then) */
  active: boolean
}

const hex = (b: number) => b.toString(16).toUpperCase().padStart(2, '0')

export function GameController({ bench, instance, active }: GameControllerProps) {
  const [view, setView] = useState<HidView | undefined>(() => bench().behaviorData(instance) as HidView | undefined)
  useEffect(() => {
    if (!active) return
    const read = () => setView(bench().behaviorData(instance) as HidView | undefined)
    read()
    const id = setInterval(read, 80)
    return () => clearInterval(id)
  }, [bench, instance, active])

  if (!view) return <p className="muted">No USB HID device on this bench.</p>
  const ghosts = view.buttons.filter((b) => b.ghost).length
  return (
    <>
      <div className="inst-screen hid-screen">
        <div className="hid-head">
          <span className="hid-dot" data-on={view.connected || undefined} aria-hidden="true" />
          <strong>{view.name}</strong>
          <span className="hid-sub">{view.connected ? `connected · ${Math.round(view.reportHz)} reports/s` : 'not connected: plug USB'}</span>
        </div>
        <div className="hid-axes" role="list" aria-label="Axes">
          {view.axes.map((a) => (
            <div className="hid-axis" role="listitem" key={a.label}>
              <span className="hid-axis-name">
                {a.label} <em>{a.usage}</em>
              </span>
              <span className="hid-bar" role="meter" aria-label={`${a.label} raw`} aria-valuemin={0} aria-valuemax={a.max} aria-valuenow={a.raw}>
                <span className="hid-fill" style={{ width: `${view.connected ? (a.raw / a.max) * 100 : 0}%` }} />
                <span className="hid-game" style={{ left: `${view.connected ? a.game : 0}%` }} title="after the deadzone (what the game uses)" />
              </span>
              <span className="hid-num">
                {view.connected ? a.raw : '—'}
                <small> / {a.max}</small>
              </span>
              <span className="hid-num hid-v">{view.connected ? `${a.volts.toFixed(3)} V` : ''}</span>
            </div>
          ))}
        </div>
        <div className="hid-buttons" role="list" aria-label="Buttons">
          {view.buttons.map((b) => (
            <span
              key={b.n}
              role="listitem"
              className="hid-btn"
              data-on={b.on || undefined}
              data-ghost={b.ghost || undefined}
              title={b.ghost ? 'reported, but no switch for it is closed: a ghost' : b.label || `button ${b.n}`}
            >
              <b>{b.n}</b>
              {b.label ? <small>{b.label}</small> : null}
            </span>
          ))}
        </div>
        <p className="inst-stats" aria-live="polite">
          {ghosts > 0 ? `Ghost: ${view.buttons.filter((b) => b.ghost).map((b) => `button ${b.n}`).join(', ')} reported with no switch closed.` : `Encoder steps: ${view.encSteps}`}
        </p>
      </div>
      <div className="inst-controls hid-side">
        <fieldset className="inst-ch">
          <legend>Report descriptor</legend>
          <ul className="hid-desc">
            {view.descriptor.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </fieldset>
        <fieldset className="inst-ch">
          <legend>Last input report (illustrative layout)</legend>
          <code className="hid-bytes">{view.connected ? view.report.map(hex).join(' ') : '—'}</code>
          <span className="hid-sub">report #{view.reports}</span>
        </fieldset>
      </div>
    </>
  )
}
