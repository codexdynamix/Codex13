<?php
/** Route group: LEAD INTAKE (Contact forms, booking modals, newsletter) (included by index.php in order; uses its request globals). */

declare(strict_types=1);

// -----------------------------------------------------------------------------
// 2. LEAD INTAKE (Contact forms, booking modals, newsletter)
// -----------------------------------------------------------------------------
if ($apiPath === '/newsletter/subscribers' && $method === 'POST') {
    $email = strtolower(trim((string)($input['email'] ?? '')));
    $source = trim((string)($input['source'] ?? 'newsletter_signup'));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        jsonResponse(['ok' => false, 'error' => 'Enter a valid email address.'], 422);
    }

    $findSubscriber = $pdo->prepare('SELECT id FROM newsletter_subscribers WHERE email = ? LIMIT 1');
    $findSubscriber->execute([$email]);
    $existingId = $findSubscriber->fetchColumn();
    if ($existingId !== false) {
        jsonResponse(['ok' => true, 'alreadySubscribed' => true]);
    }

    $id = 'sub_' . bin2hex(random_bytes(12));
    $now = date('c');
    try {
        $pdo->prepare('INSERT INTO newsletter_subscribers (id, email, source, subscribed_at) VALUES (?, ?, ?, ?)')
            ->execute([$id, $email, substr($source !== '' ? $source : 'newsletter_signup', 0, 128), $now]);
    } catch (PDOException $error) {
        // A concurrent request may have inserted the same normalized address.
        $findSubscriber->execute([$email]);
        if ($findSubscriber->fetchColumn() === false) {
            throw $error;
        }
        jsonResponse(['ok' => true, 'alreadySubscribed' => true]);
    }

    jsonResponse(['ok' => true, 'alreadySubscribed' => false], 201);
}

if ($apiPath === '/crm/leads') {
    if ($method === 'POST') {
        $id = 'ld_' . time() . '_' . substr(bin2hex(random_bytes(3)), 0, 4);
        $firstName = trim($input['firstName'] ?? $input['first_name'] ?? '');
        $lastName = trim($input['lastName'] ?? $input['last_name'] ?? '');
        $name = trim($input['name'] ?? "{$firstName} {$lastName}");
        $email = trim(strtolower($input['email'] ?? ''));
        $phone = trim($input['phone'] ?? '');
        $company = trim($input['company'] ?? '');
        $service = trim($input['service'] ?? 'General Inquiry');
        $budget = trim($input['budget'] ?? '');
        $timeline = trim($input['timeline'] ?? '');
        $message = trim($input['message'] ?? '');
        $source = trim($input['source'] ?? 'website_contact_modal');
        $now = date('c');

        $stmt = $pdo->prepare("
            INSERT INTO leads (id, first_name, last_name, name, email, phone, company, service, budget, timeline, message, source, stage, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'New', 'New', ?, ?)
        ");
        $stmt->execute([$id, $firstName, $lastName, $name, $email, $phone, $company, $service, $budget, $timeline, $message, $source, $now, $now]);

        // Also record an audit log
        $auditId = 'aud_' . time() . '_' . substr(bin2hex(random_bytes(3)), 0, 4);
        $pdo->prepare("INSERT INTO audit_logs (id, user_id, client_name, action, details, ip_address, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
            ->execute([$auditId, $id, $name, 'CLIENT_INQUIRY', "Inquiry submitted: {$service}", $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1', $now]);

        jsonResponse(['ok' => true, 'id' => $id, 'message' => 'Thank you! Your inquiry has been received.']);
    }

    // This is a public intake endpoint, not a public CRM data export. Admin
    // reads use the authenticated /admin/leads routes below.
    jsonResponse(['ok' => false, 'error' => 'Method not allowed.'], 405);
}

// Public intake for account registration and password resets. These endpoints
// deliberately return generic responses so they do not disclose account state.
if ($apiPath === '/portal/signup-request' && $method === 'POST') {
    $name = trim((string)($input['name'] ?? ''));
    $email = strtolower(trim((string)($input['email'] ?? '')));
    if ($name === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        jsonResponse(['ok' => false, 'error' => 'Enter your name and a valid email address.'], 422);
    }
    $existing = $pdo->prepare("SELECT c.id FROM clients c JOIN client_portal_access a ON a.client_id = c.id WHERE LOWER(TRIM(c.email)) = ?");
    $existing->execute([$email]);
    $pending = $pdo->prepare("SELECT id FROM signup_requests WHERE LOWER(email) = ? AND status = 'pending'");
    $pending->execute([$email]);
    if (!$existing->fetchColumn() && !$pending->fetchColumn()) {
        $requestId = 'signup_' . bin2hex(random_bytes(12));
        $data = [
            'name' => $name,
            'email' => $email,
            'phone' => trim((string)($input['phone'] ?? '')),
            'company' => trim((string)($input['company'] ?? '')),
            'country' => trim((string)($input['country'] ?? '')),
            'country_code' => trim((string)($input['country_code'] ?? $input['countryCode'] ?? '')),
            'message' => trim((string)($input['message'] ?? '')),
        ];
        $pdo->prepare('INSERT INTO signup_requests (id, name, email, request_data, status, created_at) VALUES (?, ?, ?, ?, ?, ?)')
            ->execute([$requestId, $name, $email, json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), 'pending', date('c')]);
    }
    jsonResponse(['ok' => true, 'message' => 'If eligible, your request has been received for review.'], 202);
}

if ($apiPath === '/portal/signup/complete' && $method === 'POST') {
    $email = strtolower(trim((string)($input['email'] ?? '')));
    $code = trim((string)($input['verification_code'] ?? $input['code'] ?? ''));
    $password = (string)($input['password'] ?? '');
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($password) < 8 || strlen($password) > 4096) {
        jsonResponse(['ok' => false, 'error' => 'Enter a valid email address and a password of at least 8 characters.'], 422);
    }
    $request = $pdo->prepare("SELECT * FROM signup_requests WHERE LOWER(email) = ? AND status = 'approved' ORDER BY reviewed_at DESC");
    $request->execute([$email]);
    $signup = $request->fetch();
    if (!$signup || empty($signup['verification_code_hash']) || strtotime((string)$signup['verification_expires_at']) <= time()) {
        jsonResponse(['ok' => false, 'error' => 'The verification code is invalid or expired.'], 400);
    }
    if ((int)$signup['verification_attempts'] >= 5) {
        jsonResponse(['ok' => false, 'error' => 'Too many attempts. Request a new verification code.'], 429);
    }
    if (!password_verify($code, (string)$signup['verification_code_hash'])) {
        $pdo->prepare('UPDATE signup_requests SET verification_attempts = verification_attempts + 1 WHERE id = ?')->execute([$signup['id']]);
        jsonResponse(['ok' => false, 'error' => 'The verification code is invalid or expired.'], 400);
    }
    $passwordHash = password_hash($password, PASSWORD_DEFAULT);
    if ($passwordHash === false) jsonResponse(['ok' => false, 'error' => 'Could not securely save the password.'], 500);
    $pdo->beginTransaction();
    try {
        $pdo->prepare('UPDATE client_portal_access SET password_hash = ?, portal_enabled = 1 WHERE client_id = ?')
            ->execute([$passwordHash, $signup['client_id']]);
        $pdo->prepare('UPDATE signup_requests SET verification_code_hash = NULL, verification_expires_at = NULL WHERE id = ?')
            ->execute([$signup['id']]);
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
    jsonResponse(['ok' => true, 'message' => 'Your client account is ready. You can now sign in.']);
}

if ($apiPath === '/portal/password-reset-request' && $method === 'POST') {
    $email = strtolower(trim((string)($input['email'] ?? '')));
    if (filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $client = $pdo->prepare("SELECT c.id FROM clients c JOIN client_portal_access a ON a.client_id = c.id WHERE LOWER(TRIM(c.email)) = ? AND a.status = 'Active' AND a.portal_enabled = 1");
        $client->execute([$email]);
        $matchingAccounts = $client->fetchAll(PDO::FETCH_COLUMN);
        $userId = count($matchingAccounts) === 1 ? $matchingAccounts[0] : null;
        if ($userId) {
            $now = date('c');
            $exists = $pdo->prepare('SELECT user_id FROM password_reset_requests WHERE user_id = ?');
            $exists->execute([$userId]);
            if ($exists->fetchColumn()) {
                $pdo->prepare("UPDATE password_reset_requests SET requested_at = ?, status = 'pending', code_hash = NULL, expires_at = NULL, sent_at = NULL, attempt_count = 0 WHERE user_id = ?")
                    ->execute([$now, $userId]);
            } else {
                $pdo->prepare("INSERT INTO password_reset_requests (user_id, requested_at, status) VALUES (?, ?, 'pending')")
                    ->execute([$userId, $now]);
            }
        }
    }
    jsonResponse(['ok' => true, 'message' => 'If an active account matches that email, a reset request has been recorded.'], 202);
}

if ($apiPath === '/portal/password-reset/complete' && $method === 'POST') {
    $email = strtolower(trim((string)($input['email'] ?? '')));
    $code = trim((string)($input['code'] ?? ''));
    $password = (string)($input['password'] ?? '');
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($password) < 8 || strlen($password) > 4096) {
        jsonResponse(['ok' => false, 'error' => 'Enter a valid email address and a password of at least 8 characters.'], 422);
    }
    $stmt = $pdo->prepare("SELECT c.id, r.code_hash, r.expires_at, r.attempt_count FROM clients c
        JOIN client_portal_access a ON a.client_id = c.id
        JOIN password_reset_requests r ON r.user_id = c.id
        WHERE LOWER(TRIM(c.email)) = ? AND r.status = 'sent' AND a.status = 'Active' AND a.portal_enabled = 1");
    $stmt->execute([$email]);
    $resetRows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $reset = count($resetRows) === 1 ? $resetRows[0] : null;
    if (!$reset || empty($reset['code_hash']) || strtotime((string)$reset['expires_at']) <= time()) {
        jsonResponse(['ok' => false, 'error' => 'The reset code is invalid or expired.'], 400);
    }
    if ((int)$reset['attempt_count'] >= 5) {
        jsonResponse(['ok' => false, 'error' => 'Too many attempts. Request a new reset code.'], 429);
    }
    if (!password_verify($code, (string)$reset['code_hash'])) {
        $pdo->prepare('UPDATE password_reset_requests SET attempt_count = attempt_count + 1 WHERE user_id = ?')->execute([$reset['id']]);
        jsonResponse(['ok' => false, 'error' => 'The reset code is invalid or expired.'], 400);
    }
    $passwordHash = password_hash($password, PASSWORD_DEFAULT);
    if ($passwordHash === false) jsonResponse(['ok' => false, 'error' => 'Could not securely save the password.'], 500);
    $pdo->beginTransaction();
    try {
        $pdo->prepare('UPDATE client_portal_access SET password_hash = ? WHERE client_id = ?')->execute([$passwordHash, $reset['id']]);
        $pdo->prepare('DELETE FROM password_reset_requests WHERE user_id = ?')->execute([$reset['id']]);
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
    jsonResponse(['ok' => true, 'message' => 'Your password has been updated.']);
}

// -----------------------------------------------------------------------------
// 2a. ADMIN LEADS (authenticated list, search, create, edit, soft delete)
// -----------------------------------------------------------------------------
$adminLeadResourceMatch = [];
$adminLeadRestoreMatch = [];
$isAdminLeadCollection = $apiPath === '/admin/leads';
$isAdminLeadImport = $apiPath === '/admin/leads/import';
$isAdminLeadSearch = $apiPath === '/admin/leads/search';
$isAdminLeadRestore = preg_match('#^/admin/leads/([^/]+)/restore$#', $apiPath, $adminLeadRestoreMatch) === 1;
$isAdminLeadResource = preg_match('#^/admin/leads/([^/]+)$#', $apiPath, $adminLeadResourceMatch) === 1
    && !in_array($adminLeadResourceMatch[1], ['import', 'search', 'assign-bulk', 'bulk-assign', 'bulk-status', 'bin'], true);

if ($isAdminLeadCollection || $isAdminLeadImport || $isAdminLeadSearch || $isAdminLeadRestore || $isAdminLeadResource) {
    $adminStmt = $pdo->prepare("SELECT role, office_id, team_id, status, name FROM staff_users WHERE id = ?");
    $adminStmt->execute([$adminSession['id']]);
    $admin = $adminStmt->fetch();
    if (!$admin || $admin['status'] !== 'Active') {
        jsonResponse(['ok' => false, 'error' => 'Administrator account is unavailable.'], 401);
    }

    $scope = buildAdminLeadScope(
        (string)$admin['role'],
        $admin['office_id'] !== null ? (string)$admin['office_id'] : null,
        $admin['team_id'] !== null ? (string)$admin['team_id'] : null,
        (string)$adminSession['id']
    );
    if ($scope === null) {
        jsonResponse(['ok' => false, 'error' => 'This account cannot access CRM leads.'], 403);
    }
    [$scopeSql, $scopeParams] = $scope;

    if (($isAdminLeadCollection && $method === 'GET') || ($isAdminLeadSearch && $method === 'GET')) {
        $filters = [];
        $params = $scopeParams;
        if ($scopeSql !== '') $filters[] = $scopeSql;

        $includeDeleted = $_GET['include_deleted'] ?? '';
        if ($includeDeleted === 'only') {
            $filters[] = 'l.deleted_at IS NOT NULL';
        } elseif ($includeDeleted !== '1') {
            $filters[] = 'l.deleted_at IS NULL';
        }

        $search = trim((string)($_GET['search'] ?? $_GET['q'] ?? ''));
        if ($search !== '') {
            $filters[] = "(COALESCE(l.name, '') LIKE ? OR COALESCE(l.email, '') LIKE ? OR COALESCE(l.phone, '') LIKE ? OR COALESCE(l.company, '') LIKE ? OR COALESCE(l.service, '') LIKE ? OR COALESCE(l.message, '') LIKE ?)";
            $needle = '%' . $search . '%';
            array_push($params, $needle, $needle, $needle, $needle, $needle, $needle);
        }
        foreach (['stage' => 'l.stage', 'office_id' => 'l.assigned_office_id', 'team_id' => 'l.assigned_team_id', 'team_leader_id' => 'l.assigned_team_leader_id', 'agent_id' => 'l.assigned_agent_id'] as $queryKey => $column) {
            if (isset($_GET[$queryKey]) && (string)$_GET[$queryKey] !== '') {
                $filters[] = "{$column} = ?";
                $params[] = (string)$_GET[$queryKey];
            }
        }
        $whereSql = $filters ? ' WHERE ' . implode(' AND ', $filters) : '';

        if ($isAdminLeadSearch) {
            $q = trim((string)($_GET['q'] ?? ''));
            if ($q === '') jsonResponse(['ok' => true, 'leads' => []]);
            $searchNeedle = '%' . $q . '%';
            $limit = max(1, min(100, (int)($_GET['limit'] ?? 8)));
            $searchFilters = [];
            $searchParams = $scopeParams;
            if ($scopeSql !== '') $searchFilters[] = $scopeSql;
            $searchFilters[] = 'l.deleted_at IS NULL';
            $searchFilters[] = "(COALESCE(l.name, '') LIKE ? OR COALESCE(l.email, '') LIKE ? OR COALESCE(l.phone, '') LIKE ? OR COALESCE(l.company, '') LIKE ?)";
            array_push($searchParams, $searchNeedle, $searchNeedle, $searchNeedle, $searchNeedle);
            $searchSql = ' WHERE ' . implode(' AND ', $searchFilters);
            $stmt = $pdo->prepare("SELECT l.*, staff.name AS assigned_agent_name FROM leads l LEFT JOIN staff_users staff ON staff.id = l.assigned_agent_id{$searchSql} ORDER BY l.created_at DESC LIMIT ?");
            $searchParams[] = $limit;
            $stmt->execute($searchParams);
            jsonResponse(['ok' => true, 'leads' => array_map('normalizeLeadRow', $stmt->fetchAll())]);
        }

        $countStmt = $pdo->prepare("SELECT COUNT(*) FROM leads l{$whereSql}");
        $countStmt->execute($params);
        $total = (int)$countStmt->fetchColumn();
        $limit = max(1, min(10000, (int)($_GET['limit'] ?? 500)));
        $offset = max(0, (int)($_GET['offset'] ?? 0));
        $listStmt = $pdo->prepare("SELECT l.*, staff.name AS assigned_agent_name FROM leads l LEFT JOIN staff_users staff ON staff.id = l.assigned_agent_id{$whereSql} ORDER BY l.created_at DESC, l.id DESC LIMIT ? OFFSET ?");
        $listParams = $params;
        $listParams[] = $limit;
        $listParams[] = $offset;
        $listStmt->execute($listParams);
        $rows = array_map('normalizeLeadRow', $listStmt->fetchAll());
        jsonResponse([
            'ok' => true,
            'leads' => $rows,
            'total' => $total,
            'limit' => $limit,
            'offset' => $offset,
            'has_more' => $offset + count($rows) < $total,
        ]);
    }

    if ($isAdminLeadImport && $method === 'POST') {
        if ($admin['role'] !== 'Super Admin') {
            jsonResponse(['ok' => false, 'error' => 'Only a Super Admin can import leads.'], 403);
        }
        $rows = $input['leads'] ?? null;
        if (!is_array($rows) || count($rows) === 0) {
            jsonResponse(['ok' => false, 'error' => 'At least one lead is required.'], 400);
        }
        if (count($rows) > 5000) {
            jsonResponse(['ok' => false, 'error' => 'Import no more than 5,000 leads at a time.'], 400);
        }

        $preparedRows = [];
        $seenEmails = [];
        $seenPhones = [];
        foreach ($rows as $index => $row) {
            if (!is_array($row)) jsonResponse(['ok' => false, 'error' => 'Invalid lead data on row ' . ($index + 1) . '.'], 400);
            $firstName = trim((string)($row['first_name'] ?? $row['firstName'] ?? ''));
            $lastName = trim((string)($row['last_name'] ?? $row['lastName'] ?? ''));
            $name = trim((string)($row['name'] ?? '')) ?: trim($firstName . ' ' . $lastName);
            $email = strtolower(trim((string)($row['email'] ?? '')));
            $phone = trim((string)($row['phone'] ?? ''));
            if ($name === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                jsonResponse(['ok' => false, 'error' => 'Row ' . ($index + 1) . ' needs a name and a valid email address.'], 400);
            }
            if (isset($seenEmails[$email])) {
                jsonResponse([
                    'ok' => false,
                    'code' => 'DUPLICATE_CLIENT_IDENTIFIER',
                    'field' => 'email',
                    'error' => 'Row ' . ($index + 1) . ' repeats an email address already present in this upload. No rows were imported.',
                ], 409);
            }
            $seenEmails[$email] = $index + 1;
            $normalizedPhone = normalizeClientPhone($phone);
            if ($normalizedPhone !== '' && isset($seenPhones[$normalizedPhone])) {
                jsonResponse([
                    'ok' => false,
                    'code' => 'DUPLICATE_CLIENT_IDENTIFIER',
                    'field' => 'phone',
                    'error' => 'Row ' . ($index + 1) . ' repeats a phone number already present in this upload. No rows were imported.',
                ], 409);
            }
            if ($normalizedPhone !== '') $seenPhones[$normalizedPhone] = $index + 1;
            $assignment = validateLeadAssignment($pdo, [
                'office_id' => $row['assigned_office_id'] ?? null,
                'team_id' => $row['assigned_team_id'] ?? null,
                'team_leader_id' => $row['assigned_team_leader_id'] ?? null,
                'agent_id' => $row['assigned_agent_id'] ?? null,
            ]);
            $preparedRows[] = [
                'id' => 'ld_' . bin2hex(random_bytes(8)),
                'first_name' => $firstName,
                'last_name' => $lastName,
                'name' => $name,
                'email' => $email,
                'phone' => $phone,
                'country' => trim((string)($row['country'] ?? 'United Kingdom')) ?: 'United Kingdom',
                'country_code' => trim((string)($row['country_code'] ?? $row['countryCode'] ?? 'GB')) ?: 'GB',
                'stage' => trim((string)($row['stage'] ?? $row['status'] ?? 'New')) ?: 'New',
                'funnel' => trim((string)($row['funnel'] ?? $row['service'] ?? 'General')) ?: 'General',
                'company' => trim((string)($row['company'] ?? '')),
                'service' => trim((string)($row['service'] ?? '')),
                'budget' => trim((string)($row['budget'] ?? '')),
                'timeline' => trim((string)($row['timeline'] ?? '')),
                'message' => trim((string)($row['message'] ?? '')),
                'notes' => trim((string)($row['notes'] ?? '')),
                'initial_portal_password' => trim((string)($row['client_password'] ?? $row['password'] ?? '')),
                'assigned_office_id' => $assignment['office_id'],
                'assigned_team_id' => $assignment['team_id'],
                'assigned_team_leader_id' => $assignment['team_leader_id'],
                'assigned_agent_id' => $assignment['agent_id'],
            ];
            if ($preparedRows[count($preparedRows) - 1]['initial_portal_password'] !== ''
                && strlen($preparedRows[count($preparedRows) - 1]['initial_portal_password']) < 8) {
                jsonResponse(['ok' => false, 'error' => 'Row ' . ($index + 1) . ' has a portal password shorter than 8 characters.'], 422);
            }
        }

        $now = date('c');
        $insertLead = $pdo->prepare("
            INSERT INTO leads (id, first_name, last_name, name, email, phone, country, country_code, stage, status, funnel, company, service, budget, timeline, message, source, notes, assigned_office_id, assigned_team_id, assigned_team_leader_id, assigned_agent_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'csv_import', ?, ?, ?, ?, ?, ?, ?)
        ");
        $importedLeads = [];
        $pdo->beginTransaction();
        try {
            [$existingEmails, $existingPhones] = loadClientIdentifierSets($pdo);
            foreach ($preparedRows as $index => $lead) {
                $normalizedPhone = normalizeClientPhone($lead['phone']);
                $conflict = isset($existingEmails[$lead['email']])
                    ? 'email'
                    : ($normalizedPhone !== '' && isset($existingPhones[$normalizedPhone]) ? 'phone' : null);
                if ($conflict !== null) {
                    $pdo->rollBack();
                    jsonResponse([
                        'ok' => false,
                        'code' => 'DUPLICATE_CLIENT_IDENTIFIER',
                        'field' => $conflict,
                        'error' => 'Row ' . ($index + 1) . ' uses an ' . ($conflict === 'email' ? 'email address' : 'existing phone number') . ' already used by a lead or client account. No rows were imported.',
                    ], 409);
                }
                $existingEmails[$lead['email']] = true;
                if ($normalizedPhone !== '') $existingPhones[$normalizedPhone] = true;
                $insertLead->execute([
                    $lead['id'], $lead['first_name'], $lead['last_name'], $lead['name'], $lead['email'],
                    $lead['phone'], $lead['country'], $lead['country_code'], $lead['stage'], $lead['stage'],
                    $lead['funnel'], $lead['company'], $lead['service'], $lead['budget'], $lead['timeline'],
                    $lead['message'], $lead['notes'], $lead['assigned_office_id'],
                    $lead['assigned_team_id'], $lead['assigned_team_leader_id'], $lead['assigned_agent_id'], $now, $now,
                ]);
                if ($lead['initial_portal_password'] !== '') {
                    ensurePortalClientForLead($pdo, $lead, $lead['initial_portal_password'], $now);
                }
                unset($lead['initial_portal_password']);
                $importedLeads[] = normalizeLeadRow($lead + [
                    'status' => $lead['stage'],
                    'source' => 'csv_import',
                    'created_at' => $now,
                    'updated_at' => $now,
                    'comment_history' => [],
                    'status_history' => [],
                    'appointments' => [],
                ]);
            }
            $pdo->commit();
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $error;
        }
        jsonResponse(['ok' => true, 'imported' => count($importedLeads), 'leads' => $importedLeads]);
    }

    if ($isAdminLeadCollection && $method === 'POST') {
        $actor = requireActiveAdminStaff($pdo, $adminSession);
        $firstName = trim((string)($input['first_name'] ?? ''));
        $lastName = trim((string)($input['last_name'] ?? ''));
        $name = trim((string)($input['name'] ?? trim($firstName . ' ' . $lastName)));
        if ($name === '') jsonResponse(['ok' => false, 'error' => 'A lead name is required.'], 400);
        if ($firstName === '' && $lastName === '') {
            $parts = preg_split('/\\s+/', $name, 2);
            $firstName = $parts[0] ?? '';
            $lastName = $parts[1] ?? '';
        }
        $email = strtolower(trim((string)($input['email'] ?? '')));
        $phone = trim((string)($input['phone'] ?? ''));
        if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            jsonResponse(['ok' => false, 'error' => 'Enter a valid email address.'], 400);
        }
        $id = 'ld_' . bin2hex(random_bytes(8));
        $now = date('c');
        $stage = trim((string)($input['stage'] ?? $input['status'] ?? 'New')) ?: 'New';
        $source = trim((string)($input['source'] ?? 'manual_crm_entry'));
        $assignmentInput = [
            'office_id' => $input['assigned_office_id'] ?? null,
            'team_id' => $input['assigned_team_id'] ?? null,
            'team_leader_id' => $input['assigned_team_leader_id'] ?? null,
            'agent_id' => $input['assigned_agent_id'] ?? null,
        ];
        if ($actor['role'] === 'Office Manager' && !array_filter($assignmentInput)) {
            $assignmentInput['office_id'] = $actor['office_id'];
        } elseif ($actor['role'] === 'Team Leader' && !array_filter($assignmentInput)) {
            $assignmentInput['office_id'] = $actor['office_id'];
            $assignmentInput['team_leader_id'] = $actor['id'];
        } elseif ($actor['role'] === 'Agent' && !array_filter($assignmentInput)) {
            $assignmentInput['agent_id'] = $actor['id'];
        }
        $assignment = validateLeadAssignment($pdo, $assignmentInput);
        assertCanAssignLead($actor, $assignment, $pdo);
        $stmt = $pdo->prepare("INSERT INTO leads (id, first_name, last_name, name, email, phone, country, country_code, stage, status, funnel, company, service, budget, timeline, message, source, notes, assigned_office_id, assigned_team_id, assigned_team_leader_id, assigned_agent_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $pdo->beginTransaction();
        try {
            $conflict = findClientIdentifierConflict($pdo, $email, $phone);
            if ($conflict !== null) {
                $pdo->rollBack();
                $identifier = $conflict === 'email' ? 'email address' : 'phone number';
                jsonResponse([
                    'ok' => false,
                    'code' => 'DUPLICATE_CLIENT_IDENTIFIER',
                    'field' => $conflict,
                    'error' => 'A lead or client account already uses this ' . $identifier . '.',
                ], 409);
            }
            $stmt->execute([
                $id, $firstName, $lastName, $name, $email, $phone,
                trim((string)($input['country'] ?? 'United Kingdom')),
                trim((string)($input['country_code'] ?? 'GB')),
                $stage, $stage,
                trim((string)($input['funnel'] ?? $input['service'] ?? 'General')),
                trim((string)($input['company'] ?? '')),
                trim((string)($input['service'] ?? '')),
                trim((string)($input['budget'] ?? '')),
                trim((string)($input['timeline'] ?? '')),
                trim((string)($input['message'] ?? '')),
                $source,
                trim((string)($input['notes'] ?? '')),
                $assignment['office_id'],
                $assignment['team_id'],
                $assignment['team_leader_id'],
                $assignment['agent_id'],
                $now, $now,
            ]);
            if (array_filter($assignment)) saveLeadAssignment($pdo, $id, $assignment, $actor);
            $pdo->commit();
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $error;
        }
        $createdStmt = $pdo->prepare("SELECT l.*, staff.name AS assigned_agent_name FROM leads l LEFT JOIN staff_users staff ON staff.id = l.assigned_agent_id WHERE l.id = ?");
        $createdStmt->execute([$id]);
        jsonResponse(['ok' => true, 'lead' => normalizeLeadRow($createdStmt->fetch())], 201);
    }

    if ($isAdminLeadResource) {
        $leadId = $adminLeadResourceMatch[1];
        $leadFilters = ['l.id = ?', 'l.deleted_at IS NULL'];
        $leadParams = [$leadId];
        if ($scopeSql !== '') {
            $leadFilters[] = $scopeSql;
            array_push($leadParams, ...$scopeParams);
        }
        $leadWhere = ' WHERE ' . implode(' AND ', $leadFilters);
        $leadStmt = $pdo->prepare("SELECT l.*, staff.name AS assigned_agent_name FROM leads l LEFT JOIN staff_users staff ON staff.id = l.assigned_agent_id{$leadWhere}");
        $leadStmt->execute($leadParams);
        $existingLead = $leadStmt->fetch();
        if (!$existingLead) jsonResponse(['ok' => false, 'error' => 'Lead not found.'], 404);

        if ($method === 'GET') {
            jsonResponse(['ok' => true, 'lead' => normalizeLeadRow($existingLead)]);
        }
        if ($method === 'PATCH') {
            $allowed = [
                'first_name', 'last_name', 'name', 'email', 'phone', 'country',
                'country_code', 'stage', 'status', 'funnel', 'company', 'service',
                'budget', 'timeline', 'message', 'source', 'notes',
                'assigned_office_id', 'assigned_team_id', 'assigned_team_leader_id', 'assigned_agent_id',
            ];
            $updates = [];
            foreach ($allowed as $field) {
                if (array_key_exists($field, $input)) $updates[$field] = $input[$field];
            }
            $assignmentKeys = ['assigned_office_id', 'assigned_team_id', 'assigned_team_leader_id', 'assigned_agent_id'];
            $assignmentChanged = false;
            $previousAssignment = leadAssignmentFromRow($existingLead);
            $nextAssignment = $previousAssignment;
            foreach ($assignmentKeys as $field) {
                if (!array_key_exists($field, $updates)) continue;
                $assignmentChanged = true;
                $key = match ($field) {
                    'assigned_office_id' => 'office_id',
                    'assigned_team_id' => 'team_id',
                    'assigned_team_leader_id' => 'team_leader_id',
                    default => 'agent_id',
                };
                $nextAssignment[$key] = $updates[$field];
                unset($updates[$field]);
            }
            if ($assignmentChanged) {
                $assignmentActor = requireActiveAdminStaff($pdo, $adminSession);
                $nextAssignment = validateLeadAssignment($pdo, $nextAssignment);
                assertCanAssignLead($assignmentActor, $nextAssignment, $pdo);
                $updates['assigned_office_id'] = $nextAssignment['office_id'];
                $updates['assigned_team_id'] = $nextAssignment['team_id'];
                $updates['assigned_team_leader_id'] = $nextAssignment['team_leader_id'];
                $updates['assigned_agent_id'] = $nextAssignment['agent_id'];
                $updates['assigned_by'] = $assignmentActor['id'];
            }
            if (isset($updates['stage']) && !isset($updates['status'])) $updates['status'] = $updates['stage'];
            if (isset($updates['status']) && !isset($updates['stage'])) $updates['stage'] = $updates['status'];
            if (array_key_exists('email', $updates)) {
                $updates['email'] = strtolower(trim((string)$updates['email']));
                if ($updates['email'] !== '' && !filter_var($updates['email'], FILTER_VALIDATE_EMAIL)) {
                    jsonResponse(['ok' => false, 'error' => 'Enter a valid email address.'], 400);
                }
            }
            if (array_key_exists('phone', $updates)) {
                $updates['phone'] = trim((string)$updates['phone']);
            }
            $emailChanged = array_key_exists('email', $updates)
                && strtolower(trim((string)$updates['email'])) !== strtolower(trim((string)($existingLead['email'] ?? '')));
            $phoneChanged = array_key_exists('phone', $updates)
                && normalizeClientPhone((string)$updates['phone']) !== normalizeClientPhone((string)($existingLead['phone'] ?? ''));
            if ($emailChanged || $phoneChanged) {
                $conflict = findClientIdentifierConflict(
                    $pdo,
                    (string)($updates['email'] ?? $existingLead['email'] ?? ''),
                    (string)($updates['phone'] ?? $existingLead['phone'] ?? ''),
                    $leadId,
                    null,
                    $emailChanged,
                    $phoneChanged
                );
                if ($conflict !== null) {
                    $identifier = $conflict === 'email' ? 'email address' : 'phone number';
                    jsonResponse([
                        'ok' => false,
                        'code' => 'DUPLICATE_CLIENT_IDENTIFIER',
                        'field' => $conflict,
                        'error' => 'Another lead or client account already uses this ' . $identifier . '.',
                    ], 409);
                }
            }
            if (isset($updates['first_name']) || isset($updates['last_name'])) {
                $first = (string)($updates['first_name'] ?? $existingLead['first_name'] ?? '');
                $last = (string)($updates['last_name'] ?? $existingLead['last_name'] ?? '');
                $updates['name'] = trim($first . ' ' . $last);
            }
            if (!$updates) jsonResponse(['ok' => false, 'error' => 'No supported lead fields were provided.'], 400);

            $oldStage = (string)($existingLead['stage'] ?? '');
            $nextStage = (string)($updates['stage'] ?? $oldStage);
            if ($nextStage !== $oldStage) {
                $history = json_decode((string)($existingLead['status_history'] ?? '[]'), true);
                if (!is_array($history)) $history = [];
                $history[] = [
                    'id' => 'st_' . bin2hex(random_bytes(5)),
                    'from_stage' => $oldStage,
                    'to_stage' => $nextStage,
                    'by_admin_id' => $adminSession['id'],
                    'by_name' => $admin['name'],
                    'created_at' => date('c'),
                ];
                $updates['status_history'] = json_encode($history, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
            }
            $updates['updated_at'] = date('c');
            $setSql = implode(', ', array_map(static fn($field) => "{$field} = ?", array_keys($updates)));
            $updateParams = array_values($updates);
            $updateFilters = ['id = ?', 'deleted_at IS NULL'];
            $updateParams[] = $leadId;
            if ($scopeSql !== '') {
                $updateFilters[] = str_replace('l.', '', $scopeSql);
                array_push($updateParams, ...$scopeParams);
            }
            $pdo->beginTransaction();
            try {
                $pdo->prepare("UPDATE leads SET {$setSql} WHERE " . implode(' AND ', $updateFilters))->execute($updateParams);
                if ($assignmentChanged) {
                    $historyId = 'lah_' . bin2hex(random_bytes(10));
                    $pdo->prepare('INSERT INTO lead_assignment_history (id, lead_id, actor_id, previous_assignment, new_assignment, created_at) VALUES (?, ?, ?, ?, ?, ?)')
                        ->execute([$historyId, $leadId, $assignmentActor['id'], json_encode($previousAssignment), json_encode($nextAssignment), date('c')]);
                }
                $pdo->commit();
            } catch (Throwable $error) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                throw $error;
            }
            $updatedStmt = $pdo->prepare("SELECT l.*, staff.name AS assigned_agent_name FROM leads l LEFT JOIN staff_users staff ON staff.id = l.assigned_agent_id WHERE l.id = ? AND l.deleted_at IS NULL");
            $updatedStmt->execute([$leadId]);
            jsonResponse(['ok' => true, 'lead' => normalizeLeadRow($updatedStmt->fetch())]);
        }
        if ($method === 'DELETE') {
            $deleteScope = $scopeSql !== '' ? ' AND ' . str_replace('l.', '', $scopeSql) : '';
            if (($_GET['permanent'] ?? '') === '1') {
                $deleteStmt = $pdo->prepare('DELETE FROM leads WHERE id = ?' . $deleteScope);
                $deleteStmt->execute($scopeSql !== '' ? array_merge([$leadId], $scopeParams) : [$leadId]);
                jsonResponse(['ok' => true, 'id' => $leadId, 'deleted' => true]);
            }
            $deleteStmt = $pdo->prepare('UPDATE leads SET deleted_at = ?, updated_at = ? WHERE id = ?' . $deleteScope);
            $now = date('c');
            $deleteStmt->execute($scopeSql !== '' ? array_merge([$now, $now, $leadId], $scopeParams) : [$now, $now, $leadId]);
            jsonResponse(['ok' => true, 'id' => $leadId, 'deleted' => true]);
        }
    }

    if ($isAdminLeadRestore && $method === 'POST') {
        $leadId = $adminLeadRestoreMatch[1];
        $filters = ['id = ?', 'deleted_at IS NOT NULL'];
        $params = [$leadId];
        if ($scopeSql !== '') {
            $filters[] = str_replace('l.', '', $scopeSql);
            array_push($params, ...$scopeParams);
        }
        $stmt = $pdo->prepare('UPDATE leads SET deleted_at = NULL, updated_at = ? WHERE ' . implode(' AND ', $filters));
        $stmt->execute(array_merge([date('c')], $params));
        if ($stmt->rowCount() === 0) jsonResponse(['ok' => false, 'error' => 'Deleted lead not found.'], 404);
        $restoredStmt = $pdo->prepare('SELECT * FROM leads WHERE id = ?');
        $restoredStmt->execute([$leadId]);
        jsonResponse(['ok' => true, 'lead' => normalizeLeadRow($restoredStmt->fetch())]);
    }
}

if ($apiPath === '/crm/settings') {
    if ($method !== 'GET') {
        jsonResponse(['ok' => false, 'error' => 'Method not allowed.'], 405);
    }
    $record = readPlatformSettingsRecord($pdo);
    jsonResponse([
        'ok' => true,
        'settings' => $record['settings'],
        'site_config' => publicSiteConfig($record['site_config']),
    ]);
}

if ($apiPath === '/admin/site-content') {
    requireAdminCapability($pdo, $adminSession, 'content');
    if ($method !== 'GET') jsonResponse(['ok' => false, 'error' => 'Method not allowed.'], 405);
    $projects = $pdo->query('SELECT * FROM projects WHERE deleted_at IS NULL ORDER BY id DESC LIMIT 1000')->fetchAll();
    foreach ($projects as &$project) {
        $showcase = json_decode((string)($project['showcase_json'] ?? ''), true);
        if (is_array($showcase)) {
            $project = array_merge($project, $showcase);
        }
        $project['id'] = (int)$project['id'];
        $project['is_published'] = (bool)$project['is_published'];
        $project['published'] = $project['is_published'];
        unset($project['showcase_json']);
    }
    unset($project);
    jsonResponse([
        'ok' => true,
        'projects' => $projects,
        'blogs' => $pdo->query('SELECT * FROM blogs WHERE deleted_at IS NULL ORDER BY id DESC LIMIT 1000')->fetchAll(),
        'reviews' => $pdo->query('SELECT * FROM reviews WHERE deleted_at IS NULL ORDER BY id DESC LIMIT 1000')->fetchAll(),
        'backlinks' => $pdo->query('SELECT * FROM backlinks WHERE deleted_at IS NULL ORDER BY id DESC LIMIT 1000')->fetchAll(),
    ]);
}

if ($apiPath === '/admin/site-content/action' && $method === 'POST') {
    requireAdminCapability($pdo, $adminSession, 'content');
    $action = (string)($input['action'] ?? '');
    $record = is_array($input['record'] ?? null) ? $input['record'] : $input;
    $actions = [
        'save_project' => ['project', false, false],
        'update_project' => ['project', false, false],
        'save_showcase_project' => ['project', true, false],
        'delete_project' => ['project', false, true],
        'save_blog' => ['blog', false, false],
        'update_blog' => ['blog', false, false],
        'delete_blog' => ['blog', false, true],
        'save_review' => ['review', false, false],
        'update_review' => ['review', false, false],
        'delete_review' => ['review', false, true],
        'add_backlink' => ['backlink', false, false],
        'update_backlink' => ['backlink', false, false],
        'delete_backlink' => ['backlink', false, true],
    ];
    if (!isset($actions[$action])) jsonResponse(['ok' => false, 'error' => 'Unsupported site content action.'], 400);
    [$type, $showcase, $delete] = $actions[$action];
    $id = filter_var($record['id'] ?? null, FILTER_VALIDATE_INT);
    if ($delete) {
        if (!$id || $id < 1) jsonResponse(['ok' => false, 'error' => 'A valid record ID is required.'], 422);
        $table = ['project' => 'projects', 'blog' => 'blogs', 'review' => 'reviews', 'backlink' => 'backlinks'][$type];
        $stmt = $pdo->prepare("UPDATE {$table} SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL");
        $stmt->execute([date('c'), $id]);
        if ($stmt->rowCount() === 0) jsonResponse(['ok' => false, 'error' => 'Record not found.'], 404);
        jsonResponse(['ok' => true, 'archived' => true, 'id' => (int)$id]);
    }
    $recordId = storeSiteContentRecord($pdo, $type, $record, $showcase);
    jsonResponse(['ok' => true, 'id' => $recordId], $id ? 200 : 201);
}

if ($apiPath === '/admin/site-content/import-local' && $method === 'POST') {
    requireAdminCapability($pdo, $adminSession, 'content');
    $collections = [
        'blogs' => 'blog',
        'reviews' => 'review',
        'projects' => 'project',
        'backlinks' => 'backlink',
        'showcaseProjects' => 'showcase_project',
        'enquiries' => 'enquiry',
    ];
    $pdo->beginTransaction();
    $imported = 0;
    $skipped = 0;
    try {
        foreach ($collections as $field => $type) {
            $records = $input[$field] ?? [];
            if (!is_array($records)) continue;
            foreach (array_slice($records, 0, 1000) as $index => $record) {
                if (!is_array($record)) { $skipped++; continue; }
                $legacyId = trim((string)($record['id'] ?? hash('sha256', json_encode($record, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE))));
                $sourceKey = $field . ':' . hash('sha256', $legacyId);
                $exists = $pdo->prepare('SELECT record_id FROM site_content_imports WHERE source_key = ?');
                $exists->execute([$sourceKey]);
                if ($exists->fetchColumn()) { $skipped++; continue; }
                if ($type === 'enquiry') {
                    $clientId = importLegacySiteEnquiry($pdo, $record);
                    if ($clientId === null) { $skipped++; continue; }
                    $pdo->prepare('INSERT INTO site_content_imports (source_key, record_type, record_id, imported_at) VALUES (?, ?, ?, ?)')
                        ->execute([$sourceKey, 'client', $clientId, date('c')]);
                } else {
                    $contentType = $type === 'showcase_project' ? 'project' : $type;
                    unset($record['id']);
                    try {
                        $recordId = storeSiteContentRecord($pdo, $contentType, $record, $type === 'showcase_project');
                    } catch (InvalidArgumentException $error) {
                        $skipped++;
                        continue;
                    }
                    $pdo->prepare('INSERT INTO site_content_imports (source_key, record_type, record_id, imported_at) VALUES (?, ?, ?, ?)')
                        ->execute([$sourceKey, $contentType, (string)$recordId, date('c')]);
                }
                $imported++;
            }
        }
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
    jsonResponse(['ok' => true, 'imported' => $imported, 'skipped' => $skipped]);
}
