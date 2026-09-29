# Phase 2 + Phase 3 execution plan

Date: 2026-09-29

## Fixed decisions

- Preserve the existing GitHub `main` history and the two files in `PROJECT REVIEW/`.
- Keep mock mode as the default until REST parity is verified.
- Use the service layer as the only frontend data seam; components and domain shapes stay unchanged.
- Apply the same ₹150 shipping charge below ₹3,000 in mock and REST modes.
- Keep wishlist and creator follows synchronous in the existing client context.
- Use 10 MongoDB collections and a signed checkout token rather than adding a checkout-session collection.
- Detect transaction support at runtime. Use a MongoDB transaction on a replica set and compensating rollback on a standalone server.
- Add Razorpay only after the REST adapter and MongoDB checkout path are complete.

## Work chunks

0. **Baseline and repository setup** — reconcile Git history, protect private environment files, add scripts, and capture all validation gates.
1. **Server entry point** — Express setup and `GET /api/health`.
2. **In-memory store** — import the existing catalogue and expose route operations.
3. **Authentication** — JWT/bcrypt middleware, validation, and role checks.
4. **API routes and checkout seam** — add the REST resources and simulated payment-provider boundary.
5. **REST adapter parity** — reproduce every mock adapter export and exact error text over HTTP.
6. **Frontend integration** — conditional adapter selection, Vite proxy, and dual Playwright servers.
7. **MongoDB** — seed 10 collections, replace store internals without route changes, add indexes, aggregation, and transaction-aware checkout.
8. **Razorpay** — create and confirm test-mode payments, verify signatures, and update payment copy only when live checkout is enabled.
9. **Hardening and documentation** — security middleware, integration tests, database documentation, README, and validation records.

## Model reminders

- Before REST adapter parity: use the strongest available Codex coding model at high reasoning.
- Before MongoDB transactions: remain on the strongest available Codex coding model at high reasoning.
- Before Razorpay: remain on the strongest available Codex coding model at high reasoning.
- Before documentation-only work: switch to a lower-cost model if desired.
- Never switch models in the middle of a parity, transaction, or payment chunk.

## Verification gates

Each chunk ends with its focused checks and a local commit. Before release, run:

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

Do not push private `.env` files, secrets, build output, test artifacts, or local tool settings.