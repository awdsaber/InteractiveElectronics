# Graph Report - agent-abd8803da38df5d79  (2026-11-07)

## Corpus Check
- 107 files · ~145,081 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 7 file(s) not represented in the graph (top: (none) 4, .css 3)

## Summary
- 1458 nodes · 2162 edges · 82 communities (80 shown, 2 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 74 edges (avg confidence: 0.92)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f7d1d230`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Logic Gates
- M1.5 — Engine extensions (triaged from the curriculum SIM NOTEs)
- VirtualMcu
- devices.ts
- TryItYourself.tsx
- deploy.yml
- solve.ts
- engine/types.ts
- stampDevice
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
- UART, I²C and SPI
- Soldering and Rework
- Thermal Design
- ADC, DAC and PWM
- 5. Virtual MCU (`src/engine/mcu`)
- The 555 Timer
- Capstone: Two-Wheel Balancer
- Lesson
- Flip-Flops and Counters
- addA
- Tweaks.tsx
- App.tsx
- scripts
- Failures
- Failures
- Failures
- Failures
- .oxlintrc.json
- compile
- React + TypeScript + Vite
- tsconfig.json
- sound.ts
- ui/types.ts
- Layout.tsx
- Sidebar.tsx
- package.json
- MeetTheBoard.tsx
- transpile.ts
- virtualMcu.ts
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
1. `VirtualMcu` - 31 edges
2. `stampDevice()` - 27 edges
3. `Transpiler` - 24 edges
4. `createTransient()` - 24 edges
5. `vitest` - 20 edges
6. `Netlist` - 18 edges
7. `compilerOptions` - 18 edges
8. `compile()` - 17 edges
9. `TranspileError` - 15 edges
10. `solveDC()` - 15 edges

## Surprising Connections (you probably didn't know these)
- `SIM NOTE` --references--> `constrain()`  [INFERRED]
  docs/curriculum/T7/pid-motor-control.md → src/engine/mcu/runtime.ts
- `SIM NOTE` --references--> `VirtualMcu`  [INFERRED]
  docs/curriculum/T4/arduino-uno.md → src/engine/mcu/virtualMcu.ts
- `Engine requirements gathered from SIM NOTEs` --references--> `applyPatches()`  [INFERRED]
  docs/curriculum/README.md → src/engine/sim/failures.ts
- `X1 — Simulator (`src/engine/sim/`)` --references--> `applyPatches()`  [INFERRED]
  docs/plans/m1.5-engine-extensions.md → src/engine/sim/failures.ts
- `X2 — Virtual MCU (`src/engine/mcu/`)` --references--> `tone()`  [INFERRED]
  docs/plans/m1.5-engine-extensions.md → src/audio/sound.ts

## Import Cycles
- None detected.

## Communities (82 total, 2 thin omitted)

### Community 0 - "Logic Gates"
Cohesion: 0.12
Nodes (15): Board, Circuit, F1: Forget the pull-down on input A, F2: Short the output to ground, F3: Run the discrete gate from 3 V, Failures, For mechanical engineers, Learning goals (+7 more)

### Community 1 - "M1.5 — Engine extensions (triaged from the curriculum SIM NOTEs)"
Cohesion: 0.18
Nodes (8): Global constraints, M1.5 — Engine extensions (triaged from the curriculum SIM NOTEs), X1 — Simulator (`src/engine/sim/`), X2 — Virtual MCU (`src/engine/mcu/`), X3 — Behavior framework (`src/engine/behaviors/`), X4 — UI and bench, X5 — 3D part additions, BehaviorContext

### Community 2 - "VirtualMcu"
Cohesion: 0.21
Nodes (4): Behaviors, Task B — Arduino transpiler and virtual MCU (`src/engine/mcu/`), run(), VirtualMcu

### Community 3 - "devices.ts"
Cohesion: 0.05
Nodes (43): BJT_BETA, BJT_BETA_R, BJT_IS, BK, BREAK_KNEE, BREAK_RZ, breakEval(), CC (+35 more)

### Community 4 - "TryItYourself.tsx"
Cohesion: 0.33
Nodes (6): @codemirror/lang-cpp@^6.0.3, @uiw/react-codemirror@^4.25.12, @codemirror/lang-cpp, @uiw/react-codemirror, Sketch, TryItYourselfProps

### Community 5 - "deploy.yml"
Cohesion: 0.06
Nodes (31): runs-on, steps, concurrency, cancel-in-progress, group, environment, needs, runs-on (+23 more)

### Community 6 - "solve.ts"
Cohesion: 0.11
Nodes (27): SIM NOTE, Compiled, GMIN, Measured, StampCtx, BRANCH_PIVOT_RTOL, clearSystem(), createLU() (+19 more)

### Community 7 - "engine/types.ts"
Cohesion: 0.05
Nodes (65): SIM NOTE, SIM NOTE, SIM NOTE, vitest, captureState(), Dev, inheritState(), partition() (+57 more)

### Community 8 - "stampDevice"
Cohesion: 0.18
Nodes (19): bjtEval(), capCompanion(), clampEval(), diodeEval(), ensureLogicScratch(), fetlim(), gateEval(), logicThreshold() (+11 more)

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
Cohesion: 0.11
Nodes (18): Behaviors, Board, Circuit, F1: S+ and S− swapped, F2: Overload it with 10 kg, F3: Excite the bridge from 5 V instead of AVDD, Failures, For mechanical engineers (+10 more)

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
Nodes (18): Behaviors, Board, Circuit, F1: Encoder A/B swapped (positive feedback), F2: Encoder pull-ups missing (lost feedback), F3: Tired battery (actuator saturation), Failures, For mechanical engineers (+10 more)

### Community 20 - "Power, Grounding and EMC"
Cohesion: 0.11
Nodes (18): Behaviors, Board, Circuit, F1: Return the load through the sensor ground, F2: The same, with thin 30 AWG wire, F3: Swap in a non-logic-level MOSFET (IRF540N, worst-case part), Failures, For mechanical engineers (+10 more)

### Community 21 - "UART, I²C and SPI"
Cohesion: 0.11
Nodes (18): Behaviors, Board, Circuit, F1: Analyzer (or monitor) at the wrong baud, F2: 47 kΩ pull-ups at 400 kHz, F3: Pull-ups missing, Failures, For mechanical engineers (+10 more)

### Community 22 - "Soldering and Rework"
Cohesion: 0.11
Nodes (18): Behaviors, Board, Circuit, F1: Cold joint on J2, F2: Solder bridge between pads D5 and D6, F3: Lifted pad on J3 (overheated during rework), Failures, For mechanical engineers (+10 more)

### Community 23 - "Thermal Design"
Cohesion: 0.11
Nodes (18): Behaviors, Board, Circuit, F1: Remove the heatsink, F2: Run it from 24 V, F3: Mount it dry (no grease, poor contact), Failures, For mechanical engineers (+10 more)

### Community 24 - "ADC, DAC and PWM"
Cohesion: 0.12
Nodes (16): ADC, DAC and PWM, Board, Circuit, F1: Drive a 1 kΩ load straight from the filter, F2: Fit a 1000 µF smoothing capacitor, F3: Remove the filter capacitor, Failures, For mechanical engineers (+8 more)

### Community 25 - "5. Virtual MCU (`src/engine/mcu`)"
Cohesion: 0.23
Nodes (4): Learning goals, 5. Virtual MCU (`src/engine/mcu`), constrain(), VirtualMcuOptions

### Community 26 - "The 555 Timer"
Cohesion: 0.12
Nodes (15): Board, Circuit, F1: Leave out R1 (pin 7 tied straight to V_CC), F2: Remove the timing capacitor, F3: Run it from two AA cells, Failures, For mechanical engineers, Learning goals (+7 more)

### Community 27 - "Capstone: Two-Wheel Balancer"
Cohesion: 0.06
Nodes (32): Behaviors, Board, Capstone: Two-Wheel Balancer, Circuit, F1: Tired, high-resistance battery, F2: IMU mounted 3° off, F3: Right motor wired backwards, F4: Worn gearbox (4° backlash) (+24 more)

### Community 28 - "Lesson"
Cohesion: 0.20
Nodes (11): Circuit Atelier: Curriculum (T0–T3), Engine requirements gathered from SIM NOTEs, File format, Order and prerequisites, Prerequisite graph (summary), Rating conventions used throughout, T0 Foundations, T1 Passives (+3 more)

### Community 29 - "Flip-Flops and Counters"
Cohesion: 0.12
Nodes (15): Board, Circuit, F1: Press SET and RESET together, F2: Cut one cross-coupling link, F3: Remove the debounce capacitor, Failures, Flip-Flops and Counters, For mechanical engineers (+7 more)

### Community 30 - "addA"
Cohesion: 0.28
Nodes (9): stampInductor(), addA(), addB(), row(), stampConductance(), stampCurrent(), stampNonlinear2(), stampNonlinear3() (+1 more)

### Community 31 - "Tweaks.tsx"
Cohesion: 0.38
Nodes (8): Tweak, PREFIXES, siLabel(), sliderToValue(), valueToSlider(), tweakKey(), Tweaks(), TweaksProps

### Community 32 - "App.tsx"
Cohesion: 0.25
Nodes (8): react, App(), lessonList, mockLesson, parts, tracks, setEffectsEnabled(), unlockAudio()

### Community 34 - "scripts"
Cohesion: 0.22
Nodes (9): scripts, build, dev, graph, lint, preview, test, test:e2e (+1 more)

### Community 35 - "Failures"
Cohesion: 0.50
Nodes (4): F1: R3 goes open, F2: Solder bridge shorts the parallel pair, F3: Someone adds a 100 Ω resistor across R2, Failures

### Community 36 - "Failures"
Cohesion: 0.50
Nodes (4): F1: 12 V into 100 Ω, F2: Misread colour bands (10 Ω fitted instead of 1 kΩ), F3: Resistor lead pulls out of the board, Failures

### Community 37 - "Failures"
Cohesion: 0.50
Nodes (4): F1: Remove the flyback diode, then open the switch, F2: Fit the flyback diode backwards, F3: Too little series resistance, Failures

### Community 38 - "Failures"
Cohesion: 0.50
Nodes (4): F1: Take the damping resistor out, F2: Hot-plug 12 V into a 16 V ceramic filter, F3: The capacitor fails short, Failures

### Community 43 - ".oxlintrc.json"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 44 - "compile"
Cohesion: 0.19
Nodes (16): blankParams(), branchCount(), compile(), extraKeys(), extraNodes(), hasInternalNode(), isNonlinear(), layoutSignature() (+8 more)

### Community 51 - "React + TypeScript + Vite"
Cohesion: 0.50
Nodes (3): Expanding the Oxlint configuration, React Compiler, React + TypeScript + Vite

### Community 69 - "sound.ts"
Cohesion: 0.15
Nodes (26): Task D — App shell, theme, controls and sound (`src/ui/`, `src/audio/`, `src/styles/`), BASS, BEATS_PER_CHORD, beatSeconds(), BPM, chordSeconds(), HAT_STEPS, KICK_STEPS (+18 more)

### Community 81 - "ui/types.ts"
Cohesion: 0.21
Nodes (14): BenchStatus, BenchActions(), BenchActionsProps, MenuButton(), MenuButtonProps, MenuItem, StatusPanel(), StatusPanelProps (+6 more)

### Community 82 - "Layout.tsx"
Cohesion: 0.16
Nodes (19): QuizItem, Controls(), ControlsProps, SettingChange, Toggle(), Layout(), LayoutProps, Quiz() (+11 more)

### Community 83 - "Sidebar.tsx"
Cohesion: 0.13
Nodes (16): 1. Experience, 2. Visual identity (original), 3. Lesson data model, 4. Simulation engine (`src/engine/sim`), 6. Tracks (syllabus), Bench actions, Circuit Atelier — Spec, Failures (+8 more)

### Community 85 - "package.json"
Cohesion: 0.18
Nodes (10): @types/node@^24.19.2, @types/three@^0.187.0, typescript@~7.0.2, name, private, type, version, @types/node (+2 more)

### Community 87 - "MeetTheBoard.tsx"
Cohesion: 0.50
Nodes (4): md(), MeetTheBoard(), MeetTheBoardProps, renderer

### Community 90 - "transpile.ts"
Cohesion: 0.06
Nodes (42): BUILTIN_NAMES, errorOf(), castPrefix(), charCode(), checkCompiles(), checkSemicolons(), CLOSE, COMPOUND (+34 more)

### Community 91 - "virtualMcu.ts"
Cohesion: 0.16
Nodes (23): arduinoMap(), arduinoRound(), castInt(), CharBox, chr(), cstr(), FloatBox, formatNumber() (+15 more)

### Community 92 - "constants.ts"
Cohesion: 0.08
Nodes (25): A0, A1, A2, A3, A4, A5, A6, A7 (+17 more)

### Community 93 - "A4988 Stepper Driver"
Cohesion: 0.10
Nodes (19): A4988 Stepper Driver, Behaviors, Board, Circuit, F1: No current limit (trimmer at the stop), F2: Unplug the motor while powered, F3: MS wires fall off, Failures (+11 more)

### Community 94 - "The Transistor Switch"
Cohesion: 0.11
Nodes (18): Board, Circuit, F1: Remove the flyback diode, F2: Skip the base resistor, F3: Stall the motor, F4: Forget the common ground, Failures, For mechanical engineers (+10 more)

### Community 95 - "ESP32-S3 DevKitC-1"
Cohesion: 0.10
Nodes (19): Behaviors, Board, Circuit, ESP32-S3 DevKitC-1, F1: Wire a 5 V signal straight into GPIO4, F2: LED with no resistor on GPIO5, F3: Button on GPIO0 held at power-up, Failures (+11 more)

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
Cohesion: 0.11
Nodes (18): Behaviors, Board, Circuit, F1: Warm the sensor after calibrating, F2: Remove the I²C pull-ups, F3: AD0 pulled high, Failures, For mechanical engineers (+10 more)

### Community 100 - "LED and Resistor"
Cohesion: 0.11
Nodes (17): Board, Circuit, F1: Leave the resistor out (jumper in its place), F2: 22 Ω fitted instead of 220 Ω (red-red-black), F3: LED in backwards, Failures, For mechanical engineers, Learning goals (+9 more)

### Community 101 - "PCA9685 Servo Driver"
Cohesion: 0.11
Nodes (17): Behaviors, Board, Circuit, F1: Power the servos from the Uno's 5 V pin, F2: No common ground, F3: Breakout without I²C pull-ups, Failures, For mechanical engineers (+9 more)

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
Cohesion: 0.18
Nodes (11): Board, Circuit, For mechanical engineers, Learning goals, Meet the board, Ohm's Law, Pro tips, Quiz (+3 more)

### Community 109 - "AC and the Oscilloscope"
Cohesion: 0.12
Nodes (15): AC and the Oscilloscope, Board, Circuit, F1: Add a 5 V DC offset, F2: Turn the frequency up to 500 Hz, F3: Load the generator with 47 Ω, Failures, For mechanical engineers (+7 more)

### Community 110 - "Capacitors and RC Time"
Cohesion: 0.12
Nodes (15): Board, Capacitors and RC Time, Circuit, F1: Plug it into 24 V, F2: Swap in 1000 µF, F3: A leaky capacitor, Failures, For mechanical engineers (+7 more)

### Community 111 - "Inductors and RL Time"
Cohesion: 0.18
Nodes (11): Board, Circuit, For mechanical engineers, Inductors and RL Time, Learning goals, Meet the board, Pro tips, Quiz (+3 more)

### Community 112 - "RLC Resonance"
Cohesion: 0.18
Nodes (11): Board, Circuit, For mechanical engineers, Learning goals, Meet the board, Pro tips, Quiz, Readouts (+3 more)

### Community 113 - "The Transformer"
Cohesion: 0.13
Nodes (14): Board, Circuit, F1: Short the secondary, F2: Overload: 6 Ω instead of 12 Ω, F3: Unload it, Failures, For mechanical engineers, Learning goals (+6 more)

### Community 114 - "Diodes and Rectifiers"
Cohesion: 0.12
Nodes (15): Board, Circuit, Diodes and Rectifiers, F1: One diode goes open, F2: Leave out the smoothing capacitor, F3: A diode fails short, Failures, For mechanical engineers (+7 more)

### Community 115 - "Op-Amp Basics"
Cohesion: 0.12
Nodes (15): Board, Circuit, F1: Feedback resistor drops out, F2: Too much gain (R_F = 1 MΩ), F3: Inputs swapped, Failures, For mechanical engineers, Learning goals (+7 more)

### Community 116 - "Linear and Buck Regulators"
Cohesion: 0.12
Nodes (16): Board, Circuit, F1: Ask the linear regulator for 1 A, F2: Feed it only 6 V (dropout), F3: Switch to a 24 V supply, Failures, For mechanical engineers, Learning goals (+8 more)

### Community 117 - "The Zener Regulator"
Cohesion: 0.12
Nodes (15): Board, Circuit, F1: Plug in a 15 V adapter, F2: Ask for too much current (100 Ω load), F3: Zener fitted backwards, Failures, For mechanical engineers, Learning goals (+7 more)

### Community 118 - "Interrupts and Timers"
Cohesion: 0.12
Nodes (16): Board, Circuit, F1: Remove the debounce capacitor, F2: Leave out the tach pull-up, F3: Spin the wheel at 300 kHz, Failures, For mechanical engineers, Interrupts and Timers (+8 more)

### Community 119 - "Power and Heat"
Cohesion: 0.13
Nodes (14): Board, Circuit, F1: 47 Ω on 5 V, F2: Same resistor, supply turned up to 12 V, F3: Fit a 2 W resistor instead, Failures, For mechanical engineers, Learning goals (+6 more)

### Community 120 - "Series and Parallel"
Cohesion: 0.20
Nodes (10): Board, Circuit, For mechanical engineers, Learning goals, Meet the board, Pro tips, Quiz, Readouts (+2 more)

### Community 121 - "Resistor Codes and Dividers"
Cohesion: 0.13
Nodes (14): Board, Circuit, F1: Hang a 1 kΩ sensor input on the output, F2: Bottom resistor drops out, F3: Misread band: yellow-violet-orange (47 kΩ) fitted, Failures, For mechanical engineers, Learning goals (+6 more)

### Community 128 - "Circuit Atelier — interactive electronics course"
Cohesion: 0.33
Nodes (5): Circuit Atelier — interactive electronics course, Commands, Memory and context: graphify (use first), Rules, Workflow: superpowers skills (in `.claude/skills/`)

## Knowledge Gaps
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Circuit Atelier: Curriculum (T0–T3)` connect `Lesson` to `curriculum/README.md`?**
  _High betweenness centrality (0.217) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `VirtualMcu` (e.g. with `SIM NOTE` and `5. Virtual MCU (`src/engine/mcu`)`) actually correct?**
  _`VirtualMcu` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `Logic Gates` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._
- **Why does `Lesson` connect `Lesson` to `App.tsx`, `engine/types.ts`, `Layout.tsx`, `Sidebar.tsx`, `Capstone: Two-Wheel Balancer`?**
  _High betweenness centrality (0.210) - this node is a cross-community bridge._
- **Should `devices.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.04756871035940803 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `engine/types.ts` to `sound.ts`, `devDependencies`, `package.json`, `transpile.ts`, `Capstone: Two-Wheel Balancer`, `Tweaks.tsx`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Should `deploy.yml` be split into smaller, more focused modules?**
  _Cohesion score 0.06451612903225806 - nodes in this community are weakly interconnected._