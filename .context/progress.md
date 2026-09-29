# Progress

## Phase 1 — Frontend end to end (mock-backed)

- [x] 1.1 Persistent localStorage store + `mockAdapter` rewrite
- [x] 1.2 Mock auth, session, `ProtectedRoute`, `/login` + `/register`, header sign-in/out
- [x] 1.3 Checkout creates an order + payment, clears the bag, shows a confirmation
- [x] 1.4 Collaboration applications reach the admin queue; real status on the creator dashboard
- [x] 1.5 Session identity replaces hardcoded ids
- [x] 1.6 Six bypassing files rerouted through the service layer
- [x] 1.7 Wishlist count/empty-state mismatch fixed
- [x] 1.8 typecheck + lint + 29 unit tests + build green
- [x] 1.8b Confirm one fully-green `npm run test:e2e` run — 23/23 on 2026-09-29

## Phase 2 — Backend + connect the frontend  (setup started)

- [x] 2.1 Add npm scripts (`dev:api`, `typecheck:api`, `dev:all`)
- [ ] 2.2 `server/.env` + `.env.example`; `server/src/index.ts` (env files done)
- [ ] 2.3 `server/src/store.ts` — in-memory store seeded from `src/data/mock.ts`
- [ ] 2.4 `server/src/middleware/auth.ts` — `requireAuth`, `requireRole`
- [ ] 2.5 Routes: auth, products, categories, creators, collections,
      collaborations, cart, wishlist, orders, payments, users, admin
- [ ] 2.6 `src/services/restAdapter.ts` with the identical export surface
- [ ] 2.7 `src/services/api.ts` selects adapter on `VITE_API_MODE`; Vite `/api` proxy
- [x] 2.8 Frontend `.env.example` / `.env.local`
- [ ] 2.9 `playwright.config.ts` `webServer` → array (API + Vite)
- [ ] 2.10 curl every endpoint; run the app on `VITE_API_MODE=rest` and confirm it
      behaves identically

## Phase 3 — Connect MongoDB  (not started)

- [ ] 3.1 `server/src/seed.ts` — wipe + insert from `src/data/mock.ts`, hash demo passwords
- [ ] 3.2 Swap `server/src/store.ts` internals for Mongoose behind the same signatures
- [ ] 3.3 Confirm indexes exist; add the `/api/admin/summary` aggregation pipeline
- [ ] 3.4 Make checkout transactional (Order + Payment in one Mongo session)
- [ ] 3.5 Verify in Compass: database `elysian`, 10 collections

## Phase 4/5 — Hardening + DBS deliverables  (not started)

- [ ] helmet, auth rate-limit, request logging
- [ ] supertest integration tests against a throwaway DB
- [ ] `docs/DATABASE.md`: collection catalogue, embed-vs-reference rationale,
      index table, Mermaid ER diagram
- [ ] Update `README.md` + `VALIDATION.md`; document demo accounts
