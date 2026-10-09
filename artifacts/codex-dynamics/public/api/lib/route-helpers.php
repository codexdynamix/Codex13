<?php
/** Helpers shared by route groups (site content, notifications). */

declare(strict_types=1);

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
