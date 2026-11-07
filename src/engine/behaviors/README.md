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
| `setParam(id, key, value)` | Changes an element parameter live (sensor resistance, switch state). It keeps the transient state, and it is cheap when the value is unchanged, so calling it every tick is fine. |
| `setMotorLoad(id, torque)` | Sets a MOTOR's shaft load in N·m. |
| `burn(id, reason)` | Fails a part as if a rating had been exceeded (shows smoke, and FAULT). |
| `events.push({t, channel, kind, data})` | Timeline events for instruments (logic analyser, scope markers). |
| `mcu.hold(reason)` / `mcu.release()` | Brown-out: hold freezes the sketch and floats its pins; release resumes from the MCU's own time and does not replay the hold. Call `mcu.reset()` after release for a real brown-out reset. |
| `mcu.reset()` | Restarts the uploaded sketch from `setup()`. |
| `mcu.injectEdge(pin, level, tMicros)` | A timestamped input edge (encoders, echo pulses), with ISRs firing at that time. |
| `mcu.serialIn(text)` | Bytes for `Serial.read()`. |
| `mcu.serialOut(line)` | A line on the serial monitor from outside the sketch (the ESP32 ROM bootloader). A held MCU prints nothing of its own. |
| `mcu.attachI2c(addr, dev)` / `mcu.attachSpi(cs, dev)` | Bus devices (`I2cDevice` / `SpiDevice` in `src/engine/mcu`). Safe to call before upload. An I2C device's optional `ack()` returning false NACKs its address (wrong address jumper, dead bus). |
| `mcu.timeMicros`, `mcu.running` | MCU clock and state. |

## Rules
- Keep behaviors pure TypeScript with no React or three.js. Test them headless through `createBench(lesson, { registry: { id: behavior } })` (see `src/engine/bench/simLoop.test.ts`).
- Model at the level that teaches the concept. Use real datasheet numbers, and say less rather than invent.
- `validateLesson` rejects unknown behavior ids, duplicate instances, and behavior readouts or tweaks that name an unknown instance.
