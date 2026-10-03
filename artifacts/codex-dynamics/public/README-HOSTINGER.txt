=======================================================
CODEX DYNAMICS - HOSTINGER SHARED HOSTING DEPLOYMENT
=======================================================

HOW TO DEPLOY ON HOSTINGER (takes under 60 seconds):
1. Log in to your Hostinger hPanel (https://hpanel.hostinger.com).
2. Go to "Websites" -> Click "Manage" on your website.
3. Open "File Manager" -> Navigate to the "public_html" directory.
4. Upload all files from the build output (or dist/) directly into public_html.
   Ensure that:
   - index.html, .htaccess, and assets/ sit directly inside public_html
   - api/ folder sits in public_html/api/
5. That's it! Your website, client portal, and CRM backoffice are live immediately.

DATABASE CONFIGURATION (TWO FLEXIBLE OPTIONS):
Option A: Zero-Config SQLite (Default)
  - No database setup required. Codex Dynamics automatically creates and uses
    public/api/data/codex.sqlite safely protected by .htaccess.
  - Full write/read permissions for leads, notifications, chat messages, and audit logs.

Option B: Hostinger MySQL / MariaDB Database
  - In Hostinger hPanel -> Databases -> MySQL Databases, create a database and user.
  - In public_html/api/, copy config.example.php to config.php.
  - Enter your DB_HOST (usually 'localhost'), DB_NAME, DB_USER, and DB_PASS.
  - Codex Dynamics will automatically bootstrap all tables upon first request.

WHAT IS INCLUDED & WORKING:
- Complete High-Performance Public Agency Site:
    * Hero showcases, interactive service tabs, portfolio grid, live booking modal.
    * Inbound inquiries submitted from any contact form directly insert into SQL database.
- Admin CRM Backoffice (/admin):
    * Instant search for clients by name or email with live suggestions.
    * Lead Profile Modal with full credentials management (view/edit client passwords).
    * Bidirectional Support Chat directly synced with client portal tickets.
    * Client Activity timeline showing logins, inquiries, and page views.
    * Content Studio for publishing blog articles, managing projects, and client testimonials.
    * Projects tab with toggle to hide or show projects on the live site.
- Client Portal (/portal):
    * Client login with email & admin-assigned password.
    * Dedicated Support Messaging channel.
    * Real-time Notifications Center.
    * Project overview and invoice history.
=======================================================
