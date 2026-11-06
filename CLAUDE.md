# Circuit Atelier — interactive electronics course

An original, browser-based electronics course from first principles to professional skills, for a mechanical engineer learning electronics. Every lesson is a hand-inked isometric 3D board on a workbench. You strip it, assemble it, solder it, power it, run code on it and break it, while a real circuit simulator drives the live readouts.

- Repo: https://github.com/awdsaber/InteractiveElectronics. Pushing to `main` deploys to GitHub Pages at https://awdsaber.github.io/InteractiveElectronics/.
- Spec, the binding authority: `docs/spec.md`. Milestone plans: `docs/plans/`.
- Stack: Vite + React 19 + TypeScript (erasableSyntaxOnly, so no `enum`s and no namespaces), three.js via @react-three/fiber + drei, zustand, zod, Vitest, Playwright.

## Memory and context: graphify (use first)
- Before exploring the code, read `graphify-out/GRAPH_REPORT.md` if it exists. For "where/how/what calls" questions, run `graphify query "<question>"`, `graphify explain "<Node>"` or `graphify path "A" "B"` before grepping widely.
- After finishing a task that changes code, run `npm run graph` (`graphify update .`; it uses only the AST, no LLM, and is free) so the graph stays current for the next agent. Commit `graphify-out/` along with your change.
- Decisions that the code can't show go in `docs/decisions.md` as one dated line each.

## Workflow: superpowers skills (in `.claude/skills/`)
- New feature or design: `brainstorming`, then `writing-plans` (into `docs/plans/`), then `subagent-driven-development`.
- All engine code (`src/engine/**`) follows `test-driven-development`: write a failing Vitest test first.
- Bugs: `systematic-debugging`. Before claiming anything is done: `verification-before-completion`, which means running `npm test` and `npm run build` and reading the output.
- Independent lessons can be authored in parallel with `dispatching-parallel-agents` in git worktrees.

## Commands
- `npm run dev`: dev server.
- `npm test`: unit tests.
- `npm run build`: typecheck + build.
- `npm run test:e2e`: Playwright smoke test.
- `npm run graph`: refresh the knowledge graph.

## Rules
- Lessons are pure data (`src/lessons/**`), validated by `src/engine/lessonSchema.ts`. Don't put lesson-specific logic in UI components. If a lesson needs custom behaviour, register a behaviour in `src/engine/behaviors/`.
- The electronics content must be correct: real part numbers, real ratings (from datasheet values) and real equations. When unsure, say less rather than invent.
- Keep the visual identity and all copy original. Don't copy other sites' text, names or styling.
- `localStorage` access is always wrapped in try/catch.
