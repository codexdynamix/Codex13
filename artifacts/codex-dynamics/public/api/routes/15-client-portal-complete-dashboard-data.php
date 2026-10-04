<?php
/** Route group: CLIENT PORTAL: COMPLETE DASHBOARD DATA (included by index.php in order; uses its request globals). */

declare(strict_types=1);

// -----------------------------------------------------------------------------
// 15. CLIENT PORTAL: COMPLETE DASHBOARD DATA
// -----------------------------------------------------------------------------
if ($apiPath === '/portal/access' && $method === 'GET') {
    header('Cache-Control: no-store, private');
    header('Pragma: no-cache');
    $clientId = trim((string)($_GET['client_id'] ?? $portalSession['id']));
    if ($clientId === '') jsonResponse(['ok' => false, 'error' => 'Missing client account.'], 400);
    if (empty($portalSession['impersonating']) && $clientId !== $portalSession['id']) jsonResponse(['ok' => false, 'error' => 'Forbidden.'], 403);
    $stmt = $pdo->prepare('SELECT * FROM client_access_credentials WHERE client_id = ?');
    $stmt->execute([$clientId]);
    $access = $stmt->fetch();
    if (!$access) jsonResponse(['ok' => true, 'access' => null]);
    try {
        jsonResponse(['ok' => true, 'access' => [
            'websiteUrl' => $access['website_url'] ?? '',
            'websiteUsername' => $access['website_username'] ?? '',
            'websitePassword' => decryptClientSecret($access['website_password_enc'] ?? ''),
            'emailAddress' => $access['email_address'] ?? '',
            'webmailUrl' => $access['webmail_url'] ?? '',
            'emailPassword' => decryptClientSecret($access['email_password_enc'] ?? ''),
        ]]);
    } catch (Throwable $error) {
        error_log('[portal/access] Credential decryption failed: ' . $error->getMessage());
        jsonResponse(['ok' => false, 'error' => 'Saved access details cannot be opened. Ask your administrator to check the credential encryption setup.'], 503);
    }
}

if ($apiPath === '/portal/mail' && $method === 'GET') {
    header('Cache-Control: no-store, private');
    header('Pragma: no-cache');
    $clientId = trim((string)($_GET['client_id'] ?? $portalSession['id']));
    if ($clientId === '') jsonResponse(['ok' => false, 'error' => 'Missing client account.'], 400);
    if (empty($portalSession['impersonating']) && $clientId !== $portalSession['id']) jsonResponse(['ok' => false, 'error' => 'Forbidden.'], 403);
    $stmt = $pdo->prepare('SELECT * FROM client_access_credentials WHERE client_id = ?');
    $stmt->execute([$clientId]);
    $access = $stmt->fetch();
    if (!$access || empty($access['email_address']) || empty($access['email_password_enc'])) {
        jsonResponse(['ok' => false, 'error' => 'Email access has not been configured for this client yet.'], 409);
    }
    $host = trim((string)($access['imap_host'] ?? ''));
    $port = (int)($access['imap_port'] ?? 993);
    if (!preg_match('/^[A-Za-z0-9.-]+$/', $host) || $port < 1 || $port > 65535) jsonResponse(['ok' => false, 'error' => 'Incoming email server settings are invalid.'], 503);
    try {
        $password = decryptClientSecret($access['email_password_enc']);
    } catch (Throwable $error) {
        error_log('[portal/mail] Credential decryption failed: ' . $error->getMessage());
        jsonResponse(['ok' => false, 'error' => 'The email password could not be opened. Ask your administrator to check the encryption setup.'], 503);
    }
    if (!function_exists('imap_open')) jsonResponse(['ok' => false, 'error' => 'The server is missing the PHP IMAP extension required for in-app email.'], 503);
    $tlsMode = $port === 143 ? '/imap/tls' : '/imap/ssl';
    $mailbox = @imap_open('{' . $host . ':' . $port . $tlsMode . '}INBOX', (string)$access['email_address'], $password, OP_READONLY, 1, ['DISABLE_AUTHENTICATOR' => 'GSSAPI']);
    if (!$mailbox) {
        error_log('[portal/mail] IMAP connection failed: ' . (string)imap_last_error());
        jsonResponse(['ok' => false, 'error' => 'Could not connect to this mailbox. Check the email login and incoming server settings with your administrator.'], 502);
    }
    try {
        $uid = (int)($_GET['uid'] ?? 0);
        if ($uid > 0) {
            $messageNumber = imap_msgno($mailbox, $uid);
            if ($messageNumber < 1) jsonResponse(['ok' => false, 'error' => 'That email is no longer in the inbox. Refresh the list.'], 404);
            $overview = imap_fetch_overview($mailbox, (string)$messageNumber, 0);
            $item = $overview[0] ?? null;
            if (!$item) jsonResponse(['ok' => false, 'error' => 'Could not load this email.'], 502);
            $messageId = trim((string)($item->message_id ?? ''), "<> \t\n\r\0\x0B");
            jsonResponse(['ok' => true, 'email' => [
                'uid' => $uid,
                'from' => decodeImapHeader((string)($item->from ?? '')),
                'to' => decodeImapHeader((string)($item->to ?? '')),
                'subject' => decodeImapHeader((string)($item->subject ?? '(No subject)')),
                'date' => (string)($item->date ?? ''),
                'messageId' => $messageId,
                'body' => readImapMessageText($mailbox, $messageNumber),
            ]]);
        }
        $messageNumbers = imap_search($mailbox, 'ALL') ?: [];
        rsort($messageNumbers, SORT_NUMERIC);
        $messages = [];
        foreach (array_slice($messageNumbers, 0, 40) as $messageNumber) {
            $overview = imap_fetch_overview($mailbox, (string)$messageNumber, 0);
            if (!$overview || !isset($overview[0])) continue;
            $item = $overview[0];
            $messages[] = [
                'uid' => (int)imap_uid($mailbox, (int)$messageNumber),
                'from' => decodeImapHeader((string)($item->from ?? '')),
                'subject' => decodeImapHeader((string)($item->subject ?? '(No subject)')),
                'date' => (string)($item->date ?? ''),
                'seen' => !empty($item->seen),
            ];
        }
        jsonResponse(['ok' => true, 'address' => $access['email_address'], 'messages' => $messages]);
    } catch (Throwable $error) {
        error_log('[portal/mail] Inbox read failed: ' . $error->getMessage());
        jsonResponse(['ok' => false, 'error' => 'Could not read this mailbox right now. Try again or check the IMAP settings.'], 502);
    } finally {
        imap_close($mailbox);
    }
}

if ($apiPath === '/portal/mail/reply' && $method === 'POST') {
    header('Cache-Control: no-store, private');
    header('Pragma: no-cache');
    if (!empty($portalSession['impersonating'])) jsonResponse(['ok' => false, 'error' => 'Replies can only be sent from the client’s own sign-in.'], 403);
    $clientId = $portalSession['id'];
    $uid = (int)($input['uid'] ?? 0);
    $body = trim((string)($input['body'] ?? ''));
    if ($uid < 1 || $body === '') jsonResponse(['ok' => false, 'error' => 'Choose an email and write a reply first.'], 422);
    $stmt = $pdo->prepare('SELECT * FROM client_access_credentials WHERE client_id = ?');
    $stmt->execute([$clientId]);
    $access = $stmt->fetch();
    if (!$access || empty($access['email_address']) || empty($access['email_password_enc'])) jsonResponse(['ok' => false, 'error' => 'Email access has not been configured for this client yet.'], 409);
    if (!function_exists('imap_open')) jsonResponse(['ok' => false, 'error' => 'The server is missing the PHP IMAP extension required for in-app email.'], 503);
    $host = trim((string)($access['imap_host'] ?? ''));
    $port = (int)($access['imap_port'] ?? 993);
    if (!preg_match('/^[A-Za-z0-9.-]+$/', $host) || $port < 1 || $port > 65535) jsonResponse(['ok' => false, 'error' => 'Incoming email server settings are invalid.'], 503);
    $tlsMode = $port === 143 ? '/imap/tls' : '/imap/ssl';
    $mailbox = @imap_open('{' . $host . ':' . $port . $tlsMode . '}INBOX', (string)$access['email_address'], decryptClientSecret($access['email_password_enc']), OP_READONLY, 1, ['DISABLE_AUTHENTICATOR' => 'GSSAPI']);
    if (!$mailbox) jsonResponse(['ok' => false, 'error' => 'Could not connect to this mailbox to prepare the reply.'], 502);
    try {
        $messageNumber = imap_msgno($mailbox, $uid);
        if ($messageNumber < 1) jsonResponse(['ok' => false, 'error' => 'The original email could not be found.'], 404);
        $overview = imap_fetch_overview($mailbox, (string)$messageNumber, 0);
        $item = $overview[0] ?? null;
        if (!$item) jsonResponse(['ok' => false, 'error' => 'Could not read the original email.'], 502);
        $from = imap_rfc822_parse_adrlist((string)($item->from ?? ''), '');
        $recipient = isset($from[0]) ? strtolower((string)($from[0]->mailbox ?? '') . '@' . (string)($from[0]->host ?? '')) : '';
        $subject = decodeImapHeader((string)($item->subject ?? ''));
        $messageId = trim((string)($item->message_id ?? ''), "<> \t\n\r\0\x0B");
        sendClientMailboxReply($access, $recipient, $subject, $body, $messageId);
        jsonResponse(['ok' => true, 'sent' => true]);
    } catch (Throwable $error) {
        error_log('[portal/mail] Reply failed: ' . $error->getMessage());
        jsonResponse(['ok' => false, 'error' => $error->getMessage()], 502);
    } finally {
        imap_close($mailbox);
    }
}

if ($apiPath === '/portal/data') {
    $clientId = $_GET['client_id'] ?? '';
    if (!$clientId) {
        jsonResponse(['error' => 'Missing client_id parameter'], 400);
    }
    if (empty($portalSession['impersonating']) && $clientId !== $portalSession['id']) jsonResponse(['ok' => false, 'error' => 'Forbidden.'], 403);

    $stmtC = $pdo->prepare("SELECT c.id, c.name, c.company, c.email, c.phone, c.address, c.country, c.country_code,
            a.status, a.portal_enabled, a.tier, a.last_login_at, c.created_at
        FROM clients c JOIN client_portal_access a ON a.client_id = c.id WHERE c.id = ?");
    $stmtC->execute([$clientId]);
    $client = $stmtC->fetch() ?: null;

    $stmtW = $pdo->prepare("SELECT * FROM client_websites WHERE client_id = ?");
    $stmtW->execute([$clientId]);
    $websites = $stmtW->fetchAll();

    $stmtP = $pdo->prepare("SELECT * FROM client_projects WHERE client_id = ?");
    $stmtP->execute([$clientId]);
    $projects = $stmtP->fetchAll();

    $stmtI = $pdo->prepare("SELECT * FROM client_invoices WHERE client_id = ? AND status <> 'Draft'");
    $stmtI->execute([$clientId]);
    $invoices = $stmtI->fetchAll();

    $stmtT = $pdo->prepare("SELECT * FROM client_support_tickets WHERE client_id = ? ORDER BY created_at DESC");
    $stmtT->execute([$clientId]);
    $tickets = $stmtT->fetchAll();

    $collections = [];
    foreach ([
        'payments' => 'client_payments',
        'hosting' => 'client_hosting',
        'domains' => 'client_domains',
        'files' => 'client_files',
    ] as $key => $table) {
        $stmt = $pdo->prepare("SELECT * FROM {$table} WHERE client_id = ?");
        $stmt->execute([$clientId]);
        $collections[$key] = $stmt->fetchAll();
    }
    $stmtN = $pdo->prepare("SELECT * FROM notifications WHERE user_id = ? OR user_id IS NULL OR user_id = '' ORDER BY created_at DESC");
    $stmtN->execute([$clientId]);
    $notifications = $stmtN->fetchAll();
    $stmtM = $pdo->prepare("SELECT * FROM messages WHERE user_id = ? ORDER BY created_at ASC");
    $stmtM->execute([$clientId]);
    $messages = $stmtM->fetchAll();

    jsonResponse([
        'ok' => true,
        'client' => $client,
        'websites' => $websites,
        'projects' => $projects,
        'invoices' => $invoices,
        'tickets' => $tickets,
        'payments' => $collections['payments'],
        'hosting' => $collections['hosting'],
        'domains' => $collections['domains'],
        'files' => $collections['files'],
        'notifications' => $notifications,
        'messages' => $messages,
    ]);
}

if ($apiPath === '/portal/profile' && $method === 'POST') {
    if (!empty($portalSession['impersonating'])) jsonResponse(['ok' => false, 'error' => 'Impersonation is read-only.'], 403);
    $clientId = $portalSession['id'];
    $updates = [];
    foreach (['name', 'company', 'phone', 'address', 'country'] as $field) {
        if (array_key_exists($field, $input)) $updates[$field] = trim((string)$input[$field]);
    }
    $newPassword = (string)($input['password'] ?? '');
    if ($newPassword !== '') {
        if (strlen($newPassword) < 8 || strlen($newPassword) > 4096) {
            jsonResponse(['ok' => false, 'error' => 'Password must contain at least 8 characters.'], 422);
        }
        $passwordHash = password_hash($newPassword, PASSWORD_DEFAULT);
        if ($passwordHash === false) jsonResponse(['ok' => false, 'error' => 'Could not securely save the password.'], 500);
    }
    if (!$updates && !isset($passwordHash)) jsonResponse(['ok' => false, 'error' => 'No profile changes were provided.'], 400);
    if ($updates) {
        $set = implode(', ', array_map(static fn($key) => "{$key} = ?", array_keys($updates)));
        $pdo->prepare("UPDATE clients SET {$set}, updated_at = ? WHERE id = ?")
            ->execute([...array_values($updates), date('c'), $clientId]);
    }
    if (isset($passwordHash)) {
        $pdo->prepare('UPDATE client_portal_access SET password_hash = ? WHERE client_id = ?')
            ->execute([$passwordHash, $clientId]);
    }
    jsonResponse(['ok' => true]);
}
