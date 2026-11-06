// wifi-sim: a stand-in for the ESP32's WiFi station, plus the module's supply current.
//
// Sketch API (Arduino-ESP32 `WiFi`, station mode only):
//   WiFi.mode(m), WiFi.begin(ssid, pass), WiFi.status(), WiFi.localIP(), WiFi.RSSI(),
//   WiFi.disconnect(); constants WIFI_OFF/STA/AP/AP_STA and WL_*; xPortGetCoreID() returns 1
//   (Arduino-ESP32 runs setup()/loop() on core 1, the WiFi stack on core 0).
// begin() with the bench SSID (params.ssid, default 'atelier-bench') reports WL_CONNECTED
// params.connectS (1.5 s) of MCU time later; any other SSID reports WL_NO_SSID_AVAIL after that.
//
// Each tick it sets the module current element (params.moduleElement, default 'i_module'):
// 45 mA with the radio off, and with the radio on a 300 mA, 2 ms burst every 100 ms on a base
// chosen so the average is 100 mA (approximate; see the datasheet's current table). Frames are
// longer than a burst, so the element carries the exact average over each frame.
// With params.sigElement set it also toggles that V element between 0 and params.sigV (5 V),
// params.sigHz times a second (1: high for a second, low for a second), the bench's "5 V logic"
// test signal. A toggle each second, not a 1 Hz square wave, so the sketch's once-a-second
// report sees both levels instead of sampling the same phase every time.
//
// Publishes wifi_state (0 off, 1 connecting, 2 connected), rssi (dBm, 0 when not connected)
// and module_mA.

import type { Behavior, BehaviorContext } from '../types'

export const WIFI_IP = '192.168.4.23'

/** Arduino-ESP32 wl_status_t values */
export const WL = {
  WL_IDLE_STATUS: 0,
  WL_NO_SSID_AVAIL: 1,
  WL_SCAN_COMPLETED: 2,
  WL_CONNECTED: 3,
  WL_CONNECT_FAILED: 4,
  WL_CONNECTION_LOST: 5,
  WL_DISCONNECTED: 6,
} as const

const MODES = { WIFI_OFF: 0, WIFI_STA: 1, WIFI_AP: 2, WIFI_AP_STA: 3 } as const

/** module supply current, A */
export const I_IDLE = 0.045
export const I_BURST = 0.3
export const I_AVG = 0.1
const BURST_S = 0.002
const PERIOD_S = 0.1
const I_BASE = (I_AVG - I_BURST * (BURST_S / PERIOD_S)) / (1 - BURST_S / PERIOD_S)

/** mean module current over [t0, t1] s: bursts at k·100 ms lasting 2 ms while the radio is on */
export function frameAverageCurrent(t0: number, t1: number, radio: boolean): number {
  if (!radio) return I_IDLE
  const span = t1 - t0
  if (!(span > 0)) {
    const ph = ((t1 % PERIOD_S) + PERIOD_S) % PERIOD_S
    return ph < BURST_S ? I_BURST : I_BASE
  }
  // time inside bursts over [0, t]
  const inBurst = (t: number) => Math.floor(t / PERIOD_S) * BURST_S + Math.min(BURST_S, t - Math.floor(t / PERIOD_S) * PERIOD_S)
  const burst = inBurst(t1) - inBurst(t0)
  return (burst * I_BURST + (span - burst) * I_BASE) / span
}

/** a deterministic −55 dBm ± 3 wander */
export const rssiAt = (tSec: number): number => Math.round(-55 + 2.2 * Math.sin(tSec * 1.3) + 0.7 * Math.sin(tSec * 4.1 + 1))

interface State {
  mode: number
  /** MCU µs of the last begin(), or null */
  beginAt: number | null
  ssidOk: boolean
}

const states = new WeakMap<BehaviorContext, State>()
const fresh = (): State => ({ mode: MODES.WIFI_STA, beginAt: null, ssidOk: false })

function state(ctx: BehaviorContext): State {
  let s = states.get(ctx)
  if (!s) {
    s = fresh()
    states.set(ctx, s)
  }
  return s
}

const str = (v: unknown, d: string) => (typeof v === 'string' ? v : d)
const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d)

/** 0 off, 1 connecting (or searching for a missing SSID), 2 connected */
function wifiState(ctx: BehaviorContext): 0 | 1 | 2 {
  const s = state(ctx)
  if (s.beginAt === null || s.mode === MODES.WIFI_OFF) return 0
  const elapsed = ctx.mcu.timeMicros - s.beginAt
  return s.ssidOk && elapsed >= num(ctx.params.connectS, 1.5) * 1e6 ? 2 : 1
}

export const behavior: Behavior = {
  id: 'wifi-sim',

  libraries(ctx) {
    const s = () => state(ctx)
    const WiFi = {
      mode(m: number) {
        s().mode = Math.trunc(Number(m) || 0)
        if (s().mode === MODES.WIFI_OFF) s().beginAt = null
        return true
      },
      begin(ssid?: unknown, _pass?: unknown) {
        const st = s()
        if (st.mode === MODES.WIFI_OFF) st.mode = MODES.WIFI_STA
        st.beginAt = ctx.mcu.timeMicros
        st.ssidOk = String(ssid ?? '') === str(ctx.params.ssid, 'atelier-bench')
        return WL.WL_DISCONNECTED
      },
      status() {
        const st = s()
        const w = wifiState(ctx)
        if (w === 2) return WL.WL_CONNECTED
        if (st.beginAt === null) return WL.WL_IDLE_STATUS
        const late = ctx.mcu.timeMicros - st.beginAt >= num(ctx.params.connectS, 1.5) * 1e6
        return late && !st.ssidOk ? WL.WL_NO_SSID_AVAIL : WL.WL_DISCONNECTED
      },
      isConnected() {
        return wifiState(ctx) === 2
      },
      localIP() {
        return wifiState(ctx) === 2 ? WIFI_IP : '0.0.0.0'
      },
      RSSI() {
        return wifiState(ctx) === 2 ? rssiAt(ctx.mcu.timeMicros / 1e6) : 0
      },
      disconnect() {
        s().beginAt = null
        return true
      },
    }
    return { WiFi, ...MODES, ...WL, xPortGetCoreID: () => 1 }
  },

  tick(ctx, dt) {
    const w = ctx.powered && ctx.mcu.running ? wifiState(ctx) : 0
    const i = ctx.powered ? frameAverageCurrent(ctx.t - dt, ctx.t, w > 0) : 0
    const mod = str(ctx.params.moduleElement, 'i_module')
    if (ctx.netlist.elements.some((e) => e.id === mod)) ctx.setParam(mod, 'value', i)
    const sig = str(ctx.params.sigElement, '')
    if (sig && ctx.netlist.elements.some((e) => e.id === sig)) {
      const n = Math.floor(ctx.t * num(ctx.params.sigHz, 1))
      ctx.setParam(sig, 'value', n % 2 === 0 ? num(ctx.params.sigV, 5) : 0)
    }
    ctx.publish('wifi_state', w)
    ctx.publish('rssi', w === 2 ? rssiAt(ctx.t) : 0)
    ctx.publish('module_mA', i * 1000)
  },

  onEvent(ctx, ev) {
    if (ev === 'upload' || ev === 'power-off' || ev === 'power-on') states.set(ctx, fresh())
  },

  reset(ctx) {
    states.set(ctx, fresh())
  },
}
