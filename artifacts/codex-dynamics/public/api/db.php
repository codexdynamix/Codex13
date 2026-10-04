<?php
/**
 * Codex Dynamics - Database Connection & Schema Layer
 * Designed for Hostinger Shared Hosting (PHP 8.0+ / SQLite PDO & MySQL PDO)
 */

declare(strict_types=1);

// Error handling & headers
ini_set('display_errors', '0');
error_reporting(E_ALL);

function jsonResponse(mixed $data, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    jsonResponse(['ok' => true]);
}

function getDb(): PDO {
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }

    $dbHost = getenv('DB_HOST') ?: null;
    $dbName = getenv('DB_NAME') ?: null;
    $dbUser = getenv('DB_USER') ?: null;
    $dbPass = getenv('DB_PASS') ?: '';

    // Check optional custom config file
    $configFile = __DIR__ . '/config.php';
    if (file_exists($configFile)) {
        $cfg = require $configFile;
        if (!empty($cfg['db_host'])) $dbHost = $cfg['db_host'];
        if (!empty($cfg['db_name'])) $dbName = $cfg['db_name'];
        if (!empty($cfg['db_user'])) $dbUser = $cfg['db_user'];
        if (isset($cfg['db_pass'])) $dbPass = $cfg['db_pass'];
    }

    $hasMysqlConfig = $dbHost && $dbName && $dbUser;
    if (!$hasMysqlConfig && getenv('NODE_ENV') === 'production') {
        error_log('Production database configuration is missing; refusing to create a local SQLite database.');
        throw new RuntimeException('Production requires DB_HOST, DB_NAME, and DB_USER. SQLite fallback is disabled.');
    }

    $testSqliteFile = getenv('CODEX_SQLITE_PATH') ?: null;
    if ($testSqliteFile && getenv('NODE_ENV') !== 'production') {
        // Isolated local database path for repeatable API integration tests.
        $testDataDir = dirname($testSqliteFile);
        if (!is_dir($testDataDir)) {
            @mkdir($testDataDir, 0755, true);
        }
        $pdo = new PDO("sqlite:{$testSqliteFile}", null, null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        $pdo->exec('PRAGMA journal_mode = WAL;');
        $pdo->exec('PRAGMA foreign_keys = ON;');
    } elseif ($hasMysqlConfig) {
        // MySQL connection
        $dsn = "mysql:host={$dbHost};dbname={$dbName};charset=utf8mb4";
        $pdo = new PDO($dsn, $dbUser, $dbPass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    } else {
        // Local development fallback. Production must use a configured persistent database.
        $dataDir = dirname(__DIR__, 2) . '/data';
        if (!is_dir($dataDir)) {
            @mkdir($dataDir, 0755, true);
        }
        $sqliteFile = $dataDir . '/codex.sqlite';
        $pdo = new PDO("sqlite:{$sqliteFile}", null, null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        $pdo->exec('PRAGMA journal_mode = WAL;');
        $pdo->exec('PRAGMA foreign_keys = ON;');
    }

    initSchema($pdo);
    return $pdo;
}

function ensureDatabaseColumn(PDO $pdo, string $table, string $column, string $definition): void {
    if (!preg_match('/^[A-Za-z0-9_]+$/', $table) || !preg_match('/^[A-Za-z0-9_]+$/', $column)) {
        throw new InvalidArgumentException('Invalid schema identifier.');
    }

    if ($pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite') {
        $columns = array_column($pdo->query("PRAGMA table_info(`{$table}`)")->fetchAll(PDO::FETCH_ASSOC), 'name');
        if (!in_array($column, $columns, true)) {
            $pdo->exec("ALTER TABLE `{$table}` ADD COLUMN `{$column}` {$definition}");
        }
        return;
    }

    $stmt = $pdo->query("SHOW COLUMNS FROM `{$table}` LIKE " . $pdo->quote($column));
    if (!$stmt->fetch()) {
        $pdo->exec("ALTER TABLE `{$table}` ADD COLUMN `{$column}` {$definition}");
    }
}

function initSchema(PDO $pdo): void {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS platform_settings (
            id VARCHAR(64) PRIMARY KEY,
            settings_json MEDIUMTEXT NOT NULL,
            site_config_json MEDIUMTEXT NULL,
            updated_by VARCHAR(128),
            updated_at VARCHAR(40) NOT NULL
        )
    ");

    // 1. Leads Table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS leads (
            id TEXT PRIMARY KEY,
            first_name TEXT,
            last_name TEXT,
            name TEXT,
            email TEXT,
            phone TEXT,
            country TEXT DEFAULT 'United Kingdom',
            country_code TEXT DEFAULT 'GB',
            stage TEXT DEFAULT 'New',
            status TEXT DEFAULT 'New',
            funnel TEXT DEFAULT 'General',
            company TEXT,
            service TEXT,
            budget TEXT,
            timeline TEXT,
            message TEXT,
            source TEXT DEFAULT 'direct',
            notes TEXT,
            client_password TEXT,
            assigned_office_id TEXT,
            assigned_team_id TEXT,
            assigned_team_leader_id TEXT,
            assigned_agent_id TEXT,
            assigned_by TEXT,
            is_online INTEGER DEFAULT 0,
            comment_history TEXT,
            status_history TEXT,
            appointments TEXT,
            activity_record TEXT,
            created_at TEXT,
            updated_at TEXT
        );
    ");
    // Keep soft-deleted leads out of the active CRM while allowing admins to
    // restore them. Existing SQLite/MySQL installs gain the nullable column
    // without replacing or rebuilding their current lead data.
    if ($pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite') {
        $leadColumns = array_column($pdo->query('PRAGMA table_info(leads)')->fetchAll(PDO::FETCH_ASSOC), 'name');
        if (!in_array('deleted_at', $leadColumns, true)) {
            $pdo->exec('ALTER TABLE leads ADD COLUMN deleted_at TEXT');
        }
    } else {
        $column = $pdo->query("SHOW COLUMNS FROM leads LIKE 'deleted_at'")->fetch();
        if (!$column) {
            $pdo->exec('ALTER TABLE leads ADD COLUMN deleted_at TEXT NULL');
        }
    }
    if ($pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite') {
        $leadColumns = array_column($pdo->query('PRAGMA table_info(leads)')->fetchAll(PDO::FETCH_ASSOC), 'name');
        if (!in_array('assigned_team_leader_id', $leadColumns, true)) {
            $pdo->exec('ALTER TABLE leads ADD COLUMN assigned_team_leader_id TEXT');
        }
    } else {
        $column = $pdo->query("SHOW COLUMNS FROM leads LIKE 'assigned_team_leader_id'")->fetch();
        if (!$column) {
            $pdo->exec('ALTER TABLE leads ADD COLUMN assigned_team_leader_id TEXT NULL');
        }
    }

    // 2. Clients / Users Table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS portal_clients (
            id TEXT PRIMARY KEY,
            name TEXT,
            company TEXT,
            email TEXT UNIQUE,
            password TEXT,
            phone TEXT,
            address TEXT,
            country TEXT DEFAULT 'United Kingdom',
            country_code TEXT DEFAULT 'GB',
            status TEXT DEFAULT 'Active',
            portal_enabled INTEGER DEFAULT 1,
            tier TEXT DEFAULT 'Enterprise Partner',
            last_login_at TEXT,
            created_at TEXT
        );
    ");

    // 3. Notifications Table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS notifications (
            id TEXT PRIMARY KEY,
            user_id TEXT, -- NULL means broadcast to all clients
            title TEXT,
            description TEXT,
            kind TEXT DEFAULT 'info',
            type TEXT DEFAULT 'project',
            is_read INTEGER DEFAULT 0,
            link TEXT,
            sent_by TEXT DEFAULT 'Admin',
            created_at TEXT
        );
    ");

    // 4. Chat Messages Table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            sender TEXT NOT NULL, -- 'agent' or 'client'
            sender_name TEXT,
            body TEXT NOT NULL,
            attachment_name TEXT,
            attachment_path TEXT,
            is_read INTEGER DEFAULT 0,
            created_at TEXT
        );
    ");
    ensureDatabaseColumn($pdo, 'messages', 'attachment_mime', 'TEXT NULL');
    ensureDatabaseColumn($pdo, 'messages', 'attachment_kind', 'TEXT NULL');

    // 5. Audit Log (Activity) Table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS audit_logs (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            client_name TEXT,
            action TEXT NOT NULL,
            details TEXT,
            ip_address TEXT,
            created_at TEXT
        );
    ");

    // 6. Portfolio Projects Table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            site_name TEXT,
            site_url TEXT,
            description TEXT,
            category TEXT DEFAULT 'Websites & Web Apps',
            image_url TEXT,
            is_published INTEGER DEFAULT 1,
            created_at TEXT
        );
    ");

    // 7. Blog Posts Table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS blogs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            slug TEXT UNIQUE,
            content TEXT,
            excerpt TEXT,
            category TEXT DEFAULT 'Engineering',
            author TEXT DEFAULT 'Codex Team',
            status TEXT DEFAULT 'published',
            featured_image TEXT,
            meta_description TEXT,
            reading_time INTEGER DEFAULT 5,
            created_at TEXT,
            updated_at TEXT
        );
    ");

    // 8. Reviews Table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            author TEXT NOT NULL,
            rating INTEGER DEFAULT 5,
            comment TEXT,
            is_published INTEGER DEFAULT 1,
            created_at TEXT
        );
    ");

    // 9. Backlinks Table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS backlinks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            url TEXT NOT NULL,
            notes TEXT,
            created_at TEXT
        );
    ");

    // 10. Staff Users Table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS staff_users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            name TEXT NOT NULL,
            role TEXT NOT NULL,
            office_id TEXT,
            team_id TEXT,
            status TEXT DEFAULT 'Active',
            capabilities TEXT,
            last_login_at TEXT,
            created_at TEXT,
            deleted_at TEXT,
            deleted_scope_type TEXT,
            deleted_scope_id TEXT
        );
    ");
    ensureDatabaseColumn($pdo, 'staff_users', 'deleted_at', 'TEXT NULL');
    ensureDatabaseColumn($pdo, 'staff_users', 'deleted_scope_type', 'VARCHAR(16) NULL');
    ensureDatabaseColumn($pdo, 'staff_users', 'deleted_scope_id', 'VARCHAR(128) NULL');

    // Migrate legacy staff passwords once. New writes are hashed at the API
    // boundary; this preserves existing passwords while removing plaintext
    // values from the database.
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS schema_migrations (
            id VARCHAR(100) PRIMARY KEY,
            applied_at VARCHAR(40) NOT NULL
        )
    ");
    $passwordMigration = 'hash_legacy_staff_passwords_v1';
    $migrationCheck = $pdo->prepare('SELECT id FROM schema_migrations WHERE id = ?');
    $migrationCheck->execute([$passwordMigration]);
    if (!$migrationCheck->fetchColumn()) {
        $legacyPasswords = $pdo->query('SELECT id, password FROM staff_users')->fetchAll(PDO::FETCH_ASSOC);
        $savePassword = $pdo->prepare('UPDATE staff_users SET password = ? WHERE id = ?');
        foreach ($legacyPasswords as $legacyPassword) {
            $passwordInfo = password_get_info((string)$legacyPassword['password']);
            if (($passwordInfo['algo'] ?? null) !== null) continue;
            $hash = password_hash((string)$legacyPassword['password'], PASSWORD_DEFAULT);
            if ($hash === false) throw new RuntimeException('Could not securely migrate a staff password.');
            $savePassword->execute([$hash, $legacyPassword['id']]);
        }
        $pdo->prepare('INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)')
            ->execute([$passwordMigration, date('c')]);
    }

    // 11. Client Websites Table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS client_websites (
            id TEXT PRIMARY KEY,
            client_id TEXT NOT NULL,
            name TEXT NOT NULL,
            domain TEXT NOT NULL,
            website_url TEXT NOT NULL,
            back_office_url TEXT NOT NULL,
            status TEXT DEFAULT 'Active',
            connection_status TEXT DEFAULT 'Connected',
            connector_id TEXT,
            connector_secret TEXT,
            access_enabled INTEGER DEFAULT 1,
            tech_stack TEXT,
            hosting_plan TEXT,
            ssl_status TEXT,
            created_at TEXT,
            updated_at TEXT
        );
    ");

    // 12. Client Projects Table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS client_projects (
            id TEXT PRIMARY KEY,
            client_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            service TEXT,
            status TEXT DEFAULT 'In Progress',
            progress INTEGER DEFAULT 0,
            start_date TEXT,
            target_date TEXT,
            team_lead TEXT,
            milestones TEXT,
            recent_updates TEXT,
            created_at TEXT,
            updated_at TEXT
        );
    ");

    // 13. Client Invoices Table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS client_invoices (
            id TEXT PRIMARY KEY,
            client_id TEXT NOT NULL,
            invoice_number TEXT NOT NULL,
            issue_date TEXT NOT NULL,
            due_date TEXT NOT NULL,
            paid_date TEXT,
            status TEXT DEFAULT 'Pending',
            currency TEXT DEFAULT 'USD',
            subtotal REAL DEFAULT 0,
            tax REAL DEFAULT 0,
            total REAL DEFAULT 0,
            amount_paid REAL DEFAULT 0,
            balance_due REAL DEFAULT 0,
            payment_method TEXT,
            line_items TEXT,
            notes TEXT,
            created_at TEXT
        );
    ");

    // 14. Client Payments Table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS client_payments (
            id TEXT PRIMARY KEY,
            client_id TEXT NOT NULL,
            invoice_id TEXT,
            receipt_number TEXT NOT NULL,
            payment_date TEXT NOT NULL,
            amount REAL DEFAULT 0,
            currency VARCHAR(3) DEFAULT 'USD',
            payment_method TEXT,
            transaction_reference TEXT,
            description TEXT,
            status TEXT DEFAULT 'Completed',
            created_at TEXT
        );
    ");
    if ($pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite') {
        $paymentColumns = array_column($pdo->query('PRAGMA table_info(client_payments)')->fetchAll(PDO::FETCH_ASSOC), 'name');
        if (!in_array('currency', $paymentColumns, true)) {
            $pdo->exec("ALTER TABLE client_payments ADD COLUMN currency VARCHAR(3) DEFAULT 'USD'");
        }
    } else {
        $currencyColumn = $pdo->query("SHOW COLUMNS FROM client_payments LIKE 'currency'")->fetch();
        if (!$currencyColumn) $pdo->exec("ALTER TABLE client_payments ADD COLUMN currency VARCHAR(3) DEFAULT 'USD'");
    }
    ensureDatabaseColumn($pdo, 'client_payments', 'void_reason', 'TEXT NULL');
    ensureDatabaseColumn($pdo, 'client_payments', 'voided_by', 'VARCHAR(191) NULL');
    ensureDatabaseColumn($pdo, 'client_payments', 'voided_at', 'TEXT NULL');

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS client_invoice_followups (
            id TEXT PRIMARY KEY,
            client_id TEXT NOT NULL,
            invoice_id TEXT NOT NULL,
            contact_date TEXT NOT NULL,
            contact_method TEXT NOT NULL,
            note TEXT NOT NULL,
            next_follow_up_date TEXT,
            created_by TEXT,
            created_at TEXT NOT NULL
        );
    ");
    if ($pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite') {
        $pdo->exec('CREATE INDEX IF NOT EXISTS idx_invoice_followups_client_date ON client_invoice_followups (client_id, contact_date)');
    } else {
        $followupIndex = $pdo->query("SHOW INDEX FROM client_invoice_followups WHERE Key_name = 'idx_invoice_followups_client_date'")->fetch();
        if (!$followupIndex) $pdo->exec('CREATE INDEX idx_invoice_followups_client_date ON client_invoice_followups (client_id, contact_date)');
    }

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS client_recurring_services (
            id VARCHAR(191) PRIMARY KEY,
            client_id VARCHAR(191) NOT NULL,
            service_name VARCHAR(191) NOT NULL,
            service_type VARCHAR(64) NOT NULL DEFAULT 'Other',
            description TEXT,
            amount DECIMAL(12,2) NOT NULL DEFAULT 0,
            currency VARCHAR(3) NOT NULL DEFAULT 'USD',
            billing_frequency VARCHAR(16) NOT NULL DEFAULT 'Monthly',
            start_date DATE NOT NULL,
            next_due_date DATE NOT NULL,
            status VARCHAR(16) NOT NULL DEFAULT 'Active',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
    ");

    // Client credentials are encrypted by the API before they are stored.
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS client_access_credentials (
            client_id VARCHAR(191) PRIMARY KEY,
            website_url TEXT,
            website_username TEXT,
            website_password_enc TEXT,
            email_address TEXT,
            webmail_url TEXT,
            email_password_enc TEXT,
            imap_host TEXT,
            imap_port INTEGER DEFAULT 993,
            smtp_host TEXT,
            smtp_port INTEGER DEFAULT 465,
            updated_at TEXT
        );
    ");

    // Global Hostinger Mail API credential and normalized client mailbox
    // assignments. The token value is always encrypted by the API layer.
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS hostinger_mail_integrations (
            id VARCHAR(64) PRIMARY KEY,
            encrypted_token TEXT NOT NULL,
            status VARCHAR(32) NOT NULL DEFAULT 'connected',
            last_tested_at VARCHAR(40),
            last_success_at VARCHAR(40),
            last_error_code VARCHAR(128),
            mailbox_count INTEGER NOT NULL DEFAULT 0,
            order_resource_id VARCHAR(191),
            created_by VARCHAR(191),
            updated_by VARCHAR(191),
            created_at VARCHAR(40) NOT NULL,
            updated_at VARCHAR(40) NOT NULL
        );
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS client_mailboxes (
            id VARCHAR(191) PRIMARY KEY,
            client_id VARCHAR(191) NOT NULL,
            provider VARCHAR(32) NOT NULL DEFAULT 'hostinger',
            provider_mailbox_id VARCHAR(191) NOT NULL UNIQUE,
            email_address VARCHAR(320) NOT NULL,
            display_name VARCHAR(191) NOT NULL,
            status VARCHAR(16) NOT NULL DEFAULT 'enabled',
            created_by VARCHAR(191),
            created_at VARCHAR(40) NOT NULL,
            updated_at VARCHAR(40) NOT NULL
        );
    ");
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS client_mail_drafts (
            id VARCHAR(191) PRIMARY KEY,
            client_id VARCHAR(191) NOT NULL,
            provider_mailbox_id VARCHAR(191) NOT NULL,
            draft_json MEDIUMTEXT NOT NULL,
            created_at VARCHAR(40) NOT NULL,
            updated_at VARCHAR(40) NOT NULL
        );
    ");
    if ($pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite') {
        $pdo->exec('CREATE INDEX IF NOT EXISTS idx_client_mailboxes_client_status ON client_mailboxes (client_id, status)');
        $pdo->exec('CREATE INDEX IF NOT EXISTS idx_client_mail_drafts_owner_mailbox ON client_mail_drafts (client_id, provider_mailbox_id, updated_at)');
    } else {
        $mailboxIndex = $pdo->query("SHOW INDEX FROM client_mailboxes WHERE Key_name = 'idx_client_mailboxes_client_status'")->fetch();
        if (!$mailboxIndex) $pdo->exec('CREATE INDEX idx_client_mailboxes_client_status ON client_mailboxes (client_id, status)');
        $draftIndex = $pdo->query("SHOW INDEX FROM client_mail_drafts WHERE Key_name = 'idx_client_mail_drafts_owner_mailbox'")->fetch();
        if (!$draftIndex) $pdo->exec('CREATE INDEX idx_client_mail_drafts_owner_mailbox ON client_mail_drafts (client_id, provider_mailbox_id, updated_at)');
    }

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS client_profile_permissions (
            client_id VARCHAR(191) NOT NULL,
            staff_id VARCHAR(191) NOT NULL,
            profile_section VARCHAR(32) NOT NULL,
            access_level VARCHAR(16) NOT NULL,
            granted_by VARCHAR(191) NOT NULL,
            updated_at TEXT NOT NULL,
            PRIMARY KEY (client_id, staff_id, profile_section)
        );
    ");

    // 15. Client Hosting Table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS client_hosting (
            id TEXT PRIMARY KEY,
            client_id TEXT NOT NULL,
            website_id TEXT,
            website_name TEXT,
            provider TEXT,
            plan TEXT,
            status TEXT DEFAULT 'Active',
            start_date TEXT,
            renewal_date TEXT,
            billing_frequency TEXT DEFAULT 'Monthly',
            amount REAL DEFAULT 0,
            currency VARCHAR(3) DEFAULT 'USD',
            auto_renew INTEGER DEFAULT 1,
            server_region TEXT,
            ip_address TEXT,
            uptime TEXT DEFAULT '99.99%'
        );
    ");
    ensureDatabaseColumn($pdo, 'client_hosting', 'currency', "VARCHAR(3) DEFAULT 'USD'");

    // 16. Client Domains Table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS client_domains (
            id TEXT PRIMARY KEY,
            client_id TEXT NOT NULL,
            domain_name TEXT NOT NULL,
            registrar TEXT DEFAULT 'Codex Managed',
            registration_date TEXT,
            expiration_date TEXT,
            renewal_amount DECIMAL(12,2) NULL,
            currency VARCHAR(3) DEFAULT 'USD',
            renewal_status TEXT DEFAULT 'Auto-Renew Active',
            auto_renew INTEGER DEFAULT 1,
            dns_management INTEGER DEFAULT 1,
            nameservers TEXT,
            records TEXT
        );
    ");
    ensureDatabaseColumn($pdo, 'client_domains', 'renewal_amount', 'DECIMAL(12,2) NULL');
    ensureDatabaseColumn($pdo, 'client_domains', 'currency', "VARCHAR(3) DEFAULT 'USD'");

    // 17. Client Support Tickets Table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS client_support_tickets (
            id TEXT PRIMARY KEY,
            client_id TEXT NOT NULL,
            ticket_number TEXT NOT NULL,
            subject TEXT NOT NULL,
            category TEXT DEFAULT 'General',
            priority TEXT DEFAULT 'Medium',
            status TEXT DEFAULT 'Open',
            assigned_agent TEXT,
            messages TEXT,
            created_at TEXT,
            updated_at TEXT
        );
    ");

    // 18. Client Files Table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS client_files (
            id TEXT PRIMARY KEY,
            client_id TEXT NOT NULL,
            name TEXT NOT NULL,
            category TEXT DEFAULT 'Deliverables',
            size TEXT,
            uploaded_at TEXT,
            file_type TEXT,
            download_url TEXT
        );
    ");

    // 19. Offices Table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS offices (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            manager_id TEXT,
            manager_name TEXT,
            manager_email TEXT,
            created_at TEXT,
            deleted_at TEXT,
            deleted_scope_type TEXT,
            deleted_scope_id TEXT
        );
    ");
    ensureDatabaseColumn($pdo, 'offices', 'deleted_at', 'TEXT NULL');
    ensureDatabaseColumn($pdo, 'offices', 'deleted_scope_type', 'VARCHAR(16) NULL');
    ensureDatabaseColumn($pdo, 'offices', 'deleted_scope_id', 'VARCHAR(128) NULL');

    // 20. Teams Table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS teams (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            office_id TEXT,
            leader_id TEXT,
            leader_name TEXT,
            max_size INTEGER DEFAULT 10,
            created_at TEXT,
            deleted_at TEXT,
            deleted_scope_type TEXT,
            deleted_scope_id TEXT
        );
    ");
    ensureDatabaseColumn($pdo, 'teams', 'deleted_at', 'TEXT NULL');
    ensureDatabaseColumn($pdo, 'teams', 'deleted_scope_type', 'VARCHAR(16) NULL');
    ensureDatabaseColumn($pdo, 'teams', 'deleted_scope_id', 'VARCHAR(128) NULL');

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS crm_assignment_restore (
            id VARCHAR(128) PRIMARY KEY,
            entity_type VARCHAR(16) NOT NULL,
            entity_id VARCHAR(128) NOT NULL,
            lead_id VARCHAR(128) NOT NULL,
            assigned_office_id VARCHAR(128),
            assigned_team_id VARCHAR(128),
            assigned_team_leader_id VARCHAR(128),
            assigned_agent_id VARCHAR(128),
            assigned_by VARCHAR(128)
        );
        CREATE TABLE IF NOT EXISTS lead_assignment_history (
            id VARCHAR(128) PRIMARY KEY,
            lead_id VARCHAR(128) NOT NULL,
            actor_id VARCHAR(128) NOT NULL,
            previous_assignment TEXT NOT NULL,
            new_assignment TEXT NOT NULL,
            created_at VARCHAR(40) NOT NULL
        )
    ");

    // Business data is created through the API. Do not repopulate deleted records
    // with sample rows when the database is empty.
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS admin_sessions (
            token_hash TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            created_at TEXT NOT NULL,
            last_seen_at TEXT NULL
        );
        CREATE TABLE IF NOT EXISTS portal_sessions (
            token_hash TEXT PRIMARY KEY,
            client_id TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            created_at TEXT NOT NULL,
            is_impersonating INTEGER NOT NULL DEFAULT 0,
            admin_user_id TEXT NULL
        );
        CREATE TABLE IF NOT EXISTS user_notification_reads (
            user_id TEXT NOT NULL,
            notification_id TEXT NOT NULL,
            read_at TEXT NOT NULL,
            PRIMARY KEY (user_id, notification_id)
        );
        CREATE TABLE IF NOT EXISTS admin_notifications (
            id VARCHAR(128) PRIMARY KEY,
            staff_user_id VARCHAR(128) NOT NULL,
            kind VARCHAR(64) NOT NULL DEFAULT 'info',
            title VARCHAR(255) NOT NULL,
            body TEXT,
            read_at TEXT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS crm_message_presence (
            client_id VARCHAR(128) NOT NULL,
            actor_type VARCHAR(16) NOT NULL,
            actor_id VARCHAR(128) NOT NULL,
            is_typing INTEGER NOT NULL DEFAULT 0,
            last_seen_at TEXT NOT NULL,
            PRIMARY KEY (client_id, actor_type, actor_id)
        );
        CREATE TABLE IF NOT EXISTS signup_requests (
            id VARCHAR(128) PRIMARY KEY,
            name TEXT NOT NULL,
            email VARCHAR(255) NOT NULL,
            request_data TEXT NOT NULL,
            status VARCHAR(32) NOT NULL DEFAULT 'pending',
            rejection_reason TEXT,
            verification_code_hash TEXT,
            verification_expires_at TEXT,
            verification_attempts INTEGER NOT NULL DEFAULT 0,
            client_id VARCHAR(128),
            lead_id VARCHAR(128),
            created_at TEXT NOT NULL,
            reviewed_at TEXT
        );
        CREATE TABLE IF NOT EXISTS password_reset_requests (
            user_id VARCHAR(128) PRIMARY KEY,
            requested_at TEXT NOT NULL,
            status VARCHAR(32) NOT NULL DEFAULT 'pending',
            code_hash TEXT,
            expires_at TEXT,
            sent_at TEXT,
            attempt_count INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS client_workspaces (
            user_id VARCHAR(128) PRIMARY KEY,
            workspace_json TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
    ");
    ensureDatabaseColumn($pdo, 'admin_sessions', 'last_seen_at', 'TEXT NULL');
    ensureDatabaseColumn($pdo, 'portal_sessions', 'is_impersonating', 'INTEGER NOT NULL DEFAULT 0');
    ensureDatabaseColumn($pdo, 'portal_sessions', 'admin_user_id', 'TEXT NULL');
}

function seedInitialData(PDO $pdo): void {
    // Demo rows are intentionally disabled. Retain this no-op temporarily so
    // older deployments that call this helper cannot repopulate deleted data.
    return;

    // Seed Clients if empty
    $count = (int)$pdo->query("SELECT COUNT(*) FROM portal_clients")->fetchColumn();
    if ($count === 0) {
        $now = date('c');
        $stmt = $pdo->prepare("
            INSERT INTO portal_clients (id, name, company, email, password, phone, address, country, country_code, status, portal_enabled, tier, last_login_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', 1, ?, ?, ?)
        ");
        $stmt->execute([
            'client_vance',
            'Eleanor Vance',
            'Vance Tech Capital',
            'eleanor.vance@vancetech.io',
            '',
            '+1 (415) 890-2341',
            '450 Mission St, Suite 1800, San Francisco, CA 94105',
            'United States',
            'US',
            'Enterprise Partner',
            date('c', time() - 3600),
            $now
        ]);
        $stmt->execute([
            'client_brody',
            'Marcus Brody',
            'Brody Luxury Goods',
            'marcus@brodydesign.co',
            '',
            '+44 20 7946 0912',
            '14 Berkeley Square, Mayfair, London W1J 6BL',
            'United Kingdom',
            'GB',
            'Growth Tier',
            date('c', time() - 7200),
            $now
        ]);
        $stmt->execute([
            'usr_client',
            'Alex Morgan',
            'Morgan Digital Media',
            'client@codexdynamics.com',
            '',
            '+1 (555) 234-5678',
            '777 Broadway, 12th Floor, New York, NY 10003',
            'United States',
            'US',
            'Dedicated Agency',
            date('c', time() - 1800),
            $now
        ]);
    }

    // Seed Leads if empty
    $leadCount = (int)$pdo->query("SELECT COUNT(*) FROM leads")->fetchColumn();
    if ($leadCount === 0) {
        $now = date('c');
        $stmt = $pdo->prepare("
            INSERT INTO leads (id, first_name, last_name, name, email, phone, country, country_code, stage, status, funnel, company, service, budget, timeline, message, source, notes, client_password, assigned_office_id, assigned_team_id, assigned_agent_id, comment_history, status_history, appointments, activity_record, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            'client_vance',
            'Eleanor',
            'Vance',
            'Eleanor Vance',
            'eleanor.vance@vancetech.io',
            '+1 (415) 890-2341',
            'United States',
            'US',
            'New',
            'New',
            'High-Performance Website',
            'Vance Tech Capital',
            'High-Performance Website',
            '$15,000 - $25,000',
            'Within 1 Month',
            'We need a complete rebuild of our venture fund corporate portal with real-time portfolio performance dashboards and interactive investor LP access.',
            'website_contact_modal',
            'High priority lead.',
            '',
            'of_london',
            'tm_alpha',
            'adm_ag',
            json_encode([['id' => 'c1', 'by_name' => 'Website Intake', 'text' => 'Intake from public modal', 'created_at' => $now]]),
            json_encode([['id' => 's1', 'from_stage' => 'New', 'to_stage' => 'New', 'by_name' => 'System', 'created_at' => $now]]),
            json_encode([]),
            json_encode(['pageViews' => 24, 'sessions' => 6, 'lastLogin' => date('c', time() - 3600)]),
            $now,
            $now
        ]);
        $stmt->execute([
            'client_brody',
            'Marcus',
            'Brody',
            'Marcus Brody',
            'marcus@brodydesign.co',
            '+44 20 7946 0912',
            'United Kingdom',
            'GB',
            'In Line',
            'In Line',
            'Web Design & UI/UX',
            'Brody Luxury Goods',
            'Web Design & UI/UX',
            '$10,000 - $18,000',
            'Immediate',
            'Looking for a bespoke e-commerce experience with 3D product previews and ultra-fast mobile checkout.',
            'website_contact_form',
            'Waiting for brand pack.',
            '',
            'of_london',
            'tm_alpha',
            'adm_ag',
            json_encode([]),
            json_encode([]),
            json_encode([]),
            json_encode(['pageViews' => 12, 'sessions' => 3, 'lastLogin' => date('c', time() - 7200)]),
            $now,
            $now
        ]);
    }

    // Seed Projects if empty
    $projCount = (int)$pdo->query("SELECT COUNT(*) FROM projects")->fetchColumn();
    if ($projCount === 0) {
        $now = date('c');
        $stmt = $pdo->prepare("
            INSERT INTO projects (title, site_name, site_url, description, category, image_url, is_published, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute(['Vance Tech Capital Portal', 'Vance Capital', 'https://vancetech.io', 'Next-generation venture capital portfolio management and investor dashboard.', 'Websites & Web Apps', '/hero/web-apps.jpg', 1, $now]);
        $stmt->execute(['Brody Luxury Storefront', 'Brody Goods', 'https://brodydesign.co', 'Bespoke high-conversion storefront with 3D product previews and instant checkout.', 'Websites & Web Apps', '/hero/design.jpg', 1, $now]);
        $stmt->execute(['Apex Telephony & CRM Gateway', 'Apex VoIP', 'https://apextelecom.net', 'Omnichannel calling system, VoIP routing, and automated sales pipeline engine.', 'CRMs & Calling Systems', '/services/crm-calling.jpg', 1, $now]);
        $stmt->execute(['Kroma Digital Studio', 'Kroma Brand', 'https://kromastudio.art', 'Identity guidelines, custom 3D design system, and multi-channel brand assets.', 'Graphic Design & Branding', '/services/graphic-design.jpg', 1, $now]);
    }

    // Seed Blogs if empty
    $blogCount = (int)$pdo->query("SELECT COUNT(*) FROM blogs")->fetchColumn();
    if ($blogCount === 0) {
        $now = date('c');
        $stmt = $pdo->prepare("
            INSERT INTO blogs (title, slug, content, excerpt, category, author, status, featured_image, meta_description, reading_time, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            'Engineering High-Throughput Web Applications on Edge Networks',
            'engineering-high-throughput-web-apps-edge',
            '<p>Modern enterprise platforms require sub-100ms global latency and zero-downtime rollouts. In this guide, we dive into how Codex Dynamics engineers edge architectures...</p>',
            'How modern edge networks, reactive client state, and distributed caching unlock instantaneous web experiences.',
            'Engineering',
            'Codex Architecture Team',
            'published',
            '/hero/web-dev.jpg',
            'Architecture blueprints for enterprise high-throughput web applications.',
            4,
            $now,
            $now
        ]);
        $stmt->execute([
            'The Blueprint for High-Converting Digital Storefronts',
            'blueprint-high-converting-storefronts',
            '<p>Conversion rate optimization starts with layout clarity, tactile typography, and frictionless checkout flows...</p>',
            'Strategic design patterns and technical optimizations that drive 3x conversion improvements for commerce brands.',
            'Design & UX',
            'Codex Creative Studio',
            'published',
            '/hero/design.jpg',
            'Design patterns and optimizations for high-converting ecommerce storefronts.',
            5,
            $now,
            $now
        ]);
    }

    // Seed Reviews if empty
    $revCount = (int)$pdo->query("SELECT COUNT(*) FROM reviews")->fetchColumn();
    if ($revCount === 0) {
        $now = date('c');
        $stmt = $pdo->prepare("
            INSERT INTO reviews (author, rating, comment, is_published, created_at)
            VALUES (?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            'Eleanor Vance (Vance Tech Capital)',
            5,
            'Codex Dynamics completely transformed our corporate presence. The client portal and real-time reporting have been a game changer for our LP relationships.',
            1,
            $now
        ]);
        $stmt->execute([
            'Marcus Brody (Brody Luxury Goods)',
            5,
            'Incredible execution speed and attention to detail. Our mobile conversion went up 42% in the first two weeks post-launch.',
            1,
            $now
        ]);
    }

    // Seed Offices & Teams
    $officeCount = (int)$pdo->query("SELECT COUNT(*) FROM offices")->fetchColumn();
    if ($officeCount === 0) {
        $now = date('c');
        $stmt = $pdo->prepare("
            INSERT INTO offices (id, name, manager_id, manager_name, manager_email, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute(['of_london', 'London Operations', 'adm_om', 'Olivia Manager', 'manager@codexdynamics.com', $now]);
        $stmt->execute(['of_newyork', 'New York Hub', null, 'Unassigned', '', $now]);
    }

    $teamCount = (int)$pdo->query("SELECT COUNT(*) FROM teams")->fetchColumn();
    if ($teamCount === 0) {
        $now = date('c');
        $stmt = $pdo->prepare("
            INSERT INTO teams (id, name, office_id, leader_id, leader_name, max_size, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute(['tm_alpha', 'Alpha Strategy', 'of_london', 'adm_tl', 'Thomas Leader', 10, $now]);
        $stmt->execute(['tm_beta', 'Beta Enterprise', 'of_newyork', null, 'Unassigned', 10, $now]);
    }
}
