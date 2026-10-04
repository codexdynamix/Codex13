# Codex Dynamics

Codex Dynamics is an agency website with a CRM and a client portal, backed by PHP APIs and SQLite.

## Run & Operate

- On a fresh workspace, install the locked dependencies with `npm ci` from the repository root.
- The `artifacts/codex-dynamics: web` workflow starts the React/Vite frontend.
- The `artifacts/api-server: API Server` workflow runs the PHP API router.
- Start both workflows for a complete preview; the API is served under `/api`.
- The local API uses SQLite at `artifacts/codex-dynamics/data/codex.sqlite` (outside the public API directory).
- A separate populated SQLite copy exists under `artifacts/codex-dynamics/artifacts/codex-dynamics/data/`; it is intentionally inactive and must remain untouched unless the user explicitly requests a data import or switch.
- PHP can use MySQL when configured with `DB_HOST`, `DB_NAME`, `DB_USER`, and `DB_PASS`, or a PHP `config.php`; without those settings it uses the bundled SQLite database.
- The Replit deployment filesystem is not durable across app restarts or republishing. Do not use the local SQLite file as the production CRM database; configure a durable MySQL database before publishing for real customer data. No production database migration has been performed.
- Client website/mail credentials and accounting are managed only from the Super Admin client profile. The client portal uses owner-checked authenticated routes for access details, inbox reads, and replies.
- Saved website and mailbox passwords are encrypted using a key derived from `SESSION_SECRET`. Keep that secret stable across deployments and backups; changing it makes already-saved passwords unreadable until they are re-entered.
- In-app mail uses the PHP IMAP extension plus the configured IMAP/SMTP hosts and ports (Hostinger defaults: IMAP SSL 993, SMTP SSL 465). Configure each client mailbox in the Super Admin profile and verify it with that mailbox before relying on mail delivery.
- Accounting records are persistent invoices, payments, and receipt numbers. Invoice line items can be categorized as project creation, hosting, domain, maintenance, or other; drafts are hidden from the client portal.
- The Super Admin Accounting workspace and the Accounting section in each client profile use the same invoice, payment, and recurring-service records. The workspace summarizes monthly activity, open and overdue balances, and scheduled monthly-equivalent service amounts; all totals stay grouped by currency.
- Frontend typecheck: `npm run typecheck`; lint: `npm run lint`; PHP integration tests: `npm run test:api`
- Local dev outside Replit: run `npm run dev --workspace=@workspace/api-server` (PHP on :8080) and `npm run dev`; Vite proxies `/api` to `API_PROXY_TARGET` (default `http://127.0.0.1:8080`).
- Hostinger package: `npm run build && npm run package:hostinger` writes `artifacts/codex-dynamics/dist/hostinger-public_html.zip` (frontend build + `public/api`, excluding `data/` and `config.php`). The frontend builds to `artifacts/codex-dynamics/dist/public`.
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
- `artifacts/api-server/` — Replit API service wrapper (package.json scripts only) that launches the PHP API router
- `scripts/admin-api.integration.test.mjs` — PHP API integration tests (isolated temp SQLite per run)

## Gotchas

- Keep the Vite service on its workflow-provided `PORT`; the artifact port is not the default Vite port.
- The API service owns `/api`; API requests are not handled by the frontend artifact.
- Unknown PHP API paths return HTTP 404 rather than a successful placeholder response.
- The public contact form writes leads to `/api/crm/leads`. The Enquiries workspace now reads `/api/admin/leads` and saves lead status changes, manual intake, and deletes through authenticated PHP routes, so those records share the database and reload across sessions.
- PHP supports authenticated lead CSV import/list/search/create/read/edit/soft-delete/restore, assignment, and client password routes. Setting a password for a lead creates or updates the matching portal account; a lead without a password is not yet a portal login. CSV password values provision portal accounts during import. Portal passwords are hashed in `portal_clients`.
- Client/lead creation and identity edits reject duplicate email addresses or phone numbers across leads and portal accounts; phone comparisons ignore punctuation and spacing. Do not silently delete or merge any legacy duplicates.
- Other frontend admin features still reference API paths that the PHP router does not implement, including advanced lead bulk/comment/bin actions; notification administration, client workspaces, signup/reset-request queues, settings, appointments, and parts of messaging. Those screens may still use local mock data or fail and need a separate route-coverage pass.
- Some CRM project editing and site configuration still use browser storage; that state is browser-specific and does not sync across devices. Verify each screen's API before treating it as database-backed.