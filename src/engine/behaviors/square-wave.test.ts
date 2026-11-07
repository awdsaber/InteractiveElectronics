import { describe, expect, it } from 'vitest'
import { benchOf, powerAndRun, runFor } from './fixtures/esp32Bench'
import { behavior as squareWave, squareLevel } from './square-wave'

const reg = { 'square-wave': squareWave }
const IDLE = `void setup() {} void loop() { delay(10); }`

describe('square-wave behavior', () => {
  it('squareLevel: high for the first `duty` of each period', () => {
    expect(squareLevel(0, 0.5, 5, 0.5)).toBe(5)
    expect(squareLevel(0.99, 0.5, 5, 0.5)).toBe(5)
    expect(squareLevel(1.0, 0.5, 5, 0.5)).toBe(0)
    expect(squareLevel(1.99, 0.5, 5, 0.5)).toBe(0)
    expect(squareLevel(2.0, 0.5, 5, 0.5)).toBe(5)
    expect(squareLevel(0.3, 1, 3.3, 0.25)).toBe(0)
    expect(squareLevel(0.2, 1, 3.3, 0.25)).toBe(3.3)
  })

  it('drives a V element: 0.5 Hz, 50 % duty → 1 s at 5 V, 1 s at 0 V', async () => {
    const b = benchOf(IDLE, reg, [{ id: 'square-wave', instance: 'sig', params: { element: 'v_sig', hz: 0.5, v: 5, duty: 0.5 } }])
    powerAndRun(b)
    let s = await runFor(b, 0.5)
    expect(s.elementValues['v_sig.value']).toBe(5)
    expect(s.published['sig.level']).toBe(5)
    s = await runFor(b, 1.0)
    expect(s.elementValues['v_sig.value']).toBe(0)
    s = await runFor(b, 1.0)
    expect(s.elementValues['v_sig.value']).toBe(5)
  })

  it('defaults: 1 Hz, 5 V, 50 %; ignores a missing element', async () => {
    const b = benchOf(IDLE, reg, [{ id: 'square-wave', params: { element: 'v_sig' } }])
    powerAndRun(b)
    let s = await runFor(b, 0.25)
    expect(s.elementValues['v_sig.value']).toBe(5)
    s = await runFor(b, 0.5)
    expect(s.elementValues['v_sig.value']).toBe(0)
    const c = benchOf(IDLE, reg, [{ id: 'square-wave', params: { element: 'nope' } }])
    powerAndRun(c)
    expect((await runFor(c, 0.1)).sketchError).toBeNull()
  })
})
