<?php
/**
 * Codex Dynamics - Unified REST API Router for Hostinger Apache/PHP
 */

declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/lead-access.php';
require_once __DIR__ . '/hostinger-mail.php';

$pdo = getDb();
$method = $_SERVER['REQUEST_METHOD'];
$uri = $_SERVER['REQUEST_URI'];
$path = parse_url($uri, PHP_URL_PATH);

// Normalize path relative to /api/
$apiPath = preg_replace('#^.*?/api/?#', '/', $path);
$apiPath = '/' . ltrim($apiPath, '/');
$apiPath = preg_replace('#\.php$#', '', $apiPath);

$input = json_decode(file_get_contents('php://input') ?: '[]', true) ?: [];

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

// Client lifecycle routes are the public API contract. Existing SQL helpers
// still share a transition layer with older integrations, but new callers see
// Client field names and never create a parallel identity.
$isClientLifecycleRoute = $apiPath === '/admin/clients'
    || preg_match('#^/admin/clients/(?:search|import|assign-bulk|bulk-assign|bulk-status|bin(?:/.*)?|[^/]+(?:/(?:restore|reset-status|assign|comments(?:/[^/]+)?|status-history/[^/]+|set-password))?)$#', $apiPath) === 1;
if ($isClientLifecycleRoute) {
    $GLOBALS['clientApiContract'] = true;
    $apiPath = preg_replace('#^/admin/clients#', '/admin/leads', $apiPath);
    $input = mapClientApiRequest($input);
    foreach (['client_id' => 'lead_id', 'client_ids' => 'lead_ids'] as $clientKey => $legacyKey) {
        if (array_key_exists($clientKey, $_GET)) {
            $_GET[$legacyKey] = $_GET[$clientKey];
            unset($_GET[$clientKey]);
        }
    }
}

function bearerToken(): string {
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!$header && function_exists('getallheaders')) {
        $headers = getallheaders();
        $header = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    }
    return preg_match('/^Bearer\s+(\S+)$/i', $header, $matches) ? $matches[1] : '';
}

function findSession(PDO $pdo, string $table, string $ownerColumn): ?array {
    $token = bearerToken();
    if ($token === '') return null;
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

class AccountingActionException extends RuntimeException {}

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

$adminSession = null;
$portalSession = null;
$isAdminLogin = $apiPath === '/admin/login';
$isPortalLogin = $apiPath === '/portal/login';
if (str_starts_with($apiPath, '/admin/') && !$isAdminLogin) {
    $adminSession = findSession($pdo, 'admin_sessions', 'user_id');
    if (!$adminSession) jsonResponse(['ok' => false, 'error' => 'Authentication required.'], 401);
}
if (($apiPath === '/portal/data'
    || $apiPath === '/portal/profile'
    || $apiPath === '/portal/ticket'
    || $apiPath === '/portal/notifications'
    || $apiPath === '/portal/access'
    || $apiPath === '/portal/mail'
    || $apiPath === '/portal/mail/reply'
    || $apiPath === '/portal/mailboxes'
    || str_starts_with($apiPath, '/portal/mailboxes/')
    || str_starts_with($apiPath, '/portal/projects/')
    || $apiPath === '/portal/messages/presence'
    || $apiPath === '/portal/logout'
    || str_starts_with($apiPath, '/client/')) && !$isPortalLogin) {
    $portalSession = findSession($pdo, 'portal_sessions', 'client_id');
    if (!$portalSession) jsonResponse(['ok' => false, 'error' => 'Client sign-in required.'], 401);
    if ($apiPath !== '/portal/logout') {
        $portalAccountStmt = $pdo->prepare('SELECT status, portal_enabled FROM client_portal_access WHERE client_id = ?');
        $portalAccountStmt->execute([$portalSession['id']]);
        $portalAccount = $portalAccountStmt->fetch();
        if (!$portalAccount || $portalAccount['status'] !== 'Active' || empty($portalAccount['portal_enabled'])) {
            jsonResponse(['ok' => false, 'error' => 'This client portal account is unavailable.'], 401);
        }
    }
    if ($portalSession['impersonating']
        && in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'], true)
        && $apiPath !== '/portal/logout') {
        jsonResponse(['ok' => false, 'error' => 'Client impersonation is read-only.'], 403);
    }
}

if (hostingerMailDispatch($pdo, $apiPath, $method, $input, $adminSession, $portalSession)) {
    exit;
}

if ($apiPath === '/healthz') {
    jsonResponse([
        'status' => 'ok',
        'database' => $pdo->getAttribute(PDO::ATTR_DRIVER_NAME),
        'storage_persistent' => $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) !== 'sqlite',
    ]);
}

if ($apiPath === '/portal/logout' && $method === 'POST') {
    $token = bearerToken();
    $pdo->prepare('DELETE FROM portal_sessions WHERE token_hash = ?')
        ->execute([hash('sha256', $token)]);
    if (!empty($portalSession['impersonating'])) {
        $pdo->prepare('INSERT INTO audit_logs (id, user_id, action, details, created_at) VALUES (?, ?, ?, ?, ?)')
            ->execute([
                'aud_' . bin2hex(random_bytes(8)),
                $portalSession['id'],
                'ADMIN_CLIENT_IMPERSONATION_END',
                'Staff session ' . (string)($portalSession['admin_user_id'] ?? 'unknown') . ' ended client portal impersonation.',
                date('c'),
            ]);
    }
    jsonResponse(['ok' => true]);
}

// -----------------------------------------------------------------------------
// 1. PUBLIC WEBSITE CONTENT (Live projects, client reviews, published blogs)
// -----------------------------------------------------------------------------
if ($apiPath === '/public/content' || $apiPath === '/content') {
    $projects = $pdo->query("SELECT * FROM projects WHERE is_published = 1 AND deleted_at IS NULL ORDER BY id DESC")->fetchAll();
    foreach ($projects as &$project) {
        $showcase = json_decode((string)($project['showcase_json'] ?? ''), true);
        if (is_array($showcase)) $project = array_merge($project, $showcase);
        $project['id'] = (int)$project['id'];
        $project['is_published'] = true;
        $project['published'] = true;
        unset($project['showcase_json']);
    }
    unset($project);
    $blogs = $pdo->query("SELECT * FROM blogs WHERE status = 'published' AND deleted_at IS NULL ORDER BY id DESC")->fetchAll();
    $reviews = $pdo->query("SELECT * FROM reviews WHERE is_published = 1 AND deleted_at IS NULL ORDER BY id DESC")->fetchAll();
    jsonResponse([
        'ok' => true,
        'projects' => $projects,
        'blogs' => $blogs,
        'reviews' => $reviews,
    ]);
}

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

function siteContentProjectValues(array $record): array {
    $showcase = $record['showcase'] ?? $record['showcase_json'] ?? null;
    if (is_string($showcase)) $showcase = json_decode($showcase, true);
    if (!is_array($showcase)) $showcase = [];

    $published = array_key_exists('is_published', $record)
        ? !empty($record['is_published'])
        : (($record['published'] ?? true) !== false);
    return [
        trim((string)($record['title'] ?? '')),
        trim((string)($record['site_name'] ?? $record['client'] ?? '')),
        trim((string)($record['site_url'] ?? '')),
        trim((string)($record['description'] ?? $record['detailedDescription'] ?? $record['shortDescription'] ?? '')),
        trim((string)($record['category'] ?? 'Websites & Web Apps')),
        trim((string)($record['image_url'] ?? $record['image'] ?? '')),
        $published ? 1 : 0,
        !empty($showcase) ? json_encode($showcase, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) : null,
    ];
}

function storeSiteContentRecord(PDO $pdo, string $type, array $record, bool $showcaseProject = false): int {
    $id = isset($record['id']) && filter_var($record['id'], FILTER_VALIDATE_INT)
        ? (int)$record['id']
        : 0;
    $now = date('c');

    if ($type === 'project') {
        $values = siteContentProjectValues([
            ...$record,
            ...($showcaseProject ? ['showcase' => $record] : []),
        ]);
        if ($id > 0) {
            $exists = $pdo->prepare('SELECT id FROM projects WHERE id = ?');
            $exists->execute([$id]);
            if (!$exists->fetchColumn()) throw new RuntimeException('Project not found.');
            if ($showcaseProject) {
                $pdo->prepare('UPDATE projects SET title = ?, site_name = ?, site_url = ?, description = ?, category = ?, image_url = ?, is_published = ?, showcase_json = ?, deleted_at = NULL WHERE id = ?')
                    ->execute([...$values, $id]);
            } else {
                $pdo->prepare('UPDATE projects SET title = ?, site_name = ?, site_url = ?, description = ?, category = ?, image_url = ?, is_published = ?, deleted_at = NULL WHERE id = ?')
                    ->execute([...array_slice($values, 0, 7), $id]);
            }
            return $id;
        }
        $pdo->prepare('INSERT INTO projects (title, site_name, site_url, description, category, image_url, is_published, created_at, showcase_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
            ->execute([...array_slice($values, 0, 7), $now, $values[7]]);
        return (int)$pdo->lastInsertId();
    }

    if ($type === 'blog') {
        $title = trim((string)($record['title'] ?? ''));
        if ($title === '') throw new InvalidArgumentException('Blog title is required.');
        $slug = trim((string)($record['slug'] ?? ''));
        if ($slug === '') $slug = strtolower(trim((string)preg_replace('/[^a-zA-Z0-9]+/', '-', $title), '-'));
        $slug = substr($slug, 0, 180);
        $content = (string)($record['content'] ?? '');
        $excerpt = (string)($record['excerpt'] ?? substr(strip_tags($content), 0, 160));
        $category = trim((string)($record['category'] ?? 'Engineering'));
        $status = in_array(($record['status'] ?? 'draft'), ['draft', 'published'], true) ? $record['status'] : 'draft';
        $image = trim((string)($record['featured_image'] ?? $record['image_url'] ?? ''));
        $meta = trim((string)($record['meta_description'] ?? $excerpt));
        $readingTime = max(1, (int)round(str_word_count(strip_tags($content)) / 200));
        $slugCheck = $pdo->prepare('SELECT id FROM blogs WHERE slug = ? AND id <> ? AND deleted_at IS NULL LIMIT 1');
        $slugCheck->execute([$slug, $id]);
        if ($slugCheck->fetchColumn()) throw new InvalidArgumentException('That blog URL is already in use.');
        if ($id > 0) {
            $pdo->prepare('UPDATE blogs SET title = ?, slug = ?, content = ?, excerpt = ?, category = ?, status = ?, featured_image = ?, meta_description = ?, reading_time = ?, updated_at = ?, deleted_at = NULL WHERE id = ?')
                ->execute([$title, $slug, $content, $excerpt, $category, $status, $image, $meta, $readingTime, $now, $id]);
            return $id;
        }
        $pdo->prepare('INSERT INTO blogs (title, slug, content, excerpt, category, author, status, featured_image, meta_description, reading_time, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)')
            ->execute([$title, $slug, $content, $excerpt, $category, trim((string)($record['author'] ?? 'Codex Team')), $status, $image, $meta, $readingTime, $now, $now]);
        return (int)$pdo->lastInsertId();
    }

    if ($type === 'review') {
        $author = trim((string)($record['author'] ?? ''));
        if ($author === '') throw new InvalidArgumentException('Review author is required.');
        $rating = max(1, min(5, (int)($record['rating'] ?? 5)));
        $comment = trim((string)($record['comment'] ?? ''));
        $published = !empty($record['is_published']) ? 1 : 0;
        if ($id > 0) {
            $pdo->prepare('UPDATE reviews SET author = ?, rating = ?, comment = ?, is_published = ?, deleted_at = NULL WHERE id = ?')
                ->execute([$author, $rating, $comment, $published, $id]);
            return $id;
        }
        $pdo->prepare('INSERT INTO reviews (author, rating, comment, is_published, created_at, deleted_at) VALUES (?, ?, ?, ?, ?, NULL)')
            ->execute([$author, $rating, $comment, $published, $now]);
        return (int)$pdo->lastInsertId();
    }

    if ($type === 'backlink') {
        $name = trim((string)($record['name'] ?? ''));
        $url = trim((string)($record['url'] ?? ''));
        if ($name === '' || !filter_var($url, FILTER_VALIDATE_URL)) {
            throw new InvalidArgumentException('Enter a referring site name and a valid URL.');
        }
        $notes = trim((string)($record['notes'] ?? ''));
        if ($id > 0) {
            $pdo->prepare('UPDATE backlinks SET name = ?, url = ?, notes = ?, deleted_at = NULL WHERE id = ?')
                ->execute([$name, $url, $notes, $id]);
            return $id;
        }
        $pdo->prepare('INSERT INTO backlinks (name, url, notes, created_at, deleted_at) VALUES (?, ?, ?, ?, NULL)')
            ->execute([$name, $url, $notes, $now]);
        return (int)$pdo->lastInsertId();
    }

    throw new InvalidArgumentException('Unsupported site content type.');
}

function importLegacySiteEnquiry(PDO $pdo, array $enquiry): ?string {
    $email = strtolower(trim((string)($enquiry['email'] ?? '')));
    $phone = trim((string)($enquiry['phone'] ?? ''));
    if ($email === '' && $phone === '') return null;
    if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL) && $phone === '') return null;

    $matches = [];
    if ($email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $stmt = $pdo->prepare("SELECT id FROM clients WHERE LOWER(TRIM(COALESCE(email, ''))) = ? AND deleted_at IS NULL ORDER BY created_at, id");
        $stmt->execute([$email]);
        $matches = $stmt->fetchAll(PDO::FETCH_COLUMN);
    }
    if (!$matches && $phone !== '') {
        $stmt = $pdo->prepare('SELECT id FROM clients WHERE phone = ? AND deleted_at IS NULL ORDER BY created_at, id');
        $stmt->execute([$phone]);
        $matches = $stmt->fetchAll(PDO::FETCH_COLUMN);
    }
    if (count($matches) > 1) return null;

    $name = trim((string)($enquiry['name'] ?? 'New Client'));
    $parts = preg_split('/\s+/', $name, 2) ?: [];
    $firstName = $parts[0] ?? '';
    $lastName = $parts[1] ?? '';
    $now = trim((string)($enquiry['at'] ?? $enquiry['created_at'] ?? date('c')));
    if (strtotime($now) === false) $now = date('c');
    $clientId = $matches[0] ?? ('cl_' . bin2hex(random_bytes(12)));
    if (!$matches) {
        $pdo->prepare('INSERT INTO clients (id, first_name, last_name, name, email, phone, stage, status, funnel, source, company, service, budget, timeline, message, notes, created_at, updated_at, comment_history, status_history, appointments) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
            ->execute([
                $clientId, $firstName, $lastName, $name, $email, $phone, 'New', 'New',
                (string)($enquiry['service'] ?? 'General Inquiry'), 'website_contact_modal',
                (string)($enquiry['company'] ?? ''), (string)($enquiry['service'] ?? ''),
                (string)($enquiry['budget'] ?? ''), (string)($enquiry['timeline'] ?? ''),
                (string)($enquiry['message'] ?? ''), (string)($enquiry['notes'] ?? ''),
                $now, $now, '[]', '[]', '[]',
            ]);
    } elseif (!empty($enquiry['message'])) {
        $stmt = $pdo->prepare('SELECT comment_history FROM clients WHERE id = ?');
        $stmt->execute([$clientId]);
        $history = json_decode((string)$stmt->fetchColumn(), true);
        if (!is_array($history)) $history = [];
        $legacyId = (string)($enquiry['id'] ?? '');
        if (!$legacyId || !array_filter($history, static fn($item) => ($item['id'] ?? '') === 'legacy_enquiry_' . $legacyId)) {
            $history[] = [
                'id' => 'legacy_enquiry_' . ($legacyId ?: bin2hex(random_bytes(6))),
                'by_name' => 'Website Intake',
                'text' => (string)$enquiry['message'],
                'created_at' => $now,
            ];
            $pdo->prepare('UPDATE clients SET comment_history = ?, updated_at = ? WHERE id = ?')
                ->execute([json_encode($history, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), date('c'), $clientId]);
        }
    }
    return (string)$clientId;
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

// -----------------------------------------------------------------------------
// 3. CRM ACTIONS (Blog save/toggle, Project save/toggle/hide, Image uploads)
// -----------------------------------------------------------------------------
if ($apiPath === '/crm/action') {
    $action = $input['action'] ?? '';

    if ($action === 'save_site_content') {
        $contentAdmin = findSession($pdo, 'admin_sessions', 'user_id');
        requireSuperAdmin($pdo, $contentAdmin);
        $siteConfig = $input['payload']['config'] ?? $input['site_config'] ?? null;
        if (!is_array($siteConfig)) {
            jsonResponse(['ok' => false, 'error' => 'A site configuration object is required.'], 400);
        }
        try {
            $record = savePlatformSettingsRecord($pdo, [], $siteConfig, (string)$contentAdmin['id']);
        } catch (LengthException $error) {
            jsonResponse(['ok' => false, 'error' => $error->getMessage()], 413);
        }
        jsonResponse(['ok' => true, 'site_config' => $record['site_config']]);
    }

    // Upload picture
    if ($action === 'upload_image') {
        $name = preg_replace('/[^a-zA-Z0-9_\.-]/', '_', $input['name'] ?? 'image.png');
        $dataUri = $input['data'] ?? '';
        if (preg_match('/^data:image\/(\w+);base64,/', $dataUri, $matches)) {
            $ext = $matches[1];
            $base64 = substr($dataUri, strpos($dataUri, ',') + 1);
            $decoded = base64_decode($base64);
            $uploadsDir = __DIR__ . '/../uploads';
            if (!is_dir($uploadsDir)) @mkdir($uploadsDir, 0755, true);
            $filename = time() . '_' . $name;
            file_put_contents("{$uploadsDir}/{$filename}", $decoded);
            jsonResponse(['ok' => true, 'url' => "/uploads/{$filename}"]);
        }
        jsonResponse(['ok' => false, 'error' => 'Invalid image payload'], 400);
    }

    // Toggle project visibility (Hide/Show on site)
    if ($action === 'toggle_project') {
        $id = (int)($input['id'] ?? 0);
        $isPublished = !empty($input['is_published']) ? 1 : 0;
        $pdo->prepare("UPDATE projects SET is_published = ? WHERE id = ?")->execute([$isPublished, $id]);
        jsonResponse(['ok' => true, 'id' => $id, 'is_published' => (bool)$isPublished]);
    }

    // Save project
    if ($action === 'save_project') {
        $title = trim($input['title'] ?? '');
        $siteName = trim($input['site_name'] ?? '');
        $siteUrl = trim($input['site_url'] ?? '');
        $desc = trim($input['description'] ?? '');
        $cat = trim($input['category'] ?? 'Websites & Web Apps');
        $img = trim($input['image_url'] ?? '');
        $pub = isset($input['is_published']) ? ($input['is_published'] ? 1 : 0) : 1;
        $now = date('c');

        $stmt = $pdo->prepare("
            INSERT INTO projects (title, site_name, site_url, description, category, image_url, is_published, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([$title, $siteName, $siteUrl, $desc, $cat, $img, $pub, $now]);
        jsonResponse(['ok' => true, 'id' => (int)$pdo->lastInsertId()]);
    }

    // Delete project
    if ($action === 'delete_project') {
        $id = (int)($input['id'] ?? 0);
        $pdo->prepare("DELETE FROM projects WHERE id = ?")->execute([$id]);
        jsonResponse(['ok' => true]);
    }

    // Save blog post (WordPress-like)
    if ($action === 'save_blog' || $action === 'update_blog') {
        $title = trim($input['title'] ?? 'Untitled Article');
        $slug = trim($input['slug'] ?? strtolower(preg_replace('/[^a-zA-Z0-9]+/', '-', $title)));
        $content = $input['content'] ?? '';
        $excerpt = $input['excerpt'] ?? substr(strip_tags($content), 0, 160);
        $category = $input['category'] ?? 'Engineering';
        $status = $input['status'] ?? 'published';
        $img = $input['featured_image'] ?? '';
        $meta = $input['meta_description'] ?? $excerpt;
        $readingTime = max(1, (int)round(str_word_count(strip_tags($content)) / 200));
        $now = date('c');

        if (!empty($input['id'])) {
            $stmt = $pdo->prepare("
                UPDATE blogs
                SET title = ?, slug = ?, content = ?, excerpt = ?, category = ?, status = ?, featured_image = ?, meta_description = ?, reading_time = ?, updated_at = ?
                WHERE id = ?
            ");
            $stmt->execute([$title, $slug, $content, $excerpt, $category, $status, $img, $meta, $readingTime, $now, (int)$input['id']]);
            jsonResponse(['ok' => true, 'id' => (int)$input['id']]);
        } else {
            $stmt = $pdo->prepare("
                INSERT INTO blogs (title, slug, content, excerpt, category, author, status, featured_image, meta_description, reading_time, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, 'Codex Team', ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([$title, $slug, $content, $excerpt, $category, $status, $img, $meta, $readingTime, $now, $now]);
            jsonResponse(['ok' => true, 'id' => (int)$pdo->lastInsertId()]);
        }
    }

    // Delete blog post
    if ($action === 'delete_blog') {
        $id = (int)($input['id'] ?? 0);
        $pdo->prepare("DELETE FROM blogs WHERE id = ?")->execute([$id]);
        jsonResponse(['ok' => true]);
    }

    jsonResponse(['ok' => false, 'error' => 'Unknown CRM action.'], 400);
}

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
        'buttonColor', 'backgroundColor', 'textColor', 'customThemes',
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
        if (!in_array($key, [
            'registrationEnabled', 'twoFactorAuthEnabled',
            'sessionTimeoutMinutes', 'maxFailedLoginAttempts', 'customThemes',
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

// -----------------------------------------------------------------------------
// 6. ADMIN: NOTIFICATIONS (Send to client or all clients, Sent Log)
// -----------------------------------------------------------------------------
function createAdminNotification(PDO $pdo, string $staffId, string $kind, string $title, string $body): void {
    $pdo->prepare('INSERT INTO admin_notifications (id, staff_user_id, kind, title, body, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        ->execute([
            'an_' . bin2hex(random_bytes(12)),
            $staffId,
            $kind,
            substr($title, 0, 255),
            substr($body, 0, 2000),
            date('c'),
        ]);
}

if ($apiPath === '/admin/notifications') {
    $actor = requireAdminCapability($pdo, $adminSession, 'notifications');
    if ($method !== 'GET') jsonResponse(['ok' => false, 'error' => 'Method not allowed.'], 405);
    $limit = max(1, min(100, (int)($_GET['limit'] ?? 50)));
    $onlyUnread = filter_var($_GET['only_unread'] ?? false, FILTER_VALIDATE_BOOLEAN);
    $where = 'staff_user_id = ?' . ($onlyUnread ? ' AND read_at IS NULL' : '');
    $count = $pdo->prepare("SELECT COUNT(*) FROM admin_notifications WHERE {$where}");
    $count->execute([$actor['id']]);
    $total = (int)$count->fetchColumn();
    $stmt = $pdo->prepare("SELECT id, kind, title, body, read_at, created_at
        FROM admin_notifications WHERE {$where} ORDER BY created_at DESC LIMIT ?");
    $stmt->bindValue(1, $actor['id']);
    if ($onlyUnread) {
        $stmt->bindValue(2, $limit, PDO::PARAM_INT);
    } else {
        $stmt->bindValue(2, $limit, PDO::PARAM_INT);
    }
    $stmt->execute();
    $rows = $stmt->fetchAll();
    $unread = $pdo->prepare('SELECT COUNT(*) FROM admin_notifications WHERE staff_user_id = ? AND read_at IS NULL');
    $unread->execute([$actor['id']]);
    jsonResponse([
        'ok' => true,
        'notifications' => $rows,
        'unread_count' => (int)$unread->fetchColumn(),
        'has_more' => $total > count($rows),
    ]);
}

if ($apiPath === '/admin/notifications/read-all' && $method === 'POST') {
    $actor = requireAdminCapability($pdo, $adminSession, 'notifications');
    $stmt = $pdo->prepare('UPDATE admin_notifications SET read_at = ? WHERE staff_user_id = ? AND read_at IS NULL');
    $stmt->execute([date('c'), $actor['id']]);
    jsonResponse(['ok' => true, 'updated' => $stmt->rowCount()]);
}

if ($apiPath === '/admin/notifications/clear' && $method === 'DELETE') {
    $actor = requireAdminCapability($pdo, $adminSession, 'notifications');
    $stmt = $pdo->prepare('DELETE FROM admin_notifications WHERE staff_user_id = ?');
    $stmt->execute([$actor['id']]);
    jsonResponse(['ok' => true, 'deleted' => $stmt->rowCount()]);
}

if (preg_match('#^/admin/notifications/([^/]+)(?:/(read))?$#', $apiPath, $notificationMatch)) {
    $actor = requireAdminCapability($pdo, $adminSession, 'notifications');
    $notificationId = rawurldecode($notificationMatch[1]);
    if (($notificationMatch[2] ?? '') === 'read' && $method === 'POST') {
        $stmt = $pdo->prepare('UPDATE admin_notifications SET read_at = ? WHERE id = ? AND staff_user_id = ?');
        $stmt->execute([date('c'), $notificationId, $actor['id']]);
        if ($stmt->rowCount() === 0) {
            $exists = $pdo->prepare('SELECT id FROM admin_notifications WHERE id = ? AND staff_user_id = ?');
            $exists->execute([$notificationId, $actor['id']]);
            if (!$exists->fetchColumn()) jsonResponse(['ok' => false, 'error' => 'Notification not found.'], 404);
        }
        jsonResponse(['ok' => true]);
    }
    if (($notificationMatch[2] ?? '') === '' && $method === 'DELETE') {
        $stmt = $pdo->prepare('DELETE FROM admin_notifications WHERE id = ? AND staff_user_id = ?');
        $stmt->execute([$notificationId, $actor['id']]);
        if ($stmt->rowCount() === 0) jsonResponse(['ok' => false, 'error' => 'Notification not found.'], 404);
        jsonResponse(['ok' => true]);
    }
}

if ($apiPath === '/admin/notifications/send') {
    $actor = requireAdminCapability($pdo, $adminSession, 'notifications');
    $userId = $input['user_id'] ?? null;
    $message = trim($input['message'] ?? '');
    $kind = $input['kind'] ?? 'info';
    $title = trim($input['title'] ?? 'Administrator Notice');
    $now = date('c');

    if ($userId) {
        $userId = trim((string)$userId);
        requireVisibleLead($pdo, $actor, $userId);
    } elseif ($actor['role'] !== 'Super Admin') {
        jsonResponse(['ok' => false, 'error' => 'Only a Super Admin can send a notice to all clients.'], 403);
    }
    if (!$message) {
        jsonResponse(['ok' => false, 'error' => 'Notification message required'], 400);
    }

    $id = 'notif_' . time() . '_' . substr(bin2hex(random_bytes(2)), 0, 4);
    $stmt = $pdo->prepare("
        INSERT INTO notifications (id, user_id, title, description, kind, is_read, link, sent_by, created_at)
        VALUES (?, ?, ?, ?, ?, 0, '/portal/notifications', 'Admin', ?)
    ");
    $stmt->execute([$id, $userId, $title, $message, $kind, $now]);

    jsonResponse(['ok' => true, 'id' => $id, 'sent' => 1]);
}

if ($apiPath === '/client/notifications' || $apiPath === '/portal/notifications') {
    $clientId = $portalSession['id'];
    if ($method === 'POST') {
        $now = date('c');
        if (($input['action'] ?? '') === 'mark_all_read') {
            $stmt = $pdo->prepare("SELECT id FROM notifications WHERE user_id = ? OR user_id IS NULL OR user_id = ''");
            $stmt->execute([$clientId]);
            foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) as $notificationId) {
                $update = $pdo->prepare("UPDATE user_notification_reads SET read_at = ? WHERE user_id = ? AND notification_id = ?");
                $update->execute([$now, $clientId, $notificationId]);
                if ($update->rowCount() === 0) {
                    $pdo->prepare("INSERT INTO user_notification_reads (user_id, notification_id, read_at) VALUES (?, ?, ?)")
                        ->execute([$clientId, $notificationId, $now]);
                }
            }
        } elseif (!empty($input['id'])) {
            $notificationId = trim((string)$input['id']);
            $update = $pdo->prepare("UPDATE user_notification_reads SET read_at = ? WHERE user_id = ? AND notification_id = ?");
            $update->execute([$now, $clientId, $notificationId]);
            if ($update->rowCount() === 0) {
                $pdo->prepare("INSERT INTO user_notification_reads (user_id, notification_id, read_at) VALUES (?, ?, ?)")
                    ->execute([$clientId, $notificationId, $now]);
            }
        } else {
            jsonResponse(['ok' => false, 'error' => 'Notification action is required.'], 400);
        }
        jsonResponse(['ok' => true]);
    }
    if ($method !== 'GET') jsonResponse(['ok' => false, 'error' => 'Method not allowed.'], 405);
    $stmt = $pdo->prepare("
        SELECT n.*, CASE WHEN r.notification_id IS NOT NULL THEN 1 ELSE n.is_read END AS is_read
        FROM notifications n
        LEFT JOIN user_notification_reads r ON r.notification_id = n.id AND r.user_id = ?
        WHERE n.user_id = ? OR n.user_id IS NULL OR n.user_id = ''
        ORDER BY n.created_at DESC LIMIT 100
    ");
    $stmt->execute([$clientId, $clientId]);
    $logs = $stmt->fetchAll();
    jsonResponse(['ok' => true, 'notifications' => $logs, 'total' => count($logs)]);
}

if ($apiPath === '/admin/notifications/sent-log') {
    $actor = requireAdminCapability($pdo, $adminSession, 'notifications');
    if ($method === 'DELETE') {
        if ($actor['role'] !== 'Super Admin') jsonResponse(['ok' => false, 'error' => 'Only a Super Admin can clear the sent log.'], 403);
        $pdo->exec("DELETE FROM notifications");
        jsonResponse(['ok' => true]);
    }
    $userId = $_GET['user_id'] ?? $_GET['userId'] ?? null;
    if ($userId) {
        requireVisibleLead($pdo, $actor, (string)$userId);
        $stmt = $pdo->prepare("SELECT * FROM notifications WHERE user_id = ? OR user_id IS NULL OR user_id = '' ORDER BY created_at DESC LIMIT 100");
        $stmt->execute([$userId]);
        $logs = $stmt->fetchAll();
    } else {
        if ($actor['role'] !== 'Super Admin') jsonResponse(['ok' => false, 'error' => 'Only a Super Admin can view the complete sent log.'], 403);
        $logs = $pdo->query("SELECT * FROM notifications ORDER BY created_at DESC LIMIT 100")->fetchAll();
    }
    jsonResponse(['ok' => true, 'notifications' => $logs, 'log' => $logs, 'total' => count($logs)]);
}

if (preg_match('#^/admin/notifications/sent-log/([^/]+)$#', $apiPath, $sentNotificationMatch) && $method === 'DELETE') {
    $actor = requireAdminCapability($pdo, $adminSession, 'notifications');
    if ($actor['role'] !== 'Super Admin') jsonResponse(['ok' => false, 'error' => 'Only a Super Admin can delete sent-log records.'], 403);
    $stmt = $pdo->prepare('DELETE FROM notifications WHERE id = ?');
    $stmt->execute([rawurldecode($sentNotificationMatch[1])]);
    jsonResponse(['ok' => true, 'deleted' => $stmt->rowCount()]);
}

// -----------------------------------------------------------------------------
// 7. ADMIN <-> CLIENT SUPPORT CHAT
// -----------------------------------------------------------------------------
if ($apiPath === '/admin/messages/unread_counts') {
    $actor = requireAdminCapability($pdo, $adminSession, 'chat');
    $scope = buildAdminLeadScope($actor['role'], $actor['office_id'], $actor['team_id'], $actor['id']);
    [$scopeSql, $scopeParams] = $scope;
    $stmt = $pdo->prepare("SELECT m.user_id, COUNT(*) AS unread_count
        FROM messages m INNER JOIN leads l ON l.id = m.user_id
        WHERE m.sender = 'client' AND m.is_read = 0 AND l.deleted_at IS NULL AND ({$scopeSql})
        GROUP BY m.user_id");
    $stmt->execute($scopeParams);
    $counts = [];
    $total = 0;
    foreach ($stmt->fetchAll() as $row) {
        $counts[$row['user_id']] = (int)$row['unread_count'];
        $total += (int)$row['unread_count'];
    }
    jsonResponse(['ok' => true, 'counts' => $counts, 'total' => $total]);
}

if ($apiPath === '/admin/presence' && $method === 'POST') {
    $actor = requireActiveAdminStaff($pdo, $adminSession);
    $stmt = $pdo->prepare('UPDATE admin_sessions SET last_seen_at = ? WHERE token_hash = ? AND user_id = ?');
    $now = date('c');
    $stmt->execute([$now, $adminSession['token_hash'], $actor['id']]);
    jsonResponse(['ok' => true, 'staff_id' => $actor['id'], 'last_seen_at' => $now]);
}

if ($apiPath === '/admin/messages/presence' || $apiPath === '/portal/messages/presence') {
    $isAdminPresence = $apiPath === '/admin/messages/presence';
    $clientId = $isAdminPresence
        ? trim((string)($_GET['user_id'] ?? $input['user_id'] ?? ''))
        : (string)$portalSession['id'];
    if ($isAdminPresence) {
        $actor = requireAdminCapability($pdo, $adminSession, 'chat');
        if ($clientId === '') jsonResponse(['ok' => false, 'error' => 'user_id is required.'], 400);
        requireVisibleLead($pdo, $actor, $clientId);
        $actorType = 'staff';
        $actorId = $actor['id'];
    } else {
        $actorType = 'client';
        $actorId = $clientId;
    }

    if ($method === 'POST') {
        $typing = $isAdminPresence
            ? !empty($input['is_typing'])
            : !empty($input['is_typing']);
        $now = date('c');
        $exists = $pdo->prepare('SELECT 1 FROM crm_message_presence WHERE client_id = ? AND actor_type = ? AND actor_id = ?');
        $exists->execute([$clientId, $actorType, $actorId]);
        if ($exists->fetchColumn()) {
            $pdo->prepare('UPDATE crm_message_presence SET is_typing = ?, last_seen_at = ? WHERE client_id = ? AND actor_type = ? AND actor_id = ?')
                ->execute([$typing ? 1 : 0, $now, $clientId, $actorType, $actorId]);
        } else {
            $pdo->prepare('INSERT INTO crm_message_presence (client_id, actor_type, actor_id, is_typing, last_seen_at) VALUES (?, ?, ?, ?, ?)')
                ->execute([$clientId, $actorType, $actorId, $typing ? 1 : 0, $now]);
        }
        jsonResponse(['ok' => true, 'last_seen_at' => $now]);
    }

    if ($method !== 'GET') jsonResponse(['ok' => false, 'error' => 'Method not allowed.'], 405);
    $cutoff = date('c', time() - 15);
    $presenceStmt = $pdo->prepare('SELECT actor_type, actor_id, is_typing, last_seen_at FROM crm_message_presence WHERE client_id = ? AND last_seen_at >= ?');
    $presenceStmt->execute([$clientId, $cutoff]);
    $presence = ['client_typing' => false, 'staff_typing' => false, 'staff_online' => false];
    foreach ($presenceStmt->fetchAll() as $row) {
        if ($row['actor_type'] === 'client' && (int)$row['is_typing'] === 1) $presence['client_typing'] = true;
        if ($row['actor_type'] === 'staff') {
            $presence['staff_online'] = true;
            if ((int)$row['is_typing'] === 1) $presence['staff_typing'] = true;
        }
    }
    jsonResponse(['ok' => true, 'presence' => $presence]);
}

if (($apiPath === '/admin/messages' || $apiPath === '/client/messages')
    && in_array($method, ['GET', 'POST'], true)) {
    $isClientMessageRoute = $apiPath === '/client/messages';
    $actor = $isClientMessageRoute ? null : requireAdminCapability($pdo, $adminSession, 'chat');
    if ($method === 'POST') {
        $userId = $isClientMessageRoute ? $portalSession['id'] : trim($input['user_id'] ?? $input['userId'] ?? '');
        $body = trim($input['body'] ?? $input['text'] ?? '');
        $sender = $isClientMessageRoute ? 'client' : 'agent';
        $senderName = $isClientMessageRoute ? 'Client' : ($actor['name'] ?? 'Support Agent');

        if (!$userId || !$body) {
            jsonResponse(['ok' => false, 'error' => 'user_id and body required'], 400);
        }
        if (strlen($body) > 5000) jsonResponse(['ok' => false, 'error' => 'Messages cannot exceed 5,000 characters.'], 422);
        $lead = null;
        if (!$isClientMessageRoute) {
            $lead = requireVisibleLead($pdo, $actor, $userId);
        }

        $msgId = 'msg_' . bin2hex(random_bytes(12));
        $now = date('c');
        $stmt = $pdo->prepare("
            INSERT INTO messages (id, user_id, sender, sender_name, body, is_read, created_at)
            VALUES (?, ?, ?, ?, ?, 0, ?)
        ");
        $stmt->execute([$msgId, $userId, $sender, $senderName, $body, $now]);

        $action = $sender === 'client' ? 'SUPPORT_MESSAGE_RECEIVED' : 'SUPPORT_MESSAGE_SENT';
        $details = $sender === 'client' ? 'Client sent a support message.' : 'Staff sent a support message.';
        $auditId = 'aud_' . bin2hex(random_bytes(8));
        $pdo->prepare("INSERT INTO audit_logs (id, user_id, action, details, created_at) VALUES (?, ?, ?, ?, ?)")
            ->execute([$auditId, $userId, $action, $details, $now]);

        if ($isClientMessageRoute) {
            $leadStmt = $pdo->prepare('SELECT assigned_agent_id, assigned_team_leader_id, assigned_office_id FROM leads WHERE id = ? AND deleted_at IS NULL');
            $leadStmt->execute([$userId]);
            $lead = $leadStmt->fetch() ?: null;
            $recipientIds = array_values(array_unique(array_filter([
                $lead['assigned_agent_id'] ?? null,
                $lead['assigned_team_leader_id'] ?? null,
            ])));
            if (!$recipientIds && !empty($lead['assigned_office_id'])) {
                $managerStmt = $pdo->prepare("SELECT id FROM staff_users WHERE office_id = ? AND role = 'Office Manager' AND status = 'Active' AND deleted_at IS NULL");
                $managerStmt->execute([$lead['assigned_office_id']]);
                $recipientIds = $managerStmt->fetchAll(PDO::FETCH_COLUMN);
            }
            foreach ($recipientIds as $recipientId) {
                $activeStmt = $pdo->prepare("SELECT id FROM staff_users WHERE id = ? AND status = 'Active' AND deleted_at IS NULL");
                $activeStmt->execute([$recipientId]);
                if ($activeStmt->fetchColumn()) {
                    createAdminNotification($pdo, (string)$recipientId, 'client_message', 'New client message', substr($body, 0, 240));
                }
            }
        }

        jsonResponse([
            'ok' => true,
            'message' => [
                'id' => $msgId,
                'user_id' => $userId,
                'sender' => $sender,
                'sender_name' => $senderName,
                'body' => $body,
                'created_at' => $now,
                'agent_id' => $isClientMessageRoute ? null : $actor['id'],
            ]
        ]);
    }

    $userId = $isClientMessageRoute ? $portalSession['id'] : trim($_GET['user_id'] ?? '');
    if (!$userId) {
        jsonResponse(['ok' => true, 'messages' => [], 'unread_count' => 0]);
    }
    if (!$isClientMessageRoute) {
        $lead = requireVisibleLead($pdo, $actor, $userId);
    }
    $limit = max(1, min(200, (int)($_GET['limit'] ?? 100)));
    $before = trim((string)($_GET['before'] ?? ''));
    $where = 'user_id = ?';
    $params = [$userId];
    if ($before !== '') {
        $where .= ' AND created_at < ?';
        $params[] = $before;
    }
    $params[] = $limit + 1;
    $stmt = $pdo->prepare("SELECT * FROM messages WHERE {$where} ORDER BY created_at DESC LIMIT ?");
    $stmt->execute($params);
    $msgs = $stmt->fetchAll();
    $hasMore = count($msgs) > $limit;
    if ($hasMore) array_pop($msgs);
    $msgs = array_reverse($msgs);
    $unreadQuery = $pdo->prepare("SELECT COUNT(*) FROM messages WHERE user_id = ? AND sender = ? AND is_read = 0");
    $unreadQuery->execute([$userId, $isClientMessageRoute ? 'agent' : 'client']);
    $unreadCount = (int)$unreadQuery->fetchColumn();

    jsonResponse([
        'ok' => true,
        'user' => $isClientMessageRoute
            ? ['id' => $userId]
            : ['id' => $userId, 'name' => $lead['name'] ?? '', 'email' => $lead['email'] ?? '', 'company' => $lead['company'] ?? ''],
        'messages' => $msgs,
        'unread_count' => $unreadCount,
        'has_more' => $hasMore,
    ]);
}

if ($apiPath === '/admin/messages/read' && $method === 'POST') {
    $actor = requireAdminCapability($pdo, $adminSession, 'chat');
    $userId = trim($input['user_id'] ?? '');
    if (!$userId) jsonResponse(['ok' => false, 'error' => 'user_id is required.'], 400);
    requireVisibleLead($pdo, $actor, $userId);
    $stmt = $pdo->prepare("UPDATE messages SET is_read = 1 WHERE user_id = ? AND sender = 'client' AND is_read = 0");
    $stmt->execute([$userId]);
    jsonResponse(['ok' => true, 'marked' => $stmt->rowCount()]);
}

if (($apiPath === '/admin/messages/clear' && $method === 'POST')
    || ($apiPath === '/admin/messages' && $method === 'DELETE')) {
    $actor = requireAdminCapability($pdo, $adminSession, 'chat');
    $userId = trim((string)($_GET['user_id'] ?? $input['user_id'] ?? ''));
    if (!$userId) jsonResponse(['ok' => false, 'error' => 'user_id is required.'], 400);
    requireVisibleLead($pdo, $actor, $userId);
    $stmt = $pdo->prepare('DELETE FROM messages WHERE user_id = ?');
    $stmt->execute([$userId]);
    jsonResponse(['ok' => true, 'deleted' => $stmt->rowCount()]);
}

if (preg_match('#^/admin/messages/([^/]+)/attachment$#', $apiPath, $attachmentMatch) && $method === 'GET') {
    $actor = requireAdminCapability($pdo, $adminSession, 'chat');
    $messageStmt = $pdo->prepare('SELECT * FROM messages WHERE id = ?');
    $messageStmt->execute([rawurldecode($attachmentMatch[1])]);
    $message = $messageStmt->fetch();
    if (!$message || empty($message['attachment_path'])) jsonResponse(['ok' => false, 'error' => 'Attachment not found.'], 404);
    requireVisibleLead($pdo, $actor, (string)$message['user_id']);

    $relativePath = str_replace('\\', '/', (string)$message['attachment_path']);
    $relativePath = ltrim($relativePath, '/');
    if (!str_starts_with($relativePath, 'uploads/messages/')) {
        jsonResponse(['ok' => false, 'error' => 'Attachment path is not valid.'], 404);
    }
    $storageRoot = realpath(dirname(__DIR__) . '/uploads/messages');
    $filePath = realpath(dirname(__DIR__) . '/' . $relativePath);
    if (!$storageRoot || !$filePath || !is_file($filePath) || !str_starts_with($filePath, $storageRoot . DIRECTORY_SEPARATOR)) {
        jsonResponse(['ok' => false, 'error' => 'Attachment file is unavailable.'], 404);
    }
    $mime = function_exists('mime_content_type') ? (mime_content_type($filePath) ?: 'application/octet-stream') : 'application/octet-stream';
    $filename = preg_replace('/[^A-Za-z0-9._ -]/', '_', basename((string)($message['attachment_name'] ?? 'Attachment'))) ?: 'Attachment';
    $inline = in_array(strtolower($mime), ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf'], true);
    header('Content-Type: ' . $mime);
    header('Content-Length: ' . (string)filesize($filePath));
    header('X-Content-Type-Options: nosniff');
    header('Cache-Control: private, no-store');
    header('Content-Disposition: ' . ($inline ? 'inline' : 'attachment') . '; filename="' . addcslashes($filename, '"\\') . '"');
    readfile($filePath);
    exit;
}

if (preg_match('#^/admin/messages/([^/]+)$#', $apiPath, $messageMatch) && $method === 'DELETE') {
    $actor = requireAdminCapability($pdo, $adminSession, 'chat');
    $messageStmt = $pdo->prepare('SELECT id, user_id FROM messages WHERE id = ?');
    $messageStmt->execute([rawurldecode($messageMatch[1])]);
    $message = $messageStmt->fetch();
    if (!$message) jsonResponse(['ok' => false, 'error' => 'Message not found.'], 404);
    requireVisibleLead($pdo, $actor, (string)$message['user_id']);
    $pdo->prepare('DELETE FROM messages WHERE id = ?')->execute([$message['id']]);
    jsonResponse(['ok' => true]);
}

// -----------------------------------------------------------------------------
// 8. CLIENT ACTIVITY / AUDIT LOG
// -----------------------------------------------------------------------------
if ($apiPath === '/admin/audit' || preg_match('#^/admin/users/([^/]+)/profile-history#', $apiPath, $m)) {
    $userId = $m[1] ?? ($_GET['user_id'] ?? null);
    if ($userId) {
        $stmt = $pdo->prepare("SELECT * FROM audit_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 50");
        $stmt->execute([$userId]);
        $rows = $stmt->fetchAll();
    } else {
        $rows = $pdo->query("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100")->fetchAll();
    }
    jsonResponse(['ok' => true, 'log' => $rows, 'history' => $rows, 'total' => count($rows)]);
}

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
    $token = bearerToken();
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

// -----------------------------------------------------------------------------
// 15. CLIENT PORTAL: COMPLETE DASHBOARD DATA
// -----------------------------------------------------------------------------
if ($apiPath === '/portal/access' && $method === 'GET') {
    header('Cache-Control: no-store, private');
    header('Pragma: no-cache');
    $clientId = trim((string)($_GET['client_id'] ?? $portalSession['id']));
    if ($clientId === '') jsonResponse(['ok' => false, 'error' => 'Missing client account.'], 400);
    if (empty($portalSession['impersonating']) && $clientId !== $portalSession['id']) jsonResponse(['ok' => false, 'error' => 'Forbidden.'], 403);
    $stmt = $pdo->prepare('SELECT * FROM client_access_credentials WHERE client_id = ?');
    $stmt->execute([$clientId]);
    $access = $stmt->fetch();
    if (!$access) jsonResponse(['ok' => true, 'access' => null]);
    try {
        jsonResponse(['ok' => true, 'access' => [
            'websiteUrl' => $access['website_url'] ?? '',
            'websiteUsername' => $access['website_username'] ?? '',
            'websitePassword' => decryptClientSecret($access['website_password_enc'] ?? ''),
            'emailAddress' => $access['email_address'] ?? '',
            'webmailUrl' => $access['webmail_url'] ?? '',
            'emailPassword' => decryptClientSecret($access['email_password_enc'] ?? ''),
        ]]);
    } catch (Throwable $error) {
        error_log('[portal/access] Credential decryption failed: ' . $error->getMessage());
        jsonResponse(['ok' => false, 'error' => 'Saved access details cannot be opened. Ask your administrator to check the credential encryption setup.'], 503);
    }
}

if ($apiPath === '/portal/mail' && $method === 'GET') {
    header('Cache-Control: no-store, private');
    header('Pragma: no-cache');
    $clientId = trim((string)($_GET['client_id'] ?? $portalSession['id']));
    if ($clientId === '') jsonResponse(['ok' => false, 'error' => 'Missing client account.'], 400);
    if (empty($portalSession['impersonating']) && $clientId !== $portalSession['id']) jsonResponse(['ok' => false, 'error' => 'Forbidden.'], 403);
    $stmt = $pdo->prepare('SELECT * FROM client_access_credentials WHERE client_id = ?');
    $stmt->execute([$clientId]);
    $access = $stmt->fetch();
    if (!$access || empty($access['email_address']) || empty($access['email_password_enc'])) {
        jsonResponse(['ok' => false, 'error' => 'Email access has not been configured for this client yet.'], 409);
    }
    $host = trim((string)($access['imap_host'] ?? ''));
    $port = (int)($access['imap_port'] ?? 993);
    if (!preg_match('/^[A-Za-z0-9.-]+$/', $host) || $port < 1 || $port > 65535) jsonResponse(['ok' => false, 'error' => 'Incoming email server settings are invalid.'], 503);
    try {
        $password = decryptClientSecret($access['email_password_enc']);
    } catch (Throwable $error) {
        error_log('[portal/mail] Credential decryption failed: ' . $error->getMessage());
        jsonResponse(['ok' => false, 'error' => 'The email password could not be opened. Ask your administrator to check the encryption setup.'], 503);
    }
    if (!function_exists('imap_open')) jsonResponse(['ok' => false, 'error' => 'The server is missing the PHP IMAP extension required for in-app email.'], 503);
    $tlsMode = $port === 143 ? '/imap/tls' : '/imap/ssl';
    $mailbox = @imap_open('{' . $host . ':' . $port . $tlsMode . '}INBOX', (string)$access['email_address'], $password, OP_READONLY, 1, ['DISABLE_AUTHENTICATOR' => 'GSSAPI']);
    if (!$mailbox) {
        error_log('[portal/mail] IMAP connection failed: ' . (string)imap_last_error());
        jsonResponse(['ok' => false, 'error' => 'Could not connect to this mailbox. Check the email login and incoming server settings with your administrator.'], 502);
    }
    try {
        $uid = (int)($_GET['uid'] ?? 0);
        if ($uid > 0) {
            $messageNumber = imap_msgno($mailbox, $uid);
            if ($messageNumber < 1) jsonResponse(['ok' => false, 'error' => 'That email is no longer in the inbox. Refresh the list.'], 404);
            $overview = imap_fetch_overview($mailbox, (string)$messageNumber, 0);
            $item = $overview[0] ?? null;
            if (!$item) jsonResponse(['ok' => false, 'error' => 'Could not load this email.'], 502);
            $messageId = trim((string)($item->message_id ?? ''), "<> \t\n\r\0\x0B");
            jsonResponse(['ok' => true, 'email' => [
                'uid' => $uid,
                'from' => decodeImapHeader((string)($item->from ?? '')),
                'to' => decodeImapHeader((string)($item->to ?? '')),
                'subject' => decodeImapHeader((string)($item->subject ?? '(No subject)')),
                'date' => (string)($item->date ?? ''),
                'messageId' => $messageId,
                'body' => readImapMessageText($mailbox, $messageNumber),
            ]]);
        }
        $messageNumbers = imap_search($mailbox, 'ALL') ?: [];
        rsort($messageNumbers, SORT_NUMERIC);
        $messages = [];
        foreach (array_slice($messageNumbers, 0, 40) as $messageNumber) {
            $overview = imap_fetch_overview($mailbox, (string)$messageNumber, 0);
            if (!$overview || !isset($overview[0])) continue;
            $item = $overview[0];
            $messages[] = [
                'uid' => (int)imap_uid($mailbox, (int)$messageNumber),
                'from' => decodeImapHeader((string)($item->from ?? '')),
                'subject' => decodeImapHeader((string)($item->subject ?? '(No subject)')),
                'date' => (string)($item->date ?? ''),
                'seen' => !empty($item->seen),
            ];
        }
        jsonResponse(['ok' => true, 'address' => $access['email_address'], 'messages' => $messages]);
    } catch (Throwable $error) {
        error_log('[portal/mail] Inbox read failed: ' . $error->getMessage());
        jsonResponse(['ok' => false, 'error' => 'Could not read this mailbox right now. Try again or check the IMAP settings.'], 502);
    } finally {
        imap_close($mailbox);
    }
}

if ($apiPath === '/portal/mail/reply' && $method === 'POST') {
    header('Cache-Control: no-store, private');
    header('Pragma: no-cache');
    if (!empty($portalSession['impersonating'])) jsonResponse(['ok' => false, 'error' => 'Replies can only be sent from the client’s own sign-in.'], 403);
    $clientId = $portalSession['id'];
    $uid = (int)($input['uid'] ?? 0);
    $body = trim((string)($input['body'] ?? ''));
    if ($uid < 1 || $body === '') jsonResponse(['ok' => false, 'error' => 'Choose an email and write a reply first.'], 422);
    $stmt = $pdo->prepare('SELECT * FROM client_access_credentials WHERE client_id = ?');
    $stmt->execute([$clientId]);
    $access = $stmt->fetch();
    if (!$access || empty($access['email_address']) || empty($access['email_password_enc'])) jsonResponse(['ok' => false, 'error' => 'Email access has not been configured for this client yet.'], 409);
    if (!function_exists('imap_open')) jsonResponse(['ok' => false, 'error' => 'The server is missing the PHP IMAP extension required for in-app email.'], 503);
    $host = trim((string)($access['imap_host'] ?? ''));
    $port = (int)($access['imap_port'] ?? 993);
    if (!preg_match('/^[A-Za-z0-9.-]+$/', $host) || $port < 1 || $port > 65535) jsonResponse(['ok' => false, 'error' => 'Incoming email server settings are invalid.'], 503);
    $tlsMode = $port === 143 ? '/imap/tls' : '/imap/ssl';
    $mailbox = @imap_open('{' . $host . ':' . $port . $tlsMode . '}INBOX', (string)$access['email_address'], decryptClientSecret($access['email_password_enc']), OP_READONLY, 1, ['DISABLE_AUTHENTICATOR' => 'GSSAPI']);
    if (!$mailbox) jsonResponse(['ok' => false, 'error' => 'Could not connect to this mailbox to prepare the reply.'], 502);
    try {
        $messageNumber = imap_msgno($mailbox, $uid);
        if ($messageNumber < 1) jsonResponse(['ok' => false, 'error' => 'The original email could not be found.'], 404);
        $overview = imap_fetch_overview($mailbox, (string)$messageNumber, 0);
        $item = $overview[0] ?? null;
        if (!$item) jsonResponse(['ok' => false, 'error' => 'Could not read the original email.'], 502);
        $from = imap_rfc822_parse_adrlist((string)($item->from ?? ''), '');
        $recipient = isset($from[0]) ? strtolower((string)($from[0]->mailbox ?? '') . '@' . (string)($from[0]->host ?? '')) : '';
        $subject = decodeImapHeader((string)($item->subject ?? ''));
        $messageId = trim((string)($item->message_id ?? ''), "<> \t\n\r\0\x0B");
        sendClientMailboxReply($access, $recipient, $subject, $body, $messageId);
        jsonResponse(['ok' => true, 'sent' => true]);
    } catch (Throwable $error) {
        error_log('[portal/mail] Reply failed: ' . $error->getMessage());
        jsonResponse(['ok' => false, 'error' => $error->getMessage()], 502);
    } finally {
        imap_close($mailbox);
    }
}

if ($apiPath === '/portal/data') {
    $clientId = $_GET['client_id'] ?? '';
    if (!$clientId) {
        jsonResponse(['error' => 'Missing client_id parameter'], 400);
    }
    if (empty($portalSession['impersonating']) && $clientId !== $portalSession['id']) jsonResponse(['ok' => false, 'error' => 'Forbidden.'], 403);

    $stmtC = $pdo->prepare("SELECT c.id, c.name, c.company, c.email, c.phone, c.address, c.country, c.country_code,
            a.status, a.portal_enabled, a.tier, a.last_login_at, c.created_at
        FROM clients c JOIN client_portal_access a ON a.client_id = c.id WHERE c.id = ?");
    $stmtC->execute([$clientId]);
    $client = $stmtC->fetch() ?: null;

    $stmtW = $pdo->prepare("SELECT * FROM client_websites WHERE client_id = ?");
    $stmtW->execute([$clientId]);
    $websites = $stmtW->fetchAll();

    $stmtP = $pdo->prepare("SELECT * FROM client_projects WHERE client_id = ?");
    $stmtP->execute([$clientId]);
    $projects = $stmtP->fetchAll();

    $stmtI = $pdo->prepare("SELECT * FROM client_invoices WHERE client_id = ? AND status <> 'Draft'");
    $stmtI->execute([$clientId]);
    $invoices = $stmtI->fetchAll();

    $stmtT = $pdo->prepare("SELECT * FROM client_support_tickets WHERE client_id = ? ORDER BY created_at DESC");
    $stmtT->execute([$clientId]);
    $tickets = $stmtT->fetchAll();

    $collections = [];
    foreach ([
        'payments' => 'client_payments',
        'hosting' => 'client_hosting',
        'domains' => 'client_domains',
        'files' => 'client_files',
    ] as $key => $table) {
        $stmt = $pdo->prepare("SELECT * FROM {$table} WHERE client_id = ?");
        $stmt->execute([$clientId]);
        $collections[$key] = $stmt->fetchAll();
    }
    $stmtN = $pdo->prepare("SELECT * FROM notifications WHERE user_id = ? OR user_id IS NULL OR user_id = '' ORDER BY created_at DESC");
    $stmtN->execute([$clientId]);
    $notifications = $stmtN->fetchAll();
    $stmtM = $pdo->prepare("SELECT * FROM messages WHERE user_id = ? ORDER BY created_at ASC");
    $stmtM->execute([$clientId]);
    $messages = $stmtM->fetchAll();

    jsonResponse([
        'ok' => true,
        'client' => $client,
        'websites' => $websites,
        'projects' => $projects,
        'invoices' => $invoices,
        'tickets' => $tickets,
        'payments' => $collections['payments'],
        'hosting' => $collections['hosting'],
        'domains' => $collections['domains'],
        'files' => $collections['files'],
        'notifications' => $notifications,
        'messages' => $messages,
    ]);
}

if ($apiPath === '/portal/profile' && $method === 'POST') {
    if (!empty($portalSession['impersonating'])) jsonResponse(['ok' => false, 'error' => 'Impersonation is read-only.'], 403);
    $clientId = $portalSession['id'];
    $updates = [];
    foreach (['name', 'company', 'phone', 'address', 'country'] as $field) {
        if (array_key_exists($field, $input)) $updates[$field] = trim((string)$input[$field]);
    }
    $newPassword = (string)($input['password'] ?? '');
    if ($newPassword !== '') {
        if (strlen($newPassword) < 8 || strlen($newPassword) > 4096) {
            jsonResponse(['ok' => false, 'error' => 'Password must contain at least 8 characters.'], 422);
        }
        $passwordHash = password_hash($newPassword, PASSWORD_DEFAULT);
        if ($passwordHash === false) jsonResponse(['ok' => false, 'error' => 'Could not securely save the password.'], 500);
    }
    if (!$updates && !isset($passwordHash)) jsonResponse(['ok' => false, 'error' => 'No profile changes were provided.'], 400);
    if ($updates) {
        $set = implode(', ', array_map(static fn($key) => "{$key} = ?", array_keys($updates)));
        $pdo->prepare("UPDATE clients SET {$set}, updated_at = ? WHERE id = ?")
            ->execute([...array_values($updates), date('c'), $clientId]);
    }
    if (isset($passwordHash)) {
        $pdo->prepare('UPDATE client_portal_access SET password_hash = ? WHERE client_id = ?')
            ->execute([$passwordHash, $clientId]);
    }
    jsonResponse(['ok' => true]);
}

// -----------------------------------------------------------------------------
// 16. CLIENT PORTAL: SUPPORT TICKETS
// -----------------------------------------------------------------------------
if ($apiPath === '/portal/ticket' && $method === 'POST') {
    if (!empty($portalSession['impersonating'])) jsonResponse(['ok' => false, 'error' => 'Impersonation is read-only.'], 403);
    $clientId = $portalSession['id'];
    $ticketId = $input['ticketId'] ?? $input['ticket_id'] ?? '';
    $text = trim($input['text'] ?? $input['message'] ?? '');
    $sender = 'client';
    $senderName = 'Client';
    $now = date('c');

    if ($ticketId) {
        $stmtEx = $pdo->prepare("SELECT * FROM client_support_tickets WHERE id = ? AND client_id = ?");
        $stmtEx->execute([$ticketId, $clientId]);
        $existing = $stmtEx->fetch();
        if ($existing) {
            $msgs = json_decode($existing['messages'] ?: '[]', true) ?: [];
            $msgs[] = ['id' => 'msg_' . time(), 'sender' => $sender, 'senderName' => $senderName, 'text' => $text, 'createdAt' => $now];
            $nextStatus = $sender === 'client' ? 'Open' : $existing['status'];
            $pdo->prepare("UPDATE client_support_tickets SET messages = ?, status = ?, updated_at = ? WHERE id = ?")
                ->execute([json_encode($msgs), $nextStatus, $now, $ticketId]);
            jsonResponse(['ok' => true, 'ticket_id' => $ticketId, 'messages' => $msgs]);
        }
    } else {
        $newId = 'tick_' . time();
        $ticketNum = 'TICK-' . strtoupper(substr(bin2hex(random_bytes(4)), 0, 8));
        $subject = $input['subject'] ?? 'Support Request';
        $category = $input['category'] ?? 'General';
        $priority = $input['priority'] ?? 'Medium';
        $initialMsgs = [['id' => 'msg_' . time(), 'sender' => 'client', 'senderName' => $senderName, 'text' => $text, 'createdAt' => $now]];

        $pdo->prepare("INSERT INTO client_support_tickets (id, client_id, ticket_number, subject, category, priority, status, assigned_agent, messages, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'Open', NULL, ?, ?, ?)")
            ->execute([$newId, $clientId, $ticketNum, $subject, $category, $priority, json_encode($initialMsgs), $now, $now]);

        $stmtNew = $pdo->prepare("SELECT * FROM client_support_tickets WHERE id = ?");
        $stmtNew->execute([$newId]);
        $ticket = $stmtNew->fetch();
        $ticket['messages'] = $initialMsgs;
        jsonResponse(['ok' => true, 'ticket_id' => $newId, 'ticket_number' => $ticketNum, 'ticket' => $ticket]);
    }
}

// Unknown routes must fail explicitly instead of looking like successful API calls.
require_once __DIR__ . '/feature-routes.php';
handleCodexDynamicsFeatureRoutes($pdo, $apiPath, $method, $input, $adminSession ?? null, $portalSession ?? null);
jsonResponse(['ok' => false, 'error' => 'API route not found'], 404);
