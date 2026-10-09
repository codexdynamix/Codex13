<?php
/**
 * Server-side Hostinger Mail API integration.
 *
 * The provider token is stored only as an authenticated-encrypted value in
 * hostinger_mail_integrations. Portal requests are authorized against the
 * authenticated client session and an enabled mailbox assignment before any
 * provider request is made.
 */

declare(strict_types=1);

final class HostingerMailApiException extends RuntimeException {
    public function __construct(
        public readonly int $providerStatus,
        public readonly string $providerCode = ''
    ) {
        parent::__construct('Hostinger Mail API request failed.');
    }
}

function hostingerMailNow(): string {
    return date('c');
}

function hostingerMailIntegration(PDO $pdo): ?array {
    $stmt = $pdo->prepare("SELECT * FROM hostinger_mail_integrations WHERE id = 'primary' LIMIT 1");
    $stmt->execute();
    $row = $stmt->fetch();
    return $row ?: null;
}

function hostingerMailRecordStatus(PDO $pdo, string $status, ?string $errorCode = null, bool $tested = false, ?array $account = null): void {
    $row = hostingerMailIntegration($pdo);
    if (!$row) return;

    $now = hostingerMailNow();
    $set = ['status = ?', 'last_error_code = ?', 'updated_at = ?'];
    $values = [$status, $errorCode, $now];
    if ($tested) {
        $set[] = 'last_tested_at = ?';
        $values[] = $now;
    }
    if ($status === 'connected') {
        $set[] = 'last_success_at = ?';
        $values[] = $now;
        if ($account !== null) {
            $set[] = 'mailbox_count = ?';
            $values[] = count($account['mailboxes'] ?? []);
            $set[] = 'order_resource_id = ?';
            $values[] = (string)($account['orderResourceId'] ?? '');
        }
    }
    $values[] = 'primary';
    $pdo->prepare('UPDATE hostinger_mail_integrations SET ' . implode(', ', $set) . ' WHERE id = ?')->execute($values);
}

function hostingerMailToken(PDO $pdo): string {
    $row = hostingerMailIntegration($pdo);
    if (!$row || empty($row['encrypted_token'])) {
        throw new RuntimeException('Hostinger Mail API is not configured.');
    }
    $token = decryptClientSecret((string)$row['encrypted_token']);
    if ($token === '') throw new RuntimeException('Hostinger Mail API is not configured.');
    return $token;
}

function hostingerMailApiBaseUrl(): string {
    $testUrl = trim((string)(getenv('HOSTINGER_MAIL_TEST_BASE_URL') ?: ''));
    if (getenv('NODE_ENV') === 'test' && $testUrl !== '') {
        $parts = parse_url($testUrl);
        $allowedHosts = ['127.0.0.1', 'localhost', '::1'];
        if (
            !is_array($parts)
            || ($parts['scheme'] ?? '') !== 'http'
            || !in_array($parts['host'] ?? '', $allowedHosts, true)
            || !isset($parts['port'])
            || $parts['port'] < 1
            || $parts['port'] > 65535
            || isset($parts['user'])
            || isset($parts['pass'])
            || isset($parts['query'])
            || isset($parts['fragment'])
            || !in_array($parts['path'] ?? '', ['', '/'], true)
        ) {
            throw new InvalidArgumentException('The Hostinger test endpoint must be a local HTTP URL.');
        }
        return rtrim($testUrl, '/');
    }
    return 'https://api.mail.hostinger.com';
}

function hostingerMailRequestWithToken(string $token, string $method, string $path, ?array $payload = null): array {
    if (!function_exists('curl_init')) {
        throw new HostingerMailApiException(0, 'curl_unavailable');
    }
    if (!preg_match('#^/api/v1/[A-Za-z0-9._~/%?=&-]+$#', $path)) {
        throw new InvalidArgumentException('Invalid Hostinger Mail API path.');
    }

    $baseUrl = hostingerMailApiBaseUrl();
    $protocol = parse_url($baseUrl, PHP_URL_SCHEME) === 'https' ? CURLPROTO_HTTPS : CURLPROTO_HTTP;
    $headers = [
        'Accept: application/json',
        'Authorization: Bearer ' . $token,
    ];
    $options = [
        CURLOPT_URL => $baseUrl . $path,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => strtoupper($method),
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_CONNECTTIMEOUT => 7,
        CURLOPT_TIMEOUT => 25,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_PROTOCOLS => $protocol,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
    ];
    if ($payload !== null) {
        $encoded = json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        if ($encoded === false) throw new RuntimeException('Could not encode the email request.');
        $options[CURLOPT_POSTFIELDS] = $encoded;
        $headers[] = 'Content-Type: application/json';
        $options[CURLOPT_HTTPHEADER] = $headers;
    }

    $handle = curl_init();
    if ($handle === false) throw new HostingerMailApiException(0, 'curl_unavailable');
    curl_setopt_array($handle, $options);
    $body = curl_exec($handle);
    $curlError = curl_errno($handle);
    $status = (int)curl_getinfo($handle, CURLINFO_HTTP_CODE);
    curl_close($handle);

    if ($body === false || $curlError !== 0) {
        throw new HostingerMailApiException(0, 'network_error');
    }
    $decoded = $body === '' ? [] : json_decode((string)$body, true);
    if ($status < 200 || $status >= 300) {
        $providerCode = is_array($decoded) ? (string)($decoded['code'] ?? '') : '';
        throw new HostingerMailApiException($status, preg_replace('/[^A-Za-z0-9_.-]/', '', $providerCode) ?: '');
    }
    if ($status !== 204 && !is_array($decoded)) {
        throw new HostingerMailApiException($status, 'invalid_response');
    }
    return ['status' => $status, 'json' => is_array($decoded) ? $decoded : []];
}

function hostingerMailStoredRequest(PDO $pdo, string $method, string $path, ?array $payload = null): array {
    $token = hostingerMailToken($pdo);
    try {
        $response = hostingerMailRequestWithToken($token, $method, $path, $payload);
        hostingerMailRecordStatus($pdo, 'connected');
        return $response;
    } catch (HostingerMailApiException $error) {
        if (in_array($error->providerStatus, [0, 401, 403], true) || $error->providerStatus >= 500) {
            hostingerMailRecordStatus($pdo, 'connection_error', $error->providerCode ?: 'connection_error');
        }
        throw $error;
    }
}

function hostingerMailResponseData(array $response): array {
    $data = $response['json']['data'] ?? [];
    return is_array($data) ? $data : [];
}

function hostingerMailResponseCollection(array $response): array {
    $body = $response['json'] ?? [];
    return is_array($body) ? $body : [];
}

function hostingerMailQuery(array $values): string {
    return http_build_query($values, '', '&', PHP_QUERY_RFC3986);
}

function hostingerMailSegment(string $value): string {
    return rawurlencode($value);
}

function hostingerMailRecordAudit(PDO $pdo, string $staffId, string $action, string $details, ?string $clientName = null): void {
    $pdo->prepare('INSERT INTO audit_logs (id, user_id, client_name, action, details, ip_address, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        ->execute([
            'aud_' . bin2hex(random_bytes(8)),
            $staffId,
            $clientName,
            $action,
            $details,
            $_SERVER['REMOTE_ADDR'] ?? null,
            hostingerMailNow(),
        ]);
}

function hostingerMailAccountWithToken(string $token): array {
    $response = hostingerMailRequestWithToken($token, 'GET', '/api/v1/me');
    $account = hostingerMailResponseData($response);
    if (!isset($account['mailboxes']) || !is_array($account['mailboxes'])) {
        throw new HostingerMailApiException(502, 'invalid_account_response');
    }
    return $account;
}

function hostingerMailAccount(PDO $pdo): array {
    $response = hostingerMailStoredRequest($pdo, 'GET', '/api/v1/me');
    $account = hostingerMailResponseData($response);
    if (!isset($account['mailboxes']) || !is_array($account['mailboxes'])) {
        throw new HostingerMailApiException(502, 'invalid_account_response');
    }
    hostingerMailRecordStatus($pdo, 'connected', null, false, $account);
    return $account;
}

function hostingerMailNormalizeProviderMailboxes(array $account, PDO $pdo): array {
    $assignmentStmt = $pdo->prepare(
        'SELECT m.provider_mailbox_id, m.client_id, m.email_address, c.name AS client_name, c.company AS client_company
         FROM client_mailboxes m
         LEFT JOIN clients c ON c.id = m.client_id
         WHERE m.provider = ?'
    );
    $assignmentStmt->execute(['hostinger']);
    $assignments = [];
    foreach ($assignmentStmt->fetchAll() as $assignment) {
        $assignments[(string)$assignment['provider_mailbox_id']] = $assignment;
    }

    $mailboxes = [];
    foreach ($account['mailboxes'] as $mailbox) {
        if (!is_array($mailbox)) continue;
        $resourceId = (string)($mailbox['resourceId'] ?? '');
        $address = (string)($mailbox['address'] ?? '');
        if ($resourceId === '' || $address === '') continue;
        $assigned = $assignments[$resourceId] ?? null;
        $mailboxes[] = [
            'resourceId' => $resourceId,
            'address' => $address,
            'assignedClientId' => $assigned['client_id'] ?? null,
            'assignedClientName' => $assigned ? ((string)($assigned['client_company'] ?: $assigned['client_name'])) : null,
        ];
    }
    return $mailboxes;
}

function hostingerMailRequireClientMailbox(PDO $pdo, string $clientId, string $resourceId): array {
    if (!preg_match('/^AC[A-Za-z0-9]+$/', $resourceId)) {
        jsonResponse(['ok' => false, 'error' => 'This email account is currently unavailable.'], 403);
    }
    $stmt = $pdo->prepare(
        "SELECT id, client_id, provider_mailbox_id, email_address, display_name, status
         FROM client_mailboxes
         WHERE client_id = ? AND provider = 'hostinger' AND provider_mailbox_id = ?
         LIMIT 1"
    );
    $stmt->execute([$clientId, $resourceId]);
    $assignment = $stmt->fetch();
    if (!$assignment) {
        jsonResponse(['ok' => false, 'error' => 'This email account is currently unavailable.'], 403);
    }
    if ($assignment['status'] !== 'enabled') {
        jsonResponse(['ok' => false, 'error' => 'This email account is currently unavailable.'], 403);
    }
    return $assignment;
}

function hostingerMailSafeProviderError(HostingerMailApiException $error, bool $adminRequest): array {
    if ($error->providerStatus === 429) {
        return ['Too many requests. Please try again shortly.', 429];
    }
    if ($error->providerStatus === 404) {
        return ['This email account is currently unavailable.', 404];
    }
    if (in_array($error->providerStatus, [401, 403], true)) {
        return [
            $adminRequest
                ? 'Hostinger rejected the credential or it does not have Mail API access.'
                : 'Email service is temporarily unavailable. Please contact your administrator.',
            $adminRequest ? 422 : 503,
        ];
    }
    if (in_array($error->providerStatus, [400, 422], true)) {
        return [
            $adminRequest
                ? 'Hostinger could not validate the request. Check the token and mailbox scope.'
                : 'The email request could not be completed. Review the message details and try again.',
            $adminRequest ? 422 : 422,
        ];
    }
    return [
        $adminRequest
            ? 'Unable to connect to the Hostinger Mail API. Please try again.'
            : 'Unable to connect to the email service. Please try again.',
        502,
    ];
}

function hostingerMailPageParam(string $key, int $default, int $maximum): int {
    $value = filter_var($_GET[$key] ?? $default, FILTER_VALIDATE_INT);
    if ($value === false || $value < 1 || $value > $maximum) {
        jsonResponse(['ok' => false, 'error' => 'The requested page size is invalid.'], 422);
    }
    return (int)$value;
}

function hostingerMailFolderPath(string $resourceId, string $folder, string $suffix = ''): string {
    return '/api/v1/mailboxes/' . hostingerMailSegment($resourceId)
        . '/folders/' . hostingerMailSegment($folder) . $suffix;
}

function hostingerMailListFolders(PDO $pdo, string $resourceId): array {
    $response = hostingerMailStoredRequest(
        $pdo,
        'GET',
        '/api/v1/mailboxes/' . hostingerMailSegment($resourceId) . '/folders?' . hostingerMailQuery(['page' => 1, 'perPage' => 100])
    );
    return hostingerMailResponseCollection($response);
}

function hostingerMailNormalizeAddresses(mixed $value, string $field): array {
    if ($value === null || $value === '') return [];
    if (!is_array($value)) {
        jsonResponse(['ok' => false, 'error' => 'Recipients must be supplied as a list of email addresses.'], 422);
    }
    if (count($value) > 100) jsonResponse(['ok' => false, 'error' => 'Too many recipients were provided.'], 422);
    $addresses = [];
    foreach ($value as $address) {
        if (!is_string($address)) jsonResponse(['ok' => false, 'error' => 'A recipient address is invalid.'], 422);
        $address = trim($address);
        if ($address === '') continue;
        if (strlen($address) > 254 || filter_var($address, FILTER_VALIDATE_EMAIL) === false) {
            jsonResponse(['ok' => false, 'error' => 'A recipient address is invalid.'], 422);
        }
        $addresses[] = $address;
    }
    return $addresses;
}

function hostingerMailNormalizeAttachments(mixed $value): array {
    if ($value === null || $value === '') return [];
    if (!is_array($value) || count($value) > 20) {
        jsonResponse(['ok' => false, 'error' => 'Attachments could not be validated.'], 422);
    }

    $totalBytes = 0;
    $attachments = [];
    $blockedExtensions = ['php', 'phtml', 'phar', 'exe', 'dll', 'bat', 'cmd', 'com', 'msi', 'sh', 'ps1', 'js', 'cjs', 'mjs', 'vbs', 'vbe', 'jse', 'wsf', 'wsh', 'hta', 'scr', 'jar', 'html', 'htm', 'mhtml', 'xhtml', 'svg', 'lnk', 'url', 'reg'];
    foreach ($value as $attachment) {
        if (!is_array($attachment)) jsonResponse(['ok' => false, 'error' => 'Attachments could not be validated.'], 422);
        $filename = trim((string)($attachment['filename'] ?? ''));
        $content = (string)($attachment['content'] ?? '');
        $contentType = trim((string)($attachment['contentType'] ?? 'application/octet-stream'));
        if ($filename === '' || strlen($filename) > 255 || preg_match('/[\r\n\/\\\\]/', $filename)) {
            jsonResponse(['ok' => false, 'error' => 'An attachment filename is invalid.'], 422);
        }
        $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
        if ($extension !== '' && in_array($extension, $blockedExtensions, true)) {
            jsonResponse(['ok' => false, 'error' => 'This file type cannot be attached.'], 422);
        }
        if (!preg_match('#^[A-Za-z0-9.+-]+/[A-Za-z0-9.+-]+$#', $contentType)) {
            jsonResponse(['ok' => false, 'error' => 'An attachment type is invalid.'], 422);
        }
        if (($attachment['encoding'] ?? 'base64') !== 'base64') {
            jsonResponse(['ok' => false, 'error' => 'Attachments must be supplied as base64 data.'], 422);
        }
        $decoded = base64_decode($content, true);
        if ($decoded === false) jsonResponse(['ok' => false, 'error' => 'An attachment could not be validated.'], 422);
        $size = strlen($decoded);
        if ($size > 10 * 1024 * 1024) jsonResponse(['ok' => false, 'error' => 'Each attachment must be 10 MB or smaller.'], 422);
        $totalBytes += $size;
        if ($totalBytes > 20 * 1024 * 1024) jsonResponse(['ok' => false, 'error' => 'Attachments must total 20 MB or less.'], 422);
        $normalized = [
            'filename' => $filename,
            'content' => base64_encode($decoded),
            'contentType' => $contentType,
            'encoding' => 'base64',
        ];
        if (isset($attachment['cid']) && is_string($attachment['cid']) && strlen($attachment['cid']) <= 255) {
            $normalized['cid'] = $attachment['cid'];
        }
        $attachments[] = $normalized;
    }
    return $attachments;
}

function hostingerMailNormalizeMessageRef(mixed $value): ?array {
    if ($value === null || $value === '') return null;
    if (!is_array($value)) jsonResponse(['ok' => false, 'error' => 'The message reference is invalid.'], 422);
    $uid = filter_var($value['uid'] ?? null, FILTER_VALIDATE_INT);
    $folder = trim((string)($value['folder'] ?? ''));
    if ($uid === false || $uid < 1 || $folder === '' || strlen($folder) > 100) {
        jsonResponse(['ok' => false, 'error' => 'The message reference is invalid.'], 422);
    }
    return ['uid' => (int)$uid, 'folder' => $folder];
}

function hostingerMailNormalizeCompose(array $input, bool $forSending): array {
    $to = hostingerMailNormalizeAddresses($input['to'] ?? [], 'to');
    $cc = hostingerMailNormalizeAddresses($input['cc'] ?? [], 'cc');
    $bcc = hostingerMailNormalizeAddresses($input['bcc'] ?? [], 'bcc');
    $subject = trim((string)($input['subject'] ?? ''));
    $text = (string)($input['text'] ?? '');
    $html = (string)($input['html'] ?? '');
    if (strlen($subject) > 998 || strlen($text) > 1024 * 1024 || strlen($html) > 1024 * 1024) {
        jsonResponse(['ok' => false, 'error' => 'The message is too large to send.'], 422);
    }

    $inReplyTo = hostingerMailNormalizeMessageRef($input['inReplyTo'] ?? null);
    $forwardOf = hostingerMailNormalizeMessageRef($input['forwardOf'] ?? null);
    if ($inReplyTo && $forwardOf) {
        jsonResponse(['ok' => false, 'error' => 'A message cannot be both a reply and a forward.'], 422);
    }
    $attachments = hostingerMailNormalizeAttachments($input['attachments'] ?? []);
    if ($forSending) {
        if (!$to && !$cc && !$bcc) jsonResponse(['ok' => false, 'error' => 'Add at least one recipient before sending.'], 422);
        if (trim($text) === '' && trim(strip_tags($html)) === '') jsonResponse(['ok' => false, 'error' => 'Write a message before sending.'], 422);
    }

    // Draft records need a stable, complete shape even when fields are blank.
    // Provider send requests, by contrast, omit empty optional fields.
    $payload = [];
    if (!$forSending || $to) $payload['to'] = $to;
    if (!$forSending || $cc) $payload['cc'] = $cc;
    if (!$forSending || $bcc) $payload['bcc'] = $bcc;
    $payload['subject'] = $subject;
    $payload['text'] = $text;
    if ($html !== '') $payload['html'] = $html;
    if (!$forSending || $attachments) $payload['attachments'] = $attachments;
    if ($inReplyTo) $payload['inReplyTo'] = $inReplyTo;
    if ($forwardOf) $payload['forwardOf'] = $forwardOf;
    return $payload;
}

function hostingerMailDrafts(PDO $pdo, string $clientId, string $resourceId): array {
    $stmt = $pdo->prepare(
        'SELECT id, draft_json, updated_at FROM client_mail_drafts
         WHERE client_id = ? AND provider_mailbox_id = ? ORDER BY updated_at DESC'
    );
    $stmt->execute([$clientId, $resourceId]);
    $drafts = [];
    foreach ($stmt->fetchAll() as $row) {
        $draft = json_decode((string)$row['draft_json'], true);
        if (!is_array($draft)) continue;
        $draft['id'] = (string)$row['id'];
        $draft['updatedAt'] = (string)$row['updated_at'];
        $drafts[] = $draft;
    }
    return $drafts;
}

function hostingerMailStarred(PDO $pdo, string $resourceId, int $page, int $perPage): array {
    $folders = hostingerMailListFolders($pdo, $resourceId);
    $folderRows = $folders['data'] ?? [];
    if (!is_array($folderRows)) $folderRows = [];

    $offset = ($page - 1) * $perPage;
    $needed = $offset + $perPage;
    $providerPerPage = 100;
    $providerPageCount = max(1, (int)ceil($needed / $providerPerPage));
    $messages = [];
    $total = 0;

    foreach ($folderRows as $folder) {
        if (!is_array($folder)) continue;
        $path = trim((string)($folder['path'] ?? ''));
        if ($path === '' || ($folder['specialUse'] ?? null) === '\\Drafts') continue;
        for ($providerPage = 1; $providerPage <= $providerPageCount; $providerPage++) {
            $query = hostingerMailQuery(['page' => $providerPage, 'perPage' => $providerPerPage, 'sort' => '-date']);
            $requestPath = hostingerMailFolderPath($resourceId, $path, '/messages/search?' . $query);
            $response = hostingerMailStoredRequest($pdo, 'POST', $requestPath, ['flags' => ['\\Flagged']]);
            $data = hostingerMailResponseCollection($response);
            if ($providerPage === 1) $total += (int)($data['pagination']['total'] ?? 0);
            foreach (($data['data'] ?? []) as $message) {
                if (is_array($message)) $messages[] = $message;
            }
            if (count($data['data'] ?? []) < $providerPerPage) break;
        }
    }

    usort($messages, static function (array $left, array $right): int {
        return strcmp((string)($right['date'] ?? ''), (string)($left['date'] ?? ''));
    });
    $unique = [];
    foreach ($messages as $message) {
        $key = (string)($message['path'] ?? '') . ':' . (string)($message['uid'] ?? '');
        $unique[$key] = $message;
    }
    $messages = array_values($unique);
    return [
        'messages' => array_slice($messages, $offset, $perPage),
        'pagination' => [
            'page' => $page,
            'perPage' => $perPage,
            'total' => $total,
            'totalPages' => (int)ceil($total / max(1, $perPage)),
        ],
    ];
}

function hostingerMailHandleRequest(PDO $pdo, string $apiPath, string $method, array $input, ?array $adminSession, ?array $portalSession): bool {
    $adminBase = '/admin/integrations/hostinger-mail';
    $isAdminMailRoute = $apiPath === $adminBase
        || $apiPath === $adminBase . '/test'
        || $apiPath === '/admin/hostinger/mailboxes'
        || preg_match('#^/admin/clients/([^/]+)/mailboxes(?:/([^/]+))?$#', $apiPath) === 1
        || preg_match('#^/admin/client-mailboxes/([^/]+)/reassign$#', $apiPath) === 1;

    if ($isAdminMailRoute) {
        requireSuperAdmin($pdo, $adminSession);
        header('Cache-Control: no-store, private');
        header('Pragma: no-cache');
        $staff = requireActiveAdminStaff($pdo, $adminSession);

        if ($apiPath === $adminBase && $method === 'GET') {
            $integration = hostingerMailIntegration($pdo);
            jsonResponse([
                'ok' => true,
                'integration' => [
                    'configured' => !empty($integration['encrypted_token']),
                    'status' => $integration['status'] ?? 'not_configured',
                    'lastTestedAt' => $integration['last_tested_at'] ?? null,
                    'lastSuccessAt' => $integration['last_success_at'] ?? null,
                    'mailboxCount' => (int)($integration['mailbox_count'] ?? 0),
                ],
            ]);
        }

        if ($apiPath === $adminBase . '/test' && $method === 'POST') {
            $candidate = trim((string)($input['token'] ?? ''));
            $integration = hostingerMailIntegration($pdo);
            $testingStored = $candidate === '';
            if ($testingStored) {
                if (!$integration || empty($integration['encrypted_token'])) {
                    jsonResponse(['ok' => false, 'error' => 'Enter a Hostinger Mail API token first.'], 409);
                }
                $candidate = decryptClientSecret((string)$integration['encrypted_token']);
            }
            if (strlen($candidate) < 16 || strlen($candidate) > 4096 || preg_match('/\s/', $candidate)) {
                jsonResponse(['ok' => false, 'error' => 'Enter a valid Hostinger Mail API token.'], 422);
            }
            try {
                $account = hostingerMailAccountWithToken($candidate);
                if ($testingStored) hostingerMailRecordStatus($pdo, 'connected', null, true, $account);
                hostingerMailRecordAudit($pdo, (string)$staff['id'], 'HOSTINGER_MAIL_CONNECTION_TESTED', 'Hostinger Mail API connection tested.');
                jsonResponse([
                    'ok' => true,
                    'message' => 'Hostinger Mail API connection successful.',
                    'mailboxCount' => count($account['mailboxes']),
                    'testedStoredToken' => $testingStored,
                ]);
            } catch (HostingerMailApiException $error) {
                if ($testingStored) hostingerMailRecordStatus($pdo, 'connection_error', $error->providerCode ?: 'connection_error', true);
                $safe = hostingerMailSafeProviderError($error, true);
                jsonResponse(['ok' => false, 'error' => $safe[0]], $safe[1]);
            }
        }

        if ($apiPath === $adminBase && $method === 'POST') {
            $token = trim((string)($input['token'] ?? ''));
            if (strlen($token) < 16 || strlen($token) > 4096 || preg_match('/\s/', $token)) {
                jsonResponse(['ok' => false, 'error' => 'Enter a valid Hostinger Mail API token.'], 422);
            }
            try {
                $account = hostingerMailAccountWithToken($token);
                $encrypted = encryptClientSecret($token);
                $existing = hostingerMailIntegration($pdo);
                $now = hostingerMailNow();
                if ($existing) {
                    $pdo->prepare(
                        "UPDATE hostinger_mail_integrations
                         SET encrypted_token = ?, status = 'connected', last_tested_at = ?, last_success_at = ?,
                             last_error_code = NULL, mailbox_count = ?, order_resource_id = ?, updated_by = ?, updated_at = ?
                         WHERE id = 'primary'"
                    )->execute([
                        $encrypted, $now, $now, count($account['mailboxes']),
                        (string)($account['orderResourceId'] ?? ''), (string)$staff['id'], $now,
                    ]);
                    $auditAction = 'HOSTINGER_MAIL_TOKEN_UPDATED';
                    $auditMessage = 'Super Admin updated the Hostinger Mail API credential.';
                } else {
                    $pdo->prepare(
                        "INSERT INTO hostinger_mail_integrations
                         (id, encrypted_token, status, last_tested_at, last_success_at, last_error_code, mailbox_count, order_resource_id, created_by, updated_by, created_at, updated_at)
                         VALUES ('primary', ?, 'connected', ?, ?, NULL, ?, ?, ?, ?, ?, ?)"
                    )->execute([
                        $encrypted, $now, $now, count($account['mailboxes']),
                        (string)($account['orderResourceId'] ?? ''), (string)$staff['id'],
                        (string)$staff['id'], $now, $now,
                    ]);
                    $auditAction = 'HOSTINGER_MAIL_TOKEN_CONFIGURED';
                    $auditMessage = 'Super Admin configured the Hostinger Mail API credential.';
                }
                hostingerMailRecordAudit($pdo, (string)$staff['id'], $auditAction, $auditMessage);
                jsonResponse([
                    'ok' => true,
                    'message' => 'Hostinger Mail API token saved and validated.',
                    'integration' => [
                        'configured' => true,
                        'status' => 'connected',
                        'lastTestedAt' => $now,
                        'lastSuccessAt' => $now,
                        'mailboxCount' => count($account['mailboxes']),
                    ],
                ]);
            } catch (HostingerMailApiException $error) {
                $safe = hostingerMailSafeProviderError($error, true);
                jsonResponse(['ok' => false, 'error' => $safe[0]], $safe[1]);
            }
        }

        if ($apiPath === $adminBase && $method === 'DELETE') {
            $integration = hostingerMailIntegration($pdo);
            if ($integration) {
                $pdo->prepare("DELETE FROM hostinger_mail_integrations WHERE id = 'primary'")->execute();
                hostingerMailRecordAudit($pdo, (string)$staff['id'], 'HOSTINGER_MAIL_TOKEN_REMOVED', 'Super Admin removed the Hostinger Mail API credential.');
            }
            jsonResponse(['ok' => true, 'message' => 'Hostinger Mail API token removed.']);
        }

        if ($apiPath === '/admin/hostinger/mailboxes' && $method === 'GET') {
            $account = hostingerMailAccount($pdo);
            jsonResponse([
                'ok' => true,
                'orderResourceId' => (string)($account['orderResourceId'] ?? ''),
                'mailboxes' => hostingerMailNormalizeProviderMailboxes($account, $pdo),
            ]);
        }

        if (preg_match('#^/admin/clients/([^/]+)/mailboxes(?:/([^/]+))?$#', $apiPath, $matches)) {
            $clientId = rawurldecode($matches[1]);
            if (!preg_match('/^[A-Za-z0-9_-]{1,191}$/', $clientId)) {
                jsonResponse(['ok' => false, 'error' => 'Client account was not found.'], 404);
            }
            $clientStmt = $pdo->prepare('SELECT id, name, company FROM clients WHERE id = ? LIMIT 1');
            $clientStmt->execute([$clientId]);
            $client = $clientStmt->fetch();
            if (!$client) jsonResponse(['ok' => false, 'error' => 'Email account assignments require a client portal account.'], 404);

            $assignmentId = isset($matches[2]) ? rawurldecode($matches[2]) : null;
            if (!$assignmentId && $method === 'GET') {
                $stmt = $pdo->prepare(
                    'SELECT id, client_id, provider_mailbox_id, email_address, display_name, status, created_at, updated_at
                     FROM client_mailboxes WHERE client_id = ? AND provider = ? ORDER BY email_address'
                );
                $stmt->execute([$clientId, 'hostinger']);
                $mailboxes = [];
                foreach ($stmt->fetchAll() as $row) {
                    $mailboxes[] = [
                        'id' => (string)$row['id'],
                        'clientId' => (string)$row['client_id'],
                        'providerMailboxId' => (string)$row['provider_mailbox_id'],
                        'emailAddress' => (string)$row['email_address'],
                        'displayName' => (string)$row['display_name'],
                        'enabled' => $row['status'] === 'enabled',
                        'createdAt' => (string)$row['created_at'],
                        'updatedAt' => (string)$row['updated_at'],
                    ];
                }
                jsonResponse(['ok' => true, 'mailboxes' => $mailboxes]);
            }

            if (!$assignmentId && $method === 'POST') {
                $resourceId = trim((string)($input['providerMailboxId'] ?? ''));
                $displayName = trim((string)($input['displayName'] ?? ''));
                $enabled = array_key_exists('enabled', $input) ? (bool)$input['enabled'] : true;
                if (!preg_match('/^AC[A-Za-z0-9]+$/', $resourceId)) {
                    jsonResponse(['ok' => false, 'error' => 'Select a mailbox returned by Hostinger.'], 422);
                }
                if (strlen($displayName) > 191) jsonResponse(['ok' => false, 'error' => 'The display name is too long.'], 422);
                $account = hostingerMailAccount($pdo);
                $providerMailbox = null;
                foreach ($account['mailboxes'] as $candidate) {
                    if (($candidate['resourceId'] ?? null) === $resourceId) {
                        $providerMailbox = $candidate;
                        break;
                    }
                }
                if (!$providerMailbox || !filter_var((string)($providerMailbox['address'] ?? ''), FILTER_VALIDATE_EMAIL)) {
                    jsonResponse(['ok' => false, 'error' => 'That mailbox was not found in the connected Hostinger account.'], 422);
                }
                $existingStmt = $pdo->prepare('SELECT client_id FROM client_mailboxes WHERE provider_mailbox_id = ? LIMIT 1');
                $existingStmt->execute([$resourceId]);
                $existing = $existingStmt->fetch();
                if ($existing) {
                    jsonResponse(['ok' => false, 'error' => 'This mailbox is already assigned to another client. Use the explicit reassignment action to transfer it.'], 409);
                }
                $now = hostingerMailNow();
                $assignmentId = 'hmb_' . bin2hex(random_bytes(12));
                $pdo->prepare(
                    'INSERT INTO client_mailboxes
                     (id, client_id, provider, provider_mailbox_id, email_address, display_name, status, created_by, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
                )->execute([
                    $assignmentId, $clientId, 'hostinger', $resourceId, (string)$providerMailbox['address'],
                    $displayName !== '' ? $displayName : (string)$providerMailbox['address'],
                    $enabled ? 'enabled' : 'disabled', (string)$staff['id'], $now, $now,
                ]);
                hostingerMailRecordAudit(
                    $pdo,
                    (string)$staff['id'],
                    'HOSTINGER_MAILBOX_ASSIGNED',
                    'Hostinger mailbox ' . (string)$providerMailbox['address'] . ' assigned to client ' . $clientId . '.',
                    (string)($client['company'] ?: $client['name'])
                );
                jsonResponse([
                    'ok' => true,
                    'mailbox' => [
                        'id' => $assignmentId,
                        'clientId' => $clientId,
                        'providerMailboxId' => $resourceId,
                        'emailAddress' => (string)$providerMailbox['address'],
                        'displayName' => $displayName !== '' ? $displayName : (string)$providerMailbox['address'],
                        'enabled' => $enabled,
                        'createdAt' => $now,
                        'updatedAt' => $now,
                    ],
                ], 201);
            }

            if ($assignmentId && preg_match('/^[A-Za-z0-9_-]{1,191}$/', $assignmentId)) {
                $assignmentStmt = $pdo->prepare(
                    'SELECT id, client_id, provider_mailbox_id, email_address, display_name, status
                     FROM client_mailboxes WHERE id = ? AND client_id = ? AND provider = ? LIMIT 1'
                );
                $assignmentStmt->execute([$assignmentId, $clientId, 'hostinger']);
                $assignment = $assignmentStmt->fetch();
                if (!$assignment) jsonResponse(['ok' => false, 'error' => 'Mailbox assignment was not found.'], 404);

                if ($method === 'PATCH') {
                    $displayName = $assignment['display_name'];
                    $status = $assignment['status'];
                    if (array_key_exists('displayName', $input)) {
                        if (!is_string($input['displayName']) || strlen(trim($input['displayName'])) > 191) {
                            jsonResponse(['ok' => false, 'error' => 'The display name is invalid.'], 422);
                        }
                        $displayName = trim($input['displayName']);
                    }
                    if (array_key_exists('enabled', $input)) {
                        if (!is_bool($input['enabled'])) jsonResponse(['ok' => false, 'error' => 'Choose whether the mailbox is enabled.'], 422);
                        $status = $input['enabled'] ? 'enabled' : 'disabled';
                    }
                    if (!array_key_exists('displayName', $input) && !array_key_exists('enabled', $input)) {
                        jsonResponse(['ok' => false, 'error' => 'There are no mailbox changes to save.'], 422);
                    }
                    $now = hostingerMailNow();
                    $pdo->prepare('UPDATE client_mailboxes SET display_name = ?, status = ?, updated_at = ? WHERE id = ?')
                        ->execute([$displayName, $status, $now, $assignmentId]);
                    $action = $status !== $assignment['status'] ? 'HOSTINGER_MAILBOX_STATUS_CHANGED' : 'HOSTINGER_MAILBOX_UPDATED';
                    $details = 'Mailbox ' . $assignment['email_address'] . ' updated for client ' . $clientId . '.';
                    hostingerMailRecordAudit($pdo, (string)$staff['id'], $action, $details, (string)($client['company'] ?: $client['name']));
                    jsonResponse(['ok' => true, 'mailbox' => [
                        'id' => $assignmentId,
                        'clientId' => $clientId,
                        'providerMailboxId' => (string)$assignment['provider_mailbox_id'],
                        'emailAddress' => (string)$assignment['email_address'],
                        'displayName' => $displayName,
                        'enabled' => $status === 'enabled',
                        'updatedAt' => $now,
                    ]]);
                }

                if ($method === 'DELETE') {
                    $pdo->beginTransaction();
                    $pdo->prepare('DELETE FROM client_mail_drafts WHERE client_id = ? AND provider_mailbox_id = ?')
                        ->execute([$clientId, $assignment['provider_mailbox_id']]);
                    $pdo->prepare('DELETE FROM client_mailboxes WHERE id = ?')->execute([$assignmentId]);
                    $pdo->commit();
                    hostingerMailRecordAudit(
                        $pdo,
                        (string)$staff['id'],
                        'HOSTINGER_MAILBOX_UNASSIGNED',
                        'Mailbox ' . $assignment['email_address'] . ' removed from client ' . $clientId . '; the Hostinger mailbox was not deleted.',
                        (string)($client['company'] ?: $client['name'])
                    );
                    jsonResponse(['ok' => true, 'message' => 'Mailbox removed from this client. The Hostinger mailbox was not deleted.']);
                }
            }

            jsonResponse(['ok' => false, 'error' => 'Method not allowed.'], 405);
        }

        if (preg_match('#^/admin/client-mailboxes/([^/]+)/reassign$#', $apiPath, $matches) && $method === 'POST') {
            $assignmentId = rawurldecode($matches[1]);
            $targetClientId = trim((string)($input['targetClientId'] ?? ''));
            $displayName = trim((string)($input['displayName'] ?? ''));
            if (($input['confirmed'] ?? false) !== true) {
                jsonResponse(['ok' => false, 'error' => 'Confirm the mailbox transfer before continuing.'], 422);
            }
            if (!preg_match('/^[A-Za-z0-9_-]{1,191}$/', $assignmentId)
                || !preg_match('/^[A-Za-z0-9_-]{1,191}$/', $targetClientId)
                || strlen($displayName) > 191) {
                jsonResponse(['ok' => false, 'error' => 'The mailbox transfer details are invalid.'], 422);
            }
            $targetStmt = $pdo->prepare('SELECT id, name, company FROM clients WHERE id = ? LIMIT 1');
            $targetStmt->execute([$targetClientId]);
            $targetClient = $targetStmt->fetch();
            if (!$targetClient) jsonResponse(['ok' => false, 'error' => 'The destination client account was not found.'], 404);
            $pdo->beginTransaction();
            $assignmentStmt = $pdo->prepare('SELECT * FROM client_mailboxes WHERE id = ? LIMIT 1');
            $assignmentStmt->execute([$assignmentId]);
            $assignment = $assignmentStmt->fetch();
            if (!$assignment) {
                $pdo->rollBack();
                jsonResponse(['ok' => false, 'error' => 'Mailbox assignment was not found.'], 404);
            }
            if ($assignment['client_id'] === $targetClientId) {
                $pdo->rollBack();
                jsonResponse(['ok' => false, 'error' => 'This mailbox is already assigned to the selected client.'], 409);
            }
            $sourceStmt = $pdo->prepare('SELECT name, company FROM clients WHERE id = ? LIMIT 1');
            $sourceStmt->execute([$assignment['client_id']]);
            $sourceClient = $sourceStmt->fetch() ?: [];
            $now = hostingerMailNow();
            $newDisplayName = $displayName !== '' ? $displayName : (string)$assignment['email_address'];
            $pdo->prepare('DELETE FROM client_mail_drafts WHERE client_id = ? AND provider_mailbox_id = ?')
                ->execute([$assignment['client_id'], $assignment['provider_mailbox_id']]);
            $pdo->prepare('UPDATE client_mailboxes SET client_id = ?, display_name = ?, updated_at = ? WHERE id = ?')
                ->execute([$targetClientId, $newDisplayName, $now, $assignmentId]);
            $pdo->commit();
            hostingerMailRecordAudit(
                $pdo,
                (string)$staff['id'],
                'HOSTINGER_MAILBOX_REASSIGNED',
                'Mailbox ' . $assignment['email_address'] . ' transferred from client ' . $assignment['client_id'] . ' to client ' . $targetClientId . '.',
                (string)($targetClient['company'] ?: $targetClient['name'])
            );
            jsonResponse(['ok' => true, 'message' => 'Mailbox reassigned to the selected client.']);
        }

        jsonResponse(['ok' => false, 'error' => 'Method not allowed.'], 405);
    }

        if ($apiPath === '/portal/mailboxes' && $method === 'GET') {
        header('Cache-Control: no-store, private');
        header('Pragma: no-cache');
        $integration = hostingerMailIntegration($pdo);
        if (!$integration || empty($integration['encrypted_token'])) {
            jsonResponse(['ok' => false, 'error' => 'Email service is not configured yet. Please contact your administrator.'], 409);
        }
        $stmt = $pdo->prepare(
            "SELECT id, client_id, provider_mailbox_id, email_address, display_name, created_at, updated_at
             FROM client_mailboxes WHERE client_id = ? AND provider = 'hostinger' AND status = 'enabled'
             ORDER BY email_address"
        );
        $stmt->execute([(string)$portalSession['id']]);
        $mailboxes = [];
        foreach ($stmt->fetchAll() as $row) {
            $mailboxes[] = [
                'id' => (string)$row['id'],
                'clientId' => (string)$row['client_id'],
                'providerMailboxId' => (string)$row['provider_mailbox_id'],
                'emailAddress' => (string)$row['email_address'],
                'displayName' => (string)$row['display_name'],
                'enabled' => true,
                'createdAt' => (string)$row['created_at'],
                'updatedAt' => (string)$row['updated_at'],
            ];
        }
        jsonResponse(['ok' => true, 'mailboxes' => $mailboxes]);
    }

    if (preg_match('#^/portal/mailboxes/([^/]+)/folders$#', $apiPath, $matches) && $method === 'GET') {
        $resourceId = rawurldecode($matches[1]);
        hostingerMailRequireClientMailbox($pdo, (string)$portalSession['id'], $resourceId);
        $folders = hostingerMailListFolders($pdo, $resourceId);
        jsonResponse([
            'ok' => true,
            'folders' => is_array($folders['data'] ?? null) ? $folders['data'] : [],
            'pagination' => $folders['pagination'] ?? null,
            'draftsStoredInCodex' => true,
        ]);
    }

    if (preg_match('#^/portal/mailboxes/([^/]+)/starred$#', $apiPath, $matches) && $method === 'GET') {
        $resourceId = rawurldecode($matches[1]);
        hostingerMailRequireClientMailbox($pdo, (string)$portalSession['id'], $resourceId);
        $page = hostingerMailPageParam('page', 1, 100);
        $perPage = hostingerMailPageParam('perPage', 25, 100);
        $result = hostingerMailStarred($pdo, $resourceId, $page, $perPage);
        jsonResponse(['ok' => true, 'messages' => $result['messages'], 'pagination' => $result['pagination']]);
    }

    if (preg_match('#^/portal/mailboxes/([^/]+)/drafts(?:/([^/]+))?$#', $apiPath, $matches)) {
        $resourceId = rawurldecode($matches[1]);
        hostingerMailRequireClientMailbox($pdo, (string)$portalSession['id'], $resourceId);
        $draftId = isset($matches[2]) ? rawurldecode($matches[2]) : null;
        if (!$draftId && $method === 'GET') {
            jsonResponse(['ok' => true, 'drafts' => hostingerMailDrafts($pdo, (string)$portalSession['id'], $resourceId)]);
        }
        if (!$draftId && $method === 'POST') {
            $payload = hostingerMailNormalizeCompose($input, false);
            $draftId = trim((string)($input['id'] ?? ''));
            if ($draftId !== '' && !preg_match('/^[A-Za-z0-9_-]{1,191}$/', $draftId)) {
                jsonResponse(['ok' => false, 'error' => 'Draft could not be saved.'], 422);
            }
            $existing = null;
            if ($draftId !== '') {
                $stmt = $pdo->prepare('SELECT id FROM client_mail_drafts WHERE id = ? AND client_id = ? AND provider_mailbox_id = ? LIMIT 1');
                $stmt->execute([$draftId, (string)$portalSession['id'], $resourceId]);
                $existing = $stmt->fetch();
                if (!$existing) jsonResponse(['ok' => false, 'error' => 'Draft not found.'], 404);
            } else {
                $draftId = 'md_' . bin2hex(random_bytes(12));
            }
            $now = hostingerMailNow();
            $draftJson = json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
            if ($draftJson === false) jsonResponse(['ok' => false, 'error' => 'Draft could not be saved.'], 422);
            if ($existing) {
                $pdo->prepare('UPDATE client_mail_drafts SET draft_json = ?, updated_at = ? WHERE id = ?')
                    ->execute([$draftJson, $now, $draftId]);
            } else {
                $pdo->prepare('INSERT INTO client_mail_drafts (id, client_id, provider_mailbox_id, draft_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
                    ->execute([$draftId, (string)$portalSession['id'], $resourceId, $draftJson, $now, $now]);
            }
            jsonResponse(['ok' => true, 'draft' => array_merge($payload, ['id' => $draftId, 'updatedAt' => $now])], $existing ? 200 : 201);
        }
        if ($draftId && preg_match('/^[A-Za-z0-9_-]{1,191}$/', $draftId)) {
            if ($method === 'GET') {
                $stmt = $pdo->prepare('SELECT draft_json, updated_at FROM client_mail_drafts WHERE id = ? AND client_id = ? AND provider_mailbox_id = ? LIMIT 1');
                $stmt->execute([$draftId, (string)$portalSession['id'], $resourceId]);
                $row = $stmt->fetch();
                if (!$row) jsonResponse(['ok' => false, 'error' => 'Draft not found.'], 404);
                $draft = json_decode((string)$row['draft_json'], true);
                if (!is_array($draft)) $draft = [];
                jsonResponse(['ok' => true, 'draft' => array_merge($draft, ['id' => $draftId, 'updatedAt' => (string)$row['updated_at']])]);
            }
            if ($method === 'DELETE') {
                $stmt = $pdo->prepare('DELETE FROM client_mail_drafts WHERE id = ? AND client_id = ? AND provider_mailbox_id = ?');
                $stmt->execute([$draftId, (string)$portalSession['id'], $resourceId]);
                if ($stmt->rowCount() === 0) jsonResponse(['ok' => false, 'error' => 'Draft not found.'], 404);
                jsonResponse(['ok' => true, 'message' => 'Draft removed.']);
            }
        }
        jsonResponse(['ok' => false, 'error' => 'Method not allowed.'], 405);
    }

    if (preg_match('#^/portal/mailboxes/([^/]+)/folders/([^/]+)/messages/search$#', $apiPath, $matches)
        && $method === 'POST') {
        $resourceId = rawurldecode($matches[1]);
        $folder = rawurldecode($matches[2]);
        hostingerMailRequireClientMailbox($pdo, (string)$portalSession['id'], $resourceId);
        $text = trim((string)($input['text'] ?? ''));
        if ($text === '' || strlen($text) > 1024) jsonResponse(['ok' => false, 'error' => 'Enter a search term up to 1,024 characters.'], 422);
        $page = hostingerMailPageParam('page', 1, 100000);
        $perPage = hostingerMailPageParam('perPage', 25, 100);
        $sort = (string)($_GET['sort'] ?? '-uid');
        if (!preg_match('/^-?(uid|date|size)$/', $sort)) $sort = '-uid';
        $path = hostingerMailFolderPath(
            $resourceId,
            $folder,
            '/messages/search?' . hostingerMailQuery(['page' => $page, 'perPage' => $perPage, 'sort' => $sort])
        );
        $response = hostingerMailStoredRequest($pdo, 'POST', $path, ['text' => $text]);
        $data = hostingerMailResponseCollection($response);
        jsonResponse([
            'ok' => true,
            'messages' => is_array($data['data'] ?? null) ? $data['data'] : [],
            'pagination' => $data['pagination'] ?? null,
        ]);
    }

    if (preg_match('#^/portal/mailboxes/([^/]+)/folders/([^/]+)/messages$#', $apiPath, $matches)
        && $method === 'GET') {
        $resourceId = rawurldecode($matches[1]);
        $folder = rawurldecode($matches[2]);
        hostingerMailRequireClientMailbox($pdo, (string)$portalSession['id'], $resourceId);
        $page = hostingerMailPageParam('page', 1, 100000);
        $perPage = hostingerMailPageParam('perPage', 25, 100);
        $sort = (string)($_GET['sort'] ?? '-uid');
        if (!preg_match('/^-?(uid|date|size)$/', $sort)) $sort = '-uid';
        $path = hostingerMailFolderPath(
            $resourceId,
            $folder,
            '/messages?' . hostingerMailQuery(['page' => $page, 'perPage' => $perPage, 'sort' => $sort])
        );
        $response = hostingerMailStoredRequest($pdo, 'GET', $path);
        $data = hostingerMailResponseCollection($response);
        jsonResponse([
            'ok' => true,
            'messages' => is_array($data['data'] ?? null) ? $data['data'] : [],
            'pagination' => $data['pagination'] ?? null,
        ]);
    }

    if (preg_match('#^/portal/mailboxes/([^/]+)/folders/([^/]+)/messages/([^/]+)/attachments/([^/]+)$#', $apiPath, $matches)
        && $method === 'GET') {
        $resourceId = rawurldecode($matches[1]);
        $folder = rawurldecode($matches[2]);
        $uid = filter_var($matches[3], FILTER_VALIDATE_INT);
        $attachmentId = rawurldecode($matches[4]);
        hostingerMailRequireClientMailbox($pdo, (string)$portalSession['id'], $resourceId);
        if ($uid === false || $uid < 1 || $attachmentId === '') jsonResponse(['ok' => false, 'error' => 'Attachment not found.'], 404);
        $path = hostingerMailFolderPath(
            $resourceId,
            $folder,
            '/messages/' . (int)$uid . '/attachments/' . hostingerMailSegment($attachmentId)
        );
        $token = hostingerMailToken($pdo);
        $baseUrl = hostingerMailApiBaseUrl();
        $protocol = parse_url($baseUrl, PHP_URL_SCHEME) === 'https' ? CURLPROTO_HTTPS : CURLPROTO_HTTP;
        $handle = curl_init();
        if ($handle === false) jsonResponse(['ok' => false, 'error' => 'Unable to connect to the email service. Please try again.'], 502);
        curl_setopt_array($handle, [
            CURLOPT_URL => $baseUrl . $path,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => ['Accept: application/octet-stream', 'Authorization: Bearer ' . $token],
            CURLOPT_CONNECTTIMEOUT => 7,
            CURLOPT_TIMEOUT => 25,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_PROTOCOLS => $protocol,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
        ]);
        $body = curl_exec($handle);
        $curlError = curl_errno($handle);
        $status = (int)curl_getinfo($handle, CURLINFO_HTTP_CODE);
        curl_close($handle);
        if ($body === false || $curlError !== 0) {
            hostingerMailRecordStatus($pdo, 'connection_error', 'network_error');
            jsonResponse(['ok' => false, 'error' => 'Unable to connect to the email service. Please try again.'], 502);
        }
        if ($status < 200 || $status >= 300) {
            $decoded = json_decode((string)$body, true);
            $providerCode = is_array($decoded) ? (string)($decoded['code'] ?? '') : '';
            $error = new HostingerMailApiException($status, preg_replace('/[^A-Za-z0-9_.-]/', '', $providerCode) ?: '');
            if (in_array($status, [401, 403], true) || $status >= 500) hostingerMailRecordStatus($pdo, 'connection_error', $error->providerCode ?: 'connection_error');
            $safe = hostingerMailSafeProviderError($error, false);
            jsonResponse(['ok' => false, 'error' => $safe[0]], $safe[1]);
        }
        hostingerMailRecordStatus($pdo, 'connected');
        header('Cache-Control: private, no-store');
        header('Pragma: no-cache');
        header('X-Content-Type-Options: nosniff');
        header('Content-Type: application/octet-stream');
        header('Content-Disposition: attachment; filename="email-attachment"');
        echo $body;
        exit;
    }

    if (preg_match('#^/portal/mailboxes/([^/]+)/folders/([^/]+)/messages/([^/]+)/move$#', $apiPath, $matches)
        && $method === 'POST') {
        $resourceId = rawurldecode($matches[1]);
        $folder = rawurldecode($matches[2]);
        $uid = filter_var($matches[3], FILTER_VALIDATE_INT);
        hostingerMailRequireClientMailbox($pdo, (string)$portalSession['id'], $resourceId);
        if ($uid === false || $uid < 1) jsonResponse(['ok' => false, 'error' => 'That email could not be found.'], 404);
        $targetFolder = trim((string)($input['targetFolder'] ?? ''));
        if ($targetFolder === '' || strlen($targetFolder) > 100) jsonResponse(['ok' => false, 'error' => 'Choose a valid destination folder.'], 422);
        $folders = hostingerMailListFolders($pdo, $resourceId);
        $knownPaths = array_map(static fn($item) => (string)($item['path'] ?? ''), $folders['data'] ?? []);
        if (!in_array($targetFolder, $knownPaths, true)) jsonResponse(['ok' => false, 'error' => 'That destination folder is not available in this mailbox.'], 422);
        $path = hostingerMailFolderPath($resourceId, $folder, '/messages/' . (int)$uid . '/move');
        hostingerMailStoredRequest($pdo, 'POST', $path, ['targetFolder' => $targetFolder]);
        jsonResponse(['ok' => true, 'message' => 'Email moved.']);
    }

    if (preg_match('#^/portal/mailboxes/([^/]+)/folders/([^/]+)/messages/([^/]+)$#', $apiPath, $matches)) {
        $resourceId = rawurldecode($matches[1]);
        $folder = rawurldecode($matches[2]);
        $uid = filter_var($matches[3], FILTER_VALIDATE_INT);
        hostingerMailRequireClientMailbox($pdo, (string)$portalSession['id'], $resourceId);
        if ($uid === false || $uid < 1) jsonResponse(['ok' => false, 'error' => 'That email could not be found.'], 404);
        $basePath = hostingerMailFolderPath($resourceId, $folder, '/messages/' . (int)$uid);

        if ($method === 'GET') {
            $messageResponse = hostingerMailStoredRequest($pdo, 'GET', $basePath);
            $message = hostingerMailResponseData($messageResponse);
            $textResponse = hostingerMailStoredRequest($pdo, 'GET', $basePath . '/text');
            $body = hostingerMailResponseData($textResponse);
            $message['unseen'] = false;
            $message['flags'] = array_values(array_unique(array_merge(
                array_filter($message['flags'] ?? [], static fn($flag) => $flag !== '\\Seen'),
                ['\\Seen']
            )));
            jsonResponse(['ok' => true, 'message' => $message, 'body' => $body]);
        }

        if ($method === 'PATCH') {
            $allowedFlags = ['\\Seen', '\\Flagged', '\\Answered'];
            $addFlags = $input['addFlags'] ?? [];
            $removeFlags = $input['removeFlags'] ?? [];
            if (!is_array($addFlags) || !is_array($removeFlags)) jsonResponse(['ok' => false, 'error' => 'Message flags are invalid.'], 422);
            $addFlags = array_values(array_unique(array_map('strval', $addFlags)));
            $removeFlags = array_values(array_unique(array_map('strval', $removeFlags)));
            foreach (array_merge($addFlags, $removeFlags) as $flag) {
                if (!in_array($flag, $allowedFlags, true)) jsonResponse(['ok' => false, 'error' => 'That email action is not supported.'], 422);
            }
            if (!$addFlags && !$removeFlags) jsonResponse(['ok' => false, 'error' => 'Choose an email action.'], 422);
            hostingerMailStoredRequest($pdo, 'PATCH', $basePath, ['addFlags' => $addFlags, 'removeFlags' => $removeFlags]);
            jsonResponse(['ok' => true, 'message' => 'Email updated.']);
        }

        if ($method === 'DELETE') {
            if (($input['confirmed'] ?? false) !== true) {
                jsonResponse(['ok' => false, 'error' => 'Confirm permanent deletion before continuing.'], 422);
            }
            hostingerMailStoredRequest($pdo, 'DELETE', $basePath);
            jsonResponse(['ok' => true, 'message' => 'Email permanently deleted.']);
        }

        jsonResponse(['ok' => false, 'error' => 'Method not allowed.'], 405);
    }

    if (preg_match('#^/portal/mailboxes/([^/]+)/send$#', $apiPath, $matches) && $method === 'POST') {
        $resourceId = rawurldecode($matches[1]);
        $assignment = hostingerMailRequireClientMailbox($pdo, (string)$portalSession['id'], $resourceId);
        $payload = hostingerMailNormalizeCompose($input, true);
        $payload['displayName'] = (string)$assignment['display_name'];
        $path = '/api/v1/mailboxes/' . hostingerMailSegment($resourceId) . '/send';
        hostingerMailStoredRequest($pdo, 'POST', $path, $payload);
        jsonResponse(['ok' => true, 'sent' => true, 'message' => 'Email sent.']);
    }

    return false;
}

function hostingerMailDispatch(PDO $pdo, string $apiPath, string $method, array $input, ?array $adminSession, ?array $portalSession): bool {
    try {
        return hostingerMailHandleRequest($pdo, $apiPath, $method, $input, $adminSession, $portalSession);
    } catch (HostingerMailApiException $error) {
        $safe = hostingerMailSafeProviderError($error, str_starts_with($apiPath, '/admin/'));
        jsonResponse(['ok' => false, 'error' => $safe[0]], $safe[1]);
    } catch (Throwable $error) {
        error_log('[hostinger-mail] Request failed (' . get_class($error) . ').');
        jsonResponse(['ok' => false, 'error' => 'The email service could not complete this request. Please try again.'], 500);
    }
    return false;
}