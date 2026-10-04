<?php
/** Route group: CRM ACTIONS (Blog save/toggle, Project save/toggle/hide, Image uploads) (included by index.php in order; uses its request globals). */

declare(strict_types=1);

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
