# Validation results

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

Screenshots in `screenshots/` include the final homepage, shop, product, creator profile and admin overview. Recreate them with `node scripts/capture-pages.mjs` while the local preview is running.

The remaining integration boundary is intentional: no backend, real authentication, database writes, payment processing, email delivery or remote uploads are connected.
