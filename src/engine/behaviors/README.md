# Behaviors

A behavior adds the dynamics a netlist can't express: a sensor, a driver IC, a brown-out
detector, a bus device. Each behavior is one file, `src/engine/behaviors/<id>.ts`, that exports
`behavior`. The glob in `index.ts` registers it, so you never edit a shared file.

```ts
import type { Behavior } from '../types'

export const behavior: Behavior = {
  id: 'thermistor-heat', // unique; lessons refer to it by this id
  libraries: (ctx) => ({ /* globals or classes for sketches, e.g. { Servo } */ }),
  init(ctx) {},                 // once, when the bench is created
  tick(ctx, dt) {},             // every animation frame while powered; dt = sim seconds covered
  onEvent(ctx, ev) {},          // 'power-on' | 'power-off' | 'upload' | 'repair' | 'strip' | 'break'
  onPin(ctx, pin, state, tMicros) {}, // every pin change (writes and floats), MCU time in µs (see a4988.ts)
  onStep(ctx, t, solution) {},  // every instantaneous solve inside the frame (see ac-meter.ts)
  onSerial(ctx, line) {},       // each complete line the sketch prints with Serial
  reset(ctx) {},                // after repair and strip: forget internal state and latched faults
  dispose(ctx) {},              // lesson switch: release timers, devices, listeners
}
```

A lesson lists behaviors as `behaviors: ['id']` or `[{ id, instance: 'name', params: { … } }]`.
The instance name defaults to the id, and two instances of one behavior need different names.

## The context (`BehaviorContext`, `src/engine/types.ts`)

| Member | Use |
|---|---|
| `t`, `dt` (tick argument) | Sim time and the step this frame covered, in seconds. |
| `params` | This instance's params: lesson defaults, overridden live by tweaks `behavior:<instance>.<param>`. |
| `powered` | The MCU supply (`lesson.powerElementId`) is on. |
| `solution`, `netlist` | The latest good solution and the patched netlist (read-only, never mutate). |
| `v(node, ref?)` | A node voltage. |
| `pins` | The pin states the circuit currently sees. |
| `publish(key, value)` | Exposes a value as `<instance>.<key>` for `{kind:'behavior', key}` readouts. Values are cleared on power-off and strip. |
| `read?(key)` | Another behavior's published value by its full key `<instance>.<key>` (undefined when unset), e.g. a robot's body pitch feeding `imu-mpu6050`. It reads a snapshot taken when the frame's behavior pass begins, so it lags exactly one tick whatever the behavior order (and a behavior reading its own key sees last tick's value). |
| `setParam(id, key, value)` | Changes an element parameter live (sensor resistance, switch state). It keeps the transient state, and it is cheap when the value is unchanged, so calling it every tick is fine. |
| `setMotorLoad(id, torque)` | Sets a MOTOR's shaft load in N·m. |
| `burn(id, reason, detail?)` | Fails a part as if a rating had been exceeded (shows smoke, and FAULT). `detail: { value, limit }` sets the numbers in the FAULT text when the element's rating doesn't describe what killed it; `detail.note` replaces the text after the part name (e.g. `'failed: …'`). |
| `onPin` (hook, not a member) | Called for every change of a pin's state, with the MCU's µs timestamp: sketch writes (synchronously inside the MCU's advance, so pulse trains faster than a frame, like STEP at 1/16 microstepping, arrive edge by edge), floats on hold / stop / upload (mode `INPUT`, level 0) and the re-drive on release. Queue them in preallocated arrays and integrate in `tick` up to `mcu.timeMicros`. Don't call `ctx.v` in it: the solution is the last frame's. After `mcu.reset()` or an upload the MCU clock restarts at 0, and the floats carry the old run's time (see `a4988.ts`). |
| `onStep` (hook, not a member) | Called for every instantaneous solve of the transient, in time order, inside the frame's stepping loop and before `tick`: one per step, one per edge substep and one per switched-PWM piece (the same list `Transient.instants` gives the scope). At dt = 50 µs that is ~333 calls in a 1/60 s frame, so allocate nothing in it: keep state in preallocated fields or typed arrays, read the circuit from the `solution` argument (`voltageOf` / `currentOf` / `extraOf`, not `ctx.v` or `ctx.t`, which are the last frame's) and publish in `tick`. Not called on DC benches or for a failed step. Use it for anything that must see the waveform between frames: a frame-rate sampler aliases (a 50 Hz sine read at 50 or 100 fps shows one phase only). It is a hook rather than a `ctx.instants` list so the bench never buffers a frame's solutions. |
| `events.push({t, channel, kind, data})` | Timeline events for instruments (logic analyser, scope markers). |
| `mcu.hold(reason)` / `mcu.release()` | Brown-out: hold freezes the sketch and floats its pins; release resumes from the MCU's own time and does not replay the hold. Call `mcu.reset()` after release for a real brown-out reset. |
| `mcu.reset()` | Restarts the uploaded sketch from `setup()`. |
| `mcu.injectEdge(pin, level, tMicros)` | A timestamped input edge (encoders, echo pulses), with ISRs firing at that time. |
| `mcu.serialIn(text)` | Bytes for `Serial.read()`. |
| `mcu.serialOut(line)` | A line on the serial monitor from outside the sketch (the ESP32 ROM bootloader). A held MCU prints nothing of its own. |
| `mcu.attachI2c(addr, dev)` / `mcu.attachSpi(cs, dev)` | Bus devices (`I2cDevice` / `SpiDevice` in `src/engine/mcu`). Safe to call before upload. An I2C device's optional `ack()` returning false NACKs its address (wrong address jumper, dead bus). `ack()` must be side-effect free: it may be called more than once per transaction. |
| `mcu.timeMicros`, `mcu.running` | MCU clock and state. |

## Shared behaviors

| id | Params | Publishes |
|---|---|---|
| `mcu-supply` | `supplyNode` ('5v'), `bor` (2.7 V), `hyst` (0.05 V), `fClk` (16 MHz) | `vcc`, `warn` (rail below the clock's speed grade), `held` (brown-out reset), `resets`, `fmax` (MHz). Holds the MCU below `bor`, restarts the sketch above `bor + hyst`. |
| `serial-plotter` | — | every `name:value` on a Serial line (Arduino Serial Plotter format), as `<instance>.<name>`; bare numbers as `v1`, `v2`… |
| `coulomb-counter` | `element` ('P_I') | `coulombs` (signed net charge past the element since power-on, I·dt, so reversed current counts down), `electronsPerSec` (signed I/e; 0 below 0.1 µA), `electronsE15` (same, ×10¹⁵: the readout formatter can't print 7.5e16). Restarts at power-off, repair, strip and reset. |
| `ac-meter` | Channel A: `kind` ('v' default, 'i', 'extra'), `node`/`ref` (alias `a`), `element`, `key`; optional channel B the same with a `B` suffix (`nodeB`, alias `b`, …); `source` (a V element whose `wave.freq` sizes the window before a frequency is measured), `window` (0.2 s), `floor` (1e-6: AC RMS below it is no signal) | `rms` (true RMS, DC included), `dc`, `acrms` (AC part only), `amp` (√2·acrms), `vpp`, `freq` and `period` (timed from crossings); with B: `rmsB`, `dcB`, `acrmsB`, `ampB`, `vppB`, `gain` (acrmsB / acrms), `gainPct`, `phase` (°, B against A, + = B leads; sinusoids only: 0 when either channel's vpp/(2√2·acrms) is off a sine's by more than 10 %, or no frequency is measured). Integrates every step through `onStep` (dt-weighted EMAs as in `ratings.ts`, three stages, stage τ = max(window/4, 2/f)), so it is exact at any frame rate. Restarts on power-on/off, break, repair, strip, reset and on a change of circuit structure or of a V source's `wave` (not its DC `value`, which behaviors drive every frame), reading 0 for max(window/8, one period); an undriven channel (floating node, burnt / removed element) or a frame without a good solve reads 0, and the ratios read 0 when channel A has no AC. |
| `pot-knob` | `pot` (a POT element id), `turn` (0–100 %) | `turn`. Sets the POT's wiper, so a tweak `behavior:<instance>.turn` with unit '%' reads "50 %". |
| `source-select` | `switches` (comma-separated SW ids), `mode` (index, default 0) | `mode`. Closes only the SW at index `mode`: a generator's waveform button driven by an enum tweak `behavior:<instance>.mode`. |
| `series-rlc` | `l`, `c` (element ids), `r` (comma-separated R ids in the loop), `rExtra` (Ω, default 0), `sine` (a V with a `wave`) | `f0`, `z0`, `zeta`, `q`, `fd` (0 when ζ ≥ 1), `gain` (steady-state gain V_C/V_in at the sine frequency), `rTotal`, from the live netlist; NaN once L or C has failed. |
| `power-meter` | `vin` (node), `iin` (element, e.g. a PROBE), `vout` (node), `iout` (element, e.g. the load) | `pin`, `pout`, `loss` (W) and `eta` (%, 0 below 1 µW in) from the time-averaged solution: a converter's efficiency. |
| `ne555` | `thr` ('thr'), `trig` (= thr), `vcc` ('vcc'), `thRef` ('th_ref'), `trRef` ('tr_ref'), `out` ('V_OUT'), `dis` ('SW_DIS'), `vMin` (4.5 V), `drop` (1.2 V), `disMax` (0.2 A) | `q`, `freq`, `duty`, `dutyPct`, `pulse` (last high width, s), `vth`, `vtl`, `stepLimited`. The NE555 as two comparators and an SR latch, read through `onStep` on every solve: v(trig) ≤ v(trRef) sets the latch (output high, discharge off) and wins; v(thr) ≥ v(thRef) resets it (output low, `dis` SW closed). The thresholds come from the real divider nodes (so pin 5 moves them). Drives the `out` V element (0 or Vcc − `drop`) and the `dis` SW with `setParam` only when the latch flips (the bench applies it before the next step). Dead below `vMin` (releases at +0.1 V). Burns `dis` if it carries more than `disMax`. `freq` and `duty` read 0 once the output stops switching; `stepLimited` is 1 when the period is under 10 steps. |
| `pwm-filter` | `pin` (9), `r` ('R_F'), `c` ('C_F') | `fc` (Hz), `tau` (s), `fpwm` (Hz), `ratio` (fpwm/fc), `duty`, `vavg` (V), `ripple` (V p-p, exact first-order closed form for a PWM pin into an RC). NaN `fc`/`tau` and full-swing ripple when C is removed. Compare with `ac-meter`'s measured `vpp`. |
| `hcsr04` | `distanceCm` (100), `airTempC` (20), `surface` ('hard'/'soft'/'angled' or 0/1/2), `lossPct` (-1: from surface), `noiseCm` (0.3), `otherSensor`, `crosstalkPct` (30), `minCm` 2, `maxCm` 400, `timeoutUs` 38000, `delayUs` 500, `minGapUs` 20000, `trigPin` 9, `echoPin` 10, `wire` ('w_echo'), `inPin` ('pin10'), `echoSrc` ('echo_src'), `trigMon` ('trig_mon') | `true_cm`, `c_mps`, `echo_us`, `pings`, `pings_lost`, `pings_ignored`, `strays`. The HC-SR04: `onPin` times the TRIG pulse (>= 10 us starts a ping); schedules ECHO HIGH for 2d/c (c = 331.3 + 0.606 T) with `mcu.injectEdge`, so the sketch's `pulseIn` measures it. No echo (out of range, soft or angled loss) holds ECHO for `timeoutUs`; a missing `wire` or `inPin` element sends nothing (`pulseIn` waits out its timeout). Replays ECHO (`echoSrc`) and a TRIG marker (`trigMon`) for the scope from the next frame. Allocates nothing per tick or step. |
| `hx711` | `supply` ('5v'), `avdd` ('avdd'), `inP`/`inN` ('ap'/'an'), `exc` ('ep'), `gauges` ('sg1,sg2,sg3,sg4': compression, tension, tension, compression), `r0` (1000), `capacityG` (1000), `mvPerV` (1.0), `zeroMvV` (0), `massG`, `shockG` (a push for `shockS` 1 s when it becomes non-zero), `safePct` (120), `setPct` (0.2 g of permanent set per g beyond safe), `creepPct` (0.05 % at 30 min), `creepTau` (600 s), `rate` (10/80), `gain` (128), `noiseNv` (50), `noise80Nv` (90), `dout` (3), `sck` (2), `noiseEl` (a series V on the supply), `railNoiseMv`, `railTau` (0.3 s) | `true_g`, `load_g`, `creep_g`, `set_g`, `dR` (Ω), `vdiff_uV`, `avdd_V`, `exc_V`, `raw`, `conversions`, `sps`, `gain`, `down`, `counts_per_g`. Avia HX711 on a real four-resistor bridge: sets the gauges from the load (tick), averages V(inP)−V(inN) / V(avdd) over each 1/10 or 1/80 s conversion (onStep) into a 24-bit two's-complement code at gain 128/64 (±0.5·AVDD/gain full scale, so ratiometric), discards 4 conversions after power-up or a rate/gain change, adds datasheet input noise. Library: bogde-style `HX711` class and `scale` (`begin`, `is_ready`, `read`, `read_average`, `get_value`, `get_units`, `tare`, `set_scale`, `set_offset`, `set_gain`, `power_down`/`power_up`); calls cannot block, so `read()` returns the latest conversion and `read_average(n)` the mean of the last n. Repair (reset) fits a new cell: creep and permanent set cleared. |
| `ntc` | `element` ('ntc'), `bathC` (25), `r25` (10000), `t0C` (25), `bTrue` (3977), `delta` (0.0085 W/K), `tau` (15 s), `selfHeat` (1) | `bath_C` (true temperature), `ntc_C` (sensor body), `ntc_ohm`, `p_self_mW`, `self_heat_K` (P/δ), `lag_K`. An NTC thermistor: sets the element's resistance each tick from the Beta model R = r25·exp(bTrue·(1/T − 1/T0)); the body temperature relaxes (exact first-order step, time constant `tau`) toward bath + P/δ, with P read from the solved circuit (`powerOf`), so a stiff divider shows self-heating. `bTrue` is the actual part's B (a failure patch can set it apart from the sketch's). Datasheet defaults: Vishay NTCLE100E3103 (8.5 mW/K and 15 s are still-air, for information only). Allocates nothing per tick. |

## Rules
- Keep behaviors pure TypeScript with no React or three.js. Test them headless through `createBench(lesson, { registry: { id: behavior } })` (see `src/engine/bench/simLoop.test.ts`).
- Model at the level that teaches the concept. Use real datasheet numbers, and say less rather than invent.
- `validateLesson` rejects unknown behavior ids, duplicate instances, and behavior readouts or tweaks that name an unknown instance.
- A failure can override a behavior param while it is active: `{ op: 'set', elementId: 'behavior:<instance>', key, value }` (tweaks keep their value underneath and return on repair). The bench swaps `ctx.params` for a merged object while such a failure is active, so read `ctx.params` each tick and never cache the params object.
