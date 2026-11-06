# M1 — Engine plan

Spec: `docs/spec.md`. Contracts: `src/engine/types.ts` (do not change existing fields; add only if needed, and note it in the report).

## Global constraints
- TypeScript strict. `erasableSyntaxOnly`: no `enum`, no `namespace`, no parameter properties. `verbatimModuleSyntax`: use `import type` for types.
- Tests are Vitest, co-located as `*.test.ts`. Engine code follows TDD.
- `npm test` and `npm run build` must both pass before committing.
- No new runtime dependencies beyond those in `package.json` without a strong reason (state it in the report).
- All visual style and copy must be original. The palette and fonts are in spec §2.

## Tasks A–D are independent and run in parallel worktrees. Task E integrates them.

### Task A — Circuit simulator (`src/engine/sim/`)
Implement spec §4.
- **Files:**
  - `mna.ts`: matrix assembly and a Gaussian-elimination solve.
  - `devices.ts`: per-element stamps, including nonlinear companions.
  - `solve.ts`: `solveDC(netlist, opts?)`.
  - `transient.ts`: `createTransient(netlist, dt)` returning `{ step(): Solution; t: number; setParam(id,key,value); setPin(pin, state: PinState); setNetlist(n) }`.
  - `ratings.ts`: `checkRatings(netlist, solution, t, state) → BurnEvent[]`. Over-limit must persist for 300 ms of sim time, except overvoltage, which is instant. PIN abs max is 40 mA.
  - `failures.ts`: `applyPatches(netlist, patches) → Netlist`, which is pure. `applyBurn(netlist, burn) → Netlist`: open = remove the element or set R to 1e9; short = replace with 0.01 Ω between nodes[0] and nodes[1] (for transistors, C to E or D to S).
  - `format.ts`: `formatSI(value, unit, digits=2)`, e.g. 0.0043 A → "4.3 mA", 4700 Ω → "4.7 kΩ", 1e-6 → "1.0 µA".
  - `index.ts` re-exports everything.
- **Device notes:**
  - PIN: OUTPUT is a source of level·vcc behind rOut (25 Ω). INPUT is 1e9 Ω. INPUT_PULLUP is vcc through 35 kΩ.
  - LED: Vf at 20 mA is within ±0.1 V of red 1.8, yellow 2.0, green 2.1, blue 2.9 and white 2.9.
  - NPN: use β (default 100) with Ebers-Moll, enough for saturation and cutoff.
  - MOTOR: in DC solve, the motor is at steady state. In transient it carries mechanical state; publish `extra[id+'.omega']` and `extra[id+'.rpm']`.
- **Required tests:**
  - Voltage divider: 5 V across 1 kΩ + 1 kΩ gives 2.5 V.
  - LED + 220 Ω on 5 V: red current about 14 mA (12–16 mA).
  - Remove the resistor (5 V straight across a red LED): above 0.1 A, and `checkRatings` produces an overcurrent burn after 300 ms of transient.
  - RC: 1 kΩ, 1 mF, 5 V step gives 63% ± 2% at t = τ.
  - NPN switch: 5 V pin, 1 kΩ base, 5 V supply, 100 Ω load. Ic is about 47 mA and Vce < 0.3 V when the pin is HIGH; Ic < 1 µA when LOW.
  - NMOS: Vgs = 5 V, Vth = 2 gives load current at about V/R.
  - Motor: steady-state ω ≈ (V - I·R)/ke.
  - Floating nodes don't crash (gmin).
  - `formatSI` cases.

### Task B — Arduino transpiler and virtual MCU (`src/engine/mcu/`)
Implement spec §5.
- **Files:**
  - `transpile.ts`: `transpile(src: string) → { js: string; warnings: string[] }`, which throws `TranspileError {line, message}`. Use a careful tokenizer-based approach rather than naive regex over the whole file: strip comments, handle strings, and handle typed declarations, including `int a = 1, b[3] = {1,2,3};`.
  - `virtualMcu.ts`: `class VirtualMcu`.
    - Constructor: `{ vcc, onPin(pin, PinState), readAnalog(pin): number (volts), readDigital(pin): 0|1, serial(line), libraries?: Record<string,unknown> }`.
    - Methods: `load(src)`, `start()`, `stop()`, `advance(ms)`. `advance` runs the program until virtual time has advanced by `ms`. `delay()` returns a promise that resolves when virtual time reaches the target. `millis()` returns virtual time.
    - Guard against infinite loops with no delay: after 1e6 statements per advance, yield (insert counter checks in loop bodies during transpile), and report "loop() never waits — added an implicit 1 ms pause".
  - `constants.ts`: HIGH, LOW, INPUT, OUTPUT, INPUT_PULLUP, LED_BUILTIN = 13, A0–A5 = 14–19 (Uno), PI.
  - `index.ts` re-exports.
- **Behaviour:**
  - `analogWrite(pin, v)` sets PWM level v/255.
  - `analogRead` returns round(V/vcc · 1023).
  - `Servo` is a built-in class whose `write(deg)` calls onPin with mode 'OUTPUT' and level deg/180, plus a `servo` flag in PinState (add `servoDeg?: number` to PinState in types.ts).
- **Required tests:**
  - The Blink sketch toggles pin 13 every 1000 ms of virtual time.
  - A fade loop using `analogWrite` with a `for` loop.
  - `Serial.println` output.
  - User functions with params and return values.
  - Arrays and `#define`.
  - A syntax error reports the right line.
  - An infinite loop without delay doesn't hang the test (completes in under 1 s).
  - `map`/`constrain`.

### Task C — 3D look and parametric part library (`src/three/`)
Implement spec §2 (3D) and the part kinds in `PartKind`.
- **Files:**
  - `ink.tsx`: `<InkMesh>`, a wrapper giving toon material + drei `<Outlines>`. Takes props for colour and an optional emissive glow.
  - `wobble.ts`: injects a vertex displacement into the toon material through `onBeforeCompile`, driven by a shared uniform store with `setWobble(0..1)` and time.
  - `IsoCamera.tsx`: orthographic iso camera plus clamped OrbitControls.
  - `parts/*.tsx`: one component per PartKind group. Props: `{ part: PartPlacement; state: PartRenderState }`, where `PartRenderState = { visible: boolean; soldered: boolean; glow: number /*0..1*/; burnt: boolean; explodedOffset: number; showLabel: boolean }`.
  - `parts/index.ts`: `partRegistry: Record<PartKind, Component>`.
  - `Pcb.tsx`: PCB with solder mask, silkscreen name, pads and traces.
  - `BenchBase.tsx`: a cutting-mat base.
  - `Callout.tsx`: drei `Html` label with a leader line.
  - `Smoke.tsx`: a puff for burnt parts.
  - `src/three/Gallery.tsx`: a dev page rendering every PartKind in a grid with labels. It is reachable through `?gallery` in the URL. Wire it in `main.tsx`: if `location.search` includes `gallery`, render Gallery; otherwise render App.
- **Fidelity bar:** these should be recognisable, stylised, low-poly models.
  - Resistor: tan body with colour bands from `params.ohms`, using a correct colour-code helper in `src/three/colorCode.ts` with a unit test.
  - LED: dome lens and two legs, glowing from `state.glow`.
  - Electrolytic: can with a stripe.
  - DIP: pins along both sides.
  - TO-92 and TO-220: correct shapes.
  - Motor: a can with a shaft. The wheel spins from `params.rpm`, or a live value passed through `state`.
  - Breadboard: hole grid and rails.
  - Arduino-style module boards: built from primitives.
- Units: 1 unit = 10 mm. Real-ish proportions.

### Task D — App shell, theme, controls and sound (`src/ui/`, `src/audio/`, `src/styles/`)
- `src/styles/theme.css`:
  - CSS tokens from spec §2, the dot-grid paper background, and Google Fonts (IBM Plex Mono, Fraunces) loaded in `index.html`.
  - Responsive: the sidebar collapses to a top drawer below 900 px.
- **UI components.** They are presentational and take props only; Task E wires the store.
  - `Sidebar.tsx`: tracks → lessons, pinned "Start here", ✓ for completed, active highlight.
  - `BenchActions.tsx`: buttons as in spec §1, with disabled states and dropdowns for "Place a part ▸" and "Break something ▸".
  - `StatusPanel.tsx`: PARTS, STATUS and the readouts list.
  - `StatusLine.tsx`.
  - `Controls.tsx`: wobble slider, 5 palette swatches, labels toggle, Lo-fi and Effects toggles.
  - `MeetTheBoard.tsx`: rendered with `marked`, plus the mechanical analogy box and pro tips.
  - `TryItYourself.tsx`: CodeMirror with C++ mode, an Upload button, a serial monitor box and an error line.
  - `Tweaks.tsx`: sliders, including a log mode.
  - `Quiz.tsx`: one question at a time with feedback and `why`; calls onComplete(score).
  - `Toast.tsx`.
  - `Layout.tsx`: arranges everything with a slot for the 3D canvas.
- `src/audio/sound.ts`: WebAudio only.
  - `startLofi()`/`stopLofi()`: an original procedural loop. Soft Rhodes-like chords from a 4-chord progression made with detuned sine/triangle oscillators, a vinyl-crackle noise layer and a gentle kick/hat, at low volume.
  - `sfx(name)` for 'click', 'place', 'solder' (filtered noise hiss), 'plug', 'pop' (burn), 'whir' (motor, with pitch from a param) and 'success'.
  - The AudioContext is created lazily on the first user gesture.
- `src/App.tsx`: renders `Layout` with mock data so the shell is viewable on its own (Task E replaces the mock).
- Visually polished and original. Check at 1440 px and 390 px widths.

### Task E — Integration (after A–D are merged)
- `src/engine/lessonSchema.ts`: zod schema that mirrors `Lesson`. `validateLesson`. A test validates every lesson in the registry.
- `src/lessons/index.ts`: registry, `tracks`, and `getLesson(id)`.
- `src/engine/bench/`:
  - `assembly.ts`: pure reducer with stages, actions and derived status. TDD.
  - `store.ts`: zustand store holding the lesson, assembly state, power, netlist with patches and burns, the sim loop (requestAnimationFrame stepping with transient dt = 1 ms, up to 30 steps per frame; DC solve when there are no dynamic elements), MCU wiring, behaviours, readouts, status line, settings (wobble, palette, labels, sound) and progress (localStorage).
- `src/engine/behaviors/index.ts`: registry, empty for now.
- `src/three/Board.tsx`: composes a lesson's `BoardSpec` with `PartRenderState` derived from the store. Includes the exploded-view animation, the pick-and-place drop animation, and glow from LED current (glow = clamp(I/20 mA)).
- First lesson `src/lessons/T2/led-resistor.ts`:
  - Uno-style board area + breadboard, red LED + 220 Ω on pin 13.
  - Blink sketch.
  - Failures: remove the resistor, swap in a 22 Ω resistor, reverse the LED.
  - Full meet, analogy, tips and quiz.
- Playwright `e2e/smoke.spec.ts`: loads the lesson, then Strip → Pick&Place → Place all → Solder → Plug → Upload. Asserts status RUNNING and a non-zero LED current.
