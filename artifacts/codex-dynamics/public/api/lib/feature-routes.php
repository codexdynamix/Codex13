<?php

declare(strict_types=1);

function codexFeatureJsonArray(mixed $value, array $fallback = []): array
{
    if (is_array($value)) return $value;
    if (!is_string($value) || $value === '') return $fallback;
    $decoded = json_decode($value, true);
    return is_array($decoded) ? $decoded : $fallback;
}

function codexFeatureDate(mixed $value): string
{
    $timestamp = is_string($value) ? strtotime($value) : false;
    return $timestamp === false ? date('c') : date('c', $timestamp);
}

function codexFeatureSlug(string $value): string
{
    $value = strtolower(trim($value));
    $value = preg_replace('/[^a-z0-9]+/', '-', $value) ?? '';
    return trim($value, '-');
}

function codexFeatureNormalizeProject(array $row): array
{
    $row['progress'] = (int)($row['progress'] ?? 0);
    $row['milestones'] = codexFeatureJsonArray($row['milestones'] ?? null);
    $row['recent_updates'] = codexFeatureJsonArray($row['recent_updates'] ?? null);
    return $row;
}

function codexFeatureInsertReview(PDO $pdo, string $a, string $b, string $reason): void
{
    if ($a === $b) return;
    [$left, $right] = strcmp($a, $b) <= 0 ? [$a, $b] : [$b, $a];
    $check = $pdo->prepare('SELECT 1 FROM client_identity_reviews WHERE client_id_a = ? AND client_id_b = ?');
    $check->execute([$left, $right]);
    if (!$check->fetchColumn()) {
        $pdo->prepare('INSERT INTO client_identity_reviews (client_id_a, client_id_b, reason, status, created_at) VALUES (?, ?, ?, ?, ?)')
            ->execute([$left, $right, $reason, 'pending', date('c')]);
    }
}

function codexFeatureCreateClientFromChat(PDO $pdo, string $name, string $email, string $source, ?string $requestedId = null): string
{
    $clientId = $requestedId ?: 'client_' . bin2hex(random_bytes(10));
    $cleanName = trim($name);
    if ($cleanName === '') $cleanName = 'Website visitor';
    $parts = preg_split('/\s+/', $cleanName, 2) ?: [$cleanName, ''];
    $now = date('c');
    $pdo->prepare("INSERT INTO clients
        (id, first_name, last_name, name, email, company, source, stage, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, '', ?, 'New', 'New', ?, ?)")
        ->execute([
            $clientId,
            (string)($parts[0] ?? ''),
            (string)($parts[1] ?? ''),
            $cleanName,
            strtolower(trim($email)),
            $source,
            $now,
            $now,
        ]);
    return $clientId;
}

function codexFeatureStoreChatMessage(
    PDO $pdo,
    string $clientId,
    string $sender,
    string $senderName,
    string $body,
    string $createdAt,
    ?string $sourceKey = null
): array {
    $messageId = $sourceKey
        ? 'chat_' . substr(hash('sha256', $sourceKey), 0, 48)
        : 'msg_' . bin2hex(random_bytes(12));

    if ($sourceKey !== null) {
        $existingImport = $pdo->prepare('SELECT message_id FROM client_chat_imports WHERE source_key = ?');
        $existingImport->execute([$sourceKey]);
        $existingMessageId = $existingImport->fetchColumn();
        if ($existingMessageId) {
            $existingMessage = $pdo->prepare('SELECT id, user_id, sender, sender_name, body, is_read, created_at FROM messages WHERE id = ?');
            $existingMessage->execute([$existingMessageId]);
            return $existingMessage->fetch() ?: [
                'id' => $messageId,
                'user_id' => $clientId,
                'sender' => $sender,
                'sender_name' => $senderName,
                'body' => $body,
                'is_read' => 0,
                'created_at' => $createdAt,
            ];
        }
    }

    $pdo->prepare('INSERT INTO messages (id, user_id, sender, sender_name, body, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        ->execute([$messageId, $clientId, $sender, $senderName, $body, $sender === 'agent' ? 1 : 0, $createdAt]);
    if ($sourceKey !== null) {
        $pdo->prepare('INSERT INTO client_chat_imports (source_key, client_id, message_id, imported_at) VALUES (?, ?, ?, ?)')
            ->execute([$sourceKey, $clientId, $messageId, date('c')]);
    }

    $metadata = $pdo->prepare('SELECT client_id FROM client_chat_metadata WHERE client_id = ?');
    $metadata->execute([$clientId]);
    if ($metadata->fetchColumn()) {
        $pdo->prepare("UPDATE client_chat_metadata SET status = ?, updated_at = ? WHERE client_id = ?")
            ->execute([$sender === 'client' ? 'waiting' : 'active', date('c'), $clientId]);
    } else {
        $pdo->prepare('INSERT INTO client_chat_metadata (client_id, status, is_archived, notes, updated_at) VALUES (?, ?, 0, ?, ?)')
            ->execute([$clientId, $sender === 'client' ? 'waiting' : 'active', '', date('c')]);
    }

    $message = [
        'id' => $messageId,
        'user_id' => $clientId,
        'sender' => $sender,
        'sender_name' => $senderName,
        'body' => $body,
        'is_read' => $sender === 'agent' ? 1 : 0,
        'created_at' => $createdAt,
    ];
    return $message;
}

function codexFeatureWriteClientMessage(PDO $pdo, string $clientId, string $text, string $senderName = 'Website visitor'): array
{
    $body = trim($text);
    if ($body === '' || strlen($body) > 5000) {
        jsonResponse(['ok' => false, 'error' => 'Messages must contain 1–5,000 characters.'], 422);
    }
    $recent = $pdo->prepare("SELECT COUNT(*) FROM messages WHERE user_id = ? AND sender = 'client' AND created_at >= ?");
    $recent->execute([$clientId, date('c', time() - 60)]);
    if ((int)$recent->fetchColumn() >= 10) {
        jsonResponse(['ok' => false, 'error' => 'Too many messages were sent. Wait a minute and try again.'], 429);
    }
    $message = codexFeatureStoreChatMessage($pdo, $clientId, 'client', $senderName, $body, date('c'));
    $auditId = 'aud_' . bin2hex(random_bytes(8));
    $pdo->prepare('INSERT INTO audit_logs (id, user_id, action, details, created_at) VALUES (?, ?, ?, ?, ?)')
        ->execute([$auditId, $clientId, 'SUPPORT_MESSAGE_RECEIVED', 'Client sent a support message.', date('c')]);
    return $message;
}

function codexFeatureHandleStaffNotes(PDO $pdo, string $apiPath, string $method, array $input, ?array $adminSession): bool
{
    if (!preg_match('#^/admin/staff/([^/]+)/notes(?:/(import))?$#', $apiPath, $match)) return false;
    $actor = requireActiveAdminStaff($pdo, $adminSession);
    $staffId = rawurldecode($match[1]);
    $staffQuery = $pdo->prepare('SELECT * FROM staff_users WHERE id = ?');
    $staffQuery->execute([$staffId]);
    $staff = $staffQuery->fetch();
    if (!$staff) jsonResponse(['ok' => false, 'error' => 'Staff member not found.'], 404);
    if (!canManageStaffRecord($actor, $staff)) jsonResponse(['ok' => false, 'error' => 'You cannot manage notes for this staff member.'], 403);

    if ($method === 'GET' && empty($match[2])) {
        $stmt = $pdo->prepare('SELECT n.*, COALESCE(NULLIF(n.created_by_name, \'\'), creator.name) AS author_name
            FROM staff_notes n LEFT JOIN staff_users creator ON creator.id = n.created_by_staff_id
            WHERE n.staff_id = ? ORDER BY n.created_at DESC');
        $stmt->execute([$staffId]);
        $notes = array_map(static function (array $row): array {
            return [
                'id' => $row['id'],
                'text' => $row['body'],
                'by' => $row['author_name'] ?: 'Admin',
                'date' => substr((string)$row['created_at'], 0, 10),
                'created_at' => $row['created_at'],
            ];
        }, $stmt->fetchAll());
        jsonResponse(['ok' => true, 'notes' => $notes]);
    }

    if ($method !== 'POST') jsonResponse(['ok' => false, 'error' => 'Method not allowed.'], 405);
    $isImport = ($match[2] ?? '') === 'import';
    if (!$isImport) {
        $text = trim((string)($input['text'] ?? ''));
        if ($text === '' || strlen($text) > 5000) jsonResponse(['ok' => false, 'error' => 'Enter a staff note under 5,000 characters.'], 422);
        $id = 'note_' . bin2hex(random_bytes(12));
        $now = date('c');
        $pdo->prepare('INSERT INTO staff_notes (id, staff_id, created_by_staff_id, created_by_name, body, created_at) VALUES (?, ?, ?, ?, ?, ?)')
            ->execute([$id, $staffId, $actor['id'], $actor['name'], $text, $now]);
        jsonResponse(['ok' => true, 'note' => ['id' => $id, 'text' => $text, 'by' => $actor['name'], 'date' => substr($now, 0, 10), 'created_at' => $now]], 201);
    }

    $notes = $input['notes'] ?? null;
    if (!is_array($notes) || count($notes) > 500) jsonResponse(['ok' => false, 'error' => 'Provide at most 500 legacy notes.'], 422);
    $insert = $pdo->prepare('INSERT INTO staff_notes (id, staff_id, created_by_staff_id, created_by_name, body, created_at) VALUES (?, ?, ?, ?, ?, ?)');
    $imported = 0;
    foreach ($notes as $note) {
        if (!is_array($note)) continue;
        $body = trim((string)($note['text'] ?? $note['body'] ?? ''));
        if ($body === '' || strlen($body) > 5000) continue;
        $oldId = trim((string)($note['id'] ?? hash('sha256', $body)));
        $id = 'note_legacy_' . substr(hash('sha256', $staffId . ':' . $oldId), 0, 40);
        $exists = $pdo->prepare('SELECT 1 FROM staff_notes WHERE id = ?');
        $exists->execute([$id]);
        if ($exists->fetchColumn()) continue;
        $insert->execute([
            $id,
            $staffId,
            $actor['id'],
            trim((string)($note['by'] ?? 'Imported note')) ?: 'Imported note',
            $body,
            codexFeatureDate($note['created_at'] ?? $note['date'] ?? null),
        ]);
        $imported++;
    }
    jsonResponse(['ok' => true, 'imported' => $imported]);
}

function codexFeatureHandleBlogCategories(PDO $pdo, string $apiPath, string $method, array $input, ?array $adminSession): bool
{
    if ($apiPath === '/admin/blog/categories') {
        $actor = requireAdminCapability($pdo, $adminSession, 'content');
        if ($method === 'GET') {
            $rows = $pdo->query("SELECT c.*,
                (SELECT COUNT(*) FROM blogs b WHERE b.category = c.name AND b.deleted_at IS NULL) AS post_count
                FROM blog_categories c ORDER BY c.is_default DESC, LOWER(c.name) ASC")->fetchAll();
            jsonResponse(['ok' => true, 'categories' => array_map(static fn(array $row): array => [
                'id' => $row['id'],
                'name' => $row['name'],
                'slug' => $row['slug'],
                'parent' => $row['parent'],
                'is_default' => (bool)$row['is_default'],
                'count' => (int)$row['post_count'],
            ], $rows)]);
        }
        if ($method !== 'POST') jsonResponse(['ok' => false, 'error' => 'Method not allowed.'], 405);
        if (!empty($input['categories']) && is_array($input['categories'])) {
            if (count($input['categories']) > 250) jsonResponse(['ok' => false, 'error' => 'Provide at most 250 categories.'], 422);
            $imported = 0;
            foreach ($input['categories'] as $category) {
                if (!is_array($category)) continue;
                $name = trim((string)($category['name'] ?? ''));
                $slug = codexFeatureSlug((string)($category['slug'] ?? $name));
                if ($name === '' || strlen($name) > 191 || $slug === '') continue;
                $exists = $pdo->prepare('SELECT id FROM blog_categories WHERE LOWER(name) = LOWER(?) OR slug = ?');
                $exists->execute([$name, $slug]);
                if ($exists->fetchColumn()) continue;
                $id = preg_match('/^[A-Za-z0-9_-]{1,191}$/', (string)($category['id'] ?? ''))
                    ? (string)$category['id']
                    : 'category_' . bin2hex(random_bytes(8));
                $now = date('c');
                $pdo->prepare('INSERT INTO blog_categories (id, name, slug, parent, is_default, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)')
                    ->execute([$id, $name, $slug, trim((string)($category['parent'] ?? '')) ?: null, $now, $now]);
                $imported++;
            }
            jsonResponse(['ok' => true, 'imported' => $imported]);
        }
        $name = trim((string)($input['name'] ?? ''));
        $slug = codexFeatureSlug((string)($input['slug'] ?? $name));
        if ($name === '' || strlen($name) > 191 || $slug === '') jsonResponse(['ok' => false, 'error' => 'Enter a valid category name.'], 422);
        $exists = $pdo->prepare('SELECT id FROM blog_categories WHERE LOWER(name) = LOWER(?) OR slug = ?');
        $exists->execute([$name, $slug]);
        if ($existingId = $exists->fetchColumn()) jsonResponse(['ok' => true, 'category' => ['id' => $existingId, 'name' => $name, 'slug' => $slug], 'already_exists' => true]);
        $id = 'category_' . bin2hex(random_bytes(8));
        $now = date('c');
        $parent = trim((string)($input['parent'] ?? '')) ?: null;
        $pdo->prepare('INSERT INTO blog_categories (id, name, slug, parent, is_default, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)')
            ->execute([$id, $name, $slug, $parent, $now, $now]);
        jsonResponse(['ok' => true, 'category' => ['id' => $id, 'name' => $name, 'slug' => $slug, 'parent' => $parent, 'is_default' => false, 'count' => 0]], 201);
    }

    if (!preg_match('#^/admin/blog/categories/([^/]+)$#', $apiPath, $match)) return false;
    requireAdminCapability($pdo, $adminSession, 'content');
    $id = rawurldecode($match[1]);
    $lookup = $pdo->prepare('SELECT * FROM blog_categories WHERE id = ?');
    $lookup->execute([$id]);
    $category = $lookup->fetch();
    if (!$category) jsonResponse(['ok' => false, 'error' => 'Blog category not found.'], 404);
    if ($method === 'PATCH') {
        $name = trim((string)($input['name'] ?? $category['name']));
        $slug = codexFeatureSlug((string)($input['slug'] ?? $name));
        if ($name === '' || strlen($name) > 191 || $slug === '') jsonResponse(['ok' => false, 'error' => 'Enter a valid category name.'], 422);
        $exists = $pdo->prepare('SELECT id FROM blog_categories WHERE (LOWER(name) = LOWER(?) OR slug = ?) AND id <> ?');
        $exists->execute([$name, $slug, $id]);
        if ($exists->fetchColumn()) jsonResponse(['ok' => false, 'error' => 'Another category already uses that name or slug.'], 409);
        $parent = array_key_exists('parent', $input) ? (trim((string)$input['parent']) ?: null) : $category['parent'];
        $pdo->prepare('UPDATE blog_categories SET name = ?, slug = ?, parent = ?, updated_at = ? WHERE id = ?')
            ->execute([$name, $slug, $parent, date('c'), $id]);
        jsonResponse(['ok' => true, 'category' => ['id' => $id, 'name' => $name, 'slug' => $slug, 'parent' => $parent, 'is_default' => (bool)$category['is_default']]]);
    }
    if ($method === 'DELETE') {
        if (!empty($category['is_default'])) jsonResponse(['ok' => false, 'error' => 'Default categories cannot be deleted.'], 409);
        $used = $pdo->prepare('SELECT COUNT(*) FROM blogs WHERE category = ? AND deleted_at IS NULL');
        $used->execute([$category['name']]);
        if ((int)$used->fetchColumn() > 0) jsonResponse(['ok' => false, 'error' => 'This category is assigned to blog posts. Change those posts first.'], 409);
        $pdo->prepare('DELETE FROM blog_categories WHERE id = ?')->execute([$id]);
        jsonResponse(['ok' => true, 'deleted' => true]);
    }
    jsonResponse(['ok' => false, 'error' => 'Method not allowed.'], 405);
}

function codexFeatureHandlePortalMilestoneApproval(PDO $pdo, string $apiPath, string $method, ?array $portalSession): bool
{
    if (!preg_match('#^/portal/projects/([^/]+)/milestones/([^/]+)/approve$#', $apiPath, $match)) return false;
    if ($method !== 'POST') jsonResponse(['ok' => false, 'error' => 'Method not allowed.'], 405);
    if (!$portalSession) jsonResponse(['ok' => false, 'error' => 'Client sign-in required.'], 401);

    $clientId = (string)$portalSession['id'];
    $projectId = rawurldecode($match[1]);
    $milestoneId = rawurldecode($match[2]);
    $projectQuery = $pdo->prepare('SELECT p.* FROM client_projects p
        INNER JOIN clients c ON c.id = p.client_id
        WHERE p.id = ? AND p.client_id = ? AND p.deleted_at IS NULL
            AND c.deleted_at IS NULL AND c.merged_into_client_id IS NULL');
    $projectQuery->execute([$projectId, $clientId]);
    $project = $projectQuery->fetch();
    if (!$project) jsonResponse(['ok' => false, 'error' => 'Client project not found.'], 404);

    $milestones = codexFeatureJsonArray($project['milestones'] ?? null);
    $milestoneIndex = null;
    foreach ($milestones as $index => $milestone) {
        if (is_array($milestone) && (string)($milestone['id'] ?? '') === $milestoneId) {
            $milestoneIndex = $index;
            break;
        }
    }
    if ($milestoneIndex === null) jsonResponse(['ok' => false, 'error' => 'Project milestone not found.'], 404);

    $milestone = $milestones[$milestoneIndex];
    if (!empty($milestone['clientApproved'])) {
        $project['milestones'] = $milestones;
        jsonResponse(['ok' => true, 'project' => codexFeatureNormalizeProject($project)]);
    }
    if (strtolower(trim((string)($milestone['status'] ?? ''))) === 'completed') {
        jsonResponse(['ok' => false, 'error' => 'A completed milestone cannot be approved again.'], 409);
    }

    $milestone['clientApproved'] = true;
    $milestone['clientApprovedAt'] = date('c');
    $milestones[$milestoneIndex] = $milestone;
    $pdo->prepare('UPDATE client_projects SET milestones = ?, updated_at = ?
        WHERE id = ? AND client_id = ? AND deleted_at IS NULL')
        ->execute([json_encode($milestones), date('c'), $projectId, $clientId]);

    $updatedQuery = $pdo->prepare('SELECT * FROM client_projects WHERE id = ? AND client_id = ? AND deleted_at IS NULL');
    $updatedQuery->execute([$projectId, $clientId]);
    $updatedProject = $updatedQuery->fetch();
    if (!$updatedProject) jsonResponse(['ok' => false, 'error' => 'Client project could not be reloaded.'], 500);
    jsonResponse(['ok' => true, 'project' => codexFeatureNormalizeProject($updatedProject)]);
}

function codexFeatureHandleClientProjects(PDO $pdo, string $apiPath, string $method, array $input, ?array $adminSession): bool
{
    if ($apiPath === '/admin/client-projects') {
        $actor = requireActiveAdminStaff($pdo, $adminSession);
        if ($method === 'GET') {
            $rows = $pdo->query("SELECT p.*, c.name AS client_name, c.company AS client_company, c.email AS client_email,
                    c.assigned_office_id, c.assigned_team_id, c.assigned_team_leader_id, c.assigned_agent_id
                FROM client_projects p INNER JOIN clients c ON c.id = p.client_id
                WHERE p.deleted_at IS NULL AND c.deleted_at IS NULL AND c.merged_into_client_id IS NULL
                ORDER BY p.updated_at DESC")->fetchAll();
            $projects = [];
            foreach ($rows as $row) {
                if (!actorCanViewLead($actor, $row)) continue;
                $projects[] = codexFeatureNormalizeProject($row);
            }
            jsonResponse(['ok' => true, 'projects' => $projects]);
        }
        if ($method !== 'POST') jsonResponse(['ok' => false, 'error' => 'Method not allowed.'], 405);
        $clientId = trim((string)($input['client_id'] ?? ''));
        if ($clientId === '') jsonResponse(['ok' => false, 'error' => 'Choose a Client for this project.'], 422);
        $client = requireVisibleLead($pdo, $actor, $clientId);
        $name = trim((string)($input['name'] ?? ''));
        if ($name === '' || strlen($name) > 191) jsonResponse(['ok' => false, 'error' => 'Project name is required and must be under 192 characters.'], 422);
        $statusValues = ['Planning', 'In Progress', 'Waiting for Client', 'Review', 'Completed', 'Maintenance'];
        $status = trim((string)($input['status'] ?? 'Planning'));
        if (!in_array($status, $statusValues, true)) jsonResponse(['ok' => false, 'error' => 'Choose a supported project status.'], 422);
        $progress = filter_var($input['progress'] ?? 0, FILTER_VALIDATE_INT);
        if ($progress === false || $progress < 0 || $progress > 100) jsonResponse(['ok' => false, 'error' => 'Progress must be a whole number from 0 to 100.'], 422);
        $id = 'project_' . bin2hex(random_bytes(10));
        $now = date('c');
        $milestones = $input['milestones'] ?? [];
        $updates = $input['recent_updates'] ?? [];
        if (!is_array($milestones) || !is_array($updates)) jsonResponse(['ok' => false, 'error' => 'Milestones and updates must be arrays.'], 422);
        $pdo->prepare('INSERT INTO client_projects (id, client_id, name, description, service, status, progress, start_date, target_date, team_lead, milestones, recent_updates, created_at, updated_at, deleted_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)')
            ->execute([
                $id, $clientId, $name, trim((string)($input['description'] ?? '')),
                trim((string)($input['service'] ?? '')), $status, $progress,
                trim((string)($input['start_date'] ?? '')), trim((string)($input['target_date'] ?? '')),
                trim((string)($input['team_lead'] ?? '')), json_encode($milestones), json_encode($updates), $now, $now,
            ]);
        $query = $pdo->prepare('SELECT p.*, c.name AS client_name, c.company AS client_company, c.email AS client_email FROM client_projects p JOIN clients c ON c.id = p.client_id WHERE p.id = ?');
        $query->execute([$id]);
        jsonResponse(['ok' => true, 'project' => codexFeatureNormalizeProject($query->fetch() ?: [])], 201);
    }

    if (!preg_match('#^/admin/client-projects/([^/]+)$#', $apiPath, $match)) return false;
    $actor = requireActiveAdminStaff($pdo, $adminSession);
    $projectId = rawurldecode($match[1]);
    $query = $pdo->prepare("SELECT p.*, c.assigned_office_id, c.assigned_team_id, c.assigned_team_leader_id, c.assigned_agent_id
        FROM client_projects p INNER JOIN clients c ON c.id = p.client_id WHERE p.id = ? AND p.deleted_at IS NULL AND c.deleted_at IS NULL");
    $query->execute([$projectId]);
    $project = $query->fetch();
    if (!$project) jsonResponse(['ok' => false, 'error' => 'Client project not found.'], 404);
    if (!actorCanViewLead($actor, $project)) jsonResponse(['ok' => false, 'error' => 'You cannot manage projects for this Client.'], 403);

    if ($method === 'DELETE') {
        $pdo->prepare('UPDATE client_projects SET deleted_at = ?, updated_at = ? WHERE id = ?')
            ->execute([date('c'), date('c'), $projectId]);
        jsonResponse(['ok' => true, 'deleted' => true]);
    }
    if ($method !== 'PATCH') jsonResponse(['ok' => false, 'error' => 'Method not allowed.'], 405);
    $allowed = ['client_id', 'name', 'description', 'service', 'status', 'progress', 'start_date', 'target_date', 'team_lead', 'milestones', 'recent_updates'];
    $updates = [];
    foreach ($allowed as $field) {
        if (!array_key_exists($field, $input)) continue;
        if ($field === 'client_id') {
            $targetClientId = trim((string)$input[$field]);
            if ($targetClientId === '') jsonResponse(['ok' => false, 'error' => 'Choose a Client for this project.'], 422);
            requireVisibleLead($pdo, $actor, $targetClientId);
            $updates[$field] = $targetClientId;
        } elseif (in_array($field, ['milestones', 'recent_updates'], true)) {
            if (!is_array($input[$field])) jsonResponse(['ok' => false, 'error' => ucfirst(str_replace('_', ' ', $field)) . ' must be an array.'], 422);
            $updates[$field] = json_encode($input[$field]);
        } elseif ($field === 'progress') {
            $progress = filter_var($input[$field], FILTER_VALIDATE_INT);
            if ($progress === false || $progress < 0 || $progress > 100) jsonResponse(['ok' => false, 'error' => 'Progress must be a whole number from 0 to 100.'], 422);
            $updates[$field] = $progress;
        } elseif ($field === 'status') {
            if (!in_array($input[$field], ['Planning', 'In Progress', 'Waiting for Client', 'Review', 'Completed', 'Maintenance'], true)) {
                jsonResponse(['ok' => false, 'error' => 'Choose a supported project status.'], 422);
            }
            $updates[$field] = $input[$field];
        } else {
            $updates[$field] = trim((string)$input[$field]);
        }
    }
    if (array_key_exists('name', $updates) && ($updates['name'] === '' || strlen($updates['name']) > 191)) {
        jsonResponse(['ok' => false, 'error' => 'Project name is required and must be under 192 characters.'], 422);
    }
    if (!$updates) jsonResponse(['ok' => false, 'error' => 'Provide at least one project field to update.'], 400);
    $set = implode(', ', array_map(static fn(string $key): string => "{$key} = ?", array_keys($updates)));
    $pdo->prepare("UPDATE client_projects SET {$set}, updated_at = ? WHERE id = ?")
        ->execute([...array_values($updates), date('c'), $projectId]);
    $updated = $pdo->prepare('SELECT p.*, c.name AS client_name, c.company AS client_company, c.email AS client_email FROM client_projects p JOIN clients c ON c.id = p.client_id WHERE p.id = ?');
    $updated->execute([$projectId]);
    jsonResponse(['ok' => true, 'project' => codexFeatureNormalizeProject($updated->fetch() ?: [])]);
}

function codexFeatureMergeClient(PDO $pdo, string $sourceId, string $primaryId, string $reviewA, string $reviewB, array $actor): void
{
    if ($sourceId === $primaryId) jsonResponse(['ok' => false, 'error' => 'Choose two different Client records.'], 422);
    $clientQuery = $pdo->prepare('SELECT * FROM clients WHERE id IN (?, ?) AND deleted_at IS NULL AND merged_into_client_id IS NULL');
    $clientQuery->execute([$sourceId, $primaryId]);
    $clients = [];
    foreach ($clientQuery->fetchAll() as $client) $clients[$client['id']] = $client;
    if (!isset($clients[$sourceId], $clients[$primaryId])) jsonResponse(['ok' => false, 'error' => 'Both Client records must still be active.'], 409);
    $source = $clients[$sourceId];
    $primary = $clients[$primaryId];
    foreach (['email', 'phone'] as $identifier) {
        $sourceValue = strtolower(preg_replace('/[^a-z0-9@.+_-]/i', '', trim((string)($source[$identifier] ?? ''))) ?? '');
        $primaryValue = strtolower(preg_replace('/[^a-z0-9@.+_-]/i', '', trim((string)($primary[$identifier] ?? ''))) ?? '');
        if ($sourceValue !== '' && $primaryValue !== '' && $sourceValue !== $primaryValue) {
            jsonResponse(['ok' => false, 'error' => "These Clients have different {$identifier} values. Resolve that conflict before merging."], 409);
        }
    }
    $accessCheck = $pdo->prepare('SELECT COUNT(*) FROM client_portal_access WHERE client_id IN (?, ?)');
    $accessCheck->execute([$sourceId, $primaryId]);
    if ((int)$accessCheck->fetchColumn() > 1) {
        jsonResponse(['ok' => false, 'error' => 'Both Clients have portal accounts. Resolve account access before merging.'], 409);
    }
    $workspaceCheck = $pdo->prepare('SELECT COUNT(*) FROM client_workspaces WHERE user_id IN (?, ?)');
    $workspaceCheck->execute([$sourceId, $primaryId]);
    if ((int)$workspaceCheck->fetchColumn() > 1) {
        jsonResponse(['ok' => false, 'error' => 'Both Clients have separate workspaces. Resolve workspace data before merging.'], 409);
    }

    $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
    $tableRows = $driver === 'sqlite'
        ? $pdo->query("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")->fetchAll(PDO::FETCH_COLUMN)
        : $pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);
    $tablesWithClientId = [];
    foreach ($tableRows as $tableName) {
        $tableName = (string)$tableName;
        if (!preg_match('/^[A-Za-z0-9_]+$/', $tableName) || $tableName === 'clients') continue;
        if (in_array('client_id', databaseColumnNames($pdo, $tableName), true)) $tablesWithClientId[] = $tableName;
    }

    $pdo->beginTransaction();
    try {
        $metadata = $pdo->prepare('SELECT * FROM client_chat_metadata WHERE client_id = ?');
        $metadata->execute([$sourceId]);
        $sourceMetadata = $metadata->fetch();
        $metadata->execute([$primaryId]);
        $primaryMetadata = $metadata->fetch();
        if ($sourceMetadata && $primaryMetadata) {
            $notes = trim((string)$primaryMetadata['notes']);
            $sourceNotes = trim((string)$sourceMetadata['notes']);
            if ($sourceNotes !== '' && $sourceNotes !== $notes) $notes = $notes === '' ? $sourceNotes : $notes . "\n\n" . $sourceNotes;
            $assignedStaff = $primaryMetadata['assigned_staff_id'] ?: $sourceMetadata['assigned_staff_id'];
            $archived = (int)$primaryMetadata['is_archived'] === 1 && (int)$sourceMetadata['is_archived'] === 1 ? 1 : 0;
            $pdo->prepare('UPDATE client_chat_metadata SET notes = ?, assigned_staff_id = ?, is_archived = ?, updated_at = ? WHERE client_id = ?')
                ->execute([$notes, $assignedStaff, $archived, date('c'), $primaryId]);
            $pdo->prepare('DELETE FROM client_chat_metadata WHERE client_id = ?')->execute([$sourceId]);
        }

        foreach ($tablesWithClientId as $tableName) {
            if ($tableName === 'client_chat_metadata') {
                $pdo->prepare('UPDATE client_chat_metadata SET client_id = ? WHERE client_id = ?')->execute([$primaryId, $sourceId]);
                continue;
            }
            $quoted = $driver === 'mysql' ? "`{$tableName}`" : "\"{$tableName}\"";
            $pdo->prepare("UPDATE {$quoted} SET client_id = ? WHERE client_id = ?")->execute([$primaryId, $sourceId]);
        }

        foreach (['messages', 'notifications', 'audit_logs'] as $tableName) {
            if (!in_array('user_id', databaseColumnNames($pdo, $tableName), true)) continue;
            $quoted = $driver === 'mysql' ? "`{$tableName}`" : "\"{$tableName}\"";
            $pdo->prepare("UPDATE {$quoted} SET user_id = ? WHERE user_id = ?")->execute([$primaryId, $sourceId]);
        }
        if (in_array('user_id', databaseColumnNames($pdo, 'client_workspaces'), true)) {
            $pdo->prepare('UPDATE client_workspaces SET user_id = ? WHERE user_id = ?')->execute([$primaryId, $sourceId]);
        }
        if (databaseObjectType($pdo, 'signup_requests') === 'table' && in_array('lead_id', databaseColumnNames($pdo, 'signup_requests'), true)) {
            $pdo->prepare('UPDATE signup_requests SET lead_id = ? WHERE lead_id = ?')->execute([$primaryId, $sourceId]);
        }

        $fill = [];
        foreach (['email', 'phone', 'company', 'address', 'country', 'country_code'] as $field) {
            if (trim((string)($primary[$field] ?? '')) === '' && trim((string)($source[$field] ?? '')) !== '') {
                $fill[$field] = $source[$field];
            }
        }
        if ($fill) {
            $set = implode(', ', array_map(static fn(string $field): string => "{$field} = ?", array_keys($fill)));
            $pdo->prepare("UPDATE clients SET {$set}, updated_at = ? WHERE id = ?")
                ->execute([...array_values($fill), date('c'), $primaryId]);
        }
        $pdo->prepare("UPDATE clients SET deleted_at = ?, merged_into_client_id = ?, stage = 'Merged', status = 'Merged', updated_at = ? WHERE id = ?")
            ->execute([date('c'), $primaryId, date('c'), $sourceId]);

        $pdo->prepare("UPDATE client_identity_reviews
            SET status = 'superseded', reviewed_by = ?, reviewed_at = ?, resolution = ?
            WHERE status = 'pending' AND (client_id_a = ? OR client_id_b = ?)
                AND NOT (client_id_a = ? AND client_id_b = ?)")
            ->execute([$actor['id'], date('c'), 'A referenced Client was merged into ' . $primaryId, $sourceId, $sourceId, $reviewA, $reviewB]);
        $pdo->prepare("UPDATE client_identity_reviews
            SET status = 'merged', reviewed_by = ?, reviewed_at = ?, resolution = ?
            WHERE client_id_a = ? AND client_id_b = ?")
            ->execute([$actor['id'], date('c'), json_encode(['source_client_id' => $sourceId, 'primary_client_id' => $primaryId]), $reviewA, $reviewB]);
        $pdo->prepare('INSERT INTO audit_logs (id, user_id, action, details, created_at) VALUES (?, ?, ?, ?, ?)')
            ->execute([
                'aud_' . bin2hex(random_bytes(8)),
                $primaryId,
                'CLIENT_IDENTITY_MERGED',
                "Client {$sourceId} was merged into {$primaryId} after Super Admin identity review.",
                date('c'),
            ]);
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}

function codexFeatureHandleIdentityReviews(PDO $pdo, string $apiPath, string $method, array $input, ?array $adminSession): bool
{
    if ($apiPath === '/admin/client-identity-reviews') {
        requireSuperAdmin($pdo, $adminSession);
        if ($method !== 'GET') jsonResponse(['ok' => false, 'error' => 'Method not allowed.'], 405);
        $status = trim((string)($_GET['status'] ?? 'pending'));
        $sql = "SELECT r.*, a.name AS client_a_name, a.company AS client_a_company, a.email AS client_a_email, a.phone AS client_a_phone,
                b.name AS client_b_name, b.company AS client_b_company, b.email AS client_b_email, b.phone AS client_b_phone,
                reviewer.name AS reviewed_by_name
            FROM client_identity_reviews r
            LEFT JOIN clients a ON a.id = r.client_id_a
            LEFT JOIN clients b ON b.id = r.client_id_b
            LEFT JOIN staff_users reviewer ON reviewer.id = r.reviewed_by";
        $params = [];
        if ($status !== 'all') {
            $sql .= ' WHERE r.status = ?';
            $params[] = $status;
        }
        $sql .= ' ORDER BY CASE WHEN r.status = \'pending\' THEN 0 ELSE 1 END, r.created_at DESC LIMIT 500';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        jsonResponse(['ok' => true, 'reviews' => $stmt->fetchAll()]);
    }
    if (!preg_match('#^/admin/client-identity-reviews/([^/]+)/([^/]+)$#', $apiPath, $match)) return false;
    requireSuperAdmin($pdo, $adminSession);
    $actor = requireActiveAdminStaff($pdo, $adminSession);
    if ($method !== 'POST') jsonResponse(['ok' => false, 'error' => 'Method not allowed.'], 405);
    $a = rawurldecode($match[1]);
    $b = rawurldecode($match[2]);
    if ($a === $b) jsonResponse(['ok' => false, 'error' => 'Choose two different Client records.'], 422);
    $reviewQuery = $pdo->prepare('SELECT * FROM client_identity_reviews WHERE client_id_a = ? AND client_id_b = ?');
    $reviewQuery->execute([$a, $b]);
    $review = $reviewQuery->fetch();
    if (!$review) {
        $reviewQuery->execute([$b, $a]);
        $review = $reviewQuery->fetch();
        if (!$review) jsonResponse(['ok' => false, 'error' => 'Identity review not found.'], 404);
        [$a, $b] = [$b, $a];
    }
    if ($review['status'] !== 'pending') jsonResponse(['ok' => false, 'error' => 'This identity review has already been resolved.'], 409);
    $decision = trim((string)($input['decision'] ?? ''));
    if ($decision === 'distinct') {
        $pdo->prepare("UPDATE client_identity_reviews SET status = 'resolved_distinct', reviewed_by = ?, reviewed_at = ?, resolution = 'reviewed_as_distinct_clients' WHERE client_id_a = ? AND client_id_b = ? AND status = 'pending'")
            ->execute([$actor['id'], date('c'), $a, $b]);
        jsonResponse(['ok' => true, 'status' => 'resolved_distinct']);
    }
    if ($decision !== 'merge') jsonResponse(['ok' => false, 'error' => 'Choose whether the records are distinct or should be merged.'], 422);
    $primaryId = trim((string)($input['primary_client_id'] ?? ''));
    if (!in_array($primaryId, [$a, $b], true)) jsonResponse(['ok' => false, 'error' => 'Choose one of the reviewed Clients to keep.'], 422);
    $sourceId = $primaryId === $a ? $b : $a;
    try {
        codexFeatureMergeClient($pdo, $sourceId, $primaryId, $a, $b, $actor);
    } catch (Throwable $error) {
        error_log('[client-identity-review] merge blocked: ' . $error->getMessage());
        jsonResponse(['ok' => false, 'error' => 'The Clients could not be merged safely. No data was changed. Review the records and resolve any conflicting identifiers, portal accounts, workspaces, or related-record constraints first.'], 409);
    }
    jsonResponse(['ok' => true, 'status' => 'merged', 'primary_client_id' => $primaryId, 'merged_client_id' => $sourceId]);
}

function codexFeatureHandleVisitorChat(PDO $pdo, string $apiPath, string $method, array $input): bool
{
    if (!in_array($apiPath, ['/crm/chat/messages', '/crm/chat/import'], true)) return false;
    if (!in_array($method, ['GET', 'POST'], true)) jsonResponse(['ok' => false, 'error' => 'Method not allowed.'], 405);
    $token = trim((string)($_SERVER['HTTP_X_CHAT_TOKEN'] ?? ''));
    if (!preg_match('/^[A-Za-z0-9-]{32,128}$/', $token)) jsonResponse(['ok' => false, 'error' => 'A valid chat session token is required.'], 401);
    $tokenHash = hash('sha256', $token);
    $sessionQuery = $pdo->prepare('SELECT client_id FROM visitor_chat_sessions WHERE token_hash = ?');
    $sessionQuery->execute([$tokenHash]);
    $clientId = $sessionQuery->fetchColumn();

    if ($method === 'GET') {
        if (!$clientId) jsonResponse(['ok' => true, 'messages' => []]);
        $stmt = $pdo->prepare('SELECT id, sender, sender_name, body, is_read, created_at FROM messages WHERE user_id = ? ORDER BY created_at DESC LIMIT 100');
        $stmt->execute([$clientId]);
        $messages = array_reverse($stmt->fetchAll());
        jsonResponse(['ok' => true, 'messages' => $messages]);
    }

    $pdo->beginTransaction();
    try {
        if (!$clientId) {
            $clientId = codexFeatureCreateClientFromChat($pdo, 'Website visitor', '', 'website_chat');
            $pdo->prepare('INSERT INTO visitor_chat_sessions (token_hash, client_id, created_at, last_message_at) VALUES (?, ?, ?, NULL)')
                ->execute([$tokenHash, $clientId, date('c')]);
        }

        if ($apiPath === '/crm/chat/import') {
            $legacyMessages = $input['messages'] ?? null;
            if (!is_array($legacyMessages) || count($legacyMessages) > 500) jsonResponse(['ok' => false, 'error' => 'Provide at most 500 legacy chat messages.'], 422);
            $imported = 0;
            foreach ($legacyMessages as $legacyMessage) {
                if (!is_array($legacyMessage)) continue;
                $body = trim((string)($legacyMessage['message'] ?? $legacyMessage['body'] ?? $legacyMessage['text'] ?? ''));
                if ($body === '' || strlen($body) > 5000) continue;
                $legacyId = trim((string)($legacyMessage['id'] ?? hash('sha256', $body . ':' . ($legacyMessage['created_at'] ?? ''))));
                $legacySender = strtolower(trim((string)($legacyMessage['sender'] ?? 'client')));
                $sender = in_array($legacySender, ['agent', 'operator', 'staff'], true) ? 'agent' : 'client';
                $senderName = trim((string)($legacyMessage['sender_name'] ?? $legacyMessage['senderName'] ?? ($sender === 'agent' ? 'Codex Support' : 'Website visitor')));
                $sourceKey = 'visitor:' . $tokenHash . ':' . substr(hash('sha256', $legacyId), 0, 48);
                $before = $pdo->prepare('SELECT 1 FROM client_chat_imports WHERE source_key = ?');
                $before->execute([$sourceKey]);
                if ($before->fetchColumn()) continue;
                codexFeatureStoreChatMessage(
                    $pdo,
                    (string)$clientId,
                    $sender,
                    $senderName,
                    $body,
                    codexFeatureDate($legacyMessage['created_at'] ?? $legacyMessage['createdAt'] ?? null),
                    $sourceKey
                );
                $imported++;
            }
            $pdo->prepare('UPDATE visitor_chat_sessions SET last_message_at = ? WHERE token_hash = ?')->execute([date('c'), $tokenHash]);
            $pdo->commit();
            jsonResponse(['ok' => true, 'imported' => $imported]);
        }

        $body = trim((string)($input['message'] ?? $input['body'] ?? ''));
        if ($body === '' || strlen($body) > 5000) jsonResponse(['ok' => false, 'error' => 'Messages must contain 1–5,000 characters.'], 422);
        $message = codexFeatureWriteClientMessage($pdo, (string)$clientId, $body);
        $pdo->prepare('UPDATE visitor_chat_sessions SET last_message_at = ? WHERE token_hash = ?')->execute([date('c'), $tokenHash]);
        $pdo->commit();
        jsonResponse(['ok' => true, 'message' => $message], 201);
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}

function codexFeatureHandleAdminChat(PDO $pdo, string $apiPath, string $method, array $input, ?array $adminSession): bool
{
    if ($apiPath === '/admin/messages/threads') {
        $actor = requireAdminCapability($pdo, $adminSession, 'chat');
        if ($method !== 'GET') jsonResponse(['ok' => false, 'error' => 'Method not allowed.'], 405);
        $includeArchived = filter_var($_GET['include_archived'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $sql = "SELECT c.*, m.status AS chat_status, m.is_archived, m.notes AS chat_notes, m.assigned_staff_id,
                (SELECT id FROM messages last WHERE last.user_id = c.id ORDER BY last.created_at DESC, last.id DESC LIMIT 1) AS last_message_id,
                (SELECT MAX(last_at.created_at) FROM messages last_at WHERE last_at.user_id = c.id) AS last_message_at,
                (SELECT MIN(first_at.created_at) FROM messages first_at WHERE first_at.user_id = c.id) AS first_message_at,
                (SELECT COUNT(*) FROM messages unread WHERE unread.user_id = c.id AND unread.sender = 'client' AND unread.is_read = 0) AS unread_count
            FROM clients c LEFT JOIN client_chat_metadata m ON m.client_id = c.id
            WHERE c.deleted_at IS NULL AND c.merged_into_client_id IS NULL
                AND (m.client_id IS NOT NULL OR EXISTS (SELECT 1 FROM messages any_message WHERE any_message.user_id = c.id))
                AND (? = 1 OR COALESCE(m.is_archived, 0) = 0)
            ORDER BY COALESCE((SELECT MAX(last_at.created_at) FROM messages last_at WHERE last_at.user_id = c.id), m.updated_at) DESC
            LIMIT 200";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$includeArchived ? 1 : 0]);
        $rows = $stmt->fetchAll();
        $visible = [];
        $clientIds = [];
        foreach ($rows as $row) {
            if (!actorCanViewLead($actor, $row)) continue;
            $visible[] = $row;
            $clientIds[] = $row['id'];
        }
        $lastMessages = [];
        if ($clientIds) {
            $placeholders = implode(',', array_fill(0, count($clientIds), '?'));
            $messageStmt = $pdo->prepare("SELECT id, user_id, sender, sender_name, body, is_read, created_at
                FROM messages WHERE user_id IN ({$placeholders}) ORDER BY created_at DESC, id DESC");
            $messageStmt->execute($clientIds);
            foreach ($messageStmt->fetchAll() as $message) {
                if (!isset($lastMessages[$message['user_id']])) $lastMessages[$message['user_id']] = $message;
            }
        }
        $staffNames = [];
        $staffIds = array_values(array_unique(array_filter(array_column($visible, 'assigned_staff_id'))));
        if ($staffIds) {
            $placeholders = implode(',', array_fill(0, count($staffIds), '?'));
            $staffStmt = $pdo->prepare("SELECT id, name FROM staff_users WHERE id IN ({$placeholders})");
            $staffStmt->execute($staffIds);
            foreach ($staffStmt->fetchAll() as $staff) $staffNames[$staff['id']] = $staff['name'];
        }
        $threads = [];
        foreach ($visible as $row) {
            $message = $lastMessages[$row['id']] ?? null;
            $status = $row['is_archived'] ? 'archived' : (($message['sender'] ?? '') === 'client' ? 'waiting' : 'active');
            $threads[] = [
                'id' => $row['id'],
                'client_id' => $row['id'],
                'visitor_name' => $row['name'] ?: trim(($row['first_name'] ?? '') . ' ' . ($row['last_name'] ?? '')),
                'visitor_email' => $row['email'] ?? '',
                'company' => $row['company'] ?? '',
                'channel' => ($row['source'] ?? '') === 'website_chat' ? 'Website chat' : 'Client portal',
                'status' => $status,
                'is_archived' => (bool)$row['is_archived'],
                'assigned_staff_id' => $row['assigned_staff_id'] ?? null,
                'assigned_agent' => $staffNames[$row['assigned_staff_id'] ?? ''] ?? 'Unassigned',
                'notes' => $row['chat_notes'] ?? '',
                'unread_count' => (int)$row['unread_count'],
                'created_at' => $row['first_message_at'] ?? $row['created_at'],
                'last_message_at' => $row['last_message_at'] ?? $row['chat_updated_at'] ?? null,
                'last_message' => $message ? [
                    'id' => $message['id'],
                    'sender' => $message['sender'],
                    'sender_name' => $message['sender_name'],
                    'text' => $message['body'],
                    'created_at' => $message['created_at'],
                ] : null,
            ];
        }
        jsonResponse(['ok' => true, 'threads' => $threads]);
    }

    if ($apiPath === '/admin/messages/threads/import') {
        requireSuperAdmin($pdo, $adminSession);
        if ($method !== 'POST') jsonResponse(['ok' => false, 'error' => 'Method not allowed.'], 405);
        $legacyThreads = $input['threads'] ?? null;
        if (!is_array($legacyThreads) || count($legacyThreads) > 200) jsonResponse(['ok' => false, 'error' => 'Provide at most 200 legacy threads.'], 422);
        $importedThreads = 0;
        $importedMessages = 0;
        $skipped = [];
        foreach ($legacyThreads as $thread) {
            if (!is_array($thread)) continue;
            $legacyId = trim((string)($thread['id'] ?? hash('sha256', json_encode($thread))));
            $email = strtolower(trim((string)($thread['visitor_email'] ?? $thread['email'] ?? '')));
            $name = trim((string)($thread['visitor_name'] ?? $thread['name'] ?? 'Website visitor'));
            $clientId = null;
            if ($email !== '') {
                $matches = $pdo->prepare("SELECT id FROM clients WHERE LOWER(TRIM(email)) = ? AND deleted_at IS NULL AND merged_into_client_id IS NULL ORDER BY id");
                $matches->execute([$email]);
                $clientMatches = $matches->fetchAll(PDO::FETCH_COLUMN);
                if (count($clientMatches) > 1) {
                    for ($i = 0; $i < count($clientMatches); $i++) {
                        for ($j = $i + 1; $j < count($clientMatches); $j++) {
                            codexFeatureInsertReview($pdo, (string)$clientMatches[$i], (string)$clientMatches[$j], 'A browser-only chat thread matches multiple Clients by email; review before importing.');
                        }
                    }
                    $skipped[] = ['thread_id' => $legacyId, 'reason' => 'Email matches multiple Clients; identity review required.'];
                    continue;
                }
                if (count($clientMatches) === 1) {
                    $clientId = (string)$clientMatches[0];
                    $client = $pdo->prepare('SELECT name FROM clients WHERE id = ?');
                    $client->execute([$clientId]);
                    if (strtolower(trim((string)$client->fetchColumn())) !== strtolower($name)) {
                        codexFeatureInsertReview($pdo, $clientId, $clientId . '_legacy_chat_' . substr(hash('sha256', $legacyId), 0, 20), 'Chat name differs from the matched Client record; confirm identity before importing.');
                        $skipped[] = ['thread_id' => $legacyId, 'reason' => 'Matched Client has a different name; identity review required.'];
                        continue;
                    }
                }
            }
            if ($clientId === null) {
                $clientId = codexFeatureCreateClientFromChat($pdo, $name, $email, 'legacy_chat_import');
            }
            $messages = $thread['messages'] ?? [];
            if (!is_array($messages) || count($messages) > 500) {
                $skipped[] = ['thread_id' => $legacyId, 'reason' => 'Thread must contain at most 500 messages.'];
                continue;
            }
            $metadata = $pdo->prepare('SELECT client_id FROM client_chat_metadata WHERE client_id = ?');
            $metadata->execute([$clientId]);
            $isArchived = filter_var($thread['is_archived'] ?? false, FILTER_VALIDATE_BOOLEAN) ? 1 : 0;
            $status = in_array(($thread['status'] ?? ''), ['active', 'waiting'], true) ? $thread['status'] : 'active';
            $notes = trim((string)($thread['notes'] ?? ''));
            $assignedName = trim((string)($thread['assigned_agent'] ?? $thread['assignedAgent'] ?? ''));
            $assignedStaffId = null;
            if ($assignedName !== '' && strcasecmp($assignedName, 'unassigned') !== 0) {
                $staff = $pdo->prepare('SELECT id FROM staff_users WHERE LOWER(TRIM(name)) = LOWER(?) AND deleted_at IS NULL LIMIT 1');
                $staff->execute([$assignedName]);
                $assignedStaffId = $staff->fetchColumn() ?: null;
            }
            if ($metadata->fetchColumn()) {
                $pdo->prepare('UPDATE client_chat_metadata SET status = ?, is_archived = ?, notes = ?, assigned_staff_id = COALESCE(?, assigned_staff_id), updated_at = ? WHERE client_id = ?')
                    ->execute([$status, $isArchived, $notes, $assignedStaffId, date('c'), $clientId]);
            } else {
                $pdo->prepare('INSERT INTO client_chat_metadata (client_id, status, is_archived, notes, assigned_staff_id, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
                    ->execute([$clientId, $status, $isArchived, $notes, $assignedStaffId, date('c')]);
            }
            foreach ($messages as $message) {
                if (!is_array($message)) continue;
                $body = trim((string)($message['message'] ?? $message['body'] ?? $message['text'] ?? ''));
                if ($body === '' || strlen($body) > 5000) continue;
                $oldMessageId = trim((string)($message['id'] ?? hash('sha256', $body . ':' . ($message['created_at'] ?? ''))));
                $legacySender = strtolower(trim((string)($message['sender'] ?? 'client')));
                $sender = in_array($legacySender, ['agent', 'operator', 'staff'], true) ? 'agent' : (in_array($legacySender, ['system', 'bot'], true) ? 'system' : 'client');
                $senderName = trim((string)($message['sender_name'] ?? $message['senderName'] ?? ($sender === 'client' ? $name : 'Codex Support')));
                $sourceKey = 'admin:' . substr(hash('sha256', $legacyId), 0, 32) . ':' . substr(hash('sha256', $oldMessageId), 0, 32);
                $before = $pdo->prepare('SELECT 1 FROM client_chat_imports WHERE source_key = ?');
                $before->execute([$sourceKey]);
                if ($before->fetchColumn()) continue;
                codexFeatureStoreChatMessage(
                    $pdo,
                    $clientId,
                    $sender,
                    $senderName,
                    $body,
                    codexFeatureDate($message['created_at'] ?? $message['createdAt'] ?? null),
                    $sourceKey
                );
                $importedMessages++;
            }
            $importedThreads++;
        }
        jsonResponse(['ok' => true, 'imported_threads' => $importedThreads, 'imported_messages' => $importedMessages, 'skipped' => $skipped]);
    }

    if (preg_match('#^/admin/messages/threads/([^/]+)$#', $apiPath, $match)) {
        $actor = requireAdminCapability($pdo, $adminSession, 'chat');
        if (!in_array($method, ['PATCH', 'POST'], true)) jsonResponse(['ok' => false, 'error' => 'Method not allowed.'], 405);
        $clientId = rawurldecode($match[1]);
        $client = requireVisibleLead($pdo, $actor, $clientId);
        $metadata = $pdo->prepare('SELECT * FROM client_chat_metadata WHERE client_id = ?');
        $metadata->execute([$clientId]);
        $current = $metadata->fetch() ?: null;
        $status = trim((string)($input['status'] ?? ($current['status'] ?? 'active')));
        if (!in_array($status, ['active', 'waiting'], true)) jsonResponse(['ok' => false, 'error' => 'Choose active or waiting status.'], 422);
        $archived = array_key_exists('is_archived', $input)
            ? (filter_var($input['is_archived'], FILTER_VALIDATE_BOOLEAN) ? 1 : 0)
            : (int)($current['is_archived'] ?? 0);
        $notes = array_key_exists('notes', $input) ? trim((string)$input['notes']) : (string)($current['notes'] ?? '');
        if (strlen($notes) > 10000) jsonResponse(['ok' => false, 'error' => 'Thread notes must be under 10,000 characters.'], 422);
        $assignedStaffId = array_key_exists('assigned_staff_id', $input)
            ? (trim((string)$input['assigned_staff_id']) ?: null)
            : ($current['assigned_staff_id'] ?? null);
        if ($assignedStaffId !== null) {
            $staffCheck = $pdo->prepare("SELECT id FROM staff_users WHERE id = ? AND deleted_at IS NULL AND status = 'Active'");
            $staffCheck->execute([$assignedStaffId]);
            if (!$staffCheck->fetchColumn()) jsonResponse(['ok' => false, 'error' => 'Choose an active staff member for assignment.'], 422);
        }
        if ($current) {
            $pdo->prepare('UPDATE client_chat_metadata SET status = ?, is_archived = ?, notes = ?, assigned_staff_id = ?, updated_at = ? WHERE client_id = ?')
                ->execute([$status, $archived, $notes, $assignedStaffId, date('c'), $clientId]);
        } else {
            $pdo->prepare('INSERT INTO client_chat_metadata (client_id, status, is_archived, notes, assigned_staff_id, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
                ->execute([$clientId, $status, $archived, $notes, $assignedStaffId, date('c')]);
        }
        jsonResponse(['ok' => true, 'thread' => [
            'id' => $clientId,
            'client_id' => $clientId,
            'visitor_name' => $client['name'],
            'status' => $archived ? 'archived' : $status,
            'is_archived' => (bool)$archived,
            'assigned_staff_id' => $assignedStaffId,
            'notes' => $notes,
        ]]);
    }
    return false;
}

function codexFeatureHandlePassword(PDO $pdo, string $apiPath, string $method, array $input, ?array $adminSession): bool
{
    if ($apiPath !== '/admin/me/password') return false;
    if ($method !== 'PUT' && $method !== 'POST') jsonResponse(['ok' => false, 'error' => 'Method not allowed.'], 405);
    $actor = requireActiveAdminStaff($pdo, $adminSession);
    $currentPassword = (string)($input['current_password'] ?? '');
    $newPassword = (string)($input['new_password'] ?? '');
    $passwordQuery = $pdo->prepare('SELECT password FROM staff_users WHERE id = ?');
    $passwordQuery->execute([$actor['id']]);
    $currentHash = (string)$passwordQuery->fetchColumn();
    if ($currentPassword === '' || !password_verify($currentPassword, $currentHash)) {
        jsonResponse(['ok' => false, 'error' => 'Current password is incorrect.'], 403);
    }
    if (strlen($newPassword) < 12 || strlen($newPassword) > 4096) {
        jsonResponse(['ok' => false, 'error' => 'New password must be at least 12 characters.'], 422);
    }
    if (password_verify($newPassword, $currentHash)) {
        jsonResponse(['ok' => false, 'error' => 'Choose a new password that differs from your current password.'], 422);
    }
    $hash = password_hash($newPassword, PASSWORD_DEFAULT);
    if ($hash === false) jsonResponse(['ok' => false, 'error' => 'Could not update the password.'], 500);
    $pdo->prepare('UPDATE staff_users SET password = ? WHERE id = ?')->execute([$hash, $actor['id']]);
    $sessionTokenHash = (string)($adminSession['token_hash'] ?? '');
    if ($sessionTokenHash !== '') {
        $pdo->prepare('DELETE FROM admin_sessions WHERE user_id = ? AND token_hash <> ?')->execute([$actor['id'], $sessionTokenHash]);
    } else {
        $pdo->prepare('DELETE FROM admin_sessions WHERE user_id = ?')->execute([$actor['id']]);
    }
    $pdo->prepare('INSERT INTO audit_logs (id, user_id, action, details, created_at) VALUES (?, ?, ?, ?, ?)')
        ->execute(['aud_' . bin2hex(random_bytes(8)), $actor['id'], 'ADMIN_PASSWORD_CHANGED', 'Staff member changed their own password.', date('c')]);
    jsonResponse(['ok' => true, 'message' => 'Password updated.']);
}

function codexFeatureWebhookUrl(array $siteConfig): string
{
    $security = is_array($siteConfig['security'] ?? null) ? $siteConfig['security'] : [];
    return trim((string)($security['webhookUrl'] ?? $security['webhook_url'] ?? $siteConfig['webhookUrl'] ?? ''));
}

function codexFeatureValidateWebhookUrl(string $url): array
{
    if (strlen($url) > 2048) jsonResponse(['ok' => false, 'error' => 'Webhook URL is too long.'], 422);
    $parts = parse_url($url);
    if (!$parts || strtolower((string)($parts['scheme'] ?? '')) !== 'https' || empty($parts['host']) || isset($parts['user']) || isset($parts['pass'])) {
        jsonResponse(['ok' => false, 'error' => 'Use a public HTTPS webhook URL without embedded credentials.'], 422);
    }
    $host = strtolower(rtrim((string)$parts['host'], '.'));
    if ($host === 'localhost' || str_ends_with($host, '.localhost') || str_ends_with($host, '.local')) {
        jsonResponse(['ok' => false, 'error' => 'Local and private webhook hosts are not allowed.'], 422);
    }
    $ips = gethostbynamel($host) ?: [];
    if (!$ips) jsonResponse(['ok' => false, 'error' => 'Webhook host did not resolve to a public IPv4 address.'], 422);
    foreach ($ips as $ip) {
        if (!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
            jsonResponse(['ok' => false, 'error' => 'Webhook host resolves to a private or reserved address.'], 422);
        }
    }
    return [$parts, $host, (string)$ips[0]];
}

function codexFeatureHandleWebhook(PDO $pdo, string $apiPath, string $method, array $input, ?array $adminSession): bool
{
    if (!in_array($apiPath, ['/admin/settings/webhook', '/admin/settings/webhook-test'], true)) return false;
    requireSuperAdmin($pdo, $adminSession);
    if ($apiPath === '/admin/settings/webhook') {
        if ($method === 'GET') {
            $record = readPlatformSettingsRecord($pdo);
            $siteConfig = is_array($record['site_config'] ?? null) ? $record['site_config'] : [];
            jsonResponse(['ok' => true, 'url' => codexFeatureWebhookUrl($siteConfig)]);
        }
        if ($method !== 'PATCH') jsonResponse(['ok' => false, 'error' => 'Method not allowed.'], 405);
        $url = trim((string)($input['url'] ?? ''));
        if ($url !== '') codexFeatureValidateWebhookUrl($url);
        $record = readPlatformSettingsRecord($pdo);
        $siteConfig = is_array($record['site_config'] ?? null) ? $record['site_config'] : [];
        $security = is_array($siteConfig['security'] ?? null) ? $siteConfig['security'] : [];
        $security['webhookUrl'] = $url;
        $siteConfig['security'] = $security;
        savePlatformSettingsRecord($pdo, $adminSession['id'], $record['settings'] ?? [], $siteConfig);
        jsonResponse(['ok' => true, 'url' => $url]);
    }
    if ($method !== 'POST') jsonResponse(['ok' => false, 'error' => 'Method not allowed.'], 405);
    $record = readPlatformSettingsRecord($pdo);
    $siteConfig = is_array($record['site_config'] ?? null) ? $record['site_config'] : [];
    $url = codexFeatureWebhookUrl($siteConfig);
    if ($url === '') jsonResponse(['ok' => false, 'error' => 'Save a webhook URL before sending a test.'], 422);
    [$parts, $host, $ip] = codexFeatureValidateWebhookUrl($url);
    if (!function_exists('curl_init')) jsonResponse(['ok' => false, 'error' => 'Webhook tests are unavailable because cURL is not enabled on this server.'], 503);
    $port = (int)($parts['port'] ?? 443);
    $handle = curl_init($url);
    if ($handle === false) jsonResponse(['ok' => false, 'error' => 'Could not initialize the webhook request.'], 503);
    $payload = json_encode(['event' => 'codex.webhook.test', 'sent_at' => date('c')]);
    curl_setopt_array($handle, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Accept: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_MAXREDIRS => 0,
        CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
        CURLOPT_RESOLVE => ["{$host}:{$port}:{$ip}"],
        CURLOPT_USERAGENT => 'CodexDynamics-Webhook-Test/1.0',
    ]);
    $response = curl_exec($handle);
    $status = (int)curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
    $error = curl_error($handle);
    curl_close($handle);
    if ($response === false) jsonResponse(['ok' => false, 'error' => $error !== '' ? $error : 'Webhook request failed.'], 502);
    if ($status < 200 || $status >= 300) jsonResponse(['ok' => false, 'error' => "Webhook returned HTTP {$status}."], 502);
    jsonResponse(['ok' => true, 'status' => $status]);
}

function handleCodexDynamicsFeatureRoutes(PDO $pdo, string $apiPath, string $method, array $input, ?array $adminSession, ?array $portalSession): void
{
    if (codexFeatureHandlePortalMilestoneApproval($pdo, $apiPath, $method, $portalSession)) return;
    if (codexFeatureHandleStaffNotes($pdo, $apiPath, $method, $input, $adminSession)) return;
    if (codexFeatureHandleBlogCategories($pdo, $apiPath, $method, $input, $adminSession)) return;
    if (codexFeatureHandleClientProjects($pdo, $apiPath, $method, $input, $adminSession)) return;
    if (codexFeatureHandleIdentityReviews($pdo, $apiPath, $method, $input, $adminSession)) return;
    if (codexFeatureHandleVisitorChat($pdo, $apiPath, $method, $input)) return;
    if (codexFeatureHandleAdminChat($pdo, $apiPath, $method, $input, $adminSession)) return;
    if (codexFeatureHandlePassword($pdo, $apiPath, $method, $input, $adminSession)) return;
    if (codexFeatureHandleWebhook($pdo, $apiPath, $method, $input, $adminSession)) return;
}