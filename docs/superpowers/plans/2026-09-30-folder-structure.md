# Project Folder Structure Implementation Plan

> **For agentic workers:** Execute this plan inline with the executing-plans workflow. Track completed steps below.

**Goal:** Group frontend, backend, and database files by responsibility without changing application behavior or losing uncommitted work.

**Architecture:** Keep the existing root package manifest, lockfile, and dependency installation. Move the React application and browser tooling into `frontend`, Express into `backend`, and Mongoose persistence into `database`. Keep the existing frontend domain types and catalogue as the single shared source; update imports instead of duplicating them.

**Tech Stack:** Existing React 19, Vite 6, TypeScript, Express 5, Mongoose 9, Vitest 4, and Playwright.

**Spec:** User request to resume saved history and organize frontend, backend, and database folders; existing contract at `C:\2ND YEAR ODD SEM\PROJECTS\DBS\website\.context\phase-2-3-brief.md`.

## Global Constraints

- Preserve all existing tracked and untracked work and both `PROJECT REVIEW` PDFs.
- Do not change UI copy, domain shapes, IDs, dependencies, or database records.
- Do not seed the development database; integration checks use existing isolated test databases.
- Preserve root npm commands and keep secrets ignored after moving environment files.
- Do not commit, push, or reconfigure the MongoDB service.

## Task 1: Capture baseline and move files

**Base path for every file below:** `C:\2ND YEAR ODD SEM\PROJECTS\DBS\website`.

- [x] Run existing typecheck, lint, and unit tests before restructuring; record actual results in `.context/verification/structure-baseline.*`.
- [x] Move `src`, `public`, `index.html`, Vite/TypeScript/Playwright configs, frontend environment files, browser tests, screenshot scripts, screenshots, and asset documentation into `frontend`.
- [x] Rename `server` to `backend`; move its three server test files into `backend/tests` and retain the old in-memory store backup in `backend/archive`.
- [x] Move connection, models, and seed files into `database/src`; move database inspection into `database/scripts` and database documentation into `database/README.md`.
- [x] Move root validation documentation into `docs/VALIDATION.md` and existing loose log files into `.context/verification/archive`.

## Task 2: Reconnect existing tooling

- [x] Update root `package.json` scripts for Vite's frontend root, backend entrypoint, database seed entrypoint, explicit frontend/backend typechecks, and split unit-test commands.
- [x] Add root `vitest.config.ts` with frontend and backend projects; use jsdom only for frontend tests and Node for backend tests.
- [x] Update cross-folder imports in API, persistence, and backend tests. Keep frontend source-relative imports unchanged.
- [x] Set Playwright web-server working directories to the repository root and reports to frontend-local folders; preserve isolated ports and database settings.
- [x] Update asset and screenshot script output paths, environment guidance, ESLint ignores, and Git ignore paths.
- [x] Verify `frontend/.env.local` and `backend/.env` remain ignored and both environment examples remain visible to Git.

## Task 3: Verify and record current state

- [x] Run `npm run typecheck`, `npm run lint`, `npm test -- --maxWorkers=1`, and `npm run build` from the repository root.
- [x] Run Playwright test discovery and the existing REST integration browser tests; attempt the full browser suite without weakening assertions.
- [x] Inspect the final file tree, imports, and diff; confirm no old active source paths remain and both review PDFs are unchanged.
- [x] Update root README, AGENTS, database/asset documentation paths, and `.context/activeContext.md` with the actual current structure and verification results. Keep earlier plans/logs as history.

## Verification Commands

Run from `C:\2ND YEAR ODD SEM\PROJECTS\DBS\website`:

```powershell
npm run typecheck
npm run lint
npm test -- --maxWorkers=1
npm run build
npm run test:e2e -- --list
npm run test:e2e -- rest-integration.spec.ts
npm run test:e2e
git diff --check
git check-ignore frontend/.env.local backend/.env
```
## Execution Notes

Root typecheck and lint passed. All 91 tests passed on a sequential rerun, the production build passed, and both REST browser tests passed. The full browser run was interrupted after 15 passing tests during the 390px route sweep. All remaining ten checks passed separately with exit code 0, covering every one of the 25 tests across the two runs rather than one uninterrupted full-suite pass. No test assertions or timeouts were changed. A read-only reviewer found two remaining asset-documentation paths; both were corrected. All 131 pre-move files are present and the UI source, assets, database models, and review PDFs are byte-for-byte unchanged. Verification captures are archived; the original screenshots are preserved.
