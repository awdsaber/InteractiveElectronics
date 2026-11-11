# Graph Report - Electonics Interactive course  (2026-11-11)

## Corpus Check
- 382 files · ~571,954 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 7 file(s) not represented in the graph (top: .css 4, (none) 3)

## Summary
- 4588 nodes · 9843 edges · 188 communities (184 shown, 4 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 608 edges (avg confidence: 0.89)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `955c1d31`
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
- BenchScene.tsx
- coulomb-counter.ts
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
- L298N Module
- LED and Resistor
- The Transistor Switch
- compile
- ESP32-S3 DevKitC-1
- tb6612.ts
- TB6612FNG Dual H-Bridge
- arduino-uno.ts
- engine/types.ts
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
- hcsr04.test.ts
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
- power-grounding-emc.ts
- V
- Writing a lesson
- InkMesh
- logic-analyzer.ts
- lessonSchema.ts
- dependencies
- resistor-codes-divider.ts
- Board.tsx
- simLoop.ts
- GuidePanel.tsx
- UART, I²C and SPI
- connectors.tsx
- timer-555.ts
- 5. Virtual MCU (`src/engine/mcu`)
- three/index.ts
- SampleRing
- series-rlc.test.ts
- pca9685-servo.ts
- Circuit Atelier — interactive electronics course
- ratings.ts
- capacitor-rc.ts
- multimeter.ts
- inductor-rl.ts
- 5. Virtual MCU (`src/engine/mcu`)
- a4988.ts
- Element
- PCB Design Workflow
- ac-meter.ts
- behaviors/l298n.ts
- smoke.spec.ts
- intermittent.ts
- TryItYourself.tsx
- serial-protocols.ts
- hx711.ts
- motion.tsx
- scripts
- ne555.ts
- AppState
- ohms-law.ts
- mpu6050-imu.ts
- M1.5 — Engine extensions (triaged from the curriculum SIM NOTEs)
- zener.ts
- adc-dac-pwm.ts
- inductor-rl.test.ts
- batteries.ts
- power-heat.ts
- bbHole
- hc595.ts
- inspector.ts
- store.ts
- Lesson
- LogicAnalyzer.tsx
- createBench
- BehaviorContext
- transformer.ts
- Driver
- M3 — Foundations, Passives, Semiconductors (T0–T2)
- mosfet-switch.ts
- interrupts-timers.ts
- I2cLines
- wifi-sim.ts
- LessonDef
- rlc-resonance.ts
- decode.ts
- quad-encoder.ts
- Logic Gates
- encoders.ts
- mcu-supply.ts
- formatSI
- pwm.test.ts
- EdgeTrace
- Soldering and Rework
- three/index.ts
- package.json
- breadboard.test.ts
- pin9
- PartInspector.tsx
- j1
- rlc-resonance.test.ts
- hc74.ts
- M4 — Digital, Sensors, Professional, Capstone (T3, T4 rest, T5 rest, T6 rest, T7)
- loadcell-hx711.ts
- extensions.test.ts
- switch-bounce.ts
- ntc.ts
- led-resistor.ts
- hcsr04.ts
- irq-bounce.ts
- opamp-config.ts
- ne555.test.ts
- pwm-filter.test.ts
- M2 — Video lessons (parallel authors)
- Guide
- Failures
- @vitejs/plugin-react
- tmp36.ts
- Failures
- Menu.tsx
- Failures
- SIM NOTE
- Failures
- Failures

## God Nodes (most connected - your core abstractions)
1. `createBench()` - 213 edges
2. `vitest` - 141 edges
3. `Lesson` - 107 edges
4. `Bench` - 81 edges
5. `VirtualMcu` - 78 edges
6. `validateLesson()` - 70 edges
7. `InkMesh()` - 63 edges
8. `BehaviorContext` - 62 edges
9. `Behavior` - 61 edges
10. `BenchSnapshot` - 56 edges

## Surprising Connections (you probably didn't know these)
- `Per-lesson task (the same for every author)` --references--> `validateLesson()`  [INFERRED]
  docs/plans/m2-video-lessons.md → src/engine/lessonSchema.ts
- `SIM NOTE` --references--> `constrain()`  [INFERRED]
  docs/curriculum/T7/pid-motor-control.md → src/engine/mcu/runtime.ts
- `SIM NOTE` --references--> `VirtualMcu`  [INFERRED]
  docs/curriculum/T4/arduino-uno.md → src/engine/mcu/virtualMcu.ts
- `F3: Fit a 2 W resistor instead` --references--> `applyPatches()`  [INFERRED]
  docs/curriculum/T0/power-heat.md → src/engine/sim/failures.ts
- `SIM NOTE` --references--> `applyPatches()`  [INFERRED]
  docs/curriculum/T0/power-heat.md → src/engine/sim/failures.ts

## Import Cycles
- None detected.

## Communities (188 total, 4 thin omitted)

### Community 0 - "devices.ts"
Cohesion: 0.05
Nodes (80): BJT_BETA, BJT_BETA_R, BJT_IS, bjtEval(), BK, BREAK_KNEE, BREAK_RZ, breakEval() (+72 more)

### Community 1 - "layout.ts"
Cohesion: 0.10
Nodes (19): LogicGate, BB1, BB2, dipAt(), gateChip(), GEN_AT, genGnd, genOut (+11 more)

### Community 2 - "Capstone: Two-Wheel Balancer"
Cohesion: 0.14
Nodes (13): Behaviors, Board, Capstone: Two-Wheel Balancer, Circuit, For mechanical engineers, Learning goals, Meet the board, Pro tips (+5 more)

### Community 3 - "ADC, DAC and PWM"
Cohesion: 0.06
Nodes (32): Board, Circuit, F1: Use an old analog meter (20 kΩ/V on the 10 V range), F2: Measure volts with the red lead still in the mA jack, F3: The bottom resistor falls out while you measure, Failures, For mechanical engineers, Learning goals (+24 more)

### Community 4 - "solve.ts"
Cohesion: 0.08
Nodes (32): GMIN, IP, LinSlot, measureCurrentPower(), Measured, StampCtx, clearSystem(), createLU() (+24 more)

### Community 5 - "deploy.yml"
Cohesion: 0.06
Nodes (31): runs-on, steps, concurrency, cancel-in-progress, group, environment, needs, runs-on (+23 more)

### Community 6 - "sound.ts"
Cohesion: 0.17
Nodes (24): BASS, BEATS_PER_CHORD, beatSeconds(), BPM, chordSeconds(), HAT_STEPS, KICK_STEPS, loopSeconds() (+16 more)

### Community 7 - "runtime.ts"
Cohesion: 0.07
Nodes (48): DEFAULT, EXTERNAL, INTERNAL, RISING, arduinoMap(), arduinoRound(), bitClearFn(), bitSetFn() (+40 more)

### Community 8 - "transpile.ts"
Cohesion: 0.07
Nodes (39): ARDUINO_CONSTANTS, BUILTIN_NAMES, UNSUPPORTED_API, errorOf(), AWAITED, BIT_OPS, charCode(), checkCompiles() (+31 more)

### Community 9 - "package.json"
Cohesion: 0.14
Nodes (14): devDependencies, jsdom@^31.0.0, oxlint@^1.90.0, @types/node@^24.19.2, @types/react-dom@^19.3.0, @types/three@^0.187.0, vite@^8.3.6, vitest@^5.1.0 (+6 more)

### Community 10 - "constants.ts"
Cohesion: 0.06
Nodes (33): A0, A1, A2, A3, A4, A5, A6, A7 (+25 more)

### Community 11 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+11 more)

### Community 12 - "BenchScene.tsx"
Cohesion: 0.07
Nodes (47): @react-three/drei, BenchScene(), box, Camera(), cardInset(), DevPartProbe(), findPart(), fitZoom() (+39 more)

### Community 13 - "coulomb-counter.ts"
Cohesion: 0.18
Nodes (8): behavior, counts, curOf(), E_CHARGE, curOf(), curOf(), curOf(), curOf()

### Community 14 - "getLesson"
Cohesion: 0.09
Nodes (44): benchActionEvents(), createGuide(), passes(), eventMatches(), GuideBenchView, GuideEvent, GuideUi, tweak (+36 more)

### Community 15 - "boards.tsx"
Cohesion: 0.10
Nodes (47): Art, At(), boardArt(), BoardSlab(), Breadboard, GenericModule(), LoadCell, Module (+39 more)

### Community 16 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 17 - "A4988 Stepper Driver"
Cohesion: 0.11
Nodes (17): A4988 Stepper Driver, Behaviors, Board, Circuit, F1: No current limit (trimmer at the stop), F2: Unplug the motor while powered, F3: MS wires fall off, Failures (+9 more)

### Community 18 - "transient.ts"
Cohesion: 0.11
Nodes (33): branchCount(), Dev, modesChanged(), coil(), settle(), lastPeriodPeak(), lc, chain() (+25 more)

### Community 19 - "Quadrature Encoders"
Cohesion: 0.12
Nodes (16): Board, F1: Missing pull-ups, F2: A and B swapped, F3: Overdrive it on 12 V with noisy wiring, Failures, For mechanical engineers, Learning goals, Meet the board (+8 more)

### Community 20 - "transistor-switch.ts"
Cohesion: 0.07
Nodes (25): BB, d1Anode, d1Cathode, jRb, M1, MOTOR_AT, PACK_AT, pin9 (+17 more)

### Community 21 - "NTC Thermistor"
Cohesion: 0.12
Nodes (16): F1: Wrong part on the reel (B = 3435 K), code still says 3977, F2: Thermistor lead breaks, F3: A 1 kΩ resistor fitted instead of 10 kΩ, Failures, For mechanical engineers, Implementation notes (as built), Learning goals, Meet the board (+8 more)

### Community 22 - "MPU-6050 IMU"
Cohesion: 0.10
Nodes (19): Behaviors, Board, Circuit, F1: Warm the sensor after calibrating, F2: Remove the I²C pull-ups, F3: AD0 pulled high, Failures, For mechanical engineers (+11 more)

### Community 23 - "PID Motor Speed Control"
Cohesion: 0.11
Nodes (18): Behaviors, Board, Circuit, F1: Encoder A/B swapped (positive feedback), F2: Encoder pull-ups missing (lost feedback), F3: Tired battery (actuator saturation), Failures, For mechanical engineers (+10 more)

### Community 24 - "Power, Grounding and EMC"
Cohesion: 0.12
Nodes (16): As built (2026-11-09) — supersedes the draft below where they differ, Draft, F1: Return the load through the sensor ground, F2: The same, with thin 30 AWG wire, F3: Swap in a non-logic-level MOSFET (IRF540N, worst-case part), Failures, For mechanical engineers, Learning goals (+8 more)

### Community 25 - "Load Cell and HX711"
Cohesion: 0.12
Nodes (18): Board, Circuit, Datasheet figures (checked), Failures, Guide (8 steps), `hx711` behavior, Learning goals, Load Cell and HX711 (+10 more)

### Community 26 - "L298N Module"
Cohesion: 0.05
Nodes (39): Behaviors, Board, Circuit, F1: Remove the flyback diodes, then stop, F2: Run two motors at 1.5 A without the heatsink, F3: Run it from a single Li-ion cell (3.7 V), Failures, For mechanical engineers (+31 more)

### Community 27 - "LED and Resistor"
Cohesion: 0.12
Nodes (17): Board, Circuit, F1: Leave the resistor out (jumper in its place), F2: 22 Ω fitted instead of 220 Ω (red-red-black), F3: LED in backwards, Failures, For mechanical engineers, Learning goals (+9 more)

### Community 28 - "The Transistor Switch"
Cohesion: 0.11
Nodes (18): Board, Circuit, F1: Remove the flyback diode, F2: Skip the base resistor, F3: Stall the motor, F4: Forget the common ground, Failures, For mechanical engineers (+10 more)

### Community 29 - "compile"
Cohesion: 0.18
Nodes (17): blankParams(), compile(), extraKeys(), extraNodes(), hasInternalNode(), inheritState(), isNonlinear(), layoutSignature() (+9 more)

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

### Community 34 - "engine/types.ts"
Cohesion: 0.03
Nodes (42): vitest, lesson, lesson, lesson, lesson, REG, behavior, lesson (+34 more)

### Community 35 - "tb6612fng.ts"
Cohesion: 0.11
Nodes (11): BAT, BAT_BLACK, BAT_RED, DIODE, HDR, lesson, MOT, MOT_T1 (+3 more)

### Community 36 - "opamp-basics.ts"
Cohesion: 0.06
Nodes (33): BB, dipAt, GEN_AT, genGnd, genOut, lesson, rfA, rfB (+25 more)

### Community 37 - "HC-SR04 Ultrasonic Ranger"
Cohesion: 0.14
Nodes (13): Behaviors, Circuit, For mechanical engineers, HC-SR04 Ultrasonic Ranger, Learning goals, Meet the board, Pro tips, Quiz (+5 more)

### Community 38 - "logic-analyzer.test.ts"
Cohesion: 0.11
Nodes (11): behavior, behavior, LogicCapture, bench(), lesson(), Behaviors, Rules, Shared behaviors (+3 more)

### Community 39 - "The MOSFET Switch"
Cohesion: 0.11
Nodes (18): Board, Circuit, Datasheet check (IRLZ44N, Infineon/IR), F1: A standard (non-logic-level) MOSFET on a 3.3 V GPIO, F2: The MOSFET fails short, F3: Forget the common ground, F4: A 1 Ω heater (12 A) with no heatsink, Failures (+10 more)

### Community 40 - "Linear and Buck Regulators"
Cohesion: 0.11
Nodes (13): Board, Circuit, Datasheet figures used, F1 `hot-ldo`: Ask the LDO for 220 mA, F2 `low-input`: Feed it only 4 V (dropout), F3 `adapter-24v`: Plug in a 24 V adapter, Failures, Learning goals (+5 more)

### Community 41 - "VirtualMcu"
Cohesion: 0.06
Nodes (15): Behaviors, Circuit, Quiz, SIM NOTE, Task B — Arduino transpiler and virtual MCU (`src/engine/mcu/`), readAt(), make(), makeRng() (+7 more)

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
Cohesion: 0.07
Nodes (26): Circuit, BAT, BAT_BLACK, BAT_RED, DIODE_IDS, DIODE_PARTS, GM48, HDR (+18 more)

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
Cohesion: 0.09
Nodes (34): Task D — App shell, theme, controls and sound (`src/ui/`, `src/audio/`, `src/styles/`), Constraints, M1 Task E — Integration: bench store, Board composer, behavior framework, first lesson, What exists on main (use graphify to explore), stopLofi(), QuizItem, Track, BenchActions() (+26 more)

### Community 69 - "Instruments.tsx"
Cohesion: 0.10
Nodes (32): TriggerSpec, ChartSignal, ScopeChannel, ScopeSource, Chan, ChartLane, drawChart(), drawPaper() (+24 more)

### Community 70 - "hcsr04.test.ts"
Cohesion: 0.10
Nodes (14): bench(), fixture(), lostFraction(), Params, fMaxAt(), boots(), frames(), pub() (+6 more)

### Community 71 - "Transpiler"
Cohesion: 0.18
Nodes (6): castPrefix(), intWrapper(), isFloatLit(), jsName(), kindOf(), Transpiler

### Community 72 - "thermal-network.test.ts"
Cohesion: 0.11
Nodes (13): behavior, coldStart(), elementId(), idx(), num(), PAD_RTH, SINK_C, SINK_RTH (+5 more)

### Community 73 - "Solution"
Cohesion: 0.11
Nodes (7): ReadoutEval, Blend, readOne(), Substep, Transient, PwmPhaseSolution, Solution

### Community 74 - "esp32-s3.ts"
Cohesion: 0.12
Nodes (16): BB, DK, ledAnode, ledCathode, lesson, potLeg, rDbotL, rDbotR (+8 more)

### Community 75 - "Tweaks.tsx"
Cohesion: 0.16
Nodes (21): applyBehaviorTweaks(), clamp(), isOn(), momentaryValues(), snapTweak(), base, tweakAssignments(), tweakTargets() (+13 more)

### Community 76 - "pca9685.ts"
Cohesion: 0.05
Nodes (60): ACCEL_LSB, accelLsb(), acks(), advanceTruth(), busHealthy(), busRead16(), busWriteBits(), chipAddress() (+52 more)

### Community 77 - "createBench"
Cohesion: 0.07
Nodes (55): allPlaced(), AssemblyEvent, AssemblyResult, AssemblyState, benchStatus(), buildParts(), burnText(), clone() (+47 more)

### Community 78 - "pid-motor-control.ts"
Cohesion: 0.09
Nodes (15): BAT, BAT_BLACK, BAT_RED, DIODE, DYNO_AT, ENC_AT, encPad(), HDR (+7 more)

### Community 79 - ".snapshot"
Cohesion: 0.05
Nodes (61): bench(), pub(), run(), span(), runUntil(), lines(), run(), run() (+53 more)

### Community 80 - "charge-voltage-current.ts"
Cohesion: 0.09
Nodes (20): BB, j1, jackA, jackCom, LED_RATING, ledAnode, ledCathode, lesson (+12 more)

### Community 81 - "Debugging Instruments"
Cohesion: 0.22
Nodes (8): Debugging Instruments, Failures (hidden faults), Key numbers (as built), Learning goals, Meet the board, analogy, tips, quiz, Readouts, SIM NOTE, Tweaks

### Community 82 - "diode-rectifier.ts"
Cohesion: 0.06
Nodes (29): BB, c1Minus, c1Plus, d1A, d1K, d2A, d2K, d3A (+21 more)

### Community 83 - "series-parallel.ts"
Cohesion: 0.10
Nodes (17): BB, lesson, METER_AT, PACK_AT, r1L, r1R, r2L, r2R (+9 more)

### Community 84 - "Gallery.tsx"
Cohesion: 0.06
Nodes (56): SIM NOTE, PartKind, Gallery, showGallery, BenchBase(), BenchBaseProps, gridTile(), rulerStrip() (+48 more)

### Community 85 - "power-grounding-emc.ts"
Cohesion: 0.06
Nodes (30): CBULK_AT, CDEC_AT, CF_AT, CHF_AT, D1_AT, JACK, JACK_N, JACK_P (+22 more)

### Community 86 - "V"
Cohesion: 0.29
Nodes (7): Engine requirements gathered from SIM NOTEs, SIM NOTE, SIM NOTE, SIM NOTE, SIM NOTE, SIM NOTE, V()

### Community 87 - "Writing a lesson"
Cohesion: 0.10
Nodes (19): 1. Experience, 2. Visual identity (original), 3. Lesson data model, 6. Tracks (syllabus), Bench actions, Circuit Atelier — Spec, Failures, Status panel (+11 more)

### Community 88 - "InkMesh"
Cohesion: 0.08
Nodes (81): lathe(), InkInstances(), InkLookProps, InkMesh(), useLookMaterial(), wireColor(), BreadboardBody(), LoadCellBody() (+73 more)

### Community 89 - "logic-analyzer.ts"
Cohesion: 0.17
Nodes (20): busPins(), capSum(), clear(), elementValue(), IDLE, makeState(), newLines(), num() (+12 more)

### Community 90 - "lessonSchema.ts"
Cohesion: 0.04
Nodes (44): Task E — Integration (after A–D are merged), behaviorRef, COMMON_KEYS, currentSource, element, GUIDE_CONTROLS, guideAction, guideCheck (+36 more)

### Community 91 - "dependencies"
Cohesion: 0.13
Nodes (15): dependencies, @codemirror/lang-cpp@^6.0.3, marked@^18.1.3, react@^19.3.1, react-dom@^19.3.1, @react-three/drei@^10.7.9, @react-three/fiber@^9.8.2, three@^0.187.0 (+7 more)

### Community 92 - "resistor-codes-divider.ts"
Cohesion: 0.07
Nodes (25): BAT_AT, batMinus, batPlus, BB, DMM_AT, jackCom, jackV, ldL (+17 more)

### Community 93 - "Board.tsx"
Cohesion: 0.06
Nodes (60): Deliverables, react, BoardSpec, PartPlacement, AUTO_MARGIN, AUTO_MIN_SIZE, autoFrame(), BASE_KINDS (+52 more)

### Community 94 - "simLoop.ts"
Cohesion: 0.06
Nodes (29): SIM NOTE, modules, registry, resolveBehaviorRef(), ResolvedBehavior, lesson, lesson, describeBurn (+21 more)

### Community 95 - "GuidePanel.tsx"
Cohesion: 0.21
Nodes (12): GuideProgress, GuideState, GuideMode, GuidePanel(), GuidePanelProps, guideSelector(), md(), mdInline() (+4 more)

### Community 96 - "UART, I²C and SPI"
Cohesion: 0.10
Nodes (19): As built (2026-11-09), Behaviors, Board, Circuit, F1: Analyzer (or monitor) at the wrong baud, F2: 47 kΩ pull-ups at 400 kHz, F3: Pull-ups missing, Failures (+11 more)

### Community 97 - "connectors.tsx"
Cohesion: 0.10
Nodes (38): Decisions, HeaderFemaleBody(), HeaderMaleBody(), microGeo(), microMouthGeo(), microShape(), MicroUsbBody(), ScrewTerminal (+30 more)

### Community 98 - "timer-555.ts"
Cohesion: 0.07
Nodes (28): BAT_AT, BB, dipAt, lesson, NE555_FACTS, R_RATING, snapMinus, snapPlus (+20 more)

### Community 99 - "5. Virtual MCU (`src/engine/mcu`)"
Cohesion: 0.14
Nodes (13): Arduino Uno R3, Behaviors, Board, Circuit, For mechanical engineers, Meet the board, Pro tips, Quiz (+5 more)

### Community 100 - "three/index.ts"
Cohesion: 0.08
Nodes (41): three, Bake(), bakeable(), BAKED_INK_PX, bakeGroup(), BakeResult, Bucket, isHullHost() (+33 more)

### Community 101 - "SampleRing"
Cohesion: 0.18
Nodes (6): findTrigger(), SampleRing, fill(), setChart(), extent(), risingCrossings()

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
Cohesion: 0.11
Nodes (27): BURN_DELAY, checkInstant(), checkRatings(), curOf(), DEFAULT_RATINGS, fire(), i2(), mean() (+19 more)

### Community 106 - "capacitor-rc.ts"
Cohesion: 0.07
Nodes (26): BB, btnAt, C1_RATING, c1Minus, c1Plus, DMM_AT, jackCom, jackV (+18 more)

### Community 107 - "multimeter.ts"
Cohesion: 0.08
Nodes (22): AM_AT, BB, lesson, postMinus, postPlus, PSU_AT, r1L, r1R (+14 more)

### Community 108 - "inductor-rl.ts"
Cohesion: 0.09
Nodes (19): BB, D1, d1Anode, d1Cathode, L1, l1Left, l1Right, lesson (+11 more)

### Community 109 - "5. Virtual MCU (`src/engine/mcu`)"
Cohesion: 0.18
Nodes (5): Learning goals, 5. Virtual MCU (`src/engine/mcu`), constrain(), pwmHzFor(), VirtualMcuOptions

### Community 110 - "a4988.ts"
Cohesion: 0.06
Nodes (23): behavior, coil(), COS, decodeMicrostep(), find(), fresh(), mod(), num() (+15 more)

### Community 111 - "Element"
Cohesion: 0.11
Nodes (21): gateOut(), applyBurn(), applyPatches(), failureNodes(), setElementKey(), SHORT_R, uniqueId(), createRatingState() (+13 more)

### Community 112 - "PCB Design Workflow"
Cohesion: 0.11
Nodes (18): Behaviors, Board, Circuit, F1: Forgot the CC resistors, F2: Solder bridge from PB5 to the neighbouring GND pin, F3: LED footprint drawn backwards, Failures, For mechanical engineers (+10 more)

### Community 113 - "ac-meter.ts"
Cohesion: 0.09
Nodes (28): behavior, block(), Channel, channel(), F64, fingerprint(), freqHint(), fresh() (+20 more)

### Community 114 - "behaviors/l298n.ts"
Cohesion: 0.08
Nodes (21): allOpen(), behavior, Channel, channel(), channels(), coastPwmLoss(), coastPwmSource(), decodeL298() (+13 more)

### Community 115 - "smoke.spec.ts"
Cohesion: 0.20
Nodes (6): panel(), Probe, readout(), @playwright/test@^1.65.0, PORT, @playwright/test

### Community 116 - "intermittent.ts"
Cohesion: 0.16
Nodes (15): publishAll(), publishZeros(), apply(), behavior, fresh(), num(), spell(), State (+7 more)

### Community 117 - "TryItYourself.tsx"
Cohesion: 0.39
Nodes (5): Sketch, TryItYourself, sketchBaud(), TryItYourself(), TryItYourselfProps

### Community 118 - "serial-protocols.ts"
Cohesion: 0.12
Nodes (9): AD, bar, DIP, GY, LED_X(), ledParts, lesson, UNO_AT (+1 more)

### Community 119 - "hx711.ts"
Cohesion: 0.12
Nodes (23): behavior, clearConversions(), CODE_MAX, CODE_MIN, codeFor(), countsPerGram(), creepStep(), gainOf() (+15 more)

### Community 120 - "motion.tsx"
Cohesion: 0.06
Nodes (55): cache, chamferRectShape(), disposeOutline(), edgeCache, edgesGeometry(), extrudeAlongX(), extrudeAlongZ(), extrudeUp() (+47 more)

### Community 121 - "scripts"
Cohesion: 0.22
Nodes (9): scripts, build, dev, graph, lint, preview, test, test:e2e (+1 more)

### Community 122 - "ne555.ts"
Cohesion: 0.08
Nodes (17): read(), behavior, clearAll(), State, state(), states, volt(), volt() (+9 more)

### Community 123 - "AppState"
Cohesion: 0.09
Nodes (5): AppState, Item(), Toast(), ToastProps, ToastMessage

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
Nodes (21): BB, lesson, MCU_FACTS, R_RATING, SIG_AT, sigMinus, sigPlus, UNO_AT (+13 more)

### Community 129 - "inductor-rl.test.ts"
Cohesion: 0.07
Nodes (24): L, [METER, AMMETER, BURDEN, MID, TRUE_I], powered(), runFor(), build(), charge(), lesson, [VC, ICH, ICAP] (+16 more)

### Community 130 - "batteries.ts"
Cohesion: 0.13
Nodes (13): BAT_AT, BB, lesson, LOAD_AT, LOAD_RATING, METER_AT, snapMinus, snapPlus (+5 more)

### Community 131 - "power-heat.ts"
Cohesion: 0.14
Nodes (11): BB, lesson, METER_AT, PSU_AT, R1_RATING, r1Left, r1Right, wBbToGnd (+3 more)

### Community 132 - "bbHole"
Cohesion: 0.05
Nodes (43): bbHole(), BENCH_Y, between(), BB, bridge, fBlack, fRed, j1 (+35 more)

### Community 133 - "hc595.ts"
Cohesion: 0.12
Nodes (7): behavior, State, states, The context (`BehaviorContext`, `src/engine/types.ts`), I2cDevice, SpiDevice, SpiSettingsLike

### Community 134 - "inspector.ts"
Cohesion: 0.13
Nodes (20): T_AMB, lesson, BandOptions, DIGIT_COLORS, TOLERANCE_COLORS, bandDecode(), bandValue(), ElementInfo (+12 more)

### Community 135 - "store.ts"
Cohesion: 0.16
Nodes (23): setEffectsEnabled(), asCode(), asGuideSaves(), asProgress(), asSettings(), CameraView, clock(), debounce() (+15 more)

### Community 136 - "Lesson"
Cohesion: 0.03
Nodes (44): Circuit Atelier: Curriculum (T0–T3), File format, Rating conventions used throughout, complementaryTau(), Bench, BenchSnapshot, BehaviorEvent, FailurePatch (+36 more)

### Community 137 - "LogicAnalyzer.tsx"
Cohesion: 0.25
Nodes (15): Protocol, capture(), draw(), Ink, LogicAnalyzer(), PROTOS, readInk(), View (+7 more)

### Community 138 - "createBench"
Cohesion: 0.04
Nodes (48): SfxName, bench(), imuLesson(), AssemblyAction, Note, derivedValue(), readSource(), BenchOptions (+40 more)

### Community 139 - "BehaviorContext"
Cohesion: 0.05
Nodes (20): behavior, loads(), num(), onAt, behavior, State, states, behavior (+12 more)

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

### Community 144 - "interrupts-timers.ts"
Cohesion: 0.11
Nodes (14): BB, HALL_AT, jBtnGnd, jPull5v, lesson, UNO_AT, w2, w3 (+6 more)

### Community 145 - "I2cLines"
Cohesion: 0.23
Nodes (4): State, wire(), I2cLines, OpenDrain

### Community 146 - "wifi-sim.ts"
Cohesion: 0.05
Nodes (39): behavior, enterDownload(), leave(), num(), ROM_LINES, sample(), state(), states (+31 more)

### Community 147 - "LessonDef"
Cohesion: 0.06
Nodes (20): LessonDef, PITCH, HDR, JACK, JACK_N, JACK_P, lesson, MOT (+12 more)

### Community 148 - "rlc-resonance.ts"
Cohesion: 0.12
Nodes (15): BB, cA, cB, GEN_AT, lA, lB, lesson, postMinus (+7 more)

### Community 149 - "decode.ts"
Cohesion: 0.21
Nodes (10): byteText(), decodeI2c(), decodeUart(), FrameKind, hex(), NAMES, I2cTxn, Sink (+2 more)

### Community 150 - "quad-encoder.ts"
Cohesion: 0.13
Nodes (10): behavior, gap(), levelA(), levelB(), pushEdge(), rand(), State, states (+2 more)

### Community 151 - "Logic Gates"
Cohesion: 0.13
Nodes (14): AUTHORING NOTE (M4), Board, F1: Forget the pull-down on input A, F2: Short the output to ground, F3: Run the discrete gate from 3 V, Failures, For mechanical engineers, Learning goals (+6 more)

### Community 152 - "encoders.ts"
Cohesion: 0.10
Nodes (14): BAT, BAT_BLACK, BAT_RED, DIODE, ENC_AT, encPad(), HDR, lesson (+6 more)

### Community 153 - "mcu-supply.ts"
Cohesion: 0.22
Nodes (7): behavior, fresh(), minVccFor(), nodeSets, State, state(), states

### Community 154 - "formatSI"
Cohesion: 0.19
Nodes (10): Global constraints, M1 — Engine plan, Task A — Circuit simulator (`src/engine/sim/`), Task C — 3D look and parametric part library (`src/three/`), Tasks A–D are independent and run in parallel worktrees. Task E integrates them., fixed(), formatSI(), join() (+2 more)

### Community 155 - "pwm.test.ts"
Cohesion: 0.25
Nodes (4): DEFAULT_PWM_HZ, ledNet(), pin(), settle()

### Community 156 - "EdgeTrace"
Cohesion: 0.23
Nodes (6): ResolvedChannel, decodeSpi(), spiSampled(), spi(), spiByte(), EdgeTrace

### Community 157 - "Soldering and Rework"
Cohesion: 0.17
Nodes (11): For mechanical engineers, Learning goals, Meet the board, Pro tips, Quiz, Readouts, SIM NOTE, Sketch (+3 more)

### Community 158 - "three/index.ts"
Cohesion: 0.06
Nodes (48): @react-three/fiber, PartCalloutSpec, CALLOUT_REF_ZOOM, CalloutHost(), CalloutLayerContext, CalloutProps, Pill(), PillActions (+40 more)

### Community 159 - "package.json"
Cohesion: 0.18
Nodes (10): @uiw/react-codemirror@^4.25.12, @types/react@^19.3.0, typescript@~7.0.2, name, private, type, version, @types/react (+2 more)

### Community 160 - "breadboard.test.ts"
Cohesion: 0.40
Nodes (4): L, [LED, IR1, S15, RP, RN], powered(), runFor()

### Community 161 - "pin9"
Cohesion: 0.20
Nodes (10): Behaviors, Board, Circuit, Board, Behaviors, Board, Circuit, Sketch (+2 more)

### Community 162 - "PartInspector.tsx"
Cohesion: 0.25
Nodes (12): App(), BenchScene, summaries, bandHex(), resistorDecode(), KIND_NAME, kindName(), PartCloseup (+4 more)

### Community 163 - "j1"
Cohesion: 0.31
Nodes (9): Board, Circuit (key elements), Behaviors, Board, Circuit, j1(), j3(), onDk() (+1 more)

### Community 164 - "rlc-resonance.test.ts"
Cohesion: 0.18
Nodes (3): build(), [VC, IL, PEAK, F0, ZETA, FD, Q, GAIN], Z0

### Community 165 - "hc74.ts"
Cohesion: 0.29
Nodes (5): behavior, clearAll(), State, state(), states

### Community 166 - "M4 — Digital, Sensors, Professional, Capstone (T3, T4 rest, T5 rest, T6 rest, T7)"
Cohesion: 0.50
Nodes (3): Engine features available, M4 — Digital, Sensors, Professional, Capstone (T3, T4 rest, T5 rest, T6 rest, T7), Order

### Community 167 - "loadcell-hx711.ts"
Cohesion: 0.12
Nodes (11): CELL, HC, HC_PINS, HM, HM_PINS, lesson, NOMINAL_FACTOR, U1 (+3 more)

### Community 168 - "extensions.test.ts"
Cohesion: 0.12
Nodes (11): Behaviors, Circuit, Adafruit_PWMServoDriver, harness(), PinEvent, quadEdges(), run(), runSketch() (+3 more)

### Community 169 - "switch-bounce.ts"
Cohesion: 0.25
Nodes (5): behavior, clearAll(), State, state(), states

### Community 170 - "ntc.ts"
Cohesion: 0.24
Nodes (10): apply(), behavior, ntcOhms(), num(), ohmsFor(), settle(), State, stateOf() (+2 more)

### Community 171 - "led-resistor.ts"
Cohesion: 0.09
Nodes (19): BB_H, jumper(), UNO, BB, gnd, j1, LED_RATING, ledAnode (+11 more)

### Community 172 - "hcsr04.ts"
Cohesion: 0.26
Nodes (11): behavior, disarm(), gauss(), has(), num(), ping(), rand(), soundSpeed() (+3 more)

### Community 173 - "irq-bounce.ts"
Cohesion: 0.29
Nodes (7): behavior, inject(), num(), rng(), State, states, valueOf()

### Community 174 - "opamp-config.ts"
Cohesion: 0.29
Nodes (3): behavior, Win, wins

### Community 175 - "ne555.test.ts"
Cohesion: 0.29
Nodes (5): behavior, [CAP, OUT, FREQ, DUTY, PULSE, FAST], fixture(), mk(), Opts

### Community 177 - "M2 — Video lessons (parallel authors)"
Cohesion: 0.33
Nodes (5): After each batch, Batch 1 (shared behaviors land here first), Batch 2, M2 — Video lessons (parallel authors), Per-lesson task (the same for every author)

### Community 179 - "Failures"
Cohesion: 0.33
Nodes (6): Authored notes (T6 build), F1: Cold morning, code still assumes 20 °C, F2: ECHO wire falls off, F3: A second ranger pinging at the same time, F4: 5 V ECHO into a 3.3 V microcontroller, Failures

### Community 181 - "tmp36.ts"
Cohesion: 0.40
Nodes (5): apply(), behavior, tempOf(), TMP36_OFFSET_V, TMP36_V_PER_C

### Community 182 - "Failures"
Cohesion: 0.40
Nodes (5): F1: Drive a motor straight off pin 9, F2: Bypass the 220 Ω resistor, F3: Short 5 V to GND on the header, F4: Feed 12 V into the 5 V pin, Failures

### Community 183 - "Menu.tsx"
Cohesion: 0.50
Nodes (3): MenuButton(), MenuButtonProps, MenuItem

### Community 184 - "Failures"
Cohesion: 0.40
Nodes (5): F1: Tired, high-resistance battery, F2: IMU mounted 3° off, F3: Right motor wired backwards, F4: Worn gearbox (4° backlash), Failures

### Community 185 - "SIM NOTE"
Cohesion: 0.50
Nodes (4): Board, SIM NOTE, Servo, servo()

### Community 186 - "Failures"
Cohesion: 0.50
Nodes (4): F1: Power the servos from the Uno's 5 V pin, F2: No common ground, F3: Breakout without I²C pull-ups, Failures

### Community 187 - "Failures"
Cohesion: 0.50
Nodes (4): F1: Cold joint on J2, F2: Solder bridge between pads D5 and D6, F3: Lifted pad on J3 (overheated during rework), Failures

## Knowledge Gaps
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Lesson` connect `Lesson` to `inductor-rl.test.ts`, `inspector.ts`, `store.ts`, `LogicAnalyzer.tsx`, `createBench`, `BenchScene.tsx`, `getLesson`, `wifi-sim.ts`, `breadboard.test.ts`, `engine/types.ts`, `PartInspector.tsx`, `logic-analyzer.test.ts`, `ntc.ts`, `ne555.test.ts`, `pwm-filter.test.ts`, `Layout.tsx`, `Instruments.tsx`, `hcsr04.test.ts`, `thermal-network.test.ts`, `createBench`, `.snapshot`, `Writing a lesson`, `lessonSchema.ts`, `Board.tsx`, `simLoop.ts`, `series-rlc.test.ts`, `hx711.ts`, `AppState`?**
  _High betweenness centrality (0.101) - this node is a cross-community bridge._
- **Are the 8 inferred relationships involving `createBench()` (e.g. with `Decisions` and `Deliverables`) actually correct?**
  _`createBench()` has 8 INFERRED edges - model-reasoned connections that need verification._
- **Should `devices.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.04546823246010238 - nodes in this community are weakly interconnected._
- **Why does `Circuit Atelier: Curriculum (T0–T3)` connect `Lesson` to `Linear and Buck Regulators`, `Order and prerequisites`, `V`?**
  _High betweenness centrality (0.084) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `Lesson` (e.g. with `Circuit Atelier: Curriculum (T0–T3)` and `File format`) actually correct?**
  _`Lesson` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Should `layout.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `engine/types.ts` to `inductor-rl.test.ts`, `hc595.ts`, `sound.ts`, `store.ts`, `Lesson`, `package.json`, `transpile.ts`, `createBench`, `BenchScene.tsx`, `inspector.ts`, `getLesson`, `LogicAnalyzer.tsx`, `wifi-sim.ts`, `transient.ts`, `decode.ts`, `quad-encoder.ts`, `formatSI`, `pwm.test.ts`, `three/index.ts`, `package.json`, `tb6612.ts`, `breadboard.test.ts`, `rlc-resonance.test.ts`, `logic-analyzer.test.ts`, `extensions.test.ts`, `VirtualMcu`, `ntc.ts`, `ne555.test.ts`, `pwm-filter.test.ts`, `@vitejs/plugin-react`, `Instruments.tsx`, `hcsr04.test.ts`, `thermal-network.test.ts`, `Tweaks.tsx`, `pca9685.ts`, `createBench`, `.snapshot`, `lessonSchema.ts`, `Board.tsx`, `simLoop.ts`, `three/index.ts`, `SampleRing`, `series-rlc.test.ts`, `ratings.ts`, `5. Virtual MCU (`src/engine/mcu`)`, `a4988.ts`, `Element`, `ac-meter.ts`, `behaviors/l298n.ts`, `TryItYourself.tsx`, `hx711.ts`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._