# Graph Report - Electonics Interactive course  (2026-11-06)

## Corpus Check
- 71 files · ~84,492 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 6 file(s) not represented in the graph (top: (none) 3, .css 3)

## Summary
- 984 nodes · 1344 edges · 57 communities (54 shown, 3 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 59 edges (avg confidence: 0.91)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `4059a32e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Logic Gates
- types.ts
- StatusPanel.tsx
- Toast.tsx
- TryItYourself.tsx
- deploy.yml
- package.json
- compilerOptions
- devDependencies
- compilerOptions
- scripts
- .oxlintrc.json
- @vitejs/plugin-react
- React + TypeScript + Vite
- tsconfig.json
- sound.ts
- ui/types.ts
- Layout.tsx
- Circuit Atelier — Spec
- package.json
- Controls.tsx
- MeetTheBoard.tsx
- @uiw/react-codemirror
- typescript@~7.0.2
- transpile.ts
- VirtualMcu
- virtualMcu.ts
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
2. `Transpiler` - 24 edges
3. `compilerOptions` - 18 edges
4. `TranspileError` - 15 edges
5. `compilerOptions` - 15 edges
6. `transpile()` - 14 edges
7. `Layout()` - 14 edges
8. `LED and Resistor` - 14 edges
9. `The Transistor Switch` - 14 edges
10. `Arduino Uno R3` - 14 edges

## Surprising Connections (you probably didn't know these)
- `Task B — Arduino transpiler and virtual MCU (`src/engine/mcu/`)` --references--> `constrain()`  [INFERRED]
  docs/plans/m1-engine.md → src/engine/mcu/runtime.ts
- `5. Virtual MCU (`src/engine/mcu`)` --references--> `constrain()`  [INFERRED]
  docs/spec.md → src/engine/mcu/runtime.ts
- `5. Virtual MCU (`src/engine/mcu`)` --references--> `TranspileError`  [INFERRED]
  docs/spec.md → src/engine/mcu/transpile.ts
- `SIM NOTE` --references--> `VirtualMcu`  [INFERRED]
  docs/curriculum/T4/arduino-uno.md → src/engine/mcu/virtualMcu.ts
- `3. Lesson data model` --references--> `Element`  [INFERRED]
  docs/spec.md → src/engine/types.ts

## Import Cycles
- None detected.

## Communities (57 total, 3 thin omitted)

### Community 0 - "Logic Gates"
Cohesion: 0.12
Nodes (15): Board, Circuit, F1: Forget the pull-down on input A, F2: Short the output to ground, F3: Run the discrete gate from 3 V, Failures, For mechanical engineers, Learning goals (+7 more)

### Community 1 - "types.ts"
Cohesion: 0.08
Nodes (21): Task E — Integration (after A–D are merged), 3. Lesson data model, Behavior, BehaviorContext, BoardSpec, BurnEvent, Element, ElementBase (+13 more)

### Community 2 - "StatusPanel.tsx"
Cohesion: 0.60
Nodes (4): StatusPanel(), StatusPanelProps, toneOf(), ReadoutView

### Community 3 - "Toast.tsx"
Cohesion: 0.60
Nodes (4): Item(), Toast(), ToastProps, ToastMessage

### Community 4 - "TryItYourself.tsx"
Cohesion: 0.67
Nodes (3): Sketch, TryItYourself(), TryItYourselfProps

### Community 5 - "deploy.yml"
Cohesion: 0.06
Nodes (31): runs-on, steps, concurrency, cancel-in-progress, group, environment, needs, runs-on (+23 more)

### Community 9 - "package.json"
Cohesion: 0.12
Nodes (16): dependencies, marked@^18.1.3, react@^19.3.1, react-dom@^19.3.1, @react-three/drei@^10.7.9, @react-three/fiber@^9.8.2, three@^0.187.0, zod@^4.6.7 (+8 more)

### Community 11 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+11 more)

### Community 15 - "devDependencies"
Cohesion: 0.13
Nodes (15): devDependencies, jsdom@^31.0.0, oxlint@^1.90.0, @playwright/test@^1.65.0, @types/node@^24.19.2, @types/react-dom@^19.3.0, @types/three@^0.187.0, vite@^8.3.6 (+7 more)

### Community 16 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 34 - "scripts"
Cohesion: 0.22
Nodes (9): scripts, build, dev, graph, lint, preview, test, test:e2e (+1 more)

### Community 43 - ".oxlintrc.json"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 44 - "@vitejs/plugin-react"
Cohesion: 0.40
Nodes (4): @vitejs/plugin-react@^6.1.2, vitest@^5.1.0, @vitejs/plugin-react, vitest

### Community 51 - "React + TypeScript + Vite"
Cohesion: 0.50
Nodes (3): Expanding the Oxlint configuration, React Compiler, React + TypeScript + Vite

### Community 69 - "sound.ts"
Cohesion: 0.08
Nodes (40): Global constraints, M1 — Engine plan, Task A — Circuit simulator (`src/engine/sim/`), Task C — 3D look and parametric part library (`src/three/`), Task D — App shell, theme, controls and sound (`src/ui/`, `src/audio/`, `src/styles/`), Tasks A–D are independent and run in parallel worktrees. Task E integrates them., react, App() (+32 more)

### Community 81 - "ui/types.ts"
Cohesion: 0.28
Nodes (10): BenchStatus, BenchActions(), BenchActionsProps, MenuButton(), MenuButtonProps, MenuItem, BenchAction, FailureChoice (+2 more)

### Community 82 - "Layout.tsx"
Cohesion: 0.24
Nodes (13): Lesson, Track, TrackId, SettingChange, Layout(), LayoutProps, Quiz(), fig() (+5 more)

### Community 83 - "Circuit Atelier — Spec"
Cohesion: 0.22
Nodes (8): 1. Experience, 2. Visual identity (original), 4. Simulation engine (`src/engine/sim`), 6. Tracks (syllabus), Bench actions, Circuit Atelier — Spec, Failures, Status panel

### Community 85 - "package.json"
Cohesion: 0.22
Nodes (8): @codemirror/lang-cpp@^6.0.3, @types/react@^19.3.0, name, private, type, version, @codemirror/lang-cpp, @types/react

### Community 86 - "Controls.tsx"
Cohesion: 0.38
Nodes (6): Controls(), ControlsProps, Toggle(), PaletteId, PALETTES, Settings

### Community 87 - "MeetTheBoard.tsx"
Cohesion: 0.50
Nodes (4): md(), MeetTheBoard(), MeetTheBoardProps, renderer

### Community 90 - "transpile.ts"
Cohesion: 0.07
Nodes (39): BUILTIN_NAMES, errorOf(), castPrefix(), charCode(), checkCompiles(), checkSemicolons(), CLOSE, COMPOUND (+31 more)

### Community 91 - "VirtualMcu"
Cohesion: 0.06
Nodes (31): Arduino Uno R3, Behaviors, Board, Circuit, F1: Drive a motor straight off pin 9, F2: Bypass the 220 Ω resistor, F3: Short 5 V to GND on the header, F4: Feed 12 V into the 5 V pin (+23 more)

### Community 92 - "virtualMcu.ts"
Cohesion: 0.06
Nodes (48): A0, A1, A2, A3, A4, A5, A6, A7 (+40 more)

### Community 93 - "A4988 Stepper Driver"
Cohesion: 0.10
Nodes (19): A4988 Stepper Driver, Behaviors, Board, Circuit, F1: No current limit (trimmer at the stop), F2: Unplug the motor while powered, F3: MS wires fall off, Failures (+11 more)

### Community 94 - "The Transistor Switch"
Cohesion: 0.11
Nodes (18): Board, Circuit, F1: Remove the flyback diode, F2: Skip the base resistor, F3: Stall the motor, F4: Forget the common ground, Failures, For mechanical engineers (+10 more)

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
Cohesion: 0.12
Nodes (15): Board, Circuit, F1: Short the secondary, F2: Overload: 6 Ω instead of 12 Ω, F3: Unload it, Failures, For mechanical engineers, Learning goals (+7 more)

### Community 114 - "Diodes and Rectifiers"
Cohesion: 0.12
Nodes (15): Board, Circuit, Diodes and Rectifiers, F1: One diode goes open, F2: Leave out the smoothing capacitor, F3: A diode fails short, Failures, For mechanical engineers (+7 more)

### Community 115 - "Op-Amp Basics"
Cohesion: 0.12
Nodes (15): Board, Circuit, F1: Feedback resistor drops out, F2: Too much gain (R_F = 1 MΩ), F3: Inputs swapped, Failures, For mechanical engineers, Learning goals (+7 more)

### Community 116 - "Linear and Buck Regulators"
Cohesion: 0.12
Nodes (15): Board, Circuit, F1: Ask the linear regulator for 1 A, F2: Feed it only 6 V (dropout), F3: Switch to a 24 V supply, Failures, For mechanical engineers, Learning goals (+7 more)

### Community 117 - "The Zener Regulator"
Cohesion: 0.12
Nodes (15): Board, Circuit, F1: Plug in a 15 V adapter, F2: Ask for too much current (100 Ω load), F3: Zener fitted backwards, Failures, For mechanical engineers, Learning goals (+7 more)

### Community 118 - "Interrupts and Timers"
Cohesion: 0.12
Nodes (15): Board, F1: Remove the debounce capacitor, F2: Leave out the tach pull-up, F3: Spin the wheel at 300 kHz, Failures, For mechanical engineers, Interrupts and Timers, Learning goals (+7 more)

### Community 119 - "Power and Heat"
Cohesion: 0.10
Nodes (25): Board, Circuit, F1: 47 Ω on 5 V, F2: Same resistor, supply turned up to 12 V, F3: Fit a 2 W resistor instead, Failures, For mechanical engineers, Learning goals (+17 more)

### Community 120 - "Series and Parallel"
Cohesion: 0.13
Nodes (14): Board, Circuit, F1: R3 goes open, F2: Solder bridge shorts the parallel pair, F3: Someone adds a 100 Ω resistor across R2, Failures, For mechanical engineers, Learning goals (+6 more)

### Community 121 - "Resistor Codes and Dividers"
Cohesion: 0.13
Nodes (14): Board, Circuit, F1: Hang a 1 kΩ sensor input on the output, F2: Bottom resistor drops out, F3: Misread band: yellow-violet-orange (47 kΩ) fitted, Failures, For mechanical engineers, Learning goals (+6 more)

### Community 128 - "Circuit Atelier — interactive electronics course"
Cohesion: 0.33
Nodes (5): Circuit Atelier — interactive electronics course, Commands, Memory and context: graphify (use first), Rules, Workflow: superpowers skills (in `.claude/skills/`)

## Knowledge Gaps
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `VirtualMcu` connect `VirtualMcu` to `transpile.ts`, `virtualMcu.ts`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `VirtualMcu` (e.g. with `SIM NOTE` and `5. Virtual MCU (`src/engine/mcu`)`) actually correct?**
  _`VirtualMcu` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `Logic Gates` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `@vitejs/plugin-react` to `sound.ts`, `package.json`, `Power and Heat`, `transpile.ts`, `VirtualMcu`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Should `types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08262108262108261 - nodes in this community are weakly interconnected._
- **Why does `FailurePatch` connect `Power and Heat` to `types.ts`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Should `deploy.yml` be split into smaller, more focused modules?**
  _Cohesion score 0.06451612903225806 - nodes in this community are weakly interconnected._