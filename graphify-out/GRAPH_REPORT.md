# Graph Report - Electonics Interactive course  (2026-11-08)

## Corpus Check
- 267 files · ~362,410 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 7 file(s) not represented in the graph (top: .css 4, (none) 3)

## Summary
- 3487 nodes · 7379 edges · 152 communities (149 shown, 3 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 383 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1ce4335a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- devices.ts
- ink.tsx
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
- createBench
- engine/types.ts
- Tasks A–D are independent and run in parallel worktrees. Task E integrates them.
- boards.tsx
- compilerOptions
- A4988 Stepper Driver
- transient.ts
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
- readouts.ts
- tb6612fng.ts
- three/index.ts
- HC-SR04 Ultrasonic Ranger
- Soldering and Rework
- The MOSFET Switch
- Linear and Buck Regulators
- VirtualMcu
- curriculum/README.md
- .oxlintrc.json
- kirchhoff.ts
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
- T5/l298n.ts
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
- Instruments.tsx
- L298N Module
- Transpiler
- parts/index.ts
- Solution
- esp32-s3.ts
- Tweaks.tsx
- imu-mpu6050.ts
- createBench
- ink.tsx
- .snapshot
- charge-voltage-current.ts
- Debugging Instruments
- V
- series-parallel.ts
- Gallery.tsx
- Circuit Atelier — Spec
- connectors.tsx
- Callout.tsx
- InkMesh
- semis.tsx
- lessonSchema.ts
- dependencies
- resistor-codes-divider.ts
- Board.tsx
- extensions.test.ts
- Layout.tsx
- UART, I²C and SPI
- store.ts
- compile
- 5. Virtual MCU (`src/engine/mcu`)
- BenchScene.tsx
- pca9685.ts
- BehaviorMcu
- pca9685-servo.ts
- Circuit Atelier — interactive electronics course
- led-resistor.ts
- capacitor-rc.ts
- multimeter.ts
- inductor-rl.ts
- mcu-supply.test.ts
- a4988.ts
- vitest
- PCB Design Workflow
- passives.tsx
- behaviors/l298n.ts
- smoke.spec.ts
- Lesson
- TryItYourself.tsx
- wifi-sim.ts
- engine/types.ts
- BehaviorContext
- scripts
- M2 — Video lessons (parallel authors)
- AppState
- ohms-law.ts
- a4988-stepper.ts
- M1.5 — Engine extensions (triaged from the curriculum SIM NOTEs)
- zener.ts
- autoFrame.ts
- inductor-rl.test.ts
- batteries.ts
- power-heat.ts
- breadboard.ts
- I2cDevice
- inspector.ts
- store.ts
- Writing a lesson
- T5/l298n.test.ts
- Highlight.tsx
- frame.tsx
- pca9685.test.ts
- Driver
- M3 — Foundations, Passives, Semiconductors (T0–T2)
- acks
- 4. Simulation engine (`src/engine/sim`)
- series-parallel.test.ts
- .v
- Failures
- Failures
- Failures
- Failures
- Menu.tsx

## God Nodes (most connected - your core abstractions)
1. `createBench()` - 124 edges
2. `vitest` - 82 edges
3. `VirtualMcu` - 68 edges
4. `InkMesh()` - 63 edges
5. `Lesson` - 60 edges
6. `Bench` - 49 edges
7. `geo()` - 44 edges
8. `str()` - 43 edges
9. `createTransient()` - 42 edges
10. `Block()` - 42 edges

## Surprising Connections (you probably didn't know these)
- `SIM NOTE` --references--> `constrain()`  [INFERRED]
  docs/curriculum/T7/pid-motor-control.md → src/engine/mcu/runtime.ts
- `SIM NOTE` --references--> `VirtualMcu`  [INFERRED]
  docs/curriculum/T4/arduino-uno.md → src/engine/mcu/virtualMcu.ts
- `F3: Fit a 2 W resistor instead` --references--> `applyPatches()`  [INFERRED]
  docs/curriculum/T0/power-heat.md → src/engine/sim/failures.ts
- `SIM NOTE` --references--> `applyPatches()`  [INFERRED]
  docs/curriculum/T0/power-heat.md → src/engine/sim/failures.ts
- `X3 — Behavior framework (`src/engine/behaviors/`)` --references--> `BehaviorContext`  [INFERRED]
  docs/plans/m1.5-engine-extensions.md → src/engine/types.ts

## Import Cycles
- None detected.

## Communities (152 total, 3 thin omitted)

### Community 0 - "devices.ts"
Cohesion: 0.05
Nodes (79): BJT_BETA, BJT_BETA_R, BJT_IS, bjtEval(), BK, BREAK_KNEE, BREAK_RZ, breakEval() (+71 more)

### Community 1 - "ink.tsx"
Cohesion: 0.09
Nodes (25): three, cache, disposeOutline(), edgeCache, edgesGeometry(), G, hulls, GroupProps (+17 more)

### Community 2 - "Capstone: Two-Wheel Balancer"
Cohesion: 0.11
Nodes (18): Behaviors, Board, Capstone: Two-Wheel Balancer, Circuit, F1: Tired, high-resistance battery, F2: IMU mounted 3° off, F3: Right motor wired backwards, F4: Worn gearbox (4° backlash) (+10 more)

### Community 3 - "ADC, DAC and PWM"
Cohesion: 0.06
Nodes (32): Board, Circuit, F1: Use an old analog meter (20 kΩ/V on the 10 V range), F2: Measure volts with the red lead still in the mA jack, F3: The bottom resistor falls out while you measure, Failures, For mechanical engineers, Learning goals (+24 more)

### Community 4 - "solve.ts"
Cohesion: 0.10
Nodes (27): GMIN, IP, LinSlot, measureCurrentPower(), Measured, clearSystem(), createLU(), createSystem() (+19 more)

### Community 5 - "deploy.yml"
Cohesion: 0.06
Nodes (31): runs-on, steps, concurrency, cancel-in-progress, group, environment, needs, runs-on (+23 more)

### Community 6 - "sound.ts"
Cohesion: 0.17
Nodes (24): BASS, BEATS_PER_CHORD, beatSeconds(), BPM, chordSeconds(), HAT_STEPS, KICK_STEPS, loopSeconds() (+16 more)

### Community 7 - "runtime.ts"
Cohesion: 0.08
Nodes (46): ESP32S3_ANALOG, EXTERNAL, INPUT_PULLUP, RISING, SPI_MODE0, arduinoMap(), arduinoRound(), bitClearFn() (+38 more)

### Community 8 - "transpile.ts"
Cohesion: 0.07
Nodes (40): ARDUINO_CONSTANTS, BUILTIN_NAMES, UNSUPPORTED_API, errorOf(), AWAITED, BIT_OPS, charCode(), checkCompiles() (+32 more)

### Community 9 - "package.json"
Cohesion: 0.10
Nodes (24): devDependencies, jsdom@^31.0.0, oxlint@^1.90.0, @types/node@^24.19.2, @types/react@^19.3.0, @types/react-dom@^19.3.0, @types/three@^0.187.0, typescript@~7.0.2 (+16 more)

### Community 10 - "constants.ts"
Cohesion: 0.06
Nodes (32): A0, A1, A2, A3, A4, A5, A6, A7 (+24 more)

### Community 11 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+11 more)

### Community 12 - "createBench"
Cohesion: 0.09
Nodes (39): SfxName, bench(), running(), Note, createBench(), act(), applyBehaviorTweaks(), applyPin() (+31 more)

### Community 13 - "engine/types.ts"
Cohesion: 0.04
Nodes (32): behavior, counts, E_CHARGE, lesson, behavior, apply(), behavior, lesson (+24 more)

### Community 14 - "Tasks A–D are independent and run in parallel worktrees. Task E integrates them."
Cohesion: 0.29
Nodes (6): Global constraints, M1 — Engine plan, Task A — Circuit simulator (`src/engine/sim/`), Task D — App shell, theme, controls and sound (`src/ui/`, `src/audio/`, `src/styles/`), Tasks A–D are independent and run in parallel worktrees. Task E integrates them., stopLofi()

### Community 15 - "boards.tsx"
Cohesion: 0.16
Nodes (35): Art, At(), boardArt(), boardGeo(), BoardSlab(), GenericModule(), ModuleBody(), NanoModule() (+27 more)

### Community 16 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 17 - "A4988 Stepper Driver"
Cohesion: 0.14
Nodes (13): A4988 Stepper Driver, Behaviors, Board, Circuit, For mechanical engineers, Learning goals, Meet the board, Pro tips (+5 more)

### Community 18 - "transient.ts"
Cohesion: 0.08
Nodes (37): harness(), PinEvent, Widget, modesChanged(), StampCtx, coil(), settle(), lastPeriodPeak() (+29 more)

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
Nodes (18): Behaviors, Board, Circuit, F1: Encoder A/B swapped (positive feedback), F2: Encoder pull-ups missing (lost feedback), F3: Tired battery (actuator saturation), Failures, For mechanical engineers (+10 more)

### Community 24 - "Power, Grounding and EMC"
Cohesion: 0.10
Nodes (19): Behaviors, Board, Circuit, F1: Return the load through the sensor ground, F2: The same, with thin 30 AWG wire, F3: Swap in a non-logic-level MOSFET (IRF540N, worst-case part), Failures, For mechanical engineers (+11 more)

### Community 25 - "Load Cell and HX711"
Cohesion: 0.11
Nodes (18): Behaviors, Board, Circuit, F1: S+ and S− swapped, F2: Overload it with 10 kg, F3: Excite the bridge from 5 V instead of AVDD, Failures, For mechanical engineers (+10 more)

### Community 26 - "Thermal Design"
Cohesion: 0.14
Nodes (13): Behaviors, Board, Circuit, For mechanical engineers, Learning goals, Meet the board, Pro tips, Quiz (+5 more)

### Community 27 - "LED and Resistor"
Cohesion: 0.11
Nodes (17): Board, Circuit, F1: Leave the resistor out (jumper in its place), F2: 22 Ω fitted instead of 220 Ω (red-red-black), F3: LED in backwards, Failures, For mechanical engineers, Learning goals (+9 more)

### Community 28 - "The Transistor Switch"
Cohesion: 0.11
Nodes (18): Board, Circuit, F1: Remove the flyback diode, F2: Skip the base resistor, F3: Stall the motor, F4: Forget the common ground, Failures, For mechanical engineers (+10 more)

### Community 29 - "Arduino Uno R3"
Cohesion: 0.11
Nodes (18): Arduino Uno R3, Behaviors, Board, Circuit, F1: Drive a motor straight off pin 9, F2: Bypass the 220 Ω resistor, F3: Short 5 V to GND on the header, F4: Feed 12 V into the 5 V pin (+10 more)

### Community 30 - "ESP32-S3 DevKitC-1"
Cohesion: 0.11
Nodes (18): Behaviors, Board, Circuit, ESP32-S3 DevKitC-1, F1: Wire a 5 V signal straight into GPIO4, F2: LED with no resistor on GPIO5, F3: Button on GPIO0 held at power-up, Failures (+10 more)

### Community 31 - "tb6612.ts"
Cohesion: 0.09
Nodes (23): allOpen(), behavior, bridgeLoss(), Channel, channel(), channels(), CHATTER_PICK, ChatterState (+15 more)

### Community 32 - "TB6612FNG Dual H-Bridge"
Cohesion: 0.11
Nodes (18): Behaviors, Board, Circuit, F1: Stall it on a fresh 2S Li-ion pack, F2: VM from a 4S LiPo (16.8 V), F3: Forget the common ground, Failures, For mechanical engineers (+10 more)

### Community 33 - "arduino-uno.ts"
Cohesion: 0.04
Nodes (44): BB, benchParts, boardParts, decouple(), dPin(), H_ANA, H_DIG_HI, H_DIG_LO (+36 more)

### Community 34 - "readouts.ts"
Cohesion: 0.17
Nodes (10): createReadoutEval(), cycleFrom(), derivedValue(), PeakHold, Published, readoutGraphErrors(), readSource(), sample() (+2 more)

### Community 35 - "tb6612fng.ts"
Cohesion: 0.11
Nodes (10): BAT, BAT_BLACK, BAT_RED, DIODE, HDR, MOT, MOT_T1, MOT_T2 (+2 more)

### Community 36 - "three/index.ts"
Cohesion: 0.15
Nodes (18): BenchBaseProps, INK_PX, InkContext, InkInstancesProps, InkMeshProps, LED_LOOK, SmokeProps, decals (+10 more)

### Community 37 - "HC-SR04 Ultrasonic Ranger"
Cohesion: 0.11
Nodes (18): Behaviors, Board, Circuit, F1: Cold morning, code still assumes 20 °C, F2: ECHO wire falls off, F3: A second ranger pinging at the same time, Failures, For mechanical engineers (+10 more)

### Community 38 - "Soldering and Rework"
Cohesion: 0.12
Nodes (15): F1: Cold joint on J2, F2: Solder bridge between pads D5 and D6, F3: Lifted pad on J3 (overheated during rework), Failures, For mechanical engineers, Learning goals, Meet the board, Pro tips (+7 more)

### Community 39 - "The MOSFET Switch"
Cohesion: 0.12
Nodes (16): Board, Circuit, F1: A standard (non-logic-level) MOSFET on a 3.3 V GPIO, F2: The MOSFET fails short, F3: Forget the common ground, Failures, For mechanical engineers, Learning goals (+8 more)

### Community 40 - "Linear and Buck Regulators"
Cohesion: 0.12
Nodes (16): Board, Circuit, F1: Ask the linear regulator for 1 A, F2: Feed it only 6 V (dropout), F3: Switch to a 24 V supply, Failures, For mechanical engineers, Learning goals (+8 more)

### Community 41 - "VirtualMcu"
Cohesion: 0.06
Nodes (13): Behaviors, Circuit, Quiz, SIM NOTE, Task B — Arduino transpiler and virtual MCU (`src/engine/mcu/`), makeRng(), run(), EventQueue (+5 more)

### Community 42 - "curriculum/README.md"
Cohesion: 0.14
Nodes (9): Circuit Atelier: Curriculum (T0–T3), File format, Order and prerequisites, Prerequisite graph (summary), Rating conventions used throughout, T0 Foundations, T1 Passives, T2 Semiconductors (+1 more)

### Community 43 - ".oxlintrc.json"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 44 - "kirchhoff.ts"
Cohesion: 0.11
Nodes (16): BB, lesson, METER_AT, PSU_AT, r1Far, r1Node, r2Far, r2Node (+8 more)

### Community 45 - "Batteries"
Cohesion: 0.12
Nodes (16): Batteries, Board, Circuit, F1: Keys in the pocket (terminals shorted), F2: A tired battery, F3: Chase maximum power, Failures, For mechanical engineers (+8 more)

### Community 46 - "The Breadboard"
Cohesion: 0.12
Nodes (15): Board, Circuit, F1: Both resistor legs pushed into row 10, F2: LED legs in the same strip, F3: Split ground rail, F4: A jumper lands in row 15 instead of row 10, Failures, For mechanical engineers (+7 more)

### Community 47 - "Charge, Voltage and Current"
Cohesion: 0.12
Nodes (15): Board, Charge, Voltage and Current, Circuit, F1: Open the loop, F2: Bypass the resistor with a jumper, F3: Put the cells in backwards, Failures, For mechanical engineers (+7 more)

### Community 48 - "Kirchhoff's Laws"
Cohesion: 0.13
Nodes (14): Board, Circuit, F1: Turn channel 1 up to 12 V, F2: The sink arm goes open, F3: Short node A to ground, Failures, For mechanical engineers, Kirchhoff's Laws (+6 more)

### Community 49 - "Ohm's Law"
Cohesion: 0.12
Nodes (17): Board, Circuit, F1: 12 V into 100 Ω, F2: Misread colour bands (10 Ω fitted instead of 1 kΩ), F3: Resistor lead pulls out of the board, F4: Short the output, Failures, For mechanical engineers (+9 more)

### Community 50 - "AC and the Oscilloscope"
Cohesion: 0.13
Nodes (14): AC and the Oscilloscope, Board, Circuit, F1: Add a 5 V DC offset, F2: Turn the frequency up to 500 Hz, F3: Load the generator with 47 Ω, Failures, For mechanical engineers (+6 more)

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

### Community 56 - "T5/l298n.ts"
Cohesion: 0.05
Nodes (38): Board, Circuit, F1: Forget the pull-down on input A, F2: Short the output to ground, F3: Run the discrete gate from 3 V, Failures, For mechanical engineers, Learning goals (+30 more)

### Community 57 - "Interrupts and Timers"
Cohesion: 0.13
Nodes (14): Board, F1: Remove the debounce capacitor, F2: Leave out the tach pull-up, F3: Spin the wheel at 300 kHz, Failures, For mechanical engineers, Interrupts and Timers, Learning goals (+6 more)

### Community 59 - "Power and Heat"
Cohesion: 0.12
Nodes (15): Board, Circuit, F1: 47 Ω on 5 V, F2: Same resistor, supply turned up to 12 V, F3: Fit a 2 W resistor instead, Failures, For mechanical engineers, Learning goals (+7 more)

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
Cohesion: 0.13
Nodes (14): Board, Circuit, F1: Short the secondary, F2: Overload: 6 Ω instead of 12 Ω, F3: Unload it, Failures, For mechanical engineers, Learning goals (+6 more)

### Community 64 - "Diodes and Rectifiers"
Cohesion: 0.12
Nodes (15): Board, Circuit, Diodes and Rectifiers, F1: One diode goes open, F2: Leave out the smoothing capacitor, F3: A diode fails short, Failures, For mechanical engineers (+7 more)

### Community 65 - "The Zener Regulator"
Cohesion: 0.12
Nodes (15): Board, Circuit, F1: Plug in a 15 V adapter, F2: Ask for too much current (100 Ω load), F3: Zener fitted backwards, Failures, For mechanical engineers, Learning goals (+7 more)

### Community 66 - "The 555 Timer"
Cohesion: 0.13
Nodes (14): Board, Circuit, F1: Leave out R1 (pin 7 tied straight to V_CC), F2: Remove the timing capacitor, F3: Run it from two AA cells, Failures, For mechanical engineers, Learning goals (+6 more)

### Community 67 - "PCA9685 Servo Driver"
Cohesion: 0.14
Nodes (14): Board, For mechanical engineers, Learning goals, Meet the board, PCA9685 Servo Driver, Pro tips, Quiz, Readouts (+6 more)

### Community 68 - "ui/types.ts"
Cohesion: 0.40
Nodes (8): BenchStatus, BenchActionsProps, StatusPanelProps, BenchAction, FailureChoice, PaletteSwatch, PartChoice, ReadoutView

### Community 69 - "Instruments.tsx"
Cohesion: 0.06
Nodes (42): Decisions, defaultFloor(), findTrigger(), SampleRing, fill(), TriggerSpec, ChartSignal, setChart() (+34 more)

### Community 70 - "L298N Module"
Cohesion: 0.14
Nodes (13): Behaviors, Board, Circuit, For mechanical engineers, L298N Module, Learning goals, Meet the board, Pro tips (+5 more)

### Community 71 - "Transpiler"
Cohesion: 0.18
Nodes (6): castPrefix(), intWrapper(), isFloatLit(), jsName(), kindOf(), Transpiler

### Community 72 - "parts/index.ts"
Cohesion: 0.05
Nodes (48): SIM NOTE, Task C — 3D look and parametric part library (`src/three/`), PartKind, Entry, wireColor(), Breadboard, LoadCell, Module (+40 more)

### Community 73 - "Solution"
Cohesion: 0.07
Nodes (14): curOf(), curOf(), extraOf(), curOf(), curOf(), extraOf(), ReadoutEval, Blend (+6 more)

### Community 74 - "esp32-s3.ts"
Cohesion: 0.10
Nodes (23): Behaviors, Board, Circuit, BB, DK, j1(), j3(), ledAnode (+15 more)

### Community 75 - "Tweaks.tsx"
Cohesion: 0.18
Nodes (18): clamp(), isOn(), momentaryValues(), snapTweak(), base, Tweak, TweakTarget, PREFIXES (+10 more)

### Community 76 - "imu-mpu6050.ts"
Cohesion: 0.14
Nodes (28): ACCEL_LSB, accelLsb(), acks(), advanceTruth(), busHealthy(), busRead16(), busWriteBits(), chipAddress() (+20 more)

### Community 77 - "createBench"
Cohesion: 0.09
Nodes (49): allPlaced(), AssemblyAction, AssemblyEvent, AssemblyResult, AssemblyState, benchStatus(), buildParts(), burnText() (+41 more)

### Community 78 - "ink.tsx"
Cohesion: 0.10
Nodes (30): Bake(), bakeable(), BAKED_INK_PX, bakeGroup(), BakeResult, Bucket, isHullHost(), linesOf() (+22 more)

### Community 79 - ".snapshot"
Cohesion: 0.04
Nodes (35): Bench, frames(), [TERM, CURRENT, LOAD_P, INT_P], lesson, [CURRENT, BATTERY, LED_V, CHARGE, E_RATE, R1_DROP], L, runFor(), runUntil() (+27 more)

### Community 80 - "charge-voltage-current.ts"
Cohesion: 0.10
Nodes (19): BB, j1, jackA, jackCom, LED_RATING, ledAnode, ledCathode, METER_AT (+11 more)

### Community 81 - "Debugging Instruments"
Cohesion: 0.12
Nodes (15): Debugging Instruments, F1: Measure the 5 V rail with the leads still in the mA jack, F2: Scope ground clip on the 5 V rail, F3: Trust the DMM on the 10 MΩ divider, Failures, For mechanical engineers, Learning goals, Meet the board (+7 more)

### Community 82 - "V"
Cohesion: 0.25
Nodes (8): Engine requirements gathered from SIM NOTEs, SIM NOTE, SIM NOTE, SIM NOTE, SIM NOTE, SIM NOTE, SIM NOTE, V()

### Community 83 - "series-parallel.ts"
Cohesion: 0.10
Nodes (17): BB, lesson, METER_AT, PACK_AT, r1L, r1R, r2L, r2R (+9 more)

### Community 84 - "Gallery.tsx"
Cohesion: 0.07
Nodes (53): BenchBase(), gridTile(), rulerStrip(), btn, Check(), DrawStats(), ENTRIES, Gallery() (+45 more)

### Community 85 - "Circuit Atelier — Spec"
Cohesion: 0.20
Nodes (10): 1. Experience, 2. Visual identity (original), 3. Lesson data model, 6. Tracks (syllabus), Bench actions, Circuit Atelier — Spec, Failures, Status panel (+2 more)

### Community 86 - "connectors.tsx"
Cohesion: 0.14
Nodes (25): HeaderFemaleBody(), HeaderMaleBody(), microMouthGeo(), microShape(), ScrewTerminal, UsbC, CHIP_SIZES, DipGeom (+17 more)

### Community 87 - "Callout.tsx"
Cohesion: 0.09
Nodes (18): PartCalloutSpec, Callout(), CALLOUT_REF_ZOOM, CalloutHost(), CalloutLayerContext, CalloutProps, Pill(), PillActions (+10 more)

### Community 88 - "InkMesh"
Cohesion: 0.12
Nodes (50): extrudeAlongX(), flattedCircleShape(), InkInstances(), InkMesh(), useLookMaterial(), BreadboardBody(), LoadCellBody(), UltrasonicBody() (+42 more)

### Community 89 - "semis.tsx"
Cohesion: 0.14
Nodes (23): extrudeAlongZ(), mergedBoxes(), ledLook(), tint(), loadCellGeo(), GlowHalo(), dipGeom(), DipBody() (+15 more)

### Community 90 - "lessonSchema.ts"
Cohesion: 0.06
Nodes (36): Per-lesson task (the same for every author), lesson(), behaviorRef, COMMON_KEYS, currentSource, element, hasKey(), instruments (+28 more)

### Community 91 - "dependencies"
Cohesion: 0.17
Nodes (12): dependencies, marked@^18.1.3, react@^19.3.1, react-dom@^19.3.1, @react-three/fiber@^9.8.2, three@^0.187.0, zod@^4.6.7, zustand@^5.1.0 (+4 more)

### Community 92 - "resistor-codes-divider.ts"
Cohesion: 0.07
Nodes (25): BAT_AT, batMinus, batPlus, BB, DMM_AT, jackCom, jackV, ldL (+17 more)

### Community 93 - "Board.tsx"
Cohesion: 0.14
Nodes (22): PartPlacement, Anim, Board(), easeOut(), explodeLayer(), LED_KINDS, liveParams(), MOTOR_KINDS (+14 more)

### Community 94 - "extensions.test.ts"
Cohesion: 0.21
Nodes (8): Adafruit_PWMServoDriver, harness(), PinEvent, quadEdges(), run(), runSketch(), sensor(), Thing

### Community 95 - "Layout.tsx"
Cohesion: 0.09
Nodes (35): What exists on main (use graphify to explore), QuizItem, Track, TrackId, BenchActions(), Controls(), ControlsProps, SettingChange (+27 more)

### Community 96 - "UART, I²C and SPI"
Cohesion: 0.11
Nodes (18): Behaviors, Board, Circuit, F1: Analyzer (or monitor) at the wrong baud, F2: 47 kΩ pull-ups at 400 kHz, F3: Pull-ups missing, Failures, For mechanical engineers (+10 more)

### Community 97 - "store.ts"
Cohesion: 0.14
Nodes (13): App(), BenchScene, summaries, patch, lessonDefs, lessons, modules, PIN_ORDER (+5 more)

### Community 98 - "compile"
Cohesion: 0.16
Nodes (19): blankParams(), branchCount(), compile(), extraKeys(), extraNodes(), hasInternalNode(), inheritState(), isNonlinear() (+11 more)

### Community 99 - "5. Virtual MCU (`src/engine/mcu`)"
Cohesion: 0.18
Nodes (5): Learning goals, 5. Virtual MCU (`src/engine/mcu`), constrain(), pwmHzFor(), VirtualMcuOptions

### Community 100 - "BenchScene.tsx"
Cohesion: 0.09
Nodes (34): @react-three/fiber, BenchScene(), box, Camera(), cardInset(), DevPartProbe(), findPart(), fitZoom() (+26 more)

### Community 101 - "pca9685.ts"
Cohesion: 0.15
Nodes (16): address(), busOk(), decode(), freqActual(), gndOk(), groundPath(), makeServos(), num() (+8 more)

### Community 103 - "pca9685-servo.ts"
Cohesion: 0.11
Nodes (14): Board, jumper(), BRD, LOGIC, PSU, pwmPin(), SERVO_X, servoLead() (+6 more)

### Community 104 - "Circuit Atelier — interactive electronics course"
Cohesion: 0.33
Nodes (5): Circuit Atelier — interactive electronics course, Commands, Memory and context: graphify (use first), Rules, Workflow: superpowers skills (in `.claude/skills/`)

### Community 105 - "led-resistor.ts"
Cohesion: 0.13
Nodes (13): UNO, BB, gnd, j1, LED_RATING, ledAnode, ledCathode, pin13 (+5 more)

### Community 106 - "capacitor-rc.ts"
Cohesion: 0.07
Nodes (25): BB, btnAt, C1_RATING, c1Minus, c1Plus, DMM_AT, jackCom, jackV (+17 more)

### Community 107 - "multimeter.ts"
Cohesion: 0.08
Nodes (22): AM_AT, BB, lesson, postMinus, postPlus, PSU_AT, r1L, r1R (+14 more)

### Community 108 - "inductor-rl.ts"
Cohesion: 0.09
Nodes (19): BB, D1, d1Anode, d1Cathode, L1, l1Left, l1Right, lesson (+11 more)

### Community 109 - "mcu-supply.test.ts"
Cohesion: 0.10
Nodes (16): modules, registry, resolveBehaviorRef(), ResolvedBehavior, behavior, fMaxAt(), fresh(), minVccFor() (+8 more)

### Community 110 - "a4988.ts"
Cohesion: 0.10
Nodes (21): behavior, coil(), COS, decodeMicrostep(), find(), fresh(), mod(), num() (+13 more)

### Community 111 - "vitest"
Cohesion: 0.08
Nodes (36): chain(), msPerFrame(), ratingsMs(), BURN_DELAY, checkInstant(), checkRatings(), createRatingState(), curOf() (+28 more)

### Community 112 - "PCB Design Workflow"
Cohesion: 0.11
Nodes (18): Behaviors, Board, Circuit, F1: Forgot the CC resistors, F2: Solder bridge from PB5 to the neighbouring GND pin, F3: LED footprint drawn backwards, Failures, For mechanical engineers (+10 more)

### Community 113 - "passives.tsx"
Cohesion: 0.11
Nodes (38): chamferRectShape(), extrudeUp(), geo(), lathe(), stadiumShape(), CylX(), LeadPath(), Rod() (+30 more)

### Community 114 - "behaviors/l298n.ts"
Cohesion: 0.08
Nodes (20): allOpen(), behavior, Channel, channel(), channels(), coastPwmLoss(), coastPwmSource(), decodeL298() (+12 more)

### Community 115 - "smoke.spec.ts"
Cohesion: 0.18
Nodes (9): Behaviors, Circuit, mA(), panel(), Probe, readout(), @playwright/test@^1.65.0, PORT (+1 more)

### Community 116 - "Lesson"
Cohesion: 0.06
Nodes (23): behavior, complementaryTau(), imuLesson(), run(), BenchSnapshot, Lesson, lesson, lesson (+15 more)

### Community 117 - "TryItYourself.tsx"
Cohesion: 0.25
Nodes (8): @codemirror/lang-cpp@^6.0.3, @uiw/react-codemirror@^4.25.12, @codemirror/lang-cpp, @uiw/react-codemirror, Sketch, sketchBaud(), TryItYourself(), TryItYourselfProps

### Community 118 - "wifi-sim.ts"
Cohesion: 0.05
Nodes (40): behavior, enterDownload(), leave(), num(), ROM_LINES, sample(), state(), states (+32 more)

### Community 119 - "engine/types.ts"
Cohesion: 0.12
Nodes (16): vitest, Dev, gateOut(), applyBurn(), applyPatches(), failureNodes(), OPEN_R, setElementKey() (+8 more)

### Community 120 - "BehaviorContext"
Cohesion: 0.13
Nodes (6): Constraints, Deliverables, M1 Task E — Integration: bench store, Board composer, behavior framework, first lesson, publishAll(), Fake, BehaviorContext

### Community 121 - "scripts"
Cohesion: 0.22
Nodes (9): scripts, build, dev, graph, lint, preview, test, test:e2e (+1 more)

### Community 122 - "M2 — Video lessons (parallel authors)"
Cohesion: 0.40
Nodes (4): After each batch, Batch 1 (shared behaviors land here first), Batch 2, M2 — Video lessons (parallel authors)

### Community 123 - "AppState"
Cohesion: 0.12
Nodes (5): AppState, Item(), Toast(), ToastProps, ToastMessage

### Community 124 - "ohms-law.ts"
Cohesion: 0.12
Nodes (14): between(), BB, DMM_AT, jackA, jackCom, lesson, postMinus, postPlus (+6 more)

### Community 125 - "a4988-stepper.ts"
Cohesion: 0.07
Nodes (17): BB_H, PITCH, HDR, JACK, JACK_N, JACK_P, MOT, UNO_AT (+9 more)

### Community 126 - "M1.5 — Engine extensions (triaged from the curriculum SIM NOTEs)"
Cohesion: 0.25
Nodes (7): Global constraints, M1.5 — Engine extensions (triaged from the curriculum SIM NOTEs), X1 — Simulator (`src/engine/sim/`), X2 — Virtual MCU (`src/engine/mcu/`), X3 — Behavior framework (`src/engine/behaviors/`), X4 — UI and bench, X5 — 3D part additions

### Community 127 - "zener.ts"
Cohesion: 0.09
Nodes (21): BAT_AT, batMinus, batPlus, BB, DMM_AT, jackCom, jackV, R1_RATING (+13 more)

### Community 128 - "autoFrame.ts"
Cohesion: 0.17
Nodes (19): Task E — Integration (after A–D are merged), BoardSpec, AUTO_MARGIN, AUTO_MIN_SIZE, autoFrame(), BASE_KINDS, boardFrame(), Bounds (+11 more)

### Community 129 - "inductor-rl.test.ts"
Cohesion: 0.14
Nodes (11): L, [METER, AMMETER, BURDEN, MID, TRUE_I], powered(), runFor(), charge(), [I_L, V_TOP, V_SW, P_R1, V_SW_PEAK], L, powered() (+3 more)

### Community 130 - "batteries.ts"
Cohesion: 0.12
Nodes (15): bbHole(), BAT_AT, BB, lesson, LOAD_AT, LOAD_RATING, METER_AT, snapMinus (+7 more)

### Community 131 - "power-heat.ts"
Cohesion: 0.13
Nodes (12): BENCH_Y, BB, lesson, METER_AT, PSU_AT, R1_RATING, r1Left, r1Right (+4 more)

### Community 132 - "breadboard.ts"
Cohesion: 0.15
Nodes (11): LessonDef, BB, bridge, fBlack, fRed, j1, j1Wrong, j2 (+3 more)

### Community 133 - "I2cDevice"
Cohesion: 0.17
Nodes (6): Behaviors, Rules, Shared behaviors, The context (`BehaviorContext`, `src/engine/types.ts`), I2cDevice, SpiDevice

### Community 134 - "inspector.ts"
Cohesion: 0.10
Nodes (37): lesson, BAND_HEX, BandColor, BandOptions, capacitorCode(), DIGIT_COLORS, parseOhms(), resistorBands() (+29 more)

### Community 135 - "store.ts"
Cohesion: 0.23
Nodes (17): setEffectsEnabled(), asCode(), asProgress(), asSettings(), CameraView, debounce(), DEFAULT_SETTINGS, isRecord() (+9 more)

### Community 136 - "Writing a lesson"
Cohesion: 0.22
Nodes (8): Fast switching transients (`sim.edgeSubsteps`), Instruments (`lesson.instruments`), Layout helpers (`layout.ts`), Part inspector and `facts`, Readouts: units, derived values, peak-hold, Sim speed (`sim.speed`), Tweak kinds, Writing a lesson

### Community 137 - "T5/l298n.test.ts"
Cohesion: 0.29
Nodes (6): L298_MODE, lesson, FWD(), hold(), lesson, run()

### Community 138 - "Highlight.tsx"
Cohesion: 0.16
Nodes (15): @react-three/drei@^10.7.9, @react-three/drei, box, bracketSegments(), inv, keyOf(), localBox(), Mark (+7 more)

### Community 139 - "frame.tsx"
Cohesion: 0.27
Nodes (11): react, bakeKeyOf(), definePart(), Part(), filletWedge(), metas, partBakeKey(), SolderJoints() (+3 more)

### Community 140 - "pca9685.test.ts"
Cohesion: 0.17
Nodes (6): behavior, prescaleFor(), REG, Fake, setup50(), usToDeg()

### Community 141 - "Driver"
Cohesion: 0.17
Nodes (3): Behaviors, Circuit, Driver

### Community 142 - "M3 — Foundations, Passives, Semiconductors (T0–T2)"
Cohesion: 0.33
Nodes (5): Batch 1 (no new engine features), Batch 2, Batch 3 (after X4 and X6), Batch 4, M3 — Foundations, Passives, Semiconductors (T0–T2)

### Community 143 - "acks"
Cohesion: 0.39
Nodes (8): acks(), device(), devRead(), devWrite(), nextPtr(), rx(), tx(), writeReg()

### Community 144 - "4. Simulation engine (`src/engine/sim`)"
Cohesion: 0.40
Nodes (5): SIM NOTE, SIM NOTE, 4. Simulation engine (`src/engine/sim`), D(), I()

### Community 145 - "series-parallel.test.ts"
Cohesion: 0.40
Nodes (4): [I_T, I_2, I_3, V_B], L, powered(), runFor()

### Community 146 - ".v"
Cohesion: 0.60
Nodes (4): enDuty(), level(), dutyOf(), level()

### Community 147 - "Failures"
Cohesion: 0.50
Nodes (4): F1: No current limit (trimmer at the stop), F2: Unplug the motor while powered, F3: MS wires fall off, Failures

### Community 148 - "Failures"
Cohesion: 0.50
Nodes (4): F1: Remove the flyback diodes, then stop, F2: Run two motors at 1.5 A without the heatsink, F3: Run it from a single Li-ion cell (3.7 V), Failures

### Community 149 - "Failures"
Cohesion: 0.50
Nodes (4): F1: Power the servos from the Uno's 5 V pin, F2: No common ground, F3: Breakout without I²C pull-ups, Failures

### Community 150 - "Failures"
Cohesion: 0.50
Nodes (4): F1: Remove the heatsink, F2: Run it from 24 V, F3: Mount it dry (no grease, poor contact), Failures

## Knowledge Gaps
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Lesson` connect `Lesson` to `autoFrame.ts`, `inductor-rl.test.ts`, `inspector.ts`, `store.ts`, `T5/l298n.test.ts`, `createBench`, `engine/types.ts`, `series-parallel.test.ts`, `curriculum/README.md`, `Instruments.tsx`, `createBench`, `.snapshot`, `Circuit Atelier — Spec`, `lessonSchema.ts`, `Board.tsx`, `Layout.tsx`, `store.ts`, `BenchScene.tsx`, `mcu-supply.test.ts`, `wifi-sim.ts`, `BehaviorContext`, `AppState`?**
  _High betweenness centrality (0.135) - this node is a cross-community bridge._
- **Are the 7 inferred relationships involving `createBench()` (e.g. with `Deliverables` and `resolveBehaviorRef()`) actually correct?**
  _`createBench()` has 7 INFERRED edges - model-reasoned connections that need verification._
- **Should `devices.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.046296296296296294 - nodes in this community are weakly interconnected._
- **Why does `Circuit Atelier: Curriculum (T0–T3)` connect `curriculum/README.md` to `V`, `Lesson`?**
  _High betweenness centrality (0.131) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `VirtualMcu` (e.g. with `SIM NOTE` and `5. Virtual MCU (`src/engine/mcu`)`) actually correct?**
  _`VirtualMcu` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `ink.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.09113300492610837 - nodes in this community are weakly interconnected._
- **Why does `VirtualMcu` connect `VirtualMcu` to `5. Virtual MCU (`src/engine/mcu`)`, `I2cDevice`, `runtime.ts`, `transpile.ts`, `createBench`, `engine/types.ts`, `createBench`, `transient.ts`, `Arduino Uno R3`, `extensions.test.ts`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._