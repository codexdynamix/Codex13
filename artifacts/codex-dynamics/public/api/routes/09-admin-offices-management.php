<?php
/** Route group: ADMIN: OFFICES MANAGEMENT (included by index.php in order; uses its request globals). */

declare(strict_types=1);

// -----------------------------------------------------------------------------
// 9. ADMIN: OFFICES MANAGEMENT
// -----------------------------------------------------------------------------
if ($apiPath === '/admin/offices') {
    $actor = requireActiveAdminStaff($pdo, $adminSession);
    $includeDeleted = (string)($_GET['include_deleted'] ?? '');
    if ($includeDeleted !== '' && $actor['role'] !== 'Super Admin') {
        jsonResponse(['ok' => false, 'error' => 'Only a Super Admin can view deleted offices.'], 403);
    }
    if ($method === 'POST') {
        requireSuperAdmin($pdo, $adminSession);
        $name = trim((string)($input['name'] ?? ''));
        if ($name === '') jsonResponse(['ok' => false, 'error' => 'Office name is required.'], 400);
        $id = 'of_' . bin2hex(random_bytes(8));
        $now = date('c');
        $managerId = null;
        $manager = null;
        $managerName = trim((string)($input['manager_name'] ?? 'Unassigned')) ?: 'Unassigned';
        $managerEmail = strtolower(trim((string)($input['manager_email'] ?? '')));
        $password = (string)($input['manager_password'] ?? '');
        if ($password !== '' && strlen($password) < 8) jsonResponse(['ok' => false, 'error' => 'Staff passwords must be at least 8 characters.'], 422);
        if ($password !== '') {
            $managerId = 'adm_' . bin2hex(random_bytes(8));
            $managerEmail = $managerEmail ?: 'manager_' . substr($managerId, 4) . '@codexdynamics.com';
            if (!filter_var($managerEmail, FILTER_VALIDATE_EMAIL)) jsonResponse(['ok' => false, 'error' => 'Enter a valid manager email address.'], 422);
            $check = $pdo->prepare('SELECT id FROM staff_users WHERE LOWER(email) = ?');
            $check->execute([$managerEmail]);
            if ($check->fetchColumn()) jsonResponse(['ok' => false, 'error' => 'That email address is already in use.'], 409);
            $caps = json_encode(['lead_upload' => true, 'create_agent' => true, 'registrations' => true, 'notifications' => true, 'content' => true, 'enquiries' => true, 'chat' => true]);
            $hash = password_hash($password, PASSWORD_DEFAULT);
            $pdo->prepare("INSERT INTO staff_users (id, email, password, name, role, office_id, status, capabilities, created_at) VALUES (?, ?, ?, ?, 'Office Manager', ?, 'Active', ?, ?)")
                ->execute([$managerId, $managerEmail, $hash, $managerName, $id, $caps, $now]);
            $manager = ['id' => $managerId, 'name' => $managerName, 'email' => $managerEmail, 'role' => 'Office Manager', 'office_id' => $id, 'team_id' => null, 'status' => 'Active', 'capabilities' => json_decode($caps, true), 'created_at' => $now];
        }
        $pdo->prepare('INSERT INTO offices (id, name, manager_id, manager_name, manager_email, created_at) VALUES (?, ?, ?, ?, ?, ?)')
            ->execute([$id, $name, $managerId, $managerName, $managerEmail, $now]);
        jsonResponse(['ok' => true, 'office' => ['id' => $id, 'name' => $name, 'manager_id' => $managerId, 'manager_name' => $managerName, 'manager_email' => $managerEmail, 'team_count' => 0, 'agent_count' => 0, 'lead_count' => 0, 'created_at' => $now], 'manager' => $manager], 201);
    }
    if ($method !== 'GET') jsonResponse(['ok' => false, 'error' => 'Method not allowed.'], 405);
    $deletedFilter = $includeDeleted === 'only' ? 'deleted_at IS NOT NULL' : ($includeDeleted === '1' ? '1=1' : 'deleted_at IS NULL');
    $params = [];
    if ($actor['role'] !== 'Super Admin') {
        $officeId = optionalId($actor['office_id'] ?? null);
        if ($officeId === null) jsonResponse(['ok' => true, 'offices' => []]);
        $deletedFilter .= ' AND id = ?';
        $params[] = $officeId;
    }
    $stmt = $pdo->prepare("SELECT * FROM offices WHERE {$deletedFilter} ORDER BY created_at DESC");
    $stmt->execute($params);
    $offices = $stmt->fetchAll();
    foreach ($offices as &$office) {
        $count = $pdo->prepare('SELECT COUNT(*) FROM teams WHERE office_id = ? AND deleted_at IS NULL');
        $count->execute([$office['id']]);
        $office['team_count'] = (int)$count->fetchColumn();
        $count = $pdo->prepare("SELECT COUNT(*) FROM staff_users WHERE office_id = ? AND role = 'Agent' AND deleted_at IS NULL");
        $count->execute([$office['id']]);
        $office['agent_count'] = (int)$count->fetchColumn();
        $count = $pdo->prepare('SELECT COUNT(*) FROM leads WHERE assigned_office_id = ? AND deleted_at IS NULL');
        $count->execute([$office['id']]);
        $office['lead_count'] = (int)$count->fetchColumn();
    }
    unset($office);
    jsonResponse(['ok' => true, 'offices' => $offices]);
}

if (preg_match('#^/admin/offices/([^/]+)/restore$#', $apiPath, $m) && $method === 'POST') {
    requireSuperAdmin($pdo, $adminSession);
    $officeId = rawurldecode($m[1]);
    $stmt = $pdo->prepare('SELECT * FROM offices WHERE id = ? AND deleted_at IS NOT NULL');
    $stmt->execute([$officeId]);
    $office = $stmt->fetch();
    if (!$office) jsonResponse(['ok' => false, 'error' => 'Deleted office not found.'], 404);
    $pdo->beginTransaction();
    try {
        $pdo->prepare('UPDATE offices SET deleted_at = NULL, deleted_scope_type = NULL, deleted_scope_id = NULL WHERE id = ?')->execute([$officeId]);
        $pdo->prepare("UPDATE teams SET deleted_at = NULL, deleted_scope_type = NULL, deleted_scope_id = NULL WHERE deleted_scope_type = 'office' AND deleted_scope_id = ?")->execute([$officeId]);
        $pdo->prepare("UPDATE staff_users SET deleted_at = NULL, deleted_scope_type = NULL, deleted_scope_id = NULL WHERE deleted_scope_type = 'office' AND deleted_scope_id = ?")->execute([$officeId]);
        $leads = restoreLeadAssignmentSnapshots($pdo, 'office', $officeId);
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
    $q = $pdo->prepare('SELECT * FROM teams WHERE office_id = ? AND deleted_at IS NULL');
    $q->execute([$officeId]);
    $teams = $q->fetchAll();
    $q = $pdo->prepare('SELECT * FROM offices WHERE id = ? AND deleted_at IS NULL');
    $q->execute([$officeId]);
    $office = $q->fetch();
    $q = $pdo->prepare("SELECT id, name, email, role, office_id, team_id, status, capabilities, last_login_at, created_at, deleted_at FROM staff_users WHERE office_id = ? AND deleted_at IS NULL");
    $q->execute([$officeId]);
    jsonResponse(['ok' => true, 'office' => $office, 'teams' => $teams, 'staff' => $q->fetchAll(), 'leads' => $leads]);
}

if (preg_match('#^/admin/offices/([^/]+)(?:/(manager))?$#', $apiPath, $m)) {
    $actor = requireActiveAdminStaff($pdo, $adminSession);
    $officeId = rawurldecode($m[1]);
    $isPermanentDelete = $method === 'DELETE' && (string)($_GET['permanent'] ?? '') === '1';
    if ($isPermanentDelete) {
        $q = $pdo->prepare('SELECT * FROM offices WHERE id = ? AND deleted_at IS NOT NULL');
        $q->execute([$officeId]);
        $office = $q->fetch() ?: null;
    } else {
        $office = activeOffice($pdo, $officeId);
    }
    if (!$office) jsonResponse(['ok' => false, 'error' => 'Office not found.'], 404);
    $sub = $m[2] ?? '';
    if ($sub === 'manager' && $method === 'POST') {
        requireSuperAdmin($pdo, $adminSession);
        $managerId = optionalId($input['manager_id'] ?? null);
        $manager = $managerId ? activeStaffRecord($pdo, $managerId) : null;
        if ($managerId && (!$manager || $manager['role'] !== 'Office Manager')) jsonResponse(['ok' => false, 'error' => 'Select an active Office Manager.'], 422);
        $pdo->beginTransaction();
        try {
            if (!empty($office['manager_id']) && $office['manager_id'] !== $managerId) {
                $pdo->prepare("UPDATE staff_users SET office_id = NULL WHERE id = ? AND role = 'Office Manager'")->execute([$office['manager_id']]);
            }
            if ($manager) {
                $pdo->prepare('UPDATE offices SET manager_id = NULL WHERE manager_id = ?')->execute([$managerId]);
                $pdo->prepare('UPDATE staff_users SET office_id = ? WHERE id = ?')->execute([$officeId, $managerId]);
            }
            $pdo->prepare('UPDATE offices SET manager_id = ?, manager_name = ?, manager_email = ? WHERE id = ?')
                ->execute([$managerId, $manager['name'] ?? 'Unassigned', $manager['email'] ?? '', $officeId]);
            $pdo->commit();
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $error;
        }
        $q = $pdo->prepare('SELECT * FROM offices WHERE id = ?');
        $q->execute([$officeId]);
        jsonResponse(['ok' => true, 'office' => $q->fetch(), 'manager' => $manager]);
    }
    if ($method === 'PATCH') {
        requireSuperAdmin($pdo, $adminSession);
        $name = trim((string)($input['name'] ?? ''));
        if ($name === '') jsonResponse(['ok' => false, 'error' => 'Office name is required.'], 422);
        $pdo->prepare('UPDATE offices SET name = ? WHERE id = ? AND deleted_at IS NULL')->execute([$name, $officeId]);
        $q = $pdo->prepare('SELECT * FROM offices WHERE id = ?');
        $q->execute([$officeId]);
        jsonResponse(['ok' => true, 'office' => $q->fetch()]);
    }
    if ($method === 'DELETE') {
        requireSuperAdmin($pdo, $adminSession);
        if ($isPermanentDelete) {
            $q = $pdo->prepare('SELECT id FROM teams WHERE office_id = ?');
            $q->execute([$officeId]);
            $teamIds = $q->fetchAll(PDO::FETCH_COLUMN);
            $sql = 'SELECT id FROM staff_users WHERE office_id = ?' . ($teamIds ? ' OR team_id IN (' . implode(',', array_fill(0, count($teamIds), '?')) . ')' : '');
            $q = $pdo->prepare($sql);
            $q->execute(array_merge([$officeId], $teamIds));
            $staffIds = $q->fetchAll(PDO::FETCH_COLUMN);
            $pdo->beginTransaction();
            try {
                $conditions = ['assigned_office_id = ?'];
                $params = [$officeId];
                if ($teamIds) {
                    $conditions[] = 'assigned_team_id IN (' . implode(',', array_fill(0, count($teamIds), '?')) . ')';
                    array_push($params, ...$teamIds);
                }
                if ($staffIds) {
                    $in = implode(',', array_fill(0, count($staffIds), '?'));
                    $conditions[] = "(assigned_agent_id IN ({$in}) OR assigned_team_leader_id IN ({$in}))";
                    array_push($params, ...$staffIds, ...$staffIds);
                }
                $pdo->prepare('UPDATE leads SET assigned_office_id = NULL, assigned_team_id = NULL, assigned_team_leader_id = NULL, assigned_agent_id = NULL, assigned_by = NULL WHERE ' . implode(' OR ', $conditions))->execute($params);
                if ($staffIds) {
                    $in = implode(',', array_fill(0, count($staffIds), '?'));
                    $pdo->prepare("DELETE FROM admin_sessions WHERE user_id IN ({$in})")->execute($staffIds);
                    $pdo->prepare("DELETE FROM staff_users WHERE id IN ({$in})")->execute($staffIds);
                }
                $pdo->prepare('DELETE FROM teams WHERE office_id = ?')->execute([$officeId]);
                $pdo->prepare("DELETE FROM crm_assignment_restore WHERE entity_type = 'office' AND entity_id = ?")->execute([$officeId]);
                $pdo->prepare('DELETE FROM offices WHERE id = ?')->execute([$officeId]);
                $pdo->commit();
            } catch (Throwable $error) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                throw $error;
            }
            jsonResponse(['ok' => true]);
        }
        $q = $pdo->prepare('SELECT id FROM teams WHERE office_id = ? AND deleted_at IS NULL');
        $q->execute([$officeId]);
        $teamIds = $q->fetchAll(PDO::FETCH_COLUMN);
        $q = $pdo->prepare('SELECT id FROM staff_users WHERE office_id = ? AND deleted_at IS NULL');
        $q->execute([$officeId]);
        $staffIds = $q->fetchAll(PDO::FETCH_COLUMN);
        $conditions = ['assigned_office_id = ?'];
        $params = [$officeId];
        if ($teamIds) {
            $conditions[] = 'assigned_team_id IN (' . implode(',', array_fill(0, count($teamIds), '?')) . ')';
            array_push($params, ...$teamIds);
        }
        if ($staffIds) {
            $in = implode(',', array_fill(0, count($staffIds), '?'));
            $conditions[] = "(assigned_agent_id IN ({$in}) OR assigned_team_leader_id IN ({$in}))";
            array_push($params, ...$staffIds, ...$staffIds);
        }
        $now = date('c');
        $pdo->beginTransaction();
        try {
            $leadIds = snapshotAndClearLeadAssignments($pdo, 'office', $officeId, implode(' OR ', $conditions), $params, $actor['id']);
            $pdo->prepare('UPDATE offices SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL')->execute([$now, $officeId]);
            $pdo->prepare("UPDATE teams SET deleted_at = ?, deleted_scope_type = 'office', deleted_scope_id = ? WHERE office_id = ? AND deleted_at IS NULL")->execute([$now, $officeId, $officeId]);
            $pdo->prepare("UPDATE staff_users SET deleted_at = ?, deleted_scope_type = 'office', deleted_scope_id = ? WHERE office_id = ? AND deleted_at IS NULL")->execute([$now, $officeId, $officeId]);
            $pdo->commit();
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $error;
        }
        jsonResponse(['ok' => true, 'deleted_at' => $now, 'team_ids' => $teamIds, 'staff_ids' => $staffIds, 'lead_ids' => $leadIds]);
    }
    jsonResponse(['ok' => false, 'error' => 'Method not allowed.'], 405);
}
