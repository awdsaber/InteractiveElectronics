import type { BenchStatus } from '../engine/types'
import type { ReadoutView } from './types'

export interface StatusPanelProps {
  placed: number
  total: number
  status: BenchStatus
  readouts: ReadoutView[]
}

const toneOf = (s: BenchStatus) => (s === 'FAULT' ? 'warn' : s === 'POWERED' || s === 'RUNNING' ? 'ok' : 'idle')

export function StatusPanel({ placed, total, status, readouts }: StatusPanelProps) {
  return (
    <section className="status-panel" aria-label="Bench status">
      <dl>
        <div className="row">
          <dt>PARTS</dt>
          <dd>
            {placed}/{total}
          </dd>
        </div>
        <div className="row">
          <dt>STATUS</dt>
          <dd className="state" data-tone={toneOf(status)} aria-live="polite">
            <i aria-hidden="true" />
            {status}
          </dd>
        </div>
        {readouts.length > 0 && <hr />}
        {readouts.map((r, i) => (
          <div className="row" key={`${r.label}-${i}`}>
            <dt>{r.label}</dt>
            <dd className="num-val" data-tone={r.tone ?? 'normal'}>
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
