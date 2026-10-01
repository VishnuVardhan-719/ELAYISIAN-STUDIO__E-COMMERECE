# Validation results

## Folder reorganization — September 30, 2026

- Frontend and backend/database TypeScript checks passed from the root commands.
- ESLint passed with generated frontend output excluded.
- All 91 existing unit/integration tests passed across eight files after moving
  frontend tests to the frontend Vitest project and API tests to the Node project.
- The production build passed and writes to `frontend/dist/`.
- Playwright discovers all 25 existing browser tests under `frontend/tests/`.
- Both focused REST browser tests passed on a sequential rerun, covering bag
  merge/persistence and wishlist persistence/account isolation.
- The full browser run was interrupted after 15 passing tests during the 390px
  route sweep. The remaining ten checks passed in a separate run with exit code
  0, including 390px/375px sweeps, seven accessibility scans, and reduced-motion
  captures. All 25 tests passed across the two runs, not in a single completed
  full-suite run.
- Before/after hashes verified all 131 recorded files remained present; all
  frontend source/assets, model definitions, and original review PDFs were
  unchanged by the restructuring. Required changes were paths and tooling only.
- A first concurrent validation run hit one Node 26 Vitest worker startup
  timeout, and one REST browser flow exceeded its existing time limit. The unit
  suite passed when rerun sequentially. Browser rerun results are recorded in
  `.context/activeContext.md` and local `.context/verification/structure-*` logs.
- No development database seed/reset, dependency changes, or MongoDB service
  reconfiguration was performed.
- The relocated read-only inspection command connected to `elysian` and listed
  all ten collections on the existing standalone service.

## Historical frontend-only verification

Validated on 14 September 2026.

- TypeScript check: passed.
- ESLint: passed.
- Production build: passed. Route bundles are split; the main JavaScript bundle is approximately 98.5 KB gzipped.
- Vitest: 20 unit/component tests passed under Node 22.23.2.
- Full browser sweep: 18 tests passed, including 36 routes at 1440, 1280, 1024, 768, 430, 390, and 375px; no page overflow, broken loaded images, or console errors were found in that sweep.
- After the final homepage and navigation revisions: all 4 targeted browser tests passed. These cover the revised homepage at all seven widths, the collaboration section anchor and persistent header, mobile navigation/search/filtering, and the collection-to-product-to-checkout flow.
- Automated accessibility: no WCAG A/AA violations in the six scanned main route types; the revised homepage also passed its accessibility scan.
- Keyboard behavior: modal focus containment, Escape dismissal, focus restoration, and mobile navigation were tested.
- Reduced motion: verified.
- Dependency audit: zero reported vulnerabilities after updating Vitest.

Commands correspond to `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run test:e2e`, and `npm audit`. Final validation used the checked Node 22 runtime to invoke the same package CLIs directly; unit tests used one worker. This avoids intermittent Node 26/Windows worker startup errors seen during concurrent validation.

Screenshots in `frontend/screenshots/` include the final homepage, shop, product, creator profile and admin overview. Recreate them with `node frontend/scripts/capture-pages.mjs` while the local preview is running.

The remaining integration boundary is intentional: no backend, real authentication, database writes, payment processing, email delivery or remote uploads are connected.
