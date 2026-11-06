// WebAudio-only sound. No audio files. The AudioContext is created lazily on the first user gesture.
import { BASS, HAT_STEPS, KICK_STEPS, PROGRESSION, beatSeconds, chordSeconds, midiToHz, mulberry32, whirHz } from './music'

export type SfxName = 'click' | 'place' | 'solder' | 'plug' | 'pop' | 'whir' | 'success'

let ctx: AudioContext | null = null
let master: GainNode | null = null
let sfxBus: GainNode | null = null
let noiseBuf: AudioBuffer | null = null
let effectsOn = true

interface LofiSession {
  bus: GainNode
  crackle: AudioBufferSourceNode
  lfo: OscillatorNode
  timer: ReturnType<typeof setInterval>
  nextTime: number
  chordIndex: number
  rnd: () => number
}
let lofi: LofiSession | null = null
let whirNodes: { osc: OscillatorNode; gain: GainNode } | null = null

const MUSIC_LEVEL = 0.16
const SFX_LEVEL = 0.35

function ensure(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    try {
      ctx = new AC()
    } catch {
      return null
    }
    master = ctx.createGain()
    master.gain.value = 0.8
    const comp = ctx.createDynamicsCompressor()
    master.connect(comp).connect(ctx.destination)
    sfxBus = ctx.createGain()
    sfxBus.gain.value = SFX_LEVEL
    sfxBus.connect(master)
    const len = ctx.sampleRate * 2
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = noiseBuf.getChannelData(0)
    const rnd = mulberry32(1234)
    for (let i = 0; i < len; i++) d[i] = rnd() * 2 - 1
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

/** Call from any user gesture handler (click/keydown) to unlock audio. Safe to call repeatedly. */
export function unlockAudio(): void {
  ensure()
}

function noiseSource(c: AudioContext, loop = false): AudioBufferSourceNode {
  const s = c.createBufferSource()
  s.buffer = noiseBuf
  s.loop = loop
  return s
}

// ───────────── lo-fi loop ─────────────

function playChord(c: AudioContext, bus: GainNode, t: number, idx: number, rnd: () => number) {
  const dur = chordSeconds()
  const lp = c.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 1500
  lp.Q.value = 0.4
  const g = c.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(0.5, t + 0.04)
  g.gain.exponentialRampToValueAtTime(0.18, t + dur * 0.6)
  g.gain.linearRampToValueAtTime(0.0001, t + dur)
  lp.connect(g).connect(bus)
  const notes = PROGRESSION[idx]
  notes.forEach((m, i) => {
    const strum = i * 0.025 + rnd() * 0.012
    for (const [type, det, amp] of [
      ['sine', -7, 0.5],
      ['triangle', 6, 0.25],
      ['sine', 1, 0.35],
    ] as const) {
      const o = c.createOscillator()
      o.type = type
      o.frequency.value = midiToHz(m)
      o.detune.value = det
      const v = c.createGain()
      v.gain.value = amp / notes.length
      o.connect(v).connect(lp)
      o.start(t + strum)
      o.stop(t + dur + 0.1)
    }
  })
  const bo = c.createOscillator()
  bo.type = 'sine'
  bo.frequency.value = midiToHz(BASS[idx])
  const bg = c.createGain()
  bg.gain.setValueAtTime(0, t)
  bg.gain.linearRampToValueAtTime(0.5, t + 0.05)
  bg.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.95)
  bo.connect(bg).connect(bus)
  bo.start(t)
  bo.stop(t + dur)
}

function playDrums(c: AudioContext, bus: GainNode, t0: number, rnd: () => number) {
  const eighth = beatSeconds() / 2
  for (const s of KICK_STEPS) {
    const t = t0 + s * eighth + (rnd() - 0.5) * 0.012
    const o = c.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(120, Math.max(t, 0))
    o.frequency.exponentialRampToValueAtTime(42, t + 0.14)
    const g = c.createGain()
    g.gain.setValueAtTime(0.7, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22)
    o.connect(g).connect(bus)
    o.start(t)
    o.stop(t + 0.25)
  }
  for (const s of HAT_STEPS) {
    const t = t0 + s * eighth + (rnd() - 0.5) * 0.015
    const n = noiseSource(c)
    const hp = c.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 7000
    const g = c.createGain()
    g.gain.setValueAtTime(0.12 + rnd() * 0.05, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05)
    n.connect(hp).connect(g).connect(bus)
    n.start(t, rnd())
    n.stop(t + 0.06)
  }
}

function schedule() {
  const c = ctx
  const s = lofi
  if (!c || !s) return
  s.nextTime = Math.max(s.nextTime, c.currentTime + 0.05)
  while (s.nextTime < c.currentTime + 1.2) {
    playChord(c, s.bus, s.nextTime, s.chordIndex, s.rnd)
    playDrums(c, s.bus, s.nextTime, s.rnd)
    s.nextTime += chordSeconds()
    s.chordIndex = (s.chordIndex + 1) % PROGRESSION.length
  }
}

export function startLofi(): void {
  const c = ensure()
  if (!c || !master || lofi) return
  const bus = c.createGain()
  bus.gain.value = 0
  bus.gain.setTargetAtTime(MUSIC_LEVEL, c.currentTime, 0.4)
  bus.connect(master)
  // vinyl crackle: looped noise, high-passed, amplitude flickered by a fast LFO
  const crackle = noiseSource(c, true)
  const hp = c.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 3500
  const g = c.createGain()
  g.gain.value = 0.02
  const lfo = c.createOscillator()
  lfo.frequency.value = 7.3
  const lg = c.createGain()
  lg.gain.value = 0.012
  lfo.connect(lg).connect(g.gain)
  lfo.start()
  crackle.connect(hp).connect(g).connect(bus)
  crackle.start()
  lofi = {
    bus,
    crackle,
    lfo,
    nextTime: c.currentTime + 0.1,
    chordIndex: 0,
    rnd: mulberry32(900),
    timer: setInterval(schedule, 400),
  }
  schedule()
}

export function stopLofi(): void {
  const c = ctx
  const s = lofi
  lofi = null
  if (!s || !c) return
  clearInterval(s.timer)
  s.bus.gain.cancelScheduledValues(c.currentTime)
  s.bus.gain.setTargetAtTime(0, c.currentTime, 0.12)
  setTimeout(() => {
    try {
      s.crackle.stop()
      s.lfo.stop()
    } catch {
      /* already stopped */
    }
    s.bus.disconnect()
  }, 1200)
}

export const isLofiPlaying = (): boolean => lofi !== null

// ───────────── effects ─────────────

export function setEffectsEnabled(on: boolean): void {
  effectsOn = on
  if (!on) stopWhir()
}

function tone(c: AudioContext, type: OscillatorType, f0: number, f1: number, t: number, dur: number, vol: number) {
  const o = c.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(f0, t)
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur)
  const g = c.createGain()
  g.gain.setValueAtTime(vol, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(sfxBus!)
  o.start(t)
  o.stop(t + dur + 0.02)
}

function noiseBurst(c: AudioContext, t: number, dur: number, vol: number, type: BiquadFilterType, freq: number, q = 0.7) {
  const n = noiseSource(c)
  const f = c.createBiquadFilter()
  f.type = type
  f.frequency.value = freq
  f.Q.value = q
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(vol, t + Math.min(0.02, dur / 4))
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  n.connect(f).connect(g).connect(sfxBus!)
  n.start(t, Math.random())
  n.stop(t + dur + 0.02)
}

function stopWhir() {
  if (!whirNodes || !ctx) return
  const { osc, gain } = whirNodes
  gain.gain.setTargetAtTime(0, ctx.currentTime, 0.08)
  osc.onended = () => gain.disconnect()
  osc.stop(ctx.currentTime + 0.4)
  whirNodes = null
}

/**
 * Play an effect. `param` (0..1) sets motor speed for 'whir', which is a held tone:
 * call sfx('whir', 0) to stop it.
 */
export function sfx(name: SfxName, param = 0.5): void {
  if (!effectsOn) return
  const c = ensure()
  if (!c) return
  const t = c.currentTime
  switch (name) {
    case 'click':
      tone(c, 'square', 1800, 900, t, 0.035, 0.12)
      break
    case 'place':
      tone(c, 'sine', 220, 110, t, 0.12, 0.5)
      noiseBurst(c, t, 0.05, 0.12, 'bandpass', 1800)
      break
    case 'solder':
      noiseBurst(c, t, 0.7, 0.35, 'highpass', 4500, 0.5)
      noiseBurst(c, t + 0.1, 0.5, 0.15, 'bandpass', 7000, 2)
      break
    case 'plug':
      tone(c, 'triangle', 330, 330, t, 0.07, 0.3)
      tone(c, 'triangle', 495, 495, t + 0.08, 0.1, 0.3)
      break
    case 'pop':
      noiseBurst(c, t, 0.25, 0.7, 'lowpass', 900, 0.5)
      tone(c, 'sine', 160, 40, t, 0.25, 0.6)
      break
    case 'success':
      ;[523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(c, 'triangle', f, f, t + i * 0.09, 0.28, 0.25))
      break
    case 'whir': {
      if (param <= 0) {
        stopWhir()
        break
      }
      if (!whirNodes) {
        const osc = c.createOscillator()
        osc.type = 'sawtooth'
        const lp = c.createBiquadFilter()
        lp.type = 'lowpass'
        lp.frequency.value = 500
        const gain = c.createGain()
        gain.gain.value = 0
        osc.connect(lp).connect(gain).connect(sfxBus!)
        osc.start()
        whirNodes = { osc, gain }
      }
      whirNodes.osc.frequency.setTargetAtTime(whirHz(param), t, 0.1)
      whirNodes.gain.gain.setTargetAtTime(0.1, t, 0.1)
      break
    }
  }
}
