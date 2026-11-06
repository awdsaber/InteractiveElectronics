import { describe, expect, it } from 'vitest'
import { benchOf, powerAndRun, runFor, runUntil } from './fixtures/esp32Bench'
import { behavior as wifi, frameAverageCurrent } from './wifi-sim'

const reg = { 'wifi-sim': wifi }
const SIG = [{ id: 'wifi-sim', params: { sigElement: 'v_sig' } }]

const CONNECT = `#include <WiFi.h>
void setup() {
  Serial.begin(115200);
  WiFi.mode(WIFI_STA);
  WiFi.begin("atelier-bench", "breadboard");
  unsigned long t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < 5000) delay(50);
  Serial.println(millis() - t0);
  Serial.println(WiFi.localIP());
  Serial.println(WiFi.RSSI());
  Serial.println(xPortGetCoreID());
}
void loop() { delay(100); }`

describe('wifi-sim behavior', () => {
  it('connects to the bench network about 1.5 s after begin(), then reports an IP and RSSI', async () => {
    const b = benchOf(CONNECT, reg)
    powerAndRun(b)
    await runUntil(b, (x) => x.serial.length >= 4, 4)
    const s = await runFor(b, 0.05) // published values follow the MCU by a frame
    expect(s.sketchError).toBeNull()
    const ms = Number(s.serial[0])
    expect(ms).toBeGreaterThanOrEqual(1500)
    expect(ms).toBeLessThan(1600)
    expect(s.serial[1]).toBe('192.168.4.23')
    const rssi = Number(s.serial[2])
    expect(rssi).toBeGreaterThanOrEqual(-58)
    expect(rssi).toBeLessThanOrEqual(-52)
    expect(s.serial[3]).toBe('1') // loop() runs on core 1
    expect(s.published['wifi-sim.wifi_state']).toBe(2)
  })

  it('a wrong SSID never connects: status is WL_NO_SSID_AVAIL, IP 0.0.0.0, RSSI 0', async () => {
    const b = benchOf(
      `void setup() { WiFi.begin("my-home", "x"); delay(3000); Serial.println(WiFi.status() == WL_NO_SSID_AVAIL); Serial.println(WiFi.localIP()); Serial.println(WiFi.RSSI()); } void loop() { delay(100); }`,
      reg,
    )
    powerAndRun(b)
    const s = await runUntil(b, (x) => x.serial.length >= 3, 4)
    expect(s.serial).toEqual(['1', '0.0.0.0', '0'])
    expect(s.published['wifi-sim.wifi_state']).toBe(1)
  })

  it('publishes wifi_state 0 → 1 → 2 and disconnect() drops back to 0', async () => {
    const b = benchOf(`void setup() { delay(200); WiFi.begin("atelier-bench", "breadboard"); delay(2500); WiFi.disconnect(); } void loop() { delay(100); }`, reg)
    powerAndRun(b)
    let s = await runFor(b, 0.1)
    expect(s.published['wifi-sim.wifi_state']).toBe(0)
    s = await runFor(b, 0.4)
    expect(s.published['wifi-sim.wifi_state']).toBe(1)
    s = await runFor(b, 1.5)
    expect(s.published['wifi-sim.wifi_state']).toBe(2)
    s = await runFor(b, 1.0)
    expect(s.published['wifi-sim.wifi_state']).toBe(0)
  })

  it('module current: 45 mA radio off, about 100 mA average connected with 300 mA bursts', async () => {
    const b = benchOf(CONNECT, reg)
    powerAndRun(b)
    let s = await runFor(b, 0.05)
    // the sketch calls begin() at once, so the radio is already on; check the off level with no sketch
    const off = benchOf(`void setup() {} void loop() { delay(10); }`, reg)
    powerAndRun(off)
    const so = await runFor(off, 0.2)
    expect(so.elementValues['i_module.value']).toBeCloseTo(0.045, 6)
    expect(so.published['wifi-sim.module_mA']).toBeCloseTo(45, 3)

    s = await runFor(b, 2.0)
    expect(s.published['wifi-sim.wifi_state']).toBe(2)
    // average over a whole second of frames
    let sum = 0
    let peak = 0
    const n = 60
    for (let i = 0; i < n; i++) {
      s = await runFor(b, 1 / 60)
      sum += s.published['wifi-sim.module_mA']
      peak = Math.max(peak, s.published['wifi-sim.module_mA'])
    }
    expect(sum / n).toBeGreaterThan(95)
    expect(sum / n).toBeLessThan(105)
    expect(peak).toBeGreaterThan(110) // a frame containing a burst
  })

  it('frameAverageCurrent averages the burst over the frame exactly', () => {
    // a whole period averages to 100 mA
    expect(frameAverageCurrent(0, 0.1, true)).toBeCloseTo(0.1, 9)
    expect(frameAverageCurrent(0.003, 0.098, true)).toBeCloseTo((0.1 - 0.3 * 0.02) / 0.98, 9)
    expect(frameAverageCurrent(0, 0.002, true)).toBeCloseTo(0.3, 9)
    expect(frameAverageCurrent(1.2, 1.25, false)).toBe(0.045)
  })

  it('toggles the 5 V test signal once a second (sigHz toggles/s) when given sigElement', async () => {
    const b = benchOf(`void setup() {} void loop() { delay(10); }`, reg, SIG)
    powerAndRun(b)
    let s = await runFor(b, 0.5)
    expect(s.elementValues['v_sig.value']).toBe(5)
    s = await runFor(b, 1.0)
    expect(s.elementValues['v_sig.value']).toBe(0)
    s = await runFor(b, 1.0)
    expect(s.elementValues['v_sig.value']).toBe(5)
  })

  it('a new upload forgets the connection', async () => {
    const b = benchOf(CONNECT, reg)
    powerAndRun(b)
    let s = await runUntil(b, (x) => x.published['wifi-sim.wifi_state'] === 2, 3)
    b.upload(`void setup() {} void loop() { delay(10); }`)
    s = await runFor(b, 0.1)
    expect(s.published['wifi-sim.wifi_state']).toBe(0)
    expect(s.published['wifi-sim.rssi']).toBe(0)
  })
})
