# Graph Report - Electonics Interactive course  (2026-11-07)

## Corpus Check
- 192 files · ~240,967 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 6 file(s) not represented in the graph (top: (none) 3, .css 3)

## Summary
- 2552 nodes · 5371 edges · 126 communities (121 shown, 5 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 263 edges (avg confidence: 0.91)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f977c788`
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
- compile
- Quadrature Encoders
- transistor-switch.ts
- NTC Thermistor
- MPU-6050 IMU
- PID Motor Speed Control
- Power, Grounding and EMC
- Load Cell and HX711
- Thermal Design
- LED and Resistor
- The Transistor Switch
- Arduino Uno R3
- ESP32-S3 DevKitC-1
- tb6612.ts
- TB6612FNG Dual H-Bridge
- arduino-uno.ts
- InkMesh
- tb6612fng.ts
- Bench
- HC-SR04 Ultrasonic Ranger
- Soldering and Rework
- The MOSFET Switch
- Linear and Buck Regulators
- VirtualMcu
- curriculum/README.md
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
- L298N Module
- Transpiler
- simLoop.ts
- UART, I²C and SPI
- esp32-s3.ts
- Tweaks.tsx
- wifi-sim.ts
- assembly.ts
- ink.tsx
- parts/index.ts
- .serviceIrq
- Debugging Instruments
- semis.tsx
- common.tsx
- Gallery.tsx
- Circuit Atelier — Spec
- connectors.tsx
- three/index.ts
- lessons/index.ts
- EventQueue
- lessonSchema.ts
- esp32Bench.ts
- textures.ts
- frame.tsx
- extensions.test.ts
- TryItYourself.tsx
- MeetTheBoard.tsx
- store.ts
- 5. Virtual MCU (`src/engine/mcu`)
- formatSI
- AppState
- Wire
- BehaviorMcu
- I2cDevice
- Circuit Atelier — interactive electronics course
- Lesson
- Tasks A–D are independent and run in parallel worktrees. Task E integrates them.
- smoke.spec.ts
- wire
- mcu-supply.test.ts
- Failures
- Failures
- PCB Design Workflow
- passives.tsx
- M1.5 — Engine extensions (triaged from the curriculum SIM NOTEs)
- dependencies
- tb6612.test.ts
- VirtualMcuOptions
- Behavior
- PinState
- .warn
- scripts
- BehaviorContext
- react
- tb6612fng.test.ts
- pot-knob.test.ts

## God Nodes (most connected - your core abstractions)
1. `createBench()` - 71 edges
2. `VirtualMcu` - 67 edges
3. `InkMesh()` - 63 edges
4. `vitest` - 44 edges
5. `geo()` - 44 edges
6. `str()` - 43 edges
7. `Block()` - 42 edges
8. `num()` - 39 edges
9. `What exists on main (use graphify to explore)` - 33 edges
10. `createTransient()` - 32 edges

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

## Communities (126 total, 5 thin omitted)

### Community 0 - "devices.ts"
Cohesion: 0.04
Nodes (79): BJT_BETA, BJT_BETA_R, BJT_IS, bjtEval(), BK, blankParams(), BREAK_KNEE, BREAK_RZ (+71 more)

### Community 1 - "transient.ts"
Cohesion: 0.11
Nodes (25): SIM NOTE, vitest, behavior, parsePlotterLine(), applyBurn(), applyPatches(), failureNodes(), OPEN_R (+17 more)

### Community 2 - "Capstone: Two-Wheel Balancer"
Cohesion: 0.11
Nodes (18): Behaviors, Board, Capstone: Two-Wheel Balancer, Circuit, F1: Tired, high-resistance battery, F2: IMU mounted 3° off, F3: Right motor wired backwards, F4: Worn gearbox (4° backlash) (+10 more)

### Community 3 - "ADC, DAC and PWM"
Cohesion: 0.06
Nodes (32): Board, Circuit, F1: Use an old analog meter (20 kΩ/V on the 10 V range), F2: Measure volts with the red lead still in the mA jack, F3: The bottom resistor falls out while you measure, Failures, For mechanical engineers, Learning goals (+24 more)

### Community 4 - "solve.ts"
Cohesion: 0.10
Nodes (28): Compiled, Dev, GMIN, IP, Measured, BRANCH_PIVOT_RTOL, clearSystem(), createLU() (+20 more)

### Community 5 - "deploy.yml"
Cohesion: 0.06
Nodes (31): runs-on, steps, concurrency, cancel-in-progress, group, environment, needs, runs-on (+23 more)

### Community 6 - "sound.ts"
Cohesion: 0.15
Nodes (26): Task D — App shell, theme, controls and sound (`src/ui/`, `src/audio/`, `src/styles/`), BASS, BEATS_PER_CHORD, beatSeconds(), BPM, chordSeconds(), HAT_STEPS, KICK_STEPS (+18 more)

### Community 7 - "runtime.ts"
Cohesion: 0.09
Nodes (39): arduinoMap(), arduinoRound(), bitClearFn(), bitSetFn(), bitWriteFn(), castInt(), CharBox, chr() (+31 more)

### Community 8 - "transpile.ts"
Cohesion: 0.06
Nodes (44): ARDUINO_CONSTANTS, BUILTIN_NAMES, UNSUPPORTED_API, STRING_FLOAT_METHODS, STRING_INT_METHODS, STRING_METHOD_NAMES, errorOf(), AWAITED (+36 more)

### Community 9 - "package.json"
Cohesion: 0.10
Nodes (24): devDependencies, jsdom@^31.0.0, oxlint@^1.90.0, @types/node@^24.19.2, @types/react@^19.3.0, @types/react-dom@^19.3.0, @types/three@^0.187.0, typescript@~7.0.2 (+16 more)

### Community 10 - "constants.ts"
Cohesion: 0.05
Nodes (37): A0, A1, A2, A3, A4, A5, A6, A7 (+29 more)

### Community 11 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+11 more)

### Community 12 - ".start"
Cohesion: 0.29
Nodes (5): Behaviors, Task B — Arduino transpiler and virtual MCU (`src/engine/mcu/`), makeRng(), run(), isClass()

### Community 13 - "ratings.ts"
Cohesion: 0.07
Nodes (35): curOf(), extraOf(), chain(), msPerFrame(), ratingsMs(), BURN_DELAY, checkInstant(), checkRatings() (+27 more)

### Community 14 - "createBench"
Cohesion: 0.16
Nodes (27): The context (`BehaviorContext`, `src/engine/types.ts`), netlist(), describeBurn, createBench(), act(), applyPin(), dispatch(), emit() (+19 more)

### Community 15 - "boards.tsx"
Cohesion: 0.14
Nodes (33): Art, At(), boardArt(), boardGeo(), BoardSlab(), Breadboard, breadboardArt(), GenericModule() (+25 more)

### Community 16 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 17 - "A4988 Stepper Driver"
Cohesion: 0.10
Nodes (19): A4988 Stepper Driver, Behaviors, Board, Circuit, F1: No current limit (trimmer at the stop), F2: Unplug the motor while powered, F3: MS wires fall off, Failures (+11 more)

### Community 18 - "compile"
Cohesion: 0.12
Nodes (29): branchCount(), captureState(), compile(), extraKeys(), extraNodes(), hasInternalNode(), inheritState(), isNonlinear() (+21 more)

### Community 19 - "Quadrature Encoders"
Cohesion: 0.11
Nodes (18): Behaviors, Board, Circuit, F1: Missing pull-ups, F2: A and B swapped, F3: Overdrive it on 12 V with noisy wiring, Failures, For mechanical engineers (+10 more)

### Community 20 - "transistor-switch.ts"
Cohesion: 0.07
Nodes (25): BB, d1Anode, d1Cathode, jRb, M1, MOTOR_AT, PACK_AT, pin9 (+17 more)

### Community 21 - "NTC Thermistor"
Cohesion: 0.11
Nodes (18): Behaviors, Board, Circuit, F1: Wrong part on the reel (B = 3435 K), code still says 3977, F2: Thermistor lead breaks, F3: A 1 kΩ resistor fitted instead of 10 kΩ, Failures, For mechanical engineers (+10 more)

### Community 22 - "MPU-6050 IMU"
Cohesion: 0.10
Nodes (19): Behaviors, Board, Circuit, F1: Warm the sensor after calibrating, F2: Remove the I²C pull-ups, F3: AD0 pulled high, Failures, For mechanical engineers (+11 more)

### Community 23 - "PID Motor Speed Control"
Cohesion: 0.11
Nodes (17): Behaviors, Board, Circuit, F1: Encoder A/B swapped (positive feedback), F2: Encoder pull-ups missing (lost feedback), F3: Tired battery (actuator saturation), Failures, For mechanical engineers (+9 more)

### Community 24 - "Power, Grounding and EMC"
Cohesion: 0.11
Nodes (17): Behaviors, Circuit, F1: Return the load through the sensor ground, F2: The same, with thin 30 AWG wire, F3: Swap in a non-logic-level MOSFET (IRF540N, worst-case part), Failures, For mechanical engineers, Learning goals (+9 more)

### Community 25 - "Load Cell and HX711"
Cohesion: 0.15
Nodes (12): Board, For mechanical engineers, Learning goals, Load Cell and HX711, Meet the board, Pro tips, Quiz, Readouts (+4 more)

### Community 26 - "Thermal Design"
Cohesion: 0.11
Nodes (18): Behaviors, Board, Circuit, F1: Remove the heatsink, F2: Run it from 24 V, F3: Mount it dry (no grease, poor contact), Failures, For mechanical engineers (+10 more)

### Community 27 - "LED and Resistor"
Cohesion: 0.12
Nodes (16): Circuit, F1: Leave the resistor out (jumper in its place), F2: 22 Ω fitted instead of 220 Ω (red-red-black), F3: LED in backwards, Failures, For mechanical engineers, Learning goals, LED and Resistor (+8 more)

### Community 28 - "The Transistor Switch"
Cohesion: 0.11
Nodes (17): Circuit, F1: Remove the flyback diode, F2: Skip the base resistor, F3: Stall the motor, F4: Forget the common ground, Failures, For mechanical engineers, Learning goals (+9 more)

### Community 29 - "Arduino Uno R3"
Cohesion: 0.12
Nodes (15): Arduino Uno R3, F1: Drive a motor straight off pin 9, F2: Bypass the 220 Ω resistor, F3: Short 5 V to GND on the header, F4: Feed 12 V into the 5 V pin, Failures, For mechanical engineers, Meet the board (+7 more)

### Community 30 - "ESP32-S3 DevKitC-1"
Cohesion: 0.11
Nodes (18): Behaviors, Board, Circuit, ESP32-S3 DevKitC-1, F1: Wire a 5 V signal straight into GPIO4, F2: LED with no resistor on GPIO5, F3: Button on GPIO0 held at power-up, Failures (+10 more)

### Community 31 - "tb6612.ts"
Cohesion: 0.13
Nodes (19): SIM NOTE, allOpen(), Channel, channel(), channels(), CHATTER_PICK, ChatterState, dutyOf() (+11 more)

### Community 32 - "TB6612FNG Dual H-Bridge"
Cohesion: 0.11
Nodes (17): Behaviors, Circuit, F1: Stall it on a fresh 2S Li-ion pack, F2: VM from a 4S LiPo (16.8 V), F3: Forget the common ground, Failures, For mechanical engineers, Learning goals (+9 more)

### Community 33 - "arduino-uno.ts"
Cohesion: 0.04
Nodes (44): BB, benchParts, boardParts, decouple(), dPin(), H_ANA, H_DIG_HI, H_DIG_LO (+36 more)

### Community 34 - "InkMesh"
Cohesion: 0.15
Nodes (43): extrudeAlongX(), flattedCircleShape(), InkInstances(), InkMesh(), useLookMaterial(), BreadboardBody(), LoadCellBody(), UltrasonicBody() (+35 more)

### Community 35 - "tb6612fng.ts"
Cohesion: 0.12
Nodes (9): BAT, BAT_BLACK, BAT_RED, DIODE, HDR, MOT, MOT_T1, MOT_T2 (+1 more)

### Community 36 - "Bench"
Cohesion: 0.07
Nodes (24): SfxName, frames(), pub(), running(), AssemblyAction, Note, Bench, runUntil() (+16 more)

### Community 37 - "HC-SR04 Ultrasonic Ranger"
Cohesion: 0.11
Nodes (17): Behaviors, Circuit, F1: Cold morning, code still assumes 20 °C, F2: ECHO wire falls off, F3: A second ranger pinging at the same time, Failures, For mechanical engineers, HC-SR04 Ultrasonic Ranger (+9 more)

### Community 38 - "Soldering and Rework"
Cohesion: 0.12
Nodes (15): F1: Cold joint on J2, F2: Solder bridge between pads D5 and D6, F3: Lifted pad on J3 (overheated during rework), Failures, For mechanical engineers, Learning goals, Meet the board, Pro tips (+7 more)

### Community 39 - "The MOSFET Switch"
Cohesion: 0.13
Nodes (15): Circuit, F1: A standard (non-logic-level) MOSFET on a 3.3 V GPIO, F2: The MOSFET fails short, F3: Forget the common ground, Failures, For mechanical engineers, Learning goals, Meet the board (+7 more)

### Community 40 - "Linear and Buck Regulators"
Cohesion: 0.12
Nodes (16): Board, Circuit, F1: Ask the linear regulator for 1 A, F2: Feed it only 6 V (dropout), F3: Switch to a 24 V supply, Failures, For mechanical engineers, Learning goals (+8 more)

### Community 42 - "curriculum/README.md"
Cohesion: 0.12
Nodes (10): Circuit Atelier: Curriculum (T0–T3), Engine requirements gathered from SIM NOTEs, File format, Order and prerequisites, Prerequisite graph (summary), Rating conventions used throughout, T0 Foundations, T1 Passives (+2 more)

### Community 43 - ".oxlintrc.json"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 44 - "led-resistor.ts"
Cohesion: 0.10
Nodes (21): Board, BB_H, bbHole(), BENCH_Y, between(), jumper(), PITCH, UNO (+13 more)

### Community 45 - "Batteries"
Cohesion: 0.12
Nodes (15): Batteries, Board, Circuit, F1: Keys in the pocket (terminals shorted), F2: A tired battery, F3: Chase maximum power, Failures, For mechanical engineers (+7 more)

### Community 46 - "The Breadboard"
Cohesion: 0.12
Nodes (15): Board, Circuit, F1: Both resistor legs pushed into row 10, F2: LED legs in the same strip, F3: Split ground rail, F4: A jumper lands in row 15 instead of row 10, Failures, For mechanical engineers (+7 more)

### Community 47 - "Charge, Voltage and Current"
Cohesion: 0.13
Nodes (15): Board, Charge, Voltage and Current, Circuit, F1: Open the loop, F2: Bypass the resistor with a jumper, F3: Put the cells in backwards, Failures, For mechanical engineers (+7 more)

### Community 48 - "Kirchhoff's Laws"
Cohesion: 0.12
Nodes (15): Board, Circuit, F1: Turn channel 1 up to 12 V, F2: The sink arm goes open, F3: Short node A to ground, Failures, For mechanical engineers, Kirchhoff's Laws (+7 more)

### Community 49 - "Ohm's Law"
Cohesion: 0.13
Nodes (15): Board, Circuit, F1: 12 V into 100 Ω, F2: Misread colour bands (10 Ω fitted instead of 1 kΩ), F3: Resistor lead pulls out of the board, Failures, For mechanical engineers, Learning goals (+7 more)

### Community 50 - "AC and the Oscilloscope"
Cohesion: 0.13
Nodes (15): AC and the Oscilloscope, Board, Circuit, F1: Add a 5 V DC offset, F2: Turn the frequency up to 500 Hz, F3: Load the generator with 47 Ω, Failures, For mechanical engineers (+7 more)

### Community 51 - "React + TypeScript + Vite"
Cohesion: 0.50
Nodes (3): Expanding the Oxlint configuration, React Compiler, React + TypeScript + Vite

### Community 52 - "Capacitors and RC Time"
Cohesion: 0.13
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
Cohesion: 0.13
Nodes (15): Board, Circuit, Diodes and Rectifiers, F1: One diode goes open, F2: Leave out the smoothing capacitor, F3: A diode fails short, Failures, For mechanical engineers (+7 more)

### Community 65 - "The Zener Regulator"
Cohesion: 0.12
Nodes (15): Board, Circuit, F1: Plug in a 15 V adapter, F2: Ask for too much current (100 Ω load), F3: Zener fitted backwards, Failures, For mechanical engineers, Learning goals (+7 more)

### Community 66 - "The 555 Timer"
Cohesion: 0.12
Nodes (15): Board, Circuit, F1: Leave out R1 (pin 7 tied straight to V_CC), F2: Remove the timing capacitor, F3: Run it from two AA cells, Failures, For mechanical engineers, Learning goals (+7 more)

### Community 67 - "PCA9685 Servo Driver"
Cohesion: 0.15
Nodes (12): Board, For mechanical engineers, Learning goals, Meet the board, PCA9685 Servo Driver, Pro tips, Quiz, Readouts (+4 more)

### Community 68 - "ui/types.ts"
Cohesion: 0.12
Nodes (33): What exists on main (use graphify to explore), BenchStatus, Track, BenchActions(), BenchActionsProps, Controls(), ControlsProps, SettingChange (+25 more)

### Community 69 - "wobble.ts"
Cohesion: 0.15
Nodes (20): @react-three/fiber@^9.8.2, @react-three/fiber, BenchScene(), Camera(), fitZoom(), WobbleTicker(), InkLights(), decalOffset() (+12 more)

### Community 70 - "L298N Module"
Cohesion: 0.11
Nodes (17): Behaviors, Board, Circuit, F1: Remove the flyback diodes, then stop, F2: Run two motors at 1.5 A without the heatsink, F3: Run it from a single Li-ion cell (3.7 V), Failures, For mechanical engineers (+9 more)

### Community 71 - "Transpiler"
Cohesion: 0.18
Nodes (6): castPrefix(), intWrapper(), isFloatLit(), jsName(), kindOf(), Transpiler

### Community 72 - "simLoop.ts"
Cohesion: 0.14
Nodes (15): modules, registry, resolveBehaviorRef(), ResolvedBehavior, buildNetlist(), DYNAMIC, initialTweaks(), isThermal() (+7 more)

### Community 73 - "UART, I²C and SPI"
Cohesion: 0.17
Nodes (11): Board, For mechanical engineers, Learning goals, Meet the board, Pro tips, Quiz, Readouts, Sketch (+3 more)

### Community 74 - "esp32-s3.ts"
Cohesion: 0.10
Nodes (23): Behaviors, Board, Circuit, BB, DK, j1(), j3(), ledAnode (+15 more)

### Community 75 - "Tweaks.tsx"
Cohesion: 0.33
Nodes (8): Tweak, PREFIXES, siLabel(), sliderToValue(), valueToSlider(), tweakKey(), Tweaks(), TweaksProps

### Community 76 - "wifi-sim.ts"
Cohesion: 0.12
Nodes (16): behavior, frameAverageCurrent(), fresh(), I_AVG, I_BURST, I_IDLE, MODES, num() (+8 more)

### Community 77 - "assembly.ts"
Cohesion: 0.15
Nodes (29): allPlaced(), AssemblyEvent, AssemblyResult, AssemblyState, benchStatus(), buildParts(), burnText(), clone() (+21 more)

### Community 78 - "ink.tsx"
Cohesion: 0.08
Nodes (38): Bake(), bakeable(), BAKED_INK_PX, bakeGroup(), BakeResult, Bucket, isHullHost(), linesOf() (+30 more)

### Community 79 - "parts/index.ts"
Cohesion: 0.09
Nodes (32): C, CylY(), Leg(), SPINS, ButtonBody(), Buzzer, BuzzerBody(), Potentiometer (+24 more)

### Community 81 - "Debugging Instruments"
Cohesion: 0.12
Nodes (15): Debugging Instruments, F1: Measure the 5 V rail with the leads still in the mA jack, F2: Scope ground clip on the 5 V rail, F3: Trust the DMM on the 10 MΩ divider, Failures, For mechanical engineers, Learning goals, Meet the board (+7 more)

### Community 82 - "semis.tsx"
Cohesion: 0.16
Nodes (27): chamferRectShape(), extrudeAlongZ(), extrudeUp(), geo(), mergedBoxes(), ledLook(), loadCellGeo(), GlowHalo() (+19 more)

### Community 83 - "common.tsx"
Cohesion: 0.09
Nodes (32): three, cache, disposeOutline(), edgeCache, edgesGeometry(), G, hulls, lathe() (+24 more)

### Community 84 - "Gallery.tsx"
Cohesion: 0.11
Nodes (24): SIM NOTE, PartKind, btn, Check(), DrawStats(), ENTRIES, Entry, Gallery() (+16 more)

### Community 85 - "Circuit Atelier — Spec"
Cohesion: 0.20
Nodes (10): 1. Experience, 2. Visual identity (original), 3. Lesson data model, 4. Simulation engine (`src/engine/sim`), 6. Tracks (syllabus), Bench actions, Circuit Atelier — Spec, Failures (+2 more)

### Community 86 - "connectors.tsx"
Cohesion: 0.10
Nodes (37): stadiumShape(), HeaderFemaleBody(), HeaderMaleBody(), microGeo(), microMouthGeo(), microShape(), MicroUsbBody(), ScrewTerminal (+29 more)

### Community 87 - "three/index.ts"
Cohesion: 0.15
Nodes (21): @react-three/drei@^10.7.9, @react-three/drei, CALLOUT_REF_ZOOM, CalloutProps, CalloutTone, TONE, Vec3, ISO_AZIMUTH_DEG (+13 more)

### Community 88 - "lessons/index.ts"
Cohesion: 0.13
Nodes (16): App(), BenchScene, summaries, BenchSnapshot, Lesson, TrackId, lessonDefs, lessons (+8 more)

### Community 90 - "lessonSchema.ts"
Cohesion: 0.06
Nodes (33): Decisions, After each batch, Batch 1 (shared behaviors land here first), Batch 2, M2 — Video lessons (parallel authors), Per-lesson task (the same for every author), Behaviors, Rules (+25 more)

### Community 91 - "esp32Bench.ts"
Cohesion: 0.11
Nodes (17): behavior, reg, benchOf(), esp32Lesson(), FRAME, powerAndRun(), runFor(), runUntil() (+9 more)

### Community 92 - "textures.ts"
Cohesion: 0.15
Nodes (25): BenchBase(), BenchBaseProps, gridTile(), rulerStrip(), roundedRectShape(), MAT, meshArt(), drawPad() (+17 more)

### Community 93 - "frame.tsx"
Cohesion: 0.11
Nodes (35): PartPlacement, Anim, Board(), easeOut(), explodeLayer(), LED_KINDS, liveParams(), MOTOR_KINDS (+27 more)

### Community 94 - "extensions.test.ts"
Cohesion: 0.23
Nodes (7): Adafruit_PWMServoDriver, harness(), quadEdges(), run(), runSketch(), sensor(), Thing

### Community 95 - "TryItYourself.tsx"
Cohesion: 0.33
Nodes (5): QuizItem, Sketch, QuizProps, TryItYourself(), TryItYourselfProps

### Community 96 - "MeetTheBoard.tsx"
Cohesion: 0.33
Nodes (6): marked@^18.1.3, marked, md(), MeetTheBoard(), MeetTheBoardProps, renderer

### Community 97 - "store.ts"
Cohesion: 0.23
Nodes (16): setEffectsEnabled(), asCode(), asProgress(), asSettings(), debounce(), DEFAULT_SETTINGS, isRecord(), lessonFromHash() (+8 more)

### Community 98 - "5. Virtual MCU (`src/engine/mcu`)"
Cohesion: 0.27
Nodes (4): Learning goals, SIM NOTE, 5. Virtual MCU (`src/engine/mcu`), constrain()

### Community 99 - "formatSI"
Cohesion: 0.43
Nodes (5): fixed(), formatSI(), join(), NO_PREFIX, PREFIXES

### Community 100 - "AppState"
Cohesion: 0.18
Nodes (5): AppState, Item(), Toast(), ToastProps, ToastMessage

### Community 101 - "Wire"
Cohesion: 0.29
Nodes (7): F1: Power the servos from the Uno's 5 V pin, F2: No common ground, F3: Breakout without I²C pull-ups, Failures, SIM NOTE, X2 — Virtual MCU (`src/engine/mcu/`), Wire

### Community 103 - "I2cDevice"
Cohesion: 0.29
Nodes (5): Behaviors, Circuit, Behaviors, Circuit, I2cDevice

### Community 104 - "Circuit Atelier — interactive electronics course"
Cohesion: 0.33
Nodes (5): Circuit Atelier — interactive electronics course, Commands, Memory and context: graphify (use first), Rules, Workflow: superpowers skills (in `.claude/skills/`)

### Community 105 - "Lesson"
Cohesion: 0.14
Nodes (5): kick(), dcLesson, LED, LessonDef, lesson

### Community 106 - "Tasks A–D are independent and run in parallel worktrees. Task E integrates them."
Cohesion: 0.22
Nodes (8): Global constraints, M1 — Engine plan, Task A — Circuit simulator (`src/engine/sim/`), Task C — 3D look and parametric part library (`src/three/`), Task E — Integration (after A–D are merged), Tasks A–D are independent and run in parallel worktrees. Task E integrates them., BoardSpec, PcbProps

### Community 107 - "smoke.spec.ts"
Cohesion: 0.22
Nodes (7): Behaviors, Circuit, mA(), panel(), readout(), @playwright/test@^1.65.0, @playwright/test

### Community 108 - "wire"
Cohesion: 0.25
Nodes (8): Board, Board, Board, Board, Board, Board, Board, wire()

### Community 109 - "mcu-supply.test.ts"
Cohesion: 0.19
Nodes (9): behavior, fMaxAt(), fresh(), minVccFor(), nodeSets, State, state(), states (+1 more)

### Community 110 - "Failures"
Cohesion: 0.50
Nodes (4): F1: S+ and S− swapped, F2: Overload it with 10 kg, F3: Excite the bridge from 5 V instead of AVDD, Failures

### Community 111 - "Failures"
Cohesion: 0.50
Nodes (4): F1: Analyzer (or monitor) at the wrong baud, F2: 47 kΩ pull-ups at 400 kHz, F3: Pull-ups missing, Failures

### Community 112 - "PCB Design Workflow"
Cohesion: 0.11
Nodes (18): Behaviors, Board, Circuit, F1: Forgot the CC resistors, F2: Solder bridge from PB5 to the neighbouring GND pin, F3: LED footprint drawn backwards, Failures, For mechanical engineers (+10 more)

### Community 113 - "passives.tsx"
Cohesion: 0.10
Nodes (35): BAND_HEX, BandColor, BandOptions, capacitorCode(), DIGIT_COLORS, parseOhms(), resistorBands(), sigExp() (+27 more)

### Community 114 - "M1.5 — Engine extensions (triaged from the curriculum SIM NOTEs)"
Cohesion: 0.29
Nodes (6): Global constraints, M1.5 — Engine extensions (triaged from the curriculum SIM NOTEs), X1 — Simulator (`src/engine/sim/`), X3 — Behavior framework (`src/engine/behaviors/`), X4 — UI and bench, X5 — 3D part additions

### Community 115 - "dependencies"
Cohesion: 0.15
Nodes (13): dependencies, @codemirror/lang-cpp@^6.0.3, react@^19.3.1, react-dom@^19.3.1, three@^0.187.0, @uiw/react-codemirror@^4.25.12, zod@^4.6.7, zustand@^5.1.0 (+5 more)

### Community 116 - "tb6612.test.ts"
Cohesion: 0.22
Nodes (6): behavior, bridgeLoss(), decode(), drive(), Fake, PINS

### Community 117 - "VirtualMcuOptions"
Cohesion: 0.20
Nodes (3): Behaviors, Circuit, VirtualMcuOptions

### Community 118 - "Behavior"
Cohesion: 0.12
Nodes (9): enterDownload(), leave(), num(), ROM_LINES, sample(), state(), states, BenchOptions (+1 more)

### Community 119 - "PinState"
Cohesion: 0.20
Nodes (8): PinEvent, harness(), PinEvent, Widget, StampCtx, SolveContext, SolveOptions, PinState

### Community 120 - ".warn"
Cohesion: 0.28
Nodes (4): Behaviors, Circuit, lineOfError(), probeFirstLine()

### Community 121 - "scripts"
Cohesion: 0.22
Nodes (9): scripts, build, dev, graph, lint, preview, test, test:e2e (+1 more)

### Community 122 - "BehaviorContext"
Cohesion: 0.29
Nodes (4): Constraints, Deliverables, M1 Task E — Integration: bench store, Board composer, behavior framework, first lesson, BehaviorContext

### Community 123 - "react"
Cohesion: 0.25
Nodes (5): react, Gallery, showGallery, SHADES, SmokeProps

### Community 124 - "tb6612fng.test.ts"
Cohesion: 0.33
Nodes (5): MODE, lesson, CW(), hold(), lesson

### Community 125 - "pot-knob.test.ts"
Cohesion: 0.50
Nodes (3): apply(), behavior, lesson

## Knowledge Gaps
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Lesson` connect `lessons/index.ts` to `transient.ts`, `Bench`, `curriculum/README.md`, `ui/types.ts`, `wobble.ts`, `simLoop.ts`, `assembly.ts`, `Circuit Atelier — Spec`, `lessonSchema.ts`, `esp32Bench.ts`, `frame.tsx`, `store.ts`, `AppState`, `Lesson`, `Tasks A–D are independent and run in parallel worktrees. Task E integrates them.`, `mcu-supply.test.ts`, `BehaviorContext`, `tb6612fng.test.ts`, `pot-knob.test.ts`?**
  _High betweenness centrality (0.156) - this node is a cross-community bridge._
- **Are the 7 inferred relationships involving `createBench()` (e.g. with `Deliverables` and `resolveBehaviorRef()`) actually correct?**
  _`createBench()` has 7 INFERRED edges - model-reasoned connections that need verification._
- **Should `devices.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.04493670886075949 - nodes in this community are weakly interconnected._
- **Why does `Circuit Atelier: Curriculum (T0–T3)` connect `curriculum/README.md` to `lessons/index.ts`?**
  _High betweenness centrality (0.149) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `VirtualMcu` (e.g. with `SIM NOTE` and `5. Virtual MCU (`src/engine/mcu`)`) actually correct?**
  _`VirtualMcu` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `transient.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.10512820512820513 - nodes in this community are weakly interconnected._
- **Why does `wire()` connect `wire` to `tb6612fng.ts`, `esp32-s3.ts`, `The Breadboard`, `Charge, Voltage and Current`, `A4988 Stepper Driver`?**
  _High betweenness centrality (0.071) - this node is a cross-community bridge._