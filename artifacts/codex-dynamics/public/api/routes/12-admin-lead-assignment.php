<?php
/** Route group: ADMIN: LEAD ASSIGNMENT (included by index.php in order; uses its request globals). */

declare(strict_types=1);

// -----------------------------------------------------------------------------
// 12. ADMIN: LEAD ASSIGNMENT
// -----------------------------------------------------------------------------
if (preg_match('#^/admin/leads/(?:assign-bulk|bulk-assign)$#', $apiPath) && $method === 'POST') {
    $actor = requireActiveAdminStaff($pdo, $adminSession);
    if ($actor['role'] !== 'Super Admin') jsonResponse(['ok' => false, 'error' => 'Only a Super Admin can bulk assign leads.'], 403);
    if (isset($input['assignments'])) {
        if (!is_array($input['assignments']) || count($input['assignments']) === 0 || count($input['assignments']) > 5000) {
            jsonResponse(['ok' => false, 'error' => 'Provide between 1 and 5,000 lead assignments.'], 400);
        }
        $prepared = [];
        $seen = [];
        $lookup = $pdo->prepare('SELECT id FROM leads WHERE id = ? AND deleted_at IS NULL');
        foreach ($input['assignments'] as $entry) {
            if (!is_array($entry)) jsonResponse(['ok' => false, 'error' => 'An assignment entry is invalid.'], 400);
            $leadId = trim((string)($entry['lead_id'] ?? $entry['leadId'] ?? ''));
            if ($leadId === '' || isset($seen[$leadId])) jsonResponse(['ok' => false, 'error' => 'Each lead must appear exactly once in the assignment list.'], 422);
            $seen[$leadId] = true;
            $lookup->execute([$leadId]);
            if (!$lookup->fetchColumn()) jsonResponse(['ok' => false, 'error' => "Lead {$leadId} is unavailable."], 404);
            $prepared[] = [
                'lead_id' => $leadId,
                'assignment' => validateLeadAssignment($pdo, [
                    'office_id' => $entry['assigned_office_id'] ?? $entry['officeId'] ?? $entry['office_id'] ?? null,
                    'team_id' => $entry['assigned_team_id'] ?? $entry['teamId'] ?? $entry['team_id'] ?? null,
                    'team_leader_id' => $entry['assigned_team_leader_id'] ?? $entry['teamLeaderId'] ?? $entry['team_leader_id'] ?? null,
                    'agent_id' => $entry['assigned_agent_id'] ?? $entry['agentId'] ?? $entry['agent_id'] ?? null,
                ]),
            ];
        }
        $pdo->beginTransaction();
        try {
            $updated = [];
            foreach ($prepared as $entry) $updated[] = normalizeLeadRow(saveLeadAssignment($pdo, $entry['lead_id'], $entry['assignment'], $actor));
            $pdo->commit();
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $error;
        }
        jsonResponse(['ok' => true, 'updated' => count($updated), 'leads' => $updated]);
    }
    $leadIds = $input['lead_ids'] ?? $input['ids'] ?? [];
    if (!is_array($leadIds) || count($leadIds) === 0) jsonResponse(['ok' => false, 'error' => 'Select at least one lead.'], 400);
    $leadIds = array_values(array_unique(array_filter(array_map(static fn($id) => trim((string)$id), $leadIds))));
    $officeId = $input['assigned_office_id'] ?? $input['officeId'] ?? $input['office_id'] ?? null;
    $teamId = $input['assigned_team_id'] ?? $input['teamId'] ?? $input['team_id'] ?? null;
    $teamLeaderId = $input['assigned_team_leader_id'] ?? $input['teamLeaderId'] ?? $input['team_leader_id'] ?? null;
    $agentId = $input['assigned_agent_id'] ?? $input['agentId'] ?? $input['agent_id'] ?? null;
    $assignment = validateLeadAssignment($pdo, ['office_id' => $officeId, 'team_id' => $teamId, 'team_leader_id' => $teamLeaderId, 'agent_id' => $agentId]);
    $leadRows = [];
    $leadLookup = $pdo->prepare('SELECT id FROM leads WHERE id = ? AND deleted_at IS NULL');
    foreach ($leadIds as $leadId) {
        $leadLookup->execute([$leadId]);
        if (!$leadLookup->fetchColumn()) jsonResponse(['ok' => false, 'error' => "Lead {$leadId} is unavailable."], 404);
        $leadRows[] = $leadId;
    }
    $pdo->beginTransaction();
    try {
        $updated = [];
        foreach ($leadRows as $leadId) $updated[] = normalizeLeadRow(saveLeadAssignment($pdo, $leadId, $assignment, $actor));
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
    jsonResponse(['ok' => true, 'updated' => count($updated), 'leads' => $updated]);
}

if (preg_match('#^/admin/leads/([^/]+)/assign$#', $apiPath, $m) && $method === 'POST') {
    $actor = requireActiveAdminStaff($pdo, $adminSession);
    $leadId = $m[1];
    $officeId = $input['assigned_office_id'] ?? $input['officeId'] ?? $input['office_id'] ?? null;
    $teamId = $input['assigned_team_id'] ?? $input['teamId'] ?? $input['team_id'] ?? null;
    $teamLeaderId = $input['assigned_team_leader_id'] ?? $input['teamLeaderId'] ?? $input['team_leader_id'] ?? null;
    $agentId = $input['assigned_agent_id'] ?? $input['agentId'] ?? $input['agent_id'] ?? null;
    $stmt = $pdo->prepare('SELECT * FROM leads WHERE id = ? AND deleted_at IS NULL');
    $stmt->execute([$leadId]);
    $lead = $stmt->fetch();
    if (!$lead) jsonResponse(['ok' => false, 'error' => 'Lead not found.'], 404);
    if (!actorCanViewLead($actor, $lead)) jsonResponse(['ok' => false, 'error' => 'You cannot access this lead.'], 403);
    $assignment = validateLeadAssignment($pdo, ['office_id' => $officeId, 'team_id' => $teamId, 'team_leader_id' => $teamLeaderId, 'agent_id' => $agentId]);
    assertCanAssignLead($actor, $assignment, $pdo);
    $pdo->beginTransaction();
    try {
        $updated = saveLeadAssignment($pdo, $leadId, $assignment, $actor);
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
    jsonResponse(['ok' => true, 'lead' => normalizeLeadRow($updated)]);
}

// Admin lead actions called by the bulk toolbar and lead profile dialogs.
if ($apiPath === '/admin/leads/bulk-status' && $method === 'POST') {
    $actor = requireActiveAdminStaff($pdo, $adminSession);
    if ($actor['role'] !== 'Super Admin') jsonResponse(['ok' => false, 'error' => 'Only a Super Admin can bulk-update lead status.'], 403);
    $ids = $input['ids'] ?? [];
    $status = trim((string)($input['status'] ?? ''));
    $allowedStatuses = ['Active', 'Suspended', 'Disabled', 'New', 'In Line', 'No Answer', 'Deposit', 'Failed Deposit', 'Didn\'t Register', 'Not Interested', 'Low Potential', 'NA1', 'NA2', 'NA3', 'Never Answer', 'No Potential', 'Wrong Person', 'Wrong Number', 'Call Back'];
    if (!is_array($ids) || count($ids) === 0 || count($ids) > 5000 || !in_array($status, $allowedStatuses, true)) {
        jsonResponse(['ok' => false, 'error' => 'Provide selected lead IDs and a valid status.'], 422);
    }
    $ids = array_values(array_unique(array_filter(array_map(static fn($id) => trim((string)$id), $ids))));
    $pdo->beginTransaction();
    try {
        $update = $pdo->prepare('UPDATE leads SET status = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL');
        $updated = [];
        foreach ($ids as $id) {
            $update->execute([$status, date('c'), $id]);
            if ($update->rowCount() > 0) $updated[] = $id;
        }
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
    jsonResponse(['ok' => true, 'updated' => count($updated), 'ids' => $updated]);
}

if (preg_match('#^/admin/leads/([^/]+)/(reset-status|comments|status-history)(?:/([^/]+))?$#', $apiPath, $m)) {
    $actor = requireActiveAdminStaff($pdo, $adminSession);
    $leadId = rawurldecode($m[1]);
    $action = $m[2];
    $entryId = isset($m[3]) ? rawurldecode($m[3]) : null;
    if ($method === 'POST' && $action === 'reset-status') {
        $lead = requireVisibleLead($pdo, $actor, $leadId);
        $history = json_decode((string)($lead['status_history'] ?? '[]'), true);
        if (!is_array($history)) $history = [];
        $history[] = [
            'id' => 'st_' . bin2hex(random_bytes(5)),
            'from_stage' => (string)($lead['stage'] ?? ''),
            'to_stage' => 'New',
            'by_admin_id' => $actor['id'],
            'by_name' => $actor['name'],
            'created_at' => date('c'),
        ];
        $pdo->prepare('UPDATE leads SET stage = ?, status = ?, status_history = ?, updated_at = ? WHERE id = ?')
            ->execute(['New', 'New', json_encode($history, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), date('c'), $leadId]);
    } elseif ($method === 'DELETE' && $action === 'comments') {
        $lead = requireVisibleLead($pdo, $actor, $leadId);
        if ($entryId === null) {
            $pdo->prepare('UPDATE leads SET comment_history = ?, updated_at = ? WHERE id = ?')
                ->execute(['[]', date('c'), $leadId]);
        } else {
            $comments = json_decode((string)($lead['comment_history'] ?? '[]'), true);
            if (!is_array($comments)) $comments = [];
            $comments = array_values(array_filter($comments, static fn($comment) =>
                !is_array($comment) || (string)($comment['id'] ?? $comment['comment_id'] ?? '') !== $entryId
            ));
            $pdo->prepare('UPDATE leads SET comment_history = ?, updated_at = ? WHERE id = ?')
                ->execute([json_encode($comments, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), date('c'), $leadId]);
        }
    } elseif ($method === 'DELETE' && $action === 'status-history' && $entryId !== null) {
        $lead = requireVisibleLead($pdo, $actor, $leadId);
        $history = json_decode((string)($lead['status_history'] ?? '[]'), true);
        if (!is_array($history)) $history = [];
        $history = array_values(array_filter($history, static fn($entry) =>
            !is_array($entry) || (string)($entry['id'] ?? '') !== $entryId
        ));
        $pdo->prepare('UPDATE leads SET status_history = ?, updated_at = ? WHERE id = ?')
            ->execute([json_encode($history, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), date('c'), $leadId]);
    } else {
        jsonResponse(['ok' => false, 'error' => 'Method not allowed.'], 405);
    }
    $updatedLead = $pdo->prepare('SELECT * FROM leads WHERE id = ?');
    $updatedLead->execute([$leadId]);
    jsonResponse(['ok' => true, 'lead' => normalizeLeadRow($updatedLead->fetch() ?: [])]);
}

if ($apiPath === '/admin/leads/bin/cleanup' && $method === 'POST') {
    $actor = requireActiveAdminStaff($pdo, $adminSession);
    if ($actor['role'] !== 'Super Admin') jsonResponse(['ok' => false, 'error' => 'Only a Super Admin can clean up the recycle bin.'], 403);
    $days = filter_var($input['older_than_days'] ?? 30, FILTER_VALIDATE_INT);
    if ($days === false || $days < 1 || $days > 3650) jsonResponse(['ok' => false, 'error' => 'The cleanup age must be between 1 and 3,650 days.'], 422);
    $cutoff = date('c', time() - ($days * 86400));
    $q = $pdo->prepare('SELECT id FROM leads WHERE deleted_at IS NOT NULL AND deleted_at < ?');
    $q->execute([$cutoff]);
    $ids = array_map('strval', $q->fetchAll(PDO::FETCH_COLUMN));
    if ($ids) {
        $pdo->beginTransaction();
        try {
            $assignmentHistory = $pdo->prepare('DELETE FROM lead_assignment_history WHERE lead_id = ?');
            $deleteLead = $pdo->prepare('DELETE FROM leads WHERE id = ? AND deleted_at IS NOT NULL');
            foreach ($ids as $id) {
                $assignmentHistory->execute([$id]);
                $deleteLead->execute([$id]);
            }
            $pdo->commit();
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $error;
        }
    }
    jsonResponse(['ok' => true, 'deleted' => count($ids), 'ids' => $ids]);
}

if ($apiPath === '/admin/leads/bin/purge-all' && $method === 'POST') {
    $actor = requireActiveAdminStaff($pdo, $adminSession);
    if ($actor['role'] !== 'Super Admin') jsonResponse(['ok' => false, 'error' => 'Only a Super Admin can permanently purge the recycle bin.'], 403);
    $requestedIds = $input['ids'] ?? [];
    if (!is_array($requestedIds) || count($requestedIds) > 5000) jsonResponse(['ok' => false, 'error' => 'Provide a valid list of lead IDs.'], 422);
    if ($requestedIds) {
        $requestedIds = array_values(array_unique(array_filter(array_map(static fn($id) => trim((string)$id), $requestedIds))));
        $placeholders = implode(',', array_fill(0, count($requestedIds), '?'));
        $q = $pdo->prepare("SELECT id FROM leads WHERE deleted_at IS NOT NULL AND id IN ({$placeholders})");
        $q->execute($requestedIds);
    } else {
        $q = $pdo->query('SELECT id FROM leads WHERE deleted_at IS NOT NULL');
    }
    $ids = array_map('strval', $q->fetchAll(PDO::FETCH_COLUMN));
    if ($ids) {
        $pdo->beginTransaction();
        try {
            $assignmentHistory = $pdo->prepare('DELETE FROM lead_assignment_history WHERE lead_id = ?');
            $deleteLead = $pdo->prepare('DELETE FROM leads WHERE id = ? AND deleted_at IS NOT NULL');
            foreach ($ids as $id) {
                $assignmentHistory->execute([$id]);
                $deleteLead->execute([$id]);
            }
            $pdo->commit();
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $error;
        }
    }
    jsonResponse(['ok' => true, 'deleted' => count($ids), 'ids' => $ids]);
}

// Registration and password-reset queues used by the Super Admin tools.
if ($apiPath === '/admin/signup-requests') {
    $actor = requireActiveAdminStaff($pdo, $adminSession);
    if ($actor['role'] !== 'Super Admin') jsonResponse(['ok' => false, 'error' => 'Only a Super Admin can manage signup requests.'], 403);
    if ($method !== 'GET') jsonResponse(['ok' => false, 'error' => 'Method not allowed.'], 405);
    $status = trim((string)($_GET['status'] ?? 'pending'));
    if ($status === 'all') {
        $rows = $pdo->query('SELECT * FROM signup_requests ORDER BY created_at DESC')->fetchAll();
    } else {
        $stmt = $pdo->prepare('SELECT * FROM signup_requests WHERE status = ? ORDER BY created_at DESC');
        $stmt->execute([$status]);
        $rows = $stmt->fetchAll();
    }
    $items = [];
    foreach ($rows as $row) {
        $details = json_decode((string)$row['request_data'], true);
        if (!is_array($details)) $details = [];
        $items[] = array_merge($details, [
            'id' => $row['id'],
            'name' => $row['name'],
            'email' => $row['email'],
            'status' => $row['status'],
            'createdAt' => $row['created_at'],
        ]);
    }
    jsonResponse(['ok' => true, 'items' => $items, 'total' => count($items)]);
}

if (preg_match('#^/admin/signup-requests/([^/]+)(?:/(approve|reject))?$#', $apiPath, $m)) {
    $actor = requireActiveAdminStaff($pdo, $adminSession);
    if ($actor['role'] !== 'Super Admin') jsonResponse(['ok' => false, 'error' => 'Only a Super Admin can manage signup requests.'], 403);
    $requestId = rawurldecode($m[1]);
    $action = $m[2] ?? '';
    $q = $pdo->prepare('SELECT * FROM signup_requests WHERE id = ?');
    $q->execute([$requestId]);
    $request = $q->fetch();
    if (!$request) jsonResponse(['ok' => false, 'error' => 'Signup request not found.'], 404);
    if ($method === 'DELETE' && $action === '') {
        $pdo->prepare('DELETE FROM signup_requests WHERE id = ?')->execute([$requestId]);
        jsonResponse(['ok' => true, 'id' => $requestId, 'deleted' => true]);
    }
    if ($method === 'POST' && $action === 'reject') {
        $reason = trim((string)($input['reason'] ?? ''));
        $code = trim((string)($input['code'] ?? ''));
        $pdo->prepare("UPDATE signup_requests SET status = 'rejected', rejection_reason = ?, reviewed_at = ? WHERE id = ? AND status = 'pending'")
            ->execute([$reason !== '' ? $reason : $code, date('c'), $requestId]);
        jsonResponse(['ok' => true, 'id' => $requestId, 'status' => 'rejected']);
    }
    if ($method === 'POST' && $action === 'approve') {
        if ($request['status'] !== 'pending') jsonResponse(['ok' => false, 'error' => 'This request has already been reviewed.'], 409);
        $code = trim((string)($input['verification_code'] ?? $input['verificationCode'] ?? ''));
        if (!preg_match('/^\d{6}$/', $code)) jsonResponse(['ok' => false, 'error' => 'Enter a six-digit verification code.'], 422);
        $data = json_decode((string)$request['request_data'], true);
        if (!is_array($data)) jsonResponse(['ok' => false, 'error' => 'Signup request data is invalid.'], 422);
        $email = strtolower(trim((string)$request['email']));
        $candidateStmt = $pdo->prepare("SELECT id, name, company, email FROM clients WHERE LOWER(TRIM(email)) = ? AND deleted_at IS NULL ORDER BY created_at, id");
        $candidateStmt->execute([$email]);
        $candidates = $candidateStmt->fetchAll(PDO::FETCH_ASSOC);
        $requestedClientId = trim((string)($input['client_id'] ?? ''));
        if ($candidates && $requestedClientId === '') {
            jsonResponse([
                'ok' => false,
                'code' => 'CLIENT_IDENTITY_SELECTION_REQUIRED',
                'error' => 'Choose the Client record this portal signup belongs to. Email alone is not enough to link identities.',
                'candidateClients' => $candidates,
            ], 409);
        }
        $matchedClient = null;
        if ($requestedClientId !== '') {
            foreach ($candidates as $candidate) {
                if ((string)$candidate['id'] === $requestedClientId) {
                    $matchedClient = $candidate;
                    break;
                }
            }
            if (!$matchedClient) {
                jsonResponse(['ok' => false, 'error' => 'The selected Client record does not match this signup email.'], 422);
            }
            $accessExists = $pdo->prepare('SELECT client_id FROM client_portal_access WHERE client_id = ?');
            $accessExists->execute([$requestedClientId]);
            if ($accessExists->fetchColumn()) {
                jsonResponse(['ok' => false, 'error' => 'This Client already has a portal access record.'], 409);
            }
        }
        $assignment = validateLeadAssignment($pdo, [
            'office_id' => $input['assigned_office_id'] ?? $input['office_id'] ?? null,
            'team_id' => $input['assigned_team_id'] ?? $input['team_id'] ?? null,
            'team_leader_id' => $input['assigned_team_leader_id'] ?? null,
            'agent_id' => $input['agent_id'] ?? $input['assigned_agent_id'] ?? null,
        ]);
        assertCanAssignLead($actor, $assignment, $pdo);
        $now = date('c');
        $name = trim((string)($data['name'] ?? $request['name']));
        $parts = preg_split('/\s+/', $name, 2) ?: [$name, ''];
        $firstName = (string)($parts[0] ?? '');
        $lastName = (string)($parts[1] ?? '');
        $clientId = $matchedClient ? $requestedClientId : 'client_' . bin2hex(random_bytes(10));
        $client = null;
        $pdo->beginTransaction();
        try {
            if ($matchedClient) {
                $clientQuery = $pdo->prepare('SELECT * FROM clients WHERE id = ? AND deleted_at IS NULL');
                $clientQuery->execute([$clientId]);
                $client = $clientQuery->fetch() ?: [];
                if (array_filter($assignment, static fn($value) => $value !== null)) {
                    $client = saveLeadAssignment($pdo, $clientId, $assignment, $actor);
                }
            } else {
                $pdo->prepare("INSERT INTO clients (id, first_name, last_name, name, email, phone, country, country_code, company, message, source, stage, status, assigned_office_id, assigned_team_id, assigned_team_leader_id, assigned_agent_id, assigned_by, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'signup_request', 'New', 'New', ?, ?, ?, ?, ?, ?, ?)")
                    ->execute([
                        $clientId, $firstName, $lastName, $name, $email,
                        trim((string)($data['phone'] ?? '')),
                        trim((string)($data['country'] ?? '')),
                        trim((string)($data['country_code'] ?? '')),
                        trim((string)($data['company'] ?? '')),
                        trim((string)($data['message'] ?? '')),
                        $assignment['office_id'], $assignment['team_id'], $assignment['team_leader_id'], $assignment['agent_id'],
                        $actor['id'], $now, $now,
                    ]);
                $clientQuery = $pdo->prepare('SELECT * FROM clients WHERE id = ?');
                $clientQuery->execute([$clientId]);
                $client = $clientQuery->fetch() ?: [];
            }
            $pdo->prepare("INSERT INTO client_portal_access (client_id, password_hash, status, portal_enabled, created_at)
                VALUES (?, '', 'Active', 0, ?)")
                ->execute([$clientId, $now]);
            $pdo->prepare("UPDATE signup_requests SET status = 'approved', verification_code_hash = ?, verification_expires_at = ?, verification_attempts = 0, client_id = ?, lead_id = ?, reviewed_at = ? WHERE id = ? AND status = 'pending'")
                ->execute([password_hash($code, PASSWORD_DEFAULT), date('c', time() + 3600), $clientId, $clientId, $now, $requestId]);
            $pdo->commit();
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $error;
        }
        jsonResponse(['ok' => true, 'client' => normalizeLeadRow($client), 'client_id' => $clientId]);
    }
    jsonResponse(['ok' => false, 'error' => 'Method not allowed.'], 405);
}

if ($apiPath === '/admin/password-reset-requests') {
    $actor = requireActiveAdminStaff($pdo, $adminSession);
    if ($actor['role'] !== 'Super Admin') jsonResponse(['ok' => false, 'error' => 'Only a Super Admin can manage password-reset requests.'], 403);
    if ($method !== 'GET') jsonResponse(['ok' => false, 'error' => 'Method not allowed.'], 405);
    $rows = $pdo->query("SELECT c.id, c.name AS user_name, c.email AS user_email, r.requested_at
        FROM password_reset_requests r
        JOIN clients c ON c.id = r.user_id
        JOIN client_portal_access a ON a.client_id = c.id
        WHERE r.status = 'pending' AND a.status = 'Active' AND a.portal_enabled = 1
        ORDER BY r.requested_at ASC")->fetchAll();
    foreach ($rows as &$row) $row['id'] = $row['id'];
    unset($row);
    jsonResponse(['ok' => true, 'items' => $rows]);
}

if (preg_match('#^/admin/password-reset-requests/([^/]+)/send-code$#', $apiPath, $m) && $method === 'POST') {
    $actor = requireActiveAdminStaff($pdo, $adminSession);
    if ($actor['role'] !== 'Super Admin') jsonResponse(['ok' => false, 'error' => 'Only a Super Admin can send password-reset codes.'], 403);
    $userId = rawurldecode($m[1]);
    $code = trim((string)($input['code'] ?? ''));
    if (!preg_match('/^\d{6}$/', $code)) jsonResponse(['ok' => false, 'error' => 'Enter a six-digit reset code.'], 422);
    $stmt = $pdo->prepare("SELECT user_id FROM password_reset_requests WHERE user_id = ? AND status = 'pending'");
    $stmt->execute([$userId]);
    if (!$stmt->fetchColumn()) jsonResponse(['ok' => false, 'error' => 'Pending password-reset request not found.'], 404);
    $now = date('c');
    $pdo->prepare("UPDATE password_reset_requests SET status = 'sent', code_hash = ?, expires_at = ?, sent_at = ?, attempt_count = 0 WHERE user_id = ?")
        ->execute([password_hash($code, PASSWORD_DEFAULT), date('c', time() + 3600), $now, $userId]);
    jsonResponse(['ok' => true, 'user_id' => $userId, 'expires_at' => date('c', time() + 3600)]);
}

if ($apiPath === '/admin/pending-counts' && $method === 'GET') {
    requireActiveAdminStaff($pdo, $adminSession);
    $signups = (int)$pdo->query("SELECT COUNT(*) FROM signup_requests WHERE status = 'pending'")->fetchColumn();
    $resets = (int)$pdo->query("SELECT COUNT(*) FROM password_reset_requests WHERE status = 'pending'")->fetchColumn();
    jsonResponse(['ok' => true, 'signups' => $signups, 'password_resets' => $resets]);
}

if (preg_match('#^/admin/client-workspaces/([^/]+)$#', $apiPath, $m)) {
    $actor = requireActiveAdminStaff($pdo, $adminSession);
    if ($actor['role'] !== 'Super Admin') jsonResponse(['ok' => false, 'error' => 'Only a Super Admin can manage client workspaces.'], 403);
    $userId = rawurldecode($m[1]);
    $clientStmt = $pdo->prepare('SELECT id FROM clients WHERE id = ?');
    $clientStmt->execute([$userId]);
    if (!$clientStmt->fetchColumn()) jsonResponse(['ok' => false, 'error' => 'Client account not found.'], 404);
    if ($method === 'GET') {
        $workspaceStmt = $pdo->prepare('SELECT workspace_json FROM client_workspaces WHERE user_id = ?');
        $workspaceStmt->execute([$userId]);
        $raw = $workspaceStmt->fetchColumn();
        $workspace = $raw === false ? null : json_decode((string)$raw, true);
        if ($raw !== false && !is_array($workspace)) jsonResponse(['ok' => false, 'error' => 'Stored client workspace data is invalid.'], 500);
        jsonResponse(['ok' => true, 'workspace' => $workspace]);
    }
    if ($method === 'PUT') {
        if (!is_array($input) || strlen(json_encode($input) ?: '') > 1048576) {
            jsonResponse(['ok' => false, 'error' => 'Workspace data must be a JSON object under 1 MB.'], 422);
        }
        $json = json_encode($input, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        if ($json === false) jsonResponse(['ok' => false, 'error' => 'Workspace data could not be encoded.'], 422);
        $exists = $pdo->prepare('SELECT user_id FROM client_workspaces WHERE user_id = ?');
        $exists->execute([$userId]);
        if ($exists->fetchColumn()) {
            $pdo->prepare('UPDATE client_workspaces SET workspace_json = ?, updated_at = ? WHERE user_id = ?')
                ->execute([$json, date('c'), $userId]);
        } else {
            $pdo->prepare('INSERT INTO client_workspaces (user_id, workspace_json, updated_at) VALUES (?, ?, ?)')
                ->execute([$userId, $json, date('c')]);
        }
        jsonResponse(['ok' => true, 'workspace' => $input]);
    }
    jsonResponse(['ok' => false, 'error' => 'Method not allowed.'], 405);
}
