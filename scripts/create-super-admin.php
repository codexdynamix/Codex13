<?php
// Creates (or resets) a Super Admin account in a fresh database.
// Usage: ADMIN_PASSWORD='...' php scripts/create-super-admin.php admin@example.com "Admin Name"
// Uses the same database settings as the API (CODEX_SQLITE_PATH / MySQL config).
declare(strict_types=1);

if (PHP_SAPI !== 'cli') exit(1);
require_once __DIR__ . '/../artifacts/codex-dynamics/public/api/db.php';

[$script, $email, $name] = array_pad($argv, 3, '');
$email = strtolower(trim($email));
$name = trim($name) ?: 'Super Admin';
$password = (string)getenv('ADMIN_PASSWORD');
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($password) < 12) {
    fwrite(STDERR, "Usage: ADMIN_PASSWORD='<at least 12 chars>' php {$script} <email> [name]\n");
    exit(1);
}

$pdo = getDb();
$hash = password_hash($password, PASSWORD_DEFAULT);
$existing = $pdo->prepare('SELECT id FROM staff_users WHERE LOWER(email) = ?');
$existing->execute([$email]);
$id = $existing->fetchColumn();
if ($id) {
    $pdo->prepare("UPDATE staff_users SET password = ?, role = 'Super Admin', status = 'Active', deleted_at = NULL WHERE id = ?")
        ->execute([$hash, $id]);
    echo "Updated Super Admin {$email}\n";
} else {
    $pdo->prepare("INSERT INTO staff_users (id, email, password, name, role, status, capabilities, created_at)
        VALUES (?, ?, ?, ?, 'Super Admin', 'Active', '{}', ?)")
        ->execute(['staff_' . bin2hex(random_bytes(8)), $email, $hash, $name, date('c')]);
    echo "Created Super Admin {$email}\n";
}
