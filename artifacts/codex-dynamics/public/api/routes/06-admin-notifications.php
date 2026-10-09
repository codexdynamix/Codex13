<?php
/** Route group: ADMIN: NOTIFICATIONS (Send to client or all clients, Sent Log) (included by index.php in order; uses its request globals). */

declare(strict_types=1);

// -----------------------------------------------------------------------------
// 6. ADMIN: NOTIFICATIONS (Send to client or all clients, Sent Log)
// -----------------------------------------------------------------------------

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

if (preg_match('#^/admin/users/([^/]+)/notifications(?:/(clear|delete))?$#', $apiPath, $userNotificationMatch)) {
    $actor = requireAdminCapability($pdo, $adminSession, 'notifications');
    $clientId = rawurldecode($userNotificationMatch[1]);
    $action = $userNotificationMatch[2] ?? '';
    requireVisibleLead($pdo, $actor, $clientId);
    if ($action === '' && $method === 'GET') {
        $stmt = $pdo->prepare("
            SELECT n.id, n.user_id, n.title, n.description, n.description AS message, n.kind, n.type, n.link, n.sent_by, n.created_at,
                   r.read_at,
                   CASE WHEN r.notification_id IS NOT NULL THEN 1 ELSE n.is_read END AS is_read,
                   CASE WHEN n.user_id IS NULL OR n.user_id = '' THEN 1 ELSE 0 END AS is_broadcast
            FROM notifications n
            LEFT JOIN user_notification_reads r ON r.notification_id = n.id AND r.user_id = ?
            WHERE n.user_id = ? OR n.user_id IS NULL OR n.user_id = ''
            ORDER BY n.created_at DESC LIMIT 200
        ");
        $stmt->execute([$clientId, $clientId]);
        $rows = $stmt->fetchAll();
        jsonResponse(['ok' => true, 'notifications' => $rows, 'total' => count($rows)]);
    }
    if ($action === 'delete' && $method === 'POST') {
        $ids = array_values(array_unique(array_filter(array_map(
            static fn($id) => trim((string)$id),
            is_array($input['ids'] ?? null) ? $input['ids'] : []
        ))));
        if (count($ids) === 0 || count($ids) > 500) jsonResponse(['ok' => false, 'error' => 'Select between 1 and 500 notifications.'], 400);
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $stmt = $pdo->prepare("DELETE FROM notifications WHERE user_id = ? AND id IN ({$placeholders})");
        $stmt->execute(array_merge([$clientId], $ids));
        jsonResponse(['ok' => true, 'deleted' => $stmt->rowCount()]);
    }
    if ($action === 'clear' && $method === 'DELETE') {
        requireSuperAdmin($pdo, $adminSession);
        $stmt = $pdo->prepare('DELETE FROM notifications WHERE user_id = ?');
        $stmt->execute([$clientId]);
        $deleted = $stmt->rowCount();
        $pdo->prepare('DELETE FROM user_notification_reads WHERE user_id = ?')->execute([$clientId]);
        jsonResponse(['ok' => true, 'deleted' => $deleted]);
    }
    jsonResponse(['ok' => false, 'error' => 'Method not allowed.'], 405);
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
