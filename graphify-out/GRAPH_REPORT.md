# Graph Report - Electonics Interactive course  (2026-11-11)

## Corpus Check
- 417 files · ~625,020 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 7 file(s) not represented in the graph (top: .css 4, (none) 3)

## Summary
- 4899 nodes · 10721 edges · 192 communities (185 shown, 7 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 660 edges (avg confidence: 0.89)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `51ab293e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- devices.ts
- logic-gates.ts
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
- imu-mpu6050.ts
- getLesson
- boards.tsx
- compilerOptions
- A4988 Stepper Driver
- transient.ts
- solder-joints.ts
- transistor-switch.ts
- NTC Thermistor
- MPU-6050 IMU
- PID Motor Speed Control
- Power, Grounding and EMC
- PcbLayers.tsx
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
- Quadrature Encoders
- Layout.tsx
- Instruments.tsx
- Thermal Design
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
- pendulum.ts
- InkMesh
- logic-analyzer.ts
- lessonSchema.ts
- dependencies
- resistor-codes-divider.ts
- Board.tsx
- semis.tsx
- App.tsx
- UART, I²C and SPI
- soldering-rework.ts
- timer-555.ts
- 5. Virtual MCU (`src/engine/mcu`)
- three/index.ts
- ADC, DAC and PWM
- series-rlc.test.ts
- pca9685-servo.ts
- Circuit Atelier — interactive electronics course
- ratings.ts
- capacitor-rc.ts
- multimeter.ts
- inductor-rl.ts
- 5. Virtual MCU (`src/engine/mcu`)
- a4988.ts
- loadcell-hx711.ts
- PCB Design Workflow
- ac-meter.ts
- behaviors/l298n.ts
- smoke.spec.ts
- intermittent.ts
- TryItYourself.tsx
- serial-protocols.ts
- hx711.ts
- pcbLayerArt.ts
- scripts
- ne555.ts
- AppState
- ohms-law.ts
- mpu6050-imu.ts
- layout.ts
- zener.ts
- adc-dac-pwm.ts
- inductor-rl.test.ts
- batteries.ts
- power-heat.ts
- LessonDef
- hc595.ts
- inspector.ts
- store.ts
- Lesson
- LogicAnalyzer.tsx
- imu-mpu6050.test.ts
- BehaviorContext
- transformer.ts
- Driver
- probe
- mosfet-switch.ts
- vitest
- I2cLines
- wifi-sim.ts
- layout.ts
- rlc-resonance.ts
- decode.ts
- quad-encoder.ts
- drc.ts
- encoders.ts
- mcu-supply.ts
- createBench
- logic-analyzer.test.ts
- EdgeTrace
- Soldering and Rework
- BehaviorMcu
- PCA9685 Servo Driver
- pin9
- edge-counter.ts
- quad-encoder.test.ts
- j1
- rlc-resonance.test.ts
- hc74.ts
- M4 — Digital, Sensors, Professional, Capstone (T3, T4 rest, T5 rest, T6 rest, T7)
- pcbTour.ts
- extensions.test.ts
- switch-bounce.ts
- ntc.ts
- led-resistor.ts
- hcsr04.ts
- irq-bounce.ts
- CalloutLayer
- Guide
- capstone-balancing-robot.test.ts
- M2 — Video lessons (parallel authors)
- Failures
- Failures
- trace-heat.ts
- SIM NOTE
- Menu.tsx
- Failures
- a4988-stepper.ts
- Load Cell and HX711
- Failures
- pcb-design-workflow.ts
- Writing a lesson
- Element
- tmp36.ts

## God Nodes (most connected - your core abstractions)
1. `createBench()` - 235 edges
2. `vitest` - 159 edges
3. `Lesson` - 123 edges
4. `Bench` - 83 edges
5. `VirtualMcu` - 78 edges
6. `validateLesson()` - 76 edges
7. `BehaviorContext` - 68 edges
8. `Behavior` - 68 edges
9. `InkMesh()` - 65 edges
10. `getLesson()` - 62 edges

## Surprising Connections (you probably didn't know these)
- ``hx711` behavior` --references--> `gain()`  [INFERRED]
  docs/curriculum/T6/loadcell-hx711.md → src/engine/behaviors/pid-tune.ts
- `SIM NOTE` --references--> `V()`  [INFERRED]
  docs/curriculum/T0/kirchhoff.md → src/engine/bench/readouts.test.ts
- `SIM NOTE` --references--> `V()`  [INFERRED]
  docs/curriculum/T3/timer-555.md → src/engine/bench/readouts.test.ts
- `Per-lesson task (the same for every author)` --references--> `validateLesson()`  [INFERRED]
  docs/plans/m2-video-lessons.md → src/engine/lessonSchema.ts
- `SIM NOTE` --references--> `VirtualMcu`  [INFERRED]
  docs/curriculum/T4/arduino-uno.md → src/engine/mcu/virtualMcu.ts

## Import Cycles
- None detected.

## Communities (192 total, 7 thin omitted)

### Community 0 - "devices.ts"
Cohesion: 0.04
Nodes (86): BJT_BETA, BJT_BETA_R, BJT_IS, bjtEval(), BK, blankParams(), BREAK_KNEE, BREAK_RZ (+78 more)

### Community 1 - "logic-gates.ts"
Cohesion: 0.10
Nodes (19): LogicGate, BB1, BB2, dipAt(), gateChip(), GEN_AT, genGnd, genOut (+11 more)

### Community 2 - "Capstone: Two-Wheel Balancer"
Cohesion: 0.14
Nodes (13): As built (2026-11-11), Behaviors, Capstone: Two-Wheel Balancer, Circuit, For mechanical engineers, Learning goals, Meet the board, Pro tips (+5 more)

### Community 3 - "ADC, DAC and PWM"
Cohesion: 0.12
Nodes (16): Circuit, F1: Use an old analog meter (20 kΩ/V on the 10 V range), F2: Measure volts with the red lead still in the mA jack, F3: The bottom resistor falls out while you measure, Failures, For mechanical engineers, Learning goals, Meet the board (+8 more)

### Community 4 - "solve.ts"
Cohesion: 0.08
Nodes (30): harness(), PinEvent, Widget, GMIN, IP, LinSlot, Measured, StampCtx (+22 more)

### Community 5 - "deploy.yml"
Cohesion: 0.06
Nodes (31): runs-on, steps, concurrency, cancel-in-progress, group, environment, needs, runs-on (+23 more)

### Community 6 - "sound.ts"
Cohesion: 0.14
Nodes (27): Task D — App shell, theme, controls and sound (`src/ui/`, `src/audio/`, `src/styles/`), BASS, BEATS_PER_CHORD, beatSeconds(), BPM, chordSeconds(), HAT_STEPS, KICK_STEPS (+19 more)

### Community 7 - "runtime.ts"
Cohesion: 0.07
Nodes (48): DEFAULT, EXTERNAL, INTERNAL, SPI_MODE0, arduinoMap(), arduinoRound(), bitClearFn(), bitSetFn() (+40 more)

### Community 8 - "transpile.ts"
Cohesion: 0.07
Nodes (39): ARDUINO_CONSTANTS, BUILTIN_NAMES, UNSUPPORTED_API, errorOf(), AWAITED, BIT_OPS, charCode(), checkCompiles() (+31 more)

### Community 9 - "package.json"
Cohesion: 0.10
Nodes (24): devDependencies, jsdom@^31.0.0, oxlint@^1.90.0, @types/node@^24.19.2, @types/react@^19.3.0, @types/react-dom@^19.3.0, @types/three@^0.187.0, typescript@~7.0.2 (+16 more)

### Community 10 - "constants.ts"
Cohesion: 0.06
Nodes (33): A0, A1, A2, A3, A4, A5, A6, A7 (+25 more)

### Community 11 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+11 more)

### Community 12 - "BenchScene.tsx"
Cohesion: 0.07
Nodes (46): @react-three/drei, @react-three/fiber, BenchScene(), box, Camera(), cardInset(), DevPartProbe(), findPart() (+38 more)

### Community 13 - "imu-mpu6050.ts"
Cohesion: 0.11
Nodes (35): ACCEL_LSB, accelLsb(), acks(), advanceTruth(), busHealthy(), busRead16(), busWriteBits(), chainConstants() (+27 more)

### Community 14 - "getLesson"
Cohesion: 0.08
Nodes (47): benchActionEvents(), createGuide(), passes(), eventMatches(), GuideBenchView, GuideEvent, GuideUi, base (+39 more)

### Community 15 - "boards.tsx"
Cohesion: 0.06
Nodes (82): InkInstances(), Art, At(), boardArt(), BoardSlab(), Breadboard, GenericModule(), LoadCell (+74 more)

### Community 16 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 17 - "A4988 Stepper Driver"
Cohesion: 0.11
Nodes (17): A4988 Stepper Driver, Behaviors, Board, Circuit, F1: No current limit (trimmer at the stop), F2: Unplug the motor while powered, F3: MS wires fall off, Failures (+9 more)

### Community 18 - "transient.ts"
Cohesion: 0.09
Nodes (38): branchCount(), captureState(), inheritState(), modesChanged(), waveValue(), coil(), settle(), lastPeriodPeak() (+30 more)

### Community 19 - "solder-joints.ts"
Cohesion: 0.11
Nodes (31): act(), ALLOYS, apply(), applyForced(), asQuality(), behavior, DWELL_MAX_S, DWELL_MIN_S (+23 more)

### Community 20 - "transistor-switch.ts"
Cohesion: 0.07
Nodes (25): BB, d1Anode, d1Cathode, jRb, M1, MOTOR_AT, PACK_AT, pin9 (+17 more)

### Community 21 - "NTC Thermistor"
Cohesion: 0.11
Nodes (18): Behaviors, Circuit, F1: Wrong part on the reel (B = 3435 K), code still says 3977, F2: Thermistor lead breaks, F3: A 1 kΩ resistor fitted instead of 10 kΩ, Failures, For mechanical engineers, Implementation notes (as built) (+10 more)

### Community 22 - "MPU-6050 IMU"
Cohesion: 0.10
Nodes (19): Behaviors, Board, Circuit, F1: Warm the sensor after calibrating, F2: Remove the I²C pull-ups, F3: AD0 pulled high, Failures, For mechanical engineers (+11 more)

### Community 23 - "PID Motor Speed Control"
Cohesion: 0.11
Nodes (17): Behaviors, Board, Circuit, F1: Encoder A/B swapped (positive feedback), F2: Encoder pull-ups missing (lost feedback), F3: Tired battery (actuator saturation), Failures, For mechanical engineers (+9 more)

### Community 24 - "Power, Grounding and EMC"
Cohesion: 0.12
Nodes (16): As built (2026-11-09) — supersedes the draft below where they differ, Draft, F1: Return the load through the sensor ground, F2: The same, with thin 30 AWG wire, F3: Swap in a non-logic-level MOSFET (IRF540N, worst-case part), Failures, For mechanical engineers, Learning goals (+8 more)

### Community 25 - "PcbLayers.tsx"
Cohesion: 0.16
Nodes (23): liveTrace(), coreThicknessMm(), layerShift(), layerVisible(), layerY(), partsLift(), PCB_LAYERS, PCB_STACK (+15 more)

### Community 26 - "L298N Module"
Cohesion: 0.11
Nodes (18): Behaviors, Board, Circuit, F1: Remove the flyback diodes, then stop, F2: Run two motors at 1.5 A without the heatsink, F3: Run it from a single Li-ion cell (3.7 V), Failures, For mechanical engineers (+10 more)

### Community 27 - "LED and Resistor"
Cohesion: 0.12
Nodes (17): Board, Circuit, F1: Leave the resistor out (jumper in its place), F2: 22 Ω fitted instead of 220 Ω (red-red-black), F3: LED in backwards, Failures, For mechanical engineers, Learning goals (+9 more)

### Community 28 - "The Transistor Switch"
Cohesion: 0.11
Nodes (18): Board, Circuit, F1: Remove the flyback diode, F2: Skip the base resistor, F3: Stall the motor, F4: Forget the common ground, Failures, For mechanical engineers (+10 more)

### Community 29 - "compile"
Cohesion: 0.29
Nodes (11): compile(), extraKeys(), extraNodes(), hasInternalNode(), isNonlinear(), layoutSignature(), limitSlots(), partition() (+3 more)

### Community 30 - "ESP32-S3 DevKitC-1"
Cohesion: 0.11
Nodes (18): Behaviors, Board, Circuit, ESP32-S3 DevKitC-1, F1: Wire a 5 V signal straight into GPIO4, F2: LED with no resistor on GPIO5, F3: Button on GPIO0 held at power-up, Failures (+10 more)

### Community 31 - "tb6612.ts"
Cohesion: 0.09
Nodes (27): allOpen(), applyFast(), behavior, bridgeLoss(), Channel, channel(), channels(), CHATTER_PICK (+19 more)

### Community 32 - "TB6612FNG Dual H-Bridge"
Cohesion: 0.11
Nodes (18): Behaviors, Board, Circuit, F1: Stall it on a fresh 2S Li-ion pack, F2: VM from a 4S LiPo (16.8 V), F3: Forget the common ground, Failures, For mechanical engineers (+10 more)

### Community 33 - "arduino-uno.ts"
Cohesion: 0.04
Nodes (44): BB, benchParts, boardParts, decouple(), dPin(), H_ANA, H_DIG_HI, H_DIG_LO (+36 more)

### Community 34 - "engine/types.ts"
Cohesion: 0.03
Nodes (57): behavior, lesson, behavior, fixture(), Params, modules, registry, resolveBehaviorRef() (+49 more)

### Community 35 - "tb6612fng.ts"
Cohesion: 0.11
Nodes (11): BAT, BAT_BLACK, BAT_RED, DIODE, HDR, lesson, MOT, MOT_T1 (+3 more)

### Community 36 - "opamp-basics.ts"
Cohesion: 0.06
Nodes (33): BB, dipAt, GEN_AT, genGnd, genOut, lesson, rfA, rfB (+25 more)

### Community 37 - "HC-SR04 Ultrasonic Ranger"
Cohesion: 0.13
Nodes (14): Behaviors, Board, Circuit, For mechanical engineers, HC-SR04 Ultrasonic Ranger, Learning goals, Meet the board, Pro tips (+6 more)

### Community 38 - "logic-analyzer.test.ts"
Cohesion: 0.16
Nodes (10): LogicCapture, aw(), gain(), num(), period(), Shared behaviors, Frame, LogicChannel (+2 more)

### Community 39 - "The MOSFET Switch"
Cohesion: 0.11
Nodes (18): Board, Circuit, Datasheet check (IRLZ44N, Infineon/IR), F1: A standard (non-logic-level) MOSFET on a 3.3 V GPIO, F2: The MOSFET fails short, F3: Forget the common ground, F4: A 1 Ω heater (12 A) with no heatsink, Failures (+10 more)

### Community 40 - "Linear and Buck Regulators"
Cohesion: 0.14
Nodes (13): Board, Circuit, Datasheet figures used, F1 `hot-ldo`: Ask the LDO for 220 mA, F2 `low-input`: Feed it only 4 V (dropout), F3 `adapter-24v`: Plug in a 24 V adapter, Failures, Learning goals (+5 more)

### Community 41 - "VirtualMcu"
Cohesion: 0.07
Nodes (11): Behaviors, Quiz, SIM NOTE, Task B — Arduino transpiler and virtual MCU (`src/engine/mcu/`), readAt(), make(), makeRng(), run() (+3 more)

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
Cohesion: 0.12
Nodes (15): Board, Circuit, F1: Turn channel 1 up to 12 V, F2: The sink arm goes open, F3: Short node A to ground, Failures, For mechanical engineers, Kirchhoff's Laws (+7 more)

### Community 49 - "Ohm's Law"
Cohesion: 0.12
Nodes (16): Circuit, F1: 12 V into 100 Ω, F2: Misread colour bands (10 Ω fitted instead of 1 kΩ), F3: Resistor lead pulls out of the board, F4: Short the output, Failures, For mechanical engineers, Learning goals (+8 more)

### Community 50 - "AC and the Oscilloscope"
Cohesion: 0.14
Nodes (13): AC and the Oscilloscope, Circuit, F1: Add a 3 V DC offset, F2: Turn the frequency up to 500 Hz, F3: Load the generator with 47 Ω, Failures, For mechanical engineers, Learning goals (+5 more)

### Community 51 - "React + TypeScript + Vite"
Cohesion: 0.50
Nodes (3): Expanding the Oxlint configuration, React Compiler, React + TypeScript + Vite

### Community 52 - "Capacitors and RC Time"
Cohesion: 0.12
Nodes (15): Board, Capacitors and RC Time, Circuit, F1: Plug it into 24 V, F2: Swap in 1000 µF, F3: A leaky capacitor, Failures, For mechanical engineers (+7 more)

### Community 53 - "RLC Resonance"
Cohesion: 0.13
Nodes (14): Circuit, F1: Take the damping resistor out, F2: Hot-plug 12 V into a 16 V ceramic filter, F3: The capacitor fails short, Failures, For mechanical engineers, Learning goals, Meet the board (+6 more)

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
Cohesion: 0.12
Nodes (15): Board, Circuit, F1: Remove the debounce capacitor, F2: Leave out the tach pull-up, F3: Spin the wheel at 300 kHz, Failures, For mechanical engineers, Interrupts and Timers (+7 more)

### Community 59 - "Power and Heat"
Cohesion: 0.13
Nodes (14): Circuit, F1: 47 Ω on 5 V, F2: Same resistor, supply turned up to 12 V, F3: Fit a 2 W resistor instead, Failures, For mechanical engineers, Learning goals, Meet the board (+6 more)

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
Nodes (15): Board, Circuit, Diodes and Rectifiers, F1: One diode goes open, F2: Leave out the smoothing capacitor, F3: A diode fitted backwards, Failures, For mechanical engineers (+7 more)

### Community 65 - "The Zener Regulator"
Cohesion: 0.12
Nodes (15): Board, Circuit, F1: Plug in a 15 V adapter, F2: Ask for too much current (100 Ω load), F3: Zener fitted backwards, Failures, For mechanical engineers, Learning goals (+7 more)

### Community 66 - "The 555 Timer"
Cohesion: 0.12
Nodes (15): Board, Circuit, F1: Leave out R1 (pin 7 tied straight to V_CC), F2: Remove the timing capacitor, F3: Run it from two AA cells, Failures, For mechanical engineers, Learning goals (+7 more)

### Community 67 - "Quadrature Encoders"
Cohesion: 0.12
Nodes (16): Board, F1: Missing pull-ups, F2: A and B swapped, F3: Overdrive it on 12 V with noisy wiring, Failures, For mechanical engineers, Learning goals, Meet the board (+8 more)

### Community 68 - "Layout.tsx"
Cohesion: 0.10
Nodes (35): What exists on main (use graphify to explore), 6. Tracks (syllabus), QuizItem, Track, Authoring pitfalls (learned in M3 batch 1), BenchActions(), Controls(), ControlsProps (+27 more)

### Community 69 - "Instruments.tsx"
Cohesion: 0.05
Nodes (48): Global constraints, M1 — Engine plan, Task A — Circuit simulator (`src/engine/sim/`), Task C — 3D look and parametric part library (`src/three/`), Tasks A–D are independent and run in parallel worktrees. Task E integrates them., findTrigger(), SampleRing, fill() (+40 more)

### Community 70 - "Thermal Design"
Cohesion: 0.07
Nodes (27): Behaviors, Board, Circuit, F1: Remove the heatsink, F2: Run it from 24 V, F3: Mount it dry (no grease, poor contact), Failures, For mechanical engineers (+19 more)

### Community 71 - "Transpiler"
Cohesion: 0.18
Nodes (6): castPrefix(), intWrapper(), isFloatLit(), jsName(), kindOf(), Transpiler

### Community 72 - "thermal-network.test.ts"
Cohesion: 0.11
Nodes (13): behavior, coldStart(), elementId(), idx(), num(), PAD_RTH, SINK_C, SINK_RTH (+5 more)

### Community 73 - "Solution"
Cohesion: 0.06
Nodes (22): read(), counts, curOf(), E_CHARGE, volt(), volt(), volts(), curOf() (+14 more)

### Community 74 - "esp32-s3.ts"
Cohesion: 0.12
Nodes (16): BB, DK, ledAnode, ledCathode, lesson, potLeg, rDbotL, rDbotR (+8 more)

### Community 75 - "Tweaks.tsx"
Cohesion: 0.13
Nodes (25): applyBehaviorTweaks(), initialTweaks(), clamp(), isOn(), momentaryValues(), snapTweak(), base, tweakAssignments() (+17 more)

### Community 76 - "pca9685.ts"
Cohesion: 0.07
Nodes (34): acks(), address(), behavior, busOk(), decode(), device(), devRead(), devWrite() (+26 more)

### Community 77 - "createBench"
Cohesion: 0.06
Nodes (63): allPlaced(), AssemblyAction, AssemblyEvent, AssemblyResult, AssemblyState, benchStatus(), buildParts(), burnText() (+55 more)

### Community 78 - "pid-motor-control.ts"
Cohesion: 0.09
Nodes (15): BAT, BAT_BLACK, BAT_RED, DIODE, DYNO_AT, ENC_AT, encPad(), HDR (+7 more)

### Community 79 - ".snapshot"
Cohesion: 0.04
Nodes (68): pub(), run(), span(), runUntil(), lines(), lostFraction(), run(), run() (+60 more)

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
Cohesion: 0.05
Nodes (79): BoardSpec, BenchBase(), BenchBaseProps, gridTile(), rulerStrip(), PartCalloutSpec, CALLOUT_REF_ZOOM, CalloutHost() (+71 more)

### Community 85 - "power-grounding-emc.ts"
Cohesion: 0.06
Nodes (30): CBULK_AT, CDEC_AT, CF_AT, CHF_AT, D1_AT, JACK, JACK_N, JACK_P (+22 more)

### Community 86 - "V"
Cohesion: 0.15
Nodes (12): Engine requirements gathered from SIM NOTEs, SIM NOTE, SIM NOTE, SIM NOTE, Global constraints, M1.5 — Engine extensions (triaged from the curriculum SIM NOTEs), X1 — Simulator (`src/engine/sim/`), X2 — Virtual MCU (`src/engine/mcu/`) (+4 more)

### Community 87 - "pendulum.ts"
Cohesion: 0.06
Nodes (59): Behaviors, behavior, currentOf(), MODE, Motor, motorOf(), num(), onStep() (+51 more)

### Community 88 - "InkMesh"
Cohesion: 0.05
Nodes (114): cache, chamferRectShape(), disposeOutline(), edgeCache, edgesGeometry(), extrudeAlongX(), extrudeUp(), flattedCircleShape() (+106 more)

### Community 89 - "logic-analyzer.ts"
Cohesion: 0.13
Nodes (25): busPins(), capSum(), clear(), elementValue(), IDLE, makeState(), newLines(), num() (+17 more)

### Community 90 - "lessonSchema.ts"
Cohesion: 0.03
Nodes (50): behaviorRef, COMMON_KEYS, currentSource, element, GUIDE_CONTROLS, guideAction, guideCheck, guideControl (+42 more)

### Community 91 - "dependencies"
Cohesion: 0.15
Nodes (13): dependencies, react@^19.3.1, react-dom@^19.3.1, @react-three/drei@^10.7.9, @react-three/fiber@^9.8.2, three@^0.187.0, @uiw/react-codemirror@^4.25.12, zod@^4.6.7 (+5 more)

### Community 92 - "resistor-codes-divider.ts"
Cohesion: 0.06
Nodes (38): BAT_AT, batMinus, batPlus, BB, DMM_AT, jackCom, jackV, ldL (+30 more)

### Community 93 - "Board.tsx"
Cohesion: 0.05
Nodes (72): SIM NOTE, Decisions, react, PartKind, PartPlacement, AUTO_MARGIN, AUTO_MIN_SIZE, autoFrame() (+64 more)

### Community 94 - "semis.tsx"
Cohesion: 0.16
Nodes (19): extrudeAlongZ(), ledLook(), tint(), loadCellGeo(), GlowHalo(), Heatsink, Led, LedBody() (+11 more)

### Community 95 - "App.tsx"
Cohesion: 0.10
Nodes (21): marked@^18.1.3, marked, App(), BenchScene, summaries, getBench(), GuideProgress, GuideState (+13 more)

### Community 96 - "UART, I²C and SPI"
Cohesion: 0.11
Nodes (18): As built (2026-11-09), Behaviors, Circuit, F1: Analyzer (or monitor) at the wrong baud, F2: 47 kΩ pull-ups at 400 kHz, F3: Pull-ups missing, Failures, For mechanical engineers (+10 more)

### Community 97 - "soldering-rework.ts"
Cohesion: 0.11
Nodes (13): JACK, JOINT_FACTS, JX, LED_AT, lesson, Q1, Q1_AT, RG_AT (+5 more)

### Community 98 - "timer-555.ts"
Cohesion: 0.07
Nodes (28): BAT_AT, BB, dipAt, lesson, NE555_FACTS, R_RATING, snapMinus, snapPlus (+20 more)

### Community 99 - "5. Virtual MCU (`src/engine/mcu`)"
Cohesion: 0.12
Nodes (16): Arduino Uno R3, Board, F1: Drive a motor straight off pin 9, F2: Bypass the 220 Ω resistor, F3: Short 5 V to GND on the header, F4: Feed 12 V into the 5 V pin, Failures, For mechanical engineers (+8 more)

### Community 100 - "three/index.ts"
Cohesion: 0.08
Nodes (42): three, Bake(), bakeable(), BAKED_INK_PX, bakeGroup(), BakeResult, Bucket, isHullHost() (+34 more)

### Community 101 - "ADC, DAC and PWM"
Cohesion: 0.12
Nodes (15): ADC, DAC and PWM, Board, F1: Drive a 1 kΩ load straight from the filter, F2: Fit a 1000 µF smoothing capacitor, F3: Remove the filter capacitor, Failures, For mechanical engineers, Learning goals (+7 more)

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
Nodes (35): chain(), msPerFrame(), ratingsMs(), BURN_DELAY, checkInstant(), checkRatings(), createRatingState(), curOf() (+27 more)

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
Cohesion: 0.13
Nodes (6): Learning goals, SIM NOTE, 5. Virtual MCU (`src/engine/mcu`), constrain(), pwmHzFor(), VirtualMcuOptions

### Community 110 - "a4988.ts"
Cohesion: 0.08
Nodes (22): behavior, coil(), COS, decodeMicrostep(), find(), fresh(), mod(), num() (+14 more)

### Community 111 - "loadcell-hx711.ts"
Cohesion: 0.12
Nodes (11): CELL, HC, HC_PINS, HM, HM_PINS, lesson, NOMINAL_FACTOR, U1 (+3 more)

### Community 112 - "PCB Design Workflow"
Cohesion: 0.11
Nodes (18): Behaviors, Board, Circuit, F1: Forgot the CC resistors, F2: Solder bridge from PB5 to the neighbouring GND pin, F3: LED footprint drawn backwards, Failures, For mechanical engineers (+10 more)

### Community 113 - "ac-meter.ts"
Cohesion: 0.09
Nodes (28): behavior, block(), Channel, channel(), F64, fingerprint(), freqHint(), fresh() (+20 more)

### Community 114 - "behaviors/l298n.ts"
Cohesion: 0.09
Nodes (20): allOpen(), behavior, Channel, channel(), channels(), coastPwmLoss(), coastPwmSource(), decodeL298() (+12 more)

### Community 115 - "smoke.spec.ts"
Cohesion: 0.20
Nodes (6): panel(), Probe, readout(), @playwright/test@^1.65.0, PORT, @playwright/test

### Community 116 - "intermittent.ts"
Cohesion: 0.16
Nodes (15): publishAll(), publishZeros(), apply(), behavior, fresh(), num(), spell(), State (+7 more)

### Community 117 - "TryItYourself.tsx"
Cohesion: 0.33
Nodes (6): @codemirror/lang-cpp@^6.0.3, @codemirror/lang-cpp, Sketch, sketchBaud(), TryItYourself(), TryItYourselfProps

### Community 118 - "serial-protocols.ts"
Cohesion: 0.12
Nodes (9): AD, bar, DIP, GY, LED_X(), ledParts, lesson, UNO_AT (+1 more)

### Community 119 - "hx711.ts"
Cohesion: 0.13
Nodes (22): behavior, clearConversions(), CODE_MAX, CODE_MIN, codeFor(), countsPerGram(), creepStep(), gainOf() (+14 more)

### Community 120 - "pcbLayerArt.ts"
Cohesion: 0.23
Nodes (14): footprint(), Pad, turnFront(), ArtLayer, boardPads(), COPPER, drawLayerArt(), drillHits() (+6 more)

### Community 121 - "scripts"
Cohesion: 0.22
Nodes (9): scripts, build, dev, graph, lint, preview, test, test:e2e (+1 more)

### Community 122 - "ne555.ts"
Cohesion: 0.13
Nodes (9): apply(), behavior, num(), State, states, [CAP, OUT, FREQ, DUTY, PULSE, FAST], fixture(), mk() (+1 more)

### Community 124 - "ohms-law.ts"
Cohesion: 0.13
Nodes (13): BB, DMM_AT, jackA, jackCom, lesson, postMinus, postPlus, PSU_AT (+5 more)

### Community 125 - "mpu6050-imu.ts"
Cohesion: 0.13
Nodes (8): HDR, HDR_PINS, MOT, MOT_T1, MOT_T2, U1, UNO_AT, Wire

### Community 126 - "layout.ts"
Cohesion: 0.04
Nodes (50): BB_H, bbHole(), BENCH_Y, between(), PITCH, UNO, BB, GEN_AT (+42 more)

### Community 127 - "zener.ts"
Cohesion: 0.08
Nodes (22): BAT_AT, batMinus, batPlus, BB, DMM_AT, jackCom, jackV, lesson (+14 more)

### Community 128 - "adc-dac-pwm.ts"
Cohesion: 0.08
Nodes (21): BB, lesson, MCU_FACTS, R_RATING, SIG_AT, sigMinus, sigPlus, UNO_AT (+13 more)

### Community 129 - "inductor-rl.test.ts"
Cohesion: 0.08
Nodes (18): L, [METER, AMMETER, BURDEN, MID, TRUE_I], powered(), runFor(), [I_L, V_TOP, V_SW, P_R1, V_SW_PEAK], L, press(), release() (+10 more)

### Community 130 - "batteries.ts"
Cohesion: 0.13
Nodes (13): BAT_AT, BB, lesson, LOAD_AT, LOAD_RATING, METER_AT, snapMinus, snapPlus (+5 more)

### Community 131 - "power-heat.ts"
Cohesion: 0.14
Nodes (11): BB, lesson, METER_AT, PSU_AT, R1_RATING, r1Left, r1Right, wBbToGnd (+3 more)

### Community 132 - "LessonDef"
Cohesion: 0.13
Nodes (12): LessonDef, BB, bridge, fBlack, fRed, j1, j1Wrong, j2 (+4 more)

### Community 133 - "hc595.ts"
Cohesion: 0.16
Nodes (5): behavior, State, states, SpiDevice, SpiSettingsLike

### Community 134 - "inspector.ts"
Cohesion: 0.12
Nodes (25): BAND_HEX, BandColor, BandOptions, capacitorCode(), DIGIT_COLORS, parseOhms(), resistorBands(), sigExp() (+17 more)

### Community 135 - "store.ts"
Cohesion: 0.17
Nodes (22): setEffectsEnabled(), asCode(), asGuideSaves(), asProgress(), asSettings(), CameraView, clock(), debounce() (+14 more)

### Community 136 - "Lesson"
Cohesion: 0.03
Nodes (47): Circuit Atelier: Curriculum (T0–T3), File format, Rating conventions used throughout, Task E — Integration (after A–D are merged), Bench, BenchSnapshot, FailurePatch, Lesson (+39 more)

### Community 137 - "LogicAnalyzer.tsx"
Cohesion: 0.27
Nodes (14): capture(), draw(), Ink, LogicAnalyzer(), PROTOS, readInk(), View, asciiOf() (+6 more)

### Community 138 - "imu-mpu6050.test.ts"
Cohesion: 0.10
Nodes (9): complementaryTau(), imuLesson(), behavior, lesson, REG, behavior, parsePlotterLine(), lesson (+1 more)

### Community 139 - "BehaviorContext"
Cohesion: 0.04
Nodes (26): behavior, loads(), num(), onAt, behavior, clearAll(), State, state() (+18 more)

### Community 140 - "transformer.ts"
Cohesion: 0.09
Nodes (20): DMM_P, DMM_S, FUSE_AT, fuseL, fuseR, lesson, LOAD_AT, loadA (+12 more)

### Community 141 - "Driver"
Cohesion: 0.17
Nodes (3): Behaviors, Circuit, Driver

### Community 142 - "probe"
Cohesion: 0.14
Nodes (13): Board, Board, Board, Board, Board, Board, Batch 1 (no new engine features), Batch 2 (+5 more)

### Community 143 - "mosfet-switch.ts"
Cohesion: 0.09
Nodes (19): GND_PT, GND_TP, HEATER_AT, HEATER_D, HEATER_P, JACK, JACK_N, JACK_P (+11 more)

### Community 144 - "vitest"
Cohesion: 0.04
Nodes (22): vitest, lesson, lesson, lesson, reader, writer, kick(), dcLesson (+14 more)

### Community 145 - "I2cLines"
Cohesion: 0.23
Nodes (4): State, wire(), I2cLines, OpenDrain

### Community 146 - "wifi-sim.ts"
Cohesion: 0.05
Nodes (39): behavior, enterDownload(), leave(), num(), ROM_LINES, sample(), state(), states (+31 more)

### Community 147 - "layout.ts"
Cohesion: 0.09
Nodes (14): jumper(), lesson, SR_AT, TARGET_AT, UNO_AT, BEAT_PT, BEAT_R, GATE_PT (+6 more)

### Community 148 - "rlc-resonance.ts"
Cohesion: 0.12
Nodes (15): BB, cA, cB, GEN_AT, lA, lB, lesson, postMinus (+7 more)

### Community 149 - "decode.ts"
Cohesion: 0.33
Nodes (7): byteText(), decodeI2c(), decodeUart(), FrameKind, hex(), NAMES, DigitalWave

### Community 150 - "quad-encoder.ts"
Cohesion: 0.21
Nodes (10): Cfg, gap(), generate(), levelA(), levelB(), nAt(), pushEdge(), rand() (+2 more)

### Community 151 - "drc.ts"
Cohesion: 0.18
Nodes (16): closest(), cross(), DrcOptions, DrcRule, DrcViolation, f2(), markAt(), pointToTrace() (+8 more)

### Community 152 - "encoders.ts"
Cohesion: 0.10
Nodes (14): BAT, BAT_BLACK, BAT_RED, DIODE, ENC_AT, encPad(), HDR, lesson (+6 more)

### Community 153 - "mcu-supply.ts"
Cohesion: 0.22
Nodes (7): fMaxAt(), fresh(), minVccFor(), nodeSets, State, state(), states

### Community 154 - "createBench"
Cohesion: 0.07
Nodes (55): bench(), bench(), bench(), bench(), running(), Note, createBench(), build() (+47 more)

### Community 155 - "logic-analyzer.test.ts"
Cohesion: 0.29
Nodes (4): behavior, behavior, bench(), lesson()

### Community 156 - "EdgeTrace"
Cohesion: 0.22
Nodes (5): decodeSpi(), spiSampled(), spi(), spiByte(), EdgeTrace

### Community 157 - "Soldering and Rework"
Cohesion: 0.17
Nodes (11): For mechanical engineers, Learning goals, Meet the board, Pro tips, Quiz, Readouts, SIM NOTE, Sketch (+3 more)

### Community 159 - "PCA9685 Servo Driver"
Cohesion: 0.18
Nodes (10): For mechanical engineers, Learning goals, Meet the board, PCA9685 Servo Driver, Pro tips, Quiz, Readouts, Sketch (+2 more)

### Community 160 - "pin9"
Cohesion: 0.20
Nodes (10): Behaviors, Circuit, Board, Board, Behaviors, Board, Circuit, Sketch (+2 more)

### Community 161 - "edge-counter.ts"
Cohesion: 0.25
Nodes (4): behavior, State, states, lesson

### Community 162 - "quad-encoder.test.ts"
Cohesion: 0.25
Nodes (6): behavior, Edge, lockstep(), QEM, rig(), W()

### Community 163 - "j1"
Cohesion: 0.36
Nodes (8): Board, Circuit (key elements), Board, Circuit, j1(), j3(), onDk(), pinX()

### Community 165 - "hc74.ts"
Cohesion: 0.29
Nodes (5): behavior, clearAll(), State, state(), states

### Community 166 - "M4 — Digital, Sensors, Professional, Capstone (T3, T4 rest, T5 rest, T6 rest, T7)"
Cohesion: 0.50
Nodes (3): Engine features available, M4 — Digital, Sensors, Professional, Capstone (T3, T4 rest, T5 rest, T6 rest, T7), Order

### Community 167 - "pcbTour.ts"
Cohesion: 0.46
Nodes (6): TourView, tourView(), drcPill(), L, TourState, tourState()

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
Cohesion: 0.14
Nodes (12): BB, gnd, j1, LED_RATING, ledAnode, ledCathode, pin13, r1Left (+4 more)

### Community 172 - "hcsr04.ts"
Cohesion: 0.29
Nodes (10): disarm(), gauss(), has(), num(), ping(), rand(), soundSpeed(), State (+2 more)

### Community 173 - "irq-bounce.ts"
Cohesion: 0.29
Nodes (7): behavior, inject(), num(), rng(), State, states, valueOf()

### Community 176 - "capstone-balancing-robot.test.ts"
Cohesion: 0.38
Nodes (6): fallTime(), L, [PITCH, EST, , U, , , TRAVEL, VBAT, , FALLEN, POLE, , LOOP_HZ, HELD, , WOBBLE, RING], push(), runTo(), v()

### Community 177 - "M2 — Video lessons (parallel authors)"
Cohesion: 0.33
Nodes (5): After each batch, Batch 1 (shared behaviors land here first), Batch 2, M2 — Video lessons (parallel authors), Per-lesson task (the same for every author)

### Community 178 - "Failures"
Cohesion: 0.40
Nodes (5): F1: Cold joint on J2, F2: Solder bridge between pads D5 and D6, F3: Lifted pad on J3 (overheated during rework), F4: ESD zap on pin 6 (added in the build), Failures

### Community 179 - "Failures"
Cohesion: 0.33
Nodes (6): Authored notes (T6 build), F1: Cold morning, code still assumes 20 °C, F2: ECHO wire falls off, F3: A second ranger pinging at the same time, F4: 5 V ECHO into a 3.3 V microcontroller, Failures

### Community 180 - "trace-heat.ts"
Cohesion: 0.14
Nodes (22): behavior, behavior, cool(), num(), resistance(), State, state(), states (+14 more)

### Community 182 - "SIM NOTE"
Cohesion: 0.50
Nodes (4): Board, SIM NOTE, Servo, servo()

### Community 183 - "Menu.tsx"
Cohesion: 0.50
Nodes (3): MenuButton(), MenuButtonProps, MenuItem

### Community 184 - "Failures"
Cohesion: 0.40
Nodes (5): F1: Tired, high-resistance battery, F2: IMU mounted 3° off, F3: Right motor wired backwards, F4: Worn gearbox (4° backlash), Failures

### Community 185 - "a4988-stepper.ts"
Cohesion: 0.13
Nodes (8): HDR, JACK, JACK_N, JACK_P, lesson, MOT, UNO_AT, Wire

### Community 186 - "Load Cell and HX711"
Cohesion: 0.14
Nodes (13): Board, Circuit, Datasheet figures (checked), Failures, Guide (8 steps), `hx711` behavior, Learning goals, Load Cell and HX711 (+5 more)

### Community 187 - "Failures"
Cohesion: 0.50
Nodes (4): F1: Power the servos from the Uno's 5 V pin, F2: No common ground, F3: Breakout without I²C pull-ups, Failures

### Community 189 - "pcb-design-workflow.ts"
Cohesion: 0.16
Nodes (11): GND_VIA, LAYERS, lesson, LOAD_NEG, LOAD_POS, OUT_NEG, OUT_POS, PWR (+3 more)

### Community 191 - "Writing a lesson"
Cohesion: 0.11
Nodes (20): BoardDynamic, Fast switching transients (`sim.edgeSubsteps`), Guided steps (`lesson.guide`), Hand-soldered joints (`params.jointKey`), Instruments (`lesson.instruments`), Layout helpers (`layout.ts`), Moving boards (`board.dynamic`), Part inspector and `facts` (+12 more)

### Community 193 - "Element"
Cohesion: 0.07
Nodes (26): Constraints, Deliverables, M1 Task E — Integration: bench store, Board composer, behavior framework, first lesson, NetInfo, State, Fake, Dev, gateOut() (+18 more)

### Community 198 - "tmp36.ts"
Cohesion: 0.40
Nodes (5): apply(), behavior, tempOf(), TMP36_OFFSET_V, TMP36_V_PER_C

## Knowledge Gaps
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Lesson` connect `Lesson` to `inductor-rl.test.ts`, `inspector.ts`, `store.ts`, `LogicAnalyzer.tsx`, `imu-mpu6050.test.ts`, `BenchScene.tsx`, `getLesson`, `vitest`, `wifi-sim.ts`, `solder-joints.ts`, `PcbLayers.tsx`, `createBench`, `logic-analyzer.test.ts`, `edge-counter.ts`, `engine/types.ts`, `pcbTour.ts`, `ntc.ts`, `capstone-balancing-robot.test.ts`, `trace-heat.ts`, `pcb-design-workflow.ts`, `Element`, `Layout.tsx`, `Instruments.tsx`, `Thermal Design`, `thermal-network.test.ts`, `createBench`, `.snapshot`, `lessonSchema.ts`, `resistor-codes-divider.ts`, `Board.tsx`, `series-rlc.test.ts`, `hx711.ts`, `ne555.ts`, `AppState`?**
  _High betweenness centrality (0.102) - this node is a cross-community bridge._
- **Are the 8 inferred relationships involving `createBench()` (e.g. with `Decisions` and `Deliverables`) actually correct?**
  _`createBench()` has 8 INFERRED edges - model-reasoned connections that need verification._
- **Should `devices.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.04231974921630094 - nodes in this community are weakly interconnected._
- **Why does `Circuit Atelier: Curriculum (T0–T3)` connect `Lesson` to `Order and prerequisites`, `curriculum/README.md`, `V`?**
  _High betweenness centrality (0.085) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `Lesson` (e.g. with `Circuit Atelier: Curriculum (T0–T3)` and `File format`) actually correct?**
  _`Lesson` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Should `logic-gates.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `vitest` to `inductor-rl.test.ts`, `solve.ts`, `hc595.ts`, `sound.ts`, `store.ts`, `transpile.ts`, `package.json`, `imu-mpu6050.test.ts`, `Lesson`, `inspector.ts`, `BenchScene.tsx`, `getLesson`, `LogicAnalyzer.tsx`, `wifi-sim.ts`, `solder-joints.ts`, `transient.ts`, `drc.ts`, `PcbLayers.tsx`, `createBench`, `logic-analyzer.test.ts`, `EdgeTrace`, `tb6612.ts`, `edge-counter.ts`, `engine/types.ts`, `quad-encoder.test.ts`, `rlc-resonance.test.ts`, `pcbTour.ts`, `extensions.test.ts`, `VirtualMcu`, `ntc.ts`, `capstone-balancing-robot.test.ts`, `trace-heat.ts`, `pcb-design-workflow.ts`, `Writing a lesson`, `Element`, `Instruments.tsx`, `thermal-network.test.ts`, `Tweaks.tsx`, `pca9685.ts`, `createBench`, `.snapshot`, `pendulum.ts`, `lessonSchema.ts`, `resistor-codes-divider.ts`, `Board.tsx`, `three/index.ts`, `series-rlc.test.ts`, `ratings.ts`, `5. Virtual MCU (`src/engine/mcu`)`, `a4988.ts`, `ac-meter.ts`, `behaviors/l298n.ts`, `TryItYourself.tsx`, `hx711.ts`, `ne555.ts`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._