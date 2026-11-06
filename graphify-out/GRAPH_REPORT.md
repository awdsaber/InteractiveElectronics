# Graph Report - agent-ae8df485c354d1266  (2026-11-07)

## Corpus Check
- 173 files · ~214,448 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 7 file(s) not represented in the graph (top: (none) 4, .css 3)

## Summary
- 2341 nodes · 4981 edges · 118 communities (110 shown, 8 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 265 edges (avg confidence: 0.92)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ad11af98`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- devices.ts
- transient.ts
- Capstone: Two-Wheel Balancer
- ADC, DAC and PWM
- solve.ts
- deploy.yml
- sound.ts
- runtime.ts
- transpile.ts
- package.json
- constants.ts
- compilerOptions
- .start
- ratings.ts
- createBench
- boards.tsx
- compilerOptions
- A4988 Stepper Driver
- transient.ts
- Quadrature Encoders
- lessons/index.ts
- NTC Thermistor
- MPU-6050 IMU
- PID Motor Speed Control
- Power, Grounding and EMC
- UART, I²C and SPI
- Thermal Design
- LED and Resistor
- The Transistor Switch
- Arduino Uno R3
- ESP32-S3 DevKitC-1
- L298N Module
- TB6612FNG Dual H-Bridge
- passives.tsx
- InkMesh
- store.ts
- Bench
- PCB Design Workflow
- Soldering and Rework
- The MOSFET Switch
- Linear and Buck Regulators
- VirtualMcu
- Lesson
- .oxlintrc.json
- led-resistor.ts
- Batteries
- The Breadboard
- Charge, Voltage and Current
- Kirchhoff's Laws
- Ohm's Law
- AC and the Oscilloscope
- React + TypeScript + Vite
- Capacitors and RC Time
- RLC Resonance
- Op-Amp Basics
- Flip-Flops and Counters
- Logic Gates
- Interrupts and Timers
- tsconfig.json
- Power and Heat
- Series and Parallel
- Inductors and RL Time
- Resistor Codes and Dividers
- The Transformer
- Diodes and Rectifiers
- The Zener Regulator
- The 555 Timer
- PCA9685 Servo Driver
- ui/types.ts
- wobble.ts
- HC-SR04 Ultrasonic Ranger
- Transpiler
- esp32-s3.ts
- motion.tsx
- dependencies
- Tweaks.tsx
- scripts
- assembly.ts
- ink.tsx
- wifi-sim.ts
- .serviceIrq
- Debugging Instruments
- semis.tsx
- common.tsx
- Gallery.tsx
- misc.tsx
- str
- three/index.ts
- Layout.tsx
- EventQueue
- lessonSchema.ts
- Behavior
- esp32Bench.ts
- frame.tsx
- extensions.test.ts
- bake.tsx
- Load Cell and HX711
- Adafruit_PWMServoDriver
- 5. Virtual MCU (`src/engine/mcu`)
- formatSI
- AppState
- The context (`BehaviorContext`, `src/engine/types.ts`)
- BehaviorMcu
- Failures
- Circuit Atelier — interactive electronics course
- simLoop.test.ts
- rgbGlow.test.ts
- TryItYourself.tsx
- tht
- Settings
- Failures
- M2 — Video lessons (parallel authors)
- Failures
- M1.5 — Engine extensions (triaged from the curriculum SIM NOTEs)
- @vitejs/plugin-react
- Failures
- @playwright/test

## God Nodes (most connected - your core abstractions)
1. `VirtualMcu` - 67 edges
2. `InkMesh()` - 63 edges
3. `createBench()` - 56 edges
4. `geo()` - 44 edges
5. `tht()` - 43 edges
6. `str()` - 43 edges
7. `Block()` - 42 edges
8. `num()` - 39 edges
9. `vitest` - 33 edges
10. `What exists on main (use graphify to explore)` - 33 edges

## Surprising Connections (you probably didn't know these)
- `SIM NOTE` --references--> `VirtualMcu`  [INFERRED]
  docs/curriculum/T4/arduino-uno.md → src/engine/mcu/virtualMcu.ts
- `Engine requirements gathered from SIM NOTEs` --references--> `applyPatches()`  [INFERRED]
  docs/curriculum/README.md → src/engine/sim/failures.ts
- `X1 — Simulator (`src/engine/sim/`)` --references--> `applyPatches()`  [INFERRED]
  docs/plans/m1.5-engine-extensions.md → src/engine/sim/failures.ts
- `SIM NOTE` --references--> `checkRatings()`  [INFERRED]
  docs/curriculum/T1/transformer.md → src/engine/sim/ratings.ts
- `SIM NOTE` --references--> `PinState`  [INFERRED]
  docs/curriculum/T5/pca9685-servo.md → src/engine/types.ts

## Import Cycles
- None detected.

## Communities (118 total, 8 thin omitted)

### Community 0 - "devices.ts"
Cohesion: 0.05
Nodes (78): BJT_BETA, BJT_BETA_R, BJT_IS, bjtEval(), BK, BREAK_KNEE, BREAK_RZ, breakEval() (+70 more)

### Community 1 - "transient.ts"
Cohesion: 0.07
Nodes (43): SIM NOTE, vitest, modules, registry, resolveBehaviorRef(), ResolvedBehavior, AssemblyState, DYNAMIC (+35 more)

### Community 2 - "Capstone: Two-Wheel Balancer"
Cohesion: 0.14
Nodes (13): Behaviors, Board, Capstone: Two-Wheel Balancer, Circuit, For mechanical engineers, Learning goals, Meet the board, Pro tips (+5 more)

### Community 3 - "ADC, DAC and PWM"
Cohesion: 0.06
Nodes (32): Board, Circuit, F1: Use an old analog meter (20 kΩ/V on the 10 V range), F2: Measure volts with the red lead still in the mA jack, F3: The bottom resistor falls out while you measure, Failures, For mechanical engineers, Learning goals (+24 more)

### Community 4 - "solve.ts"
Cohesion: 0.08
Nodes (31): PinEvent, Widget, GMIN, IP, measureCurrentPower(), Measured, StampCtx, clearSystem() (+23 more)

### Community 5 - "deploy.yml"
Cohesion: 0.06
Nodes (31): runs-on, steps, concurrency, cancel-in-progress, group, environment, needs, runs-on (+23 more)

### Community 6 - "sound.ts"
Cohesion: 0.15
Nodes (28): Task D — App shell, theme, controls and sound (`src/ui/`, `src/audio/`, `src/styles/`), What exists on main (use graphify to explore), BASS, BEATS_PER_CHORD, beatSeconds(), BPM, chordSeconds(), HAT_STEPS (+20 more)

### Community 7 - "runtime.ts"
Cohesion: 0.09
Nodes (33): arduinoMap(), arduinoRound(), bitClearFn(), bitSetFn(), bitWriteFn(), castInt(), CharBox, chr() (+25 more)

### Community 8 - "transpile.ts"
Cohesion: 0.07
Nodes (40): ARDUINO_CONSTANTS, BUILTIN_NAMES, UNSUPPORTED_API, errorOf(), AWAITED, BIT_OPS, charCode(), checkCompiles() (+32 more)

### Community 9 - "package.json"
Cohesion: 0.12
Nodes (22): devDependencies, jsdom@^31.0.0, oxlint@^1.90.0, @types/node@^24.19.2, @types/react@^19.3.0, @types/react-dom@^19.3.0, @types/three@^0.187.0, typescript@~7.0.2 (+14 more)

### Community 10 - "constants.ts"
Cohesion: 0.05
Nodes (48): A0, A1, A2, A3, A4, A5, A6, A7 (+40 more)

### Community 11 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+11 more)

### Community 12 - ".start"
Cohesion: 0.16
Nodes (10): Behaviors, Global constraints, M1 — Engine plan, Task A — Circuit simulator (`src/engine/sim/`), Task B — Arduino transpiler and virtual MCU (`src/engine/mcu/`), Task C — 3D look and parametric part library (`src/three/`), Tasks A–D are independent and run in parallel worktrees. Task E integrates them., makeRng() (+2 more)

### Community 13 - "ratings.ts"
Cohesion: 0.09
Nodes (24): BURN_DELAY, checkRatings(), curOf(), DEFAULT_RATINGS, fire(), mean(), nextTj(), part() (+16 more)

### Community 14 - "createBench"
Cohesion: 0.13
Nodes (28): describeBurn, createBench(), act(), applyPin(), buildNetlist(), defaultLine(), dispatch(), emit() (+20 more)

### Community 15 - "boards.tsx"
Cohesion: 0.10
Nodes (46): Art, At(), boardArt(), BoardSlab(), Breadboard, breadboardArt(), BreadboardBody(), breadboardHole() (+38 more)

### Community 16 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 17 - "A4988 Stepper Driver"
Cohesion: 0.11
Nodes (18): A4988 Stepper Driver, Behaviors, Board, Circuit, F1: No current limit (trimmer at the stop), F2: Unplug the motor while powered, F3: MS wires fall off, Failures (+10 more)

### Community 18 - "transient.ts"
Cohesion: 0.12
Nodes (30): blankParams(), branchCount(), compile(), Dev, extraKeys(), extraNodes(), hasInternalNode(), inheritState() (+22 more)

### Community 19 - "Quadrature Encoders"
Cohesion: 0.11
Nodes (18): Behaviors, Board, Circuit, F1: Missing pull-ups, F2: A and B swapped, F3: Overdrive it on 12 V with noisy wiring, Failures, For mechanical engineers (+10 more)

### Community 20 - "lessons/index.ts"
Cohesion: 0.17
Nodes (11): App(), BenchScene, summaries, defaultLessonId, lessonDefs, lessons, modules, PIN_ORDER (+3 more)

### Community 21 - "NTC Thermistor"
Cohesion: 0.11
Nodes (18): Behaviors, Board, Circuit, F1: Wrong part on the reel (B = 3435 K), code still says 3977, F2: Thermistor lead breaks, F3: A 1 kΩ resistor fitted instead of 10 kΩ, Failures, For mechanical engineers (+10 more)

### Community 22 - "MPU-6050 IMU"
Cohesion: 0.13
Nodes (14): Behaviors, Circuit, For mechanical engineers, Learning goals, Meet the board, MPU-6050 IMU, Pro tips, Quiz (+6 more)

### Community 23 - "PID Motor Speed Control"
Cohesion: 0.11
Nodes (17): Behaviors, Board, Circuit, F1: Encoder A/B swapped (positive feedback), F2: Encoder pull-ups missing (lost feedback), F3: Tired battery (actuator saturation), Failures, For mechanical engineers (+9 more)

### Community 24 - "Power, Grounding and EMC"
Cohesion: 0.13
Nodes (14): Behaviors, Board, Circuit, For mechanical engineers, Learning goals, Meet the board, Power, Grounding and EMC, Pro tips (+6 more)

### Community 25 - "UART, I²C and SPI"
Cohesion: 0.12
Nodes (16): Board, F1: Analyzer (or monitor) at the wrong baud, F2: 47 kΩ pull-ups at 400 kHz, F3: Pull-ups missing, Failures, For mechanical engineers, Learning goals, Meet the board (+8 more)

### Community 26 - "Thermal Design"
Cohesion: 0.11
Nodes (18): Behaviors, Board, Circuit, F1: Remove the heatsink, F2: Run it from 24 V, F3: Mount it dry (no grease, poor contact), Failures, For mechanical engineers (+10 more)

### Community 27 - "LED and Resistor"
Cohesion: 0.12
Nodes (17): Board, Circuit, F1: Leave the resistor out (jumper in its place), F2: 22 Ω fitted instead of 220 Ω (red-red-black), F3: LED in backwards, Failures, For mechanical engineers, Learning goals (+9 more)

### Community 28 - "The Transistor Switch"
Cohesion: 0.11
Nodes (18): Board, Circuit, F1: Remove the flyback diode, F2: Skip the base resistor, F3: Stall the motor, F4: Forget the common ground, Failures, For mechanical engineers (+10 more)

### Community 29 - "Arduino Uno R3"
Cohesion: 0.11
Nodes (17): Arduino Uno R3, Behaviors, Circuit, F1: Drive a motor straight off pin 9, F2: Bypass the 220 Ω resistor, F3: Short 5 V to GND on the header, F4: Feed 12 V into the 5 V pin, Failures (+9 more)

### Community 30 - "ESP32-S3 DevKitC-1"
Cohesion: 0.11
Nodes (18): Behaviors, Circuit, ESP32-S3 DevKitC-1, F1: Wire a 5 V signal straight into GPIO4, F2: LED with no resistor on GPIO5, F3: Button on GPIO0 held at power-up, Failures, For mechanical engineers (+10 more)

### Community 31 - "L298N Module"
Cohesion: 0.11
Nodes (17): Behaviors, Circuit, F1: Remove the flyback diodes, then stop, F2: Run two motors at 1.5 A without the heatsink, F3: Run it from a single Li-ion cell (3.7 V), Failures, For mechanical engineers, L298N Module (+9 more)

### Community 32 - "TB6612FNG Dual H-Bridge"
Cohesion: 0.14
Nodes (13): Behaviors, Circuit, For mechanical engineers, Learning goals, Meet the board, Pro tips, Quiz, Readouts (+5 more)

### Community 33 - "passives.tsx"
Cohesion: 0.13
Nodes (27): BAND_HEX, BandColor, BandOptions, capacitorCode(), DIGIT_COLORS, parseOhms(), resistorBands(), sigExp() (+19 more)

### Community 34 - "InkMesh"
Cohesion: 0.19
Nodes (37): InkMesh(), LoadCellBody(), UltrasonicBody(), Block(), CylY(), Decal(), deg(), LeadPath() (+29 more)

### Community 35 - "store.ts"
Cohesion: 0.26
Nodes (14): asCode(), asProgress(), asSettings(), debounce(), DEFAULT_SETTINGS, isRecord(), lessonFromHash(), loadJSON() (+6 more)

### Community 36 - "Bench"
Cohesion: 0.10
Nodes (11): SfxName, runFor(), runUntil(), AssemblyAction, Note, lesson(), Bench, runUntil() (+3 more)

### Community 37 - "PCB Design Workflow"
Cohesion: 0.11
Nodes (17): Behaviors, Circuit, F1: Forgot the CC resistors, F2: Solder bridge from PB5 to the neighbouring GND pin, F3: LED footprint drawn backwards, Failures, For mechanical engineers, Learning goals (+9 more)

### Community 38 - "Soldering and Rework"
Cohesion: 0.12
Nodes (15): F1: Cold joint on J2, F2: Solder bridge between pads D5 and D6, F3: Lifted pad on J3 (overheated during rework), Failures, For mechanical engineers, Learning goals, Meet the board, Pro tips (+7 more)

### Community 39 - "The MOSFET Switch"
Cohesion: 0.12
Nodes (16): Board, Circuit, F1: A standard (non-logic-level) MOSFET on a 3.3 V GPIO, F2: The MOSFET fails short, F3: Forget the common ground, Failures, For mechanical engineers, Learning goals (+8 more)

### Community 40 - "Linear and Buck Regulators"
Cohesion: 0.12
Nodes (16): Board, Circuit, F1: Ask the linear regulator for 1 A, F2: Feed it only 6 V (dropout), F3: Switch to a 24 V supply, Failures, For mechanical engineers, Learning goals (+8 more)

### Community 42 - "Lesson"
Cohesion: 0.14
Nodes (10): Circuit Atelier: Curriculum (T0–T3), Engine requirements gathered from SIM NOTEs, File format, Order and prerequisites, Prerequisite graph (summary), Rating conventions used throughout, T0 Foundations, T1 Passives (+2 more)

### Community 43 - ".oxlintrc.json"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 44 - "led-resistor.ts"
Cohesion: 0.11
Nodes (20): patch, BB_H, bbHole(), BENCH_Y, between(), PITCH, UNO, BB (+12 more)

### Community 45 - "Batteries"
Cohesion: 0.12
Nodes (15): Batteries, Board, Circuit, F1: Keys in the pocket (terminals shorted), F2: A tired battery, F3: Chase maximum power, Failures, For mechanical engineers (+7 more)

### Community 46 - "The Breadboard"
Cohesion: 0.12
Nodes (15): Board, Circuit, F1: Both resistor legs pushed into row 10, F2: LED legs in the same strip, F3: Split ground rail, F4: A jumper lands in row 15 instead of row 10, Failures, For mechanical engineers (+7 more)

### Community 47 - "Charge, Voltage and Current"
Cohesion: 0.12
Nodes (15): Board, Charge, Voltage and Current, Circuit, F1: Open the loop, F2: Bypass the resistor with a jumper, F3: Put the cells in backwards, Failures, For mechanical engineers (+7 more)

### Community 48 - "Kirchhoff's Laws"
Cohesion: 0.13
Nodes (15): Board, Circuit, F1: Turn channel 1 up to 12 V, F2: The sink arm goes open, F3: Short node A to ground, Failures, For mechanical engineers, Kirchhoff's Laws (+7 more)

### Community 49 - "Ohm's Law"
Cohesion: 0.12
Nodes (15): Board, Circuit, F1: 12 V into 100 Ω, F2: Misread colour bands (10 Ω fitted instead of 1 kΩ), F3: Resistor lead pulls out of the board, Failures, For mechanical engineers, Learning goals (+7 more)

### Community 50 - "AC and the Oscilloscope"
Cohesion: 0.12
Nodes (15): AC and the Oscilloscope, Board, Circuit, F1: Add a 5 V DC offset, F2: Turn the frequency up to 500 Hz, F3: Load the generator with 47 Ω, Failures, For mechanical engineers (+7 more)

### Community 51 - "React + TypeScript + Vite"
Cohesion: 0.50
Nodes (3): Expanding the Oxlint configuration, React Compiler, React + TypeScript + Vite

### Community 52 - "Capacitors and RC Time"
Cohesion: 0.12
Nodes (15): Board, Capacitors and RC Time, Circuit, F1: Plug it into 24 V, F2: Swap in 1000 µF, F3: A leaky capacitor, Failures, For mechanical engineers (+7 more)

### Community 53 - "RLC Resonance"
Cohesion: 0.12
Nodes (15): Board, Circuit, F1: Take the damping resistor out, F2: Hot-plug 12 V into a 16 V ceramic filter, F3: The capacitor fails short, Failures, For mechanical engineers, Learning goals (+7 more)

### Community 54 - "Op-Amp Basics"
Cohesion: 0.12
Nodes (15): Board, Circuit, F1: Feedback resistor drops out, F2: Too much gain (R_F = 1 MΩ), F3: Inputs swapped, Failures, For mechanical engineers, Learning goals (+7 more)

### Community 55 - "Flip-Flops and Counters"
Cohesion: 0.12
Nodes (15): Board, Circuit, F1: Press SET and RESET together, F2: Cut one cross-coupling link, F3: Remove the debounce capacitor, Failures, Flip-Flops and Counters, For mechanical engineers (+7 more)

### Community 56 - "Logic Gates"
Cohesion: 0.12
Nodes (15): Board, Circuit, F1: Forget the pull-down on input A, F2: Short the output to ground, F3: Run the discrete gate from 3 V, Failures, For mechanical engineers, Learning goals (+7 more)

### Community 57 - "Interrupts and Timers"
Cohesion: 0.12
Nodes (15): Board, Circuit, F1: Remove the debounce capacitor, F2: Leave out the tach pull-up, F3: Spin the wheel at 300 kHz, Failures, For mechanical engineers, Interrupts and Timers (+7 more)

### Community 59 - "Power and Heat"
Cohesion: 0.13
Nodes (14): Board, Circuit, F1: 47 Ω on 5 V, F2: Same resistor, supply turned up to 12 V, F3: Fit a 2 W resistor instead, Failures, For mechanical engineers, Learning goals (+6 more)

### Community 60 - "Series and Parallel"
Cohesion: 0.13
Nodes (14): Board, Circuit, F1: R3 goes open, F2: Solder bridge shorts the parallel pair, F3: Someone adds a 100 Ω resistor across R2, Failures, For mechanical engineers, Learning goals (+6 more)

### Community 61 - "Inductors and RL Time"
Cohesion: 0.12
Nodes (15): Board, Circuit, F1: Remove the flyback diode, then open the switch, F2: Fit the flyback diode backwards, F3: Too little series resistance, Failures, For mechanical engineers, Inductors and RL Time (+7 more)

### Community 62 - "Resistor Codes and Dividers"
Cohesion: 0.13
Nodes (14): Board, Circuit, F1: Hang a 1 kΩ sensor input on the output, F2: Bottom resistor drops out, F3: Misread band: yellow-violet-orange (47 kΩ) fitted, Failures, For mechanical engineers, Learning goals (+6 more)

### Community 63 - "The Transformer"
Cohesion: 0.12
Nodes (15): Board, Circuit, F1: Short the secondary, F2: Overload: 6 Ω instead of 12 Ω, F3: Unload it, Failures, For mechanical engineers, Learning goals (+7 more)

### Community 64 - "Diodes and Rectifiers"
Cohesion: 0.12
Nodes (15): Board, Circuit, Diodes and Rectifiers, F1: One diode goes open, F2: Leave out the smoothing capacitor, F3: A diode fails short, Failures, For mechanical engineers (+7 more)

### Community 65 - "The Zener Regulator"
Cohesion: 0.12
Nodes (15): Board, Circuit, F1: Plug in a 15 V adapter, F2: Ask for too much current (100 Ω load), F3: Zener fitted backwards, Failures, For mechanical engineers, Learning goals (+7 more)

### Community 66 - "The 555 Timer"
Cohesion: 0.12
Nodes (15): Board, Circuit, F1: Leave out R1 (pin 7 tied straight to V_CC), F2: Remove the timing capacitor, F3: Run it from two AA cells, Failures, For mechanical engineers, Learning goals (+7 more)

### Community 67 - "PCA9685 Servo Driver"
Cohesion: 0.12
Nodes (15): F1: Power the servos from the Uno's 5 V pin, F2: No common ground, F3: Breakout without I²C pull-ups, Failures, For mechanical engineers, Learning goals, Meet the board, PCA9685 Servo Driver (+7 more)

### Community 68 - "ui/types.ts"
Cohesion: 0.20
Nodes (15): BenchSnapshot, BenchStatus, BenchActions(), BenchActionsProps, MenuButton(), MenuButtonProps, MenuItem, StatusPanel() (+7 more)

### Community 69 - "wobble.ts"
Cohesion: 0.12
Nodes (25): @react-three/fiber@^9.8.2, @react-three/fiber, Lesson, BenchScene(), BenchSceneProps, Camera(), fitZoom(), WobbleTicker() (+17 more)

### Community 70 - "HC-SR04 Ultrasonic Ranger"
Cohesion: 0.11
Nodes (18): Behaviors, Board, Circuit, F1: Cold morning, code still assumes 20 °C, F2: ECHO wire falls off, F3: A second ranger pinging at the same time, Failures, For mechanical engineers (+10 more)

### Community 71 - "Transpiler"
Cohesion: 0.18
Nodes (6): castPrefix(), intWrapper(), isFloatLit(), jsName(), kindOf(), Transpiler

### Community 72 - "esp32-s3.ts"
Cohesion: 0.10
Nodes (23): Behaviors, Board, Circuit, BB, DK, j1(), j3(), ledAnode (+15 more)

### Community 73 - "motion.tsx"
Cohesion: 0.12
Nodes (33): chamferRectShape(), extrudeAlongX(), extrudeUp(), flattedCircleShape(), geo(), stadiumShape(), boardGeo(), CylZ() (+25 more)

### Community 74 - "dependencies"
Cohesion: 0.18
Nodes (11): dependencies, marked@^18.1.3, react@^19.3.1, react-dom@^19.3.1, three@^0.187.0, zod@^4.6.7, zustand@^5.1.0, marked (+3 more)

### Community 75 - "Tweaks.tsx"
Cohesion: 0.33
Nodes (8): Tweak, PREFIXES, siLabel(), sliderToValue(), valueToSlider(), tweakKey(), Tweaks(), TweaksProps

### Community 76 - "scripts"
Cohesion: 0.22
Nodes (9): scripts, build, dev, graph, lint, preview, test, test:e2e (+1 more)

### Community 77 - "assembly.ts"
Cohesion: 0.19
Nodes (24): allPlaced(), AssemblyEvent, AssemblyResult, benchStatus(), buildParts(), burnText(), clone(), handPlaced() (+16 more)

### Community 78 - "ink.tsx"
Cohesion: 0.12
Nodes (25): edgesGeometry(), GroupProps, HullHost, INK_PX, InkContext, InkInstancesProps, InkMeshProps, InkState (+17 more)

### Community 79 - "wifi-sim.ts"
Cohesion: 0.13
Nodes (16): behavior, frameAverageCurrent(), fresh(), I_AVG, I_BURST, I_IDLE, MODES, num() (+8 more)

### Community 81 - "Debugging Instruments"
Cohesion: 0.09
Nodes (22): Behaviors, Board, Circuit, Debugging Instruments, F1: Measure the 5 V rail with the leads still in the mA jack, F2: Scope ground clip on the 5 V rail, F3: Trust the DMM on the 10 MΩ divider, Failures (+14 more)

### Community 82 - "semis.tsx"
Cohesion: 0.15
Nodes (21): extrudeAlongZ(), mergedBoxes(), ledLook(), loadCellGeo(), GlowHalo(), dipPinGeo(), gullGeo(), Heatsink (+13 more)

### Community 83 - "common.tsx"
Cohesion: 0.08
Nodes (40): react, three, BenchBase(), BenchBaseProps, gridTile(), rulerStrip(), cache, disposeOutline() (+32 more)

### Community 84 - "Gallery.tsx"
Cohesion: 0.10
Nodes (27): SIM NOTE, PartKind, Gallery, showGallery, btn, Check(), DrawStats(), ENTRIES (+19 more)

### Community 85 - "misc.tsx"
Cohesion: 0.20
Nodes (16): lathe(), wireColor(), Rod(), handleGeo(), LogicIcLabel, loopGeo(), MODES, Multimeter (+8 more)

### Community 86 - "str"
Cohesion: 0.13
Nodes (31): InkInstances(), BoxInstances(), HeaderFemaleBody(), HeaderMaleBody(), microGeo(), microMouthGeo(), microShape(), MicroUsbBody() (+23 more)

### Community 87 - "three/index.ts"
Cohesion: 0.14
Nodes (22): @react-three/drei@^10.7.9, @react-three/drei, CALLOUT_REF_ZOOM, CalloutProps, CalloutTone, TONE, Vec3, ISO_AZIMUTH_DEG (+14 more)

### Community 88 - "Layout.tsx"
Cohesion: 0.15
Nodes (19): QuizItem, Track, TrackId, SettingChange, EditorFallback(), Layout(), LayoutProps, TryItYourself (+11 more)

### Community 90 - "lessonSchema.ts"
Cohesion: 0.10
Nodes (20): behaviorRef, COMMON_KEYS, element, hasKey(), lessonSchema, node, num, OPTIONAL_KEYS (+12 more)

### Community 91 - "Behavior"
Cohesion: 0.13
Nodes (9): enterDownload(), leave(), num(), ROM_LINES, sample(), state(), states, BenchOptions (+1 more)

### Community 92 - "esp32Bench.ts"
Cohesion: 0.15
Nodes (10): behavior, reg, benchOf(), esp32Lesson(), FRAME, powerAndRun(), behavior, State (+2 more)

### Community 93 - "frame.tsx"
Cohesion: 0.08
Nodes (41): Decisions, Task E — Integration (after A–D are merged), BoardSpec, PartPlacement, Anim, easeOut(), LED_KINDS, MOTOR_KINDS (+33 more)

### Community 94 - "extensions.test.ts"
Cohesion: 0.29
Nodes (7): harness(), PinEvent, quadEdges(), run(), runSketch(), sensor(), Thing

### Community 95 - "bake.tsx"
Cohesion: 0.20
Nodes (14): Bake(), bakeable(), BAKED_INK_PX, bakeGroup(), BakeResult, Bucket, isHullHost(), linesOf() (+6 more)

### Community 96 - "Load Cell and HX711"
Cohesion: 0.12
Nodes (15): F1: S+ and S− swapped, F2: Overload it with 10 kg, F3: Excite the bridge from 5 V instead of AVDD, Failures, For mechanical engineers, Learning goals, Load Cell and HX711, Meet the board (+7 more)

### Community 97 - "Adafruit_PWMServoDriver"
Cohesion: 0.15
Nodes (7): Behaviors, Circuit, Behaviors, Circuit, Behaviors, Circuit, Adafruit_PWMServoDriver

### Community 98 - "5. Virtual MCU (`src/engine/mcu`)"
Cohesion: 0.18
Nodes (5): Learning goals, SIM NOTE, 5. Virtual MCU (`src/engine/mcu`), constrain(), VirtualMcuOptions

### Community 99 - "formatSI"
Cohesion: 0.43
Nodes (5): fixed(), formatSI(), join(), NO_PREFIX, PREFIXES

### Community 100 - "AppState"
Cohesion: 0.18
Nodes (5): AppState, Item(), Toast(), ToastProps, ToastMessage

### Community 101 - "The context (`BehaviorContext`, `src/engine/types.ts`)"
Cohesion: 0.20
Nodes (5): Behaviors, Rules, The context (`BehaviorContext`, `src/engine/types.ts`), I2cDevice, SpiDevice

### Community 103 - "Failures"
Cohesion: 0.40
Nodes (5): F1: Tired, high-resistance battery, F2: IMU mounted 3° off, F3: Right motor wired backwards, F4: Worn gearbox (4° backlash), Failures

### Community 104 - "Circuit Atelier — interactive electronics course"
Cohesion: 0.33
Nodes (5): Circuit Atelier — interactive electronics course, Commands, Memory and context: graphify (use first), Rules, Workflow: superpowers skills (in `.claude/skills/`)

### Community 105 - "simLoop.test.ts"
Cohesion: 0.20
Nodes (3): dcLesson, LED, LessonDef

### Community 106 - "rgbGlow.test.ts"
Cohesion: 0.31
Nodes (7): liveParams(), partState(), LedLook, hex2(), RgbGlow, rgbGlow(), led

### Community 107 - "TryItYourself.tsx"
Cohesion: 0.29
Nodes (7): @codemirror/lang-cpp@^6.0.3, @uiw/react-codemirror@^4.25.12, @codemirror/lang-cpp, @uiw/react-codemirror, Sketch, TryItYourself(), TryItYourselfProps

### Community 108 - "tht"
Cohesion: 0.14
Nodes (20): Board, Board, Board, Board, Board, Board, Board, Board (+12 more)

### Community 110 - "Settings"
Cohesion: 0.32
Nodes (7): BoardProps, Controls(), ControlsProps, Toggle(), PaletteId, PALETTES, Settings

### Community 111 - "Failures"
Cohesion: 0.50
Nodes (4): F1: Return the load through the sensor ground, F2: The same, with thin 30 AWG wire, F3: Swap in a non-logic-level MOSFET (IRF540N, worst-case part), Failures

### Community 112 - "M2 — Video lessons (parallel authors)"
Cohesion: 0.33
Nodes (5): After each batch, Batch 1 (shared behaviors land here first), Batch 2, M2 — Video lessons (parallel authors), Per-lesson task (the same for every author)

### Community 113 - "Failures"
Cohesion: 0.50
Nodes (4): F1: Stall it on a fresh 2S Li-ion pack, F2: VM from a 4S LiPo (16.8 V), F3: Forget the common ground, Failures

### Community 114 - "M1.5 — Engine extensions (triaged from the curriculum SIM NOTEs)"
Cohesion: 0.12
Nodes (11): Global constraints, M1.5 — Engine extensions (triaged from the curriculum SIM NOTEs), X1 — Simulator (`src/engine/sim/`), X2 — Virtual MCU (`src/engine/mcu/`), X3 — Behavior framework (`src/engine/behaviors/`), X4 — UI and bench, X5 — 3D part additions, Constraints (+3 more)

### Community 116 - "Failures"
Cohesion: 0.50
Nodes (4): F1: Warm the sensor after calibrating, F2: Remove the I²C pull-ups, F3: AD0 pulled high, Failures

## Knowledge Gaps
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `tht()` connect `tht` to `Capstone: Two-Wheel Balancer`, `ADC, DAC and PWM`, `Power, Grounding and EMC`, `UART, I²C and SPI`, `Thermal Design`, `LED and Resistor`, `The Transistor Switch`, `The MOSFET Switch`, `Linear and Buck Regulators`, `Batteries`, `The Breadboard`, `Charge, Voltage and Current`, `Kirchhoff's Laws`, `Ohm's Law`, `AC and the Oscilloscope`, `Capacitors and RC Time`, `RLC Resonance`, `Op-Amp Basics`, `Flip-Flops and Counters`, `Logic Gates`, `Power and Heat`, `Series and Parallel`, `Inductors and RL Time`, `Resistor Codes and Dividers`, `The Transformer`, `Diodes and Rectifiers`, `The Zener Regulator`, `The 555 Timer`, `HC-SR04 Ultrasonic Ranger`, `esp32-s3.ts`, `Debugging Instruments`, `str`?**
  _High betweenness centrality (0.314) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `VirtualMcu` (e.g. with `SIM NOTE` and `5. Virtual MCU (`src/engine/mcu`)`) actually correct?**
  _`VirtualMcu` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `devices.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.04715189873417722 - nodes in this community are weakly interconnected._
- **Why does `Lesson` connect `wobble.ts` to `transient.ts`, `store.ts`, `Bench`, `AppState`, `simLoop.test.ts`, `Lesson`, `tht`, `assembly.ts`, `led-resistor.ts`, `Settings`, `M1.5 — Engine extensions (triaged from the curriculum SIM NOTEs)`, `lessons/index.ts`, `Layout.tsx`, `lessonSchema.ts`, `esp32Bench.ts`, `frame.tsx`?**
  _High betweenness centrality (0.073) - this node is a cross-community bridge._
- **Are the 7 inferred relationships involving `createBench()` (e.g. with `Deliverables` and `resolveBehaviorRef()`) actually correct?**
  _`createBench()` has 7 INFERRED edges - model-reasoned connections that need verification._
- **Should `transient.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07163461538461538 - nodes in this community are weakly interconnected._
- **Why does `3. Lesson data model` connect `tht` to `transient.ts`, `frame.tsx`, `wobble.ts`?**
  _High betweenness centrality (0.066) - this node is a cross-community bridge._