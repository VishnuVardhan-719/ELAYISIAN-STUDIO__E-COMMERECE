# Expo handoff — read this first

**Last updated:** October 3, 2026 (third pass) · **Branch:** `feat/expo-cloud-sandbox` · **Purpose:** compact state for the next session. Full detail lives in `docs/EXPO_README.md` and `docs/EXPO_IMPLEMENTATION_PLAN.md`.

> **Uncommitted work in the tree (October 3, 2026):** three batches — the two
> open-finding fixes (stored-cart normalization on read; mock-adapter email
> change), the account-preferences / creator-approval / admin-review work, and
> session-scoped save hardening in `frontend/src/pages/Account.tsx` (a save that
> finishes after a token change, a session event or an unmount writes nothing
> and notifies nothing; a failed second write reports partial success).
> Verified October 3, 2026 — **284 tests across 26 files** (frontend 133,
> backend 151), typecheck, lint, build — but not committed, not pushed, and
> **not deployed**. Live site still runs `b8d6157`. Logs:
> `.context/verification/resume-*.log`, `stale-cart-email-fix.log`.

## Where the project is right now

| Item | State |
| --- | --- |
| Live URL | `https://elysian-studio-expo.onrender.com` |
| Render plan | Free web service `elysian-studio-expo`, `not_suspended` |
| Database | MongoDB Atlas `elysian_expo` (local `elysian` preserved untouched) |
| Payments | Razorpay **test mode only**; no real money moves |
| Git | `feat/expo-cloud-sandbox` pushed at `b8d6157`; `main` untouched at `2d909ef`; working tree holds 3 uncommitted batches |
| Secrets | Only in ignored local files and Render env vars; never committed |

Deployment command used throughout: `node .scratch/render-deploy.cjs status|redeploy|logs`.
The script redacts credential values from any output it prints.

## Commit map — what is live

| Commit | Summary | Live? |
| --- | --- | --- |
| `643b5ab` | Mirror entrance flowers around a centred pivot | superseded |
| `612be8d` | Password visibility timer, customer/creator signup choice, no public admin | superseded |
| `be0b1ba` | Product-card quick-add, selected-address checkout, stock-aware quantities | superseded by `b8d6157` |
| `daf9832` | Exact password locators in tests + expo docs | test/docs only |
| `b8d6157` | Keep saved cart visible when quick-add fails during initial load | yes (verified after deploy) |
| pending | Normalize stored carts on read; migrate mock credentials on email change | no — uncommitted, undeployed |
| pending | Account preferences, creator-approval transaction, admin review errors, REST-mode account copy | no — uncommitted, undeployed |
| pending | Session-scoped save hardening + partial-success reporting in account settings | no — uncommitted, undeployed |

Render deploys by explicit `redeploy`, not auto-deploy, so a push alone does not
change the live site.

## Verification state

- October 3, 2026 run on the uncommitted tree: **284 tests across 26 files passed**
  (frontend 133, backend 151) in one uninterrupted run with
  `--maxWorkers=1 --no-file-parallelism`, plus typecheck, lint and the production
  build. Logs: `.context/verification/resume-full-tests.log`, `resume-typecheck.log`,
  `resume-lint.log`, `resume-build.log`. Browser end-to-end and hosted checks were
  **not** rerun for this state.
- Full automated run after `b8d6157`: **228 tests across 21 files passed**,
  plus lint, frontend/backend typecheck and the production build.
  Log: `.context/verification/cart-refresh-release.log`.
- Second-pass run after the two open-finding fixes (uncommitted): **230 tests
  across 21 files passed** in one uninterrupted run, plus lint, typecheck and
  the production build. Log: `.context/verification/stale-cart-email-fix.log`.
- Focused browser checks (`shopping-basics.spec.ts`): **3/3 passed** at 390px and
  1440px. Log: `cart-refresh-browser.log`.
- Broader browser suite earlier: **31/34**, then the three password-selector
  failures passed a corrected **3/3** rerun. This is not one uninterrupted
  34/34 run.
- Hosted shopping checks: quick-add, bag persistence after refresh, wishlist,
  View bag and no horizontal overflow at both widths.
  Evidence: `.context/verification/shopping-hosted-result.json`.
- Hosted health endpoint reports `{ok:true,database:"connected"}`.
- Post-deploy check after `b8d6157` (`.scratch/postdeploy-check.cjs`):
  health 200, payments config 200 `{enabled:true,mode:"test"}`, and `/shop`,
  `/products/expo-demo-bookmark`, `/account/orders` all return the SPA shell 200.
- Every fix followed red-then-green: the cart-refresh regression failed first
  (`.context/verification/cart-refresh-red.log`) then passed
  (`cart-refresh-green.log`).

## Demonstration sequence that is verified

1. Sign in as the customer from `.scratch/EXPO_LOGIN_DETAILS.txt`.
2. Add one Expo Demo Bookmark (₹1, zero shipping).
3. Checkout → Razorpay → **Netbanking → Canara Bank → Success**.
4. Wait for verification; if it shows pending, press **Check payment status**
   instead of paying again.
5. Show the same order in creator and admin views.

No real money was charged. Stock and receipt updates were verified once, with a
repeat reconciliation returning the same order without a second stock change.

## Known limitations — do not overclaim

- **Razorpay webhook:** the endpoint and signature verification are implemented
  and tested, but webhook registration in the Razorpay dashboard and hosted
  delivery are **not verified**.
- **UPI:** the account's methods response reports `upi: false`; desktop and
  mobile checkouts both showed no UPI. Needs Razorpay support confirmation.
  UPI Intent/QR testing is documented as live-mode only.
- **Google sign-in:** not implemented. Requires a Google OAuth web Client ID,
  this origin registered as an authorised JavaScript origin, and backend token
  verification. Do not add a button without those.
- **Free tier:** the service sleeps after idle periods; a cold load can take
  about a minute. A custom domain would not change this.
- **Hosted failure/cancellation payment paths:** automated tests pass, but there
  has been no complete hosted rehearsal of those two paths.
- **Browser suite:** see the 31/34 + 3/3 note above.

## Open findings not yet fixed

These came from read-only audits. Status after the third pass (October 3, 2026):

1. ~~Unavailable products can stay in a stored cart as invisible, hard-to-remove
   lines~~ **FIXED (uncommitted).** Backend `getCart` now returns
   `normalizeCart(items, await allProducts())`, matching the write-path contract:
   draft/zero-stock/unknown products no longer reach the UI in REST mode (mock
   mode already normalized on read). No UI strings changed. Regression test:
   `serverStore.test.ts` "drops unavailable lines when reading a stored cart".
2. ~~Mock/demo adapter only: changing an account email can break the next login~~
   **FIXED (uncommitted).** `mockAdapter.updateProfile` now captures the previous
   email before patching and migrates the credential digest. Regression test:
   `session.test.ts` "keeps sign-in working after an email change".
3. **Account-settings audit items — FIXED (uncommitted, October 3).** Three
   related findings: a settings save could claim success when the preference
   write failed; a save could still land after the session token changed, the
   `elysian-session-change` event fired or the component unmounted; and the
   panel claimed browser-local storage plus offered a demo reset in REST mode.
   The form now abandons a save whose `SESSION_KEY` or lifecycle revision
   changed, reports "Your profile was saved, but preferences could not be saved.
   Try again." for a partial write, exposes a load-error state with a **Try
   again** retry, and renders the account-storage copy without the demo reset
   outside mock mode. Coverage: `frontend/src/test/accountPreferences.test.tsx`,
   `frontend/src/test/preferences.test.ts`, `backend/tests/preferences.test.ts`.
   The teammate's original audit notes are still not in `.context/` or `docs/`;
   this list reconstructs them from the applied fixes.

## Housekeeping

- `docs/jury/` holds the current jury-guide source and exports, all regenerated
  October 3, 2026: `Elysian_Studio_Jury_Guide.md` (84673 B), `.docx` (2.1 MB) and
  a 36-page `.pdf` (3.17 MB) with 3 embedded images. `architecture.png` is new —
  the guide referenced it but the file did not exist, so the earlier export
  embedded the storefront screenshot in that slot instead. The two binaries are
  now newer than the Markdown, so no export lags the source. The stale
  `docs/jury/.preview/` renders of the superseded PDF were deleted; fresh
  diagram-page renders live in `.scratch/jury-diagram/preview/`. Generator and
  verifier: `.scratch/jury-diagram/build_jury_docs.py`, `verify_jury_docs.py`.
  The guide's evidence boundary quotes the frontend project's **133 passing
  tests**, which the October 3 run confirms exactly (284 = 133 + 151).
- Render API token and Razorpay secrets are in `backend/.env` (ignored). Earlier
  tokens were pasted into chat and must be treated as exposed — rotate them when
  deployment access is no longer needed.
- Private account passwords are in `backend/.env.expo-accounts` and the display
  sheet `.scratch/EXPO_LOGIN_DETAILS.txt`. Both ignored. Never print them.
- Working tree currently holds the three uncommitted batches noted at the top;
  it was clean at the `b8d6157` handoff commit. `.scratch/` and `.context/`
  are ignored scratch space.
- Known environment quirks: `NODE_ENV=production` is set machine-wide (always
  `npm install --include=dev`), and Node 26 has flaky Vitest worker startup —
  run tests with `--maxWorkers=1 --no-file-parallelism` and do not chase
  phantom failures. Also: with `NODE_ENV=production`, jsdom render tests fail
  with `React.act is not a function`; run the suite with `NODE_ENV=test`
  (cmd: `set NODE_ENV=test&& npx vitest run ...`).
