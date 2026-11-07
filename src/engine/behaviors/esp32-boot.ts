// esp32-boot: the ESP32's strapping-pin check at reset.
//
// The ROM samples GPIO0 (params.strapNode, default node 'g0') as the chip comes out of reset:
// HIGH (the internal pull-up) boots the sketch from flash, LOW (below params.threshold × vdd,
// 0.25 × 3.3 V) selects the USB/UART download bootloader. In download mode this behavior holds
// the MCU (the sketch never starts and every GPIO floats), prints the ROM's boot line and
// "waiting for download" to Serial, and publishes boot_mode = 1 (0 for a normal boot).
//
// The bench "resets" the chip at power-on and at every upload (esptool resets it after
// flashing). A failure applied while the board is live is treated as a re-plug, so a button
// held on GPIO0 shows its effect at once. Repair releases the hold and restarts the sketch.
// The check only runs while the 3.3 V rail (params.railNode, default '3v3') is up.

import type { Behavior, BehaviorContext } from '../types'

const states = new WeakMap<BehaviorContext, { download: boolean }>()

function state(ctx: BehaviorContext) {
  let s = states.get(ctx)
  if (!s) {
    s = { download: false }
    states.set(ctx, s)
  }
  return s
}

const str = (v: unknown, d: string) => (typeof v === 'string' && v ? v : d)
const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d)

export const ROM_LINES = ['rst:0x1 (POWERON),boot:0x0 (DOWNLOAD(USB/UART0))', 'waiting for download']

/** sample the strapping pin as the ROM does at reset; true = download mode */
function sample(ctx: BehaviorContext): boolean {
  const vdd = num(ctx.params.vdd, 3.3)
  if (ctx.v(str(ctx.params.railNode, '3v3')) < 0.75 * vdd) return false // no supply: nothing boots
  return ctx.v(str(ctx.params.strapNode, 'g0')) < num(ctx.params.threshold, 0.25) * vdd
}

function enterDownload(ctx: BehaviorContext): void {
  const s = state(ctx)
  s.download = true
  ctx.mcu.hold('download mode')
  for (const line of ROM_LINES) ctx.mcu.serialOut(line)
  ctx.events.push({ t: ctx.t, channel: 'esp32-boot', kind: 'download' })
}

function leave(ctx: BehaviorContext): void {
  const s = state(ctx)
  if (!s.download) return
  s.download = false
  ctx.mcu.release()
}

export const behavior: Behavior = {
  id: 'esp32-boot',

  tick(ctx) {
    ctx.publish('boot_mode', state(ctx).download ? 1 : 0)
  },

  onEvent(ctx, ev) {
    const s = state(ctx)
    if (ev === 'power-on' || ev === 'upload') {
      // a reset: the hold (if any) is the simLoop's to clear on upload, so start from a clean state
      if (ev === 'power-on') leave(ctx)
      else s.download = false
      if (sample(ctx)) enterDownload(ctx)
    } else if (ev === 'break') {
      if (!s.download && sample(ctx)) enterDownload(ctx)
    } else if (ev === 'power-off') {
      leave(ctx)
    } else if (ev === 'repair' || ev === 'strip') {
      const was = s.download
      leave(ctx)
      if (was && ev === 'repair' && !sample(ctx)) ctx.mcu.reset()
    }
  },

  reset(ctx) {
    leave(ctx)
  },
}
