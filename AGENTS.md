# Project memory — Elysian Studio

Handmade-marketplace demo. React 19 + Vite + TypeScript + React Router 7, CSS
Modules + design tokens. No test framework changes without reason.

## Commands

```sh
npm run typecheck     # frontend + backend/database checks
npm run lint          # eslint .
npm test              # vitest run; local MongoDB required for backend tests
npm run build         # frontend typecheck + build to frontend/dist
npm run test:e2e      # isolated API :4001, Vite :5174, elysian_e2e database
npm run dev           # vite on :5173
npm run dev:api       # API on :4000
npm run dev:all       # API + frontend
npm run db:inspect    # read-only local MongoDB inspection
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
  `frontend/src/services/api`. Frontend code outside `frontend/src/services/**`
  and `frontend/src/data/**` may not import `frontend/src/data/mock` (tests are
  the one exception). The database seed reuses that same catalogue.
- **Domain shapes are frozen.** Every layer preserves the existing string `id`s
  ("sunset-vase", "mira") and the interfaces in `frontend/src/types/domain.ts`.
- **Marketing copy is intentional** — do not rewrite, reword or "improve" UI
  strings, and do not add code comments.

## Folder layout

Run all npm commands from `C:\2ND YEAR ODD SEM\PROJECTS\DBS\website`.
The root manifest and lockfile serve all three folders; do not introduce
separate dependency installations without a reason.

- `frontend/`: React source, static assets, frontend unit tests, browser tests,
  Vite/Playwright configs, screenshots, and asset scripts. Its local environment
  is `frontend/.env.local`.
- `backend/`: Express source, routes, middleware, integration tests, and backend
  TypeScript/Vitest configs. Its local environment is `backend/.env`.
- `database/`: Mongoose connection, models, seed, read-only inspection script,
  and documentation in `database/README.md`. MongoDB data stays outside the repo.
- `docs/`: validation history, asset provenance, and implementation plans.
- `.context/`: saved project context and local verification logs.
- `backend/archive/`: retained historical Phase 2 store backup; not active code.

## Phase 2 + Phase 3

The backend uses Express, JWT authentication, and Mongoose. Development runs
in REST mode against `mongodb://localhost:27017/elysian`. Do not seed this
database unless a reset is explicitly intended; tests use isolated databases.
Standalone checkout uses compensating rollback, not crash-safe transactions.
Read `.context/phase-2-3-brief.md` for the contract and
`.context/activeContext.md` for current verification and limitations.
