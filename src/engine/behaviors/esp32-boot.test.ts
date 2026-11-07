import { describe, expect, it } from 'vitest'
import { benchOf, runFor } from './fixtures/esp32Bench'
import { behavior as boot } from './esp32-boot'
import { behavior as ws2812 } from './ws2812'

const reg = { 'esp32-boot': boot, ws2812 }
const SKETCH = `void setup() { Serial.begin(115200); Serial.println("hello"); rgbLedWrite(48, 0, 40, 0); } void loop() { delay(10); }`

describe('esp32-boot behavior', () => {
  it('GPIO0 high at power-up (internal pull-up): the sketch runs and boot_mode is 0', async () => {
    const b = benchOf(SKETCH, reg)
    b.dispatch('power')
    b.upload()
    const s = await runFor(b, 0.2)
    expect(s.sketchError).toBeNull()
    expect(s.serial).toEqual(['hello'])
    expect(s.published['esp32-boot.boot_mode']).toBe(0)
    expect(s.published['ws2812.rgb_g']).toBe(40)
  })

  it('GPIO0 held low at power-up: the ROM waits for download, the sketch never starts, the LED stays dark', async () => {
    const b = benchOf(SKETCH, reg)
    b.dispatch('break:boot-held')
    b.dispatch('power')
    b.upload()
    const s = await runFor(b, 0.5)
    expect(s.serial.at(-1)).toBe('waiting for download')
    expect(s.serial.some((l) => /boot:0x0 \(DOWNLOAD/.test(l))).toBe(true)
    expect(s.serial).not.toContain('hello')
    expect(s.published['esp32-boot.boot_mode']).toBe(1)
    expect(s.published['ws2812.rgb_g'] ?? 0).toBe(0)
    expect(s.status).toBe('RUNNING') // the board is live; the chip sits in its ROM bootloader
  })

  it('holding BOOT while the sketch already runs acts like a re-plug: the ROM enters download mode', async () => {
    const b = benchOf(SKETCH, reg)
    b.dispatch('power')
    b.upload()
    let s = await runFor(b, 0.2)
    expect(s.serial).toEqual(['hello'])
    b.dispatch('break:boot-held')
    s = await runFor(b, 0.2)
    expect(s.serial.at(-1)).toBe('waiting for download')
    expect(s.published['esp32-boot.boot_mode']).toBe(1)
  })

  it('repair releases the button and restarts the sketch', async () => {
    const b = benchOf(SKETCH, reg)
    b.dispatch('break:boot-held')
    b.dispatch('power')
    b.upload()
    let s = await runFor(b, 0.2)
    expect(s.published['esp32-boot.boot_mode']).toBe(1)
    b.dispatch('repair')
    s = await runFor(b, 0.2)
    expect(s.published['esp32-boot.boot_mode']).toBe(0)
    expect(s.serial.at(-1)).toBe('hello')
  })

  it('a re-upload with BOOT still held lands in download mode again (esptool resets with GPIO0 low)', async () => {
    const b = benchOf(SKETCH, reg)
    b.dispatch('break:boot-held')
    b.dispatch('power')
    b.upload()
    await runFor(b, 0.1)
    b.upload()
    const s = await runFor(b, 0.2)
    expect(s.serial).not.toContain('hello')
    expect(s.serial.at(-1)).toBe('waiting for download')
  })
})
