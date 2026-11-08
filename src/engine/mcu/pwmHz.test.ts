import { describe, expect, it } from 'vitest'
import { pwmHzFor } from './virtualMcu'

describe('analogWrite PWM frequency (PinState.pwmHz)', () => {
  it('Uno: 490 Hz, pins 5 and 6 (timer 0) 980 Hz; ESP32-S3 1 kHz; generic 490 Hz', () => {
    expect(pwmHzFor('uno', 9)).toBe(490)
    expect(pwmHzFor('uno', 5)).toBe(980)
    expect(pwmHzFor('uno', 6)).toBe(980)
    expect(pwmHzFor('esp32s3', 5)).toBe(1000)
    expect(pwmHzFor('generic', 3)).toBe(490)
  })
})
