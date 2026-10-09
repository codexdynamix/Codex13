<?php
/** Route group: ADMIN <-> CLIENT SUPPORT CHAT (included by index.php in order; uses its request globals). */

declare(strict_types=1);

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
