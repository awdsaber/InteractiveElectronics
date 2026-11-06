// Pure music helpers (no WebAudio) so they can be unit tested.

export const midiToHz = (m: number): number => 440 * Math.pow(2, (m - 69) / 12)

/** Original 4-chord loop: Fmaj9 - Em7 - Dm9 - G7. MIDI notes. */
export const PROGRESSION: number[][] = [
  [53, 57, 60, 64, 67],
  [52, 55, 59, 62, 67],
  [50, 53, 57, 60, 64],
  [43, 55, 59, 62, 65],
]

/** Bass root per chord. */
export const BASS: number[] = [41, 40, 38, 43]

export const BPM = 72
export const BEATS_PER_CHORD = 4
export const beatSeconds = (bpm = BPM): number => 60 / bpm
export const chordSeconds = (bpm = BPM): number => beatSeconds(bpm) * BEATS_PER_CHORD
export const loopSeconds = (bpm = BPM): number => chordSeconds(bpm) * PROGRESSION.length

/** Small deterministic PRNG so the humanisation is repeatable. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Eighth-note steps within one bar (0..7). */
export const KICK_STEPS = [0, 3, 4]
export const HAT_STEPS = [1, 3, 5, 7]

/** Motor whir pitch from a 0..1 speed param. */
export const whirHz = (speed: number): number => 60 + 220 * Math.min(1, Math.max(0, speed))
