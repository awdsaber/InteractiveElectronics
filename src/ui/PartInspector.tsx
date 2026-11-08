// The part inspector card: docked on the right of the bench on desktop, a bottom sheet on
// phones. A close-up render of the part, its role, the colour-band decode for resistors, live
// values and rating use of its circuit elements, and datasheet facts when the lesson has them.

import { Suspense, lazy, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import type { BenchSnapshot } from '../engine/bench/simLoop'
import type { Lesson, PartKind, PartPlacement } from '../engine/types'
import { bandHex, inspectPart, resistorDecode } from './inspector'

const PartCloseup = lazy(() => import('../three/PartCloseup'))

const KIND_NAME: Partial<Record<PartKind, string>> = {
  resistor: 'Resistor (through-hole)',
  'resistor-smd': 'Resistor (SMD)',
  'capacitor-ceramic': 'Ceramic capacitor',
  'capacitor-smd': 'Capacitor (SMD)',
  'capacitor-electrolytic': 'Electrolytic capacitor',
  'led-smd': 'LED (SMD)',
  led: 'LED',
  'transistor-to92': 'Transistor (TO-92)',
  'mosfet-to220': 'MOSFET (TO-220)',
  'regulator-to220': 'Regulator (TO-220)',
  'ic-dip': 'IC (DIP)',
  'ic-smd': 'IC (SMD)',
  'logic-ic-label': 'Logic IC',
  'usb-b': 'USB-B connector',
  'usb-c': 'USB-C connector',
  'micro-usb': 'Micro-USB connector',
  'battery-aa-pack': 'AA battery pack',
  'battery-9v': '9 V battery',
  'battery-lipo': 'LiPo cell',
  'dc-motor': 'DC motor',
  'stepper-nema17': 'Stepper motor (NEMA 17)',
  'wifi-module': 'Wi-Fi module',
  oled: 'OLED display',
  'sensor-ultrasonic': 'Ultrasonic sensor',
}

export const kindName = (k: PartKind): string => KIND_NAME[k] ?? k.charAt(0).toUpperCase() + k.slice(1).replace(/-/g, ' ')

const PHONE = '(max-width: 760px)'
function subscribeMedia(fn: () => void): () => void {
  try {
    const m = window.matchMedia(PHONE)
    m.addEventListener('change', fn)
    return () => m.removeEventListener('change', fn)
  } catch {
    return () => {}
  }
}
const phoneNow = () => {
  try {
    return window.matchMedia(PHONE).matches
  } catch {
    return false
  }
}
const reducedMotion = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

export interface PartInspectorProps {
  lesson: Lesson
  part: PartPlacement
  snap: BenchSnapshot
  onClose: () => void
  onZoom: () => void
  onResetView: () => void
}

export function PartInspector({ lesson, part, snap, onClose, onZoom, onResetView }: PartInspectorProps) {
  const titleId = useId()
  const phone = useSyncExternalStore(subscribeMedia, phoneNow, () => false)
  const [spin, setSpin] = useState(() => !reducedMotion())
  const card = useRef<HTMLElement>(null)
  const opener = useRef<Element | null>(null)

  // focus comes into the card when it opens (or shows another part) and goes back on close
  useEffect(() => {
    if (!opener.current) opener.current = document.activeElement
    card.current?.querySelector<HTMLElement>('.inspector-title')?.focus({ preventScroll: true })
  }, [part.id])
  useEffect(
    () => () => {
      const el = opener.current as HTMLElement | null
      if (el && el.isConnected && typeof el.focus === 'function') el.focus({ preventScroll: true })
    },
    [],
  )
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close.current()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const info = inspectPart(lesson, part, snap)
  const decode = resistorDecode(part.kind === 'resistor' && part.circuitIds?.[0] ? { ...part, params: { ...part.params, ohms: snap.elementValues[`${part.circuitIds[0]}.value`] ?? part.params?.ohms } } : part)
  const burnt = !!snap.partBurnt[part.id]
  const title = part.label ?? part.id.toUpperCase()
  const multi = info.elements.length > 1

  return (
    <aside ref={card} className="inspector" data-dock={phone ? 'sheet' : 'side'} role="dialog" aria-modal="false" aria-labelledby={titleId}>
      <header className="inspector-head">
        <div>
          <p className="eyebrow">
            {part.id.toUpperCase()} · {kindName(part.kind)}
          </p>
          <h2 id={titleId} className="inspector-title" tabIndex={-1}>
            {title}
            {burnt && <span className="inspector-burnt">burnt</span>}
          </h2>
        </div>
        <button type="button" className="inspector-close" onClick={onClose} aria-label="Close the part inspector">
          ×
        </button>
      </header>

      <div className="inspector-view">
        <Suspense fallback={null}>
          <PartCloseup lesson={lesson} part={part} snap={snap} spin={spin} />
        </Suspense>
        <button type="button" className="inspector-spin" onClick={() => setSpin((s) => !s)} aria-pressed={spin}>
          {spin ? 'pause' : 'turn'}
        </button>
      </div>

      <p className="inspector-role">{part.role}</p>

      {decode && (
        <section className="inspector-sec" aria-label="Colour code">
          <h3>Colour code</h3>
          <div className="bands" aria-hidden="true">
            {decode.bands.map((b, i) => (
              <span key={i} className="band" style={{ background: bandHex(b) }} title={b} data-last={i === decode.bands.length - 1 || undefined} />
            ))}
          </div>
          <p className="band-decode">{decode.text}</p>
        </section>
      )}

      {info.elements.length > 0 && (
        <section className="inspector-sec" aria-label="Live values">
          <h3>Live {!snap.powered && <span className="muted">(not powered)</span>}</h3>
          {info.elements.map((e) => (
            <div key={e.id} className="inspector-el">
              {multi && <p className="inspector-el-id">{e.id}</p>}
              {e.live.length > 0 ? (
                <dl className="inspector-live">
                  {e.live.map((r) => (
                    <div key={r.label}>
                      <dt>{r.label}</dt>
                      <dd>{r.text}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="muted">no reading</p>
              )}
              {e.ratings.length > 0 && (
                <ul className="inspector-ratings" aria-label={`${e.id} ratings`}>
                  {e.ratings.map((r) => (
                    <li key={r.label} data-tone={r.tone}>
                      <span className="rating-text">{r.text}</span>
                      <span className="rating-bar" aria-hidden="true">
                        <i style={{ width: `${Math.min(100, r.pct)}%` }} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      )}

      {part.facts?.length ? (
        <section className="inspector-sec" aria-label="Datasheet facts">
          <h3>Datasheet</h3>
          <ul className="inspector-facts">
            {part.facts.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="inspector-actions">
        <button type="button" className="pill" onClick={onZoom}>
          Zoom to part
        </button>
        <button type="button" className="pill" onClick={onResetView}>
          Reset view
        </button>
      </div>
    </aside>
  )
}
