  You are working in `C:\2ND YEAR ODD SEM\PROJECTS\DBS\website` — "Elysian Studio",
    a React 19 + Vite + TypeScript + React Router 7 handmade-marketplace demo built as
    a Database Systems Engineering project. Local `main` tracks the existing GitHub
    `main` branch and preserves the files under `PROJECT REVIEW/`.

    READ FIRST, in this order, before writing anything:
    1. `AGENTS.md`                        (project rules + environment gotchas)
    2. `.context/phase-2-3-brief.md`      (THE FULL SPEC — follow it exactly)
    3. `.context/activeContext.md`        (what Phase 1 shipped, and what is unverified)
    4. `src/services/mockAdapter.ts`      (reference implementation of the data contract)

    Then implement Phase 2, then Phase 3. The brief is complete — do not ask me to
    re-explain it. Ask only if something contradicts the code.

    ---------------------------------------------------------------------------
    PHASE 2 — build the Express API on an in-memory store, then switch the frontend to HTTP.

    Create:
    - `server/src/index.ts`      express + cors + json, `GET /api/health`, then listen
    - `server/src/store.ts`      in-memory store SEEDED BY IMPORTING `src/data/mock.ts`
                                 (do not copy the catalogue; `tsx` can load it)
    - `server/src/middleware/auth.ts`   `requireAuth`, `requireRole(...roles)`
    - `server/src/routes/*.ts`   auth, products, categories, creators, collections,
                                 collaborations, cart, wishlist, orders, payments,
                                 users, admin
    - `server/.env` + `server/.env.example`
    - `src/services/restAdapter.ts`     the identical export surface as mockAdapter
    - frontend `.env.example` + `.env.local`

    Also:
    - npm scripts: `dev:api` (`tsx watch server/src/index.ts`), `seed`, `typecheck:api`,
      `dev:all` (concurrently), and extend the existing `typecheck` to include typecheck:api
    - `vite.config.ts`: proxy `"/api" -> http://localhost:4000`
    - `src/services/api.ts`: select the adapter on `import.meta.env.VITE_API_MODE`
      ("mock" default, "rest" for HTTP). Use EXPLICIT conditional exports — `export *`
      cannot be dynamic. Keep exporting `ApiError` and `apiRequest`.
    - Auth: bcrypt for passwordHash, JWT Bearer. Client stores the token under
      `elysian-session-v1` (exported as `SESSION_KEY`) so AuthContext needs no change.
      Demo accounts: ananya@example.test (customer), mira@example.test (creator),
      studio@example.test (admin). Shared password: `elysian123`.
    - Validate every write with zod (price, stock, ownership, role). Client checks stay UX-only.
    - The ONE place complexity lives: the cart. Call the API when a token exists,
      fall back to localStorage when anonymous. Do NOT change StudioContext.

    Endpoint table + the exact service contract to satisfy: see sections
    "The exact service contract" and "API endpoints" in `.context/phase-2-3-brief.md`.

    ---------------------------------------------------------------------------
    PHASE 3 — replace that store with MongoDB/Mongoose. Routes must not change.

    - `server/src/seed.ts`: connect, wipe the 10 collections, insert from
      `src/data/mock.ts`, bcrypt-hash the demo passwords, set `User.creatorId = "mira"`
      and `Address.userId = "demo-customer"`.
    - Swap `server/src/store.ts` internals for Mongoose queries BEHIND THE SAME
      FUNCTION SIGNATURES, so no route changes.
    - Reuse the models already in `server/src/models/` — they already strip `_id`/`__v`.
    - Confirm the declared indexes exist (unique users.email, unique products.id,
      products.{categoryId,creatorId,status}, text index on
      products.{name,description,material}, orders.userId, collaborations.status,
      unique carts.userId, addresses.userId).
    - Make checkout TRANSACTIONAL (Order + Payment in one Mongo session), otherwise the
      DB can hold an order with no payment.
    - Turn `/api/admin/summary` into a real aggregation pipeline (revenue by creator,
      low stock, pending collaborations) — this is the DBS showcase.

    ---------------------------------------------------------------------------
    HARD RULES
    - Components must not change. `src/services/api.ts` is the only data seam.
    - Preserve the string ids ("sunset-vase", "mira", "ceramics") and every interface
      in `src/types/domain.ts`.
    - Nothing outside `src/services/**` and `src/data/**` may import `src/data/mock`
      (tests are the exception).
    - No code comments. Do not reword or "improve" any UI copy.
    - `GET /api/health` returns `{ ok: true, database: <state> }`.

    ENVIRONMENT (these will bite you)
    - `NODE_ENV=production` is set machine-wide -> `npm install` silently omits
      devDependencies. Always run `npm install --include=dev`.
    - Node is v26.7.0 -> Vitest worker startup is flaky on 26. If tests fail with worker
      errors, that is the cause, not your code.
    - esbuild's postinstall is blocked by npm `allowScripts`; Vite works anyway. Ignore it.
    - MongoDB: the local service is already Running on `mongodb://127.0.0.1:27017`,
      database `elysian`. Already installed: express@5, mongoose@9, bcryptjs,
      jsonwebtoken, cors, zod, dotenv, tsx, concurrently + their @types.

    VERIFY (paste the real output, do not summarise)
        npm run typecheck && npm run lint && npm test && npm run build
        npm run dev:api
        curl -s localhost:4000/api/health
        curl -s localhost:4000/api/products | head -c 300
        curl -s -X POST localhost:4000/api/auth/login -H "Content-Type: application/json" \
          -d '{"email":"ananya@example.test","password":"elysian123"}'
        VITE_API_MODE=rest npm run dev      # click every flow
        npm run seed                        # Phase 3
        npm run test:e2e                    # expect 23/23 - see the carry-over note below
    Also set `playwright.config.ts` `webServer` to an ARRAY so API + Vite both start,
    and seed before the suite runs.

    PHASE 1 CARRY-OVER — RESOLVED 2026-09-29
    The full end-to-end suite now passes 23/23 on Node 26 after increasing only the
    two long-running test budgets. Assertions and application behavior are unchanged.

    FINAL REPORT
    List: files created, the curl output, which checks passed, and anything you could
    not do or had to deviate from. Nothing else.

  Two things about how this is structured, so you know what's carrying the weight:

  The prompt points Codex at the real spec rather than restating it. .context/phase-2-3-brief.md (~11 KB) holds the full details Codex needs — the exact 20-method service contract it
   must reimplement, the full endpoint table, the index list. The prompt above is the entry point; without that file Codex would be guessing at shapes.

  AGENTS.md at the repo root matters most. Codex auto-reads it, and it's where the three rules live that would otherwise get silently broken: the service layer is the only data seam,
   domain shapes are frozen, and no new code comments.

  If Codex's context is tight, the minimum viable prompt is just: "Read AGENTS.md and .context/phase-2-3-brief.md, then implement Phase 2 and Phase 3 as specified." — the two files
  are self-contained.