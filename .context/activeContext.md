# Active context — live state

## Where we are

**Phase 1 (frontend end-to-end) is DONE.** Phase 2 repository, scripts,
environment setup, and the Express health server are complete. The in-memory
store is next. Phase 3 has not started beyond its Mongoose model scaffolding.

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
- `npm test` — **green, 29/29** (3 files: `commerce`, `components`, `session`)
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
