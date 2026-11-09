// A digital trace as a ring of level changes (time in µs, level 0/1). The logic analyzer keeps one
// per signal: a bus line synthesized from the sketch's Serial / Wire / SPI calls, a pin the sketch
// drives, or a circuit node held against a threshold. Preallocated: pushing allocates nothing.

/** what the decoders read: a level at any time and the edges in order */
export interface DigitalWave {
  readonly count: number
  time(k: number): number
  level(k: number): 0 | 1
  levelAt(t: number): 0 | 1
  /** index of the first edge at or after t (count when none) */
  lowerBound(t: number): number
}

export class EdgeTrace implements DigitalWave {
  readonly capacity: number
  private readonly t: Float64Array
  private readonly v: Uint8Array
  private head = 0 // index of the oldest edge
  private n = 0
  /** level before the oldest kept edge */
  private initial: 0 | 1
  private lastLevel: 0 | 1
  /** bumped on every change (redraw hint) */
  writes = 0

  constructor(capacity = 8192, initial: 0 | 1 = 0) {
    this.capacity = Math.max(2, capacity)
    this.t = new Float64Array(this.capacity)
    this.v = new Uint8Array(this.capacity)
    this.initial = initial
    this.lastLevel = initial
  }

  get count(): number {
    return this.n
  }

  /** the level now (after the newest edge) */
  get last(): 0 | 1 {
    return this.lastLevel
  }

  /** time of the newest edge (−Infinity when none) */
  get lastT(): number {
    return this.n ? this.time(this.n - 1) : -Infinity
  }

  clear(level: 0 | 1): void {
    this.head = 0
    this.n = 0
    this.initial = level
    this.lastLevel = level
    this.writes++
  }

  /** a level change at time t (µs); repeats are ignored and time never runs backwards */
  push(t: number, level: 0 | 1): void {
    if (level === this.lastLevel) return
    const tt = this.n && t < this.lastT ? this.lastT : t
    if (this.n === this.capacity) {
      this.initial = this.v[this.head] as 0 | 1
      this.head = (this.head + 1) % this.capacity
      this.n--
    }
    const k = (this.head + this.n) % this.capacity
    this.t[k] = tt
    this.v[k] = level
    this.n++
    this.lastLevel = level
    this.writes++
  }

  time(k: number): number {
    return this.t[(this.head + k) % this.capacity]
  }

  level(k: number): 0 | 1 {
    return this.v[(this.head + k) % this.capacity] as 0 | 1
  }

  lowerBound(t: number): number {
    let lo = 0
    let hi = this.n
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (this.time(mid) < t) lo = mid + 1
      else hi = mid
    }
    return lo
  }

  /** the level at time t: the newest edge at or before t (an edge exactly at t counts) */
  levelAt(t: number): 0 | 1 {
    let lo = 0
    let hi = this.n
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (this.time(mid) <= t) lo = mid + 1
      else hi = mid
    }
    return lo === 0 ? this.initial : this.level(lo - 1)
  }
}
