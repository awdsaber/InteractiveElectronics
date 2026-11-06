# Graph Report - agent-a998eaa8a4824903b  (2026-11-06)

## Corpus Check
- 105 files · ~78,192 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 6 file(s) not represented in the graph (top: (none) 4, .dot 1, .css 1)

## Summary
- 987 nodes · 1202 edges · 83 communities (56 shown, 27 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 21 edges (avg confidence: 0.91)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ab8500ef`
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
- main.tsx
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
- devices.ts
- Circuit Atelier — Spec
- package.json

## God Nodes (most connected - your core abstractions)
1. `stampDevice()` - 23 edges
2. `Writing Skills` - 21 edges
3. `compilerOptions` - 18 edges
4. `Testing Skills With Subagents` - 16 edges
5. `compilerOptions` - 15 edges
6. `handleRequest()` - 14 edges
7. `Code Review Reception` - 14 edges
8. `measureDevice()` - 13 edges
9. `Test-Driven Development (TDD)` - 13 edges
10. `Netlist` - 12 edges

## Surprising Connections (you probably didn't know these)
- `Task A — Circuit simulator (`src/engine/sim/`)` --references--> `checkRatings()`  [INFERRED]
  docs/plans/m1-engine.md → src/engine/sim/ratings.ts
- `3. Lesson data model` --references--> `Element`  [INFERRED]
  docs/spec.md → src/engine/types.ts
- `Circuit Atelier — interactive electronics course` --references--> `main()`  [INFERRED]
  CLAUDE.md → .claude/skills/writing-skills/render-graphs.js
- `Task A — Circuit simulator (`src/engine/sim/`)` --references--> `formatSI()`  [INFERRED]
  docs/plans/m1-engine.md → src/engine/sim/format.ts
- `Task C — 3D look and parametric part library (`src/three/`)` --references--> `PartKind`  [INFERRED]
  docs/plans/m1-engine.md → src/engine/types.ts

## Import Cycles
- None detected.

## Communities (83 total, 27 thin omitted)

### Community 0 - "server.cjs"
Cohesion: 0.05
Nodes (57): bootstrapPage(), brandMarkup(), broadcast(), browserLauncherForPlatform(), chmodOwnerOnly(), clients, companionUrl(), computeAcceptKey() (+49 more)

### Community 1 - "types.ts"
Cohesion: 0.05
Nodes (59): vitest, captureState(), compile(), Compiled, DynState, StampCtx, applyBurn(), applyPatches() (+51 more)

### Community 2 - "Writing Skills"
Cohesion: 0.05
Nodes (39): Anti-Patterns, Bulletproofing Against Rationalization, Code Examples, ❌ Code in Flowcharts, Common Rationalizations for Skipping Testing, Directory Structure, Discipline-Enforcing Skills (rules/requirements), Discovery Workflow (+31 more)

### Community 3 - "writing-skills/SKILL.md"
Cohesion: 0.06
Nodes (29): Codex App Finishing, Environment Detection, Model routing on spawns, Subagent dispatch requires multi-agent support, Waiting on children, Additional Gemini CLI tools, Gemini CLI Tool Mapping, Instructions file (+21 more)

### Community 4 - "subagent-driven-development/SKILL.md"
Cohesion: 0.06
Nodes (24): Implementer Subagent Prompt Template, Scoped Re-Review Prompt Template, Batching Small Same-Shape Work, "Cannot Verify From Diff" Items, Final Review and Finish, Finish, The Fix Loop, Handling a Report That Isn't DONE (+16 more)

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
Cohesion: 0.07
Nodes (25): 1. Take the task, 2. Work the steps, 3. The completion contract, 4. Complete the task, Common Rationalizations, Executing Plans, Final Review, Finish (+17 more)

### Community 9 - "package.json"
Cohesion: 0.13
Nodes (15): dependencies, @codemirror/lang-cpp@^6.0.3, marked@^18.1.3, @react-three/drei@^10.7.9, @react-three/fiber@^9.8.2, three@^0.187.0, zod@^4.6.7, zustand@^5.1.0 (+7 more)

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
Cohesion: 0.12
Nodes (16): devDependencies, oxlint@^1.90.0, @playwright/test@^1.65.0, @types/node@^24.19.2, @types/react@^19.3.0, @types/react-dom@^19.3.0, @types/three@^0.187.0, vite@^8.3.6 (+8 more)

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
Cohesion: 0.19
Nodes (10): Circuit Atelier — interactive electronics course, Commands, Memory and context: graphify (use first), Rules, combineGraphs(), extractDotBlocks(), extractGraphBody(), main() (+2 more)

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

### Community 35 - "main.tsx"
Cohesion: 0.29
Nodes (5): react@^19.3.1, react-dom@^19.3.1, react, react-dom, App()

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

### Community 69 - "devices.ts"
Cohesion: 0.06
Nodes (62): BJT_BETA, BJT_BETA_R, BJT_IS, BjtEval, bjtEval(), bjtSetup(), branchCount(), Dev (+54 more)

### Community 81 - "Circuit Atelier — Spec"
Cohesion: 0.07
Nodes (27): Global constraints, M1 — Engine plan, Task A — Circuit simulator (`src/engine/sim/`), Task B — Arduino transpiler and virtual MCU (`src/engine/mcu/`), Task C — 3D look and parametric part library (`src/three/`), Task D — App shell, theme, controls and sound (`src/ui/`, `src/audio/`, `src/styles/`), Task E — Integration (after A–D are merged), Tasks A–D are independent and run in parallel worktrees. Task E integrates them. (+19 more)

### Community 82 - "package.json"
Cohesion: 0.18
Nodes (10): @uiw/react-codemirror@^4.25.12, jsdom@^31.0.0, typescript@~7.0.2, name, private, type, version, jsdom (+2 more)

## Knowledge Gaps
- **1 isolated node(s):** `RFC-6455`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 634 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **27 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `types.ts` to `Circuit Atelier — Spec`, `package.json`, `@vitejs/plugin-react`, `devDependencies`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **What connects `RFC-6455` to the rest of the system?**
  _1 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `server.cjs` be split into smaller, more focused modules?**
  _Cohesion score 0.05257936507936508 - nodes in this community are weakly interconnected._
- **Why does `Writing Skills` connect `Writing Skills` to `writing-skills/SKILL.md`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **Should `types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05063291139240506 - nodes in this community are weakly interconnected._
- **Why does `Element` connect `devices.ts` to `Circuit Atelier — Spec`, `types.ts`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **Should `Writing Skills` be split into smaller, more focused modules?**
  _Cohesion score 0.05128205128205128 - nodes in this community are weakly interconnected._