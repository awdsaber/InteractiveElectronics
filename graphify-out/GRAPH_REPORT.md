# Graph Report - Electonics Interactive course  (2026-11-06)

## Corpus Check
- 148 files · ~144,321 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 7 file(s) not represented in the graph (top: (none) 3, .css 3, .dot 1)

## Summary
- 1630 nodes · 2002 edges · 132 communities (104 shown, 28 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 72 edges (avg confidence: 0.91)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b1bc9f1f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- server.cjs
- types.ts
- Writing Skills
- writing-skills/SKILL.md
- subagent-driven-development/SKILL.md
- deploy.yml
- Test-Driven Development (TDD)
- Testing Skills With Subagents
- Executing Plans
- package.json
- Visual Companion Guide
- compilerOptions
- Session diagnosis: <session-id>
- Code Review Reception
- Testing CLAUDE.md Skills Documentation
- devDependencies
- compilerOptions
- Root Cause Tracing
- Systematic Debugging
- Persuasion Principles for Skill Design
- render-graphs.js
- Finishing a Development Branch
- Condition-Based Waiting
- Using Git Worktrees
- Dispatching Parallel Agents
- Defense-in-Depth Validation
- Writing Plans
- Brainstorming
- issue.md
- Verification Before Completion
- Skill structure
- helper.js
- Skill authoring best practices
- Advanced: Skills with executable code
- scripts
- App.tsx
- stop-server.sh
- Diagnosing Superpowers
- Superpowers session diagnosis bundle
- Case: <session-id>
- Hermes Agent Tool Mapping
- Muse Tool Mapping
- using-superpowers/SKILL.md
- .oxlintrc.json
- @vitejs/plugin-react
- GitHub issues
- Pi Tool Mapping
- Evaluation and iteration
- Checklist for effective Skills
- Common patterns
- Core principles
- React + TypeScript + Vite
- start-server.sh
- Antigravity CLI (`agy`) Tool Mapping
- Claude Code Tool Notes
- Anti-patterns to avoid
- Technical notes
- tsconfig.json
- builder-check-prompt.md
- context-safety.md
- redaction-policy.md
- session-discovery.md
- find-polluter.sh
- sound.ts
- ui/types.ts
- Layout.tsx
- Circuit Atelier — Spec
- Tweaks.tsx
- package.json
- ui/types.ts
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
- handleRequest
- startServer
- code-reviewer.md
- handleUpgrade
- Code Reviewer Prompt Template
- Subagent-Driven Development
- Circuit Atelier — interactive electronics course
- Requesting Code Review
- The Task Loop
- The Task Loop

## God Nodes (most connected - your core abstractions)
1. `VirtualMcu` - 31 edges
2. `Transpiler` - 24 edges
3. `Writing Skills` - 21 edges
4. `compilerOptions` - 18 edges
5. `Testing Skills With Subagents` - 16 edges
6. `TranspileError` - 15 edges
7. `compilerOptions` - 15 edges
8. `handleRequest()` - 14 edges
9. `transpile()` - 14 edges
10. `Layout()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `Circuit Atelier — interactive electronics course` --references--> `main()`  [INFERRED]
  CLAUDE.md → .claude/skills/writing-skills/render-graphs.js
- `5. Virtual MCU (`src/engine/mcu`)` --references--> `TranspileError`  [INFERRED]
  docs/spec.md → src/engine/mcu/transpile.ts
- `SIM NOTE` --references--> `VirtualMcu`  [INFERRED]
  docs/curriculum/T4/arduino-uno.md → src/engine/mcu/virtualMcu.ts
- `3. Lesson data model` --references--> `Element`  [INFERRED]
  docs/spec.md → src/engine/types.ts
- `SIM NOTE` --references--> `PinState`  [INFERRED]
  docs/curriculum/T5/pca9685-servo.md → src/engine/types.ts

## Import Cycles
- None detected.

## Communities (132 total, 28 thin omitted)

### Community 0 - "server.cjs"
Cohesion: 0.08
Nodes (24): brandMarkup(), clients, CONTENT_DIR, crypto, debounceTimers, escapeHtmlText(), frameTemplate, fs (+16 more)

### Community 1 - "types.ts"
Cohesion: 0.08
Nodes (22): Task E — Integration (after A–D are merged), 3. Lesson data model, Behavior, BehaviorContext, BoardSpec, BurnEvent, Element, ElementBase (+14 more)

### Community 2 - "Writing Skills"
Cohesion: 0.05
Nodes (39): Anti-Patterns, Bulletproofing Against Rationalization, Code Examples, ❌ Code in Flowcharts, Common Rationalizations for Skipping Testing, Directory Structure, Discipline-Enforcing Skills (rules/requirements), Discovery Workflow (+31 more)

### Community 3 - "writing-skills/SKILL.md"
Cohesion: 0.06
Nodes (29): Codex App Finishing, Environment Detection, Model routing on spawns, Subagent dispatch requires multi-agent support, Waiting on children, Additional Gemini CLI tools, Gemini CLI Tool Mapping, Instructions file (+21 more)

### Community 4 - "subagent-driven-development/SKILL.md"
Cohesion: 0.13
Nodes (7): Implementer Subagent Prompt Template, Batching Small Same-Shape Work, "Cannot Verify From Diff" Items, Handling a Report That Isn't DONE, The Pre-flight Scan, Resuming From an Existing Ledger, Task Reviewer Prompt Template

### Community 5 - "deploy.yml"
Cohesion: 0.06
Nodes (31): runs-on, steps, concurrency, cancel-in-progress, group, environment, needs, runs-on (+23 more)

### Community 6 - "Test-Driven Development (TDD)"
Cohesion: 0.06
Nodes (29): Common Rationalizations, Debugging Integration, Example: Bug Fix, Final Rule, Good Tests, GREEN - Minimal Code, Overview, Red Flags - STOP and Start Over (+21 more)

### Community 7 - "Testing Skills With Subagents"
Cohesion: 0.07
Nodes (29): 1. Explicit Negation in Rules, 2. Entry in Rationalization Table, 3. Red Flag Entry, 4. Update description, Common Mistakes (Same as TDD), Example: TDD Skill Bulletproofing, GREEN Phase: Write Minimal Skill (Make It Pass), Initial Test (Failed) (+21 more)

### Community 8 - "Executing Plans"
Cohesion: 0.29
Nodes (7): Common Rationalizations, Executing Plans, Final Review, Finish, Setup, The Process, When to Use

### Community 9 - "package.json"
Cohesion: 0.12
Nodes (16): dependencies, marked@^18.1.3, react@^19.3.1, react-dom@^19.3.1, @react-three/drei@^10.7.9, @react-three/fiber@^9.8.2, three@^0.187.0, zod@^4.6.7 (+8 more)

### Community 10 - "Visual Companion Guide"
Cohesion: 0.10
Nodes (19): Browser Events Format, Cards (visual designs), Cleaning Up, CSS Classes Available, Design Tips, File Naming, How It Works, Mock elements (wireframe building blocks) (+11 more)

### Community 11 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+11 more)

### Community 12 - "Session diagnosis: <session-id>"
Cohesion: 0.11
Nodes (18): 1. Problem statement (REQUIRED), 2. Triage verdict (REQUIRED), 3. Environment (REQUIRED), 4. Sessions examined (REQUIRED), 5. Timeline (REQUIRED), 6.1 Skill timeline, 6.2 Plan adherence, 6.3 Repeated work (+10 more)

### Community 13 - "Code Review Reception"
Cohesion: 0.12
Nodes (16): Acknowledging Correct Feedback, Code Review Reception, Common Mistakes, Forbidden Responses, From External Reviewers, From your human partner, GitHub Thread Replies, Gracefully Correcting Your Pushback (+8 more)

### Community 14 - "Testing CLAUDE.md Skills Documentation"
Cohesion: 0.12
Nodes (16): Documentation Variants to Test, Expected Results, Next Steps, NULL (Baseline - no skills doc), Scenario 1: Time Pressure + Confidence, Scenario 2: Sunk Cost + Works Already, Scenario 3: Authority + Speed Bias, Scenario 4: Familiarity + Efficiency (+8 more)

### Community 15 - "devDependencies"
Cohesion: 0.13
Nodes (15): devDependencies, jsdom@^31.0.0, oxlint@^1.90.0, @playwright/test@^1.65.0, @types/node@^24.19.2, @types/react-dom@^19.3.0, @types/three@^0.187.0, vite@^8.3.6 (+7 more)

### Community 16 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 17 - "Root Cause Tracing"
Cohesion: 0.12
Nodes (15): 1. Observe the Symptom, 2. Find Immediate Cause, 3. Ask: What Called This?, 4. Keep Tracing Up, 5. Find Original Trigger, Adding Stack Traces, Finding Which Test Causes Pollution, Key Principle (+7 more)

### Community 18 - "Systematic Debugging"
Cohesion: 0.12
Nodes (15): Common Rationalizations, Overview, Phase 1: Root Cause Investigation, Phase 2: Pattern Analysis, Phase 3: Hypothesis and Testing, Phase 4: Implementation, Quick Reference, Red Flags - STOP and Follow Process (+7 more)

### Community 19 - "Persuasion Principles for Skill Design"
Cohesion: 0.12
Nodes (15): 1. Authority, 2. Commitment, 3. Scarcity, 4. Social Proof, 5. Unity, 6. Reciprocity, 7. Liking, Ethical Use (+7 more)

### Community 20 - "render-graphs.js"
Cohesion: 0.39
Nodes (5): combineGraphs(), extractDotBlocks(), extractGraphBody(), main(), renderToSvg()

### Community 21 - "Finishing a Development Branch"
Cohesion: 0.13
Nodes (14): Common Rationalizations, Finishing a Development Branch, If your human partner asks to discard the work, Option 1: Merge Locally, Option 2: Push and Create PR, Option 3: Keep As-Is, Overview, Quick Reference (+6 more)

### Community 22 - "Condition-Based Waiting"
Cohesion: 0.15
Nodes (12): Common Mistakes, Condition-Based Waiting, Core Pattern, waitForEvent(), waitForEventCount(), waitForEventMatch(), Implementation, Overview (+4 more)

### Community 23 - "Using Git Worktrees"
Cohesion: 0.13
Nodes (14): 1a. Native Worktree Tools (preferred), 1b. Git Worktree Fallback, Common Rationalizations, Create the Worktree, Directory Selection, Overview, Quick Reference, Report (+6 more)

### Community 24 - "Dispatching Parallel Agents"
Cohesion: 0.14
Nodes (13): 1. Identify Independent Domains, 2. Create Focused Agent Tasks, 3. Dispatch in Parallel, 4. Review and Integrate, Agent Prompt Structure, Common Mistakes, Dispatching Parallel Agents, Overview (+5 more)

### Community 25 - "Defense-in-Depth Validation"
Cohesion: 0.17
Nodes (11): Applying the Pattern, Defense-in-Depth Validation, Example from Session, Key Insight, Layer 1: Entry Point Validation, Layer 2: Business Logic Validation, Layer 3: Environment Guards, Layer 4: Debug Instrumentation (+3 more)

### Community 26 - "Writing Plans"
Cohesion: 0.17
Nodes (11): Execution Handoff, File Structure, Overview, Plan Document Header, Scope Check, Self-Review, Step Granularity, Task Right-Sizing (+3 more)

### Community 27 - "Brainstorming"
Cohesion: 0.18
Nodes (10): Brainstorming, First: What Do You Actually Know?, Look Before You Ask, Play It Back, Red Flags, Size the Work, The Conversation, The Written Design (+2 more)

### Community 28 - "issue.md"
Cohesion: 0.20
Nodes (9): Actual behavior, Debug log or conversation transcript, Environment (required), Expected behavior, Human-authored summary (required, under 200 words), Is this a Superpowers issue or a platform issue?, Steps to reproduce, What happened? (+1 more)

### Community 29 - "Verification Before Completion"
Cohesion: 0.20
Nodes (9): Common Failures, Key Patterns, Overview, Rationalization Prevention, Red Flags - STOP, The Gate Function, The Iron Law, Verification Before Completion (+1 more)

### Community 30 - "Skill structure"
Cohesion: 0.20
Nodes (10): Avoid deeply nested references, Naming conventions, Pattern 1: High-level guide with references, Pattern 2: Domain-specific organization, Pattern 3: Conditional details, Progressive disclosure patterns, Skill structure, Structure longer reference files with table of contents (+2 more)

### Community 31 - "helper.js"
Cohesion: 0.42
Nodes (7): connect(), nextReconnectDelay(), reloadAfterRecovery(), sessionKey(), setStatus(), showTombstone(), websocketUrl()

### Community 32 - "Skill authoring best practices"
Cohesion: 0.22
Nodes (8): Avoid time-sensitive information, Content guidelines, Implement feedback loops, Next steps, Skill authoring best practices, Use consistent terminology, Use workflows for complex tasks, Workflows and feedback loops

### Community 33 - "Advanced: Skills with executable code"
Cohesion: 0.22
Nodes (9): Advanced: Skills with executable code, Avoid assuming tools are installed, Create verifiable intermediate outputs, MCP tool references, Package dependencies, Provide utility scripts, Runtime environment, Solve, don't punt (+1 more)

### Community 34 - "scripts"
Cohesion: 0.22
Nodes (9): scripts, build, dev, graph, lint, preview, test, test:e2e (+1 more)

### Community 35 - "App.tsx"
Cohesion: 0.25
Nodes (8): react, App(), lessonList, mockLesson, parts, tracks, setEffectsEnabled(), unlockAudio()

### Community 36 - "stop-server.sh"
Cohesion: 0.52
Nodes (6): command_has_server_id(), command_line_for_pid(), is_brainstorm_server(), mark_stopped(), read_expected_server_id(), stop-server.sh script

### Community 37 - "Diagnosing Superpowers"
Cohesion: 0.29
Nodes (6): Diagnosing Superpowers, Hard rules, Overview, Quick reference, Red Flags, Workflow

### Community 38 - "Superpowers session diagnosis bundle"
Cohesion: 0.29
Nodes (6): Files, How to read it, Producer instructions, Redaction, Superpowers session diagnosis bundle, What this is

### Community 39 - "Case: <session-id>"
Cohesion: 0.29
Nodes (6): Case: <session-id>, Context-safety rules for every reader of these files, Discovered sources and record meanings, Environment, Problem statement (agreed with your human partner), Sessions

### Community 40 - "Hermes Agent Tool Mapping"
Cohesion: 0.29
Nodes (6): Hermes Agent Tool Mapping, Instructions file, Invoking a skill, Subagent dispatch, Task tracking, Tools

### Community 41 - "Muse Tool Mapping"
Cohesion: 0.33
Nodes (5): Instructions file, Muse Tool Mapping, Skill invocation, Subagent dispatch, Task tracking

### Community 42 - "using-superpowers/SKILL.md"
Cohesion: 0.33
Nodes (5): Platform Adaptation, Red Flags, Skill Priority, The Rule, User Instructions

### Community 43 - ".oxlintrc.json"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 44 - "@vitejs/plugin-react"
Cohesion: 0.40
Nodes (4): @vitejs/plugin-react@^6.1.2, vitest@^5.1.0, @vitejs/plugin-react, vitest

### Community 45 - "GitHub issues"
Cohesion: 0.50
Nodes (3): File, GitHub issues, Search

### Community 46 - "Pi Tool Mapping"
Cohesion: 0.50
Nodes (3): Pi Tool Mapping, Subagents, Task lists

### Community 47 - "Evaluation and iteration"
Cohesion: 0.50
Nodes (4): Build evaluations first, Develop Skills iteratively with the agent, Evaluation and iteration, Observe how agents navigate Skills

### Community 48 - "Checklist for effective Skills"
Cohesion: 0.50
Nodes (4): Checklist for effective Skills, Code and scripts, Core quality, Testing

### Community 49 - "Common patterns"
Cohesion: 0.50
Nodes (4): Common patterns, Conditional workflow pattern, Examples pattern, Template pattern

### Community 50 - "Core principles"
Cohesion: 0.50
Nodes (4): Concise is key, Core principles, Set appropriate degrees of freedom, Test with all models you plan to use

### Community 51 - "React + TypeScript + Vite"
Cohesion: 0.50
Nodes (3): Expanding the Oxlint configuration, React Compiler, React + TypeScript + Vite

### Community 56 - "Anti-patterns to avoid"
Cohesion: 0.67
Nodes (3): Anti-patterns to avoid, Avoid offering too many options, Avoid Windows-style paths

### Community 57 - "Technical notes"
Cohesion: 0.67
Nodes (3): Technical notes, Token budgets, YAML frontmatter requirements

### Community 69 - "sound.ts"
Cohesion: 0.11
Nodes (32): Global constraints, M1 — Engine plan, Task A — Circuit simulator (`src/engine/sim/`), Task C — 3D look and parametric part library (`src/three/`), Task D — App shell, theme, controls and sound (`src/ui/`, `src/audio/`, `src/styles/`), Tasks A–D are independent and run in parallel worktrees. Task E integrates them., BASS, BEATS_PER_CHORD (+24 more)

### Community 81 - "ui/types.ts"
Cohesion: 0.31
Nodes (8): BenchActions(), BenchActionsProps, MenuButton(), MenuButtonProps, MenuItem, BenchAction, FailureChoice, PartChoice

### Community 82 - "Layout.tsx"
Cohesion: 0.19
Nodes (17): 6. Tracks (syllabus), Lesson, Track, TrackId, SettingChange, Layout(), LayoutProps, fig() (+9 more)

### Community 83 - "Circuit Atelier — Spec"
Cohesion: 0.25
Nodes (7): 1. Experience, 2. Visual identity (original), 4. Simulation engine (`src/engine/sim`), Bench actions, Circuit Atelier — Spec, Failures, Status panel

### Community 84 - "Tweaks.tsx"
Cohesion: 0.26
Nodes (11): SIM NOTE, SIM NOTE, FailurePatch, Tweak, PREFIXES, siLabel(), sliderToValue(), valueToSlider() (+3 more)

### Community 85 - "package.json"
Cohesion: 0.22
Nodes (8): @codemirror/lang-cpp@^6.0.3, @types/react@^19.3.0, name, private, type, version, @codemirror/lang-cpp, @types/react

### Community 86 - "ui/types.ts"
Cohesion: 0.23
Nodes (12): BenchStatus, Controls(), ControlsProps, Toggle(), StatusPanel(), StatusPanelProps, toneOf(), PaletteId (+4 more)

### Community 87 - "MeetTheBoard.tsx"
Cohesion: 0.25
Nodes (7): QuizItem, md(), MeetTheBoard(), MeetTheBoardProps, renderer, Quiz(), QuizProps

### Community 90 - "transpile.ts"
Cohesion: 0.07
Nodes (39): BUILTIN_NAMES, errorOf(), castPrefix(), charCode(), checkCompiles(), checkSemicolons(), CLOSE, COMPOUND (+31 more)

### Community 91 - "VirtualMcu"
Cohesion: 0.06
Nodes (32): Arduino Uno R3, Behaviors, Board, Circuit, F1: Drive a motor straight off pin 9, F2: Bypass the 220 Ω resistor, F3: Short 5 V to GND on the header, F4: Feed 12 V into the 5 V pin (+24 more)

### Community 92 - "virtualMcu.ts"
Cohesion: 0.06
Nodes (47): A0, A1, A2, A3, A4, A5, A6, A7 (+39 more)

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
Cohesion: 0.13
Nodes (14): Board, Circuit, F1: 47 Ω on 5 V, F2: Same resistor, supply turned up to 12 V, F3: Fit a 2 W resistor instead, Failures, For mechanical engineers, Learning goals (+6 more)

### Community 120 - "Series and Parallel"
Cohesion: 0.13
Nodes (14): Board, Circuit, F1: R3 goes open, F2: Solder bridge shorts the parallel pair, F3: Someone adds a 100 Ω resistor across R2, Failures, For mechanical engineers, Learning goals (+6 more)

### Community 121 - "Resistor Codes and Dividers"
Cohesion: 0.13
Nodes (14): Board, Circuit, F1: Hang a 1 kΩ sensor input on the output, F2: Bottom resistor drops out, F3: Misread band: yellow-violet-orange (47 kΩ) fitted, Failures, For mechanical engineers, Learning goals (+6 more)

### Community 122 - "handleRequest"
Cohesion: 0.18
Nodes (14): bootstrapPage(), getNewestScreen(), handleRequest(), isAuthorized(), isFullDocument(), isRegularFileInsideContentDir(), parseCookies(), pathnameOf() (+6 more)

### Community 123 - "startServer"
Cohesion: 0.16
Nodes (11): browserLauncherForPlatform(), chmodOwnerOnly(), companionUrl(), generateToken(), initialToken(), maybeOpenBrowser(), preferredPort(), randomPort() (+3 more)

### Community 124 - "code-reviewer.md"
Cohesion: 0.20
Nodes (4): Scoped Re-Review Prompt Template, Final Review and Finish, Finish, The Fix Loop

### Community 125 - "handleUpgrade"
Cohesion: 0.25
Nodes (8): broadcast(), computeAcceptKey(), decodeFrame(), encodeFrame(), handleMessage(), handleUpgrade(), isAllowedWebSocketOrigin(), touchActivity()

### Community 126 - "Code Reviewer Prompt Template"
Cohesion: 0.29
Nodes (7): Assessment, Code Reviewer Prompt Template, Important, Issues, Minor, Recommendations, Strengths

### Community 127 - "Subagent-Driven Development"
Cohesion: 0.29
Nodes (7): Common Rationalizations, Final Review, Model Selection, Setup, Subagent-Driven Development, The Process, When to Use

### Community 128 - "Circuit Atelier — interactive electronics course"
Cohesion: 0.33
Nodes (5): Circuit Atelier — interactive electronics course, Commands, Memory and context: graphify (use first), Rules, Workflow: superpowers skills (in `.claude/skills/`)

### Community 129 - "Requesting Code Review"
Cohesion: 0.33
Nodes (6): Common Rationalizations, Example, How to Request, Red Flags, Requesting Code Review, When to Request Review

### Community 130 - "The Task Loop"
Cohesion: 0.33
Nodes (6): 1. Dispatch the implementer, 2. Handle the report, 3. Review the task, 4. The fix loop, 5. Complete the task, The Task Loop

### Community 131 - "The Task Loop"
Cohesion: 0.40
Nodes (5): 1. Take the task, 2. Work the steps, 3. The completion contract, 4. Complete the task, The Task Loop

## Knowledge Gaps
- **1 isolated node(s):** `RFC-6455`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1090 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **28 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `@vitejs/plugin-react` to `sound.ts`, `Tweaks.tsx`, `package.json`, `transpile.ts`, `VirtualMcu`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `VirtualMcu` (e.g. with `SIM NOTE` and `5. Virtual MCU (`src/engine/mcu`)`) actually correct?**
  _`VirtualMcu` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `RFC-6455` to the rest of the system?**
  _1 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `server.cjs` be split into smaller, more focused modules?**
  _Cohesion score 0.07671957671957672 - nodes in this community are weakly interconnected._
- **Why does `VirtualMcu` connect `VirtualMcu` to `transpile.ts`, `virtualMcu.ts`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Should `types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07936507936507936 - nodes in this community are weakly interconnected._
- **Why does `react` connect `App.tsx` to `package.json`, `ui/types.ts`, `Layout.tsx`, `package.json`, `MeetTheBoard.tsx`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._