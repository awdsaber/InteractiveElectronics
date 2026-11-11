// The 'teensy41' board profile (PJRC Teensy 4.1, i.MX RT1062): 3.3 V, 32-bit int, 10-bit ADC by default
// (analogReadResolution up to 12), 8-bit analogWrite by default with analogWriteResolution and
// analogWriteFrequency, and PJRC's default PWM frequencies (FlexPWM 4.482 kHz, QuadTimer 3.611 kHz).
import { describe, expect, it } from 'vitest'
import { analogPinNumber } from '../bench/simLoop'
import type { PinState } from '../types'
import { VirtualMcu, type VirtualMcuOptions } from './index'
import { pwmHzFor } from './virtualMcu'

function harness(opts: Partial<VirtualMcuOptions> = {}) {
  const pins: { pin: number; state: PinState }[] = []
  const lines: string[] = []
  const warnings: string[] = []
  const mcu = new VirtualMcu({
    vcc: 3.3,
    board: 'teensy41',
    onPin: (pin, state) => pins.push({ pin, state: { ...state } }),
    readAnalog: () => 0,
    readDigital: () => 0,
    serial: (l) => lines.push(l),
    warn: (m) => warnings.push(m),
    ...opts,
  })
  return { mcu, pins, lines, warnings }
}

async function run(src: string, ms: number, opts: Partial<VirtualMcuOptions> = {}) {
  const h = harness(opts)
  h.mcu.load(src)
  h.mcu.start()
  await h.mcu.advance(ms)
  return h
}

describe('teensy41 board profile', () => {
  it('default PWM: 4.482 kHz on FlexPWM pins, 3.611 kHz on QuadTimer pins (10–15, 18, 19)', () => {
    for (const p of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 22, 23, 24, 25, 28, 29, 33, 36, 37]) expect(pwmHzFor('teensy41', p)).toBe(4482)
    for (const p of [10, 11, 12, 13, 14, 15, 18, 19]) expect(pwmHzFor('teensy41', p)).toBe(3611)
  })

  it('int is 32-bit', async () => {
    const { lines } = await run(`void setup() { int y = 200 * 300; Serial.println(y); }`, 1)
    expect(lines).toEqual(['60000'])
  })

  it('10-bit ADC by default over 0–3.3 V, analogReadResolution(12) gives 0–4095, capped at 12', async () => {
    const { lines, warnings } = await run(
      `void setup() { Serial.println(analogRead(A0)); analogReadResolution(12); Serial.println(analogRead(A0)); analogReadResolution(16); Serial.println(analogRead(A0)); }`,
      1,
      { readAnalog: (p) => (p === 14 ? 1.65 : 0) },
    )
    expect(lines).toEqual(['512', '2048', '2048'])
    expect(warnings.some((w) => /12/.test(w))).toBe(true)
  })

  it('analogReference() has no effect (warns)', async () => {
    const { lines, warnings } = await run(`void setup() { analogReference(INTERNAL); Serial.println(analogRead(A0)); }`, 1, { readAnalog: () => 1.65 })
    expect(lines).toEqual(['512'])
    expect(warnings.length).toBe(1)
  })

  it('A8..A17 are pins 22..27 and 38..41; the bench maps names the same way', async () => {
    const { lines } = await run(`void setup() { Serial.println(A9); Serial.println(A13); Serial.println(A14); Serial.println(A17); }`, 1)
    expect(lines).toEqual(['23', '27', '38', '41'])
    expect(analogPinNumber('A0', 'teensy41')).toBe(14)
    expect(analogPinNumber('A13', 'teensy41')).toBe(27)
    expect(analogPinNumber('A14', 'teensy41')).toBe(38)
    expect(analogPinNumber('A17', 'teensy41')).toBe(41)
  })

  it('analogWrite: 8-bit by default; analogWriteResolution(12) makes 4095 full scale', async () => {
    const { pins, warnings } = await run(
      `void setup() { analogWrite(5, 128); analogWriteResolution(12); analogWrite(5, 1024); analogWrite(5, 4095); analogWrite(5, 9999); }`,
      1,
    )
    const p5 = pins.filter((p) => p.pin === 5).map((p) => p.state)
    expect(p5.map((s) => +s.level.toFixed(5))).toEqual([+(128 / 255).toFixed(5), +(1024 / 4095).toFixed(5), 1, 1])
    expect(p5[0].pwmHz).toBe(4482)
    expect(warnings).toEqual([])
  })

  it('analogWriteFrequency sets the pin and every pin on the same timer (2 and 3 share FlexPWM4.2)', async () => {
    const { pins } = await run(`void setup() { analogWriteFrequency(2, 36621.09); analogWrite(3, 100); analogWrite(2, 100); analogWrite(4, 100); }`, 1)
    const hz = (pin: number) => pins.filter((p) => p.pin === pin).at(-1)!.state.pwmHz
    expect(hz(3)).toBeCloseTo(36621.09, 2)
    expect(hz(2)).toBeCloseTo(36621.09, 2)
    expect(hz(4)).toBe(4482)
  })

  it('F_CPU_ACTUAL is 600 MHz; micros() counts single microseconds', async () => {
    const { lines } = await run(`void setup() { Serial.println(F_CPU_ACTUAL); delayMicroseconds(3); Serial.println(micros()); }`, 1)
    expect(lines).toEqual(['600000000', '3'])
  })

  it('the PWM helpers warn and do nothing on the Uno', async () => {
    const { warnings, pins } = await run(`void setup() { analogWriteResolution(12); analogWrite(9, 255); }`, 1, { board: 'uno', vcc: 5 })
    expect(warnings.length).toBe(1)
    expect(pins.at(-1)!.state.level).toBe(1)
  })
})
