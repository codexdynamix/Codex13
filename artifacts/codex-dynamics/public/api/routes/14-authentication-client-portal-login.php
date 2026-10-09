<?php
/** Route group: AUTHENTICATION: CLIENT PORTAL LOGIN (included by index.php in order; uses its request globals). */

declare(strict_types=1);

// -----------------------------------------------------------------------------
// 14. AUTHENTICATION: CLIENT PORTAL LOGIN
// -----------------------------------------------------------------------------
if ($apiPath === '/portal/login' && $method === 'POST') {
    $email = strtolower(trim($input['email'] ?? ''));
    $password = $input['password'] ?? '';

    $stmt = $pdo->prepare("SELECT c.*, a.password_hash, a.status AS portal_status, a.portal_enabled, a.tier, a.last_login_at
        FROM clients c
        JOIN client_portal_access a ON a.client_id = c.id
        WHERE LOWER(TRIM(c.email)) = ?");
    $stmt->execute([$email]);
    $matches = $stmt->fetchAll(PDO::FETCH_ASSOC);
    if (count($matches) > 1) {
        jsonResponse(['ok' => false, 'code' => 'CLIENT_IDENTITY_REVIEW_REQUIRED', 'error' => 'This email is linked to multiple Client records. Contact support to resolve access.'], 409);
    }
    $client = $matches[0] ?? null;

    if (!$client) {
        jsonResponse(['ok' => false, 'error' => 'No client account found with this email address.'], 404);
    }
    if (empty($client['portal_enabled']) || $client['portal_status'] !== 'Active') {
        jsonResponse(['ok' => false, 'error' => 'This client portal account is currently disabled.'], 403);
    }
    if ($password === '' || empty($client['password_hash']) || !password_verify($password, (string)$client['password_hash'])) {
        jsonResponse(['ok' => false, 'error' => 'Incorrect password. Please try again.'], 401);
    }
    if (password_needs_rehash((string)$client['password_hash'], PASSWORD_DEFAULT)) {
        $rehash = password_hash($password, PASSWORD_DEFAULT);
        if ($rehash === false) jsonResponse(['ok' => false, 'error' => 'Could not securely update the password hash.'], 500);
        $pdo->prepare('UPDATE client_portal_access SET password_hash = ? WHERE client_id = ?')
            ->execute([$rehash, $client['id']]);
    }

    $now = date('c');
    $pdo->prepare('UPDATE client_portal_access SET last_login_at = ? WHERE client_id = ?')->execute([$now, $client['id']]);
    $client['status'] = $client['portal_status'];
    $token = bin2hex(random_bytes(32));
    $pdo->prepare("INSERT INTO portal_sessions (token_hash, client_id, expires_at, created_at) VALUES (?, ?, ?, ?)")
        ->execute([hash('sha256', $token), $client['id'], date('c', time() + 86400 * 14), $now]);

    setSessionCookie(PORTAL_SESSION_COOKIE, $token, time() + 86400 * 14);
    jsonResponse([
        'ok' => true,
        'token' => $token,
        'client' => [
            'id' => $client['id'],
            'name' => $client['name'],
            'company' => $client['company'],
            'email' => $client['email'],
            'phone' => $client['phone'],
            'address' => $client['address'],
            'country' => $client['country'],
            'countryCode' => $client['country_code'],
            'status' => $client['status'],
            'portalEnabled' => (bool)$client['portal_enabled'],
            'tier' => $client['tier'],
            'lastLoginAt' => $now,
            'createdAt' => $client['created_at'],
        ],
    ]);
}

if (preg_match('#^/admin/clients/([^/]+)/impersonate$#', $apiPath, $impersonationMatch) && $method === 'POST') {
    $actor = requireActiveAdminStaff($pdo, $adminSession);
    $clientId = rawurldecode($impersonationMatch[1]);
    requireVisibleLead($pdo, $actor, $clientId);
    $clientStmt = $pdo->prepare("SELECT c.*, a.portal_enabled, a.status AS portal_status, a.tier, a.last_login_at
        FROM clients c JOIN client_portal_access a ON a.client_id = c.id WHERE c.id = ?");
    $clientStmt->execute([$clientId]);
    $client = $clientStmt->fetch();
    if ($client) $client['status'] = $client['portal_status'];
    if (!$client || empty($client['portal_enabled']) || $client['status'] !== 'Active') {
        jsonResponse(['ok' => false, 'error' => 'This client does not have an active portal account.'], 409);
    }

    $now = date('c');
    $token = bin2hex(random_bytes(32));
    $expiresAt = date('c', time() + 1800);
    $pdo->prepare('INSERT INTO portal_sessions (token_hash, client_id, expires_at, created_at, is_impersonating, admin_user_id) VALUES (?, ?, ?, ?, 1, ?)')
        ->execute([hash('sha256', $token), $clientId, $expiresAt, $now, $actor['id']]);
    $pdo->prepare('INSERT INTO audit_logs (id, user_id, client_name, action, details, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        ->execute([
            'aud_' . bin2hex(random_bytes(8)),
            $clientId,
            $client['name'],
            'ADMIN_CLIENT_IMPERSONATION_START',
            'Staff member ' . $actor['id'] . ' started a read-only client portal session.',
            $now,
        ]);

    setSessionCookie(PORTAL_SESSION_COOKIE, $token, strtotime($expiresAt) ?: time() + 3600);
    jsonResponse([
        'ok' => true,
        'token' => $token,
        'expires_at' => $expiresAt,
        'client' => [
            'id' => $client['id'],
            'name' => $client['name'],
            'company' => $client['company'],
            'email' => $client['email'],
            'phone' => $client['phone'],
            'address' => $client['address'],
            'country' => $client['country'],
            'countryCode' => $client['country_code'],
            'status' => $client['status'],
            'portalEnabled' => (bool)$client['portal_enabled'],
            'tier' => $client['tier'],
            'lastLoginAt' => $client['last_login_at'],
            'createdAt' => $client['created_at'],
        ],
    ]);
}
