# Graph Report - agent-a487db57025a1c52e  (2026-11-07)

## Corpus Check
- 122 files · ~94,195 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 6 file(s) not represented in the graph (top: (none) 4, .dot 1, .css 1)

## Summary
- 1242 nodes · 2350 edges · 115 communities (86 shown, 29 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 21 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `6e9769f5`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- server.cjs
- engine/types.ts
- Writing Skills
- Skill Discovery Optimization (SDO)
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
- boards.tsx
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
- InkMesh
- main.tsx
- stop-server.sh
- Diagnosing Superpowers
- Superpowers session diagnosis bundle
- Case: <session-id>
- Hermes Agent Tool Mapping
- Muse Tool Mapping
- using-superpowers/SKILL.md
- .oxlintrc.json
- passives.tsx
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
- wobble.ts
- motion.tsx
- semis.tsx
- connectors.tsx
- Gallery.tsx
- misc.tsx
- footprints.ts
- three/index.ts
- common.tsx
- handleRequest
- startServer
- ink.tsx
- textures.ts
- frame.tsx
- code-reviewer.md
- Circuit Atelier — Spec
- Pcb.tsx
- IsoCamera.tsx
- handleUpgrade
- Gemini CLI Tool Mapping
- Bulletproofing Skills Against Rationalization
- Code Reviewer Prompt Template
- Subagent-Driven Development
- REFACTOR Phase: Close Loopholes (Stay Green)
- Circuit Atelier — interactive electronics course
- Requesting Code Review
- The Task Loop
- codex-tools.md
- PartPlacement
- The Task Loop
- writing-skills/SKILL.md
- VERIFY GREEN: Pressure Testing
- Example: TDD Skill Bulletproofing
- Behavior
- BehaviorContext

## God Nodes (most connected - your core abstractions)
1. `InkMesh()` - 59 edges
2. `geo()` - 44 edges
3. `str()` - 43 edges
4. `Block()` - 41 edges
5. `num()` - 39 edges
6. `Decal()` - 30 edges
7. `InkInstances()` - 28 edges
8. `Marking()` - 28 edges
9. `UnoModule()` - 23 edges
10. `Writing Skills` - 21 edges

## Surprising Connections (you probably didn't know these)
- `Circuit Atelier — interactive electronics course` --references--> `main()`  [INFERRED]
  CLAUDE.md → .claude/skills/writing-skills/render-graphs.js
- `3. Lesson data model` --references--> `Element`  [INFERRED]
  docs/spec.md → src/engine/types.ts
- `3. Lesson data model` --references--> `Lesson`  [INFERRED]
  docs/spec.md → src/engine/types.ts
- `3. Lesson data model` --references--> `smd()`  [INFERRED]
  docs/spec.md → src/three/parts/footprints.ts
- `Decisions` --references--> `PartRenderState`  [INFERRED]
  docs/decisions.md → src/three/parts/types.ts

## Import Cycles
- None detected.

## Communities (115 total, 29 thin omitted)

### Community 0 - "server.cjs"
Cohesion: 0.08
Nodes (24): brandMarkup(), clients, CONTENT_DIR, crypto, debounceTimers, escapeHtmlText(), frameTemplate, fs (+16 more)

### Community 1 - "engine/types.ts"
Cohesion: 0.09
Nodes (21): BenchStatus, BurnEvent, ElementBase, ElementType, FailurePatch, FailureScenario, LedColor, Mount (+13 more)

### Community 2 - "Writing Skills"
Cohesion: 0.05
Nodes (39): Anti-Patterns, Bulletproofing Against Rationalization, Code Examples, ❌ Code in Flowcharts, Common Rationalizations for Skipping Testing, Directory Structure, Discipline-Enforcing Skills (rules/requirements), Discovery Workflow (+31 more)

### Community 3 - "Skill Discovery Optimization (SDO)"
Cohesion: 0.22
Nodes (8): 1. Rich Description Field, 2. Keyword Coverage, 3. Descriptive Naming, 4. Token Efficiency (Critical), 5. Cross-Referencing Other Skills, Skill Discovery Optimization (SDO), SKILL.md Structure, Writing SKILL.md for Discovery

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
Cohesion: 0.15
Nodes (13): Common Mistakes (Same as TDD), GREEN Phase: Write Minimal Skill (Make It Pass), Meta-Testing (When GREEN Isn't Working), Overview, Quick Reference (TDD Cycle), Real-World Impact, RED Phase: Baseline Testing (Watch It Fail), TDD Mapping for Skill Testing (+5 more)

### Community 8 - "Executing Plans"
Cohesion: 0.29
Nodes (7): Common Rationalizations, Executing Plans, Final Review, Finish, Setup, The Process, When to Use

### Community 9 - "package.json"
Cohesion: 0.05
Nodes (51): dependencies, @codemirror/lang-cpp@^6.0.3, marked@^18.1.3, react@^19.3.1, react-dom@^19.3.1, three@^0.187.0, @uiw/react-codemirror@^4.25.12, zod@^4.6.7 (+43 more)

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

### Community 15 - "boards.tsx"
Cohesion: 0.05
Nodes (73): Decisions, Art, At(), boardArt(), BoardSlab(), Breadboard, breadboardArt(), BreadboardBody() (+65 more)

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

### Community 34 - "InkMesh"
Cohesion: 0.22
Nodes (30): InkInstances(), InkMesh(), useLookMaterial(), LoadCellBody(), UltrasonicBody(), WifiModuleBody(), Block(), CylZ() (+22 more)

### Community 35 - "main.tsx"
Cohesion: 0.33
Nodes (4): react, App(), Gallery, showGallery

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

### Community 44 - "passives.tsx"
Cohesion: 0.17
Nodes (23): BAND_HEX, BandColor, BandOptions, capacitorCode(), DIGIT_COLORS, parseOhms(), resistorBands(), sigExp() (+15 more)

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

### Community 69 - "wobble.ts"
Cohesion: 0.11
Nodes (22): cache, CHAR, charColor(), InkLook, inkMaterial(), tmp, toonGradient(), applyWobble() (+14 more)

### Community 81 - "motion.tsx"
Cohesion: 0.17
Nodes (20): three, BenchBase(), gridTile(), rulerStrip(), cache, chamferRectShape(), extrudeAlongX(), extrudeUp() (+12 more)

### Community 82 - "semis.tsx"
Cohesion: 0.17
Nodes (23): extrudeAlongZ(), geo(), mergedBoxes(), ledLook(), loadCellGeo(), GlowHalo(), InductorBody(), toroidCoreGeo() (+15 more)

### Community 83 - "connectors.tsx"
Cohesion: 0.14
Nodes (23): stadiumShape(), InkInstance, HeaderFemaleBody(), HeaderMaleBody(), microGeo(), microMouthGeo(), microShape(), MicroUsbBody() (+15 more)

### Community 84 - "Gallery.tsx"
Cohesion: 0.12
Nodes (20): PartKind, btn, Check(), ENTRIES, Entry, Gallery(), GalleryControls, layout() (+12 more)

### Community 85 - "misc.tsx"
Cohesion: 0.17
Nodes (19): lathe(), wireColor(), BoxC(), deg(), Rod(), handleGeo(), LogicIcLabel, loopGeo() (+11 more)

### Community 86 - "footprints.ts"
Cohesion: 0.16
Nodes (17): CHIP_SIZES, DipGeom, electroSize(), Footprint, footprint(), FRONT, FRONT_KINDS, Pad (+9 more)

### Community 87 - "three/index.ts"
Cohesion: 0.22
Nodes (15): BenchBaseProps, Callout(), CalloutProps, CalloutTone, TONE, Vec3, ACCENT, INK (+7 more)

### Community 88 - "common.tsx"
Cohesion: 0.20
Nodes (16): C, BoxInstances(), Common, CylY(), Facing, FACING_ROT, LeadPath(), Leg() (+8 more)

### Community 89 - "handleRequest"
Cohesion: 0.18
Nodes (14): bootstrapPage(), getNewestScreen(), handleRequest(), isAuthorized(), isFullDocument(), isRegularFileInsideContentDir(), parseCookies(), pathnameOf() (+6 more)

### Community 90 - "startServer"
Cohesion: 0.16
Nodes (11): browserLauncherForPlatform(), chmodOwnerOnly(), companionUrl(), generateToken(), initialToken(), maybeOpenBrowser(), preferredPort(), randomPort() (+3 more)

### Community 91 - "ink.tsx"
Cohesion: 0.15
Nodes (13): @react-three/fiber@^9.8.2, @react-three/fiber, outlineGeometry(), GroupProps, HullHost, INK_PX, InkHull(), InkInstancesProps (+5 more)

### Community 92 - "textures.ts"
Cohesion: 0.27
Nodes (12): afterFonts(), drawnCache, drawText(), glowTexture(), makeCanvas(), MONO, SERIF, textCache (+4 more)

### Community 93 - "frame.tsx"
Cohesion: 0.29
Nodes (9): InkContext, definePart(), Part(), filletWedge(), SolderJoints(), partPosition(), SHADES, Smoke() (+1 more)

### Community 94 - "code-reviewer.md"
Cohesion: 0.20
Nodes (4): Scoped Re-Review Prompt Template, Final Review and Finish, Finish, The Fix Loop

### Community 95 - "Circuit Atelier — Spec"
Cohesion: 0.20
Nodes (9): 1. Experience, 2. Visual identity (original), 4. Simulation engine (`src/engine/sim`), 5. Virtual MCU (`src/engine/mcu`), 6. Tracks (syllabus), Bench actions, Circuit Atelier — Spec, Failures (+1 more)

### Community 96 - "Pcb.tsx"
Cohesion: 0.36
Nodes (9): BoardSpec, DEFAULT_PCB, drawPad(), drawPcbArt(), mix(), Pcb(), PcbProps, roundRectPath() (+1 more)

### Community 97 - "IsoCamera.tsx"
Cohesion: 0.25
Nodes (7): @react-three/drei@^10.7.9, @react-three/drei, ISO_AZIMUTH_DEG, ISO_ELEVATION_DEG, IsoCamera(), IsoCameraProps, isoPosition()

### Community 98 - "handleUpgrade"
Cohesion: 0.25
Nodes (8): broadcast(), computeAcceptKey(), decodeFrame(), encodeFrame(), handleMessage(), handleUpgrade(), isAllowedWebSocketOrigin(), touchActivity()

### Community 99 - "Gemini CLI Tool Mapping"
Cohesion: 0.25
Nodes (7): Additional Gemini CLI tools, Gemini CLI Tool Mapping, Instructions file, Parallel dispatch, Personal skills directory, Prompt filling, Subagent support

### Community 100 - "Bulletproofing Skills Against Rationalization"
Cohesion: 0.25
Nodes (7): Address "Spirit vs Letter" Arguments, Build Rationalization Table, Bulletproofing Skills Against Rationalization, Bulletproofing Skills Against Rationalization, Close Every Loophole Explicitly, Create Red Flags List, Update SDO for Violation Symptoms

### Community 101 - "Code Reviewer Prompt Template"
Cohesion: 0.29
Nodes (7): Assessment, Code Reviewer Prompt Template, Important, Issues, Minor, Recommendations, Strengths

### Community 102 - "Subagent-Driven Development"
Cohesion: 0.29
Nodes (7): Common Rationalizations, Final Review, Model Selection, Setup, Subagent-Driven Development, The Process, When to Use

### Community 103 - "REFACTOR Phase: Close Loopholes (Stay Green)"
Cohesion: 0.29
Nodes (7): 1. Explicit Negation in Rules, 2. Entry in Rationalization Table, 3. Red Flag Entry, 4. Update description, Plugging Each Hole, Re-verify After Refactoring, REFACTOR Phase: Close Loopholes (Stay Green)

### Community 104 - "Circuit Atelier — interactive electronics course"
Cohesion: 0.33
Nodes (5): Circuit Atelier — interactive electronics course, Commands, Memory and context: graphify (use first), Rules, Workflow: superpowers skills (in `.claude/skills/`)

### Community 105 - "Requesting Code Review"
Cohesion: 0.33
Nodes (6): Common Rationalizations, Example, How to Request, Red Flags, Requesting Code Review, When to Request Review

### Community 106 - "The Task Loop"
Cohesion: 0.33
Nodes (6): 1. Dispatch the implementer, 2. Handle the report, 3. Review the task, 4. The fix loop, 5. Complete the task, The Task Loop

### Community 107 - "codex-tools.md"
Cohesion: 0.33
Nodes (5): Codex App Finishing, Environment Detection, Model routing on spawns, Subagent dispatch requires multi-agent support, Waiting on children

### Community 108 - "PartPlacement"
Cohesion: 0.33
Nodes (6): 3. Lesson data model, Element, Lesson, PartPlacement, tht(), PartMeta

### Community 109 - "The Task Loop"
Cohesion: 0.40
Nodes (5): 1. Take the task, 2. Work the steps, 3. The completion contract, 4. Complete the task, The Task Loop

### Community 111 - "VERIFY GREEN: Pressure Testing"
Cohesion: 0.40
Nodes (5): Key Elements of Good Scenarios, Pressure Types, Testing Setup, VERIFY GREEN: Pressure Testing, Writing Pressure Scenarios

### Community 112 - "Example: TDD Skill Bulletproofing"
Cohesion: 0.50
Nodes (4): Example: TDD Skill Bulletproofing, Initial Test (Failed), Iteration 1 - Add Counter, Iteration 2 - Add Foundational Principle

## Knowledge Gaps
- **1 isolated node(s):** `RFC-6455`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 650 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **29 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `three` connect `motion.tsx` to `Pcb.tsx`, `IsoCamera.tsx`, `wobble.ts`, `package.json`, `passives.tsx`, `boards.tsx`, `semis.tsx`, `connectors.tsx`, `misc.tsx`, `common.tsx`, `ink.tsx`, `textures.ts`, `frame.tsx`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **What connects `RFC-6455` to the rest of the system?**
  _1 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `server.cjs` be split into smaller, more focused modules?**
  _Cohesion score 0.07671957671957672 - nodes in this community are weakly interconnected._
- **Why does `react` connect `main.tsx` to `Pcb.tsx`, `IsoCamera.tsx`, `package.json`, `boards.tsx`, `motion.tsx`, `Gallery.tsx`, `common.tsx`, `ink.tsx`, `textures.ts`, `frame.tsx`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Should `engine/types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09090909090909091 - nodes in this community are weakly interconnected._
- **Why does `3. Lesson data model` connect `PartPlacement` to `footprints.ts`, `Circuit Atelier — Spec`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **Should `Writing Skills` be split into smaller, more focused modules?**
  _Cohesion score 0.05128205128205128 - nodes in this community are weakly interconnected._