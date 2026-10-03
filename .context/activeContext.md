# Active context — live state

## Current state — October 3, 2026

Three batches of work sit uncommitted in the working tree: (1) the two audit
fixes below, (2) the account preferences, creator-approval and admin-review
work, and (3) session-scoped write hardening in `frontend/src/pages/Account.tsx`.
The settings form now snapshots `SESSION_KEY` plus a lifecycle revision, listens
for `elysian-session-change`, and abandons a save that finishes after a token
change, a session event or an unmount — it writes no preferences and notifies
nothing — and it reports partial success ("Your profile was saved, but
preferences could not be saved.") when only the second write fails. REST mode
also shows "Changes are saved to your account." and hides the demo-data reset.

Verified October 3, 2026 against local MongoDB: **284 tests across 26 files
passed** (frontend 133, backend 151) with `--maxWorkers=1 --no-file-parallelism`,
plus `npm run typecheck`, `npm run lint` and `npm run build`. Logs:
`.context/verification/resume-full-tests.log`, `resume-typecheck.log`,
`resume-lint.log`, `resume-build.log`.

The documentation screenshots were regenerated on October 3, 2026: the capture
script predates the Entrance door and the admin `ProtectedRoute`, so
`frontend/scripts/capture-pages.mjs` now skips the intro on `/` and signs in
`studio@example.test` before the `/admin` shot. All six routes plus the
first-screen shot were recaptured in REST mode against local MongoDB, and the
jury docx/pdf were rebuilt to embed the refreshed first screen (36 pages, 3
embedded images, verified with `verify_jury_docs.py`). The rendered code
figures in `docs/assets/code/` were produced from current source the same
morning. The screenshots, jury exports, code figures and the three code
batches are committed and pushed to `feat/expo-cloud-sandbox`; the live site
still runs `b8d6157`.

Run Vitest through the local binary with `NODE_ENV=test`:
`node node_modules/vitest/vitest.mjs run <paths>`. Piping that run through
`npx`/`Tee-Object` returns exit 1 with an empty log on this machine.

The jury-guide exports were regenerated on October 3, 2026 (36-page PDF, 3
embedded images) from the current Markdown. `docs/jury/architecture.png` did not
exist before: the earlier export silently substituted the storefront screenshot
for that slot because the image line had been added to the Markdown after the
export ran. A real layered-architecture diagram now occupies it. The docx/pdf
generator and the coverage verifier are kept in `.scratch/jury-diagram/`
(`build_jury_docs.py`, `verify_jury_docs.py`, `render.cjs`), and non-cover
images are now sized to the content width instead of a fixed 75 pt.

## Current state — October 2, 2026 (second pass)

Two open audit findings from `EXPO_HANDOFF.md` are fixed and verified locally
but **uncommitted**: backend `getCart` now normalizes stored carts on read
(unavailable products no longer linger as invisible lines), and the mock
adapter migrates credential digests across email changes so the next login
works. Full suite: 230/230 tests, lint, typecheck, build — see
`.context/verification/stale-cart-email-fix.log`. Note: run Vitest with
`NODE_ENV=test`; the machine-wide `NODE_ENV=production` breaks jsdom render
tests with `React.act is not a function`.

## Current state — September 30, 2026

The frontend, REST adapter, Express routes, JWT authentication, and MongoDB
persistence are implemented. The older Phase 2 checkpoint below is retained
as history, not as a description of the current source.

### Folder organization

Repository root: `C:\2ND YEAR ODD SEM\PROJECTS\DBS\website`.

- `frontend/`: existing React `src/`, `public/`, entry HTML, environment files,
  Vite/TypeScript/Playwright configs, unit tests, browser tests, screenshot and
  asset scripts, and visual captures. Build output is `frontend/dist/`.
- `backend/`: Express entrypoint, environment, middleware, routes, data store,
  Node integration tests, TypeScript/Vitest configs, and the existing smoke script.
- `database/`: `src/db.ts`, `src/models/`, `src/seed.ts`, read-only inspection
  script, and `README.md` with the existing schema/index documentation.
- `docs/`: validation history, `assets/ASSETS.md`, and implementation plans.
- `backend/archive/store.ts.phase2.bak`: preserved earlier in-memory store.
- Root `package.json`, `package-lock.json`, ESLint config, and Vitest project
  config serve the whole repository. Run all npm commands from the root.
- Private environments moved to `frontend/.env.local` and `backend/.env` and
  remain Git-ignored. Do not duplicate catalogue or domain definitions: backend
  and database code reuse `frontend/src/data/mock.ts`, `types/domain.ts`, and
  `utils/commerce.ts`.
- No dependency changes, UI changes, development database reset, Git staging,
  commits, pushes, or MongoDB service changes were made for this reorganization.

### Verification for this reorganization

- Baseline before moves: typecheck and lint passed; all 91 tests passed.
- After moves: typecheck and lint passed; all 91 tests passed on a sequential
  single-worker rerun. The earlier concurrent run had 90 passes and one Node 26
  fork-worker startup timeout; no application change was made in response.
- File hashes confirm all 131 recorded files remain present; 115 are byte-for-byte
  unchanged and 16 have only the required path/configuration updates. All 83
  frontend source/asset, Mongoose model, and project-review PDF files are unchanged.
- Playwright discovers all 25 browser tests in their new location. Both focused
  REST browser tests passed on the sequential rerun, including anonymous cart
  merging, cross-browser persistence, and logout/account isolation. The first
  concurrent run hit the existing 120-second bag flow timeout; no assertions or
  timeouts were changed. The full run was interrupted after 15 passing tests
  during the 390px route sweep and has no final exit code. The remaining ten
  mobile, accessibility, and capture checks passed in a separate run with exit
  code 0. All 25 browser tests have passed across these runs; this is not a
  single uninterrupted 25/25 run.
- The production build passed and writes to `frontend/dist/`.
- `npm run db:inspect` passed: the existing `elysian` database has ten collections
  and uses standalone topology. This was a read-only inspection, not a reset.
- All 247 relative imports checked resolve, and all six moved JavaScript helper
  scripts passed `node --check`.
- Logs and before/after preservation records are in ignored
  `.context/verification/structure-*` files. Previous loose root logs were
  retained under `.context/verification/archive/`.
- Browser verification regenerated two screenshot files. The new captures were
  retained in the verification archive and the original screenshots restored,
  leaving the reorganization free of unrelated screenshot changes.

### Existing limitations

Development uses `mongodb://localhost:27017/elysian` in REST mode. Never seed it
just to inspect records; `npm run db:inspect` is read-only. Test databases remain
isolated. Standalone checkout compensates handled failures but is not a
crash-safe multi-document transaction. Node 26 on Windows has intermittent
test-worker startup failures; the project recommends Node 22.

## Historical checkpoint — before REST/MongoDB completion

## Where we are

**Phase 1 (frontend end-to-end) is DONE.** Phase 2 repository, scripts,
environment setup, Express health server, in-memory store, and JWT auth
middleware are complete. API routes are next. Phase 3 has not started beyond
its Mongoose model scaffolding.

## Phase 1 — what was built and verified

| # | Work | Status |
|---|---|---|
| 1.1 | `src/services/store.ts` — localStorage demo store (key `elysian-demo-v1`, versioned), `mockAdapter` rewritten to read/write it | done |
| 1.2 | Mock auth: `context/AuthContext.tsx`, `authService`, `pages/Auth.tsx` (`/login`, `/register`), `components/ProtectedRoute.tsx`, routes + `Layout` sign-in/out | done |
| 1.3 | Checkout creates a real `Order` + `Payment`, decrements stock, clears the bag, shows a confirmation | done |
| 1.4 | Collaboration applications persist to the review queue and reach `/admin/collaborations`; creator dashboard shows real status | done |
| 1.5 | Identity comes from the session (no more hardcoded `"demo-customer"` / `"mira"`) | done |
| 1.6 | All 6 files that bypassed the service layer were rerouted; `ProductCard`/`ProductGrid` take a `creator` prop | done |
| 1.7 | Wishlist empty-state/count mismatch fixed via `productService.listByIds` | done |

## Verification status — READ THIS

- `npm run typecheck` — **green**
- `npm run lint` — **green**
- `npm test` — **green, 50/50** (5 files, including server store and auth)
- `npm run build` — **green**
- `npm run test:e2e` — **green, 23/23**. The untouched Node 26 baseline first
  gave 21 passed / 2 timed out even though both snapshots showed the expected
  rendered state. Increasing only those two test budgets produced a full green
  run in 7.8 minutes without weakening assertions or changing application code.

## Two deliberate behaviour changes (tests were updated to match)

- Applications are now **actually recorded**, so `createCollaborationDraft`
  returns a real `Collaboration` (was `{submitted:false}`).
- Creator-dashboard products and admin decisions now **persist across reload**
  (was session-only). `resetDemoData()` restores the seed.

## Other changes worth knowing

- `src/types/domain.ts`: `Address.userId?` and `User.creatorId?` added (optional,
  backward compatible).
- `eslint.config.js`: added `argsIgnorePattern: "^_"` (Express error handlers must
  keep 4 params), and `scripts/check-entrance.mjs` gained a `/* global */` comment.
- `NODE_ENV=production` is set machine-wide — **always** `npm install --include=dev`.
- Git `main` tracks `origin/main`; the remote's two `PROJECT REVIEW/` PDFs are
  preserved. Private `.env` files, logs, build output, test artifacts, and local
  CommandCode settings are ignored.
- `.env.local` keeps `VITE_API_MODE=mock`. `server/.env` contains a generated local
  JWT secret and is loaded explicitly from `server/src/env.ts`.

## Files NOT to duplicate

`src/services/store.ts` already seeds from `src/data/mock.ts`. Reuse it as the
single seed source server-side; do not create a second copy of the catalogue.
