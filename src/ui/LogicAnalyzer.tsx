// The logic-analyzer tab: one lane per probed channel (I²C lines drawn with their RC rise), a protocol
// annotation row (bytes in hex and ASCII, START / STOP, ACK / NACK) and the decoded text underneath.
// Data comes from the `logic-analyzer` behavior's capture (Bench.behaviorData), in MCU µs. Live, the
// window follows the newest burst on the decoded bus; dragging pans (and holds), the wheel or the
// − / + buttons zoom.

import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as RPointerEvent, WheelEvent as RWheelEvent } from 'react'
import type { LogicCapture, Protocol } from '../engine/behaviors/logic-analyzer'
import type { Bench } from '../engine/bench/simLoop'
import type { Frame } from '../engine/logic/decode'
import type { Lesson, LogicChannel } from '../engine/types'
import { RadioSeg } from './RadioSeg'
import { DEFAULT_SPAN_US, asciiOf, formatUs, framesText, liveWindow, zoomStep } from './logicView'

export interface LogicAnalyzerProps {
  lesson: Lesson
  bench: () => Bench
  /** the tab is showing (draw only then) */
  active: boolean
}

const PROTOS: readonly { value: Protocol; label: string }[] = [
  { value: 'uart', label: 'UART' },
  { value: 'i2c', label: 'I²C' },
  { value: 'spi', label: 'SPI' },
]

interface Ink {
  card: string
  ink: string
  ink2: string
  ink3: string
  rule: string
  tr: [string, string]
  warn: string
  ok: string
  font: string
}

function readInk(el: Element): Ink {
  const cs = getComputedStyle(el)
  const v = (n: string, f: string) => cs.getPropertyValue(n).trim() || f
  return {
    card: v('--card', '#fbf8f0'),
    ink: v('--ink', '#1d1b17'),
    ink2: v('--ink-2', '#4a463d'),
    ink3: v('--ink-3', '#7d776a'),
    rule: v('--rule', 'rgba(29,27,23,0.14)'),
    tr: [v('--trace-1', '#2b59c3'), v('--trace-2', '#a23b8f')],
    warn: v('--warn', '#c2410c'),
    ok: v('--ok', '#2f7d4f'),
    font: v('--mono', 'monospace'),
  }
}

const capture = (b: Bench) => b.behaviorData('logic-analyzer') as LogicCapture | undefined

const GUTTER = 86
const LANE = 34
const DECODE = 30
const AXIS = 18

interface View {
  t0: number
  t1: number
}

function draw(canvas: HTMLCanvasElement, cap: LogicCapture | undefined, chans: LogicChannel[], proto: Protocol, view: View, frames: Frame[]) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const w = Math.max(1, canvas.clientWidth)
  const h = Math.max(1, canvas.clientHeight)
  const dpr = Math.min(2, globalThis.devicePixelRatio || 1)
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const ink = readInk(canvas)
  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = ink.card
  ctx.fillRect(0, 0, w, h)
  const pw = w - GUTTER - 8
  const span = view.t1 - view.t0
  const X = (t: number) => GUTTER + ((t - view.t0) / span) * pw
  const lanesH = chans.length * LANE
  // time rules: 10 divisions
  ctx.strokeStyle = ink.rule
  ctx.lineWidth = 1
  ctx.setLineDash([2, 4])
  for (let i = 0; i <= 10; i++) {
    const x = GUTTER + (i * pw) / 10
    ctx.beginPath()
    ctx.moveTo(x, 4)
    ctx.lineTo(x, lanesH + DECODE + 4)
    ctx.stroke()
  }
  ctx.setLineDash([])
  ctx.font = `600 10.5px ${ink.font}`
  ctx.textBaseline = 'middle'
  if (!cap) {
    ctx.fillStyle = ink.ink3
    ctx.fillText('No logic analyzer on this bench.', GUTTER, 20)
    return
  }
  chans.forEach((ch, li) => {
    const r = cap.channel(ch)
    const top = 4 + li * LANE
    const yHi = top + 7
    const yLo = top + LANE - 9
    ctx.fillStyle = ink.ink
    ctx.textAlign = 'left'
    ctx.fillText(ch.label, 6, top + LANE / 2 - 5)
    ctx.fillStyle = ink.ink3
    ctx.font = `500 9px ${ink.font}`
    ctx.fillText(ch.pin !== undefined ? `pin ${ch.pin}` : ch.node ?? '', 6, top + LANE / 2 + 7)
    ctx.font = `600 10.5px ${ink.font}`
    ctx.strokeStyle = ink.rule
    ctx.beginPath()
    ctx.moveTo(GUTTER, top + LANE - 1)
    ctx.lineTo(GUTTER + pw, top + LANE - 1)
    ctx.stroke()
    const tr = r.trace
    const color = ink.tr[li % 2]
    ctx.strokeStyle = color
    ctx.lineWidth = 1.6
    ctx.lineJoin = 'round'
    ctx.beginPath()
    let lv = tr.levelAt(view.t0)
    ctx.moveTo(GUTTER, lv ? yHi : yLo)
    const rc = r.riseUs / 1.204 // the RC time constant behind the drawn rise
    const curve = r.riseUs > 0 && (r.riseUs / span) * pw > 3
    let k = tr.lowerBound(view.t0)
    for (let n = 0; k < tr.count && n < 40000; k++, n++) {
      const te = tr.time(k)
      if (te > view.t1) break
      const to = tr.level(k)
      if (to === lv) continue
      const x = X(te)
      if (to === 1 && curve) {
        // released at te − riseUs, reaching V_IH (0.7) at te: draw v = 1 − e^(−t/RC) up to ~3 RC
        const ts = te - r.riseUs
        const next = k + 1 < tr.count ? tr.time(k + 1) : Infinity
        ctx.lineTo(Math.max(GUTTER, X(ts)), yLo)
        for (let j = 1; j <= 24; j++) {
          const t = ts + (j / 24) * 3.5 * rc
          if (t > next || t > view.t1) break
          const v = 1 - Math.exp(-(t - ts) / rc)
          ctx.lineTo(X(t), yLo + (yHi - yLo) * Math.min(1, v / 0.97))
        }
        lv = 1
        continue
      }
      ctx.lineTo(x, lv ? yHi : yLo)
      ctx.lineTo(x, to ? yHi : yLo)
      lv = to
    }
    ctx.lineTo(GUTTER + pw, lv ? yHi : yLo)
    ctx.stroke()
  })
  // annotation row
  const top = 4 + lanesH
  const mid = top + DECODE / 2
  ctx.fillStyle = ink.ink
  ctx.textAlign = 'left'
  ctx.fillText(proto === 'i2c' ? 'I²C' : proto.toUpperCase(), 6, mid)
  for (const f of frames) {
    if (f.t1 < view.t0 || f.t0 > view.t1) continue
    const x0 = Math.max(GUTTER, X(f.t0))
    const x1 = Math.min(GUTTER + pw, X(f.t1))
    const bad = f.error || f.kind === 'nack'
    if (f.kind === 'start' || f.kind === 'restart' || f.kind === 'stop') {
      ctx.fillStyle = f.kind === 'stop' ? ink.ink2 : ink.ok
      ctx.beginPath()
      ctx.arc(X(f.t0), mid, 7, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = ink.card
      ctx.textAlign = 'center'
      ctx.font = `700 9px ${ink.font}`
      ctx.fillText(f.text, X(f.t0), mid + 0.5)
      ctx.font = `600 10.5px ${ink.font}`
      continue
    }
    const wpx = x1 - x0
    if (wpx < 1) continue
    ctx.strokeStyle = bad ? ink.warn : ink.ink
    ctx.fillStyle = bad ? 'rgba(194,65,12,0.12)' : f.kind === 'ack' ? 'rgba(47,125,79,0.12)' : 'rgba(43,89,195,0.10)'
    ctx.lineWidth = 1.2
    const yT = top + 5
    const yB = top + DECODE - 5
    const c = Math.min(5, wpx / 3)
    ctx.beginPath()
    ctx.moveTo(x0, mid)
    ctx.lineTo(x0 + c, yT)
    ctx.lineTo(x1 - c, yT)
    ctx.lineTo(x1, mid)
    ctx.lineTo(x1 - c, yB)
    ctx.lineTo(x0 + c, yB)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    const label = f.text
    const tw = ctx.measureText(label).width
    ctx.fillStyle = bad ? ink.warn : ink.ink
    ctx.textAlign = 'center'
    if (tw + 6 < wpx) ctx.fillText(label, (x0 + x1) / 2, mid + 0.5)
    else if (wpx > 18) {
      const short = f.value !== undefined ? f.value.toString(16).toUpperCase().padStart(2, '0') : f.text.slice(0, 1)
      if (ctx.measureText(short).width + 4 < wpx) ctx.fillText(short, (x0 + x1) / 2, mid + 0.5)
    }
  }
  // time axis
  ctx.fillStyle = ink.ink3
  ctx.font = `500 10px ${ink.font}`
  ctx.textAlign = 'left'
  ctx.fillText(`${formatUs(span / 10)}/div`, GUTTER, top + DECODE + AXIS / 2 + 2)
  ctx.textAlign = 'right'
  ctx.fillText(`t = ${formatUs(view.t1)}`, GUTTER + pw, top + DECODE + AXIS / 2 + 2)
}

export function LogicAnalyzer({ lesson, bench, active }: LogicAnalyzerProps) {
  const cfg = lesson.instruments?.logic
  const chans = useMemo(() => cfg?.channels ?? [], [cfg])
  const [proto, setProto] = useState<Protocol>(cfg?.decode ?? 'uart')
  const [span, setSpan] = useState<number>(cfg?.span !== undefined ? cfg.span * 1e6 : DEFAULT_SPAN_US[cfg?.decode ?? 'uart'])
  const [live, setLive] = useState(true)
  const [held, setHeld] = useState<View | null>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const text = useRef<HTMLParagraphElement>(null)
  const info = useRef<HTMLParagraphElement>(null)
  const view = useRef<View>({ t0: 0, t1: span })
  const st = useRef({ proto, span, live, held, active, dirty: true, sig: '' })
  useEffect(() => {
    st.current = { ...st.current, proto, span, live, held, active, dirty: true }
  }, [proto, span, live, held, active])

  useEffect(() => {
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const s = st.current
      if (!s.active || !canvas.current) return
      const cap = capture(bench())
      let v: View
      if (s.live || !s.held) {
        const now = cap?.now() ?? 0
        const [t0, t1] = liveWindow(cap?.lastActivity(s.proto) ?? -Infinity, now, s.span)
        v = { t0, t1 }
      } else v = s.held
      const sig = `${cap?.gen}|${v.t0.toFixed(3)}|${v.t1.toFixed(3)}|${canvas.current.clientWidth}|${cap ? cap.baud() : 0}`
      if (sig === s.sig && !s.dirty) return
      s.sig = sig
      s.dirty = false
      view.current = v
      const frames = cap ? cap.decode(s.proto, v.t0 - s.span, v.t1) : []
      draw(canvas.current, cap, chans, s.proto, v, frames)
      const inView = frames.filter((f) => f.t1 >= v.t0 && f.t0 <= v.t1)
      if (text.current) {
        const bytes = inView.filter((f) => f.kind === 'byte' || f.kind === 'addr')
        const head = bytes.length ? `${bytes.length} byte${bytes.length === 1 ? '' : 's'}` : 'No frames in view'
        const ascii = s.proto === 'uart' && bytes.length ? `  “${asciiOf(inView)}”` : ''
        text.current.textContent = `${head}${ascii}${inView.length ? ':  ' + framesText(inView) : ''}`
      }
      if (info.current && cap) {
        info.current.textContent =
          s.proto === 'uart'
            ? `Decoding 8N1 at ${cap.baud()} baud: ${formatUs(1e6 / cap.baud())} per bit.`
            : s.proto === 'spi'
              ? `Decoding SPI mode ${cap.spiMode()}, MSB first, samples on SCK ${cap.spiMode() === 0 || cap.spiMode() === 3 ? 'rising' : 'falling'}.`
              : 'START: SDA falls while SCL is HIGH. Bits are read on SCL rising. A = ACK (SDA LOW), N = NACK.'
      }
    }
    raf = requestAnimationFrame(tick)
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => (st.current.dirty = true)) : null
    if (canvas.current) ro?.observe(canvas.current)
    return () => {
      cancelAnimationFrame(raf)
      ro?.disconnect()
    }
  }, [bench, chans])

  const drag = useRef<{ x: number; v: View } | null>(null)
  const onDown = (e: RPointerEvent<HTMLCanvasElement>) => {
    drag.current = { x: e.clientX, v: { ...view.current } }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const onMove = (e: RPointerEvent<HTMLCanvasElement>) => {
    const d = drag.current
    if (!d || !canvas.current) return
    const pw = Math.max(1, canvas.current.clientWidth - GUTTER - 8)
    const dt = ((e.clientX - d.x) / pw) * (d.v.t1 - d.v.t0)
    if (Math.abs(e.clientX - d.x) < 3 && live) return
    setLive(false)
    setHeld({ t0: d.v.t0 - dt, t1: d.v.t1 - dt })
  }
  const onUp = () => {
    drag.current = null
  }
  const zoom = (dir: 1 | -1) => {
    const next = zoomStep(span, dir)
    setSpan(next)
    if (!live) {
      const v = view.current
      const c = (v.t0 + v.t1) / 2
      setHeld({ t0: c - next / 2, t1: c + next / 2 })
    }
  }
  const onWheel = (e: RWheelEvent<HTMLCanvasElement>) => {
    if (!e.ctrlKey && !e.shiftKey) return // plain wheel scrolls the page
    zoom(e.deltaY > 0 ? 1 : -1)
  }
  const pickProto = (p: Protocol) => {
    setProto(p)
    setSpan(DEFAULT_SPAN_US[p])
    setLive(true)
    setHeld(null)
  }

  return (
    <>
      <div className="inst-screen">
        <canvas
          ref={canvas}
          className="la-canvas"
          style={{ height: `${chans.length * LANE + DECODE + AXIS + 8}px` }}
          role="img"
          aria-label={`Logic analyzer: ${chans.map((c) => c.label).join(', ')}, decoding ${proto}`}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onWheel={onWheel}
        />
        <p className="la-decoded" ref={text} aria-live="off" />
      </div>
      <div className="inst-controls">
        <fieldset className="inst-ch">
          <legend>Decoder</legend>
          <RadioSeg label="Protocol decoder" options={PROTOS} value={proto} onChange={pickProto} />
          <p className="la-info" ref={info} />
        </fieldset>
        <fieldset className="inst-ch">
          <legend>Time</legend>
          <div className="la-zoom">
            <button type="button" className="chip" aria-label="Zoom out" onClick={() => zoom(1)}>
              −
            </button>
            <output aria-label="Time per division">{formatUs(span / 10)}/div</output>
            <button type="button" className="chip" aria-label="Zoom in" onClick={() => zoom(-1)}>
              +
            </button>
          </div>
          <button
            type="button"
            className={`run-stop${live ? '' : ' stopped'}`}
            aria-pressed={!live}
            onClick={() => {
              if (live) {
                setHeld({ ...view.current })
                setLive(false)
              } else {
                setHeld(null)
                setLive(true)
              }
            }}
          >
            {live ? '■ Hold' : '▶ Live'}
          </button>
          <p className="la-info">Drag the trace to pan (it holds). Ctrl + wheel zooms.</p>
        </fieldset>
      </div>
    </>
  )
}
