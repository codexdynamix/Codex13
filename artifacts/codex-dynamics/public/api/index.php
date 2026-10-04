<?php
/**
 * Codex Dynamics - Unified REST API Router for Hostinger Apache/PHP
 */

declare(strict_types=1);

require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/lead-access.php';
require_once __DIR__ . '/lib/hostinger-mail.php';
require_once __DIR__ . '/lib/core.php';
require_once __DIR__ . '/lib/route-helpers.php';
require_once __DIR__ . '/lib/feature-routes.php';

$pdo = getDb();
$method = $_SERVER['REQUEST_METHOD'];
$uri = $_SERVER['REQUEST_URI'];
$path = parse_url($uri, PHP_URL_PATH);

// Normalize path relative to /api/
$apiPath = preg_replace('#^.*?/api/?#', '/', $path);
$apiPath = '/' . ltrim($apiPath, '/');
$apiPath = preg_replace('#\.php$#', '', $apiPath);

$input = json_decode(file_get_contents('php://input') ?: '[]', true) ?: [];

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

class AccountingActionException extends RuntimeException {}

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
    $token = bearerToken(PORTAL_SESSION_COOKIE);
    clearSessionCookie(PORTAL_SESSION_COOKIE);
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

// Route groups run in order; each exits via jsonResponse() when it matches.
require __DIR__ . '/routes/01-public-website-content.php';
require __DIR__ . '/routes/02-lead-intake.php';
require __DIR__ . '/routes/03-crm-actions.php';
require __DIR__ . '/routes/04-admin-client-search.php';
require __DIR__ . '/routes/05-admin-set-client-password-view-password.php';
require __DIR__ . '/routes/06-admin-notifications.php';
require __DIR__ . '/routes/07-admin-client-support-chat.php';
require __DIR__ . '/routes/08-client-activity-audit-log.php';
require __DIR__ . '/routes/09-admin-offices-management.php';
require __DIR__ . '/routes/10-admin-teams-management.php';
require __DIR__ . '/routes/11-admin-staff.php';
require __DIR__ . '/routes/12-admin-lead-assignment.php';
require __DIR__ . '/routes/13-authentication-staff-login.php';
require __DIR__ . '/routes/14-authentication-client-portal-login.php';
require __DIR__ . '/routes/15-client-portal-complete-dashboard-data.php';
require __DIR__ . '/routes/16-client-portal-support-tickets.php';

// Unknown routes must fail explicitly instead of looking like successful API calls.
handleCodexDynamicsFeatureRoutes($pdo, $apiPath, $method, $input, $adminSession ?? null, $portalSession ?? null);
jsonResponse(['ok' => false, 'error' => 'API route not found'], 404);
