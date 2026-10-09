<?php
/** Route group: ADMIN: TEAMS MANAGEMENT (included by index.php in order; uses its request globals). */

declare(strict_types=1);

// -----------------------------------------------------------------------------
// 10. ADMIN: TEAMS MANAGEMENT
// -----------------------------------------------------------------------------
if ($apiPath === '/admin/teams') {
    $actor = requireActiveAdminStaff($pdo, $adminSession);
    $includeDeleted = (string)($_GET['include_deleted'] ?? '');
    if ($includeDeleted !== '' && $actor['role'] !== 'Super Admin') {
        jsonResponse(['ok' => false, 'error' => 'Only a Super Admin can view deleted teams.'], 403);
    }
    if ($method === 'POST') {
        if (!in_array($actor['role'], ['Super Admin', 'Office Manager'], true)) jsonResponse(['ok' => false, 'error' => 'Your role cannot create teams.'], 403);
        $name = trim((string)($input['name'] ?? ''));
        if ($name === '') jsonResponse(['ok' => false, 'error' => 'Team name is required.'], 400);
        $officeId = optionalId($input['office_id'] ?? null);
        if ($actor['role'] === 'Office Manager') {
            $officeId = optionalId($actor['office_id'] ?? null);
            if ($officeId === null) jsonResponse(['ok' => false, 'error' => 'Your account is not assigned to an office.'], 403);
        }
        if ($officeId !== null && !activeOffice($pdo, $officeId)) jsonResponse(['ok' => false, 'error' => 'The selected office is unavailable.'], 422);
        $maxSize = array_key_exists('max_size', $input) ? ($input['max_size'] === null || $input['max_size'] === '' ? null : (int)$input['max_size']) : 10;
        if ($maxSize !== null && $maxSize < 1) jsonResponse(['ok' => false, 'error' => 'Team capacity must be at least 1 or left unlimited.'], 422);
        $teamId = 'tm_' . bin2hex(random_bytes(8));
        $now = date('c');
        $leader = null;
        $leaderId = null;
        $leaderName = trim((string)($input['leader_name'] ?? 'Unassigned')) ?: 'Unassigned';
        $leaderEmail = strtolower(trim((string)($input['leader_email'] ?? '')));
        $leaderPassword = (string)($input['leader_password'] ?? '');
        if ($leaderPassword !== '' && strlen($leaderPassword) < 8) jsonResponse(['ok' => false, 'error' => 'Staff passwords must be at least 8 characters.'], 422);
        if ($leaderPassword !== '') {
            if ($leaderName === 'Unassigned') jsonResponse(['ok' => false, 'error' => 'A team leader name is required when setting a password.'], 422);
            $leaderId = 'adm_' . bin2hex(random_bytes(8));
            $leaderEmail = $leaderEmail ?: 'leader_' . substr($leaderId, 4) . '@codexdynamics.com';
            if (!filter_var($leaderEmail, FILTER_VALIDATE_EMAIL)) jsonResponse(['ok' => false, 'error' => 'Enter a valid team leader email address.'], 422);
            $q = $pdo->prepare('SELECT id FROM staff_users WHERE LOWER(email) = ?');
            $q->execute([$leaderEmail]);
            if ($q->fetchColumn()) jsonResponse(['ok' => false, 'error' => 'That email address is already in use.'], 409);
            $caps = json_encode(['lead_upload' => true, 'create_agent' => true, 'registrations' => true, 'notifications' => true, 'content' => true, 'enquiries' => true, 'chat' => true]);
            $hash = password_hash($leaderPassword, PASSWORD_DEFAULT);
            $pdo->prepare("INSERT INTO staff_users (id, email, password, name, role, office_id, team_id, status, capabilities, created_at) VALUES (?, ?, ?, ?, 'Team Leader', ?, ?, 'Active', ?, ?)")
                ->execute([$leaderId, $leaderEmail, $hash, $leaderName, $officeId, $teamId, $caps, $now]);
            $leader = ['id' => $leaderId, 'name' => $leaderName, 'email' => $leaderEmail, 'role' => 'Team Leader', 'office_id' => $officeId, 'team_id' => $teamId, 'status' => 'Active', 'capabilities' => json_decode($caps, true), 'created_at' => $now];
        }
        $pdo->prepare('INSERT INTO teams (id, name, office_id, leader_id, leader_name, max_size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
            ->execute([$teamId, $name, $officeId, $leaderId, $leader ? $leaderName : null, $maxSize, $now]);
        jsonResponse(['ok' => true, 'team' => ['id' => $teamId, 'name' => $name, 'office_id' => $officeId, 'leader_id' => $leaderId, 'leader_name' => $leader ? $leaderName : null, 'max_size' => $maxSize, 'agent_count' => 0, 'lead_count' => 0, 'created_at' => $now], 'leader' => $leader], 201);
    }
    if ($method !== 'GET') jsonResponse(['ok' => false, 'error' => 'Method not allowed.'], 405);
    $filter = $includeDeleted === 'only'
        ? "deleted_at IS NOT NULL AND deleted_scope_type = 'team'"
        : ($includeDeleted === '1' ? '1=1' : 'deleted_at IS NULL');
    $params = [];
    if ($actor['role'] === 'Office Manager') {
        $officeId = optionalId($actor['office_id'] ?? null);
        if ($officeId === null) jsonResponse(['ok' => true, 'teams' => []]);
        $filter .= ' AND office_id = ?';
        $params[] = $officeId;
    } elseif ($actor['role'] === 'Team Leader' || $actor['role'] === 'Agent') {
        $teamId = optionalId($actor['team_id'] ?? null);
        if ($teamId === null) jsonResponse(['ok' => true, 'teams' => []]);
        $filter .= ' AND id = ?';
        $params[] = $teamId;
    }
    if ($actor['role'] === 'Super Admin' && !empty($_GET['office_id'])) {
        $filter .= ' AND office_id = ?';
        $params[] = (string)$_GET['office_id'];
    }
    $stmt = $pdo->prepare("SELECT * FROM teams WHERE {$filter} ORDER BY created_at DESC");
    $stmt->execute($params);
    $teams = $stmt->fetchAll();
    foreach ($teams as &$team) {
        $q = $pdo->prepare("SELECT COUNT(*) FROM staff_users WHERE team_id = ? AND role = 'Agent' AND deleted_at IS NULL");
        $q->execute([$team['id']]);
        $team['agent_count'] = (int)$q->fetchColumn();
        $q = $pdo->prepare('SELECT COUNT(*) FROM leads WHERE assigned_team_id = ? AND deleted_at IS NULL');
        $q->execute([$team['id']]);
        $team['lead_count'] = (int)$q->fetchColumn();
    }
    unset($team);
    jsonResponse(['ok' => true, 'teams' => $teams]);
}

if (preg_match('#^/admin/teams/([^/]+)/restore$#', $apiPath, $m) && $method === 'POST') {
    requireSuperAdmin($pdo, $adminSession);
    $teamId = rawurldecode($m[1]);
    $q = $pdo->prepare("SELECT * FROM teams WHERE id = ? AND deleted_at IS NOT NULL AND deleted_scope_type = 'team'");
    $q->execute([$teamId]);
    $team = $q->fetch();
    if (!$team) jsonResponse(['ok' => false, 'error' => 'Deleted team not found. Restore its office first if the office was deleted.'], 404);
    if (!empty($team['office_id']) && !activeOffice($pdo, (string)$team['office_id'])) jsonResponse(['ok' => false, 'error' => 'Restore the parent office before restoring this team.'], 409);
    $pdo->beginTransaction();
    try {
        $pdo->prepare('UPDATE teams SET deleted_at = NULL, deleted_scope_type = NULL, deleted_scope_id = NULL WHERE id = ?')->execute([$teamId]);
        $pdo->prepare("UPDATE staff_users SET deleted_at = NULL, deleted_scope_type = NULL, deleted_scope_id = NULL WHERE deleted_scope_type = 'team' AND deleted_scope_id = ?")->execute([$teamId]);
        $leads = restoreLeadAssignmentSnapshots($pdo, 'team', $teamId);
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
    $q = $pdo->prepare("SELECT id, name, email, role, office_id, team_id, status, capabilities, last_login_at, created_at FROM staff_users WHERE team_id = ? AND deleted_at IS NULL");
    $q->execute([$teamId]);
    jsonResponse(['ok' => true, 'team' => $team, 'staff' => $q->fetchAll(), 'leads' => $leads]);
}

if (preg_match('#^/admin/teams/([^/]+)$#', $apiPath, $m)) {
    $actor = requireActiveAdminStaff($pdo, $adminSession);
    $teamId = rawurldecode($m[1]);
    $isPermanent = $method === 'DELETE' && (string)($_GET['permanent'] ?? '') === '1';
    $q = $pdo->prepare($isPermanent
        ? "SELECT * FROM teams WHERE id = ? AND deleted_at IS NOT NULL AND deleted_scope_type = 'team'"
        : 'SELECT * FROM teams WHERE id = ? AND deleted_at IS NULL');
    $q->execute([$teamId]);
    $team = $q->fetch();
    if (!$team) jsonResponse(['ok' => false, 'error' => 'Team not found.'], 404);
    if ($method === 'PATCH') {
        if (!in_array($actor['role'], ['Super Admin', 'Office Manager'], true)) jsonResponse(['ok' => false, 'error' => 'Your role cannot edit teams.'], 403);
        if ($actor['role'] === 'Office Manager' && ($team['office_id'] !== $actor['office_id'] || (isset($input['office_id']) && optionalId($input['office_id']) !== $actor['office_id']))) {
            jsonResponse(['ok' => false, 'error' => 'You can only edit teams in your office.'], 403);
        }
        $newOfficeId = array_key_exists('office_id', $input) ? optionalId($input['office_id']) : optionalId($team['office_id']);
        if ($newOfficeId !== null && !activeOffice($pdo, $newOfficeId)) jsonResponse(['ok' => false, 'error' => 'The selected office is unavailable.'], 422);
        $newMaxSize = array_key_exists('max_size', $input)
            ? ($input['max_size'] === null || $input['max_size'] === '' ? null : (int)$input['max_size'])
            : ($team['max_size'] === null ? null : (int)$team['max_size']);
        if ($newMaxSize !== null && $newMaxSize < 1) jsonResponse(['ok' => false, 'error' => 'Team capacity must be at least 1 or left unlimited.'], 422);
        $q = $pdo->prepare("SELECT COUNT(*) FROM staff_users WHERE team_id = ? AND role = 'Agent' AND deleted_at IS NULL");
        $q->execute([$teamId]);
        if ($newMaxSize !== null && (int)$q->fetchColumn() > $newMaxSize) jsonResponse(['ok' => false, 'error' => 'Capacity cannot be lower than the current number of agents.'], 409);
        $name = array_key_exists('name', $input) ? trim((string)$input['name']) : $team['name'];
        if ($name === '') jsonResponse(['ok' => false, 'error' => 'Team name is required.'], 422);
        $pdo->beginTransaction();
        try {
            $pdo->prepare('UPDATE teams SET name = ?, office_id = ?, max_size = ? WHERE id = ?')->execute([$name, $newOfficeId, $newMaxSize, $teamId]);
            if ($newOfficeId !== $team['office_id']) {
                $pdo->prepare('UPDATE staff_users SET office_id = ? WHERE team_id = ? AND deleted_at IS NULL')->execute([$newOfficeId, $teamId]);
                $pdo->prepare('UPDATE leads SET assigned_office_id = ?, updated_at = ? WHERE assigned_team_id = ? AND deleted_at IS NULL')->execute([$newOfficeId, date('c'), $teamId]);
            }
            if (array_key_exists('leader_id', $input)) {
                $leaderId = optionalId($input['leader_id']);
                $leader = $leaderId ? activeStaffRecord($pdo, $leaderId) : null;
                if ($leaderId && (!$leader || $leader['role'] !== 'Team Leader')) {
                    $pdo->rollBack();
                    jsonResponse(['ok' => false, 'error' => 'Select an active Team Leader.'], 422);
                }
                $pdo->prepare('UPDATE teams SET leader_id = NULL, leader_name = NULL WHERE leader_id = ?')->execute([$leaderId]);
                if ($leader) {
                    $pdo->prepare('UPDATE staff_users SET team_id = ?, office_id = ? WHERE id = ?')->execute([$teamId, $newOfficeId, $leaderId]);
                    $pdo->prepare('UPDATE teams SET leader_id = ?, leader_name = ? WHERE id = ?')->execute([$leaderId, $leader['name'], $teamId]);
                } elseif (!empty($team['leader_id'])) {
                    $pdo->prepare('UPDATE staff_users SET team_id = NULL WHERE id = ? AND deleted_at IS NULL')->execute([$team['leader_id']]);
                }
            }
            $pdo->commit();
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $error;
        }
        $q = $pdo->prepare('SELECT * FROM teams WHERE id = ?');
        $q->execute([$teamId]);
        jsonResponse(['ok' => true, 'team' => $q->fetch()]);
    }
    if ($method === 'DELETE') {
        requireSuperAdmin($pdo, $adminSession);
        if ($isPermanent) {
            $q = $pdo->prepare('SELECT id FROM staff_users WHERE team_id = ?');
            $q->execute([$teamId]);
            $staffIds = $q->fetchAll(PDO::FETCH_COLUMN);
            $pdo->beginTransaction();
            try {
                $conditions = ['assigned_team_id = ?'];
                $params = [$teamId];
                if ($staffIds) {
                    $in = implode(',', array_fill(0, count($staffIds), '?'));
                    $conditions[] = "(assigned_agent_id IN ({$in}) OR assigned_team_leader_id IN ({$in}))";
                    array_push($params, ...$staffIds, ...$staffIds);
                    $pdo->prepare("DELETE FROM admin_sessions WHERE user_id IN ({$in})")->execute($staffIds);
                    $pdo->prepare("DELETE FROM staff_users WHERE id IN ({$in})")->execute($staffIds);
                }
                $pdo->prepare('UPDATE leads SET assigned_office_id = NULL, assigned_team_id = NULL, assigned_team_leader_id = NULL, assigned_agent_id = NULL, assigned_by = NULL WHERE ' . implode(' OR ', $conditions))->execute($params);
                $pdo->prepare("DELETE FROM crm_assignment_restore WHERE entity_type = 'team' AND entity_id = ?")->execute([$teamId]);
                $pdo->prepare('DELETE FROM teams WHERE id = ?')->execute([$teamId]);
                $pdo->commit();
            } catch (Throwable $error) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                throw $error;
            }
            jsonResponse(['ok' => true]);
        }
        $q = $pdo->prepare('SELECT id FROM staff_users WHERE team_id = ? AND deleted_at IS NULL');
        $q->execute([$teamId]);
        $staffIds = $q->fetchAll(PDO::FETCH_COLUMN);
        $conditions = ['assigned_team_id = ?'];
        $params = [$teamId];
        if ($staffIds) {
            $in = implode(',', array_fill(0, count($staffIds), '?'));
            $conditions[] = "(assigned_agent_id IN ({$in}) OR assigned_team_leader_id IN ({$in}))";
            array_push($params, ...$staffIds, ...$staffIds);
        }
        $now = date('c');
        $pdo->beginTransaction();
        try {
            $leadIds = snapshotAndClearLeadAssignments($pdo, 'team', $teamId, implode(' OR ', $conditions), $params, $actor['id']);
            $pdo->prepare("UPDATE teams SET deleted_at = ?, deleted_scope_type = 'team', deleted_scope_id = ? WHERE id = ?")->execute([$now, $teamId, $teamId]);
            $pdo->prepare("UPDATE staff_users SET deleted_at = ?, deleted_scope_type = 'team', deleted_scope_id = ? WHERE team_id = ? AND deleted_at IS NULL")->execute([$now, $teamId, $teamId]);
            $pdo->commit();
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $error;
        }
        jsonResponse(['ok' => true, 'deleted_at' => $now, 'staff_ids' => $staffIds, 'lead_ids' => $leadIds]);
    }
    jsonResponse(['ok' => false, 'error' => 'Method not allowed.'], 405);
}
