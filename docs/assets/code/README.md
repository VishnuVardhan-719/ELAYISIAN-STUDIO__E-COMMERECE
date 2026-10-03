# Code screenshots — Elysian Studio

Rendered from inspected local source on 2026-10-03. Each figure shows real,
current code with the source line numbers in the gutter.

| Figure | Source | Lines | Shows |
| --- | --- | --- | --- |
| `01-mongoose-product-schema-and-indexes.png` | `database/src/models/Product.ts` | 1–30 | Document schema, `required`/`min`/`enum` constraints, four indexes including the compound text index. |
| `02-jwt-auth-and-rbac-middleware.png` | `backend/src/middleware/auth.ts` | 1–51 | `requireAuth` bearer-token verification with current-user lookup, plus `requireRole` for role checks. |
| `03-zod-validation-and-ownership-checks.png` | `backend/src/routes/orders.ts` | 15–62 | Zod request schemas (address regex, positive quantities) and the 403 ownership branches on `GET /orders`. |
| `04-atomic-checkout-and-rollback.png` | `backend/src/store.ts` | 618–662 | Guarded `$gte` stock decrement, session-scoped writes, `mongoose.connection.transaction`, and the compensating rollback path. |
| `05-service-layer-adapter-seam.png` | `frontend/src/services/api.ts` | 1–21 | The single seam that selects the mock or REST adapter behind one export surface. |

## Markdown to paste into `docs/jury/Elysian_Studio_Jury_Guide.md`

```markdown
![Product schema, constraints and indexes](../assets/code/01-mongoose-product-schema-and-indexes.png)
*Figure 1 — Product document schema with constraint and index declarations (`database/src/models/Product.ts`).*

![JWT verification and role-based access control](../assets/code/02-jwt-auth-and-rbac-middleware.png)
*Figure 2 — JWT verification and role-based access control (`backend/src/middleware/auth.ts`).*

![Server-side validation and ownership enforcement](../assets/code/03-zod-validation-and-ownership-checks.png)
*Figure 3 — Zod validation and server-side ownership enforcement (`backend/src/routes/orders.ts`).*

![Atomic checkout: guarded stock writes and transaction rollback](../assets/code/04-atomic-checkout-and-rollback.png)
*Figure 4 — Atomic checkout with transaction support and compensating rollback (`backend/src/store.ts`).*

![Single service seam: mock adapter or REST adapter](../assets/code/05-service-layer-adapter-seam.png)
*Figure 5 — The service seam that swaps the mock adapter for the REST adapter (`frontend/src/services/api.ts`).*
```

## Regenerating

The renderer lives in `.scratch/code-shots/render.cjs` (git-ignored). Change a
`start`/`end` range or add an entry to `SNIPPETS`, then:

```sh
cd .scratch/code-shots && node render.cjs
```

Images are written at 2× device scale (2240 px wide) so they stay sharp when
scaled down in Word or a slide deck.
