// Instrument sample storage: a fixed-size ring of (sim time, channel values) rows, filled by the
// bench inside its step loop (every transient step and every edge substep), so instruments see
// the simulation at its own resolution rather than at the frame rate. Nothing is allocated per
// sample: times are a preallocated Float64Array (µs steps must stay distinct after hours of sim
// time), values preallocated Float32Arrays.

export class SampleRing {
  readonly capacity: number
  /** sim time of each slot, s */
  readonly t: Float64Array
  /** one value array per channel, same slots as `t` */
  readonly ch: Float32Array[]
  /** samples held (≤ capacity) */
  count = 0
  /** samples ever pushed since the last clear (bumps on every push: a cheap "has it changed") */
  writes = 0
  /** slot the next push writes */
  private head = 0

  constructor(capacity: number, channels: number) {
    this.capacity = Math.max(2, Math.floor(capacity))
    this.t = new Float64Array(this.capacity)
    this.ch = Array.from({ length: Math.max(1, channels) }, () => new Float32Array(this.capacity))
  }

  get channels(): number {
    return this.ch.length
  }

  /** physical slot of the k-th oldest sample */
  slot(k: number): number {
    const i = this.head - this.count + k
    return i < 0 ? i + this.capacity : i >= this.capacity ? i - this.capacity : i
  }
  time(k: number): number {
    return this.t[this.slot(k)]
  }
  value(channel: number, k: number): number {
    return this.ch[channel][this.slot(k)]
  }
  get firstT(): number {
    return this.count ? this.t[this.slot(0)] : NaN
  }
  get lastT(): number {
    return this.count ? this.t[this.slot(this.count - 1)] : NaN
  }

  /** take a slot for time `t`; -1 when `t` is earlier than the newest sample (rows stay time-ordered) */
  private claim(t: number): number {
    if (this.count && t < this.lastT) return -1
    const i = this.head
    this.t[i] = t
    this.head = i + 1 === this.capacity ? 0 : i + 1
    if (this.count < this.capacity) this.count++
    this.writes++
    return i
  }

  push(t: number, values: ArrayLike<number>): void {
    const i = this.claim(t)
    if (i < 0) return
    for (let c = 0; c < this.ch.length; c++) this.ch[c][i] = values[c] ?? 0
  }
  push1(t: number, a: number): void {
    const i = this.claim(t)
    if (i >= 0) this.ch[0][i] = a
  }
  push2(t: number, a: number, b: number): void {
    const i = this.claim(t)
    if (i < 0) return
    this.ch[0][i] = a
    if (this.ch.length > 1) this.ch[1][i] = b
  }

  /** logical index of the first sample with time ≥ `time` (count when none) */
  lowerBound(time: number): number {
    let lo = 0
    let hi = this.count
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (this.time(mid) < time) lo = mid + 1
      else hi = mid
    }
    return lo
  }

  clear(): void {
    this.count = 0
    this.head = 0
    this.writes = 0
  }
}

export interface TriggerSpec {
  level: number
  slope: 'rising' | 'falling'
  /** the sweep needs this much data after the crossing, s */
  post: number
  /** only crossings strictly after this time (the sweep already on screen) */
  after?: number
}

/**
 * Sim time of the latest `slope` crossing of `level` on `channel` that has `post` seconds of
 * samples after it (linearly interpolated between the two samples around it), or null.
 */
export function findTrigger(r: SampleRing, channel: number, spec: TriggerSpec): number | null {
  if (r.count < 2) return null
  const tEnd = r.lastT - spec.post
  const after = spec.after ?? -Infinity
  const rising = spec.slope === 'rising'
  const lv = spec.level
  // walk back from the newest sample whose crossing could still fit a full sweep
  let k = Math.min(r.count - 1, r.lowerBound(tEnd + 1e-15))
  let b = r.value(channel, k)
  let tb = r.time(k)
  for (k = k - 1; k >= 0; k--) {
    const a = r.value(channel, k)
    const ta = r.time(k)
    if (ta < after && tb <= after) break
    const hit = rising ? a < lv && b >= lv : a > lv && b <= lv
    if (hit) {
      const tc = b === a ? tb : ta + ((lv - a) / (b - a)) * (tb - ta)
      if (tc <= tEnd + 1e-12 && tc > after) return tc
    }
    b = a
    tb = ta
  }
  return null
}
