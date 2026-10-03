# Codex Dynamics

Codex Dynamics is an agency website with a CRM and a client portal, backed by PHP APIs and SQLite.

## Run & Operate

- The `artifacts/codex-dynamics: web` workflow starts the React/Vite frontend.
- The `artifacts/api-server: API Server` workflow runs the PHP API router.
- The local API uses SQLite at `artifacts/codex-dynamics/public/api/data/codex.sqlite`.
- PHP can use MySQL when configured with `DB_HOST`, `DB_NAME`, `DB_USER`, and `DB_PASS`, or a PHP `config.php`; without those settings it uses the bundled SQLite database.
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
- `artifacts/codex-dynamics/public/api/data/codex.sqlite` — bundled SQLite database used by the PHP API
- `artifacts/api-server/` — Replit API service wrapper that launches the PHP API router

## Gotchas

- Keep the Vite service on its workflow-provided `PORT`; the artifact port is not the default Vite port.
- The API service owns `/api`; API requests are not handled by the frontend artifact.
- Unknown PHP API paths return HTTP 404 rather than a successful placeholder response.
- Some CRM project editing and site configuration still use browser storage because those screens were carried over from an earlier frontend-only prototype and have not all been connected to PHP API routes. That state is browser-specific and does not sync across devices. The public contact form writes enquiries to `/api/crm/leads`; do not assume every CRM or portal screen is database-backed until its API path is verified.