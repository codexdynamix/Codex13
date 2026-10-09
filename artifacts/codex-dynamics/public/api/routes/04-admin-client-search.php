<?php
/** Route group: ADMIN: CLIENT SEARCH (Fast suggestions while typing) (included by index.php in order; uses its request globals). */

declare(strict_types=1);

// -----------------------------------------------------------------------------
// 4. ADMIN: CLIENT SEARCH (Fast suggestions while typing)
// -----------------------------------------------------------------------------
if ($apiPath === '/admin/settings') {
    requireSuperAdmin($pdo, $adminSession);

    if ($method === 'GET') {
        $record = readPlatformSettingsRecord($pdo);
        jsonResponse(['ok' => true, ...$record]);
    }
    if ($method !== 'PUT') {
        jsonResponse(['ok' => false, 'error' => 'Method not allowed.'], 405);
    }

    $hasSettings = array_key_exists('settings', $input);
    $hasSiteConfig = array_key_exists('site_config', $input);
    if (!$hasSettings && !$hasSiteConfig) {
        jsonResponse(['ok' => false, 'error' => 'Provide settings or site_config to update.'], 400);
    }

    $settings = $input['settings'] ?? [];
    if (!is_array($settings)) {
        jsonResponse(['ok' => false, 'error' => 'Settings must be an object.'], 400);
    }
    $allowedSettings = [
        'platformName', 'platformAbbreviation', 'platformYear',
        'platformPhone', 'platformAddress', 'supportEmail',
        'heroHeader', 'heroStatement', 'baseCurrency',
        'registrationEnabled', 'twoFactorAuthEnabled',
        'sessionTimeoutMinutes', 'maxFailedLoginAttempts',
        'primaryColor', 'secondaryColor', 'accentColor',
        'buttonColor', 'backgroundColor', 'textColor', 'customThemes', 'crmTheme',
    ];
    foreach ($settings as $key => $value) {
        if (!in_array($key, $allowedSettings, true)) {
            jsonResponse(['ok' => false, 'error' => "Unsupported platform setting: {$key}"], 400);
        }
        if (in_array($key, ['registrationEnabled', 'twoFactorAuthEnabled'], true) && !is_bool($value)) {
            jsonResponse(['ok' => false, 'error' => "{$key} must be a boolean."], 400);
        }
        if ($key === 'sessionTimeoutMinutes' && (!is_numeric($value) || (int)$value < 1 || (int)$value > 1440)) {
            jsonResponse(['ok' => false, 'error' => 'Session timeout must be between 1 and 1440 minutes.'], 400);
        }
        if ($key === 'maxFailedLoginAttempts' && (!is_numeric($value) || (int)$value < 1 || (int)$value > 20)) {
            jsonResponse(['ok' => false, 'error' => 'Failed login attempts must be between 1 and 20.'], 400);
        }
        if ($key === 'customThemes' && !is_array($value)) {
            jsonResponse(['ok' => false, 'error' => 'Custom themes must be an array.'], 400);
        }
        if ($key === 'crmTheme' && (!is_array($value) || strlen((string)json_encode($value)) > 10000)) {
            jsonResponse(['ok' => false, 'error' => 'CRM theme must be an object under 10,000 characters.'], 400);
        }
        if (!in_array($key, [
            'registrationEnabled', 'twoFactorAuthEnabled',
            'sessionTimeoutMinutes', 'maxFailedLoginAttempts', 'customThemes', 'crmTheme',
        ], true) && (!is_string($value) || strlen($value) > 10000)) {
            jsonResponse(['ok' => false, 'error' => "{$key} must be a string under 10,000 characters."], 400);
        }
    }

    $siteConfig = $input['site_config'] ?? null;
    if ($hasSiteConfig && $siteConfig !== null && !is_array($siteConfig)) {
        jsonResponse(['ok' => false, 'error' => 'Site configuration must be an object or null.'], 400);
    }
    try {
        $record = savePlatformSettingsRecord(
            $pdo,
            $settings,
            $siteConfig,
            (string)$adminSession['id'],
            $hasSiteConfig
        );
    } catch (LengthException $error) {
        jsonResponse(['ok' => false, 'error' => $error->getMessage()], 413);
    }
    jsonResponse(['ok' => true, ...$record]);
}

if (preg_match('#^/admin/users/([^/]+)/appointments$#', $apiPath, $appointmentMatch)
    && in_array($method, ['GET', 'POST'], true)) {
    $actor = requireActiveAdminStaff($pdo, $adminSession);
    $scope = buildAdminLeadScope(
        (string)$actor['role'],
        $actor['office_id'] !== null ? (string)$actor['office_id'] : null,
        $actor['team_id'] !== null ? (string)$actor['team_id'] : null,
        (string)$adminSession['id']
    );
    if ($scope === null) {
        jsonResponse(['ok' => false, 'error' => 'This account cannot access CRM leads.'], 403);
    }

    $userId = rawurldecode($appointmentMatch[1]);
    [$scopeSql, $scopeParams] = $scope;
    $sql = 'SELECT l.* FROM leads l WHERE l.id = ?';
    if ($scopeSql !== '') $sql .= " AND ({$scopeSql})";
    $leadStmt = $pdo->prepare($sql);
    $leadStmt->execute(array_merge([$userId], $scopeParams));
    $lead = $leadStmt->fetch();
    if (!$lead) {
        jsonResponse(['ok' => false, 'error' => 'Client not found or unavailable.'], 404);
    }

    $appointments = json_decode((string)($lead['appointments'] ?? '[]'), true);
    if (!is_array($appointments)) {
        jsonResponse(['ok' => false, 'error' => 'Stored appointment data is invalid.'], 500);
    }
    if ($method === 'GET') {
        jsonResponse(['ok' => true, 'appointments' => $appointments]);
    }

    $title = trim((string)($input['title'] ?? ''));
    $date = trim((string)($input['date'] ?? ''));
    $time = trim((string)($input['time'] ?? ''));
    $notes = trim((string)($input['notes'] ?? ''));
    $type = trim((string)($input['type'] ?? 'call')) ?: 'call';
    if ($title === '' || strlen($title) > 200) {
        jsonResponse(['ok' => false, 'error' => 'Appointment title is required and must be under 200 characters.'], 400);
    }
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)
        || !checkdate((int)substr($date, 5, 2), (int)substr($date, 8, 2), (int)substr($date, 0, 4))) {
        jsonResponse(['ok' => false, 'error' => 'Appointment date must be a valid YYYY-MM-DD date.'], 400);
    }
    if ($time !== '' && (!preg_match('/^\d{2}:\d{2}$/', $time)
        || (int)substr($time, 0, 2) > 23 || (int)substr($time, 3, 2) > 59)) {
        jsonResponse(['ok' => false, 'error' => 'Appointment time must use HH:MM format.'], 400);
    }
    if (strlen($notes) > 5000 || strlen($type) > 40) {
        jsonResponse(['ok' => false, 'error' => 'Appointment notes or type is too long.'], 400);
    }
    if (count($appointments) >= 50) {
        jsonResponse(['ok' => false, 'error' => 'This client already has 50 appointments. Remove one before adding another.'], 409);
    }

    $appointment = [
        'id' => 'appt_' . bin2hex(random_bytes(8)),
        'date' => $date,
        'time' => $time,
        'title' => $title,
        'notes' => $notes,
        'type' => $type,
        'createdBy' => $actor['name'],
        'createdAt' => date('c'),
        'status' => 'scheduled',
    ];
    $appointments[] = $appointment;
    $updateStmt = $pdo->prepare('UPDATE leads SET appointments = ?, updated_at = ? WHERE id = ?');
    $updateStmt->execute([
        json_encode($appointments, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
        date('c'),
        $userId,
    ]);
    jsonResponse(['ok' => true, 'appointment' => $appointment, 'appointments' => $appointments]);
}

if ($apiPath === '/admin/users') {
    $search = trim($_GET['search'] ?? '');
    $limit = min(200, max(1, (int)($_GET['limit'] ?? 50)));

    if ($search !== '') {
        $term = "%{$search}%";
        $stmt = $pdo->prepare("
            SELECT c.id, c.name, c.company, c.email, c.phone, c.status,
                   COALESCE(a.portal_enabled, 0) AS portal_enabled, a.tier, a.last_login_at, c.created_at
            FROM clients c LEFT JOIN client_portal_access a ON a.client_id = c.id
            WHERE c.name LIKE ? OR c.email LIKE ? OR c.company LIKE ? OR c.id LIKE ?
            ORDER BY c.name ASC LIMIT ?
        ");
        $stmt->execute([$term, $term, $term, $term, $limit]);
        $clients = $stmt->fetchAll();
    } else {
        $stmt = $pdo->prepare("SELECT c.id, c.name, c.company, c.email, c.phone, c.status,
                   COALESCE(a.portal_enabled, 0) AS portal_enabled, a.tier, a.last_login_at, c.created_at
            FROM clients c LEFT JOIN client_portal_access a ON a.client_id = c.id
            ORDER BY c.name ASC LIMIT ?");
        $stmt->execute([$limit]);
        $clients = $stmt->fetchAll();
    }

    jsonResponse(['ok' => true, 'users' => $clients, 'total' => count($clients)]);
}
