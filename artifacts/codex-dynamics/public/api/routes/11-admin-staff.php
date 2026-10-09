<?php
/** Route group: ADMIN: STAFF (AGENTS, TEAM LEADERS, MANAGERS) (included by index.php in order; uses its request globals). */

declare(strict_types=1);

// -----------------------------------------------------------------------------
// 11. ADMIN: STAFF (AGENTS, TEAM LEADERS, MANAGERS)
// -----------------------------------------------------------------------------
if ($apiPath === '/admin/staff') {
    $actor = requireActiveAdminStaff($pdo, $adminSession);
    $includeDeleted = (string)($_GET['include_deleted'] ?? '');
    if ($includeDeleted !== '' && $actor['role'] !== 'Super Admin') {
        jsonResponse(['ok' => false, 'error' => 'Only a Super Admin can view deleted staff.'], 403);
    }
    if ($method === 'POST') {
        $role = trim((string)($input['role'] ?? 'Agent'));
        if (!in_array($role, ['Office Manager', 'Team Leader', 'Agent', 'Super Admin'], true)) {
            jsonResponse(['ok' => false, 'error' => 'This role cannot be created through staff management.'], 422);
        }
        $name = trim((string)($input['name'] ?? ''));
        $password = (string)($input['password'] ?? '');
        if ($name === '' || strlen($password) < 8) jsonResponse(['ok' => false, 'error' => 'A name and a password of at least 8 characters are required.'], 422);
        $officeId = optionalId($input['office_id'] ?? null);
        $teamId = optionalId($input['team_id'] ?? null);
        if ($role === 'Super Admin' && $actor['role'] !== 'Super Admin') {
            jsonResponse(['ok' => false, 'error' => 'Only a Super Admin can create another Super Admin.'], 403);
        } elseif ($role === 'Super Admin') {
            if ($officeId !== null || $teamId !== null) jsonResponse(['ok' => false, 'error' => 'A Super Admin cannot be assigned to an office or team.'], 422);
            $officeId = null;
            $teamId = null;
        } elseif ($actor['role'] === 'Office Manager') {
            if (!in_array($role, ['Team Leader', 'Agent'], true)) jsonResponse(['ok' => false, 'error' => 'Office Managers can only create Team Leaders and Agents.'], 403);
            $officeId = optionalId($actor['office_id'] ?? null);
            if ($officeId === null) jsonResponse(['ok' => false, 'error' => 'Your account is not assigned to an office.'], 403);
            if ($role === 'Team Leader' && $teamId === null) jsonResponse(['ok' => false, 'error' => 'Office Managers must assign a Team Leader to a team.'], 422);
        } elseif ($actor['role'] === 'Team Leader') {
            if ($role !== 'Agent' || empty($actor['team_id']) || $teamId !== $actor['team_id'] || (($actor['capabilities']['create_agent'] ?? true) === false)) {
                jsonResponse(['ok' => false, 'error' => 'You can only create agents in your team.'], 403);
            }
            $officeId = optionalId($actor['office_id'] ?? null);
        } elseif ($actor['role'] !== 'Super Admin') {
            jsonResponse(['ok' => false, 'error' => 'Your role cannot create staff.'], 403);
        }

        $team = $teamId ? activeTeam($pdo, $teamId) : null;
        if ($teamId && !$team) jsonResponse(['ok' => false, 'error' => 'The selected team is unavailable.'], 422);
        if ($team && !empty($team['office_id'])) {
            if ($officeId !== null && $officeId !== $team['office_id']) jsonResponse(['ok' => false, 'error' => 'The selected team belongs to a different office.'], 422);
            $officeId = (string)$team['office_id'];
        }
        if ($officeId !== null && !activeOffice($pdo, $officeId)) jsonResponse(['ok' => false, 'error' => 'The selected office is unavailable.'], 422);
        if ($role === 'Office Manager' && ($officeId === null || $teamId !== null)) jsonResponse(['ok' => false, 'error' => 'An Office Manager must be assigned to one active office and no team.'], 422);
        if ($role === 'Team Leader' && $teamId !== null) {
            $q = $pdo->prepare("SELECT id FROM staff_users WHERE team_id = ? AND role = 'Team Leader' AND deleted_at IS NULL");
            $q->execute([$teamId]);
            if ($q->fetchColumn()) jsonResponse(['ok' => false, 'error' => 'This team already has a Team Leader.'], 409);
        }
        if ($role === 'Agent' && $team && $team['max_size'] !== null) {
            $q = $pdo->prepare("SELECT COUNT(*) FROM staff_users WHERE team_id = ? AND role = 'Agent' AND deleted_at IS NULL");
            $q->execute([$teamId]);
            if ((int)$q->fetchColumn() >= (int)$team['max_size']) jsonResponse(['ok' => false, 'error' => 'This team is at capacity.'], 409);
        }
        $email = strtolower(trim((string)($input['email'] ?? '')));
        if ($role === 'Super Admin' && $email === '') {
            jsonResponse(['ok' => false, 'error' => 'A valid email address is required for a Super Admin account.'], 422);
        }
        $id = 'adm_' . bin2hex(random_bytes(8));
        $email = $email ?: strtolower($role === 'Agent' ? 'agent_' : ($role === 'Team Leader' ? 'leader_' : 'manager_')) . substr($id, 4) . '@codexdynamics.com';
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) jsonResponse(['ok' => false, 'error' => 'Enter a valid email address.'], 422);
        $q = $pdo->prepare('SELECT id FROM staff_users WHERE LOWER(email) = ?');
        $q->execute([$email]);
        if ($q->fetchColumn()) jsonResponse(['ok' => false, 'error' => 'That email address is already in use.'], 409);
        if ($role === 'Office Manager') {
            $q = $pdo->prepare('SELECT id FROM offices WHERE id = ? AND manager_id IS NOT NULL AND deleted_at IS NULL');
            $q->execute([$officeId]);
            if ($q->fetchColumn()) jsonResponse(['ok' => false, 'error' => 'This office already has an Office Manager.'], 409);
        }
        $now = date('c');
        $caps = json_encode(['lead_upload' => true, 'create_agent' => true, 'registrations' => true, 'notifications' => true, 'content' => true, 'enquiries' => true, 'chat' => true]);
        $hash = password_hash($password, PASSWORD_DEFAULT);
        if ($hash === false) jsonResponse(['ok' => false, 'error' => 'Could not securely save the staff password.'], 500);
        $pdo->beginTransaction();
        try {
            $pdo->prepare("INSERT INTO staff_users (id, email, password, name, role, office_id, team_id, status, capabilities, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?)")
                ->execute([$id, $email, $hash, $name, $role, $officeId, $teamId, $caps, $now]);
            if ($role === 'Team Leader' && $teamId !== null) {
                $pdo->prepare('UPDATE teams SET leader_id = ?, leader_name = ? WHERE id = ?')->execute([$id, $name, $teamId]);
            }
            if ($role === 'Office Manager') {
                $pdo->prepare('UPDATE offices SET manager_id = ?, manager_name = ?, manager_email = ? WHERE id = ?')->execute([$id, $name, $email, $officeId]);
            }
            $pdo->commit();
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $error;
        }
        jsonResponse(['ok' => true, 'staff' => publicStaffRecord($pdo, $id)], 201);
    }
    if ($method !== 'GET') jsonResponse(['ok' => false, 'error' => 'Method not allowed.'], 405);
    $filter = $includeDeleted === 'only'
        ? "s.deleted_at IS NOT NULL AND s.deleted_scope_type = 'staff'"
        : ($includeDeleted === '1' ? '1=1' : 's.deleted_at IS NULL');
    $params = [];
    if ($actor['role'] === 'Office Manager') {
        $officeId = optionalId($actor['office_id'] ?? null);
        if ($officeId === null) jsonResponse(['ok' => true, 'staff' => []]);
        $filter .= ' AND s.office_id = ?';
        $params[] = $officeId;
    } elseif ($actor['role'] === 'Team Leader') {
        if (empty($actor['team_id'])) $filter .= ' AND s.id = ?';
        else $filter .= ' AND (s.id = ? OR s.team_id = ?)';
        $params[] = $actor['id'];
        if (!empty($actor['team_id'])) $params[] = $actor['team_id'];
    } elseif ($actor['role'] === 'Agent') {
        $filter .= ' AND s.id = ?';
        $params[] = $actor['id'];
    }
    $onlineSql = staffOnlineSql($pdo);
    $sql = "
        SELECT s.id, s.email, s.name, s.role, s.office_id, s.team_id, s.status, s.capabilities,
               s.last_login_at, s.created_at, s.deleted_at, s.deleted_scope_type, s.deleted_scope_id,
               o.name AS office_name, t.name AS team_name,
                {$onlineSql} AS is_online,
               (SELECT COUNT(*) FROM leads l WHERE l.deleted_at IS NULL AND (l.assigned_agent_id = s.id OR l.assigned_team_leader_id = s.id)) AS lead_count
        FROM staff_users s
        LEFT JOIN offices o ON o.id = s.office_id
        LEFT JOIN teams t ON t.id = s.team_id
        WHERE {$filter} ORDER BY s.name ASC
    ";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $staff = $stmt->fetchAll();
    foreach ($staff as &$member) $member['capabilities'] = json_decode((string)($member['capabilities'] ?? '{}'), true) ?: [];
    unset($member);
    jsonResponse(['ok' => true, 'staff' => $staff]);
}

if (preg_match('#^/admin/staff/([^/]+)/restore$#', $apiPath, $m) && $method === 'POST') {
    requireSuperAdmin($pdo, $adminSession);
    $staffId = rawurldecode($m[1]);
    $q = $pdo->prepare("SELECT id FROM staff_users WHERE id = ? AND deleted_at IS NOT NULL AND deleted_scope_type = 'staff'");
    $q->execute([$staffId]);
    if (!$q->fetchColumn()) jsonResponse(['ok' => false, 'error' => 'Deleted staff member not found.'], 404);
    $pdo->beginTransaction();
    try {
        $pdo->prepare('UPDATE staff_users SET deleted_at = NULL, deleted_scope_type = NULL, deleted_scope_id = NULL WHERE id = ?')->execute([$staffId]);
        $leads = restoreLeadAssignmentSnapshots($pdo, 'staff', $staffId);
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
    jsonResponse(['ok' => true, 'staff' => publicStaffRecord($pdo, $staffId), 'leads' => $leads]);
}

if (preg_match('#^/admin/staff/([^/]+)/capabilities$#', $apiPath, $capabilityMatch)) {
    $actor = requireActiveAdminStaff($pdo, $adminSession);
    $staffId = rawurldecode($capabilityMatch[1]);
    $targetStmt = $pdo->prepare('SELECT id, role, capabilities FROM staff_users WHERE id = ? AND deleted_at IS NULL');
    $targetStmt->execute([$staffId]);
    $target = $targetStmt->fetch();
    if (!$target) jsonResponse(['ok' => false, 'error' => 'Staff member not found.'], 404);

    if ($method === 'GET') {
        if ($actor['role'] !== 'Super Admin' && $actor['id'] !== $staffId) {
            jsonResponse(['ok' => false, 'error' => 'You cannot view these staff permissions.'], 403);
        }
        jsonResponse([
            'ok' => true,
            'capabilities' => json_decode((string)($target['capabilities'] ?? '{}'), true) ?: [],
        ]);
    }

    if ($method !== 'PUT') jsonResponse(['ok' => false, 'error' => 'Method not allowed.'], 405);
    if ($actor['role'] !== 'Super Admin') {
        jsonResponse(['ok' => false, 'error' => 'Only a Super Admin can change staff permissions.'], 403);
    }
    $allowedCapabilities = ['lead_upload', 'create_agent', 'registrations', 'notifications', 'security', 'content', 'enquiries', 'chat'];
    $requested = $input['capabilities'] ?? null;
    if (!is_array($requested)) jsonResponse(['ok' => false, 'error' => 'A capabilities object is required.'], 422);
    if (array_diff(array_keys($requested), $allowedCapabilities)) {
        jsonResponse(['ok' => false, 'error' => 'One or more capability names are not supported.'], 422);
    }
    foreach ($requested as $value) {
        if (!is_bool($value)) jsonResponse(['ok' => false, 'error' => 'Capability values must be true or false.'], 422);
    }
    $capabilities = array_fill_keys($allowedCapabilities, true);
    $existing = json_decode((string)($target['capabilities'] ?? '{}'), true);
    if (is_array($existing)) {
        foreach ($allowedCapabilities as $key) {
            if (array_key_exists($key, $existing)) $capabilities[$key] = (bool)$existing[$key];
        }
    }
    foreach ($requested as $key => $enabled) $capabilities[$key] = $enabled;
    $pdo->prepare('UPDATE staff_users SET capabilities = ? WHERE id = ?')
        ->execute([json_encode($capabilities, JSON_THROW_ON_ERROR), $staffId]);
    $pdo->prepare('INSERT INTO audit_logs (id, user_id, action, details, created_at) VALUES (?, ?, ?, ?, ?)')
        ->execute([
            'aud_' . bin2hex(random_bytes(8)),
            $staffId,
            'STAFF_CAPABILITIES_UPDATED',
            'Updated CRM tool permissions by ' . $actor['id'] . '.',
            date('c'),
        ]);
    jsonResponse(['ok' => true, 'capabilities' => $capabilities]);
}

if (preg_match('#^/admin/staff/([^/]+)(?:/(block|unblock))?$#', $apiPath, $m)) {
    $actor = requireActiveAdminStaff($pdo, $adminSession);
    $staffId = rawurldecode($m[1]);
    $action = $m[2] ?? '';
    $permanent = $method === 'DELETE' && (string)($_GET['permanent'] ?? '') === '1';
    $q = $pdo->prepare($permanent
        ? "SELECT * FROM staff_users WHERE id = ? AND deleted_at IS NOT NULL AND deleted_scope_type = 'staff'"
        : 'SELECT * FROM staff_users WHERE id = ? AND deleted_at IS NULL');
    $q->execute([$staffId]);
    $target = $q->fetch();
    if (!$target) jsonResponse(['ok' => false, 'error' => 'Staff member not found.'], 404);

    if ($target['role'] === 'Super Admin'
        && (($method === 'DELETE') || ($action === 'block' && $method === 'POST'))) {
        if ($actor['id'] === $staffId && $method === 'DELETE') {
            jsonResponse(['ok' => false, 'error' => 'You cannot delete your own Super Admin account.'], 409);
        }
        if ($action === 'block' && $actor['id'] === $staffId) {
            jsonResponse(['ok' => false, 'error' => 'You cannot suspend your own Super Admin account.'], 409);
        }
        $activeSuperAdmins = (int)$pdo->query("SELECT COUNT(*) FROM staff_users WHERE role = 'Super Admin' AND status = 'Active' AND deleted_at IS NULL")->fetchColumn();
        if ($target['status'] === 'Active' && $activeSuperAdmins <= 1) {
            jsonResponse(['ok' => false, 'error' => 'At least one active Super Admin account must remain.'], 409);
        }
    }

    if (($action === 'block' || $action === 'unblock') && $method === 'POST') {
        if (!canManageStaffStatus($actor, $target)) jsonResponse(['ok' => false, 'error' => 'You cannot change this staff member’s access.'], 403);
        $status = $action === 'block' ? 'Suspended' : 'Active';
        $pdo->prepare('UPDATE staff_users SET status = ? WHERE id = ?')->execute([$status, $staffId]);
        if ($action === 'block') $pdo->prepare('DELETE FROM admin_sessions WHERE user_id = ?')->execute([$staffId]);
        jsonResponse(['ok' => true, 'staff' => publicStaffRecord($pdo, $staffId)]);
    }
    if ($method === 'PATCH') {
        if (!canManageStaffRecord($actor, $target)) jsonResponse(['ok' => false, 'error' => 'You cannot edit this staff member.'], 403);
        $isSelf = $actor['id'] === $staffId;
        if (!$isSelf && $actor['role'] !== 'Super Admin' && (array_key_exists('office_id', $input) || array_key_exists('team_id', $input))) {
            jsonResponse(['ok' => false, 'error' => 'Only a Super Admin can move staff between offices or teams.'], 403);
        }
        $name = array_key_exists('name', $input) ? trim((string)$input['name']) : $target['name'];
        if ($name === '') jsonResponse(['ok' => false, 'error' => 'Staff name is required.'], 422);
        $email = array_key_exists('email', $input) ? strtolower(trim((string)$input['email'])) : $target['email'];
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) jsonResponse(['ok' => false, 'error' => 'Enter a valid email address.'], 422);
        $q = $pdo->prepare('SELECT id FROM staff_users WHERE LOWER(email) = ? AND id <> ?');
        $q->execute([$email, $staffId]);
        if ($q->fetchColumn()) jsonResponse(['ok' => false, 'error' => 'That email address is already in use.'], 409);
        $passwordHash = null;
        if (isset($input['password']) && (string)$input['password'] !== '') {
            if (strlen((string)$input['password']) < 8) jsonResponse(['ok' => false, 'error' => 'Staff passwords must be at least 8 characters.'], 422);
            $passwordHash = password_hash((string)$input['password'], PASSWORD_DEFAULT);
        }
        $officeId = optionalId($input['office_id'] ?? $target['office_id']);
        $teamId = optionalId($input['team_id'] ?? $target['team_id']);
        if ($actor['role'] !== 'Super Admin' || $isSelf) {
            $officeId = optionalId($target['office_id']);
            $teamId = optionalId($target['team_id']);
        }
        $team = $teamId ? activeTeam($pdo, $teamId) : null;
        if ($teamId && !$team) jsonResponse(['ok' => false, 'error' => 'The selected team is unavailable.'], 422);
        if ($team && !empty($team['office_id'])) {
            if ($officeId !== null && $officeId !== $team['office_id']) jsonResponse(['ok' => false, 'error' => 'The selected team belongs to a different office.'], 422);
            $officeId = (string)$team['office_id'];
        }
        if ($officeId !== null && !activeOffice($pdo, $officeId)) jsonResponse(['ok' => false, 'error' => 'The selected office is unavailable.'], 422);
        if ($target['role'] === 'Office Manager' && $teamId !== null) jsonResponse(['ok' => false, 'error' => 'An Office Manager cannot be assigned to a team.'], 422);
        if ($target['role'] === 'Agent' && $team && $team['max_size'] !== null && $teamId !== $target['team_id']) {
            $q = $pdo->prepare("SELECT COUNT(*) FROM staff_users WHERE team_id = ? AND role = 'Agent' AND deleted_at IS NULL AND id <> ?");
            $q->execute([$teamId, $staffId]);
            if ((int)$q->fetchColumn() >= (int)$team['max_size']) jsonResponse(['ok' => false, 'error' => 'This team is at capacity.'], 409);
        }
        if ($target['role'] === 'Team Leader' && $teamId !== null) {
            $q = $pdo->prepare("SELECT id FROM staff_users WHERE team_id = ? AND role = 'Team Leader' AND deleted_at IS NULL AND id <> ?");
            $q->execute([$teamId, $staffId]);
            if ($q->fetchColumn()) jsonResponse(['ok' => false, 'error' => 'This team already has a Team Leader.'], 409);
        }
        $now = date('c');
        $pdo->beginTransaction();
        try {
            $sql = 'UPDATE staff_users SET name = ?, email = ?, office_id = ?, team_id = ?';
            $params = [$name, $email, $officeId, $teamId];
            if ($passwordHash !== null) {
                $sql .= ', password = ?';
                $params[] = $passwordHash;
            }
            $sql .= ' WHERE id = ?';
            $params[] = $staffId;
            $pdo->prepare($sql)->execute($params);
            if ($target['role'] === 'Team Leader') {
                $pdo->prepare('UPDATE teams SET leader_id = NULL, leader_name = NULL WHERE leader_id = ?')->execute([$staffId]);
                if ($teamId !== null) $pdo->prepare('UPDATE teams SET leader_id = ?, leader_name = ? WHERE id = ?')->execute([$staffId, $name, $teamId]);
                $pdo->prepare('UPDATE leads SET assigned_office_id = ?, assigned_team_id = ?, updated_at = ? WHERE assigned_team_leader_id = ? AND assigned_agent_id IS NULL AND deleted_at IS NULL')
                    ->execute([$officeId, $teamId, $now, $staffId]);
            } elseif ($target['role'] === 'Agent') {
                $pdo->prepare('UPDATE leads SET assigned_office_id = ?, assigned_team_id = ?, updated_at = ? WHERE assigned_agent_id = ? AND deleted_at IS NULL')
                    ->execute([$officeId, $teamId, $now, $staffId]);
            } elseif ($target['role'] === 'Office Manager') {
                $pdo->prepare('UPDATE offices SET manager_id = NULL WHERE manager_id = ?')->execute([$staffId]);
                if ($officeId !== null) $pdo->prepare('UPDATE offices SET manager_id = ?, manager_name = ?, manager_email = ? WHERE id = ?')->execute([$staffId, $name, $email, $officeId]);
            }
            if ($target['role'] === 'Team Leader') $pdo->prepare('UPDATE teams SET leader_name = ? WHERE leader_id = ?')->execute([$name, $staffId]);
            $pdo->commit();
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $error;
        }
        jsonResponse(['ok' => true, 'staff' => publicStaffRecord($pdo, $staffId)]);
    }
    if ($method === 'DELETE') {
        requireSuperAdmin($pdo, $adminSession);
        if ($permanent) {
            $pdo->beginTransaction();
            try {
                $pdo->prepare('UPDATE leads SET assigned_office_id = NULL, assigned_team_id = NULL, assigned_team_leader_id = NULL, assigned_agent_id = NULL, assigned_by = NULL WHERE assigned_agent_id = ? OR assigned_team_leader_id = ?')->execute([$staffId, $staffId]);
                $pdo->prepare('UPDATE teams SET leader_id = NULL, leader_name = NULL WHERE leader_id = ?')->execute([$staffId]);
                $pdo->prepare('UPDATE offices SET manager_id = NULL, manager_name = ?, manager_email = ? WHERE manager_id = ?')->execute(['Unassigned', '', $staffId]);
                $pdo->prepare('DELETE FROM admin_sessions WHERE user_id = ?')->execute([$staffId]);
                $pdo->prepare("DELETE FROM crm_assignment_restore WHERE entity_type = 'staff' AND entity_id = ?")->execute([$staffId]);
                $pdo->prepare('DELETE FROM staff_users WHERE id = ?')->execute([$staffId]);
                $pdo->commit();
            } catch (Throwable $error) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                throw $error;
            }
            jsonResponse(['ok' => true]);
        }
        $now = date('c');
        $pdo->beginTransaction();
        try {
            $leadIds = snapshotAndClearLeadAssignments($pdo, 'staff', $staffId, '(assigned_agent_id = ? OR assigned_team_leader_id = ?)', [$staffId, $staffId], $actor['id']);
            $pdo->prepare("UPDATE staff_users SET deleted_at = ?, deleted_scope_type = 'staff', deleted_scope_id = ? WHERE id = ?")->execute([$now, $staffId, $staffId]);
            $pdo->prepare('DELETE FROM admin_sessions WHERE user_id = ?')->execute([$staffId]);
            $pdo->commit();
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $error;
        }
        jsonResponse(['ok' => true, 'deleted_at' => $now, 'lead_ids' => $leadIds]);
    }
    jsonResponse(['ok' => false, 'error' => 'Method not allowed.'], 405);
}
