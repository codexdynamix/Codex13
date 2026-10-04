<?php
/** Route group: PUBLIC WEBSITE CONTENT (Live projects, client reviews, published blogs) (included by index.php in order; uses its request globals). */

declare(strict_types=1);

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
