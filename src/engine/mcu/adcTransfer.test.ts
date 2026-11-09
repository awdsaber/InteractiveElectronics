import { describe, expect, it } from 'vitest'
import { VirtualMcu } from './virtualMcu'

// ATmega328P datasheet: ADC = V_IN · 1024 / V_REF, truncated (an n-bit ADC has 2^n steps of
// V_REF/2^n). Mid-scale 2.50 V on a 5 V reference is code 512, not round(0.5 · 1023) = 511.
async function readAt(volts: number, board: 'uno' | 'esp32s3' = 'uno', vcc = 5): Promise<number> {
  let got = -1
  const mcu = new VirtualMcu({
    vcc,
    board,
    onPin: () => {},
    readAnalog: () => volts,
    readDigital: () => 0,
    serial: (line) => {
      got = Number(line)
    },
  })
  mcu.load('void setup(){ Serial.begin(9600); Serial.println(analogRead(A0)); } void loop(){ delay(1000); }')
  mcu.start()
  await mcu.advance(5)
  return got
}

describe('analogRead transfer function', () => {
  it('truncates V·1024/Vref like the datasheet', async () => {
    expect(await readAt(2.5)).toBe(512)
    expect(await readAt(0)).toBe(0)
    expect(await readAt(5 / 1024 - 1e-6)).toBe(0) // just under one LSB
    expect(await readAt(5 / 1024 + 1e-6)).toBe(1)
    expect(await readAt(1.0)).toBe(204) // floor(204.8)
  })

  it('pins at full scale for V ≥ Vref − 1 LSB and above', async () => {
    expect(await readAt(5)).toBe(1023)
    expect(await readAt(6)).toBe(1023)
    expect(await readAt(-0.2)).toBe(0)
  })
})
