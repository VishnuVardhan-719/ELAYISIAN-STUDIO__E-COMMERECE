# Local MongoDB completion plan

**Goal:** Finish the existing marketplace demo on `mongodb://localhost:27017/elysian` without overwriting its data.

**Architecture:** Keep the current Express/Mongoose backend and frozen domain interfaces. Implement the existing service contract over HTTP, with browser storage only for anonymous saved items and synchronous follows. Keep the UI and marketing copy unchanged.

**Spec:** `C:\2ND YEAR ODD SEM\PROJECTS\DBS\website\.context\phase-2-3-brief.md`

## Tasks

- [ ] Inspect the local database and preserve its current collections; do not run the destructive seed against `elysian`.
- [ ] Reproduce and fix the product-save response mismatch; sanitize embedded cart/order fields.
- [ ] Add request-helper and REST-adapter regression tests, then implement Bearer auth, server errors, resource methods, anonymous cart storage, and merge on login.
- [ ] Select the adapter in `src/services/api.ts`; configure Vite proxy and REST mode.
- [ ] Add the minimal session/saved-state synchronization in contexts needed to update bag and wishlist after login/logout. Do not change page components or copy.
- [ ] Verify checkout persistence failures, use real transactions where supported, and document the standalone MongoDB limitation. Implement database aggregation without changing the five-field summary contract.
- [ ] Configure Playwright to seed only `elysian_e2e` and run browser tests against an isolated API and Vite server.
- [ ] Run typecheck, lint, unit tests, build, browser checks, and database inspection. Record real results and remaining limitations.
- [ ] Update stale project instructions and remove only identified temporary files; retain the previous store backup.

## Verification

Run from `C:\2ND YEAR ODD SEM\PROJECTS\DBS\website`:

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

Existing unit tests that assert mock behavior must select mock mode explicitly. New REST tests verify requests and responses independently. Integration tests use test databases only. No dependency installations, service reconfiguration, commits, pushes, or Atlas migration are needed.