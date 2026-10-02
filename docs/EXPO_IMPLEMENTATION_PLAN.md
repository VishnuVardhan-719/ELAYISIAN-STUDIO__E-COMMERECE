# Expo cloud and sandbox implementation

## Approved scope

User approval: October 2, 2026. Render free web service, its supplied HTTPS
address, MongoDB Atlas, Razorpay test checkout, a ₹1 pickup demo product, and
customer/creator/admin expo accounts. No paid resources or real-money checkout.
Preserve the existing design, service seam, public domain shapes and local data.

## Work order and gates

1. Inspect source and baseline tests on `feat/expo-cloud-sandbox`.
2. Back up the read-only local `elysian` source, including BSON data and indexes.
   Copy only to an empty, explicitly selected `elysian_expo` Atlas destination.
   Refuse overwrite; compare documents and indexes before reporting success.
3. Add production Express static serving and SPA routing. Configure strong
   production JWT credentials and Node 22. Keep secrets in ignored files and
   hosted environment settings only.
4. Implement server-created Razorpay test orders, signature/status/amount/owner
   verification, persistent payment attempts, duplicate-safe finalisation and
   signed webhooks. Keep unavailable finalisation visible for reconciliation.
5. Use one shared shipping calculation. The demo product has zero shipping;
   existing shipping remains ₹150 below ₹3,000 otherwise. Match gateway amounts.
6. Add the demo product and three accounts only in the expo database. Replace
   copied, publicly documented login passwords in the cloud copy. Generate
   separate strong private passwords rather than the shared exposed password.
7. Run typecheck, lint, automated tests, build and browser checks. Test failed,
   cancelled, forged and duplicate payments as well as normal checkout.
8. Publish the tested feature branch, create only a free Render service, set
   private configuration, verify health/assets/SPA routes/database connectivity.
9. Rehearse customer-to-creator-to-admin order visibility and update expo docs
   with actual verification results. Do not present untested provider flows as
   completed.

## Payment contract

- `GET /api/payments/config`: public test-mode capability, never secrets.
- `POST /api/payments/orders`: authenticated checkout input; returns attempt ID,
  public key ID, provider order ID, integer paise amount and INR currency.
- `POST /api/payments/verify`: owner-bound checkout signature and captured-payment
  verification; returns the existing order shape after durable finalisation.
- `GET /api/payments/attempts/:id`: owner/admin-only status and reconciliation.
- `POST /api/payments/webhook`: HMAC verification over the raw request body.

## Decisions

- Work in the existing checkout on a separate branch; no second installation.
- Use native fetch and crypto rather than adding a payment SDK dependency.
- Use `vishnu@example.test`, `amrutha@example.test`, `akshita@example.test` for
  fictional expo logins. Display names remain Vishnu, Amrutha and Akshita.
- Keep the catalogue's existing creator IDs; associate Amrutha with the demo
  product's maker without renaming existing creator marketing content.
- No secrets or private account passwords are included in this document.

## Progress

- Feature branch created; source inspection underway.
- Baseline tests: 91/91 passed on a sequential run.
- Local migration safety tests: 3/3 passed after observed failing tests.
- Migration completed to `elysian_expo`: ten collections, 41 documents;
  BSON document hashes and index names verified. A subsequent source hash check
  confirms local `elysian` was unchanged.
- Expo setup tests: 2/2 passed. Three private accounts and ₹1 product added only
  in Atlas; copied public demo login passwords rotated in the cloud copy.
- Credentials saved in an ignored private account file; values never logged.
- Sandbox checkout and single-origin hosting implemented. The actual Razorpay
  test checkout iframe opened for a server-created INR 1 order; captured-payment
  browser rehearsal remains pending.
- Fresh release checks: 198 tests across 17 files passed; typecheck, ESLint and
  production build passed. Browser suite: 24/25 passed; the failed 1440px route
  check passed its isolated retry. This is not a single clean full-suite run.
- Review fixes verified: per-owner durable payment recovery, session-bound
  callbacks, fail-closed recovery storage, transaction finalisation and preserved
  unrelated cart items.
- Tested feature branch published; `main` remains unchanged.
- Render free service `elysian-studio-expo` created with private configuration.
  Cloud builds succeed; startup fails with a database connection timeout.
  Hosted credentials match local settings and local production connects to Atlas.
- Current deployment blocker: verify Atlas network access permits Render outbound
  CIDRs `74.220.52.0/24` and `74.220.60.0/24`. The user must configure these in
  Atlas Network Access; no Atlas project-management credentials were supplied.
- Safe startup diagnostics added and verified with three focused tests; no raw
  exception messages, secrets or connection strings are logged on startup failure.
- Final full automated run: 201 tests across 18 files passed, including startup
  diagnostics. The remaining blocker is provider configuration, not a failing
  automated test. Neither failed cloud deployment is reported as live.
- Hosted readiness, completed provider sandbox payment and webhook registration
  remain unverified. Do not present this as a finished hosted payment release.