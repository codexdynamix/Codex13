<?php
/** Route group: CLIENT ACTIVITY / AUDIT LOG (included by index.php in order; uses its request globals). */

declare(strict_types=1);

// -----------------------------------------------------------------------------
// 8. CLIENT ACTIVITY / AUDIT LOG
// -----------------------------------------------------------------------------
if ($apiPath === '/admin/audit') {
    requireSuperAdmin($pdo, $adminSession);
    if ($method === 'DELETE') {
        $deleted = $pdo->exec('DELETE FROM audit_logs');
        jsonResponse(['ok' => true, 'deleted' => (int)$deleted]);
    }
    if ($method !== 'GET') jsonResponse(['ok' => false, 'error' => 'Method not allowed.'], 405);
    $userId = trim((string)($_GET['user_id'] ?? ''));
    if ($userId !== '') {
        $stmt = $pdo->prepare('SELECT * FROM audit_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 50');
        $stmt->execute([$userId]);
        $rows = $stmt->fetchAll();
    } else {
        $rows = $pdo->query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100')->fetchAll();
    }
    jsonResponse(['ok' => true, 'log' => $rows, 'history' => $rows, 'total' => count($rows)]);
}

if (preg_match('#^/admin/audit/([^/]+)$#', $apiPath, $auditMatch)) {
    requireSuperAdmin($pdo, $adminSession);
    if ($method !== 'DELETE') jsonResponse(['ok' => false, 'error' => 'Method not allowed.'], 405);
    $stmt = $pdo->prepare('DELETE FROM audit_logs WHERE id = ?');
    $stmt->execute([rawurldecode($auditMatch[1])]);
    if ($stmt->rowCount() === 0) jsonResponse(['ok' => false, 'error' => 'Audit entry not found.'], 404);
    jsonResponse(['ok' => true, 'deleted' => 1]);
}

if (preg_match('#^/admin/users/([^/]+)/profile-history(?:/([^/]+))?$#', $apiPath, $historyMatch)) {
    $userId = rawurldecode($historyMatch[1]);
    $entryId = isset($historyMatch[2]) ? rawurldecode($historyMatch[2]) : '';
    if ($method === 'DELETE') {
        requireSuperAdmin($pdo, $adminSession);
        if ($entryId !== '') {
            $stmt = $pdo->prepare('DELETE FROM audit_logs WHERE id = ? AND user_id = ?');
            $stmt->execute([$entryId, $userId]);
            if ($stmt->rowCount() === 0) jsonResponse(['ok' => false, 'error' => 'History entry not found.'], 404);
            jsonResponse(['ok' => true, 'deleted' => 1]);
        }
        $stmt = $pdo->prepare('DELETE FROM audit_logs WHERE user_id = ?');
        $stmt->execute([$userId]);
        jsonResponse(['ok' => true, 'deleted' => $stmt->rowCount()]);
    }
    if ($method !== 'GET' || $entryId !== '') jsonResponse(['ok' => false, 'error' => 'Method not allowed.'], 405);
    requireActiveAdminStaff($pdo, $adminSession);
    $stmt = $pdo->prepare('SELECT * FROM audit_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 50');
    $stmt->execute([$userId]);
    $rows = $stmt->fetchAll();
    jsonResponse(['ok' => true, 'log' => $rows, 'history' => $rows, 'total' => count($rows)]);
}
