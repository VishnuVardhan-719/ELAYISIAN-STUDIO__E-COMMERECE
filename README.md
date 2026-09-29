# Elysian Studio

A complete frontend demonstration of a handmade marketplace and creator collaboration platform. Built for a Database Systems Engineering project with React, Vite, TypeScript, React Router, CSS Modules, and CSS design tokens.

## Run locally

Use Node.js 22 LTS and npm. Node 26 on Windows showed intermittent test-worker startup errors during parallel validation; Node 22 is the recommended runtime for this project.

```sh
npm ci
npm run dev
```

Open the localhost address printed by Vite. The app uses browser routing; production hosts must rewrite non-asset requests to `index.html`.

## Validation

```sh
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

`npm run preview` serves the production build locally. End-to-end tests start Vite automatically if it is not already running. Browser test reports are written to `playwright-report/`; visual captures are in `screenshots/`.

## What is included

- Editorial homepage, collections, category discovery, creator directory and profiles.
- URL-based shop search, category and price filters, sorting and pagination.
- Product galleries, availability, wishlist, inventory-limited quantities and cart.
- Honest checkout preview with address validation and estimated shipping.
- Creator collaboration application with validation and local file selection.
- Demo customer account, sample orders, addresses, preferences and wishlist.
- Demo creator workspace with product creation/editing, orders and collaboration status.
- Demo admin workspace for users, creators, collaboration reviews, products, categories, inventory, orders and payment records.
- Responsive layouts, keyboard navigation, native modal focus management, reduced-motion support and accessible UI states.

## Demo boundaries

The product, creator and transaction data is illustrative. There is no authentication, backend, database, payment processing, email delivery or file upload service.

The shopping bag and wishlist persist in local storage. Other mutations stay in memory and reset when the page reloads. Account and creator profile forms demonstrate editing without claiming remote saves. Following a creator lasts for the current session. Application and checkout previews explicitly report that nothing was submitted or charged.

The account and dashboard routes are intentionally public demo screens. A production backend must enforce authorization; these routes are not access controls.

## Integration structure

`src/types/domain.ts` defines the marketplace entities. `src/services/api.ts` exports the service boundary and includes a REST request helper. `src/services/mockAdapter.ts` implements asynchronous mock operations behind that boundary. Components call services instead of scattering `fetch` calls.

To integrate a future Node.js/MySQL service, add a REST adapter implementing the existing service operations and select it in `src/services/api.ts`. Expected resource families: `/api/products`, `/api/categories`, `/api/creators`, `/api/collaborations`, `/api/cart`, `/api/orders`, `/api/payments`, and `/api/users`. The backend must validate prices, inventory, ownership and permissions independently. Only public configuration belongs in frontend environment variables.

Global design tokens live in `src/styles/tokens.css`; shared structural styles in `src/styles/global.css`; homepage and product cards use scoped CSS Modules. Route bundles are lazy-loaded. Fonts and imagery are bundled locally. `src/data/assets.ts` is the centralized asset map.

See `ASSETS.md` for image provenance and generated-image prompts.
