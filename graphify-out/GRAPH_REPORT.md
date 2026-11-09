# Graph Report - Electonics Interactive course  (2026-11-09)

## Corpus Check
- 371 files · ~554,111 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 7 file(s) not represented in the graph (top: .css 4, (none) 3)

## Summary
- 4494 nodes · 9615 edges · 190 communities (184 shown, 6 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 571 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `4a0624c5`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- devices.ts
- layout.ts
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
- three/index.ts
- engine/types.ts
- getLesson
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
- compile
- ESP32-S3 DevKitC-1
- tb6612.ts
- TB6612FNG Dual H-Bridge
- arduino-uno.ts
- createBench
- tb6612fng.ts
- opamp-basics.ts
- HC-SR04 Ultrasonic Ranger
- logic-analyzer.test.ts
- The MOSFET Switch
- Linear and Buck Regulators
- VirtualMcu
- Order and prerequisites
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
- Layout.tsx
- Instruments.tsx
- L298N Module
- Transpiler
- thermal-network.test.ts
- Solution
- esp32-s3.ts
- Tweaks.tsx
- pca9685.ts
- createBench
- pid-motor-control.ts
- .snapshot
- charge-voltage-current.ts
- Debugging Instruments
- diode-rectifier.ts
- series-parallel.ts
- Gallery.tsx
- esp32Bench.ts
- V
- CalloutLayer
- InkMesh
- logic-analyzer.ts
- lessonSchema.ts
- dependencies
- resistor-codes-divider.ts
- Board.tsx
- Decisions
- App.tsx
- UART, I²C and SPI
- lessons/index.ts
- timer-555.ts
- 5. Virtual MCU (`src/engine/mcu`)
- three/index.ts
- wifi-sim.ts
- series-rlc.test.ts
- pca9685-servo.ts
- Circuit Atelier — interactive electronics course
- ratings.ts
- capacitor-rc.ts
- multimeter.ts
- inductor-rl.ts
- SampleRing
- a4988.ts
- Element
- PCB Design Workflow
- ac-meter.ts
- behaviors/l298n.ts
- smoke.spec.ts
- imu-mpu6050.test.ts
- TryItYourself.tsx
- serial-protocols.ts
- hx711.ts
- motion.tsx
- scripts
- coulomb-counter.ts
- AppState
- ohms-law.ts
- mpu6050-imu.ts
- M1.5 — Engine extensions (triaged from the curriculum SIM NOTEs)
- zener.ts
- adc-dac-pwm.ts
- inductor-rl.test.ts
- batteries.ts
- power-heat.ts
- layout.ts
- hc595.ts
- inspector.ts
- store.ts
- Lesson
- LogicAnalyzer.tsx
- kirchhoff.test.ts
- BehaviorContext
- transformer.ts
- Driver
- M3 — Foundations, Passives, Semiconductors (T0–T2)
- mosfet-switch.ts
- Soldering and Rework
- I2cLines
- ws2812.ts
- LessonDef
- rlc-resonance.ts
- decode.ts
- quad-encoder.ts
- ne555.ts
- encoders.ts
- mcu-supply.ts
- BehaviorContext
- PinState
- EdgeTrace
- hc393.ts
- jumper
- tb6612fng.test.ts
- breadboard.test.ts
- 5. Virtual MCU (`src/engine/mcu`)
- ohms-law.test.ts
- logic.test.ts
- rlc-resonance.test.ts
- scopeView.ts
- M4 — Digital, Sensors, Professional, Capstone (T3, T4 rest, T5 rest, T6 rest, T7)
- loadcell-hx711.ts
- hcsr04.test.ts
- switch-bounce.ts
- ntc.ts
- led-resistor.ts
- hcsr04.ts
- irq-bounce.ts
- BehaviorMcu
- hc74.ts
- Tasks A–D are independent and run in parallel worktrees. Task E integrates them.
- M2 — Video lessons (parallel authors)
- formatSI
- Failures
- interrupts-timers.test.ts
- j1
- Menu.tsx
- Guide
- @playwright/test
- ac-meter.perf.test.ts
- SIM NOTE
- Failures
- block

## God Nodes (most connected - your core abstractions)
1. `createBench()` - 204 edges
2. `vitest` - 135 edges
3. `Lesson` - 101 edges
4. `Bench` - 79 edges
5. `VirtualMcu` - 78 edges
6. `validateLesson()` - 67 edges
7. `InkMesh()` - 63 edges
8. `BehaviorContext` - 59 edges
9. `Behavior` - 58 edges
10. `BenchSnapshot` - 54 edges

## Surprising Connections (you probably didn't know these)
- `Per-lesson task (the same for every author)` --references--> `validateLesson()`  [INFERRED]
  docs/plans/m2-video-lessons.md → src/engine/lessonSchema.ts
- `SIM NOTE` --references--> `VirtualMcu`  [INFERRED]
  docs/curriculum/T4/arduino-uno.md → src/engine/mcu/virtualMcu.ts
- `F3: Fit a 2 W resistor instead` --references--> `applyPatches()`  [INFERRED]
  docs/curriculum/T0/power-heat.md → src/engine/sim/failures.ts
- `SIM NOTE` --references--> `applyPatches()`  [INFERRED]
  docs/curriculum/T0/power-heat.md → src/engine/sim/failures.ts
- `SIM NOTE` --references--> `PartKind`  [INFERRED]
  docs/curriculum/T7/capstone-balancing-robot.md → src/engine/types.ts

## Import Cycles
- None detected.

## Communities (190 total, 6 thin omitted)

### Community 0 - "devices.ts"
Cohesion: 0.05
Nodes (74): BJT_BETA, BJT_BETA_R, BJT_IS, bjtEval(), BK, BREAK_KNEE, BREAK_RZ, breakEval() (+66 more)

### Community 1 - "layout.ts"
Cohesion: 0.10
Nodes (19): LogicGate, BB1, BB2, dipAt(), gateChip(), GEN_AT, genGnd, genOut (+11 more)

### Community 2 - "Capstone: Two-Wheel Balancer"
Cohesion: 0.10
Nodes (19): Behaviors, Board, Capstone: Two-Wheel Balancer, Circuit, F1: Tired, high-resistance battery, F2: IMU mounted 3° off, F3: Right motor wired backwards, F4: Worn gearbox (4° backlash) (+11 more)

### Community 3 - "ADC, DAC and PWM"
Cohesion: 0.06
Nodes (32): Board, Circuit, F1: Use an old analog meter (20 kΩ/V on the 10 V range), F2: Measure volts with the red lead still in the mA jack, F3: The bottom resistor falls out while you measure, Failures, For mechanical engineers, Learning goals (+24 more)

### Community 4 - "solve.ts"
Cohesion: 0.09
Nodes (30): Compiled, Dev, GMIN, IP, LinSlot, Measured, BRANCH_PIVOT_RTOL, clearSystem() (+22 more)

### Community 5 - "deploy.yml"
Cohesion: 0.06
Nodes (31): runs-on, steps, concurrency, cancel-in-progress, group, environment, needs, runs-on (+23 more)

### Community 6 - "sound.ts"
Cohesion: 0.15
Nodes (26): BASS, BEATS_PER_CHORD, beatSeconds(), BPM, chordSeconds(), HAT_STEPS, KICK_STEPS, loopSeconds() (+18 more)

### Community 7 - "runtime.ts"
Cohesion: 0.09
Nodes (43): SIM NOTE, arduinoMap(), arduinoRound(), bitClearFn(), bitSetFn(), bitWriteFn(), castInt(), CharBox (+35 more)

### Community 8 - "transpile.ts"
Cohesion: 0.06
Nodes (43): ARDUINO_CONSTANTS, BUILTIN_NAMES, UNSUPPORTED_API, STRING_FLOAT_METHODS, STRING_INPLACE, STRING_INT_METHODS, STRING_METHOD_NAMES, errorOf() (+35 more)

### Community 9 - "package.json"
Cohesion: 0.10
Nodes (24): devDependencies, jsdom@^31.0.0, oxlint@^1.90.0, @types/node@^24.19.2, @types/react@^19.3.0, @types/react-dom@^19.3.0, @types/three@^0.187.0, typescript@~7.0.2 (+16 more)

### Community 10 - "constants.ts"
Cohesion: 0.05
Nodes (37): A0, A1, A2, A3, A4, A5, A6, A7 (+29 more)

### Community 11 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+11 more)

### Community 12 - "three/index.ts"
Cohesion: 0.04
Nodes (94): react, @react-three/drei, @react-three/fiber, BenchScene(), box, Camera(), cardInset(), DevPartProbe() (+86 more)

### Community 13 - "engine/types.ts"
Cohesion: 0.03
Nodes (29): vitest, lesson, lesson, lesson, lesson, lesson, lesson, lesson (+21 more)

### Community 14 - "getLesson"
Cohesion: 0.11
Nodes (35): benchActionEvents(), createGuide(), passes(), eventMatches(), GuideBenchView, GuideEvent, GuideUi, tweak (+27 more)

### Community 15 - "boards.tsx"
Cohesion: 0.06
Nodes (85): Art, At(), boardArt(), boardGeo(), BoardSlab(), Breadboard, GenericModule(), LoadCell (+77 more)

### Community 16 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 17 - "A4988 Stepper Driver"
Cohesion: 0.14
Nodes (13): A4988 Stepper Driver, Behaviors, Board, Circuit, For mechanical engineers, Learning goals, Meet the board, Pro tips (+5 more)

### Community 18 - "transient.ts"
Cohesion: 0.11
Nodes (34): captureState(), inheritState(), modesChanged(), partition(), coil(), settle(), lastPeriodPeak(), lc (+26 more)

### Community 19 - "Quadrature Encoders"
Cohesion: 0.12
Nodes (16): Board, F1: Missing pull-ups, F2: A and B swapped, F3: Overdrive it on 12 V with noisy wiring, Failures, For mechanical engineers, Learning goals, Meet the board (+8 more)

### Community 20 - "transistor-switch.ts"
Cohesion: 0.07
Nodes (26): BB, d1Anode, d1Cathode, jRb, lesson, M1, MOTOR_AT, PACK_AT (+18 more)

### Community 21 - "NTC Thermistor"
Cohesion: 0.10
Nodes (19): Behaviors, Board, Circuit, F1: Wrong part on the reel (B = 3435 K), code still says 3977, F2: Thermistor lead breaks, F3: A 1 kΩ resistor fitted instead of 10 kΩ, Failures, For mechanical engineers (+11 more)

### Community 22 - "MPU-6050 IMU"
Cohesion: 0.10
Nodes (19): Behaviors, Board, Circuit, F1: Warm the sensor after calibrating, F2: Remove the I²C pull-ups, F3: AD0 pulled high, Failures, For mechanical engineers (+11 more)

### Community 23 - "PID Motor Speed Control"
Cohesion: 0.11
Nodes (17): Behaviors, Board, Circuit, F1: Encoder A/B swapped (positive feedback), F2: Encoder pull-ups missing (lost feedback), F3: Tired battery (actuator saturation), Failures, For mechanical engineers (+9 more)

### Community 24 - "Power, Grounding and EMC"
Cohesion: 0.09
Nodes (20): Behaviors, Board, Circuit, F1: Return the load through the sensor ground, F2: The same, with thin 30 AWG wire, F3: Swap in a non-logic-level MOSFET (IRF540N, worst-case part), Failures, For mechanical engineers (+12 more)

### Community 25 - "Load Cell and HX711"
Cohesion: 0.09
Nodes (22): Board, Circuit, Datasheet figures (checked), Failures, Guide (8 steps), `hx711` behavior, Learning goals, Load Cell and HX711 (+14 more)

### Community 26 - "Thermal Design"
Cohesion: 0.05
Nodes (39): Behaviors, Board, Circuit, F1: Remove the heatsink, F2: Run it from 24 V, F3: Mount it dry (no grease, poor contact), Failures, For mechanical engineers (+31 more)

### Community 27 - "LED and Resistor"
Cohesion: 0.11
Nodes (17): Board, Circuit, F1: Leave the resistor out (jumper in its place), F2: 22 Ω fitted instead of 220 Ω (red-red-black), F3: LED in backwards, Failures, For mechanical engineers, Learning goals (+9 more)

### Community 28 - "The Transistor Switch"
Cohesion: 0.11
Nodes (18): Board, Circuit, F1: Remove the flyback diode, F2: Skip the base resistor, F3: Stall the motor, F4: Forget the common ground, Failures, For mechanical engineers (+10 more)

### Community 29 - "compile"
Cohesion: 0.19
Nodes (16): blankParams(), branchCount(), compile(), extraKeys(), extraNodes(), hasInternalNode(), isNonlinear(), layoutSignature() (+8 more)

### Community 30 - "ESP32-S3 DevKitC-1"
Cohesion: 0.11
Nodes (18): Behaviors, Board, Circuit, ESP32-S3 DevKitC-1, F1: Wire a 5 V signal straight into GPIO4, F2: LED with no resistor on GPIO5, F3: Button on GPIO0 held at power-up, Failures (+10 more)

### Community 31 - "tb6612.ts"
Cohesion: 0.09
Nodes (25): allOpen(), behavior, bridgeLoss(), Channel, channel(), channels(), CHATTER_PICK, ChatterState (+17 more)

### Community 32 - "TB6612FNG Dual H-Bridge"
Cohesion: 0.11
Nodes (18): Behaviors, Board, Circuit, F1: Stall it on a fresh 2S Li-ion pack, F2: VM from a 4S LiPo (16.8 V), F3: Forget the common ground, Failures, For mechanical engineers (+10 more)

### Community 33 - "arduino-uno.ts"
Cohesion: 0.04
Nodes (44): BB, benchParts, boardParts, decouple(), dPin(), H_ANA, H_DIG_HI, H_DIG_LO (+36 more)

### Community 34 - "createBench"
Cohesion: 0.04
Nodes (51): modules, registry, resolveBehaviorRef(), ResolvedBehavior, minVccFor(), boots(), frames(), pub() (+43 more)

### Community 35 - "tb6612fng.ts"
Cohesion: 0.11
Nodes (11): BAT, BAT_BLACK, BAT_RED, DIODE, HDR, lesson, MOT, MOT_T1 (+3 more)

### Community 36 - "opamp-basics.ts"
Cohesion: 0.06
Nodes (33): BB, dipAt, GEN_AT, genGnd, genOut, lesson, rfA, rfB (+25 more)

### Community 37 - "HC-SR04 Ultrasonic Ranger"
Cohesion: 0.10
Nodes (20): Authored notes (T6 build), Behaviors, Board, Circuit, F1: Cold morning, code still assumes 20 °C, F2: ECHO wire falls off, F3: A second ranger pinging at the same time, F4: 5 V ECHO into a 3.3 V microcontroller (+12 more)

### Community 38 - "logic-analyzer.test.ts"
Cohesion: 0.11
Nodes (11): behavior, behavior, LogicCapture, bench(), lesson(), Behaviors, Rules, Shared behaviors (+3 more)

### Community 39 - "The MOSFET Switch"
Cohesion: 0.11
Nodes (18): Board, Circuit, Datasheet check (IRLZ44N, Infineon/IR), F1: A standard (non-logic-level) MOSFET on a 3.3 V GPIO, F2: The MOSFET fails short, F3: Forget the common ground, F4: A 1 Ω heater (12 A) with no heatsink, Failures (+10 more)

### Community 40 - "Linear and Buck Regulators"
Cohesion: 0.14
Nodes (13): Board, Circuit, Datasheet figures used, F1 `hot-ldo`: Ask the LDO for 220 mA, F2 `low-input`: Feed it only 4 V (dropout), F3 `adapter-24v`: Plug in a 24 V adapter, Failures, Learning goals (+5 more)

### Community 41 - "VirtualMcu"
Cohesion: 0.06
Nodes (12): Behaviors, Circuit, Quiz, SIM NOTE, Task B — Arduino transpiler and virtual MCU (`src/engine/mcu/`), readAt(), make(), run() (+4 more)

### Community 42 - "Order and prerequisites"
Cohesion: 0.33
Nodes (6): Order and prerequisites, Prerequisite graph (summary), T0 Foundations, T1 Passives, T2 Semiconductors, T3 Digital

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
Cohesion: 0.11
Nodes (17): Board, Circuit, F1: 12 V into 100 Ω, F2: Misread colour bands (10 Ω fitted instead of 1 kΩ), F3: Resistor lead pulls out of the board, F4: Short the output, Failures, For mechanical engineers (+9 more)

### Community 50 - "AC and the Oscilloscope"
Cohesion: 0.13
Nodes (14): AC and the Oscilloscope, Board, Circuit, F1: Add a 3 V DC offset, F2: Turn the frequency up to 500 Hz, F3: Load the generator with 47 Ω, Failures, For mechanical engineers (+6 more)

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
Nodes (16): Board, Circuit, F1: Press SET and RESET together, F2: Cut one cross-coupling link, F3: Remove the debounce capacitor, Failures, Flip-Flops and Counters, For mechanical engineers (+8 more)

### Community 56 - "T5/l298n.ts"
Cohesion: 0.05
Nodes (40): AUTHORING NOTE (M4), Board, Circuit, F1: Forget the pull-down on input A, F2: Short the output to ground, F3: Run the discrete gate from 3 V, Failures, For mechanical engineers (+32 more)

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
Nodes (15): Board, Circuit, Diodes and Rectifiers, F1: One diode goes open, F2: Leave out the smoothing capacitor, F3: A diode fitted backwards, Failures, For mechanical engineers (+7 more)

### Community 65 - "The Zener Regulator"
Cohesion: 0.12
Nodes (15): Board, Circuit, F1: Plug in a 15 V adapter, F2: Ask for too much current (100 Ω load), F3: Zener fitted backwards, Failures, For mechanical engineers, Learning goals (+7 more)

### Community 66 - "The 555 Timer"
Cohesion: 0.13
Nodes (14): Board, Circuit, F1: Leave out R1 (pin 7 tied straight to V_CC), F2: Remove the timing capacitor, F3: Run it from two AA cells, Failures, For mechanical engineers, Learning goals (+6 more)

### Community 67 - "PCA9685 Servo Driver"
Cohesion: 0.18
Nodes (10): For mechanical engineers, Learning goals, Meet the board, PCA9685 Servo Driver, Pro tips, Quiz, Readouts, Sketch (+2 more)

### Community 68 - "Layout.tsx"
Cohesion: 0.11
Nodes (31): What exists on main (use graphify to explore), QuizItem, BenchActions(), Controls(), ControlsProps, SettingChange, speedLabel(), speedNote() (+23 more)

### Community 69 - "Instruments.tsx"
Cohesion: 0.13
Nodes (26): ChartSignal, ScopeChannel, ScopeSource, Chan, ChartLane, drawChart(), drawPaper(), drawScope() (+18 more)

### Community 70 - "L298N Module"
Cohesion: 0.11
Nodes (18): Behaviors, Board, Circuit, F1: Remove the flyback diodes, then stop, F2: Run two motors at 1.5 A without the heatsink, F3: Run it from a single Li-ion cell (3.7 V), Failures, For mechanical engineers (+10 more)

### Community 71 - "Transpiler"
Cohesion: 0.18
Nodes (6): castPrefix(), intWrapper(), isFloatLit(), jsName(), kindOf(), Transpiler

### Community 72 - "thermal-network.test.ts"
Cohesion: 0.11
Nodes (13): behavior, coldStart(), elementId(), idx(), num(), PAD_RTH, SINK_C, SINK_RTH (+5 more)

### Community 73 - "Solution"
Cohesion: 0.12
Nodes (7): ReadoutEval, Blend, readOne(), Substep, Transient, PwmPhaseSolution, Solution

### Community 74 - "esp32-s3.ts"
Cohesion: 0.12
Nodes (16): BB, DK, ledAnode, ledCathode, lesson, potLeg, rDbotL, rDbotR (+8 more)

### Community 75 - "Tweaks.tsx"
Cohesion: 0.16
Nodes (21): applyBehaviorTweaks(), clamp(), isOn(), momentaryValues(), snapTweak(), base, tweakAssignments(), tweakTargets() (+13 more)

### Community 76 - "pca9685.ts"
Cohesion: 0.05
Nodes (59): ACCEL_LSB, accelLsb(), acks(), advanceTruth(), busHealthy(), busRead16(), busWriteBits(), chipAddress() (+51 more)

### Community 77 - "createBench"
Cohesion: 0.08
Nodes (51): allPlaced(), AssemblyEvent, AssemblyResult, AssemblyState, benchStatus(), buildParts(), burnText(), clone() (+43 more)

### Community 78 - "pid-motor-control.ts"
Cohesion: 0.09
Nodes (15): BAT, BAT_BLACK, BAT_RED, DIODE, DYNO_AT, ENC_AT, encPad(), HDR (+7 more)

### Community 79 - ".snapshot"
Cohesion: 0.05
Nodes (37): [CURRENT, BATTERY, LED_V, CHARGE, E_RATE, R1_DROP], L, runFor(), runUntil(), build(), [CURRENT, POWER, TEMP, VOLTS], lesson, run() (+29 more)

### Community 80 - "charge-voltage-current.ts"
Cohesion: 0.09
Nodes (20): BB, j1, jackA, jackCom, LED_RATING, ledAnode, ledCathode, lesson (+12 more)

### Community 81 - "Debugging Instruments"
Cohesion: 0.12
Nodes (16): Board, Debugging Instruments, F1: Measure the 5 V rail with the leads still in the mA jack, F2: Scope ground clip on the 5 V rail, F3: Trust the DMM on the 10 MΩ divider, Failures, For mechanical engineers, Learning goals (+8 more)

### Community 82 - "diode-rectifier.ts"
Cohesion: 0.06
Nodes (29): BB, c1Minus, c1Plus, d1A, d1K, d2A, d2K, d3A (+21 more)

### Community 83 - "series-parallel.ts"
Cohesion: 0.10
Nodes (17): BB, lesson, METER_AT, PACK_AT, r1L, r1R, r2L, r2R (+9 more)

### Community 84 - "Gallery.tsx"
Cohesion: 0.07
Nodes (52): PartKind, BenchBase(), BenchBaseProps, gridTile(), rulerStrip(), btn, Check(), DrawStats() (+44 more)

### Community 85 - "esp32Bench.ts"
Cohesion: 0.14
Nodes (15): bench(), pub(), run(), span(), benchOf(), esp32Lesson(), FRAME, powerAndRun() (+7 more)

### Community 86 - "V"
Cohesion: 0.25
Nodes (8): Engine requirements gathered from SIM NOTEs, SIM NOTE, SIM NOTE, SIM NOTE, SIM NOTE, SIM NOTE, SIM NOTE, V()

### Community 88 - "InkMesh"
Cohesion: 0.06
Nodes (88): disposeOutline(), extrudeAlongZ(), lathe(), mergedBoxes(), InkInstance, InkInstances(), InkMesh(), wireColor() (+80 more)

### Community 89 - "logic-analyzer.ts"
Cohesion: 0.17
Nodes (18): busPins(), clear(), elementValue(), IDLE, makeState(), newLines(), num(), Protocol (+10 more)

### Community 90 - "lessonSchema.ts"
Cohesion: 0.05
Nodes (41): reader, writer, base, v(), behaviorRef, COMMON_KEYS, currentSource, element (+33 more)

### Community 91 - "dependencies"
Cohesion: 0.12
Nodes (17): dependencies, @codemirror/lang-cpp@^6.0.3, marked@^18.1.3, react@^19.3.1, react-dom@^19.3.1, @react-three/drei@^10.7.9, @react-three/fiber@^9.8.2, three@^0.187.0 (+9 more)

### Community 92 - "resistor-codes-divider.ts"
Cohesion: 0.07
Nodes (26): BAT_AT, batMinus, batPlus, BB, DMM_AT, jackCom, jackV, ldL (+18 more)

### Community 93 - "Board.tsx"
Cohesion: 0.06
Nodes (55): Task E — Integration (after A–D are merged), BoardSpec, PartPlacement, AUTO_MARGIN, AUTO_MIN_SIZE, autoFrame(), BASE_KINDS, boardFrame() (+47 more)

### Community 94 - "Decisions"
Cohesion: 0.09
Nodes (15): Behaviors, Circuit, Decisions, applyPin(), getBench(), Adafruit_PWMServoDriver, harness(), PinEvent (+7 more)

### Community 95 - "App.tsx"
Cohesion: 0.13
Nodes (17): App(), BenchScene, summaries, GuideProgress, GuideState, Gallery, showGallery, GuideMode (+9 more)

### Community 96 - "UART, I²C and SPI"
Cohesion: 0.10
Nodes (19): As built (2026-11-09), Behaviors, Board, Circuit, F1: Analyzer (or monitor) at the wrong baud, F2: 47 kΩ pull-ups at 400 kHz, F3: Pull-ups missing, Failures (+11 more)

### Community 97 - "lessons/index.ts"
Cohesion: 0.10
Nodes (16): patch, lessonDefs, modules, PIN_ORDER, pinned, TRACK_ORDER, tracks, frames() (+8 more)

### Community 98 - "timer-555.ts"
Cohesion: 0.07
Nodes (28): BAT_AT, BB, dipAt, lesson, NE555_FACTS, R_RATING, snapMinus, snapPlus (+20 more)

### Community 99 - "5. Virtual MCU (`src/engine/mcu`)"
Cohesion: 0.12
Nodes (16): Arduino Uno R3, Board, F1: Drive a motor straight off pin 9, F2: Bypass the 220 Ω resistor, F3: Short 5 V to GND on the header, F4: Feed 12 V into the 5 V pin, Failures, For mechanical engineers (+8 more)

### Community 100 - "three/index.ts"
Cohesion: 0.08
Nodes (43): three, Bake(), bakeable(), BAKED_INK_PX, bakeGroup(), BakeResult, Bucket, isHullHost() (+35 more)

### Community 101 - "wifi-sim.ts"
Cohesion: 0.12
Nodes (16): behavior, frameAverageCurrent(), fresh(), I_AVG, I_BURST, I_IDLE, MODES, num() (+8 more)

### Community 102 - "series-rlc.test.ts"
Cohesion: 0.36
Nodes (5): behavior, KEYS, SeriesRlc, seriesRlc(), lesson

### Community 103 - "pca9685-servo.ts"
Cohesion: 0.12
Nodes (13): BRD, lesson, LOGIC, PSU, pwmPin(), SERVO_X, servoLead(), servoWire() (+5 more)

### Community 104 - "Circuit Atelier — interactive electronics course"
Cohesion: 0.33
Nodes (5): Circuit Atelier — interactive electronics course, Commands, Memory and context: graphify (use first), Rules, Workflow: superpowers skills (in `.claude/skills/`)

### Community 105 - "ratings.ts"
Cohesion: 0.09
Nodes (33): chain(), msPerFrame(), ratingsMs(), BURN_DELAY, checkInstant(), checkRatings(), createRatingState(), curOf() (+25 more)

### Community 106 - "capacitor-rc.ts"
Cohesion: 0.07
Nodes (26): BB, btnAt, C1_RATING, c1Minus, c1Plus, DMM_AT, jackCom, jackV (+18 more)

### Community 107 - "multimeter.ts"
Cohesion: 0.08
Nodes (22): AM_AT, BB, lesson, postMinus, postPlus, PSU_AT, r1L, r1R (+14 more)

### Community 108 - "inductor-rl.ts"
Cohesion: 0.09
Nodes (19): BB, D1, d1Anode, d1Cathode, L1, l1Left, l1Right, lesson (+11 more)

### Community 109 - "SampleRing"
Cohesion: 0.18
Nodes (6): findTrigger(), SampleRing, fill(), setChart(), extent(), risingCrossings()

### Community 110 - "a4988.ts"
Cohesion: 0.10
Nodes (21): behavior, coil(), COS, decodeMicrostep(), find(), fresh(), mod(), num() (+13 more)

### Community 111 - "Element"
Cohesion: 0.10
Nodes (21): State, State, State, gateOut(), applyBurn(), applyPatches(), failureNodes(), setElementKey() (+13 more)

### Community 112 - "PCB Design Workflow"
Cohesion: 0.11
Nodes (18): Behaviors, Board, Circuit, F1: Forgot the CC resistors, F2: Solder bridge from PB5 to the neighbouring GND pin, F3: LED footprint drawn backwards, Failures, For mechanical engineers (+10 more)

### Community 113 - "ac-meter.ts"
Cohesion: 0.14
Nodes (22): Channel, channel(), F64, fingerprint(), fresh(), groundedNodes(), I32, isCut() (+14 more)

### Community 114 - "behaviors/l298n.ts"
Cohesion: 0.09
Nodes (20): allOpen(), behavior, Channel, channel(), channels(), coastPwmLoss(), coastPwmSource(), decodeL298() (+12 more)

### Community 115 - "smoke.spec.ts"
Cohesion: 0.29
Nodes (6): Behaviors, Circuit, mA(), panel(), Probe, readout()

### Community 116 - "imu-mpu6050.test.ts"
Cohesion: 0.12
Nodes (8): complementaryTau(), bench(), imuLesson(), run(), lesson, build(), lesson, run()

### Community 117 - "TryItYourself.tsx"
Cohesion: 0.23
Nodes (7): Constraints, Deliverables, M1 Task E — Integration: bench store, Board composer, behavior framework, first lesson, Sketch, sketchBaud(), TryItYourself(), TryItYourselfProps

### Community 118 - "serial-protocols.ts"
Cohesion: 0.12
Nodes (9): AD, bar, DIP, GY, LED_X(), ledParts, lesson, UNO_AT (+1 more)

### Community 119 - "hx711.ts"
Cohesion: 0.12
Nodes (23): behavior, clearConversions(), CODE_MAX, CODE_MIN, codeFor(), countsPerGram(), creepStep(), gainOf() (+15 more)

### Community 120 - "motion.tsx"
Cohesion: 0.09
Nodes (46): cache, chamferRectShape(), edgeCache, extrudeAlongX(), extrudeUp(), flattedCircleShape(), G, geo() (+38 more)

### Community 121 - "scripts"
Cohesion: 0.22
Nodes (9): scripts, build, dev, graph, lint, preview, test, test:e2e (+1 more)

### Community 122 - "coulomb-counter.ts"
Cohesion: 0.09
Nodes (17): read(), behavior, counts, curOf(), E_CHARGE, volt(), volt(), volts() (+9 more)

### Community 123 - "AppState"
Cohesion: 0.09
Nodes (4): AppState, Item(), ToastProps, ToastMessage

### Community 124 - "ohms-law.ts"
Cohesion: 0.13
Nodes (13): BB, DMM_AT, jackA, jackCom, lesson, postMinus, postPlus, PSU_AT (+5 more)

### Community 125 - "mpu6050-imu.ts"
Cohesion: 0.13
Nodes (8): HDR, HDR_PINS, MOT, MOT_T1, MOT_T2, U1, UNO_AT, Wire

### Community 126 - "M1.5 — Engine extensions (triaged from the curriculum SIM NOTEs)"
Cohesion: 0.25
Nodes (7): Global constraints, M1.5 — Engine extensions (triaged from the curriculum SIM NOTEs), X1 — Simulator (`src/engine/sim/`), X2 — Virtual MCU (`src/engine/mcu/`), X3 — Behavior framework (`src/engine/behaviors/`), X4 — UI and bench, X5 — 3D part additions

### Community 127 - "zener.ts"
Cohesion: 0.08
Nodes (22): BAT_AT, batMinus, batPlus, BB, DMM_AT, jackCom, jackV, lesson (+14 more)

### Community 128 - "adc-dac-pwm.ts"
Cohesion: 0.08
Nodes (22): BB, h(), lesson, MCU_FACTS, R_RATING, SIG_AT, sigMinus, sigPlus (+14 more)

### Community 129 - "inductor-rl.test.ts"
Cohesion: 0.10
Nodes (19): L, [METER, AMMETER, BURDEN, MID, TRUE_I], powered(), runFor(), charge(), [I_L, V_TOP, V_SW, P_R1, V_SW_PEAK], L, powered() (+11 more)

### Community 130 - "batteries.ts"
Cohesion: 0.13
Nodes (13): BAT_AT, BB, lesson, LOAD_AT, LOAD_RATING, METER_AT, snapMinus, snapPlus (+5 more)

### Community 131 - "power-heat.ts"
Cohesion: 0.12
Nodes (13): LessonDef, BB, lesson, METER_AT, PSU_AT, R1_RATING, r1Left, r1Right (+5 more)

### Community 132 - "layout.ts"
Cohesion: 0.04
Nodes (59): BB_H, bbHole(), BENCH_Y, between(), PITCH, UNO, BB, bridge (+51 more)

### Community 133 - "hc595.ts"
Cohesion: 0.10
Nodes (10): behavior, State, states, The context (`BehaviorContext`, `src/engine/types.ts`), nodeV(), readV(), solution(), I2cDevice (+2 more)

### Community 134 - "inspector.ts"
Cohesion: 0.11
Nodes (27): BandOptions, DIGIT_COLORS, TOLERANCE_COLORS, bandDecode(), bandHex(), bandValue(), ElementInfo, fmt() (+19 more)

### Community 135 - "store.ts"
Cohesion: 0.17
Nodes (21): asCode(), asGuideSaves(), asProgress(), asSettings(), CameraView, clock(), debounce(), DEFAULT_SETTINGS (+13 more)

### Community 136 - "Lesson"
Cohesion: 0.03
Nodes (59): Circuit Atelier: Curriculum (T0–T3), File format, Rating conventions used throughout, AssemblyAction, Bench, BenchSnapshot, FailurePatch, Lesson (+51 more)

### Community 137 - "LogicAnalyzer.tsx"
Cohesion: 0.27
Nodes (14): capture(), draw(), Ink, LogicAnalyzer(), PROTOS, readInk(), View, asciiOf() (+6 more)

### Community 138 - "kirchhoff.test.ts"
Cohesion: 0.40
Nodes (4): L, [NODE_A, I1, I3, I2, R1_DROP, V2_TERM], powered(), runFor()

### Community 139 - "BehaviorContext"
Cohesion: 0.07
Nodes (11): behavior, Win, wins, apply(), behavior, apply(), behavior, behavior (+3 more)

### Community 140 - "transformer.ts"
Cohesion: 0.09
Nodes (20): DMM_P, DMM_S, FUSE_AT, fuseL, fuseR, lesson, LOAD_AT, loadA (+12 more)

### Community 141 - "Driver"
Cohesion: 0.17
Nodes (3): Behaviors, Circuit, Driver

### Community 142 - "M3 — Foundations, Passives, Semiconductors (T0–T2)"
Cohesion: 0.33
Nodes (5): Batch 1 (no new engine features), Batch 2, Batch 3 (after X4 and X6), Batch 4, M3 — Foundations, Passives, Semiconductors (T0–T2)

### Community 143 - "mosfet-switch.ts"
Cohesion: 0.09
Nodes (19): GND_PT, GND_TP, HEATER_AT, HEATER_D, HEATER_P, JACK, JACK_N, JACK_P (+11 more)

### Community 144 - "Soldering and Rework"
Cohesion: 0.12
Nodes (15): F1: Cold joint on J2, F2: Solder bridge between pads D5 and D6, F3: Lifted pad on J3 (overheated during rework), Failures, For mechanical engineers, Learning goals, Meet the board, Pro tips (+7 more)

### Community 145 - "I2cLines"
Cohesion: 0.23
Nodes (4): State, wire(), I2cLines, OpenDrain

### Community 146 - "ws2812.ts"
Cohesion: 0.11
Nodes (14): behavior, enterDownload(), leave(), num(), ROM_LINES, sample(), state(), states (+6 more)

### Community 147 - "LessonDef"
Cohesion: 0.13
Nodes (8): HDR, JACK, JACK_N, JACK_P, lesson, MOT, UNO_AT, Wire

### Community 148 - "rlc-resonance.ts"
Cohesion: 0.12
Nodes (15): BB, cA, cB, GEN_AT, lA, lB, lesson, postMinus (+7 more)

### Community 149 - "decode.ts"
Cohesion: 0.33
Nodes (7): byteText(), decodeI2c(), decodeUart(), FrameKind, hex(), NAMES, DigitalWave

### Community 150 - "quad-encoder.ts"
Cohesion: 0.11
Nodes (13): publishAll(), publishZeros(), behavior, gap(), levelA(), levelB(), publishCount(), pushEdge() (+5 more)

### Community 151 - "ne555.ts"
Cohesion: 0.13
Nodes (9): apply(), behavior, num(), State, states, [CAP, OUT, FREQ, DUTY, PULSE, FAST], fixture(), mk() (+1 more)

### Community 152 - "encoders.ts"
Cohesion: 0.10
Nodes (14): BAT, BAT_BLACK, BAT_RED, DIODE, ENC_AT, encPad(), HDR, lesson (+6 more)

### Community 153 - "mcu-supply.ts"
Cohesion: 0.22
Nodes (7): behavior, fMaxAt(), fresh(), nodeSets, State, state(), states

### Community 154 - "BehaviorContext"
Cohesion: 0.07
Nodes (14): Fake, behavior, loads(), num(), onAt, behavior, State, states (+6 more)

### Community 155 - "PinState"
Cohesion: 0.12
Nodes (12): harness(), PinEvent, Widget, StampCtx, DEFAULT_PWM_HZ, PwmPlanPhase, ledNet(), pin() (+4 more)

### Community 156 - "EdgeTrace"
Cohesion: 0.29
Nodes (3): decodeSpi(), spiSampled(), EdgeTrace

### Community 157 - "hc393.ts"
Cohesion: 0.29
Nodes (5): behavior, clearAll(), State, state(), states

### Community 158 - "jumper"
Cohesion: 0.22
Nodes (5): jumper(), lesson, SR_AT, TARGET_AT, UNO_AT

### Community 159 - "tb6612fng.test.ts"
Cohesion: 0.33
Nodes (5): build(), CW(), hold(), lesson, run()

### Community 160 - "breadboard.test.ts"
Cohesion: 0.40
Nodes (4): L, [LED, IR1, S15, RP, RN], powered(), runFor()

### Community 161 - "5. Virtual MCU (`src/engine/mcu`)"
Cohesion: 0.13
Nodes (6): Behaviors, Circuit, Learning goals, 5. Virtual MCU (`src/engine/mcu`), pwmHzFor(), VirtualMcuOptions

### Community 162 - "ohms-law.test.ts"
Cohesion: 0.40
Nodes (4): L, powered(), runFor(), [VOLT, CUR, PWR, CC]

### Community 163 - "logic.test.ts"
Cohesion: 0.26
Nodes (8): onBus(), spi(), i2cRiseTime(), I2cTxn, Sink, SpiByte, spiByte(), uartBytes()

### Community 164 - "rlc-resonance.test.ts"
Cohesion: 0.17
Nodes (4): build(), runTo(), [VC, IL, PEAK, F0, ZETA, FD, Q, GAIN], Z0

### Community 165 - "scopeView.ts"
Cohesion: 0.27
Nodes (5): TriggerSpec, parseSource(), seq125(), Sweep, withValue()

### Community 166 - "M4 — Digital, Sensors, Professional, Capstone (T3, T4 rest, T5 rest, T6 rest, T7)"
Cohesion: 0.50
Nodes (3): Engine features available, M4 — Digital, Sensors, Professional, Capstone (T3, T4 rest, T5 rest, T6 rest, T7), Order

### Community 167 - "loadcell-hx711.ts"
Cohesion: 0.12
Nodes (11): CELL, HC, HC_PINS, HM, HM_PINS, lesson, NOMINAL_FACTOR, U1 (+3 more)

### Community 168 - "hcsr04.test.ts"
Cohesion: 0.15
Nodes (11): bench(), fixture(), lines(), lostFraction(), Params, run(), build(), [DC, RIPPLE, ILOAD, D1PK, ACIN, PIV] (+3 more)

### Community 169 - "switch-bounce.ts"
Cohesion: 0.25
Nodes (5): behavior, clearAll(), State, state(), states

### Community 170 - "ntc.ts"
Cohesion: 0.24
Nodes (10): apply(), behavior, ntcOhms(), num(), ohmsFor(), settle(), State, stateOf() (+2 more)

### Community 171 - "led-resistor.ts"
Cohesion: 0.14
Nodes (12): BB, gnd, j1, LED_RATING, ledAnode, ledCathode, pin13, r1Left (+4 more)

### Community 172 - "hcsr04.ts"
Cohesion: 0.26
Nodes (11): behavior, disarm(), gauss(), has(), num(), ping(), rand(), soundSpeed() (+3 more)

### Community 173 - "irq-bounce.ts"
Cohesion: 0.29
Nodes (7): behavior, inject(), num(), rng(), State, states, valueOf()

### Community 175 - "hc74.ts"
Cohesion: 0.29
Nodes (5): behavior, clearAll(), State, state(), states

### Community 176 - "Tasks A–D are independent and run in parallel worktrees. Task E integrates them."
Cohesion: 0.25
Nodes (7): Global constraints, M1 — Engine plan, Task A — Circuit simulator (`src/engine/sim/`), Task C — 3D look and parametric part library (`src/three/`), Task D — App shell, theme, controls and sound (`src/ui/`, `src/audio/`, `src/styles/`), Tasks A–D are independent and run in parallel worktrees. Task E integrates them., stopLofi()

### Community 177 - "M2 — Video lessons (parallel authors)"
Cohesion: 0.33
Nodes (5): After each batch, Batch 1 (shared behaviors land here first), Batch 2, M2 — Video lessons (parallel authors), Per-lesson task (the same for every author)

### Community 179 - "formatSI"
Cohesion: 0.36
Nodes (6): fixed(), formatSI(), join(), NO_PREFIX, PREFIXES, fmtDiv()

### Community 180 - "Failures"
Cohesion: 0.50
Nodes (4): F1: No current limit (trimmer at the stop), F2: Unplug the motor while powered, F3: MS wires fall off, Failures

### Community 181 - "interrupts-timers.test.ts"
Cohesion: 0.29
Nodes (5): build(), L, run(), tap(), [TRUE_HZ, COUNTED_HZ, RPM, , PRESSES, ISR_EDGES, PIN2, DROPPED, L_LED]

### Community 182 - "j1"
Cohesion: 0.43
Nodes (7): Behaviors, Board, Circuit, j1(), j3(), onDk(), pinX()

### Community 183 - "Menu.tsx"
Cohesion: 0.50
Nodes (3): MenuButton(), MenuButtonProps, MenuItem

### Community 185 - "@playwright/test"
Cohesion: 0.40
Nodes (3): @playwright/test@^1.65.0, PORT, @playwright/test

### Community 187 - "SIM NOTE"
Cohesion: 0.50
Nodes (4): Board, SIM NOTE, Servo, servo()

### Community 188 - "Failures"
Cohesion: 0.50
Nodes (4): F1: Power the servos from the Uno's 5 V pin, F2: No common ground, F3: Breakout without I²C pull-ups, Failures

### Community 189 - "block"
Cohesion: 0.67
Nodes (3): block(), freqHint(), step()

## Knowledge Gaps
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Lesson` connect `Lesson` to `inductor-rl.test.ts`, `inspector.ts`, `store.ts`, `LogicAnalyzer.tsx`, `kirchhoff.test.ts`, `three/index.ts`, `engine/types.ts`, `getLesson`, `ne555.ts`, `Load Cell and HX711`, `Thermal Design`, `tb6612fng.test.ts`, `breadboard.test.ts`, `createBench`, `ohms-law.test.ts`, `logic-analyzer.test.ts`, `hcsr04.test.ts`, `ntc.ts`, `interrupts-timers.test.ts`, `Layout.tsx`, `Instruments.tsx`, `thermal-network.test.ts`, `createBench`, `.snapshot`, `esp32Bench.ts`, `lessonSchema.ts`, `Board.tsx`, `lessons/index.ts`, `series-rlc.test.ts`, `imu-mpu6050.test.ts`, `TryItYourself.tsx`, `hx711.ts`, `AppState`?**
  _High betweenness centrality (0.109) - this node is a cross-community bridge._
- **Are the 8 inferred relationships involving `createBench()` (e.g. with `Decisions` and `Deliverables`) actually correct?**
  _`createBench()` has 8 INFERRED edges - model-reasoned connections that need verification._
- **Should `devices.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.047207207207207204 - nodes in this community are weakly interconnected._
- **Why does `Circuit Atelier: Curriculum (T0–T3)` connect `Lesson` to `curriculum/README.md`, `Order and prerequisites`, `V`?**
  _High betweenness centrality (0.096) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `Lesson` (e.g. with `Circuit Atelier: Curriculum (T0–T3)` and `File format`) actually correct?**
  _`Lesson` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Should `layout.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `engine/types.ts` to `inductor-rl.test.ts`, `hc595.ts`, `sound.ts`, `store.ts`, `transpile.ts`, `package.json`, `kirchhoff.test.ts`, `Lesson`, `three/index.ts`, `LogicAnalyzer.tsx`, `getLesson`, `ws2812.ts`, `transient.ts`, `quad-encoder.ts`, `ne555.ts`, `Load Cell and HX711`, `PinState`, `tb6612.ts`, `breadboard.test.ts`, `5. Virtual MCU (`src/engine/mcu`)`, `createBench`, `logic.test.ts`, `ohms-law.test.ts`, `rlc-resonance.test.ts`, `logic-analyzer.test.ts`, `tb6612fng.test.ts`, `hcsr04.test.ts`, `VirtualMcu`, `ntc.ts`, `scopeView.ts`, `formatSI`, `interrupts-timers.test.ts`, `ac-meter.perf.test.ts`, `thermal-network.test.ts`, `Tweaks.tsx`, `pca9685.ts`, `createBench`, `.snapshot`, `esp32Bench.ts`, `lessonSchema.ts`, `Board.tsx`, `Decisions`, `lessons/index.ts`, `three/index.ts`, `wifi-sim.ts`, `series-rlc.test.ts`, `ratings.ts`, `SampleRing`, `a4988.ts`, `Element`, `behaviors/l298n.ts`, `imu-mpu6050.test.ts`, `TryItYourself.tsx`, `hx711.ts`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._