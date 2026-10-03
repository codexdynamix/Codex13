# Codex Dynamics

Codex Dynamics is an agency website with a CRM and a client portal, backed by PHP APIs and SQLite.

## Run & Operate

- The `artifacts/codex-dynamics: web` workflow starts the React/Vite frontend.
- The `artifacts/api-server: API Server` workflow runs the PHP API router.
- The local API uses SQLite at `artifacts/codex-dynamics/data/codex.sqlite` (outside the public API directory).
- A separate populated SQLite copy exists under `artifacts/codex-dynamics/artifacts/codex-dynamics/data/`; it is intentionally inactive and must remain untouched unless the user explicitly requests a data import or switch.
- PHP can use MySQL when configured with `DB_HOST`, `DB_NAME`, `DB_USER`, and `DB_PASS`, or a PHP `config.php`; without those settings it uses the bundled SQLite database.
- The Replit deployment filesystem is not durable across app restarts or republishing. Do not use the local SQLite file as the production CRM database; configure a durable MySQL database before publishing for real customer data. No production database migration has been performed.
- Frontend typecheck: `pnpm --filter @workspace/codex-dynamics run typecheck`
- PHP syntax checks: `php -l artifacts/codex-dynamics/public/api/index.php` and `php -l artifacts/codex-dynamics/public/api/db.php`

## Stack

- React, TypeScript, Vite, and TanStack Router
- PHP 8.2 API with PDO
- SQLite by default; optional MySQL configuration for PHP hosting
- Node.js 24 for the Vite development server

## Where Things Live

- `artifacts/codex-dynamics/src/` — website, CRM, client portal, and frontend services
- `artifacts/codex-dynamics/public/api/index.php` — PHP API router
- `artifacts/codex-dynamics/public/api/db.php` — PDO connection, SQLite schema, and initial database seeding
- `artifacts/codex-dynamics/data/codex.sqlite` — local SQLite database used by the PHP API
- `artifacts/api-server/` — Replit API service wrapper that launches the PHP API router

## Gotchas

- Keep the Vite service on its workflow-provided `PORT`; the artifact port is not the default Vite port.
- The API service owns `/api`; API requests are not handled by the frontend artifact.
- Unknown PHP API paths return HTTP 404 rather than a successful placeholder response.
- The public contact form writes leads to `/api/crm/leads`. The Enquiries workspace now reads `/api/admin/leads` and saves lead status changes, manual intake, and deletes through authenticated PHP routes, so those records share the database and reload across sessions.
- PHP supports authenticated lead list/search/create/read/edit/soft-delete/restore, assignment, and client password routes. Other frontend admin features still reference API paths that the PHP router does not implement, including advanced lead bulk/import/comment/bin actions; notification administration, client workspaces, signup/reset-request queues, settings, appointments, and parts of messaging. Those screens may still use local mock data or fail and need a separate route-coverage pass.
- Some CRM project editing and site configuration still use browser storage; that state is browser-specific and does not sync across devices. Verify each screen's API before treating it as database-backed.