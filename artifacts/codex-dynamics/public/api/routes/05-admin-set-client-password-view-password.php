<?php
/** Route group: ADMIN: SET CLIENT PASSWORD & VIEW PASSWORD (included by index.php in order; uses its request globals). */

declare(strict_types=1);

// -----------------------------------------------------------------------------
// 5. ADMIN: SET CLIENT PASSWORD & VIEW PASSWORD
// -----------------------------------------------------------------------------
if (
    (preg_match('#^/admin/users/([^/]+)/set-password$#', $apiPath, $userPasswordMatch)
        || preg_match('#^/admin/leads/([^/]+)/set-password$#', $apiPath, $leadPasswordMatch))
    && $method === 'POST'
) {
    $passwordActor = requireActiveAdminStaff($pdo, $adminSession);
    $isLeadPassword = isset($leadPasswordMatch[1]);
    $userId = rawurldecode($isLeadPassword ? $leadPasswordMatch[1] : $userPasswordMatch[1]);
    $newPassword = trim((string)($input['password'] ?? $input['new_password'] ?? $input['client_password'] ?? ''));
    if (strlen($newPassword) < 8 || strlen($newPassword) > 4096) {
        jsonResponse(['ok' => false, 'error' => 'Password must contain at least 8 characters.'], 422);
    }

    $now = date('c');
    requireVisibleLead($pdo, $passwordActor, $userId);
    if ($isLeadPassword) {
        $leadStmt = $pdo->prepare('SELECT id, name, company, email, phone, country, country_code, created_at FROM clients WHERE id = ?');
        $leadStmt->execute([$userId]);
        $lead = $leadStmt->fetch();
        if (!$lead) jsonResponse(['ok' => false, 'error' => 'Lead not found.'], 404);
        $leadEmail = strtolower(trim((string)($lead['email'] ?? '')));
        if (!filter_var($leadEmail, FILTER_VALIDATE_EMAIL)) {
            jsonResponse(['ok' => false, 'error' => 'Add a valid email to this lead before creating portal access.'], 400);
        }
        $lead['email'] = $leadEmail;

        $pdo->beginTransaction();
        try {
            $emailCount = $pdo->prepare("SELECT COUNT(*) FROM clients WHERE LOWER(TRIM(email)) = ?");
            $emailCount->execute([$leadEmail]);
            if ((int)$emailCount->fetchColumn() > 1) {
                $pdo->rollBack();
                jsonResponse([
                    'ok' => false,
                    'code' => 'CLIENT_IDENTITY_REVIEW_REQUIRED',
                    'field' => 'email',
                    'error' => 'This email is linked to multiple Client records. Resolve the identity review before enabling portal access.',
                ], 409);
            }
            $portalClient = ensurePortalClientForLead($pdo, $lead, $newPassword, $now);
            $pdo->prepare('UPDATE clients SET updated_at = ? WHERE id = ?')->execute([$now, $userId]);
            $pdo->commit();
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $error;
        }
        $clientId = $portalClient['id'];
        $accountCreated = $portalClient['created'];
    } else {
        $clientStmt = $pdo->prepare('SELECT id, email FROM clients WHERE id = ? LIMIT 1');
        $clientStmt->execute([$userId]);
        $client = $clientStmt->fetch();
        if (!$client) {
            jsonResponse(['ok' => false, 'error' => 'Client not found. Use the Client ID.'], 404);
        }

        $passwordHash = password_hash($newPassword, PASSWORD_DEFAULT);
        if ($passwordHash === false) jsonResponse(['ok' => false, 'error' => 'Could not securely save the client password.'], 500);
        $pdo->beginTransaction();
        try {
            $accessExists = $pdo->prepare('SELECT client_id FROM client_portal_access WHERE client_id = ?');
            $accessExists->execute([$client['id']]);
            if ($accessExists->fetchColumn()) {
                $pdo->prepare('UPDATE client_portal_access SET password_hash = ? WHERE client_id = ?')->execute([$passwordHash, $client['id']]);
            } else {
                $pdo->prepare("INSERT INTO client_portal_access (client_id, password_hash, status, portal_enabled, created_at)
                    VALUES (?, ?, 'Active', 1, ?)")
                    ->execute([$client['id'], $passwordHash, $now]);
            }
            $pdo->prepare('UPDATE clients SET updated_at = ? WHERE id = ?')->execute([$now, $client['id']]);
            $pdo->commit();
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $error;
        }
        $clientId = (string)$client['id'];
        $accountCreated = false;
    }

    $auditId = 'aud_' . time() . '_' . substr(bin2hex(random_bytes(3)), 0, 4);
    $pdo->prepare("INSERT INTO audit_logs (id, user_id, action, details, created_at) VALUES (?, ?, 'PASSWORD_RESET', 'Admin updated client portal password', ?)")
        ->execute([$auditId, $clientId, $now]);

    jsonResponse([
        'ok' => true,
        'message' => 'Client portal password updated successfully.',
        'client_id' => $clientId,
        'client_account_created' => $accountCreated,
    ]);
}
