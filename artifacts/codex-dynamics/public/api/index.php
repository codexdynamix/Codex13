<?php
/**
 * Codex Dynamics - Unified REST API Router for Hostinger Apache/PHP
 */

declare(strict_types=1);

require_once __DIR__ . '/db.php';

$pdo = getDb();
$method = $_SERVER['REQUEST_METHOD'];
$uri = $_SERVER['REQUEST_URI'];
$path = parse_url($uri, PHP_URL_PATH);

// Normalize path relative to /api/
$apiPath = preg_replace('#^.*?/api/?#', '/', $path);
$apiPath = '/' . ltrim($apiPath, '/');
$apiPath = preg_replace('#\.php$#', '', $apiPath);

$input = json_decode(file_get_contents('php://input') ?: '[]', true) ?: [];

if ($apiPath === '/healthz') {
    jsonResponse([
        'status' => 'ok',
        'database' => $pdo->getAttribute(PDO::ATTR_DRIVER_NAME),
    ]);
}

// -----------------------------------------------------------------------------
// 1. PUBLIC WEBSITE CONTENT (Live projects, client reviews, published blogs)
// -----------------------------------------------------------------------------
if ($apiPath === '/public/content' || $apiPath === '/content') {
    $projects = $pdo->query("SELECT * FROM projects WHERE is_published = 1 ORDER BY id DESC")->fetchAll();
    $blogs = $pdo->query("SELECT * FROM blogs WHERE status = 'published' ORDER BY id DESC")->fetchAll();
    $reviews = $pdo->query("SELECT * FROM reviews WHERE is_published = 1 ORDER BY id DESC")->fetchAll();
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

    $leads = $pdo->query("SELECT * FROM leads ORDER BY created_at DESC")->fetchAll();
    jsonResponse(['ok' => true, 'leads' => $leads]);
}

// -----------------------------------------------------------------------------
// 3. CRM ACTIONS (Blog save/toggle, Project save/toggle/hide, Image uploads)
// -----------------------------------------------------------------------------
if ($apiPath === '/crm/action') {
    $action = $input['action'] ?? '';

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

    jsonResponse(['ok' => true]);
}

// -----------------------------------------------------------------------------
// 4. ADMIN: CLIENT SEARCH (Fast suggestions while typing)
// -----------------------------------------------------------------------------
if ($apiPath === '/admin/users') {
    $search = trim($_GET['search'] ?? '');
    $limit = min(200, max(1, (int)($_GET['limit'] ?? 50)));

    if ($search !== '') {
        $term = "%{$search}%";
        $stmt = $pdo->prepare("
            SELECT id, name, company, email, phone, status, portal_enabled, tier, last_login_at, created_at
            FROM portal_clients
            WHERE name LIKE ? OR email LIKE ? OR company LIKE ? OR id LIKE ?
            ORDER BY name ASC
            LIMIT ?
        ");
        $stmt->execute([$term, $term, $term, $term, $limit]);
        $clients = $stmt->fetchAll();
    } else {
        $stmt = $pdo->prepare("SELECT id, name, company, email, phone, status, portal_enabled, tier, last_login_at, created_at FROM portal_clients ORDER BY name ASC LIMIT ?");
        $stmt->execute([$limit]);
        $clients = $stmt->fetchAll();
    }

    jsonResponse(['ok' => true, 'users' => $clients, 'total' => count($clients)]);
}

// -----------------------------------------------------------------------------
// 5. ADMIN: SET CLIENT PASSWORD & VIEW PASSWORD
// -----------------------------------------------------------------------------
if (preg_match('#^/admin/users/([^/]+)/set-password$#', $apiPath, $m) || preg_match('#^/admin/leads/([^/]+)/set-password$#', $apiPath, $m)) {
    $userId = $m[1];
    $newPassword = trim($input['password'] ?? $input['client_password'] ?? '');
    if (!$newPassword) {
        jsonResponse(['ok' => false, 'error' => 'Password cannot be empty.'], 400);
    }

    // Update portal_clients
    $pdo->prepare("UPDATE portal_clients SET password = ? WHERE id = ? OR email = ?")->execute([$newPassword, $userId, $userId]);
    // Update leads
    $pdo->prepare("UPDATE leads SET client_password = ? WHERE id = ? OR email = ?")->execute([$newPassword, $userId, $userId]);

    // Record audit log
    $auditId = 'aud_' . time() . '_' . substr(bin2hex(random_bytes(3)), 0, 4);
    $pdo->prepare("INSERT INTO audit_logs (id, user_id, action, details, created_at) VALUES (?, ?, 'PASSWORD_RESET', 'Admin updated account password', ?)")
        ->execute([$auditId, $userId, date('c')]);

    jsonResponse(['ok' => true, 'message' => 'Client portal password updated successfully.', 'password' => $newPassword]);
}

// -----------------------------------------------------------------------------
// 6. ADMIN: NOTIFICATIONS (Send to client or all clients, Sent Log)
// -----------------------------------------------------------------------------
if ($apiPath === '/admin/notifications/send') {
    $userId = $input['user_id'] ?? null;
    $message = trim($input['message'] ?? '');
    $kind = $input['kind'] ?? 'info';
    $title = trim($input['title'] ?? 'Administrator Notice');
    $now = date('c');

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

if ($apiPath === '/admin/notifications/sent-log' || $apiPath === '/client/notifications' || $apiPath === '/portal/notifications') {
    if ($method === 'DELETE') {
        $pdo->exec("DELETE FROM notifications");
        jsonResponse(['ok' => true]);
    }
    $userId = $_GET['user_id'] ?? $_GET['userId'] ?? null;
    if ($userId) {
        $stmt = $pdo->prepare("SELECT * FROM notifications WHERE user_id = ? OR user_id IS NULL OR user_id = '' ORDER BY created_at DESC LIMIT 100");
        $stmt->execute([$userId]);
        $logs = $stmt->fetchAll();
    } else {
        $logs = $pdo->query("SELECT * FROM notifications ORDER BY created_at DESC LIMIT 100")->fetchAll();
    }
    jsonResponse(['ok' => true, 'notifications' => $logs, 'log' => $logs, 'total' => count($logs)]);
}

// -----------------------------------------------------------------------------
// 7. ADMIN <-> CLIENT SUPPORT CHAT
// -----------------------------------------------------------------------------
if ($apiPath === '/admin/messages' || $apiPath === '/client/messages') {
    if ($method === 'POST') {
        $userId = trim($input['user_id'] ?? $input['userId'] ?? '');
        $body = trim($input['body'] ?? $input['text'] ?? '');
        $sender = ($input['sender'] ?? '') === 'client' ? 'client' : 'agent';
        $senderName = $input['sender_name'] ?? ($sender === 'client' ? 'Client' : 'Support Agent');

        if (!$userId || !$body) {
            jsonResponse(['ok' => false, 'error' => 'user_id and body required'], 400);
        }

        $msgId = 'msg_' . time() . '_' . substr(bin2hex(random_bytes(3)), 0, 4);
        $now = date('c');
        $stmt = $pdo->prepare("
            INSERT INTO messages (id, user_id, sender, sender_name, body, is_read, created_at)
            VALUES (?, ?, ?, ?, ?, 0, ?)
        ");
        $stmt->execute([$msgId, $userId, $sender, $senderName, $body, $now]);

        // Record audit activity
        $action = $sender === 'client' ? 'SUPPORT_MESSAGE_RECEIVED' : 'SUPPORT_MESSAGE_SENT';
        $details = $sender === 'client' ? "Client sent message: \"{$body}\"" : "Agent sent message: \"{$body}\"";
        $auditId = 'aud_' . time() . '_' . substr(bin2hex(random_bytes(3)), 0, 4);
        $pdo->prepare("INSERT INTO audit_logs (id, user_id, action, details, created_at) VALUES (?, ?, ?, ?, ?)")
            ->execute([$auditId, $userId, $action, substr($details, 0, 160), $now]);

        jsonResponse([
            'ok' => true,
            'message' => [
                'id' => $msgId,
                'user_id' => $userId,
                'sender' => $sender,
                'sender_name' => $senderName,
                'body' => $body,
                'created_at' => $now,
            ]
        ]);
    }

    $userId = trim($_GET['user_id'] ?? '');
    if (!$userId) {
        jsonResponse(['ok' => true, 'messages' => [], 'unread_count' => 0]);
    }

    $stmt = $pdo->prepare("SELECT * FROM messages WHERE user_id = ? ORDER BY created_at ASC");
    $stmt->execute([$userId]);
    $msgs = $stmt->fetchAll();

    jsonResponse([
        'ok' => true,
        'user' => ['id' => $userId],
        'messages' => $msgs,
        'unread_count' => 0,
        'has_more' => false
    ]);
}

if ($apiPath === '/admin/messages/read') {
    $userId = trim($input['user_id'] ?? '');
    if ($userId) {
        $pdo->prepare("UPDATE messages SET is_read = 1 WHERE user_id = ? AND sender = 'client'")->execute([$userId]);
    }
    jsonResponse(['ok' => true]);
}

if ($apiPath === '/admin/messages/clear') {
    $userId = trim($input['user_id'] ?? '');
    if ($userId) {
        $pdo->prepare("DELETE FROM messages WHERE user_id = ?")->execute([$userId]);
    }
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
    if ($method === 'POST') {
        $id = 'of_' . time() . '_' . substr(bin2hex(random_bytes(2)), 0, 4);
        $name = trim($input['name'] ?? 'New Office');
        $now = date('c');
        $manager = null;
        $managerId = null;
        $managerName = trim($input['manager_name'] ?? 'Unassigned');
        $managerEmail = trim($input['manager_email'] ?? '');

        if (!empty($input['manager_name']) && !empty($input['manager_password'])) {
            $managerId = 'adm_' . time() . '_' . substr(bin2hex(random_bytes(2)), 0, 4);
            $managerEmail = $managerEmail ?: "manager_" . time() . "@codexdynamics.com";
            $caps = json_encode(['lead_upload' => true, 'create_agent' => true, 'registrations' => true, 'notifications' => true, 'content' => true, 'enquiries' => true, 'chat' => true]);
            $pdo->prepare("INSERT INTO staff_users (id, email, password, name, role, office_id, team_id, status, capabilities, created_at) VALUES (?, ?, ?, ?, 'Office Manager', ?, NULL, 'Active', ?, ?)")
                ->execute([$managerId, $managerEmail, $input['manager_password'], $managerName, $id, $caps, $now]);
            $manager = ['id' => $managerId, 'name' => $managerName, 'email' => $managerEmail, 'role' => 'Office Manager', 'office_id' => $id];
        }

        $pdo->prepare("INSERT INTO offices (id, name, manager_id, manager_name, manager_email, created_at) VALUES (?, ?, ?, ?, ?, ?)")
            ->execute([$id, $name, $managerId, $managerName, $managerEmail, $now]);
        $createdOffice = ['id' => $id, 'name' => $name, 'manager_id' => $managerId, 'manager_name' => $managerName, 'manager_email' => $managerEmail, 'team_count' => 0, 'agent_count' => 0, 'lead_count' => 0, 'created_at' => $now];
        jsonResponse(['ok' => true, 'office' => $createdOffice, 'manager' => $manager]);
    }

    $offices = $pdo->query("SELECT * FROM offices ORDER BY created_at DESC")->fetchAll();
    foreach ($offices as &$o) {
        $stmtT = $pdo->prepare("SELECT COUNT(*) FROM teams WHERE office_id = ?");
        $stmtT->execute([$o['id']]);
        $o['team_count'] = (int)$stmtT->fetchColumn();

        $stmtA = $pdo->prepare("SELECT COUNT(*) FROM staff_users WHERE office_id = ? AND role = 'Agent'");
        $stmtA->execute([$o['id']]);
        $o['agent_count'] = (int)$stmtA->fetchColumn();

        $stmtL = $pdo->prepare("SELECT COUNT(*) FROM leads WHERE assigned_office_id = ?");
        $stmtL->execute([$o['id']]);
        $o['lead_count'] = (int)$stmtL->fetchColumn();
    }
    jsonResponse(['ok' => true, 'offices' => $offices]);
}

if (preg_match('#^/admin/offices/([^/]+)(?:/(manager))?$#', $apiPath, $m)) {
    $officeId = $m[1];
    $sub = $m[2] ?? '';

    if ($sub === 'manager' && $method === 'POST') {
        $managerId = $input['manager_id'] ?? '';
        $stmtM = $pdo->prepare("SELECT * FROM staff_users WHERE id = ?");
        $stmtM->execute([$managerId]);
        $mgr = $stmtM->fetch();
        if ($mgr) {
            $pdo->prepare("UPDATE offices SET manager_id = ?, manager_name = ?, manager_email = ? WHERE id = ?")->execute([$mgr['id'], $mgr['name'], $mgr['email'], $officeId]);
            $pdo->prepare("UPDATE staff_users SET office_id = ? WHERE id = ?")->execute([$officeId, $mgr['id']]);
        }
        $stmtO = $pdo->prepare("SELECT * FROM offices WHERE id = ?");
        $stmtO->execute([$officeId]);
        jsonResponse(['ok' => true, 'office' => $stmtO->fetch(), 'manager' => $mgr]);
    }

    if ($method === 'PATCH') {
        if (!empty($input['name'])) {
            $pdo->prepare("UPDATE offices SET name = ? WHERE id = ?")->execute([$input['name'], $officeId]);
        }
        $stmtO = $pdo->prepare("SELECT * FROM offices WHERE id = ?");
        $stmtO->execute([$officeId]);
        jsonResponse(['ok' => true, 'office' => $stmtO->fetch()]);
    }

    if ($method === 'DELETE') {
        $pdo->prepare("DELETE FROM offices WHERE id = ?")->execute([$officeId]);
        jsonResponse(['ok' => true]);
    }
}

// -----------------------------------------------------------------------------
// 10. ADMIN: TEAMS MANAGEMENT
// -----------------------------------------------------------------------------
if ($apiPath === '/admin/teams') {
    if ($method === 'POST') {
        $id = 'tm_' . time() . '_' . substr(bin2hex(random_bytes(2)), 0, 4);
        $name = trim($input['name'] ?? 'New Team');
        $officeId = $input['office_id'] ?? null;
        $maxSize = (int)($input['max_size'] ?? 10);
        $now = date('c');
        $leader = null;
        $leaderId = null;
        $leaderName = trim($input['leader_name'] ?? 'Unassigned');
        $leaderEmail = trim($input['leader_email'] ?? '');

        if (!empty($input['leader_name']) && !empty($input['leader_password'])) {
            $leaderId = 'adm_' . time() . '_' . substr(bin2hex(random_bytes(2)), 0, 4);
            $leaderEmail = $leaderEmail ?: "leader_" . time() . "@codexdynamics.com";
            $caps = json_encode(['lead_upload' => true, 'create_agent' => true, 'registrations' => true, 'notifications' => true, 'content' => true, 'enquiries' => true, 'chat' => true]);
            $pdo->prepare("INSERT INTO staff_users (id, email, password, name, role, office_id, team_id, status, capabilities, created_at) VALUES (?, ?, ?, ?, 'Team Leader', ?, ?, 'Active', ?, ?)")
                ->execute([$leaderId, $leaderEmail, $input['leader_password'], $leaderName, $officeId, $id, $caps, $now]);
            $leader = ['id' => $leaderId, 'name' => $leaderName, 'email' => $leaderEmail, 'role' => 'Team Leader', 'office_id' => $officeId, 'team_id' => $id];
        }

        $pdo->prepare("INSERT INTO teams (id, name, office_id, leader_id, leader_name, max_size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
            ->execute([$id, $name, $officeId, $leaderId, $leaderName, $maxSize, $now]);
        $createdTeam = ['id' => $id, 'name' => $name, 'office_id' => $officeId, 'leader_id' => $leaderId, 'leader_name' => $leaderName, 'max_size' => $maxSize, 'agent_count' => 0, 'lead_count' => 0, 'created_at' => $now];
        jsonResponse(['ok' => true, 'team' => $createdTeam, 'leader' => $leader]);
    }

    $teams = $pdo->query("SELECT * FROM teams ORDER BY created_at DESC")->fetchAll();
    foreach ($teams as &$t) {
        $stmtA = $pdo->prepare("SELECT COUNT(*) FROM staff_users WHERE team_id = ? AND role = 'Agent'");
        $stmtA->execute([$t['id']]);
        $t['agent_count'] = (int)$stmtA->fetchColumn();

        $stmtL = $pdo->prepare("SELECT COUNT(*) FROM leads WHERE assigned_team_id = ?");
        $stmtL->execute([$t['id']]);
        $t['lead_count'] = (int)$stmtL->fetchColumn();
    }
    jsonResponse(['ok' => true, 'teams' => $teams]);
}

if (preg_match('#^/admin/teams/([^/]+)$#', $apiPath, $m)) {
    $teamId = $m[1];
    if ($method === 'PATCH') {
        if (!empty($input['name'])) $pdo->prepare("UPDATE teams SET name = ? WHERE id = ?")->execute([$input['name'], $teamId]);
        if (isset($input['max_size'])) $pdo->prepare("UPDATE teams SET max_size = ? WHERE id = ?")->execute([(int)$input['max_size'], $teamId]);
        $stmtT = $pdo->prepare("SELECT * FROM teams WHERE id = ?");
        $stmtT->execute([$teamId]);
        jsonResponse(['ok' => true, 'team' => $stmtT->fetch()]);
    }
    if ($method === 'DELETE') {
        $pdo->prepare("DELETE FROM teams WHERE id = ?")->execute([$teamId]);
        jsonResponse(['ok' => true]);
    }
}

// -----------------------------------------------------------------------------
// 11. ADMIN: STAFF (AGENTS, TEAM LEADERS, MANAGERS)
// -----------------------------------------------------------------------------
if ($apiPath === '/admin/staff') {
    if ($method === 'POST') {
        $id = 'adm_' . time() . '_' . substr(bin2hex(random_bytes(2)), 0, 4);
        $name = trim($input['name'] ?? 'New Staff');
        $email = strtolower(trim($input['email'] ?? "agent_" . time() . "@codexdynamics.com"));
        $password = trim($input['password'] ?? 'admin123');
        $role = $input['role'] ?? 'Agent';
        $teamId = $input['team_id'] ?? null;
        $officeId = $input['office_id'] ?? null;
        if ($teamId && !$officeId) {
            $stmtTm = $pdo->prepare("SELECT office_id FROM teams WHERE id = ?");
            $stmtTm->execute([$teamId]);
            $officeId = $stmtTm->fetchColumn() ?: null;
        }
        $now = date('c');
        $caps = json_encode(['lead_upload' => true, 'create_agent' => true, 'registrations' => true, 'notifications' => true, 'content' => true, 'enquiries' => true, 'chat' => true]);
        $pdo->prepare("INSERT INTO staff_users (id, email, password, name, role, office_id, team_id, status, capabilities, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?)")
            ->execute([$id, $email, $password, $name, $role, $officeId, $teamId, $caps, $now]);
        jsonResponse(['ok' => true, 'staff' => ['id' => $id, 'name' => $name, 'email' => $email, 'role' => $role, 'office_id' => $officeId, 'team_id' => $teamId, 'status' => 'Active', 'capabilities' => json_decode($caps, true), 'created_at' => $now]]);
    }

    $staff = $pdo->query("SELECT id, email, name, role, office_id, team_id, status, capabilities, last_login_at, created_at FROM staff_users ORDER BY name ASC")->fetchAll();
    foreach ($staff as &$s) {
        if (!empty($s['capabilities']) && is_string($s['capabilities'])) {
            $s['capabilities'] = json_decode($s['capabilities'], true);
        }
    }
    jsonResponse(['ok' => true, 'staff' => $staff]);
}

if (preg_match('#^/admin/staff/([^/]+)(?:/(block|unblock))?$#', $apiPath, $m)) {
    $staffId = $m[1];
    $action = $m[2] ?? '';
    if ($action === 'block' && $method === 'POST') {
        $pdo->prepare("UPDATE staff_users SET status = 'Suspended' WHERE id = ?")->execute([$staffId]);
        $stmtS = $pdo->prepare("SELECT * FROM staff_users WHERE id = ?");
        $stmtS->execute([$staffId]);
        jsonResponse(['ok' => true, 'staff' => $stmtS->fetch()]);
    }
    if ($action === 'unblock' && $method === 'POST') {
        $pdo->prepare("UPDATE staff_users SET status = 'Active' WHERE id = ?")->execute([$staffId]);
        $stmtS = $pdo->prepare("SELECT * FROM staff_users WHERE id = ?");
        $stmtS->execute([$staffId]);
        jsonResponse(['ok' => true, 'staff' => $stmtS->fetch()]);
    }
    if ($method === 'PATCH') {
        if (!empty($input['name'])) $pdo->prepare("UPDATE staff_users SET name = ? WHERE id = ?")->execute([$input['name'], $staffId]);
        if (!empty($input['email'])) $pdo->prepare("UPDATE staff_users SET email = ? WHERE id = ?")->execute([$input['email'], $staffId]);
        if (!empty($input['password'])) $pdo->prepare("UPDATE staff_users SET password = ? WHERE id = ?")->execute([$input['password'], $staffId]);
        if (isset($input['team_id'])) $pdo->prepare("UPDATE staff_users SET team_id = ? WHERE id = ?")->execute([$input['team_id'], $staffId]);
        $stmtS = $pdo->prepare("SELECT * FROM staff_users WHERE id = ?");
        $stmtS->execute([$staffId]);
        jsonResponse(['ok' => true, 'staff' => $stmtS->fetch()]);
    }
}

// -----------------------------------------------------------------------------
// 12. ADMIN: LEAD ASSIGNMENT
// -----------------------------------------------------------------------------
if (preg_match('#^/admin/leads/([^/]+)/assign$#', $apiPath, $m) && $method === 'POST') {
    $leadId = $m[1];
    $officeId = $input['officeId'] ?? $input['office_id'] ?? null;
    $teamId = $input['teamId'] ?? $input['team_id'] ?? null;
    $agentId = $input['agentId'] ?? $input['agent_id'] ?? null;
    $now = date('c');

    $pdo->prepare("UPDATE leads SET assigned_office_id = ?, assigned_team_id = ?, assigned_agent_id = ?, updated_at = ? WHERE id = ?")
        ->execute([$officeId, $teamId, $agentId, $now, $leadId]);

    $stmtL = $pdo->prepare("SELECT * FROM leads WHERE id = ?");
    $stmtL->execute([$leadId]);
    jsonResponse(['ok' => true, 'lead' => $stmtL->fetch()]);
}

// -----------------------------------------------------------------------------
// 13. AUTHENTICATION: STAFF LOGIN
// -----------------------------------------------------------------------------
if ($apiPath === '/admin/login' && $method === 'POST') {
    $email = strtolower(trim($input['email'] ?? ''));
    $password = trim($input['password'] ?? '');

    $stmt = $pdo->prepare("SELECT * FROM staff_users WHERE LOWER(email) = ?");
    $stmt->execute([$email]);
    $staff = $stmt->fetch();

    if (!$staff || $staff['password'] !== $password) {
        jsonResponse(['ok' => false, 'error' => 'Invalid staff email or password.'], 401);
    }
    if ($staff['status'] !== 'Active') {
        jsonResponse(['ok' => false, 'error' => 'This staff account is currently suspended.'], 403);
    }

    $now = date('c');
    $pdo->prepare("UPDATE staff_users SET last_login_at = ? WHERE id = ?")->execute([$now, $staff['id']]);
    $token = "token_{$staff['id']}_" . time();

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
    $password = trim($input['password'] ?? '');

    $stmt = $pdo->prepare("SELECT * FROM portal_clients WHERE LOWER(email) = ?");
    $stmt->execute([$email]);
    $client = $stmt->fetch();

    if (!$client) {
        jsonResponse(['ok' => false, 'error' => 'No client account found with this email address.'], 404);
    }
    if (empty($client['portal_enabled'])) {
        jsonResponse(['ok' => false, 'error' => 'This client portal account is currently disabled.'], 403);
    }
    if (!empty($client['password']) && $password !== '' && $client['password'] !== $password) {
        jsonResponse(['ok' => false, 'error' => 'Incorrect password. Please try again.'], 401);
    }

    $now = date('c');
    $pdo->prepare("UPDATE portal_clients SET last_login_at = ? WHERE id = ?")->execute([$now, $client['id']]);
    $token = "cdx_sess_{$client['id']}_" . time();

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

// -----------------------------------------------------------------------------
// 15. CLIENT PORTAL: COMPLETE DASHBOARD DATA
// -----------------------------------------------------------------------------
if ($apiPath === '/portal/data') {
    $clientId = $_GET['client_id'] ?? '';
    if (!$clientId) {
        jsonResponse(['error' => 'Missing client_id parameter'], 400);
    }

    $stmtC = $pdo->prepare("SELECT * FROM portal_clients WHERE id = ?");
    $stmtC->execute([$clientId]);
    $client = $stmtC->fetch() ?: null;

    $stmtW = $pdo->prepare("SELECT * FROM client_websites WHERE client_id = ?");
    $stmtW->execute([$clientId]);
    $websites = $stmtW->fetchAll();

    $stmtP = $pdo->prepare("SELECT * FROM client_projects WHERE client_id = ?");
    $stmtP->execute([$clientId]);
    $projects = $stmtP->fetchAll();

    $stmtI = $pdo->prepare("SELECT * FROM client_invoices WHERE client_id = ?");
    $stmtI->execute([$clientId]);
    $invoices = $stmtI->fetchAll();

    $stmtT = $pdo->prepare("SELECT * FROM client_support_tickets WHERE client_id = ? ORDER BY created_at DESC");
    $stmtT->execute([$clientId]);
    $tickets = $stmtT->fetchAll();

    jsonResponse([
        'ok' => true,
        'client' => $client,
        'websites' => $websites,
        'projects' => $projects,
        'invoices' => $invoices,
        'tickets' => $tickets,
        'notifications' => [],
    ]);
}

// -----------------------------------------------------------------------------
// 16. CLIENT PORTAL: SUPPORT TICKETS
// -----------------------------------------------------------------------------
if ($apiPath === '/portal/ticket' && $method === 'POST') {
    $clientId = $input['clientId'] ?? $input['client_id'] ?? '';
    $ticketId = $input['ticketId'] ?? $input['ticket_id'] ?? '';
    $text = trim($input['text'] ?? $input['message'] ?? '');
    $sender = $input['sender'] ?? 'client';
    $senderName = $input['senderName'] ?? $input['sender_name'] ?? 'Client';
    $now = date('c');

    if ($ticketId) {
        $stmtEx = $pdo->prepare("SELECT * FROM client_support_tickets WHERE id = ?");
        $stmtEx->execute([$ticketId]);
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
        $ticketNum = 'TICK-' . rand(100, 999);
        $subject = $input['subject'] ?? 'Support Request';
        $category = $input['category'] ?? 'General';
        $priority = $input['priority'] ?? 'Medium';
        $initialMsgs = [['id' => 'msg_' . time(), 'sender' => 'client', 'senderName' => $senderName, 'text' => $text, 'createdAt' => $now]];

        $pdo->prepare("INSERT INTO client_support_tickets (id, client_id, ticket_number, subject, category, priority, status, assigned_agent, messages, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'Open', 'Alex Agent', ?, ?, ?)")
            ->execute([$newId, $clientId, $ticketNum, $subject, $category, $priority, json_encode($initialMsgs), $now, $now]);

        jsonResponse(['ok' => true, 'ticket_id' => $newId, 'ticket_number' => $ticketNum]);
    }
}

// Unknown routes must fail explicitly instead of looking like successful API calls.
jsonResponse(['ok' => false, 'error' => 'API route not found'], 404);
