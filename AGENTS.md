# Project memory — Elysian Studio

Handmade-marketplace demo. React 19 + Vite + TypeScript + React Router 7, CSS
Modules + design tokens. No test framework changes without reason.

## Commands

```sh
npm run typecheck     # tsc -b
npm run lint          # eslint .
npm test              # vitest run  (29 tests)
npm run build         # tsc -b && vite build
npm run test:e2e      # playwright (starts vite on :5173)
npm run dev           # vite on :5173
```

## Environment gotchas — read these first

1. **`NODE_ENV=production` is set machine-wide.** `npm install` silently omits
   devDependencies because of it (it already wiped vite/vitest/playwright/tsc
   once). Always run `npm install --include=dev`, or clear `NODE_ENV`.
2. **esbuild's postinstall is blocked** by npm `allowScripts`. Vite still works;
   do not "fix" it.
3. **Node is v26.7.0.** The README warns Node 26 has flaky Vitest worker startup
   and recommends Node 22. If tests fail with worker errors, that is the cause —
   do not chase phantom bugs.
4. **Git is initialized.** Local `main` tracks the existing GitHub `main` branch;
   keep the two PDFs under `PROJECT REVIEW/` and never force-push over remote history.

## Architecture rules — do not break these

- **The service layer is the only data seam.** Components import from
  `src/services/api`. Nothing outside `src/services/**` and `src/data/**` may
  import `src/data/mock` (tests are the one exception).
- **Domain shapes are frozen.** Every layer preserves the existing string `id`s
  ("sunset-vase", "mira") and the interfaces in `src/types/domain.ts`.
- **Marketing copy is intentional** — do not rewrite, reword or "improve" UI
  strings, and do not add code comments.

## Phase 2 + Phase 3

The backend is not built yet. The full, self-contained spec is in
`.context/phase-2-3-brief.md` — read it before writing any server code.
Live state is in `.context/activeContext.md`.
