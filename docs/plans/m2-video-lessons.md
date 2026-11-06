# M2 — Video lessons (parallel authors)

Each author turns one curriculum file into a working lesson. Lessons and behaviors self-register through `import.meta.glob`, so authors never touch a shared file.

## Per-lesson task (the same for every author)
- **Inputs:**
  - `docs/curriculum/<TRACK>/<id>.md`, the content source of truth
  - `src/lessons/README.md`, the authoring template
  - `src/engine/behaviors/README.md`, the Behavior API
  - `src/lessons/T2/led-resistor.ts`, the reference lesson
  - `src/three/` parts (see `?gallery`)
- **Output:**
  - `src/lessons/<TRACK>/<id>.ts`, which exports `lesson`.
  - New behaviors, each as `src/engine/behaviors/<name>.ts` exporting `behavior`, with a unit test `<name>.test.ts`.
  - If a needed 3D part is missing, add it under `src/three/parts/` in a NEW file only, plus a registry entry. If the registry would need editing, report it instead, and use the closest existing kind with `params`.
- **Done means:**
  - `validateLesson` passes, and so does the headless registry test, which runs the lesson to RUNNING or POWERED.
  - A lesson-specific Vitest in `src/lessons/<TRACK>/<id>.test.ts` drives the full bench flow and asserts the curriculum's key numbers: readouts within ±15 %.
  - Every failure scenario produces its described effect.
  - The sketch transpiles and runs.
  - Headless screenshots at 1440×900, both running and broken, look correct.
  - `npm test` and `npm run build` pass.
- **Scope cuts:**
  - If the curriculum asks for an engine or UI feature that doesn't exist yet (scope widget, enum tweaks, draggable tilt plate, and so on), implement the lesson without it, using the nearest existing mechanism such as a slider tweak or a behavior-published readout.
  - List each cut in the report under "Deferred features". These feed M2.5.

## Batch 1 (shared behaviors land here first)
| Author | Lesson | Shared behaviors owned |
|---|---|---|
| A | T4/arduino-uno (becomes pinned "Start here") | `mcu-supply`, `serial-plotter` |
| B | T2/transistor-switch (gear motor + flyback) | — |
| C | T4/esp32-s3 | `ws2812`, `wifi-sim`, `esp32-boot` |
| D | T5/tb6612fng | `tb6612` (also reused by the capstone) |

## Batch 2
| Author | Lesson | Behaviors |
|---|---|---|
| E | T5/l298n | `l298n` |
| F | T5/a4988-stepper | `a4988` |
| G | T5/pca9685-servo | `pca9685` |
| H | T6/mpu6050-imu | `imu-mpu6050` |

## After each batch
- **Review:** one reviewer per lesson. The reviewer checks electronics accuracy against the curriculum and datasheets, the runtime behaviour, and the visuals.
- **Merge** in order.
- **Run** `npm run graph`.
- **Push**, which deploys.
