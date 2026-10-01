# Project brief

This is the original Phase 1 structure snapshot. For the current frontend,
backend, and database paths and REST/MongoDB status, read `activeContext.md`.

**What it is:** Elysian Studio — a handmade-marketplace + creator-collaboration
demo, built as a Database Systems Engineering project.

**Stack:** React 19, Vite 6, TypeScript 5.8, React Router 7, CSS Modules, CSS
design tokens (`src/styles/tokens.css`, `global.css`). Tests: Vitest + Testing
Library (unit), Playwright + axe (e2e/a11y).

**Run:**
```sh
npm run dev        # http://127.0.0.1:5173
npm run typecheck && npm run lint && npm test && npm run build
npm run test:e2e
```

**Structure map:**
```
src/
  App.tsx              routes + AuthProvider + StudioProvider
  types/domain.ts      the frozen entity interfaces
  data/mock.ts         seed catalogue (the ONLY seed source)
  data/assets.ts       image path map
  services/api.ts      the service seam (re-exports an adapter)
  services/mockAdapter.ts   current adapter (Phase 1)
  services/store.ts    localStorage-backed demo store
  context/AuthContext.tsx    session (mock, Phase 1)
  context/StudioContext.tsx  cart / wishlist / follows / toast
  hooks/useResource.ts async load helper
  pages/*              route components
  components/*         UI primitives
server/                Phase 2/3 backend (scaffolded, not wired)
```

**Data flow:** component → `src/services/api` → adapter → store. Components never
know where data comes from, which is what makes the Phase 2 swap cheap.
