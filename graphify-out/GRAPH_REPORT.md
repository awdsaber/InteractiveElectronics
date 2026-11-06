# Graph Report - agent-a4bd7ce2558e67ea2  (2026-11-06)

## Corpus Check
- 99 files · ~79,834 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 6 file(s) not represented in the graph (top: (none) 4, .dot 1, .css 1)

## Summary
- 1012 nodes · 1221 edges · 88 communities (61 shown, 27 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 45 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1a580fc3`
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
- @playwright/test@^1.65.0
- transpile.ts
- virtualMcu.ts
- VirtualMcu
- handleRequest
- startServer
- handleUpgrade
- Circuit Atelier — interactive electronics course

## God Nodes (most connected - your core abstractions)
1. `VirtualMcu` - 30 edges
2. `Transpiler` - 24 edges
3. `Writing Skills` - 21 edges
4. `compilerOptions` - 18 edges
5. `Testing Skills With Subagents` - 16 edges
6. `TranspileError` - 15 edges
7. `compilerOptions` - 15 edges
8. `handleRequest()` - 14 edges
9. `transpile()` - 14 edges
10. `Code Review Reception` - 14 edges

## Surprising Connections (you probably didn't know these)
- `Circuit Atelier — interactive electronics course` --references--> `main()`  [INFERRED]
  CLAUDE.md → .claude/skills/writing-skills/render-graphs.js
- `5. Virtual MCU (`src/engine/mcu`)` --references--> `TranspileError`  [INFERRED]
  docs/spec.md → src/engine/mcu/transpile.ts
- `5. Virtual MCU (`src/engine/mcu`)` --references--> `constrain()`  [INFERRED]
  docs/spec.md → src/engine/mcu/runtime.ts
- `5. Virtual MCU (`src/engine/mcu`)` --references--> `VirtualMcu`  [INFERRED]
  docs/spec.md → src/engine/mcu/virtualMcu.ts
- `3. Lesson data model` --references--> `Element`  [INFERRED]
  docs/spec.md → src/engine/types.ts

## Import Cycles
- None detected.

## Communities (88 total, 27 thin omitted)

### Community 0 - "server.cjs"
Cohesion: 0.08
Nodes (24): brandMarkup(), clients, CONTENT_DIR, crypto, debounceTimers, escapeHtmlText(), frameTemplate, fs (+16 more)

### Community 1 - "types.ts"
Cohesion: 0.05
Nodes (35): 1. Experience, 2. Visual identity (original), 3. Lesson data model, 4. Simulation engine (`src/engine/sim`), 6. Tracks (syllabus), Bench actions, Circuit Atelier — Spec, Failures (+27 more)

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
Nodes (21): dependencies, @codemirror/lang-cpp@^6.0.3, marked@^18.1.3, @react-three/drei@^10.7.9, @react-three/fiber@^9.8.2, three@^0.187.0, @uiw/react-codemirror@^4.25.12, zod@^4.6.7 (+13 more)

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
Nodes (17): devDependencies, jsdom@^31.0.0, oxlint@^1.90.0, @types/node@^24.19.2, @types/react@^19.3.0, @types/react-dom@^19.3.0, @types/three@^0.187.0, typescript@~7.0.2 (+9 more)

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

### Community 81 - "transpile.ts"
Cohesion: 0.07
Nodes (39): BUILTIN_NAMES, errorOf(), castPrefix(), charCode(), checkCompiles(), checkSemicolons(), CLOSE, COMPOUND (+31 more)

### Community 82 - "virtualMcu.ts"
Cohesion: 0.06
Nodes (47): A0, A1, A2, A3, A4, A5, A6, A7 (+39 more)

### Community 83 - "VirtualMcu"
Cohesion: 0.10
Nodes (10): 5. Virtual MCU (`src/engine/mcu`), constrain(), makeRng(), run(), harness(), PinEvent, Widget, VirtualMcu (+2 more)

### Community 84 - "handleRequest"
Cohesion: 0.18
Nodes (14): bootstrapPage(), getNewestScreen(), handleRequest(), isAuthorized(), isFullDocument(), isRegularFileInsideContentDir(), parseCookies(), pathnameOf() (+6 more)

### Community 85 - "startServer"
Cohesion: 0.16
Nodes (11): browserLauncherForPlatform(), chmodOwnerOnly(), companionUrl(), generateToken(), initialToken(), maybeOpenBrowser(), preferredPort(), randomPort() (+3 more)

### Community 86 - "handleUpgrade"
Cohesion: 0.25
Nodes (8): broadcast(), computeAcceptKey(), decodeFrame(), encodeFrame(), handleMessage(), handleUpgrade(), isAllowedWebSocketOrigin(), touchActivity()

### Community 87 - "Circuit Atelier — interactive electronics course"
Cohesion: 0.33
Nodes (5): Circuit Atelier — interactive electronics course, Commands, Memory and context: graphify (use first), Rules, Workflow: superpowers skills (in `.claude/skills/`)

## Knowledge Gaps
- **1 isolated node(s):** `RFC-6455`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 647 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **27 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `@vitejs/plugin-react` to `transpile.ts`, `package.json`, `VirtualMcu`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **What connects `RFC-6455` to the rest of the system?**
  _1 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `server.cjs` be split into smaller, more focused modules?**
  _Cohesion score 0.07671957671957672 - nodes in this community are weakly interconnected._
- **Why does `VirtualMcu` connect `VirtualMcu` to `transpile.ts`, `virtualMcu.ts`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Should `types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05121951219512195 - nodes in this community are weakly interconnected._
- **Why does `TranspileError` connect `transpile.ts` to `VirtualMcu`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Should `Writing Skills` be split into smaller, more focused modules?**
  _Cohesion score 0.05128205128205128 - nodes in this community are weakly interconnected._