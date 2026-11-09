// The instrument panel: a 2-channel scope and an N-signal strip chart, drawn on canvas 2D in the
// notebook style. Both read the bench's sample rings (filled at sim dt inside the step loop, edge
// substeps included), never per-frame snapshots, so a µs spike is on screen exactly as simulated.
// Lesson defaults come from `lesson.instruments`; the learner can re-probe any node or element.

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Bench, ChartSignal } from '../engine/bench/simLoop'
import { defaultFloor } from '../engine/bench/readouts'
import { findTrigger } from '../engine/bench/sampleRing'
import { formatSI } from '../engine/sim/format'
import type { Lesson, Readout, ScopeChannel, ScopeSource } from '../engine/types'
import { LogicAnalyzer } from './LogicAnalyzer'
import { RadioSeg } from './RadioSeg'
import { Sweep, columnPath, parseSource, seq125, sourceKey, withValue } from './scopeView'

export interface InstrumentsProps {
  lesson: Lesson
  /** the live bench (it changes with the lesson) */
  bench: () => Bench
}

const DIVS_X = 10
const DIVS_Y = 8
const PRE = 0.2 // trigger point: 2 divisions from the left
const PER_DIV = withValue(seq125(1e-6, 100), 0.25)
const TIME_DIV = seq125(1e-6, 5)

type View = 'scope' | 'chart' | 'logic'
const VIEW_LABEL: Record<View, string> = { scope: 'Oscilloscope', chart: 'Strip chart', logic: 'Logic analyzer' }

interface Chan {
  key: string
  perDiv: number
  offset: number
  label?: string
  marks?: ScopeChannel['marks']
}
interface Trig {
  ch: number
  level: number
  slope: 'rising' | 'falling'
  mode: 'auto' | 'normal'
}

const unitOf = (key: string) => (key.startsWith('i:') ? 'A' : 'V')
const nameOf = (key: string) => {
  const s = parseSource(key)
  if (!s) return 'off'
  if (s.kind === 'current') return `I(${s.elementId})`
  return s.ref ? `V(${s.node}, ${s.ref})` : `V(${s.node})`
}
const fmtDiv = (v: number, unit: string) => `${formatSI(v, unit, 2).replace(/\.0(?= )/, '')}/div`

interface Ink {
  card: string
  paper: string
  ink: string
  ink2: string
  ink3: string
  rule: string
  tr: [string, string]
  font: string
}
function readInk(el: Element): Ink {
  const cs = getComputedStyle(el)
  const v = (n: string, f: string) => cs.getPropertyValue(n).trim() || f
  return {
    card: v('--card', '#fbf8f0'),
    paper: v('--paper', '#f3eee2'),
    ink: v('--ink', '#1d1b17'),
    ink2: v('--ink-2', '#4a463d'),
    ink3: v('--ink-3', '#7d776a'),
    rule: v('--rule', 'rgba(29,27,23,0.14)'),
    tr: [v('--trace-1', '#2b59c3'), v('--trace-2', '#a23b8f')],
    font: v('--mono', 'monospace'),
  }
}

/** a deterministic wobble (px) so ruled lines look drawn, not printed; it never boils */
const jit = (i: number, amp = 0.6) => Math.sin(i * 12.9898 + 4.1) * amp

function inkLine(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, seed: number) {
  ctx.beginPath()
  ctx.moveTo(x0 + jit(seed), y0 + jit(seed + 1))
  ctx.quadraticCurveTo((x0 + x1) / 2 + jit(seed + 2, 0.9), (y0 + y1) / 2 + jit(seed + 3, 0.9), x1 + jit(seed + 4), y1 + jit(seed + 5))
  ctx.stroke()
}

/** fit a canvas to its box at device resolution; returns the CSS size */
function fit(canvas: HTMLCanvasElement): { w: number; h: number; ctx: CanvasRenderingContext2D } | null {
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const w = Math.max(1, canvas.clientWidth)
  const h = Math.max(1, canvas.clientHeight)
  const dpr = Math.min(2, globalThis.devicePixelRatio || 1)
  const W = Math.round(w * dpr)
  const H = Math.round(h * dpr)
  if (canvas.width !== W || canvas.height !== H) {
    canvas.width = W
    canvas.height = H
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return { w, h, ctx }
}

function strokePath(ctx: CanvasRenderingContext2D, pts: number[], X: (x: number) => number, Y: (v: number) => number) {
  ctx.beginPath()
  let pen = false
  for (let i = 0; i < pts.length; i += 2) {
    const x = pts[i]
    if (Number.isNaN(x)) {
      pen = false
      continue
    }
    const px = X(x)
    const py = Y(pts[i + 1])
    if (pen) ctx.lineTo(px, py)
    else ctx.moveTo(px, py)
    pen = true
  }
  ctx.stroke()
}

function drawPaper(ctx: CanvasRenderingContext2D, w: number, h: number, ink: Ink) {
  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = ink.card
  ctx.fillRect(0, 0, w, h)
}

function drawScope(canvas: HTMLCanvasElement, sw: Sweep, has: boolean, chans: Chan[], trig: Trig, tDiv: number, status: string) {
  const f = fit(canvas)
  if (!f) return
  const { w, h, ctx } = f
  const ink = readInk(canvas)
  drawPaper(ctx, w, h, ink)
  const L = 34
  const R = 12
  const T = 22
  const B = 24
  const pw = w - L - R
  const ph = h - T - B
  const dx = pw / DIVS_X
  const dy = ph / DIVS_Y

  // graticule: fine rules, a darker centre cross, minor ticks on it
  ctx.lineCap = 'round'
  ctx.strokeStyle = ink.rule
  ctx.lineWidth = 1
  for (let i = 1; i < DIVS_X; i++) if (i !== DIVS_X / 2) inkLine(ctx, L + i * dx, T, L + i * dx, T + ph, i * 7)
  for (let j = 1; j < DIVS_Y; j++) if (j !== DIVS_Y / 2) inkLine(ctx, L, T + j * dy, L + pw, T + j * dy, j * 11 + 3)
  ctx.strokeStyle = ink.ink3
  ctx.lineWidth = 1.1
  inkLine(ctx, L + pw / 2, T, L + pw / 2, T + ph, 91)
  inkLine(ctx, L, T + ph / 2, L + pw, T + ph / 2, 97)
  for (let i = 0; i < DIVS_X * 5; i++) {
    const x = L + (i * dx) / 5
    ctx.beginPath()
    ctx.moveTo(x, T + ph / 2 - 2.5)
    ctx.lineTo(x, T + ph / 2 + 2.5)
    ctx.stroke()
  }
  for (let j = 0; j < DIVS_Y * 5; j++) {
    const y = T + (j * dy) / 5
    ctx.beginPath()
    ctx.moveTo(L + pw / 2 - 2.5, y)
    ctx.lineTo(L + pw / 2 + 2.5, y)
    ctx.stroke()
  }
  // frame, hand-ruled
  ctx.strokeStyle = ink.ink
  ctx.lineWidth = 1.6
  inkLine(ctx, L, T, L + pw, T, 1)
  inkLine(ctx, L + pw, T, L + pw, T + ph, 2)
  inkLine(ctx, L + pw, T + ph, L, T + ph, 3)
  inkLine(ctx, L, T + ph, L, T, 4)

  const Yof = (c: Chan) => (v: number) => T + (DIVS_Y / 2 - (v / c.perDiv + c.offset)) * dy
  const X = (x: number) => L + x
  ctx.font = `600 10px ${ink.font}`
  ctx.textBaseline = 'middle'

  // reference marks (ratings) and each channel's zero marker
  chans.forEach((c, ci) => {
    if (c.key === 'off') return
    const Y = Yof(c)
    for (const m of c.marks ?? []) {
      const y = Y(m.value)
      if (y < T || y > T + ph) continue
      ctx.save()
      ctx.setLineDash([5, 4])
      ctx.strokeStyle = ink.ink2
      ctx.lineWidth = 1
      inkLine(ctx, L, y, L + pw, y, 40 + ci)
      ctx.restore()
      ctx.fillStyle = ink.ink2
      ctx.textAlign = 'right'
      ctx.fillText(m.label, L + pw - 4, y - 7)
    }
    const y0 = Math.min(T + ph, Math.max(T, Y(0)))
    ctx.fillStyle = ink.tr[ci]
    ctx.beginPath()
    ctx.moveTo(L - 3, y0)
    ctx.lineTo(L - 11, y0 - 5)
    ctx.lineTo(L - 11, y0 + 5)
    ctx.closePath()
    ctx.fill()
    ctx.textAlign = 'right'
    ctx.fillText(String(ci + 1), L - 13, y0)
  })

  // trigger: level arrow on the right edge, position marker on the top edge
  const tc = chans[trig.ch]
  if (tc && tc.key !== 'off') {
    const y = Math.min(T + ph, Math.max(T, Yof(tc)(trig.level)))
    ctx.fillStyle = ink.tr[trig.ch]
    ctx.beginPath()
    ctx.moveTo(L + pw + 2, y)
    ctx.lineTo(L + pw + 10, y - 5)
    ctx.lineTo(L + pw + 10, y + 5)
    ctx.closePath()
    ctx.fill()
  }
  ctx.fillStyle = ink.ink
  ctx.beginPath()
  ctx.moveTo(L + PRE * pw, T - 2)
  ctx.lineTo(L + PRE * pw - 5, T - 9)
  ctx.lineTo(L + PRE * pw + 5, T - 9)
  ctx.closePath()
  ctx.fill()

  // traces, clipped to the graticule: a fine bleed stroke under a firm one, like a fibre-tip pen
  if (has) {
    ctx.save()
    ctx.beginPath()
    ctx.rect(L, T, pw, ph)
    ctx.clip()
    ctx.lineJoin = 'round'
    chans.forEach((c, ci) => {
      if (c.key === 'off') return
      const pts = columnPath(sw.t, sw.ch[ci], sw.n, sw.t0, sw.t1, pw)
      const Y = Yof(c)
      ctx.strokeStyle = ink.tr[ci]
      ctx.globalAlpha = 0.25
      ctx.lineWidth = 4
      strokePath(ctx, pts, X, Y)
      ctx.globalAlpha = 1
      ctx.lineWidth = 1.8
      strokePath(ctx, pts, X, Y)
    })
    ctx.restore()
  }

  // labels
  ctx.textAlign = 'left'
  ctx.fillStyle = ink.ink
  ctx.font = `700 10.5px ${ink.font}`
  ctx.fillText(status, L, T - 11)
  ctx.font = `600 10px ${ink.font}`
  ctx.textAlign = 'right'
  ctx.fillText(`${fmtDiv(tDiv, 's')}   TRIG CH${trig.ch + 1} ${trig.slope === 'rising' ? '↑' : '↓'} ${formatSI(trig.level, unitOf(chans[trig.ch]?.key ?? ''), 2)}`, L + pw, T - 11)
  ctx.textAlign = 'left'
  let x = L
  chans.forEach((c, ci) => {
    if (c.key === 'off') return
    const text = `CH${ci + 1} ${c.label ?? nameOf(c.key)} ${fmtDiv(c.perDiv, unitOf(c.key))}`
    ctx.fillStyle = ink.tr[ci]
    ctx.fillRect(x, T + ph + 9, 9, 3)
    ctx.fillStyle = ink.ink
    ctx.fillText(text, x + 13, T + ph + 11)
    x += ctx.measureText(text).width + 30
  })
}

interface ChartLane {
  label: string
  unit: string
  digits: number
}

function drawChart(canvas: HTMLCanvasElement, b: Bench, lanes: ChartLane[], span: number) {
  const f = fit(canvas)
  if (!f) return
  const { w, h, ctx } = f
  const ink = readInk(canvas)
  drawPaper(ctx, w, h, ink)
  const r = b.chart
  const L = 10
  const R = 10
  const T = 6
  const B = 20
  const pw = w - L - R
  const n = Math.max(1, lanes.length)
  const lh = (h - T - B) / n
  const tEnd = r.count ? r.lastT : 0
  const t0 = tEnd - span
  const k0 = Math.max(0, r.lowerBound(t0) - 1)
  const cnt = r.count - k0
  const tt = new Float64Array(Math.max(0, cnt))
  for (let k = 0; k < cnt; k++) tt[k] = r.time(k0 + k)
  const vv = new Float32Array(Math.max(0, cnt))
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  // time rules every tenth of the span
  ctx.strokeStyle = ink.rule
  ctx.lineWidth = 1
  for (let i = 1; i < 10; i++) inkLine(ctx, L + (i * pw) / 10, T, L + (i * pw) / 10, T + n * lh, 200 + i)
  lanes.forEach((lane, li) => {
    const top = T + li * lh
    ctx.strokeStyle = ink.ink
    ctx.lineWidth = 1.4
    inkLine(ctx, L, top + lh, L + pw, top + lh, 300 + li)
    if (li === 0) inkLine(ctx, L, top, L + pw, top, 299)
    let lo = Infinity
    let hi = -Infinity
    for (let k = 0; k < cnt; k++) {
      const v = r.value(li, k0 + k)
      vv[k] = v
      if (Number.isFinite(v) && tt[k] >= t0) {
        lo = Math.min(lo, v)
        hi = Math.max(hi, v)
      }
    }
    const last = cnt ? vv[cnt - 1] : NaN
    if (!Number.isFinite(lo)) {
      lo = 0
      hi = 1
    }
    if (hi - lo < Math.max(1e-12, Math.abs(hi) * 1e-6)) {
      const pad = Math.abs(hi) * 0.1 || 1e-3
      lo -= pad
      hi += pad
    }
    const pad = (hi - lo) * 0.12
    const yLo = lo - pad
    const yHi = hi + pad
    const Y = (v: number) => top + 16 + (1 - (v - yLo) / (yHi - yLo)) * (lh - 22)
    const color = ink.tr[li % 2]
    ctx.save()
    ctx.beginPath()
    ctx.rect(L, top, pw, lh)
    ctx.clip()
    const pts = columnPath(tt, vv, cnt, t0, tEnd, pw)
    ctx.strokeStyle = color
    ctx.globalAlpha = li % 4 < 2 ? 1 : 0.75
    ctx.lineWidth = 1.8
    if (li >= 2) ctx.setLineDash(li % 2 ? [6, 3] : [2, 3])
    strokePath(ctx, pts, (x) => L + x, Y)
    ctx.restore()
    ctx.font = `600 10px ${ink.font}`
    ctx.textBaseline = 'top'
    ctx.textAlign = 'left'
    ctx.fillStyle = ink.ink
    ctx.fillText(`${lane.label}  ${formatSI(last, lane.unit, lane.digits)}`, L + 4, top + 3)
    ctx.textAlign = 'right'
    ctx.fillStyle = ink.ink3
    ctx.fillText(`${formatSI(lo, lane.unit, 2)} … ${formatSI(hi, lane.unit, 2)}`, L + pw - 4, top + 3)
  })
  ctx.textBaseline = 'middle'
  ctx.fillStyle = ink.ink3
  ctx.textAlign = 'left'
  ctx.fillText(`−${formatSI(span, 's', 2)}`, L, h - 9)
  ctx.textAlign = 'right'
  ctx.fillText('now', L + pw, h - 9)
}

function initialChans(lesson: Lesson, current: (ScopeSource | null)[]): Chan[] {
  const defs = lesson.instruments?.scope?.channels ?? []
  return [0, 1].map((i) => {
    const d = defs[i]
    const key = sourceKey(current[i] ?? null)
    if (d && sourceKey(d.source) === key) return { key, perDiv: d.perDiv ?? 1, offset: d.offset ?? 0, label: d.label, marks: d.marks }
    return { key, perDiv: key.startsWith('i:') ? 0.01 : 1, offset: 0 }
  })
}

/** a sensible first probe for a lesson without scope defaults: its first voltage readout */
function firstProbe(lesson: Lesson, nodes: string[]): ScopeSource | null {
  const r = lesson.readouts.find((x) => x.source.kind === 'voltage')
  if (r && r.source.kind === 'voltage') return r.source
  return nodes[0] ? { kind: 'voltage', node: nodes[0] } : null
}

export function Instruments({ lesson, bench }: InstrumentsProps) {
  const defaults = lesson.instruments
  const uid = useId()
  const nodes = useMemo(
    () => [...new Set(lesson.circuit.elements.flatMap((e) => e.nodes as string[]))].filter((n) => n !== '0').sort(),
    [lesson],
  )
  const elements = useMemo(() => lesson.circuit.elements.map((e) => e.id), [lesson])

  // first open on a lesson without defaults: probe something rather than show a blank screen
  const [boot] = useState(() => {
    const b = bench()
    const cfg = b.instrumentConfig()
    if (!cfg.scope.some(Boolean)) {
      const p = firstProbe(lesson, nodes)
      if (p) b.setScope([p, null])
    }
    if (!cfg.chart.length && lesson.readouts.length) b.setChart([0], 10)
    return b.instrumentConfig()
  })

  const views: View[] = defaults?.logic ? ['scope', 'chart', 'logic'] : ['scope', 'chart']
  const [view, setView] = useState<View>(defaults?.view ?? (defaults?.chart && !defaults.scope ? 'chart' : 'scope'))
  const [chans, setChans] = useState<Chan[]>(() => initialChans(lesson, boot.scope))
  const sd = defaults?.scope
  const [tDiv, setTDiv] = useState(sd?.timePerDiv ?? 1e-3)
  const [trig, setTrig] = useState<Trig>({
    ch: sd?.trigger?.channel ?? 0,
    level: sd?.trigger?.level ?? 0.5 * (initialChans(lesson, boot.scope)[0]?.perDiv ?? 1),
    slope: sd?.trigger?.slope ?? 'rising',
    mode: sd?.trigger?.mode ?? 'auto',
  })
  const [run, setRun] = useState(true)
  const [signals, setSignals] = useState<ChartSignal[]>(boot.chart)
  const [span, setSpan] = useState(boot.span)

  const scopeCanvas = useRef<HTMLCanvasElement>(null)
  const chartCanvas = useRef<HTMLCanvasElement>(null)
  const stats = useRef<HTMLParagraphElement>(null)
  const cfg = useRef({ chans, tDiv, trig, run, view, signals, span })
  useLayoutEffect(() => {
    cfg.current = { chans, tDiv, trig, run, view, signals, span }
  })
  const [sweep] = useState(() => new Sweep(bench().scope.capacity + 2))
  const st = useRef({ ring: null as unknown, writes: -1, lastTc: -Infinity, has: false, status: 'WAIT', trigT: -Infinity, dirty: true, chartWrites: -1 })

  // a control change: redraw, and look for the latest trigger again with the new settings
  // (the held sweep stays on screen until one is found)
  useEffect(() => {
    st.current.lastTc = -Infinity
    st.current.dirty = true
    st.current.writes = -1
    st.current.chartWrites = -1
  }, [chans, tDiv, trig, view, signals, span, run])
  // a new probe empties the ring: the old sweep no longer describes anything
  const probeKeys = chans.map((c) => c.key).join(',')
  useEffect(() => {
    st.current.has = false
  }, [probeKeys])

  const chartLanes: ChartLane[] = signals.map((s) => {
    const r: Readout | undefined = typeof s === 'number' ? lesson.readouts[s] : s
    return { label: r?.label ?? '?', unit: r?.unit ?? '', digits: r?.digits ?? 3 }
  })
  const lanesRef = useRef(chartLanes)
  useLayoutEffect(() => {
    lanesRef.current = chartLanes
  })

  useEffect(() => {
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const b = bench()
      const c = cfg.current
      const s = st.current
      if (c.view === 'logic') return // the logic analyzer draws itself
      if (c.view === 'chart') {
        const cw = b.chart.writes
        if (chartCanvas.current && (cw !== s.chartWrites || s.dirty)) {
          s.chartWrites = cw
          s.dirty = false
          drawChart(chartCanvas.current, b, lanesRef.current, c.span)
        }
        return
      }
      const r = b.scope
      if (r !== s.ring) {
        s.ring = r
        s.lastTc = -Infinity
        s.has = false
      }
      if (c.run && r.writes !== s.writes) {
        s.writes = r.writes
        const sweepSpan = DIVS_X * c.tDiv
        const tc = c.chans[c.trig.ch]?.key !== 'off' ? findTrigger(r, c.trig.ch, { level: c.trig.level, slope: c.trig.slope, post: sweepSpan * (1 - PRE), after: s.lastTc, lookback: Math.max(2 * sweepSpan, 0.25) }) : null
        if (tc !== null) {
          sweep.capture(r, tc - PRE * sweepSpan, tc + (1 - PRE) * sweepSpan)
          s.lastTc = tc
          s.trigT = r.lastT
          s.has = true
          s.status = "TRIG'D"
          s.dirty = true
        } else if (c.trig.mode === 'auto' && r.count && (!s.has || r.lastT - s.trigT > Math.max(2 * sweepSpan, 0.25))) {
          sweep.capture(r, r.lastT - sweepSpan, r.lastT)
          s.has = true
          s.status = 'AUTO'
          s.dirty = true
        } else if (!s.has && s.status !== 'WAIT') {
          s.status = 'WAIT'
          s.dirty = true
        }
      }
      if (!c.run && s.status !== 'STOP') {
        s.status = 'STOP'
        s.dirty = true
      }
      if (s.dirty && scopeCanvas.current) {
        s.dirty = false
        const label = s.status === 'WAIT' ? 'WAIT · armed, no trigger yet' : s.status === 'STOP' ? 'STOP · held' : s.status
        drawScope(scopeCanvas.current, sweep, s.has, c.chans, c.trig, c.tDiv, label)
        if (stats.current) {
          stats.current.textContent = s.has
            ? c.chans
                .map((ch, i) => {
                  if (ch.key === 'off') return ''
                  const u = unitOf(ch.key)
                  const f = (v: number) => formatSI(Math.abs(v) < defaultFloor(u) ? 0 : v, u, 3)
                  return `CH${i + 1} ${ch.label ?? nameOf(ch.key)}: max ${f(sweep.max(i))} · min ${f(sweep.min(i))}`
                })
                .filter(Boolean)
                .join('  |  ')
            : 'No sweep yet: power the bench, then wait for a trigger.'
        }
      }
    }
    raf = requestAnimationFrame(tick)
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => (st.current.dirty = true)) : null
    if (scopeCanvas.current) ro?.observe(scopeCanvas.current)
    if (chartCanvas.current) ro?.observe(chartCanvas.current)
    return () => {
      cancelAnimationFrame(raf)
      ro?.disconnect()
    }
  }, [bench, sweep])

  const setChan = (i: number, patch: Partial<Chan>) => {
    const next = chans.map((c, j) => (j === i ? { ...c, ...patch } : c))
    if (patch.key !== undefined && patch.key !== chans[i].key) {
      next[i] = { key: patch.key, perDiv: patch.key.startsWith('i:') ? 0.01 : 1, offset: 0 }
      bench().setScope(next.map((c) => parseSource(c.key)))
    }
    setChans(next)
  }
  const setChartSignals = (next: ChartSignal[], nextSpan = span) => {
    setSignals(next)
    setSpan(nextSpan)
    bench().setChart(next, nextSpan)
  }

  const probeOptions = (
    <>
      <option value="off">off</option>
      <optgroup label="Voltage (to GND)">
        {nodes.map((n) => (
          <option key={n} value={`v:${n}`}>
            V({n})
          </option>
        ))}
      </optgroup>
      <optgroup label="Current">
        {elements.map((id) => (
          <option key={id} value={`i:${id}`}>
            I({id})
          </option>
        ))}
      </optgroup>
    </>
  )

  return (
    <section className="instruments" aria-label="Instruments">
      <div
        className="inst-tabs"
        role="tablist"
        aria-label="Instrument"
        onKeyDown={(e) => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return
          e.preventDefault()
          const i = views.indexOf(view)
          const next = e.key === 'Home' ? views[0] : e.key === 'End' ? views[views.length - 1] : views[(i + (e.key === 'ArrowLeft' ? views.length - 1 : 1)) % views.length]
          setView(next)
          document.getElementById(`${uid}-tab-${next}`)?.focus()
        }}
      >
        {views.map((v) => (
          <button
            key={v}
            id={`${uid}-tab-${v}`}
            type="button"
            role="tab"
            aria-selected={view === v}
            aria-controls={`${uid}-panel-${v}`}
            tabIndex={view === v ? 0 : -1}
            onClick={() => setView(v)}
          >
            {VIEW_LABEL[v]}
          </button>
        ))}
        <span className="inst-note">{view === 'logic' ? 'bus timing laid out at the real bit rate, µs resolution' : 'sampled every sim step, edge substeps included'}</span>
      </div>

      <div className="inst-body" id={`${uid}-panel-scope`} role="tabpanel" aria-labelledby={`${uid}-tab-scope`} hidden={view !== 'scope'}>
        <div className="inst-screen">
          <canvas ref={scopeCanvas} className="scope-canvas" role="img" aria-label={`Oscilloscope: ${chans.filter((c) => c.key !== 'off').map((c) => c.label ?? nameOf(c.key)).join(' and ')}`} />
          <p className="inst-stats" ref={stats} aria-live="off" />
        </div>
        <div className="inst-controls">
          {chans.map((c, i) => {
            const src = parseSource(c.key)
            const unit = unitOf(c.key)
            return (
              <fieldset className="inst-ch" key={i} data-ch={i + 1}>
                <legend>
                  <i aria-hidden="true" /> CH{i + 1}
                  {c.label ? ` · ${c.label}` : ''}
                </legend>
                <label>
                  <span>Probe</span>
                  <select value={src?.kind === 'voltage' ? `v:${src.node}` : c.key} onChange={(e) => setChan(i, { key: e.target.value })}>
                    {probeOptions}
                  </select>
                </label>
                {src?.kind === 'voltage' && (
                  <label>
                    <span>Against</span>
                    <select
                      value={src.ref ?? '0'}
                      onChange={(e) => setChan(i, { key: sourceKey({ kind: 'voltage', node: src.node, ref: e.target.value === '0' ? undefined : e.target.value }) })}
                    >
                      <option value="0">GND</option>
                      {nodes
                        .filter((n) => n !== src.node)
                        .map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
                {src && (
                  <>
                    <label>
                      <span>{unit}/div</span>
                      <select value={c.perDiv} onChange={(e) => setChan(i, { perDiv: Number(e.target.value) })}>
                        {withValue(PER_DIV, c.perDiv).map((v) => (
                          <option key={v} value={v}>
                            {fmtDiv(v, unit)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Offset</span>
                      <input
                        type="range"
                        min={-4}
                        max={4}
                        step={0.5}
                        value={c.offset}
                        aria-valuetext={`${c.offset} divisions`}
                        style={{ ['--fill' as string]: `${((c.offset + 4) / 8) * 100}%` }}
                        onChange={(e) => setChan(i, { offset: Number(e.target.value) })}
                      />
                      <output>{c.offset > 0 ? `+${c.offset}` : c.offset} div</output>
                    </label>
                  </>
                )}
              </fieldset>
            )
          })}
          <fieldset className="inst-ch">
            <legend>Timebase &amp; trigger</legend>
            <label>
              <span>Time/div</span>
              <select value={tDiv} onChange={(e) => setTDiv(Number(e.target.value))}>
                {withValue(TIME_DIV, tDiv).map((v) => (
                  <option key={v} value={v}>
                    {fmtDiv(v, 's')}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Source</span>
              <select value={trig.ch} onChange={(e) => setTrig({ ...trig, ch: Number(e.target.value) })}>
                <option value={0}>CH1</option>
                <option value={1}>CH2</option>
              </select>
            </label>
            <label>
              <span>Level</span>
              <input
                type="number"
                className="inst-num"
                value={trig.level}
                step={chans[trig.ch]?.perDiv ? chans[trig.ch].perDiv / 10 : 0.1}
                onChange={(e) => Number.isFinite(e.target.valueAsNumber) && setTrig({ ...trig, level: e.target.valueAsNumber })}
              />
              <output>{unitOf(chans[trig.ch]?.key ?? '')}</output>
            </label>
            <RadioSeg
              label="Trigger slope"
              options={[
                { value: 'rising', label: '↑ rising' },
                { value: 'falling', label: '↓ falling' },
              ]}
              value={trig.slope}
              onChange={(slope) => setTrig({ ...trig, slope })}
            />
            <RadioSeg
              label="Trigger mode"
              options={[
                { value: 'auto', label: 'auto' },
                { value: 'normal', label: 'normal' },
              ]}
              value={trig.mode}
              onChange={(mode) => setTrig({ ...trig, mode })}
            />
            <button type="button" className={`run-stop${run ? '' : ' stopped'}`} aria-pressed={!run} onClick={() => setRun(!run)}>
              {run ? '■ Stop' : '▶ Run'}
            </button>
          </fieldset>
        </div>
      </div>

      {defaults?.logic && (
        <div className="inst-body" id={`${uid}-panel-logic`} role="tabpanel" aria-labelledby={`${uid}-tab-logic`} hidden={view !== 'logic'}>
          <LogicAnalyzer lesson={lesson} bench={bench} active={view === 'logic'} />
        </div>
      )}

      <div className="inst-body" id={`${uid}-panel-chart`} role="tabpanel" aria-labelledby={`${uid}-tab-chart`} hidden={view !== 'chart'}>
        <div className="inst-screen">
          <canvas
            ref={chartCanvas}
            className="chart-canvas"
            style={{ height: `${Math.max(1, signals.length) * 74 + 26}px` }}
            role="img"
            aria-label={`Strip chart: ${chartLanes.map((l) => l.label).join(', ')}`}
          />
        </div>
        <div className="inst-controls">
          <fieldset className="inst-ch">
            <legend>Signals (up to 6)</legend>
            <div className="chips">
              {lesson.readouts.map((r, i) => {
                const on = signals.includes(i)
                return (
                  <button
                    key={`${r.label}-${i}`}
                    type="button"
                    role="switch"
                    aria-checked={on}
                    className="chip"
                    disabled={!on && signals.length >= 6}
                    onClick={() => setChartSignals(on ? signals.filter((s) => s !== i) : [...signals, i])}
                  >
                    {r.label}
                  </button>
                )
              })}
              {signals
                .filter((s): s is Readout => typeof s !== 'number')
                .map((r) => (
                  <button key={r.label} type="button" role="switch" aria-checked className="chip" onClick={() => setChartSignals(signals.filter((s) => s !== r))}>
                    {r.label}
                  </button>
                ))}
            </div>
            <label>
              <span>Span</span>
              <select value={span} onChange={(e) => setChartSignals(signals, Number(e.target.value))}>
                {withValue([1, 2, 5, 10, 30, 60], span).map((v) => (
                  <option key={v} value={v}>
                    {formatSI(v, 's', 2)}
                  </option>
                ))}
              </select>
            </label>
          </fieldset>
        </div>
      </div>
    </section>
  )
}
