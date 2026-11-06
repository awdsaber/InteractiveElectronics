# Graph Report - agent-aec3de128d1fb9ad4  (2026-11-07)

## Corpus Check
- 102 files · ~143,474 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 7 file(s) not represented in the graph (top: (none) 4, .css 3)

## Summary
- 1508 nodes · 2240 edges · 93 communities (86 shown, 7 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 102 edges (avg confidence: 0.91)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f7d1d230`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Logic Gates
- engine/types.ts
- VirtualMcu
- devices.ts
- TryItYourself.tsx
- deploy.yml
- solve.ts
- ratings.ts
- transpile.ts
- package.json
- Arduino Uno R3
- compilerOptions
- Load Cell and HX711
- NTC Thermistor
- HC-SR04 Ultrasonic Ranger
- devDependencies
- compilerOptions
- Debugging Instruments
- PCB Design Workflow
- PID Motor Speed Control
- Power, Grounding and EMC
- virtualMcu.ts
- Soldering and Rework
- Thermal Design
- ADC, DAC and PWM
- TranspileError
- The 555 Timer
- sim/format.ts
- Lesson
- Flip-Flops and Counters
- solve.ts
- Tweaks.tsx
- App.tsx
- scripts
- Capstone: Two-Wheel Balancer
- .warn
- 5. Virtual MCU (`src/engine/mcu`)
- failures.ts
- .start
- M1.5 — Engine extensions (triaged from the curriculum SIM NOTEs)
- measureDevice
- sim/format.ts
- .oxlintrc.json
- transient.ts
- Netlist
- .tryDecl
- EventQueue
- Failures
- virtualMcu.test.ts
- SpiDevice
- React + TypeScript + Vite
- CharBox
- FloatBox
- tsconfig.json
- sound.ts
- ui/types.ts
- Layout.tsx
- Sidebar.tsx
- package.json
- Transpiler
- runtime.ts
- constants.ts
- A4988 Stepper Driver
- The Transistor Switch
- ESP32-S3 DevKitC-1
- Quadrature Encoders
- L298N Module
- TB6612FNG Dual H-Bridge
- MPU-6050 IMU
- LED and Resistor
- PCA9685 Servo Driver
- The MOSFET Switch
- Batteries
- The Breadboard
- Charge, Voltage and Current
- Kirchhoff's Laws
- The Multimeter
- Ohm's Law
- AC and the Oscilloscope
- Capacitors and RC Time
- Inductors and RL Time
- RLC Resonance
- The Transformer
- Diodes and Rectifiers
- Op-Amp Basics
- Linear and Buck Regulators
- The Zener Regulator
- Interrupts and Timers
- Power and Heat
- Series and Parallel
- Resistor Codes and Dividers
- Circuit Atelier — interactive electronics course

## God Nodes (most connected - your core abstractions)
1. `VirtualMcu` - 65 edges
2. `Transpiler` - 26 edges
3. `stampDevice()` - 18 edges
4. `compilerOptions` - 18 edges
5. `TranspileError` - 16 edges
6. `compile()` - 16 edges
7. `PinState` - 16 edges
8. `vitest` - 15 edges
9. `compilerOptions` - 15 edges
10. `transpile()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `SIM NOTE` --references--> `VirtualMcu`  [INFERRED]
  docs/curriculum/T4/arduino-uno.md → src/engine/mcu/virtualMcu.ts
- `Engine requirements gathered from SIM NOTEs` --references--> `applyPatches()`  [INFERRED]
  docs/curriculum/README.md → src/engine/sim/failures.ts
- `Task D — App shell, theme, controls and sound (`src/ui/`, `src/audio/`, `src/styles/`)` --references--> `startLofi()`  [INFERRED]
  docs/plans/m1-engine.md → src/audio/sound.ts
- `SIM NOTE` --references--> `constrain()`  [INFERRED]
  docs/curriculum/T7/pid-motor-control.md → src/engine/mcu/runtime.ts
- `Task B — Arduino transpiler and virtual MCU (`src/engine/mcu/`)` --references--> `constrain()`  [INFERRED]
  docs/plans/m1-engine.md → src/engine/mcu/runtime.ts

## Import Cycles
- None detected.

## Communities (93 total, 7 thin omitted)

### Community 0 - "Logic Gates"
Cohesion: 0.12
Nodes (15): Board, Circuit, F1: Forget the pull-down on input A, F2: Short the output to ground, F3: Run the discrete gate from 3 V, Failures, For mechanical engineers, Learning goals (+7 more)

### Community 1 - "engine/types.ts"
Cohesion: 0.19
Nodes (9): vitest, chain(), msPerFrame(), ElementBase, FailureScenario, LedColor, Mount, Rating (+1 more)

### Community 3 - "devices.ts"
Cohesion: 0.07
Nodes (35): BJT_BETA, BJT_BETA_R, BJT_IS, blankParams(), Compiled, DevParams, DIODE_IS, EXP_MAX (+27 more)

### Community 4 - "TryItYourself.tsx"
Cohesion: 0.33
Nodes (6): @codemirror/lang-cpp@^6.0.3, @uiw/react-codemirror@^4.25.12, @codemirror/lang-cpp, @uiw/react-codemirror, Sketch, TryItYourselfProps

### Community 5 - "deploy.yml"
Cohesion: 0.06
Nodes (31): runs-on, steps, concurrency, cancel-in-progress, group, environment, needs, runs-on (+23 more)

### Community 6 - "solve.ts"
Cohesion: 0.16
Nodes (23): fetlim(), pnjlim(), remember(), stampDevice(), addA(), addB(), BRANCH_PIVOT_RTOL, clearSystem() (+15 more)

### Community 7 - "ratings.ts"
Cohesion: 0.17
Nodes (14): SIM NOTE, BURN_DELAY, checkRatings(), createRatingState(), DEFAULT_RATINGS, PIN_ABS_MAX_I, PIN_WARN_I, PinWarning (+6 more)

### Community 8 - "transpile.ts"
Cohesion: 0.08
Nodes (24): ARDUINO_CONSTANTS, UNSUPPORTED_API, AWAITED, BIT_OPS, CLOSE, COMPOUND, CONTROL_KW, DeclResult (+16 more)

### Community 9 - "package.json"
Cohesion: 0.12
Nodes (16): dependencies, marked@^18.1.3, react@^19.3.1, react-dom@^19.3.1, @react-three/drei@^10.7.9, @react-three/fiber@^9.8.2, three@^0.187.0, zod@^4.6.7 (+8 more)

### Community 10 - "Arduino Uno R3"
Cohesion: 0.11
Nodes (18): Arduino Uno R3, Behaviors, Board, Circuit, F1: Drive a motor straight off pin 9, F2: Bypass the 220 Ω resistor, F3: Short 5 V to GND on the header, F4: Feed 12 V into the 5 V pin (+10 more)

### Community 11 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+11 more)

### Community 12 - "Load Cell and HX711"
Cohesion: 0.04
Nodes (38): Behaviors, Board, Circuit, F1: S+ and S− swapped, F2: Overload it with 10 kg, F3: Excite the bridge from 5 V instead of AVDD, Failures, For mechanical engineers (+30 more)

### Community 13 - "NTC Thermistor"
Cohesion: 0.11
Nodes (18): Behaviors, Board, Circuit, F1: Wrong part on the reel (B = 3435 K), code still says 3977, F2: Thermistor lead breaks, F3: A 1 kΩ resistor fitted instead of 10 kΩ, Failures, For mechanical engineers (+10 more)

### Community 14 - "HC-SR04 Ultrasonic Ranger"
Cohesion: 0.11
Nodes (18): Behaviors, Board, Circuit, F1: Cold morning, code still assumes 20 °C, F2: ECHO wire falls off, F3: A second ranger pinging at the same time, Failures, For mechanical engineers (+10 more)

### Community 15 - "devDependencies"
Cohesion: 0.12
Nodes (16): devDependencies, jsdom@^31.0.0, oxlint@^1.90.0, @playwright/test@^1.65.0, @types/react@^19.3.0, @types/react-dom@^19.3.0, vite@^8.3.6, @vitejs/plugin-react@^6.1.2 (+8 more)

### Community 16 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 17 - "Debugging Instruments"
Cohesion: 0.11
Nodes (18): Behaviors, Board, Circuit, Debugging Instruments, F1: Measure the 5 V rail with the leads still in the mA jack, F2: Scope ground clip on the 5 V rail, F3: Trust the DMM on the 10 MΩ divider, Failures (+10 more)

### Community 18 - "PCB Design Workflow"
Cohesion: 0.11
Nodes (18): Behaviors, Board, Circuit, F1: Forgot the CC resistors, F2: Solder bridge from PB5 to the neighbouring GND pin, F3: LED footprint drawn backwards, Failures, For mechanical engineers (+10 more)

### Community 19 - "PID Motor Speed Control"
Cohesion: 0.11
Nodes (17): Behaviors, Board, Circuit, F1: Encoder A/B swapped (positive feedback), F2: Encoder pull-ups missing (lost feedback), F3: Tired battery (actuator saturation), Failures, For mechanical engineers (+9 more)

### Community 20 - "Power, Grounding and EMC"
Cohesion: 0.11
Nodes (18): Behaviors, Board, Circuit, F1: Return the load through the sensor ground, F2: The same, with thin 30 AWG wire, F3: Swap in a non-logic-level MOSFET (IRF540N, worst-case part), Failures, For mechanical engineers (+10 more)

### Community 21 - "virtualMcu.ts"
Cohesion: 0.10
Nodes (20): ESP32S3_ANALOG, FALLING, INPUT_PULLUP, INTERNAL, LOW, OUTPUT, RISING, SPI_MODE0 (+12 more)

### Community 22 - "Soldering and Rework"
Cohesion: 0.11
Nodes (18): Behaviors, Board, Circuit, F1: Cold joint on J2, F2: Solder bridge between pads D5 and D6, F3: Lifted pad on J3 (overheated during rework), Failures, For mechanical engineers (+10 more)

### Community 23 - "Thermal Design"
Cohesion: 0.11
Nodes (18): Behaviors, Board, Circuit, F1: Remove the heatsink, F2: Run it from 24 V, F3: Mount it dry (no grease, poor contact), Failures, For mechanical engineers (+10 more)

### Community 24 - "ADC, DAC and PWM"
Cohesion: 0.12
Nodes (16): ADC, DAC and PWM, Board, Circuit, F1: Drive a 1 kΩ load straight from the filter, F2: Fit a 1000 µF smoothing capacitor, F3: Remove the filter capacitor, Failures, For mechanical engineers (+8 more)

### Community 25 - "TranspileError"
Cohesion: 0.18
Nodes (15): BUILTIN_NAMES, errorOf(), charCode(), checkCompiles(), checkSemicolons(), matchBrackets(), normalizeNumber(), errorOf() (+7 more)

### Community 26 - "The 555 Timer"
Cohesion: 0.12
Nodes (15): Board, Circuit, F1: Leave out R1 (pin 7 tied straight to V_CC), F2: Remove the timing capacitor, F3: Run it from two AA cells, Failures, For mechanical engineers, Learning goals (+7 more)

### Community 27 - "sim/format.ts"
Cohesion: 0.20
Nodes (9): SIM NOTE, Global constraints, M1 — Engine plan, Task A — Circuit simulator (`src/engine/sim/`), Task C — 3D look and parametric part library (`src/three/`), Task E — Integration (after A–D are merged), Tasks A–D are independent and run in parallel worktrees. Task E integrates them., BoardSpec (+1 more)

### Community 28 - "Lesson"
Cohesion: 0.20
Nodes (11): Circuit Atelier: Curriculum (T0–T3), Engine requirements gathered from SIM NOTEs, File format, Order and prerequisites, Prerequisite graph (summary), Rating conventions used throughout, T0 Foundations, T1 Passives (+3 more)

### Community 29 - "Flip-Flops and Counters"
Cohesion: 0.12
Nodes (15): Board, Circuit, F1: Press SET and RESET together, F2: Cut one cross-coupling link, F3: Remove the debounce capacitor, Failures, Flip-Flops and Counters, For mechanical engineers (+7 more)

### Community 30 - "solve.ts"
Cohesion: 0.16
Nodes (14): SIM NOTE, Dev, GMIN, Measured, StampCtx, ABSTOL, MAX_ITER, RELTOL (+6 more)

### Community 31 - "Tweaks.tsx"
Cohesion: 0.38
Nodes (8): Tweak, PREFIXES, siLabel(), sliderToValue(), valueToSlider(), tweakKey(), Tweaks(), TweaksProps

### Community 32 - "App.tsx"
Cohesion: 0.22
Nodes (7): Task D — App shell, theme, controls and sound (`src/ui/`, `src/audio/`, `src/styles/`), react, lessonList, mockLesson, parts, tracks, stopLofi()

### Community 34 - "scripts"
Cohesion: 0.22
Nodes (9): scripts, build, dev, graph, lint, preview, test, test:e2e (+1 more)

### Community 35 - "Capstone: Two-Wheel Balancer"
Cohesion: 0.11
Nodes (18): Behaviors, Board, Capstone: Two-Wheel Balancer, Circuit, F1: Tired, high-resistance battery, F2: IMU mounted 3° off, F3: Right motor wired backwards, F4: Worn gearbox (4° backlash) (+10 more)

### Community 36 - ".warn"
Cohesion: 0.17
Nodes (4): Behaviors, Circuit, lineOfError(), probeFirstLine()

### Community 37 - "5. Virtual MCU (`src/engine/mcu`)"
Cohesion: 0.21
Nodes (5): Learning goals, SIM NOTE, 5. Virtual MCU (`src/engine/mcu`), constrain(), VirtualMcuOptions

### Community 38 - "failures.ts"
Cohesion: 0.21
Nodes (12): SIM NOTE, X1 — Simulator (`src/engine/sim/`), applyBurn(), applyPatches(), failureNodes(), OPEN_R, SHORT_R, uniqueId() (+4 more)

### Community 39 - ".start"
Cohesion: 0.17
Nodes (6): Behaviors, Circuit, Task B — Arduino transpiler and virtual MCU (`src/engine/mcu/`), makeRng(), run(), isClass()

### Community 40 - "M1.5 — Engine extensions (triaged from the curriculum SIM NOTEs)"
Cohesion: 0.20
Nodes (7): Global constraints, M1.5 — Engine extensions (triaged from the curriculum SIM NOTEs), X2 — Virtual MCU (`src/engine/mcu/`), X3 — Behavior framework (`src/engine/behaviors/`), X4 — UI and bench, X5 — 3D part additions, BehaviorContext

### Community 41 - "measureDevice"
Cohesion: 0.32
Nodes (8): bjtEval(), diodeEval(), measureDevice(), mosEval(), pinNorton(), safeExp(), safeExpD(), volt()

### Community 42 - "sim/format.ts"
Cohesion: 0.43
Nodes (5): fixed(), formatSI(), join(), NO_PREFIX, PREFIXES

### Community 43 - ".oxlintrc.json"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 44 - "transient.ts"
Cohesion: 0.22
Nodes (16): branchCount(), captureState(), compile(), extraKeys(), hasInternalNode(), inheritState(), isNonlinear(), layoutSignature() (+8 more)

### Community 45 - "Netlist"
Cohesion: 0.38
Nodes (3): Transient, Netlist, Solution

### Community 46 - ".tryDecl"
Cohesion: 0.53
Nodes (3): intWrapper(), jsName(), kindOf()

### Community 48 - "Failures"
Cohesion: 0.40
Nodes (5): F1: Remove the flyback diode, F2: Skip the base resistor, F3: Stall the motor, F4: Forget the common ground, Failures

### Community 49 - "virtualMcu.test.ts"
Cohesion: 0.40
Nodes (3): harness(), PinEvent, Widget

### Community 51 - "React + TypeScript + Vite"
Cohesion: 0.50
Nodes (3): Expanding the Oxlint configuration, React Compiler, React + TypeScript + Vite

### Community 69 - "sound.ts"
Cohesion: 0.15
Nodes (27): App(), BASS, BEATS_PER_CHORD, beatSeconds(), BPM, chordSeconds(), HAT_STEPS, KICK_STEPS (+19 more)

### Community 81 - "ui/types.ts"
Cohesion: 0.15
Nodes (20): BenchStatus, BenchActions(), BenchActionsProps, Controls(), ControlsProps, Toggle(), MenuButton(), MenuButtonProps (+12 more)

### Community 82 - "Layout.tsx"
Cohesion: 0.13
Nodes (22): QuizItem, Track, TrackId, SettingChange, Layout(), LayoutProps, md(), MeetTheBoard() (+14 more)

### Community 83 - "Sidebar.tsx"
Cohesion: 0.18
Nodes (11): 1. Experience, 2. Visual identity (original), 3. Lesson data model, 4. Simulation engine (`src/engine/sim`), 6. Tracks (syllabus), Bench actions, Circuit Atelier — Spec, Failures (+3 more)

### Community 85 - "package.json"
Cohesion: 0.18
Nodes (10): @types/node@^24.19.2, @types/three@^0.187.0, typescript@~7.0.2, name, private, type, version, @types/node (+2 more)

### Community 90 - "Transpiler"
Cohesion: 0.20
Nodes (4): castPrefix(), isFloatLit(), sizeOfType(), Transpiler

### Community 91 - "runtime.ts"
Cohesion: 0.11
Nodes (28): arduinoMap(), arduinoRound(), castInt(), chr(), cstr(), formatNumber(), formatPrint(), i16() (+20 more)

### Community 92 - "constants.ts"
Cohesion: 0.07
Nodes (29): A0, A1, A2, A3, A4, A5, A6, A7 (+21 more)

### Community 93 - "A4988 Stepper Driver"
Cohesion: 0.10
Nodes (19): A4988 Stepper Driver, Behaviors, Board, Circuit, F1: No current limit (trimmer at the stop), F2: Unplug the motor while powered, F3: MS wires fall off, Failures (+11 more)

### Community 94 - "The Transistor Switch"
Cohesion: 0.15
Nodes (13): Board, Circuit, For mechanical engineers, Learning goals, Meet the board, Pro tips, Quiz, Readouts (+5 more)

### Community 95 - "ESP32-S3 DevKitC-1"
Cohesion: 0.11
Nodes (18): Behaviors, Board, Circuit, ESP32-S3 DevKitC-1, F1: Wire a 5 V signal straight into GPIO4, F2: LED with no resistor on GPIO5, F3: Button on GPIO0 held at power-up, Failures (+10 more)

### Community 96 - "Quadrature Encoders"
Cohesion: 0.11
Nodes (18): Behaviors, Board, Circuit, F1: Missing pull-ups, F2: A and B swapped, F3: Overdrive it on 12 V with noisy wiring, Failures, For mechanical engineers (+10 more)

### Community 97 - "L298N Module"
Cohesion: 0.11
Nodes (18): Behaviors, Board, Circuit, F1: Remove the flyback diodes, then stop, F2: Run two motors at 1.5 A without the heatsink, F3: Run it from a single Li-ion cell (3.7 V), Failures, For mechanical engineers (+10 more)

### Community 98 - "TB6612FNG Dual H-Bridge"
Cohesion: 0.11
Nodes (18): Behaviors, Board, Circuit, F1: Stall it on a fresh 2S Li-ion pack, F2: VM from a 4S LiPo (16.8 V), F3: Forget the common ground, Failures, For mechanical engineers (+10 more)

### Community 99 - "MPU-6050 IMU"
Cohesion: 0.07
Nodes (27): Behaviors, Board, Circuit, F1: Warm the sensor after calibrating, F2: Remove the I²C pull-ups, F3: AD0 pulled high, Failures, For mechanical engineers (+19 more)

### Community 100 - "LED and Resistor"
Cohesion: 0.11
Nodes (17): Board, Circuit, F1: Leave the resistor out (jumper in its place), F2: 22 Ω fitted instead of 220 Ω (red-red-black), F3: LED in backwards, Failures, For mechanical engineers, Learning goals (+9 more)

### Community 101 - "PCA9685 Servo Driver"
Cohesion: 0.12
Nodes (15): Board, F1: Power the servos from the Uno's 5 V pin, F2: No common ground, F3: Breakout without I²C pull-ups, Failures, For mechanical engineers, Learning goals, Meet the board (+7 more)

### Community 102 - "The MOSFET Switch"
Cohesion: 0.12
Nodes (16): Board, Circuit, F1: A standard (non-logic-level) MOSFET on a 3.3 V GPIO, F2: The MOSFET fails short, F3: Forget the common ground, Failures, For mechanical engineers, Learning goals (+8 more)

### Community 103 - "Batteries"
Cohesion: 0.12
Nodes (15): Batteries, Board, Circuit, F1: Keys in the pocket (terminals shorted), F2: A tired battery, F3: Chase maximum power, Failures, For mechanical engineers (+7 more)

### Community 104 - "The Breadboard"
Cohesion: 0.12
Nodes (15): Board, Circuit, F1: Both resistor legs pushed into row 10, F2: LED legs in the same strip, F3: Split ground rail, F4: A jumper lands in row 15 instead of row 10, Failures, For mechanical engineers (+7 more)

### Community 105 - "Charge, Voltage and Current"
Cohesion: 0.12
Nodes (15): Board, Charge, Voltage and Current, Circuit, F1: Open the loop, F2: Bypass the resistor with a jumper, F3: Put the cells in backwards, Failures, For mechanical engineers (+7 more)

### Community 106 - "Kirchhoff's Laws"
Cohesion: 0.12
Nodes (15): Board, Circuit, F1: Turn channel 1 up to 12 V, F2: The sink arm goes open, F3: Short node A to ground, Failures, For mechanical engineers, Kirchhoff's Laws (+7 more)

### Community 107 - "The Multimeter"
Cohesion: 0.12
Nodes (15): Board, Circuit, F1: Use an old analog meter (20 kΩ/V on the 10 V range), F2: Measure volts with the red lead still in the mA jack, F3: The bottom resistor falls out while you measure, Failures, For mechanical engineers, Learning goals (+7 more)

### Community 108 - "Ohm's Law"
Cohesion: 0.12
Nodes (15): Board, Circuit, F1: 12 V into 100 Ω, F2: Misread colour bands (10 Ω fitted instead of 1 kΩ), F3: Resistor lead pulls out of the board, Failures, For mechanical engineers, Learning goals (+7 more)

### Community 109 - "AC and the Oscilloscope"
Cohesion: 0.12
Nodes (15): AC and the Oscilloscope, Board, Circuit, F1: Add a 5 V DC offset, F2: Turn the frequency up to 500 Hz, F3: Load the generator with 47 Ω, Failures, For mechanical engineers (+7 more)

### Community 110 - "Capacitors and RC Time"
Cohesion: 0.12
Nodes (15): Board, Capacitors and RC Time, Circuit, F1: Plug it into 24 V, F2: Swap in 1000 µF, F3: A leaky capacitor, Failures, For mechanical engineers (+7 more)

### Community 111 - "Inductors and RL Time"
Cohesion: 0.12
Nodes (15): Board, Circuit, F1: Remove the flyback diode, then open the switch, F2: Fit the flyback diode backwards, F3: Too little series resistance, Failures, For mechanical engineers, Inductors and RL Time (+7 more)

### Community 112 - "RLC Resonance"
Cohesion: 0.12
Nodes (15): Board, Circuit, F1: Take the damping resistor out, F2: Hot-plug 12 V into a 16 V ceramic filter, F3: The capacitor fails short, Failures, For mechanical engineers, Learning goals (+7 more)

### Community 113 - "The Transformer"
Cohesion: 0.14
Nodes (14): Board, Circuit, F1: Short the secondary, F2: Overload: 6 Ω instead of 12 Ω, F3: Unload it, Failures, For mechanical engineers, Learning goals (+6 more)

### Community 114 - "Diodes and Rectifiers"
Cohesion: 0.12
Nodes (15): Board, Circuit, Diodes and Rectifiers, F1: One diode goes open, F2: Leave out the smoothing capacitor, F3: A diode fails short, Failures, For mechanical engineers (+7 more)

### Community 115 - "Op-Amp Basics"
Cohesion: 0.13
Nodes (15): Board, Circuit, F1: Feedback resistor drops out, F2: Too much gain (R_F = 1 MΩ), F3: Inputs swapped, Failures, For mechanical engineers, Learning goals (+7 more)

### Community 116 - "Linear and Buck Regulators"
Cohesion: 0.12
Nodes (16): Board, Circuit, F1: Ask the linear regulator for 1 A, F2: Feed it only 6 V (dropout), F3: Switch to a 24 V supply, Failures, For mechanical engineers, Learning goals (+8 more)

### Community 117 - "The Zener Regulator"
Cohesion: 0.12
Nodes (15): Board, Circuit, F1: Plug in a 15 V adapter, F2: Ask for too much current (100 Ω load), F3: Zener fitted backwards, Failures, For mechanical engineers, Learning goals (+7 more)

### Community 118 - "Interrupts and Timers"
Cohesion: 0.12
Nodes (16): Board, F1: Remove the debounce capacitor, F2: Leave out the tach pull-up, F3: Spin the wheel at 300 kHz, Failures, For mechanical engineers, Interrupts and Timers, Learning goals (+8 more)

### Community 119 - "Power and Heat"
Cohesion: 0.13
Nodes (14): Board, Circuit, F1: 47 Ω on 5 V, F2: Same resistor, supply turned up to 12 V, F3: Fit a 2 W resistor instead, Failures, For mechanical engineers, Learning goals (+6 more)

### Community 120 - "Series and Parallel"
Cohesion: 0.14
Nodes (14): Board, Circuit, F1: R3 goes open, F2: Solder bridge shorts the parallel pair, F3: Someone adds a 100 Ω resistor across R2, Failures, For mechanical engineers, Learning goals (+6 more)

### Community 121 - "Resistor Codes and Dividers"
Cohesion: 0.14
Nodes (14): Board, Circuit, F1: Hang a 1 kΩ sensor input on the output, F2: Bottom resistor drops out, F3: Misread band: yellow-violet-orange (47 kΩ) fitted, Failures, For mechanical engineers, Learning goals (+6 more)

### Community 128 - "Circuit Atelier — interactive electronics course"
Cohesion: 0.33
Nodes (5): Circuit Atelier — interactive electronics course, Commands, Memory and context: graphify (use first), Rules, Workflow: superpowers skills (in `.claude/skills/`)

## Knowledge Gaps
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Circuit Atelier: Curriculum (T0–T3)` connect `Lesson` to `curriculum/README.md`?**
  _High betweenness centrality (0.254) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `VirtualMcu` (e.g. with `SIM NOTE` and `5. Virtual MCU (`src/engine/mcu`)`) actually correct?**
  _`VirtualMcu` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `Logic Gates` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._
- **Why does `Lesson` connect `Lesson` to `App.tsx`, `engine/types.ts`, `Layout.tsx`, `Sidebar.tsx`, `sim/format.ts`?**
  _High betweenness centrality (0.240) - this node is a cross-community bridge._
- **Should `VirtualMcu` be split into smaller, more focused modules?**
  _Cohesion score 0.12666666666666668 - nodes in this community are weakly interconnected._
- **Why does `VirtualMcu` connect `VirtualMcu` to `MPU-6050 IMU`, `.warn`, `5. Virtual MCU (`src/engine/mcu`)`, `.start`, `Arduino Uno R3`, `virtualMcu.test.ts`, `virtualMcu.ts`, `Interrupts and Timers`, `TranspileError`, `runtime.ts`?**
  _High betweenness centrality (0.070) - this node is a cross-community bridge._
- **Should `devices.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06825396825396825 - nodes in this community are weakly interconnected._