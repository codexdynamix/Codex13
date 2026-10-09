<?php
/** Route group: AUTHENTICATION: STAFF LOGIN (included by index.php in order; uses its request globals). */

declare(strict_types=1);

// -----------------------------------------------------------------------------
// 13. AUTHENTICATION: STAFF LOGIN
// -----------------------------------------------------------------------------
if ($apiPath === '/admin/me' && $method === 'GET') {
    $stmt = $pdo->prepare("SELECT id, name, email, role, office_id, team_id, status, capabilities, last_login_at FROM staff_users WHERE id = ?");
    $stmt->execute([$adminSession['id']]);
    $staff = $stmt->fetch();
    if (!$staff || $staff['status'] !== 'Active') jsonResponse(['ok' => false, 'error' => 'Administrator account is unavailable.'], 401);
    $staff['capabilities'] = json_decode($staff['capabilities'] ?: '{}', true);
    jsonResponse(['ok' => true, 'user' => $staff]);
}

if ($apiPath === '/admin/logout' && $method === 'POST') {
    $token = bearerToken(ADMIN_SESSION_COOKIE);
    clearSessionCookie(ADMIN_SESSION_COOKIE);
    $pdo->prepare("DELETE FROM admin_sessions WHERE token_hash = ?")->execute([hash('sha256', $token)]);
    jsonResponse(['ok' => true]);
}

// Per-client grants for Access & Email and Accounting.
if (preg_match('#^/admin/clients/([^/]+)/profile-permissions$#', $apiPath, $profilePermissionsMatch)) {
    $clientId = rawurldecode($profilePermissionsMatch[1]);
    if ($method === 'GET') {
        $staff = requireActiveAdminStaff($pdo, $adminSession);
        if ($staff['role'] === 'Super Admin') {
            $staffRows = $pdo->query("SELECT id, name, email, role FROM staff_users WHERE status = 'Active' AND role IN ('Office Manager', 'Team Leader', 'Agent') ORDER BY name ASC")->fetchAll();
            $permissions = [];
            foreach ($staffRows as $staffRow) {
                $permissions[$staffRow['id']] = emptyClientProfilePermissions();
            }
            $grants = $pdo->prepare("
                SELECT p.staff_id, p.profile_section, p.access_level
                FROM client_profile_permissions p
                INNER JOIN staff_users s ON s.id = p.staff_id
                WHERE p.client_id = ? AND s.status = 'Active'
                  AND s.role IN ('Office Manager', 'Team Leader', 'Agent')
            ");
            $grants->execute([$clientId]);
            foreach ($grants->fetchAll() as $grant) {
                if (!isset($permissions[$grant['staff_id']])) continue;
                if (in_array($grant['profile_section'], ['access', 'accounting'], true)
                    && in_array($grant['access_level'], ['read', 'edit'], true)) {
                    $permissions[$grant['staff_id']][$grant['profile_section']] = $grant['access_level'];
                }
            }
            jsonResponse(['ok' => true, 'staff' => $staffRows, 'permissions' => $permissions]);
        }
        if (!in_array($staff['role'], ['Office Manager', 'Team Leader', 'Agent'], true)) {
            jsonResponse(['ok' => false, 'error' => 'This account cannot access client profile sections.'], 403);
        }
        $levels = emptyClientProfilePermissions();
        $stmt = $pdo->prepare('SELECT profile_section, access_level FROM client_profile_permissions WHERE client_id = ? AND staff_id = ?');
        $stmt->execute([$clientId, $staff['id']]);
        foreach ($stmt->fetchAll() as $grant) {
            if (array_key_exists($grant['profile_section'], $levels) && in_array($grant['access_level'], ['read', 'edit'], true)) {
                $levels[$grant['profile_section']] = $grant['access_level'];
            }
        }
        jsonResponse(['ok' => true, 'myPermissions' => $levels]);
    }

    if ($method !== 'PUT') jsonResponse(['ok' => false, 'error' => 'Method not allowed.'], 405);
    requireSuperAdmin($pdo, $adminSession);
    $staffId = trim((string)($input['staffId'] ?? ''));
    $levels = $input['permissions'] ?? null;
    if ($staffId === '' || !is_array($levels)) {
        jsonResponse(['ok' => false, 'error' => 'Choose a staff member and set both section permissions.'], 422);
    }
    $accessLevel = (string)($levels['access'] ?? 'none');
    $accountingLevel = (string)($levels['accounting'] ?? 'none');
    if (!in_array($accessLevel, ['none', 'read', 'edit'], true)
        || !in_array($accountingLevel, ['none', 'read', 'edit'], true)) {
        jsonResponse(['ok' => false, 'error' => 'Permission must be none, read, or edit.'], 422);
    }
    $staffCheck = $pdo->prepare("SELECT id FROM staff_users WHERE id = ? AND status = 'Active' AND role IN ('Office Manager', 'Team Leader', 'Agent')");
    $staffCheck->execute([$staffId]);
    if (!$staffCheck->fetchColumn()) jsonResponse(['ok' => false, 'error' => 'Choose an active office manager, team leader, or agent.'], 422);

    $pdo->beginTransaction();
    try {
        foreach (['access' => $accessLevel, 'accounting' => $accountingLevel] as $section => $level) {
            $pdo->prepare('DELETE FROM client_profile_permissions WHERE client_id = ? AND staff_id = ? AND profile_section = ?')
                ->execute([$clientId, $staffId, $section]);
            if ($level !== 'none') {
                $pdo->prepare('INSERT INTO client_profile_permissions (client_id, staff_id, profile_section, access_level, granted_by, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
                    ->execute([$clientId, $staffId, $section, $level, $adminSession['id'], date('c')]);
            }
        }
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
    jsonResponse(['ok' => true, 'permissions' => ['access' => $accessLevel, 'accounting' => $accountingLevel]]);
}

// Client access and accounting are visible to Super Admins by default. Other
// staff need an explicit per-client, per-section grant.
if (preg_match('#^/admin/clients/([^/]+)/access$#', $apiPath, $clientAccessMatch)) {
    $clientId = rawurldecode($clientAccessMatch[1]);
    requireClientProfileSectionAccess($pdo, $adminSession, $clientId, 'access', $method !== 'GET');
    $stmt = $pdo->prepare('SELECT * FROM client_access_credentials WHERE client_id = ?');
    $stmt->execute([$clientId]);
    $existing = $stmt->fetch() ?: null;

    if ($method === 'GET') {
        jsonResponse(['ok' => true, 'access' => [
            'websiteUrl' => $existing['website_url'] ?? '',
            'websiteUsername' => $existing['website_username'] ?? '',
            'hasWebsitePassword' => !empty($existing['website_password_enc']),
            'emailAddress' => $existing['email_address'] ?? '',
            'webmailUrl' => $existing['webmail_url'] ?? '',
            'hasEmailPassword' => !empty($existing['email_password_enc']),
            'imapHost' => $existing['imap_host'] ?? 'imap.hostinger.com',
            'imapPort' => (int)($existing['imap_port'] ?? 993),
            'smtpHost' => $existing['smtp_host'] ?? 'smtp.hostinger.com',
            'smtpPort' => (int)($existing['smtp_port'] ?? 465),
        ]]);
    }
    if ($method !== 'PUT' && $method !== 'POST') jsonResponse(['ok' => false, 'error' => 'Method not allowed.'], 405);

    $websiteUrl = trim((string)($input['websiteUrl'] ?? ''));
    $webmailUrl = trim((string)($input['webmailUrl'] ?? ''));
    foreach (['Back-office URL' => $websiteUrl, 'Webmail URL' => $webmailUrl] as $label => $url) {
        if ($url !== '' && (!filter_var($url, FILTER_VALIDATE_URL) || !in_array(strtolower((string)parse_url($url, PHP_URL_SCHEME)), ['https', 'http'], true))) {
            jsonResponse(['ok' => false, 'error' => "{$label} must be a valid http or https link."], 422);
        }
    }
    $email = strtolower(trim((string)($input['emailAddress'] ?? '')));
    if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) jsonResponse(['ok' => false, 'error' => 'Enter a valid mailbox email address.'], 422);
    $imapHost = trim((string)($input['imapHost'] ?? 'imap.hostinger.com'));
    $smtpHost = trim((string)($input['smtpHost'] ?? 'smtp.hostinger.com'));
    $imapPort = (int)($input['imapPort'] ?? 993);
    $smtpPort = (int)($input['smtpPort'] ?? 465);
    if (!preg_match('/^[A-Za-z0-9.-]+$/', $imapHost) || !preg_match('/^[A-Za-z0-9.-]+$/', $smtpHost) || $imapPort < 1 || $imapPort > 65535 || $smtpPort < 1 || $smtpPort > 65535) {
        jsonResponse(['ok' => false, 'error' => 'Enter valid incoming and outgoing mail server settings.'], 422);
    }
    $now = date('c');
    $websitePassword = (string)($input['websitePassword'] ?? '');
    $emailPassword = (string)($input['emailPassword'] ?? '');
    try {
        $websitePasswordEnc = !empty($input['clearWebsitePassword']) ? '' : ($websitePassword !== '' ? encryptClientSecret($websitePassword) : ($existing['website_password_enc'] ?? ''));
        $emailPasswordEnc = !empty($input['clearEmailPassword']) ? '' : ($emailPassword !== '' ? encryptClientSecret($emailPassword) : ($existing['email_password_enc'] ?? ''));
    } catch (Throwable $error) {
        error_log('[admin/client-access] Credential encryption failed: ' . $error->getMessage());
        jsonResponse(['ok' => false, 'error' => 'Credential encryption is not configured. Ask the platform administrator to check the stable SESSION_SECRET setting.'], 503);
    }
    $record = [
        'website_url' => $websiteUrl,
        'website_username' => trim((string)($input['websiteUsername'] ?? '')),
        'website_password_enc' => $websitePasswordEnc,
        'email_address' => $email,
        'webmail_url' => $webmailUrl,
        'email_password_enc' => $emailPasswordEnc,
        'imap_host' => $imapHost,
        'imap_port' => $imapPort,
        'smtp_host' => $smtpHost,
        'smtp_port' => $smtpPort,
        'updated_at' => $now,
    ];
    if ($existing) {
        $pdo->prepare('UPDATE client_access_credentials SET website_url=?, website_username=?, website_password_enc=?, email_address=?, webmail_url=?, email_password_enc=?, imap_host=?, imap_port=?, smtp_host=?, smtp_port=?, updated_at=? WHERE client_id=?')
            ->execute([...array_values($record), $clientId]);
    } else {
        $pdo->prepare('INSERT INTO client_access_credentials (website_url, website_username, website_password_enc, email_address, webmail_url, email_password_enc, imap_host, imap_port, smtp_host, smtp_port, updated_at, client_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
            ->execute([...array_values($record), $clientId]);
    }
    jsonResponse(['ok' => true, 'saved' => true]);
}

if ($apiPath === '/admin/accounting/overview') {
    if ($method !== 'GET') jsonResponse(['ok' => false, 'error' => 'Method not allowed.'], 405);
    requireSuperAdmin($pdo, $adminSession);

    $clients = $pdo->query("SELECT c.id, c.first_name, c.last_name, c.name, c.company, c.email, c.phone, c.status,
            COALESCE(a.portal_enabled, 0) AS portal_enabled,
            CASE WHEN a.client_id IS NULL THEN 'crm' ELSE 'portal' END AS source
        FROM clients c LEFT JOIN client_portal_access a ON a.client_id = c.id
        WHERE c.deleted_at IS NULL")->fetchAll();
    foreach ($clients as &$client) {
        $fullName = trim((string)($client['first_name'] ?? '') . ' ' . (string)($client['last_name'] ?? ''));
        $client['name'] = trim((string)($client['name'] ?? '')) ?: ($fullName ?: (trim((string)($client['company'] ?? '')) ?: 'Client'));
        $client['company'] = (string)($client['company'] ?? '');
        $client['email'] = (string)($client['email'] ?? '');
    }
    unset($client);
    usort($clients, static fn(array $a, array $b): int => strcasecmp((string)$a['name'], (string)$b['name']));

    $invoices = $pdo->query("
        SELECT i.*,
               COALESCE(NULLIF(c.name, ''), NULLIF(c.company, ''), 'Client') AS client_name,
               COALESCE(c.email, '') AS client_email
        FROM client_invoices i
        LEFT JOIN clients c ON c.id = i.client_id
        ORDER BY i.issue_date DESC, i.created_at DESC
    ")->fetchAll();
    $payments = $pdo->query("
        SELECT p.*,
               COALESCE(NULLIF(c.name, ''), NULLIF(c.company, ''), 'Client') AS client_name,
               COALESCE(c.email, '') AS client_email
        FROM client_payments p
        LEFT JOIN clients c ON c.id = p.client_id
        ORDER BY p.payment_date DESC, p.created_at DESC
    ")->fetchAll();
    $recurringServices = $pdo->query("
        SELECT s.*,
               COALESCE(NULLIF(c.name, ''), NULLIF(c.company, ''), 'Client') AS client_name,
               COALESCE(c.email, '') AS client_email
        FROM client_recurring_services s
        LEFT JOIN clients c ON c.id = s.client_id
        ORDER BY s.next_due_date ASC, s.service_name ASC
    ")->fetchAll();
    $hosting = $pdo->query('SELECT * FROM client_hosting ORDER BY renewal_date ASC')->fetchAll();
    $domains = $pdo->query('SELECT * FROM client_domains ORDER BY expiration_date ASC')->fetchAll();
    $followups = $pdo->query("
        SELECT f.*, i.invoice_number,
               COALESCE(NULLIF(c.name, ''), NULLIF(c.company, ''), 'Client') AS client_name,
               COALESCE(c.email, '') AS client_email,
               su.name AS staff_name
        FROM client_invoice_followups f
        LEFT JOIN client_invoices i ON i.id = f.invoice_id
        LEFT JOIN clients c ON c.id = f.client_id
        LEFT JOIN staff_users su ON su.id = f.created_by
        ORDER BY f.contact_date DESC, f.created_at DESC
    ")->fetchAll();

    jsonResponse([
        'ok' => true,
        'clients' => $clients,
        'invoices' => $invoices,
        'payments' => $payments,
        'recurringServices' => $recurringServices,
        'hosting' => $hosting,
        'domains' => $domains,
        'followups' => $followups,
    ]);
}

$isAccountingPaymentVoid = preg_match('#^/admin/accounting/([^/]+)/payments/([^/]+)/void$#', $apiPath, $accountingPaymentVoidMatch) === 1;
if ($isAccountingPaymentVoid) {
    if ($method !== 'POST') jsonResponse(['ok' => false, 'error' => 'Method not allowed.'], 405);
    $clientId = rawurldecode($accountingPaymentVoidMatch[1]);
    $paymentId = rawurldecode($accountingPaymentVoidMatch[2]);
    requireClientProfileSectionAccess($pdo, $adminSession, $clientId, 'accounting', true);

    $reason = trim((string)($input['reason'] ?? ''));
    if (strlen($reason) < 5 || strlen($reason) > 500) {
        jsonResponse(['ok' => false, 'error' => 'Enter a void reason between 5 and 500 characters.'], 422);
    }

    $pdo->beginTransaction();
    try {
        $paymentStmt = $pdo->prepare('SELECT * FROM client_payments WHERE id = ? AND client_id = ?');
        $paymentStmt->execute([$paymentId, $clientId]);
        $payment = $paymentStmt->fetch();
        if (!$payment) {
            $pdo->rollBack();
            jsonResponse(['ok' => false, 'error' => 'Payment receipt not found.'], 404);
        }
        $paymentStatus = strtolower(trim((string)($payment['status'] ?? '')));
        if ($paymentStatus === 'voided') {
            $pdo->rollBack();
            jsonResponse(['ok' => false, 'error' => 'This payment has already been voided.'], 409);
        }
        if (!in_array($paymentStatus, ['completed', 'received', 'paid', 'partially paid'], true)) {
            $pdo->rollBack();
            jsonResponse(['ok' => false, 'error' => 'Only a completed payment can be voided.'], 409);
        }

        $voidedAt = date('c');
        $voidUpdate = $pdo->prepare("UPDATE client_payments SET status = 'Voided', void_reason = ?, voided_by = ?, voided_at = ? WHERE id = ? AND client_id = ? AND LOWER(COALESCE(status, '')) IN ('completed', 'received', 'paid', 'partially paid')");
        $voidUpdate->execute([$reason, $adminSession['id'], $voidedAt, $paymentId, $clientId]);
        if ($voidUpdate->rowCount() !== 1) {
            $pdo->rollBack();
            jsonResponse(['ok' => false, 'error' => 'This receipt was changed by another user. Refresh the ledger before trying again.'], 409);
        }

        if (!empty($payment['invoice_id'])) {
            $invoiceStmt = $pdo->prepare('SELECT * FROM client_invoices WHERE id = ? AND client_id = ?');
            $invoiceStmt->execute([$payment['invoice_id'], $clientId]);
            $invoice = $invoiceStmt->fetch();
            if ($invoice) {
                $paidStmt = $pdo->prepare("SELECT COALESCE(SUM(amount), 0) FROM client_payments WHERE invoice_id = ? AND client_id = ? AND LOWER(COALESCE(status, '')) <> 'voided'");
                $paidStmt->execute([$payment['invoice_id'], $clientId]);
                $amountPaid = round((float)$paidStmt->fetchColumn(), 2);
                $balanceDue = round(max(0, (float)$invoice['total'] - $amountPaid), 2);
                $invoiceStatus = $balanceDue <= 0 ? 'Paid' : ($amountPaid > 0 ? 'Partially Paid' : 'Pending');
                $paidDate = $balanceDue <= 0 ? ($invoice['paid_date'] ?: $payment['payment_date']) : null;
                $pdo->prepare('UPDATE client_invoices SET amount_paid = ?, balance_due = ?, status = ?, paid_date = ? WHERE id = ? AND client_id = ?')
                    ->execute([$amountPaid, $balanceDue, $invoiceStatus, $paidDate, $payment['invoice_id'], $clientId]);
            }
        }

        $details = json_encode([
            'paymentId' => $paymentId,
            'receiptNumber' => $payment['receipt_number'],
            'invoiceId' => $payment['invoice_id'],
            'amount' => (float)$payment['amount'],
            'currency' => $payment['currency'] ?? 'USD',
            'reason' => $reason,
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $pdo->prepare('INSERT INTO audit_logs (id, user_id, client_name, action, details, ip_address, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
            ->execute([
                'aud_' . bin2hex(random_bytes(8)),
                $adminSession['id'],
                $clientId,
                'ACCOUNTING_PAYMENT_VOIDED',
                $details,
                $_SERVER['REMOTE_ADDR'] ?? '',
                $voidedAt,
            ]);
        $pdo->commit();
        jsonResponse(['ok' => true, 'paymentId' => $paymentId, 'status' => 'Voided', 'voidedAt' => $voidedAt]);
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}

$accountingAssetMatch = [];
if (preg_match('#^/admin/accounting/([^/]+)/assets/(hosting|domain)/([^/]+)$#', $apiPath, $accountingAssetMatch)) {
    if ($method !== 'PUT') jsonResponse(['ok' => false, 'error' => 'Method not allowed.'], 405);
    $clientId = rawurldecode($accountingAssetMatch[1]);
    $assetType = $accountingAssetMatch[2];
    $assetId = rawurldecode($accountingAssetMatch[3]);
    requireClientProfileSectionAccess($pdo, $adminSession, $clientId, 'accounting', true);

    $amountKey = $assetType === 'hosting' ? 'amount' : 'renewalAmount';
    $rawAmount = $input[$amountKey] ?? null;
    $amount = $rawAmount === null || $rawAmount === '' ? null : (is_numeric($rawAmount) ? round((float)$rawAmount, 2) : false);
    $currency = strtoupper(trim((string)($input['currency'] ?? 'USD')));
    if ($amount === false || ($amount !== null && ($amount < 0 || $amount > 100000000)) || !preg_match('/^[A-Z]{3}$/', $currency)) {
        jsonResponse(['ok' => false, 'error' => 'Enter a non-negative renewal amount and a valid three-letter currency code.'], 422);
    }
    if ($assetType === 'hosting' && $amount === null) {
        jsonResponse(['ok' => false, 'error' => 'Hosting renewal amount cannot be blank. Use 0 when the price is unknown.'], 422);
    }

    $table = $assetType === 'hosting' ? 'client_hosting' : 'client_domains';
    $exists = $pdo->prepare("SELECT id FROM {$table} WHERE id = ? AND client_id = ?");
    $exists->execute([$assetId, $clientId]);
    if (!$exists->fetchColumn()) jsonResponse(['ok' => false, 'error' => 'Tracked service not found.'], 404);

    if ($assetType === 'hosting') {
        $pdo->prepare('UPDATE client_hosting SET amount = ?, currency = ? WHERE id = ? AND client_id = ?')
            ->execute([$amount, $currency, $assetId, $clientId]);
    } else {
        $pdo->prepare('UPDATE client_domains SET renewal_amount = ?, currency = ? WHERE id = ? AND client_id = ?')
            ->execute([$amount, $currency, $assetId, $clientId]);
    }
    jsonResponse(['ok' => true, 'saved' => true]);
}

$isAccountingBatchInvoice = $apiPath === '/admin/accounting/recurring/invoice-due';
if ($isAccountingBatchInvoice) {
    if ($method !== 'POST') jsonResponse(['ok' => false, 'error' => 'Method not allowed.'], 405);
    requireSuperAdmin($pdo, $adminSession);
    $serviceIds = $input['serviceIds'] ?? null;
    if (!is_array($serviceIds) || count($serviceIds) < 1 || count($serviceIds) > 100) {
        jsonResponse(['ok' => false, 'error' => 'Select between 1 and 100 recurring services to invoice.'], 422);
    }
    $normalizedIds = [];
    foreach ($serviceIds as $serviceId) {
        if (!is_string($serviceId) || trim($serviceId) === '') {
            jsonResponse(['ok' => false, 'error' => 'The recurring service selection is invalid.'], 422);
        }
        $normalizedIds[] = trim($serviceId);
    }
    if (count(array_unique($normalizedIds)) !== count($normalizedIds)) {
        jsonResponse(['ok' => false, 'error' => 'The recurring service selection contains duplicates. Refresh the due-work list and try again.'], 422);
    }

    $pdo->beginTransaction();
    try {
        $invoices = [];
        foreach ($normalizedIds as $serviceId) {
            $clientStmt = $pdo->prepare('SELECT client_id FROM client_recurring_services WHERE id = ?');
            $clientStmt->execute([$serviceId]);
            $clientId = (string)($clientStmt->fetchColumn() ?: '');
            if ($clientId === '') {
                throw new AccountingActionException('A selected recurring service no longer exists. Refresh the due-work list and try again.', 409);
            }
            $invoices[] = createRecurringInvoice($pdo, $clientId, $serviceId, true);
        }
        $pdo->commit();
        jsonResponse(['ok' => true, 'invoices' => $invoices, 'count' => count($invoices)]);
    } catch (AccountingActionException $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        jsonResponse(['ok' => false, 'error' => $error->getMessage()], $error->getCode() ?: 409);
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}

$accountingServiceInvoiceMatch = [];
$accountingServiceResourceMatch = [];
$accountingServiceCollectionMatch = [];
$isAccountingServiceInvoice = preg_match('#^/admin/accounting/([^/]+)/services/([^/]+)/invoice$#', $apiPath, $accountingServiceInvoiceMatch) === 1;
$isAccountingServiceResource = !$isAccountingServiceInvoice
    && preg_match('#^/admin/accounting/([^/]+)/services/([^/]+)$#', $apiPath, $accountingServiceResourceMatch) === 1;
$isAccountingServiceCollection = !$isAccountingServiceInvoice && !$isAccountingServiceResource
    && preg_match('#^/admin/accounting/([^/]+)/services$#', $apiPath, $accountingServiceCollectionMatch) === 1;

if ($isAccountingServiceInvoice || $isAccountingServiceResource || $isAccountingServiceCollection) {
    $routeMatch = $isAccountingServiceInvoice
        ? $accountingServiceInvoiceMatch
        : ($isAccountingServiceResource ? $accountingServiceResourceMatch : $accountingServiceCollectionMatch);
    $clientId = rawurldecode($routeMatch[1]);
    $serviceId = $isAccountingServiceInvoice || $isAccountingServiceResource ? rawurldecode($routeMatch[2]) : '';
    requireClientProfileSectionAccess($pdo, $adminSession, $clientId, 'accounting', true);

    $serviceTypes = ['Hosting', 'Domain', 'Custom email', 'Site maintenance', 'Support', 'Other'];
    $isValidDate = static function (string $value): bool {
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) return false;
        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
        return $date !== false && $date->format('Y-m-d') === $value;
    };

    if ($isAccountingServiceCollection) {
        if ($method !== 'POST') jsonResponse(['ok' => false, 'error' => 'Method not allowed.'], 405);

        $clientStmt = $pdo->prepare('SELECT id FROM clients WHERE id = ? AND deleted_at IS NULL');
        $clientStmt->execute([$clientId]);
        if (!$clientStmt->fetchColumn()) jsonResponse(['ok' => false, 'error' => 'Choose an existing Client record.'], 404);

        $serviceName = trim((string)($input['serviceName'] ?? ''));
        $serviceType = trim((string)($input['serviceType'] ?? 'Other'));
        $description = trim((string)($input['description'] ?? ''));
        $amount = round((float)($input['amount'] ?? 0), 2);
        $currency = strtoupper(trim((string)($input['currency'] ?? 'USD')));
        $frequency = trim((string)($input['billingFrequency'] ?? 'Monthly'));
        $startDate = trim((string)($input['startDate'] ?? date('Y-m-d')));
        $nextDueDate = trim((string)($input['nextDueDate'] ?? ''));
        if ($serviceName === '' || strlen($serviceName) > 191 || !in_array($serviceType, $serviceTypes, true)
            || $amount <= 0 || $amount > 100000000 || !preg_match('/^[A-Z]{3}$/', $currency)
            || !in_array($frequency, ['Monthly', 'Yearly'], true)
            || !$isValidDate($startDate) || !$isValidDate($nextDueDate)) {
            jsonResponse(['ok' => false, 'error' => 'Check the service name, amount, currency, billing frequency, and dates.'], 422);
        }

        $id = 'rsv_' . bin2hex(random_bytes(8));
        $now = date('c');
        $pdo->prepare("
            INSERT INTO client_recurring_services
                (id, client_id, service_name, service_type, description, amount, currency, billing_frequency, start_date, next_due_date, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?)
        ")->execute([$id, $clientId, $serviceName, $serviceType, $description, $amount, $currency, $frequency, $startDate, $nextDueDate, $now, $now]);
        jsonResponse(['ok' => true, 'serviceId' => $id]);
    }

    if ($isAccountingServiceResource) {
        if ($method !== 'PUT') jsonResponse(['ok' => false, 'error' => 'Method not allowed.'], 405);
        $existingStmt = $pdo->prepare('SELECT id FROM client_recurring_services WHERE id = ? AND client_id = ?');
        $existingStmt->execute([$serviceId, $clientId]);
        if (!$existingStmt->fetch()) jsonResponse(['ok' => false, 'error' => 'Recurring service not found.'], 404);

        $serviceName = trim((string)($input['serviceName'] ?? ''));
        $serviceType = trim((string)($input['serviceType'] ?? 'Other'));
        $description = trim((string)($input['description'] ?? ''));
        $amount = round((float)($input['amount'] ?? 0), 2);
        $currency = strtoupper(trim((string)($input['currency'] ?? 'USD')));
        $frequency = trim((string)($input['billingFrequency'] ?? 'Monthly'));
        $startDate = trim((string)($input['startDate'] ?? ''));
        $nextDueDate = trim((string)($input['nextDueDate'] ?? ''));
        $status = trim((string)($input['status'] ?? 'Active'));
        if ($serviceName === '' || strlen($serviceName) > 191 || !in_array($serviceType, $serviceTypes, true)
            || $amount <= 0 || $amount > 100000000 || !preg_match('/^[A-Z]{3}$/', $currency)
            || !in_array($frequency, ['Monthly', 'Yearly'], true)
            || !$isValidDate($startDate) || !$isValidDate($nextDueDate)
            || !in_array($status, ['Active', 'Paused', 'Cancelled'], true)) {
            jsonResponse(['ok' => false, 'error' => 'Check the service details, amount, billing frequency, dates, and status.'], 422);
        }
        $pdo->prepare("
            UPDATE client_recurring_services
            SET service_name = ?, service_type = ?, description = ?, amount = ?, currency = ?,
                billing_frequency = ?, start_date = ?, next_due_date = ?, status = ?, updated_at = ?
            WHERE id = ? AND client_id = ?
        ")->execute([$serviceName, $serviceType, $description, $amount, $currency, $frequency, $startDate, $nextDueDate, $status, date('c'), $serviceId, $clientId]);
        jsonResponse(['ok' => true, 'saved' => true]);
    }

    if ($method !== 'POST') jsonResponse(['ok' => false, 'error' => 'Method not allowed.'], 405);
    $pdo->beginTransaction();
    try {
        $invoice = createRecurringInvoice($pdo, $clientId, $serviceId);
        $pdo->commit();
        jsonResponse(['ok' => true, ...$invoice]);
    } catch (AccountingActionException $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        jsonResponse(['ok' => false, 'error' => $error->getMessage()], $error->getCode() ?: 409);
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}

$accountingFollowupsMatch = [];
if (preg_match('#^/admin/accounting/([^/]+)/followups$#', $apiPath, $accountingFollowupsMatch)) {
    if ($method !== 'POST') jsonResponse(['ok' => false, 'error' => 'Method not allowed.'], 405);
    $clientId = rawurldecode($accountingFollowupsMatch[1]);
    requireClientProfileSectionAccess($pdo, $adminSession, $clientId, 'accounting', true);

    $invoiceId = trim((string)($input['invoiceId'] ?? ''));
    $contactDate = trim((string)($input['contactDate'] ?? ''));
    $contactMethod = trim((string)($input['contactMethod'] ?? ''));
    $nextFollowUpDateInput = trim((string)($input['nextFollowUpDate'] ?? ''));
    $note = trim((string)($input['note'] ?? ''));
    $isValidFollowupDate = static function (string $value): bool {
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) return false;
        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
        return $date !== false && $date->format('Y-m-d') === $value;
    };
    if ($invoiceId === '' || strlen($invoiceId) > 191
        || !$isValidFollowupDate($contactDate)
        || !in_array($contactMethod, ['email', 'phone', 'meeting', 'other'], true)
        || strlen($note) < 3 || strlen($note) > 2000
        || ($nextFollowUpDateInput !== '' && !$isValidFollowupDate($nextFollowUpDateInput))
        || ($nextFollowUpDateInput !== '' && $nextFollowUpDateInput < $contactDate)) {
        jsonResponse(['ok' => false, 'error' => 'Check the invoice, action date, contact method, notes, and next follow-up date.'], 422);
    }

    $invoiceStmt = $pdo->prepare('SELECT id, status, balance_due FROM client_invoices WHERE id = ? AND client_id = ?');
    $invoiceStmt->execute([$invoiceId, $clientId]);
    $invoice = $invoiceStmt->fetch();
    if (!$invoice) jsonResponse(['ok' => false, 'error' => 'That invoice does not belong to this client.'], 404);
    if (strtolower((string)$invoice['status']) === 'draft' || (float)$invoice['balance_due'] <= 0) {
        jsonResponse(['ok' => false, 'error' => 'Follow-ups can only be logged for invoices with an open balance.'], 409);
    }

    $followupId = 'fup_' . bin2hex(random_bytes(8));
    $createdAt = date('c');
    $createdBy = (string)($adminSession['id'] ?? '');
    $pdo->prepare("
        INSERT INTO client_invoice_followups
            (id, client_id, invoice_id, contact_date, contact_method, note, next_follow_up_date, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ")->execute([
        $followupId,
        $clientId,
        $invoiceId,
        $contactDate,
        $contactMethod,
        $note,
        $nextFollowUpDateInput !== '' ? $nextFollowUpDateInput : null,
        $createdBy,
        $createdAt,
    ]);
    jsonResponse(['ok' => true, 'followupId' => $followupId]);
}

if (preg_match('#^/admin/accounting/([^/]+)$#', $apiPath, $accountingMatch)) {
    $clientId = rawurldecode($accountingMatch[1]);
    requireClientProfileSectionAccess($pdo, $adminSession, $clientId, 'accounting', $method !== 'GET');
    if ($method === 'GET') {
        $invoices = $pdo->prepare('SELECT * FROM client_invoices WHERE client_id = ? ORDER BY issue_date DESC, created_at DESC');
        $invoices->execute([$clientId]);
        $payments = $pdo->prepare('SELECT * FROM client_payments WHERE client_id = ? ORDER BY payment_date DESC, created_at DESC');
        $payments->execute([$clientId]);
        $recurringServices = $pdo->prepare('SELECT * FROM client_recurring_services WHERE client_id = ? ORDER BY next_due_date ASC, service_name ASC');
        $recurringServices->execute([$clientId]);
        $hosting = $pdo->prepare('SELECT id, website_name, provider, plan, status, billing_frequency, amount, currency, renewal_date FROM client_hosting WHERE client_id = ?');
        $hosting->execute([$clientId]);
        $domains = $pdo->prepare('SELECT id, domain_name, registrar, expiration_date, renewal_amount, currency, renewal_status FROM client_domains WHERE client_id = ?');
        $domains->execute([$clientId]);
        $followups = $pdo->prepare("
            SELECT f.*, i.invoice_number, su.name AS staff_name
            FROM client_invoice_followups f
            LEFT JOIN client_invoices i ON i.id = f.invoice_id
            LEFT JOIN staff_users su ON su.id = f.created_by
            WHERE f.client_id = ?
            ORDER BY f.contact_date DESC, f.created_at DESC
        ");
        $followups->execute([$clientId]);
        jsonResponse(['ok' => true, 'invoices' => $invoices->fetchAll(), 'payments' => $payments->fetchAll(), 'recurringServices' => $recurringServices->fetchAll(), 'hosting' => $hosting->fetchAll(), 'domains' => $domains->fetchAll(), 'followups' => $followups->fetchAll()]);
    }
    if ($method !== 'POST') jsonResponse(['ok' => false, 'error' => 'Method not allowed.'], 405);
    $now = date('c');
    if (($input['type'] ?? '') === 'invoice') {
        $lineItems = $input['lineItems'] ?? [];
        if (!is_array($lineItems) || count($lineItems) < 1 || count($lineItems) > 30) jsonResponse(['ok' => false, 'error' => 'Add between 1 and 30 invoice items.'], 422);
        $cleanItems = [];
        $subtotal = 0.0;
        foreach ($lineItems as $item) {
            $description = trim((string)($item['description'] ?? ''));
            $service = trim((string)($item['service'] ?? 'Other'));
            $quantity = (float)($item['quantity'] ?? 1);
            $unitPrice = (float)($item['unitPrice'] ?? 0);
            if ($description === '' || $quantity <= 0 || $quantity > 100000 || $unitPrice < 0 || $unitPrice > 100000000) jsonResponse(['ok' => false, 'error' => 'Check each item description, quantity, and price.'], 422);
            $lineTotal = round($quantity * $unitPrice, 2);
            $subtotal += $lineTotal;
            $cleanItems[] = ['description' => $description, 'service' => $service, 'quantity' => $quantity, 'unitPrice' => round($unitPrice, 2), 'total' => $lineTotal];
        }
        $taxRate = (float)($input['taxRate'] ?? 0);
        if ($taxRate < 0 || $taxRate > 100) jsonResponse(['ok' => false, 'error' => 'Tax rate must be between 0 and 100%.'], 422);
        $subtotal = round($subtotal, 2);
        $tax = round($subtotal * $taxRate / 100, 2);
        $total = round($subtotal + $tax, 2);
        $invoiceId = 'inv_' . bin2hex(random_bytes(8));
        $invoiceNumber = trim((string)($input['invoiceNumber'] ?? ''));
        if ($invoiceNumber === '') $invoiceNumber = 'INV-' . date('Y') . '-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 6));
        $issueDate = trim((string)($input['issueDate'] ?? date('Y-m-d')));
        $dueDate = trim((string)($input['dueDate'] ?? date('Y-m-d', strtotime('+14 days'))));
        if (!DateTime::createFromFormat('Y-m-d', $issueDate) || !DateTime::createFromFormat('Y-m-d', $dueDate)) jsonResponse(['ok' => false, 'error' => 'Use a valid issue date and due date.'], 422);
        $currency = strtoupper(trim((string)($input['currency'] ?? 'USD')));
        if (!preg_match('/^[A-Z]{3}$/', $currency)) jsonResponse(['ok' => false, 'error' => 'Use a valid three-letter currency code.'], 422);
        $pdo->prepare('INSERT INTO client_invoices (id, client_id, invoice_number, issue_date, due_date, status, currency, subtotal, tax, total, amount_paid, balance_due, line_items, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)')
            ->execute([$invoiceId, $clientId, $invoiceNumber, $issueDate, $dueDate, trim((string)($input['status'] ?? 'Pending')) === 'Draft' ? 'Draft' : 'Pending', $currency, $subtotal, $tax, $total, $total, json_encode($cleanItems, JSON_UNESCAPED_UNICODE), trim((string)($input['notes'] ?? '')), $now]);
        jsonResponse(['ok' => true, 'invoiceId' => $invoiceId, 'invoiceNumber' => $invoiceNumber, 'subtotal' => $subtotal, 'tax' => $tax, 'total' => $total, 'balanceDue' => $total]);
    }
    if (($input['type'] ?? '') === 'payment') {
        $amount = round((float)($input['amount'] ?? 0), 2);
        if ($amount <= 0 || $amount > 100000000) jsonResponse(['ok' => false, 'error' => 'Payment amount must be greater than zero.'], 422);
        $invoiceId = trim((string)($input['invoiceId'] ?? ''));
        $invoice = null;
        if ($invoiceId !== '') {
            $stmt = $pdo->prepare('SELECT * FROM client_invoices WHERE id = ? AND client_id = ?');
            $stmt->execute([$invoiceId, $clientId]);
            $invoice = $stmt->fetch();
            if (!$invoice) jsonResponse(['ok' => false, 'error' => 'That invoice does not belong to this client.'], 422);
            if (($invoice['status'] ?? '') === 'Draft') jsonResponse(['ok' => false, 'error' => 'A draft invoice cannot receive a payment until it is sent.'], 422);
            if ($amount > (float)$invoice['balance_due'] + 0.005) jsonResponse(['ok' => false, 'error' => 'Payment is greater than the invoice balance.'], 422);
        }
        $paymentCurrency = strtoupper(trim((string)($invoice['currency'] ?? $input['currency'] ?? 'USD')));
        if (!preg_match('/^[A-Z]{3}$/', $paymentCurrency)) jsonResponse(['ok' => false, 'error' => 'Use a valid three-letter payment currency code.'], 422);
        $paymentDate = trim((string)($input['paymentDate'] ?? date('Y-m-d')));
        if (!DateTime::createFromFormat('Y-m-d', $paymentDate)) jsonResponse(['ok' => false, 'error' => 'Use a valid payment date.'], 422);
        $paymentId = 'pay_' . bin2hex(random_bytes(8));
        $receiptNumber = 'RCP-' . date('Y') . '-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 6));
        $pdo->beginTransaction();
        try {
            $pdo->prepare('INSERT INTO client_payments (id, client_id, invoice_id, receipt_number, payment_date, amount, currency, payment_method, transaction_reference, description, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
                ->execute([$paymentId, $clientId, $invoiceId !== '' ? $invoiceId : null, $receiptNumber, $paymentDate, $amount, $paymentCurrency, trim((string)($input['paymentMethod'] ?? 'Bank transfer')), trim((string)($input['transactionReference'] ?? '')), trim((string)($input['description'] ?? 'Payment received')), 'Completed', $now]);
            if ($invoice) {
                $newPaid = round((float)$invoice['amount_paid'] + $amount, 2);
                $balance = round(max(0, (float)$invoice['total'] - $newPaid), 2);
                $status = $balance <= 0 ? 'Paid' : 'Partially Paid';
                $paidDate = $balance <= 0 ? $paymentDate : null;
                $pdo->prepare('UPDATE client_invoices SET amount_paid=?, balance_due=?, status=?, paid_date=? WHERE id=? AND client_id=?')
                    ->execute([$newPaid, $balance, $status, $paidDate, $invoiceId, $clientId]);
            }
            $pdo->commit();
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $error;
        }
        jsonResponse(['ok' => true, 'paymentId' => $paymentId, 'receiptNumber' => $receiptNumber]);
    }
    jsonResponse(['ok' => false, 'error' => 'Choose an invoice or payment record to save.'], 422);
}

if ($apiPath === '/admin/login' && $method === 'POST') {
    $email = strtolower(trim($input['email'] ?? ''));
    $password = $input['password'] ?? '';

    $stmt = $pdo->prepare("SELECT * FROM staff_users WHERE LOWER(email) = ?");
    $stmt->execute([$email]);
    $staff = $stmt->fetch();

    $validPassword = $staff && (password_verify($password, $staff['password']) || hash_equals((string)$staff['password'], (string)$password));
    if (!$validPassword) {
        jsonResponse(['ok' => false, 'error' => 'Invalid staff email or password.'], 401);
    }
    if ($staff['status'] !== 'Active') {
        jsonResponse(['ok' => false, 'error' => 'This staff account is currently suspended.'], 403);
    }

    $now = date('c');
    $pdo->prepare("UPDATE staff_users SET last_login_at = ? WHERE id = ?")->execute([$now, $staff['id']]);
    if (!password_get_info($staff['password'])['algo']) {
        $pdo->prepare("UPDATE staff_users SET password = ? WHERE id = ?")->execute([password_hash($password, PASSWORD_DEFAULT), $staff['id']]);
    }
    $token = bin2hex(random_bytes(32));
    $pdo->prepare("INSERT INTO admin_sessions (token_hash, user_id, expires_at, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?)")
        ->execute([hash('sha256', $token), $staff['id'], date('c', time() + 86400 * 14), $now, $now]);

    setSessionCookie(ADMIN_SESSION_COOKIE, $token, time() + 86400 * 14);
    jsonResponse([
        'ok' => true,
        'token' => $token,
        'user' => [
            'id' => $staff['id'],
            'name' => $staff['name'],
            'email' => $staff['email'],
            'role' => $staff['role'],
            'office_id' => $staff['office_id'],
            'team_id' => $staff['team_id'],
            'officeId' => $staff['office_id'],
            'teamId' => $staff['team_id'],
            'status' => $staff['status'],
            'last_login_at' => $now,
            'capabilities' => json_decode($staff['capabilities'] ?: '{}', true),
        ],
    ]);
}
