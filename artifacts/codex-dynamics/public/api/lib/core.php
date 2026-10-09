<?php
/** Shared API helpers (sessions, auth guards, validation). */

declare(strict_types=1);

const ADMIN_SESSION_COOKIE = 'cdx_admin_session';
const PORTAL_SESSION_COOKIE = 'cdx_portal_session';

function mapClientApiRequest(mixed $value): mixed {
    if (!is_array($value)) return $value;
    $keys = [
        'client' => 'lead',
        'clients' => 'leads',
        'client_id' => 'lead_id',
        'client_ids' => 'lead_ids',
        'clientId' => 'leadId',
        'clientIds' => 'leadIds',
    ];
    $mapped = [];
    foreach ($value as $key => $item) {
        $nextKey = is_string($key) ? ($keys[$key] ?? $key) : $key;
        $mapped[$nextKey] = is_array($item) ? mapClientApiRequest($item) : $item;
    }
    return $mapped;
}

function sessionCookieName(string $table): string {
    return $table === 'admin_sessions' ? ADMIN_SESSION_COOKIE : PORTAL_SESSION_COOKIE;
}

function bearerToken(?string $cookieName = null): string {
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!$header && function_exists('getallheaders')) {
        $headers = getallheaders();
        $header = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    }
    if (preg_match('/^Bearer\s+(\S+)$/i', $header, $matches)) return $matches[1];
    if ($cookieName !== null && is_string($_COOKIE[$cookieName] ?? null)) return $_COOKIE[$cookieName];
    return '';
}

function requestIsHttps(): bool {
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || strtolower((string)($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https';
}

function setSessionCookie(string $name, string $token, int $expiresAt): void {
    setcookie($name, $token, [
        'expires' => $expiresAt,
        'path' => '/api',
        'secure' => requestIsHttps(),
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
}

function clearSessionCookie(string $name): void {
    setSessionCookie($name, '', time() - 3600);
}

function findSession(PDO $pdo, string $table, string $ownerColumn): ?array {
    $cookieName = sessionCookieName($table);
    $token = bearerToken($cookieName);
    if ($token === '') return null;
    $usingCookie = ($_COOKIE[$cookieName] ?? null) === $token;
    if ($usingCookie
        && !in_array($_SERVER['REQUEST_METHOD'] ?? 'GET', ['GET', 'HEAD', 'OPTIONS'], true)
        && !requestOriginIsTrusted()) {
        jsonResponse(['ok' => false, 'error' => 'Cross-site request rejected.'], 403);
    }
    $columns = "{$ownerColumn} AS owner_id, token_hash";
    if ($table === 'portal_sessions') {
        $columns .= ', is_impersonating, admin_user_id';
    }
    $stmt = $pdo->prepare("SELECT {$columns} FROM {$table} WHERE token_hash = ? AND expires_at > ?");
    $stmt->execute([hash('sha256', $token), date('c')]);
    $row = $stmt->fetch();
    if (!$row) return null;
    if ($table === 'admin_sessions') {
        $pdo->prepare('UPDATE admin_sessions SET last_seen_at = ? WHERE token_hash = ?')
            ->execute([date('c'), $row['token_hash']]);
    }
    $session = ['id' => $row['owner_id'], 'token_hash' => $row['token_hash']];
    if ($table === 'portal_sessions') {
        $session['impersonating'] = (bool)($row['is_impersonating'] ?? false);
        $session['admin_user_id'] = $row['admin_user_id'] ?? null;
    }
    return $session;
}

function staffOnlineSql(PDO $pdo, string $staffAlias = 's'): string {
    if (!preg_match('/^[A-Za-z0-9_]+$/', $staffAlias)) {
        throw new InvalidArgumentException('Invalid staff alias.');
    }
    $now = $pdo->quote(date('c'));
    $cutoff = $pdo->quote(date('c', time() - 90));
    return "(SELECT CASE WHEN COUNT(*) > 0 THEN 1 ELSE 0 END
        FROM admin_sessions active_session
        WHERE active_session.user_id = {$staffAlias}.id
          AND active_session.expires_at > {$now}
          AND active_session.last_seen_at >= {$cutoff})";
}

function credentialEncryptionKey(): string {
    $sessionSecret = (string)(getenv('SESSION_SECRET') ?: '');
    if (strlen($sessionSecret) < 32) {
        throw new RuntimeException('Credential encryption is not configured. Set SESSION_SECRET to a stable value of at least 32 characters.');
    }
    return hash_hmac('sha256', 'codex-client-credentials-v1', $sessionSecret, true);
}

function encryptClientSecret(string $plainText): string {
    if ($plainText === '') return '';
    $iv = random_bytes(12);
    $tag = '';
    $cipherText = openssl_encrypt($plainText, 'aes-256-gcm', credentialEncryptionKey(), OPENSSL_RAW_DATA, $iv, $tag, '', 16);
    if ($cipherText === false) throw new RuntimeException('Could not securely store the credential.');
    return base64_encode($iv . $tag . $cipherText);
}

function decryptClientSecret(?string $encoded): string {
    if (!$encoded) return '';
    $packed = base64_decode($encoded, true);
    if ($packed === false || strlen($packed) < 29) throw new RuntimeException('Stored credential data is invalid.');
    $plainText = openssl_decrypt(substr($packed, 28), 'aes-256-gcm', credentialEncryptionKey(), OPENSSL_RAW_DATA, substr($packed, 0, 12), substr($packed, 12, 16), '');
    if ($plainText === false) throw new RuntimeException('Could not unlock the stored credential. Check that SESSION_SECRET has not changed.');
    return $plainText;
}

function requireActiveAdminStaff(PDO $pdo, ?array $session): array {
    if (!$session) jsonResponse(['ok' => false, 'error' => 'Authentication required.'], 401);
    $stmt = $pdo->prepare("SELECT id, name, role, status, office_id, team_id, capabilities FROM staff_users WHERE id = ? AND deleted_at IS NULL");
    $stmt->execute([$session['id']]);
    $staff = $stmt->fetch();
    if (!$staff || $staff['status'] !== 'Active') jsonResponse(['ok' => false, 'error' => 'Administrator account is unavailable.'], 401);
    $staff['capabilities'] = json_decode((string)($staff['capabilities'] ?? '{}'), true) ?: [];
    return $staff;
}

function requireAdminCapability(PDO $pdo, ?array $session, string $capability): array {
    $actor = requireActiveAdminStaff($pdo, $session);
    if ($actor['role'] !== 'Super Admin' && ($actor['capabilities'][$capability] ?? true) === false) {
        jsonResponse(['ok' => false, 'error' => 'This CRM tool is not enabled for your account.'], 403);
    }
    return $actor;
}

function requireSuperAdmin(PDO $pdo, ?array $session): void {
    $staff = requireActiveAdminStaff($pdo, $session);
    if ($staff['role'] !== 'Super Admin') jsonResponse(['ok' => false, 'error' => 'Only a Super Admin can perform this action.'], 403);
}

function readPlatformSettingsRecord(PDO $pdo): array {
    $stmt = $pdo->prepare("SELECT settings_json, site_config_json, updated_at FROM platform_settings WHERE id = 'global'");
    $stmt->execute();
    $row = $stmt->fetch();
    if (!$row) {
        return ['settings' => [], 'site_config' => null, 'updated_at' => null];
    }

    $settings = json_decode((string)($row['settings_json'] ?? '{}'), true);
    $siteConfig = !empty($row['site_config_json'])
        ? json_decode((string)$row['site_config_json'], true)
        : null;
    return [
        'settings' => is_array($settings) ? $settings : [],
        'site_config' => is_array($siteConfig) ? $siteConfig : null,
        'updated_at' => $row['updated_at'] ?? null,
    ];
}

function publicSiteConfig(?array $siteConfig): ?array {
    if ($siteConfig === null) return null;
    if (isset($siteConfig['security']) && is_array($siteConfig['security'])) {
        unset($siteConfig['security']['webhookUrl'], $siteConfig['security']['webhook_url']);
    }
    unset($siteConfig['webhookUrl'], $siteConfig['webhook_url']);
    return $siteConfig;
}

function savePlatformSettingsRecord(
    PDO $pdo,
    array $settings,
    ?array $siteConfig,
    ?string $actorId,
    bool $siteConfigProvided = true
): array {
    $current = readPlatformSettingsRecord($pdo);
    $nextSettings = array_merge($current['settings'], $settings);
    $nextSiteConfig = $siteConfigProvided ? $siteConfig : $current['site_config'];
    $settingsJson = json_encode($nextSettings, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    $siteConfigJson = $nextSiteConfig === null
        ? null
        : json_encode($nextSiteConfig, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

    if ($settingsJson === false || ($nextSiteConfig !== null && $siteConfigJson === false)) {
        throw new RuntimeException('Settings could not be encoded.');
    }
    if (strlen($settingsJson) + strlen((string)$siteConfigJson) > 1_000_000) {
        throw new LengthException('Settings payload is too large.');
    }

    $exists = $pdo->query("SELECT id FROM platform_settings WHERE id = 'global'")->fetchColumn();
    if ($exists) {
        $stmt = $pdo->prepare("
            UPDATE platform_settings
            SET settings_json = ?, site_config_json = ?, updated_by = ?, updated_at = ?
            WHERE id = 'global'
        ");
        $stmt->execute([$settingsJson, $siteConfigJson, $actorId, date('c')]);
    } else {
        $stmt = $pdo->prepare("
            INSERT INTO platform_settings (id, settings_json, site_config_json, updated_by, updated_at)
            VALUES ('global', ?, ?, ?, ?)
        ");
        $stmt->execute([$settingsJson, $siteConfigJson, $actorId, date('c')]);
    }
    return readPlatformSettingsRecord($pdo);
}

function optionalId(mixed $value): ?string {
    $value = trim((string)($value ?? ''));
    return $value === '' ? null : $value;
}

function activeOffice(PDO $pdo, ?string $id): ?array {
    if ($id === null) return null;
    $stmt = $pdo->prepare('SELECT * FROM offices WHERE id = ? AND deleted_at IS NULL');
    $stmt->execute([$id]);
    return $stmt->fetch() ?: null;
}

function activeTeam(PDO $pdo, ?string $id): ?array {
    if ($id === null) return null;
    $stmt = $pdo->prepare('SELECT * FROM teams WHERE id = ? AND deleted_at IS NULL');
    $stmt->execute([$id]);
    return $stmt->fetch() ?: null;
}

function activeStaffRecord(PDO $pdo, ?string $id): ?array {
    if ($id === null) return null;
    $stmt = $pdo->prepare("SELECT id, name, email, role, office_id, team_id, status, capabilities FROM staff_users WHERE id = ? AND deleted_at IS NULL");
    $stmt->execute([$id]);
    return $stmt->fetch() ?: null;
}

function publicStaffRecord(PDO $pdo, string $id): ?array {
    $onlineSql = staffOnlineSql($pdo);
    $stmt = $pdo->prepare("
        SELECT s.id, s.email, s.name, s.role, s.office_id, s.team_id, s.status,
               s.capabilities, s.last_login_at, s.created_at, s.deleted_at,
               s.deleted_scope_type, s.deleted_scope_id,
               o.name AS office_name, t.name AS team_name,
               {$onlineSql} AS is_online,
               (SELECT COUNT(*) FROM leads l WHERE l.deleted_at IS NULL AND (l.assigned_agent_id = s.id OR l.assigned_team_leader_id = s.id)) AS lead_count
        FROM staff_users s
        LEFT JOIN offices o ON o.id = s.office_id
        LEFT JOIN teams t ON t.id = s.team_id
        WHERE s.id = ?
    ");
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) return null;
    $row['capabilities'] = json_decode((string)($row['capabilities'] ?? '{}'), true) ?: [];
    return $row;
}

function leadAssignmentFromRow(array $row): array {
    return [
        'office_id' => $row['assigned_office_id'] ?? null,
        'team_id' => $row['assigned_team_id'] ?? null,
        'team_leader_id' => $row['assigned_team_leader_id'] ?? null,
        'agent_id' => $row['assigned_agent_id'] ?? null,
    ];
}

function validateLeadAssignment(PDO $pdo, array $input): array {
    $officeId = optionalId($input['office_id'] ?? null);
    $teamId = optionalId($input['team_id'] ?? null);
    $teamLeaderId = optionalId($input['team_leader_id'] ?? null);
    $agentId = optionalId($input['agent_id'] ?? null);

    if ($officeId !== null && !activeOffice($pdo, $officeId)) {
        jsonResponse(['ok' => false, 'error' => 'The selected office is unavailable.'], 422);
    }

    if ($teamId !== null) {
        $team = activeTeam($pdo, $teamId);
        if (!$team) jsonResponse(['ok' => false, 'error' => 'The selected team is unavailable.'], 422);
        if ($officeId !== null && !empty($team['office_id']) && $officeId !== $team['office_id']) {
            jsonResponse(['ok' => false, 'error' => 'The selected team does not belong to that office.'], 422);
        }
        if ($officeId === null && !empty($team['office_id'])) $officeId = (string)$team['office_id'];
    }

    if ($teamLeaderId !== null) {
        $leader = activeStaffRecord($pdo, $teamLeaderId);
        if (!$leader || $leader['role'] !== 'Team Leader') {
            jsonResponse(['ok' => false, 'error' => 'The selected team leader is unavailable.'], 422);
        }
        if ($teamId !== null && $leader['team_id'] !== $teamId) {
            jsonResponse(['ok' => false, 'error' => 'The selected team leader does not belong to that team.'], 422);
        }
        if ($officeId !== null && !empty($leader['office_id']) && $leader['office_id'] !== $officeId) {
            jsonResponse(['ok' => false, 'error' => 'The selected team leader does not belong to that office.'], 422);
        }
    }

    if ($agentId !== null) {
        $agent = activeStaffRecord($pdo, $agentId);
        if (!$agent || $agent['role'] !== 'Agent') {
            jsonResponse(['ok' => false, 'error' => 'The selected agent is unavailable.'], 422);
        }
        if ($teamId !== null && $agent['team_id'] !== $teamId) {
            jsonResponse(['ok' => false, 'error' => 'The selected agent does not belong to that team.'], 422);
        }
        if ($officeId !== null && !empty($agent['office_id']) && $agent['office_id'] !== $officeId) {
            jsonResponse(['ok' => false, 'error' => 'The selected agent does not belong to that office.'], 422);
        }
        $teamId = optionalId($agent['team_id'] ?? null);
        $officeId = optionalId($agent['office_id'] ?? null);
        $teamLeaderId = null;
    }

    return [
        'office_id' => $officeId,
        'team_id' => $teamId,
        'team_leader_id' => $teamLeaderId,
        'agent_id' => $agentId,
    ];
}

function assertCanAssignLead(array $actor, array $assignment, PDO $pdo): void {
    if ($actor['role'] === 'Super Admin') return;

    if ($actor['role'] === 'Office Manager') {
        $officeId = optionalId($actor['office_id'] ?? null);
        if ($officeId === null) jsonResponse(['ok' => false, 'error' => 'Your account is not assigned to an office.'], 403);
        if ($assignment['office_id'] !== null && $assignment['office_id'] !== $officeId) {
            jsonResponse(['ok' => false, 'error' => 'You can only assign leads within your office.'], 403);
        }
        foreach ([
            ['teams', 'team_id'],
            ['staff_users', 'agent_id'],
            ['staff_users', 'team_leader_id'],
        ] as [$table, $key]) {
            if ($assignment[$key] === null) continue;
            $stmt = $pdo->prepare("SELECT office_id FROM {$table} WHERE id = ? AND deleted_at IS NULL");
            $stmt->execute([$assignment[$key]]);
            if ($stmt->fetchColumn() !== $officeId) {
                jsonResponse(['ok' => false, 'error' => 'You can only assign leads to staff and teams in your office.'], 403);
            }
        }
        return;
    }

    if ($actor['role'] === 'Team Leader') {
        $teamId = optionalId($actor['team_id'] ?? null);
        if ($assignment['team_id'] !== null && $assignment['team_id'] !== $teamId) {
            jsonResponse(['ok' => false, 'error' => 'You can only assign leads within your team.'], 403);
        }
        if ($assignment['agent_id'] !== null) {
            $agent = activeStaffRecord($pdo, $assignment['agent_id']);
            if (!$teamId || !$agent || $agent['team_id'] !== $teamId) {
                jsonResponse(['ok' => false, 'error' => 'You can only assign leads to agents in your team.'], 403);
            }
        }
        if ($assignment['team_leader_id'] !== null && $assignment['team_leader_id'] !== $actor['id']) {
            jsonResponse(['ok' => false, 'error' => 'You can only assign leads directly to yourself.'], 403);
        }
        $officeId = optionalId($actor['office_id'] ?? null);
        if ($assignment['office_id'] !== null && $assignment['office_id'] !== $officeId) {
            jsonResponse(['ok' => false, 'error' => 'You can only assign leads within your office.'], 403);
        }
        return;
    }

    if ($actor['role'] === 'Agent') {
        if ($assignment['agent_id'] === $actor['id']
            && $assignment['team_id'] === optionalId($actor['team_id'] ?? null)
            && $assignment['office_id'] === optionalId($actor['office_id'] ?? null)) {
            return;
        }
        jsonResponse(['ok' => false, 'error' => 'You can only assign a new lead to yourself.'], 403);
    }

    jsonResponse(['ok' => false, 'error' => 'Your role cannot reassign leads.'], 403);
}

function actorCanViewLead(array $actor, array $lead): bool {
    if ($actor['role'] === 'Super Admin') return true;
    if ($actor['role'] === 'Office Manager') return (string)($lead['assigned_office_id'] ?? '') !== '' && $lead['assigned_office_id'] === $actor['office_id'];
    if ($actor['role'] === 'Team Leader') {
        return (!empty($actor['team_id']) && $lead['assigned_team_id'] === $actor['team_id'])
            || $lead['assigned_team_leader_id'] === $actor['id'];
    }
    if ($actor['role'] === 'Agent') return $lead['assigned_agent_id'] === $actor['id'];
    return false;
}

function requireVisibleLead(PDO $pdo, array $actor, string $leadId): array {
    $stmt = $pdo->prepare('SELECT * FROM leads WHERE id = ? AND deleted_at IS NULL');
    $stmt->execute([$leadId]);
    $lead = $stmt->fetch();
    if (!$lead) jsonResponse(['ok' => false, 'error' => 'Client record not found.'], 404);
    if (!actorCanViewLead($actor, $lead)) {
        jsonResponse(['ok' => false, 'error' => 'You cannot access this client record.'], 403);
    }
    return $lead;
}

function saveLeadAssignment(PDO $pdo, string $leadId, array $assignment, array $actor): array {
    $stmt = $pdo->prepare('SELECT * FROM leads WHERE id = ? AND deleted_at IS NULL');
    $stmt->execute([$leadId]);
    $lead = $stmt->fetch();
    if (!$lead) jsonResponse(['ok' => false, 'error' => 'Lead not found.'], 404);

    $previous = leadAssignmentFromRow($lead);
    $now = date('c');
    $pdo->prepare('UPDATE leads SET assigned_office_id = ?, assigned_team_id = ?, assigned_team_leader_id = ?, assigned_agent_id = ?, assigned_by = ?, updated_at = ? WHERE id = ?')
        ->execute([$assignment['office_id'], $assignment['team_id'], $assignment['team_leader_id'], $assignment['agent_id'], $actor['id'], $now, $leadId]);
    $historyId = 'lah_' . bin2hex(random_bytes(10));
    $pdo->prepare('INSERT INTO lead_assignment_history (id, lead_id, actor_id, previous_assignment, new_assignment, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        ->execute([$historyId, $leadId, $actor['id'], json_encode($previous), json_encode($assignment), $now]);

    $stmt = $pdo->prepare('SELECT l.*, staff.name AS assigned_agent_name FROM leads l LEFT JOIN staff_users staff ON staff.id = l.assigned_agent_id WHERE l.id = ?');
    $stmt->execute([$leadId]);
    return $stmt->fetch() ?: [];
}

function canManageStaffRecord(array $actor, array $target): bool {
    if ($actor['role'] === 'Super Admin') return true;
    if ($actor['id'] === $target['id']) return true;
    if ($actor['role'] === 'Office Manager') {
        return $target['office_id'] === $actor['office_id']
            && in_array($target['role'], ['Team Leader', 'Agent'], true);
    }
    if ($actor['role'] === 'Team Leader') {
        return $target['role'] === 'Agent'
            && !empty($actor['team_id'])
            && $target['team_id'] === $actor['team_id'];
    }
    return false;
}

function canManageStaffStatus(array $actor, array $target): bool {
    if ($actor['role'] === 'Super Admin') return true;
    if ($actor['role'] === 'Office Manager') {
        return $target['office_id'] === $actor['office_id']
            && in_array($target['role'], ['Team Leader', 'Agent'], true);
    }
    if ($actor['role'] === 'Team Leader') {
        return $target['role'] === 'Agent'
            && !empty($actor['team_id'])
            && $target['team_id'] === $actor['team_id'];
    }
    return false;
}

function snapshotAndClearLeadAssignments(PDO $pdo, string $entityType, string $entityId, string $whereSql, array $whereParams, string $actorId): array {
    $stmt = $pdo->prepare("SELECT id, assigned_office_id, assigned_team_id, assigned_team_leader_id, assigned_agent_id, assigned_by FROM leads WHERE deleted_at IS NULL AND ({$whereSql})");
    $stmt->execute($whereParams);
    $rows = $stmt->fetchAll();
    $insert = $pdo->prepare('INSERT INTO crm_assignment_restore (id, entity_type, entity_id, lead_id, assigned_office_id, assigned_team_id, assigned_team_leader_id, assigned_agent_id, assigned_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $clear = $pdo->prepare('UPDATE leads SET assigned_office_id = NULL, assigned_team_id = NULL, assigned_team_leader_id = NULL, assigned_agent_id = NULL, assigned_by = ?, updated_at = ? WHERE id = ?');
    $now = date('c');
    foreach ($rows as $row) {
        $pdo->prepare('DELETE FROM crm_assignment_restore WHERE entity_type = ? AND entity_id = ? AND lead_id = ?')
            ->execute([$entityType, $entityId, $row['id']]);
        $insert->execute([
            'crar_' . bin2hex(random_bytes(10)),
            $entityType,
            $entityId,
            $row['id'],
            $row['assigned_office_id'],
            $row['assigned_team_id'],
            $row['assigned_team_leader_id'],
            $row['assigned_agent_id'],
            $row['assigned_by'],
        ]);
        $clear->execute([$actorId, $now, $row['id']]);
    }
    return array_column($rows, 'id');
}

function restoreLeadAssignmentSnapshots(PDO $pdo, string $entityType, string $entityId): array {
    $stmt = $pdo->prepare('SELECT * FROM crm_assignment_restore WHERE entity_type = ? AND entity_id = ? ORDER BY lead_id');
    $stmt->execute([$entityType, $entityId]);
    $snapshots = $stmt->fetchAll();
    $update = $pdo->prepare('UPDATE leads SET assigned_office_id = ?, assigned_team_id = ?, assigned_team_leader_id = ?, assigned_agent_id = ?, assigned_by = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL');
    $now = date('c');
    foreach ($snapshots as $snapshot) {
        $update->execute([
            $snapshot['assigned_office_id'],
            $snapshot['assigned_team_id'],
            $snapshot['assigned_team_leader_id'],
            $snapshot['assigned_agent_id'],
            $snapshot['assigned_by'],
            $now,
            $snapshot['lead_id'],
        ]);
    }
    $pdo->prepare('DELETE FROM crm_assignment_restore WHERE entity_type = ? AND entity_id = ?')
        ->execute([$entityType, $entityId]);
    $ids = array_column($snapshots, 'lead_id');
    if (!$ids) return [];
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $restored = $pdo->prepare("SELECT l.*, staff.name AS assigned_agent_name FROM leads l LEFT JOIN staff_users staff ON staff.id = l.assigned_agent_id WHERE l.deleted_at IS NULL AND l.id IN ({$placeholders})");
    $restored->execute($ids);
    return array_map('normalizeLeadRow', $restored->fetchAll());
}

function activeStaffWithinOffice(PDO $pdo, array $actor, array $target): bool {
    return $actor['role'] === 'Super Admin'
        || ($actor['role'] === 'Office Manager'
            && !empty($actor['office_id'])
            && $target['office_id'] === $actor['office_id']);
}

function emptyClientProfilePermissions(): array {
    return ['access' => 'none', 'accounting' => 'none'];
}

function requireClientProfileSectionAccess(PDO $pdo, ?array $session, string $clientId, string $section, bool $write): string {
    $staff = requireActiveAdminStaff($pdo, $session);
    if ($staff['role'] === 'Super Admin') return 'edit';
    if (!in_array($staff['role'], ['Office Manager', 'Team Leader', 'Agent'], true)) {
        jsonResponse(['ok' => false, 'error' => 'This account cannot access client profile sections.'], 403);
    }

    $stmt = $pdo->prepare('SELECT access_level FROM client_profile_permissions WHERE client_id = ? AND staff_id = ? AND profile_section = ?');
    $stmt->execute([$clientId, $staff['id'], $section]);
    $accessLevel = (string)($stmt->fetchColumn() ?: '');
    if (!in_array($accessLevel, ['read', 'edit'], true)) {
        jsonResponse(['ok' => false, 'error' => 'You have not been granted access to this client profile section.'], 403);
    }
    if ($write && $accessLevel !== 'edit') {
        jsonResponse(['ok' => false, 'error' => 'This client profile section is read-only for your account.'], 403);
    }
    return $accessLevel;
}

function decodeImapHeader(string $value): string {
    if (!function_exists('imap_mime_header_decode')) return $value;
    $parts = imap_mime_header_decode($value);
    $decoded = '';
    foreach ($parts ?: [] as $part) {
        $text = (string)($part->text ?? '');
        $charset = strtoupper((string)($part->charset ?? ''));
        if ($charset !== '' && $charset !== 'DEFAULT' && $charset !== 'UTF-8' && function_exists('iconv')) {
            $converted = @iconv($charset, 'UTF-8//IGNORE', $text);
            if ($converted !== false) $text = $converted;
        }
        $decoded .= $text;
    }
    return $decoded;
}

function findImapTextPart(object $structure, string $partNumber = ''): ?array {
    $htmlFallback = null;
    $type = (int)($structure->type ?? 0);
    $subtype = strtoupper((string)($structure->subtype ?? ''));
    if ($type === 0 && in_array($subtype, ['PLAIN', 'HTML'], true)) {
        $charset = '';
        foreach (($structure->parameters ?? []) as $parameter) {
            if (strtolower((string)($parameter->attribute ?? '')) === 'charset') $charset = (string)($parameter->value ?? '');
        }
        return ['number' => $partNumber !== '' ? $partNumber : '1', 'subtype' => $subtype, 'encoding' => (int)($structure->encoding ?? 0), 'charset' => $charset];
    }
    foreach (($structure->parts ?? []) as $index => $part) {
        $number = $partNumber === '' ? (string)($index + 1) : $partNumber . '.' . ($index + 1);
        $found = findImapTextPart($part, $number);
        if ($found && $found['subtype'] === 'PLAIN') return $found;
        if ($found) $htmlFallback = $found;
    }
    return $htmlFallback ?? null;
}

function readImapMessageText($mailbox, int $messageNumber): string {
    $structure = @imap_fetchstructure($mailbox, $messageNumber);
    if (!$structure) return '';
    $part = findImapTextPart($structure);
    if (!$part) return '';
    $body = (string)@imap_fetchbody($mailbox, $messageNumber, $part['number'], FT_PEEK);
    if ($part['encoding'] === 3) $body = base64_decode($body, true) ?: '';
    elseif ($part['encoding'] === 4) $body = quoted_printable_decode($body);
    if ($part['charset'] !== '' && strtoupper($part['charset']) !== 'UTF-8' && function_exists('iconv')) {
        $converted = @iconv($part['charset'], 'UTF-8//IGNORE', $body);
        if ($converted !== false) $body = $converted;
    }
    if ($part['subtype'] === 'HTML') {
        $body = html_entity_decode(strip_tags(preg_replace('#<(br|/p|/div|/li)[^>]*>#i', "\n", $body)), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }
    return trim(function_exists('mb_substr') ? mb_substr($body, 0, 30000, 'UTF-8') : substr($body, 0, 30000));
}

function smtpReadResponse($socket): array {
    $lines = [];
    do {
        $line = fgets($socket, 2048);
        if ($line === false) throw new RuntimeException('The email server closed the connection.');
        $lines[] = trim($line);
    } while (strlen($line) >= 4 && $line[3] === '-');
    return [(int)substr($lines[count($lines) - 1], 0, 3), implode("\n", $lines)];
}

function smtpCommand($socket, string $command, array $expectedCodes): string {
    fwrite($socket, $command . "\r\n");
    [$code, $response] = smtpReadResponse($socket);
    if (!in_array($code, $expectedCodes, true)) throw new RuntimeException('The email server rejected an operation (' . $code . ').');
    return $response;
}

function sendClientMailboxReply(array $access, string $recipient, string $subject, string $body, string $inReplyTo = ''): void {
    $host = trim((string)$access['smtp_host']);
    $port = (int)$access['smtp_port'];
    $username = (string)$access['email_address'];
    $password = decryptClientSecret($access['email_password_enc'] ?? '');
    if ($host === '' || $username === '' || $password === '') throw new RuntimeException('Email sending is not configured for this account.');
    if (!preg_match('/^[A-Za-z0-9.-]+$/', $host) || $port < 1 || $port > 65535 || !filter_var($username, FILTER_VALIDATE_EMAIL)) throw new RuntimeException('Email sending server settings are invalid.');
    if (!filter_var($recipient, FILTER_VALIDATE_EMAIL) || preg_match('/[\r\n]/', $recipient)) throw new RuntimeException('The reply address is not valid.');
    if (preg_match('/[\r\n]/', $subject)) throw new RuntimeException('The email subject is not valid.');
    if ($body === '' || strlen($body) > 40000) throw new RuntimeException('The reply must contain 1–40,000 characters.');

    $endpoint = ($port === 465 ? 'ssl://' : '') . $host . ':' . $port;
    $socket = @stream_socket_client($endpoint, $errno, $errstr, 20, STREAM_CLIENT_CONNECT, stream_context_create([
        'ssl' => ['verify_peer' => true, 'verify_peer_name' => true, 'peer_name' => $host],
    ]));
    if (!$socket) throw new RuntimeException('Could not connect to the email sending server.');
    stream_set_timeout($socket, 20);
    try {
        [$code] = smtpReadResponse($socket);
        if ($code !== 220) throw new RuntimeException('The email sending server is not ready.');
        $domain = preg_replace('/[^A-Za-z0-9.-]/', '', (string)($_SERVER['SERVER_NAME'] ?? 'localhost')) ?: 'localhost';
        smtpCommand($socket, 'EHLO ' . $domain, [250]);
        if ($port !== 465) {
            smtpCommand($socket, 'STARTTLS', [220]);
            if (!stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) throw new RuntimeException('Could not start a secure email connection.');
            smtpCommand($socket, 'EHLO ' . $domain, [250]);
        }
        smtpCommand($socket, 'AUTH LOGIN', [334]);
        smtpCommand($socket, base64_encode($username), [334]);
        smtpCommand($socket, base64_encode($password), [235]);
        smtpCommand($socket, 'MAIL FROM:<' . $username . '>', [250]);
        smtpCommand($socket, 'RCPT TO:<' . $recipient . '>', [250, 251]);
        smtpCommand($socket, 'DATA', [354]);
        $safeSubject = 'Re: ' . preg_replace('/^(re:\s*)+/i', '', trim($subject));
        $encodedSubject = '=?UTF-8?B?' . base64_encode($safeSubject) . '?=';
        $headers = [
            'From: <' . $username . '>',
            'To: <' . $recipient . '>',
            'Subject: ' . $encodedSubject,
            'MIME-Version: 1.0',
            'Content-Type: text/plain; charset=UTF-8',
            'Content-Transfer-Encoding: 8bit',
        ];
        if ($inReplyTo !== '' && !preg_match('/[\r\n]/', $inReplyTo)) $headers[] = 'In-Reply-To: ' . $inReplyTo;
        $message = implode("\r\n", $headers) . "\r\n\r\n" . preg_replace('/^\./m', '..', str_replace(["\r\n", "\r", "\n"], "\r\n", $body));
        fwrite($socket, $message . "\r\n.\r\n");
        [$dataCode] = smtpReadResponse($socket);
        if ($dataCode !== 250) throw new RuntimeException('The email server could not send this reply.');
        try { smtpCommand($socket, 'QUIT', [221]); } catch (Throwable $ignored) {}
    } finally {
        fclose($socket);
    }
}

function normalizeLeadRow(array $lead): array {
    foreach (['comment_history', 'status_history', 'appointments'] as $field) {
        if (is_string($lead[$field] ?? null)) {
            $decoded = json_decode($lead[$field], true);
            $lead[$field] = is_array($decoded) ? $decoded : [];
        } elseif (!is_array($lead[$field] ?? null)) {
            $lead[$field] = [];
        }
    }
    return $lead;
}

function normalizeClientPhone(string $phone): string {
    return preg_replace('/\D+/', '', trim($phone)) ?? '';
}

function nextRecurringBillingDate(string $date, string $frequency): string {
    $current = DateTimeImmutable::createFromFormat('!Y-m-d', $date);
    if (!$current) throw new RuntimeException('The recurring billing date is invalid.');
    $day = (int)$current->format('j');
    $target = $frequency === 'Yearly'
        ? $current->setDate((int)$current->format('Y') + 1, (int)$current->format('n'), 1)
        : $current->modify('first day of next month');
    $targetDay = min($day, (int)$target->format('t'));
    return $target->setDate((int)$target->format('Y'), (int)$target->format('n'), $targetDay)->format('Y-m-d');
}

function createRecurringInvoice(PDO $pdo, string $clientId, string $serviceId, bool $mustBeDue = false): array {
    $serviceStmt = $pdo->prepare('SELECT * FROM client_recurring_services WHERE id = ? AND client_id = ?');
    $serviceStmt->execute([$serviceId, $clientId]);
    $service = $serviceStmt->fetch();
    if (!$service || strtolower(trim((string)$service['status'])) !== 'active') {
        throw new AccountingActionException('Only an active recurring service can be invoiced.', 409);
    }

    $cycleStart = (string)$service['next_due_date'];
    if ($mustBeDue && $cycleStart > date('Y-m-d')) {
        throw new AccountingActionException('A selected service is not due yet. Refresh the due-work list and review the batch again.', 409);
    }
    $nextDueDate = nextRecurringBillingDate($cycleStart, (string)$service['billing_frequency']);
    $cycleEnd = DateTimeImmutable::createFromFormat('!Y-m-d', $nextDueDate)->modify('-1 day')->format('Y-m-d');
    $updated = $pdo->prepare("UPDATE client_recurring_services SET next_due_date = ?, updated_at = ? WHERE id = ? AND client_id = ? AND next_due_date = ? AND status = 'Active'");
    $updated->execute([$nextDueDate, date('c'), $serviceId, $clientId, $cycleStart]);
    if ($updated->rowCount() !== 1) {
        throw new AccountingActionException('This service was just invoiced or changed. Refresh the ledger and try again.', 409);
    }

    $amount = round((float)$service['amount'], 2);
    $invoiceId = 'inv_' . bin2hex(random_bytes(8));
    $invoiceNumber = 'INV-' . date('Y') . '-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 6));
    $issueDate = date('Y-m-d');
    $lineItems = [[
        'description' => trim((string)$service['service_name']) . ' · ' . $cycleStart . ' to ' . $cycleEnd,
        'service' => (string)$service['service_type'],
        'quantity' => 1,
        'unitPrice' => $amount,
        'total' => $amount,
        'recurringServiceId' => $serviceId,
    ]];
    $notes = 'Recurring service billing cycle: ' . $cycleStart . ' to ' . $cycleEnd . '.';
    $pdo->prepare("
        INSERT INTO client_invoices
            (id, client_id, invoice_number, issue_date, due_date, status, currency, subtotal, tax, total, amount_paid, balance_due, line_items, notes, created_at)
        VALUES (?, ?, ?, ?, ?, 'Pending', ?, ?, 0, ?, 0, ?, ?, ?, ?)
    ")->execute([$invoiceId, $clientId, $invoiceNumber, $issueDate, $cycleStart, $service['currency'], $amount, $amount, $amount, json_encode($lineItems, JSON_UNESCAPED_UNICODE), $notes, date('c')]);

    return [
        'invoiceId' => $invoiceId,
        'invoiceNumber' => $invoiceNumber,
        'amount' => $amount,
        'currency' => $service['currency'],
        'nextDueDate' => $nextDueDate,
        'clientId' => $clientId,
        'serviceId' => $serviceId,
        'serviceName' => $service['service_name'],
    ];
}

function loadClientIdentifierSets(PDO $pdo): array {
    $emails = [];
    $phones = [];
    $stmt = $pdo->query('SELECT email, phone FROM clients');
    while ($row = $stmt->fetch()) {
        $email = strtolower(trim((string)($row['email'] ?? '')));
        if ($email !== '') $emails[$email] = true;
        $phone = normalizeClientPhone((string)($row['phone'] ?? ''));
        if ($phone !== '') $phones[$phone] = true;
    }
    return [$emails, $phones];
}

function findClientIdentifierConflict(
    PDO $pdo,
    string $email,
    string $phone,
    ?string $excludeClientId = null,
    ?string $unusedPortalClientId = null,
    bool $checkEmail = true,
    bool $checkPhone = true
): ?string {
    $email = strtolower(trim($email));
    if ($checkEmail && $email !== '') {
        $sql = "SELECT id FROM clients WHERE LOWER(TRIM(COALESCE(email, ''))) = ?";
        $params = [$email];
        if ($excludeClientId !== null) {
            $sql .= ' AND id <> ?';
            $params[] = $excludeClientId;
        }
        $stmt = $pdo->prepare($sql . ' LIMIT 1');
        $stmt->execute($params);
        if ($stmt->fetch()) return 'email';
    }

    $normalizedPhone = normalizeClientPhone($phone);
    if ($checkPhone && $normalizedPhone !== '') {
        $stmt = $pdo->query("SELECT id, phone FROM clients WHERE phone IS NOT NULL AND TRIM(phone) <> ''");
        while ($row = $stmt->fetch()) {
            if ($excludeClientId !== null && (string)$row['id'] === $excludeClientId) continue;
            if (normalizeClientPhone((string)$row['phone']) === $normalizedPhone) return 'phone';
        }
    }
    return null;
}

function ensurePortalClientForLead(PDO $pdo, array $lead, string $plainPassword, string $now): array {
    $passwordHash = password_hash($plainPassword, PASSWORD_DEFAULT);
    if ($passwordHash === false) throw new RuntimeException('Could not securely save the client password.');
    $clientId = trim((string)($lead['id'] ?? ''));
    if ($clientId === '') throw new InvalidArgumentException('A Client ID is required before enabling portal access.');
    $clientCheck = $pdo->prepare('SELECT id FROM clients WHERE id = ?');
    $clientCheck->execute([$clientId]);
    if (!$clientCheck->fetchColumn()) throw new RuntimeException('The Client record must exist before portal access is created.');

    $accessCheck = $pdo->prepare('SELECT client_id FROM client_portal_access WHERE client_id = ?');
    $accessCheck->execute([$clientId]);
    $created = !$accessCheck->fetchColumn();
    if ($created) {
        $pdo->prepare("INSERT INTO client_portal_access
            (client_id, password_hash, status, portal_enabled, tier, created_at)
            VALUES (?, ?, 'Active', 1, 'Enterprise Partner', ?)")
            ->execute([$clientId, $passwordHash, $now]);
    } else {
        $pdo->prepare('UPDATE client_portal_access SET password_hash = ? WHERE client_id = ?')
            ->execute([$passwordHash, $clientId]);
    }
    return ['id' => $clientId, 'created' => $created];
}
