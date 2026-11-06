# M1 Task E — Integration: bench store, Board composer, behavior framework, first lesson

This supersedes "Task E" in `m1-engine.md` and folds in M1.5 X3 (behavior framework) and part of X4 (multi-power, tweak kinds, readout units). Spec: `docs/spec.md`. Contracts: `src/engine/types.ts`.

## What exists on main (use graphify to explore)
- **`src/engine/sim/`**
  - `solveDC`, `createTransient(netlist, dt, {method})`, `checkRatings` (pass it `sim.lastGood`), `applyPatches`, `applyBurn`, `pinWarnings` and `formatSI`.
  - Thermal shutdown and recovery arrive as BurnEvents with the reasons `thermal-shutdown` and `thermal-recover`. These are not "burnt".
  - Waveforms, POT, XFMR, LOGIC, FUSE and REG are in the X1 branch and merge before or during this task.
- **`src/engine/mcu/`**
  - `VirtualMcu({ vcc, board, onPin, readAnalog, readDigital, serial, libraries, warn })`, with these methods:
    - `load(src)`, which throws `TranspileError {line}`
    - `start()` and `stop()`
    - `await advance(ms)`, which is async and must be awaited serially
    - `injectEdge(pin, level, tMicros)`, `schedule(tMicros, fn)` and `serialIn(text)`
    - `attachI2c` / `attachSpi`
    - `serialLines`, `warnings` and `timeMicros`
  - Libraries: a class becomes a declarable type; an object becomes a global.
- **`src/three/`**
  - `partRegistry`, `PartRenderState {visible, soldered, glow, burnt, explodedOffset, showLabel, rpm?, value?, reading?}`.
  - `Pcb`, `BenchBase`, `IsoCamera`, `InkLights` and `<WobbleClock/>` (mount it once).
  - `setWobble`, `Callout` and `Smoke`.
  - Conventions are in `docs/decisions.md`: origin at the board centre, PCB top at y = 0, connectors face +Z, Uno is `module` with `params.variant:'uno'`.
  - `?gallery&lesson` shows a 40-part sample scene, `src/three/galleryLesson.ts`. Reuse its layout ideas.
- **`src/ui/`**
  - These components are presentational: `Layout`, `Sidebar`, `BenchActions` (`BenchAction` union in `src/ui/types.ts`), `StatusPanel`, `StatusLine`, `Controls` (`Settings`, `PaletteId`, `PALETTES`), `MeetTheBoard`, `TryItYourself`, `Tweaks` (`tweakKey`), `Quiz` and `Toast`.
  - `src/audio/sound.ts` provides `unlockAudio`, `startLofi`/`stopLofi`, `setEffectsEnabled` and `sfx(name, param)`.
  - `App.tsx` currently renders mock data; replace it.
- **Curriculum source:** `docs/curriculum/<TRACK>/<id>.md`, fully specified lessons (parts, netlist, readouts, tweaks, failures, sketch, text, quiz).

## Deliverables
1. **`src/engine/lessonSchema.ts`** — a zod schema that mirrors `Lesson` (element variants may be validated loosely as `type` plus `nodes` plus an `id`), and `validateLesson(l)`, which returns a list of errors. Cross-reference checks:
   - every `circuitIds` entry, `powerElementIds` entry, readout `elementId`, tweak `elementId` and failure patch `elementId` exists
   - quiz `answer` is in range
   - sketch pin maps point at PIN elements
   - part ids are unique
2. **`src/lessons/index.ts`** — `tracks: Track[]` (T0–T7 with names and blurbs), `lessons: Lesson[]`, `getLesson(id)` and `pinned = ['arduino-uno']` (pin it only once that lesson exists; until then pin `led-resistor`).
   - `fig` is assigned by sidebar order.
   - `src/lessons/registry.test.ts` validates every lesson. Every lesson must also reach RUNNING or POWERED in a headless store run (the next item).
3. **`src/engine/bench/assembly.ts`** — a pure reducer, with TDD. Its state:
   ```
   { placed: Set<partId>, soldered: boolean, powered: Record<powerId, boolean>, running: boolean, exploded: boolean, failures: string[], burns: BurnEvent[], disabled: Set<elementId> }
   ```
   - Actions mirror `BenchAction` from `src/ui/types.ts`.
   - Derived:
     - status: BARE PCB, ASSEMBLING, READY, POWERED, RUNNING or FAULT. FAULT applies when any part is burnt.
     - remaining parts
     - "solder needs: …" toast messages
   - Solder needs all THT parts placed. `offboard` parts never need solder. `module` parts count as placed and soldered as units.
   - Power needs solder, except for lessons with no THT parts (breadboard lessons). On a breadboard, nothing needs solder: if a lesson has `board.base === 'breadboard-only'`, skip the solder step.
4. **`src/engine/bench/simLoop.ts`** — framework-agnostic, so it is testable headless. `createBench(lesson, opts)` takes care of the following:
   - **Netlist:** the lesson netlist, then failure patches, then burns, then power state. Power off means `SW` open, or `V` set with `disabled`.
   - **Stepping:** DC solve when the lesson has no dynamic elements and no sketch. Otherwise transient at `lesson.sim?.dt ?? 1e-3`, with `stepsPerFrame` (default `min(30, ceil(frameDt/dt))`) and a speed multiplier.
   - **MCU wiring:** `onPin`, then `transient.setPin`. `readAnalog(pin)` reads the node voltage from `sketch.analogPins`. `readDigital` reads the node voltage above vcc/2.
   - **MCU timing:** advance it in lockstep with sim time (await serially; while one advance is pending, skip MCU advancing that frame rather than queueing).
   - **Behaviors (X3):**
     - `Lesson.behaviors` becomes `Array<string | {id, instance?, params?}>`; update the type.
     - Registry `src/engine/behaviors/index.ts`.
     - `BehaviorContext` gains `params`, `netlist`, `v(node, ref?)`, `mcu {hold, release, reset, injectEdge, serialIn, attachI2c, attachSpi}`, `burn(id, reason)`, `events.push(...)` and `setMotorLoad`.
     - `libraries` are given to the MCU.
     - Add the `behavior` readout source.
     - Add tweak targets `behavior:<instance>.<param>`.
   - **Ratings:** call `checkRatings` each step with `lastGood`. Burns go through `applyBurn` with sound and a toast. Handle thermal shutdown and recovery as disabled-not-burnt.
   - **Readouts:** formatted with `formatSI`, with tone `warn` when a pin warning applies or a status is FAULT.
   - **Status lines:** evaluated from `lesson.statusLines`. Burn and failure explanations take priority.
   - **Output:** a snapshot for the UI, throttled to about 15 Hz.
5. **`src/engine/bench/store.ts`** — a zustand store wrapping `createBench`, plus the following:
   - settings (wobble, palette, labels, lofi, effects), persisted
   - progress (completed lesson ids, quiz scores), persisted with try/catch on localStorage
   - current lesson, from the URL hash `#/lesson/<id>`
   - code-editor text per lesson, persisted
   - toasts
6. **`src/three/Board.tsx` and `src/three/BenchScene.tsx`** — compose the lesson's `BoardSpec` (base, Pcb, parts) with `PartRenderState` derived from the store:
   - **visible** comes from placed. The pick-and-place drop is a 250 ms ease from y + 3, staggered.
   - **glow** for an LED = clamp(I / 20 mA, 0, 1.5).
   - **burnt** comes from burns by `circuitIds`.
   - **explodedOffset** is driven by mount layer and animated.
   - **rpm** for a motor comes from the extra key `<id>.rpm`.
   - **value** for a servo comes from the PIN's `servoDeg`, and for a pot from its pos.
   - **reading** for a multimeter comes from its readout.
   - **Scene:** a Canvas with `IsoCamera` framed to the board size, `InkLights`, `WobbleClock`, and frameloop "always" only while running or animating (otherwise "demand").
7. **`App.tsx`** — wire Layout to the store. Lazy-load `TryItYourself` (CodeMirror), the Gallery and the Canvas chunk. Fix the two parked UI items: move focus into the drawer when it opens, and handle Escape at the document level.
8. **First lesson `src/lessons/T2/led-resistor.ts`** — a faithful translation of `docs/curriculum/T2/led-resistor.md` into data: the board and parts placed sensibly, netlist, readouts, tweaks, failures, sketch, all text and the quiz. Add any behavior it needs.
9. **Tests**
   - **Headless E2E in Vitest** (`simLoop.test.ts`): load led-resistor, then strip → pick-place → place-all → solder → power → upload. Expect RUNNING, an LED current of 12–16 mA while pin 13 is HIGH, and a value under 1 µA while it is LOW. Then break "remove resistor", which should give a burn and FAULT within 0.5 s of sim time.
   - **Playwright `e2e/smoke.spec.ts`**: the same flow in the real UI, using system Chrome (`channel: 'chrome'`, plus the swiftshader flags as in Task C's screenshot approach), and `playwright.config.ts` with webServer `npm run dev`.

## Constraints
- Same as M1. TDD for `assembly.ts` and `simLoop.ts`.
- Use explicit `git add` paths.
- Commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- `npm test`, `npm run build`, `npm run test:e2e` and `npm run graph` must pass.
- Keep the initial JS bundle under 600 kB (lazy chunks are fine).
