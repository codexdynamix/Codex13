<?php
/**
 * Codex Dynamics - Database & Hostinger Shared Hosting Configuration
 * 
 * If using Hostinger MySQL / MariaDB, rename or copy this file to:
 *   config.php
 * and fill in your database details below.
 * 
 * If config.php is not present, Codex Dynamics automatically uses zero-config
 * SQLite stored safely in public/api/data/codex.sqlite.
 */

return [
    // Hostinger MySQL Host (typically 'localhost' or '127.0.0.1' on Hostinger cPanel/hPanel)
    'db_host' => 'localhost',

    // Hostinger Database Name (e.g. 'u123456789_codex')
    'db_name' => 'codex_dynamics',

    // Hostinger Database Username (e.g. 'u123456789_admin')
    'db_user' => 'codex_user',

    // Hostinger Database Password
    'db_pass' => 'your_strong_password_here',
];
