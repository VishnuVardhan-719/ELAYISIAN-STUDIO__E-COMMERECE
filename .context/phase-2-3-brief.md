# Phase 2 + Phase 3 — implementation brief

Self-contained. Read this, then `.context/activeContext.md`, then
`src/services/mockAdapter.ts` (which is the reference implementation of the
contract you must reimplement over HTTP).

## Mission

- **Phase 2** — build an Express API backed by an **in-memory store**, then switch
  the frontend from the mock adapter to HTTP. **No component may change.**
- **Phase 3** — replace that one store with **MongoDB/Mongoose**, seed it from the
  existing catalogue, and keep the API contract byte-identical. Routes untouched.

## Non-negotiables

1. **`src/services/api.ts` is the contract.** `restAdapter` must export the exact
   same names with the same signatures and return shapes as `mockAdapter`.
2. **Domain shapes are frozen.** Keep the string `id`s (`"sunset-vase"`, `"mira"`,
   `"ceramics"`) and the interfaces in `src/types/domain.ts`. The Mongoose models
   already strip `_id`/`__v` in `toJSON` — do not leak them.
3. **Do not touch components or UI copy.** Marketing strings are intentional.
4. **No code comments.**
5. **Do not duplicate the catalogue.** `src/data/mock.ts` is the single seed source
   (it is Node-importable: `assets.ts` is plain string paths, so `tsx` can load it).

## Environment gotchas

- **`NODE_ENV=production` is set machine-wide** → `npm install` silently drops
  devDependencies. Always `npm install --include=dev`.
- **Node is v26.7.0**; Vitest workers are flaky on 26. If tests fail at worker
  startup, that is the cause (Node 22 is recommended in the README).
- **esbuild's postinstall is blocked** by npm `allowScripts` — Vite works anyway.
  Do not "fix" it.
- **Git is initialized.** Local `main` tracks the existing GitHub `main` branch;
  preserve `PROJECT REVIEW/` and do not force-push.

## Already done — reuse, do not rewrite

```
server/tsconfig.json                 Node-only, separate from the frontend build
server/src/env.ts                    PORT, MONGODB_URI, JWT_SECRET, JWT_EXPIRES_IN, CLIENT_ORIGIN
server/src/db.ts                     connectDb(), dbState()
server/src/middleware/errors.ts      HttpError, notFound, errorHandler (zod-aware)
server/src/models/helpers.ts         baseSchemaOptions (versionKey:false + toJSON strips _id)
server/src/models/{User,Creator,Category,Product,Collection,Order,Payment,Address,Collaboration,Cart}.ts
```

Installed and ready: `express@5 mongoose@9 bcryptjs jsonwebtoken cors zod dotenv`
plus `tsx concurrently @types/express @types/jsonwebtoken @types/cors`.

Express 5 **forwards rejected promises** from async handlers to `errorHandler`, so
no `asyncHandler` wrapper is needed.

## Missing — create these

```
server/.env, server/.env.example
server/src/index.ts
server/src/middleware/auth.ts
server/src/store.ts                  in-memory (Phase 2) → Mongoose (Phase 3)
server/src/routes/*.ts
server/src/seed.ts                   Phase 3
src/services/restAdapter.ts
.env.example, .env.local             frontend (VITE_API_MODE)
```

`server/src/index.ts` and `server/.env` were blocked earlier by a permission
prompt — they have never existed. Create them.

## npm scripts to add to `package.json`

```json
"dev:api": "tsx watch server/src/index.ts",
"seed": "tsx server/src/seed.ts",
"typecheck:api": "tsc -p server/tsconfig.json --pretty false",
"dev:all": "concurrently -n api,web -c blue,green \"npm:dev:api\" \"npm:dev\"",
```

and extend the existing `typecheck` to also run `typecheck:api`.

## The exact service contract `restAdapter` must satisfy

```ts
productService: {
  list(filters?: ProductFilters): Promise<PageResult<Product>>
  getById(id): Promise<Product | null>          // active only
  listRelated(id): Promise<Product[]>            // same category, max 4, active
  listForCreator(id): Promise<Product[]>         // includes drafts
  listByIds(ids: string[]): Promise<Product[]>   // includes drafts (wishlist fix)
  saveDemo(product: Product): Promise<Product>   // upsert; rejects with
                                                 // "Enter a name, positive price and valid stock."
}
categoryService:      { list(): Promise<Category[]> }
collectionService:    { list(): Promise<Collection[]>, getBySlug(slug): Promise<Collection | null> }
creatorService: {
  list(): Promise<Creator[]>
  getById(id): Promise<Creator | null>
  updateProfile(id, patch: Partial<Omit<Creator,"id">>): Promise<Creator | null>
  getCollaborationFor(email): Promise<Collaboration | null>   // latest by email
  createCollaborationDraft(input: CollaborationInput): Promise<Collaboration>
      // rejects with "Please check the application fields." when invalid
}
cartService:  { get(), addItem(productId, qty=1), updateQuantity(productId, qty),
                removeItem(productId), clear() }   // all Promise<CartItem[]>
orderService: {
  listForUser(userId): Promise<Order[]>
  getById(id): Promise<Order | null>
  listForCreator(creatorId): Promise<Order[]>    // filtered to their lines, total recomputed
  create({ userId, items, address }): Promise<Order>
}
accountService: {
  getProfile(userId?): Promise<User | null>
  updateProfile(userId, patch: Partial<Pick<User,"name"|"email">>): Promise<User | null>
  listAddresses(userId?): Promise<Address[]>
  saveAddress(address: Address): Promise<Address[]>
  removeAddress(id): Promise<Address[]>
}
authService: {
  login(email, password): Promise<{ token: string; user: User }>
  register({ name, email, password }): Promise<{ token: string; user: User }>
  me(token: string | null): Promise<User | null>
}
adminService: {
  getSummary(): Promise<{ products, creators, orders, pending, lowStock }>
  listUsers(), listCreators(), listProducts(), listCategories(),
  listOrders(), listPayments(), listCollaborations()
  reviewDemo(id, status: "pending"|"approved"|"declined"): Promise<Collaboration[]>
}
followStore: { read(): string[], toggle(id): string[] }   // sync, follows/creators
resetDemoData(): void
DEMO_PASSWORD, SESSION_KEY, CART_KEY, WISHLIST_KEY          // constants
```

`api.ts` must keep exporting `ApiError` and `apiRequest`, and select the adapter on
`import.meta.env.VITE_API_MODE` (`"mock"` default, `"rest"` for HTTP) using explicit
conditional exports — `export * from` cannot be dynamic.

## API endpoints

| Method | Path | Auth |
|---|---|---|
| POST | `/api/auth/register`, `/api/auth/login` | public |
| GET | `/api/auth/me` | Bearer |
| GET | `/api/products?search&category&maxPrice&sort&page&pageSize&creatorId` | public |
| GET | `/api/products/:id`, `/api/products/:id/related` | public |
| POST | `/api/products` | creator \| admin |
| GET | `/api/categories`, `/api/creators`, `/api/creators/:id`, `/api/collections`, `/api/collections/:slug` | public |
| POST | `/api/collaborations` | public |
| GET | `/api/collaborations` | admin |
| PATCH | `/api/collaborations/:id` | admin |
| GET/POST/PATCH/DELETE | `/api/cart` | Bearer |
| GET/PUT | `/api/wishlist` | Bearer |
| GET | `/api/orders?userId=&creatorId=` | Bearer |
| POST | `/api/orders` (checkout → Order + Payment) | Bearer |
| GET | `/api/payments` | admin |
| GET | `/api/users`, `/api/users/me/addresses` (CRUD) | self \| admin |
| GET | `/api/admin/summary` | admin |

Server-side validation with `zod` on price, stock, ownership and role. The client
checks stay UX-only.

## Auth

- bcrypt for `passwordHash` (the model marks it `select: false`).
- JWT Bearer; the frontend stores it under `SESSION_KEY`
  (`elysian-session-v1`) — keep that exact key so `AuthContext` needs no change.
- Demo accounts (seeded): `ananya@example.test` (customer),
  `mira@example.test` (creator, linked to studio `mira` via `User.creatorId`),
  `studio@example.test` (admin). Shared password: `elysian123`.

## Phase 2 steps

1. `server/src/index.ts`: express + cors + json, mount `notFound`/`errorHandler`,
   `GET /api/health`, connect the store, then listen.
2. `server/src/store.ts`: in-memory arrays seeded from `src/data/mock.ts`
   (import it; do not copy it). Expose the operations the routes need.
3. `server/src/middleware/auth.ts`: `requireAuth`, `requireRole(...roles)`.
4. Routes per the table above.
5. `src/services/restAdapter.ts` implementing the contract with `apiRequest`.
6. `vite.config.ts`: `server: { proxy: { "/api": "http://localhost:4000" } }` so the
   app stays same-origin (no CORS config needed in the browser).
7. `.env.local` with `VITE_API_MODE=rest`.

**One place complexity lives:** the cart. Phase 1 keeps it in localStorage. For
Phase 2, have `cartService` call the API when a token exists and fall back to
localStorage when anonymous (merge on login). Do not change `StudioContext`.

**Exit criteria:** every endpoint answers correctly under curl; the app on
`VITE_API_MODE=rest` is behaviourally indistinguishable from `mock`; no component
references an adapter directly.

## Phase 3 steps

1. `server/src/seed.ts`: connect, wipe the 10 collections, insert from
   `src/data/mock.ts`, bcrypt-hash the demo passwords, set
   `User.creatorId = "mira"` for the creator account and
   `Address.userId = "demo-customer"` for the seeded address.
2. Swap `server/src/store.ts` internals for Mongoose queries — **same function
   signatures**, so routes are untouched.
3. Confirm the declared indexes exist (unique `users.email`, unique `products.id`,
   `products.{categoryId,creatorId,status}`, text index on
   `products.{name,description,material}`, `orders.userId`,
   `collaborations.status`, unique `carts.userId`, `addresses.userId`).
4. Make checkout **transactional** (Order + Payment in one `session`), or the DB
   can hold an order with no payment.
5. `/api/admin/summary` should use a real **aggregation pipeline** (revenue by
   creator, low stock, pending collaborations) — this is the DBS showcase.

**Exit criteria:** every page renders from MongoDB; Compass shows data matching
the UI.

## Verification

```sh
npm run typecheck && npm run lint && npm test && npm run build

npm run dev:api
curl -s localhost:4000/api/health
curl -s localhost:4000/api/products | head -c 300
curl -s -X POST localhost:4000/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"ananya@example.test","password":"elysian123"}'

VITE_API_MODE=rest npm run dev     # click every flow

npm run seed                        # Phase 3
npm run test:e2e                    # currently 23 tests; carry-over: confirm 23/23
```

Also: `playwright.config.ts` `webServer` must become an **array** so the API and
Vite both start, and the suite must seed first.

## Connecting MongoDB Compass

1. MongoDB Server service must be **Running** (it is; port 27017 is listening).
2. Compass → **+ Add new connection** → `mongodb://127.0.0.1:27017` → Connect.
3. After `npm run seed`, database **`elysian`** appears with 10 collections.

## Loose ends from Phase 1

- `src/components/ui.tsx` `DemoNotice` still says "Changes stay in this browser
  session" — now inaccurate (state persists). Fix the copy once, deliberately.
- `src/pages/Info.tsx` privacy page describes only bag/wishlist in local storage;
  broaden it.
- Main bundle is ~166 KB gzip vs ~98.5 KB in `VALIDATION.md` (React 19 + Router 7
  + catalogue). Investigate/lazy-load `Home` in Phase 4; it is a warning, not an
  error.
