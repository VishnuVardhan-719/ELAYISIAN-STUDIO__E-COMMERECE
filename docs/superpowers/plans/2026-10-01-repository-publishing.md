# Repository Publishing Implementation Plan

> **For agentic workers:** Use executing-plans to complete the checked tasks inline.

**Goal:** Publish the existing Elysian Studio project with an accurate README and the user's exact branding image, if its source file is accessible.

**Architecture:** Preserve the frontend/backend/database reorganization and the existing single root dependency installation. Change only documentation and local-artifact exclusions; do not change application behavior.

**Tech Stack:** React 19, Vite 6, TypeScript, Express 5, Mongoose 9, MongoDB, Vitest, Playwright.

**Spec:** The user requested a GitHub push, a complete README, and preservation of the attached Elysian Studio logo.

## Global Constraints

- Preserve the existing remote history and both project-review PDFs; never force-push.
- Exclude private environments, credentials, logs, generated output, and scratch files.
- Do not seed or reset the development database.
- Preserve UI strings, domain shapes, and the service-layer boundary.
- Do not recreate or substitute the supplied logo if its exact source is unavailable.

## Task 1: Review and document

- [x] Inspect Git status, fetch origin, and confirm the publication is a fast-forward.
- [x] Verify setup, commands, environment examples, test isolation, and demo limitations against source.
- [x] Update the root README with project presentation, screenshots, setup, LAN access, architecture, and limitations.
- [x] Recover the exact supplied attachment as `docs/assets/elysian-studio-logo.png` and embed it in the README. Its SHA-256 is `fcd8ea4d633f0e373480222fa2bb07057e4ec425c5671324bca3fe08e98a2851`.
- [x] Ignore `.scratch/` and `.freebuff/` without deleting their contents.

## Task 2: Validate and publish

- [x] Run `npm run typecheck`, `npm run lint`, and `npm run build`.
- [x] Run unit/integration tests with one worker and MongoDB available, using only isolated test databases: 91 tests passed across eight files.
- [x] Verify all 23 local README links/images and referenced script names, tracked assets, and unchanged project-review PDFs.
- [x] Review the staged file list and scan for private credentials before committing.

## Publication handoff

After these checks, commit the complete project and documentation with an explicit message, push `main` to `origin` normally, and verify the remote commit matches `HEAD`. Report the actual published commit and validation results. Restore the MongoDB service to its original stopped state after validation; do not start development servers as part of publishing. No new browser-suite run is claimed by this task.