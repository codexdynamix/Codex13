import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apiRouter = path.join(projectRoot, 'artifacts/codex-dynamics/public/api/index.php');
const dbModule = path.join(projectRoot, 'artifacts/codex-dynamics/public/api/db.php');
const superAdminToken = 'api-test-super-admin-token';
const teamLeaderToken = 'api-test-team-leader-token';
const clientAlphaToken = 'api-test-client-alpha-token';
const clientBetaToken = 'api-test-client-beta-token';
const clientAlphaImpersonationToken = 'api-test-client-alpha-impersonation-token';
const encryptedTokenSentinel = 'test-only-encrypted-hostinger-token';
const testSessionSecret = 'api-integration-session-secret-with-more-than-32-bytes';

let testDirectory;
let apiProcess;
let apiOrigin;
let serverOutput = '';
let hostingerMockServer;
let hostingerMockOrigin;
const hostingerMockRequests = [];

async function reservePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

function seedDatabase(sqlitePath) {
  const seed = `
    $_SERVER['REQUEST_METHOD'] = 'GET';
    require ${JSON.stringify(dbModule)};
    $pdo = getDb();
    $tokenIv = random_bytes(12);
    $tokenTag = '';
    $tokenKey = hash_hmac('sha256', 'codex-client-credentials-v1', (string)getenv('SESSION_SECRET'), true);
    $tokenCiphertext = openssl_encrypt(
      ${JSON.stringify(encryptedTokenSentinel)},
      'aes-256-gcm',
      $tokenKey,
      OPENSSL_RAW_DATA,
      $tokenIv,
      $tokenTag,
      '',
      16
    );
    if ($tokenCiphertext === false) throw new RuntimeException('Could not seed the test credential.');
    $encryptedProviderToken = base64_encode($tokenIv . $tokenTag . $tokenCiphertext);
    $staff = $pdo->prepare('
      INSERT INTO staff_users
        (id, email, password, name, role, office_id, team_id, status, capabilities, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ');
    $staff->execute(['sa_test', 'sa@example.test', password_hash('not-used', PASSWORD_DEFAULT),
      'Test Super Admin', 'Super Admin', null, null, 'Active', '{}', date('c')]);
    $staff->execute(['tl_test', 'tl@example.test', password_hash('not-used', PASSWORD_DEFAULT),
      'Test Team Leader', 'Team Leader', 'office_one', 'team_one', 'Active', '{}', date('c')]);

    $session = $pdo->prepare('
      INSERT INTO admin_sessions (token_hash, user_id, expires_at, created_at)
      VALUES (?, ?, ?, ?)
    ');
    $session->execute([hash('sha256', ${JSON.stringify(superAdminToken)}), 'sa_test',
      date('c', strtotime('+1 day')), date('c')]);
    $session->execute([hash('sha256', ${JSON.stringify(teamLeaderToken)}), 'tl_test',
      date('c', strtotime('+1 day')), date('c')]);

    $lead = $pdo->prepare('
      INSERT INTO leads
        (id, first_name, last_name, name, assigned_office_id, assigned_team_id,
         assigned_team_leader_id, assigned_agent_id, appointments, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ');
    $now = date('c');
    $lead->execute(['lead_direct', 'Direct', 'Assignment', 'Direct Assignment',
      'office_one', null, 'tl_test', null, '[]', $now, $now]);
    $lead->execute(['lead_team', 'Team', 'Assignment', 'Team Assignment',
      'office_one', 'team_one', null, null, '[]', $now, $now]);
    $lead->execute(['lead_other', 'Outside', 'Scope', 'Outside Scope',
      'office_two', 'team_two', null, null, '[]', $now, $now]);

    $client = $pdo->prepare('
      INSERT INTO clients (id, name, company, email, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    ');
    $client->execute(['client_alpha', 'Alpha Contact', 'Alpha Company', 'alpha@example.test', 'Active', $now, $now]);
    $client->execute(['client_beta', 'Beta Contact', 'Beta Company', 'beta@example.test', 'Active', $now, $now]);
    $pdo->prepare('INSERT INTO client_identity_reviews (client_id_a, client_id_b, reason, status, created_at)
      VALUES (?, ?, ?, ?, ?)')->execute([
      'client_alpha', 'client_beta', 'Integration-test review', 'pending', $now,
    ]);
    $portalAccess = $pdo->prepare('
      INSERT INTO client_portal_access (client_id, password_hash, status, portal_enabled, created_at)
      VALUES (?, ?, ?, ?, ?)
    ');
    $portalAccess->execute(['client_alpha', password_hash('not-used', PASSWORD_DEFAULT), 'Active', 1, $now]);
    $portalAccess->execute(['client_beta', password_hash('not-used', PASSWORD_DEFAULT), 'Active', 1, $now]);

    $portalSession = $pdo->prepare('
      INSERT INTO portal_sessions (token_hash, client_id, expires_at, created_at)
      VALUES (?, ?, ?, ?)
    ');
    $portalSession->execute([hash('sha256', ${JSON.stringify(clientAlphaToken)}), 'client_alpha',
      date('c', strtotime('+1 day')), $now]);
    $portalSession->execute([hash('sha256', ${JSON.stringify(clientBetaToken)}), 'client_beta',
      date('c', strtotime('+1 day')), $now]);
    $pdo->prepare('INSERT INTO portal_sessions
      (token_hash, client_id, expires_at, created_at, is_impersonating, admin_user_id)
      VALUES (?, ?, ?, ?, 1, ?)')->execute([
      hash('sha256', ${JSON.stringify(clientAlphaImpersonationToken)}),
      'client_alpha',
      date('c', strtotime('+1 day')),
      $now,
      'sa_test',
    ]);

    $pdo->prepare("
      INSERT INTO hostinger_mail_integrations
        (id, encrypted_token, status, mailbox_count, created_at, updated_at)
      VALUES ('primary', ?, 'connected', 2, ?, ?)
    ")->execute([$encryptedProviderToken, $now, $now]);

    $mailbox = $pdo->prepare('
      INSERT INTO client_mailboxes
        (id, client_id, provider, provider_mailbox_id, email_address, display_name, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ');
    $mailbox->execute(['mailbox_alpha', 'client_alpha', 'hostinger', 'ACclientAlpha123',
      'info@alpha.example.test', 'Alpha Info', 'enabled', $now, $now]);
    $mailbox->execute(['mailbox_beta', 'client_beta', 'hostinger', 'ACclientBeta456',
      'info@beta.example.test', 'Beta Info', 'enabled', $now, $now]);
  `;
  execFileSync('php', ['-r', seed], {
    cwd: projectRoot,
    env: { ...process.env, CODEX_SQLITE_PATH: sqlitePath, NODE_ENV: 'test', SESSION_SECRET: testSessionSecret },
    stdio: 'pipe',
  });
}

async function startHostingerMock() {
  hostingerMockServer = createServer((request, response) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => {
      const url = new URL(request.url || '/', 'http://127.0.0.1');
      let body = {};
      try {
        body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
      } catch {}
      hostingerMockRequests.push({
        method: request.method,
        path: url.pathname,
        query: url.search,
        authorized: request.headers.authorization === `Bearer ${encryptedTokenSentinel}`,
        contentType: request.headers['content-type'] || '',
        body,
      });

      const json = (status, payload) => {
        response.writeHead(status, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify(payload));
      };
      if (request.headers.authorization !== `Bearer ${encryptedTokenSentinel}`) {
        json(401, { error: 'Unauthorized', code: 'ERR_UNAUTHORIZED' });
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/v1/me') {
        json(200, {
          data: {
            orderResourceId: 'ACorder123',
            mailboxes: [
              { resourceId: 'ACclientAlpha123', address: 'info@alpha.example.test' },
              { resourceId: 'ACunassigned789', address: 'unassigned@example.test' },
            ],
          },
        });
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/v1/mailboxes/ACclientAlpha123/folders') {
        json(200, {
          data: [
            { path: 'INBOX', name: 'Inbox', specialUse: '\\Inbox', unreadCount: 2 },
            { path: 'Sent', name: 'Sent', specialUse: '\\Sent', unreadCount: 0 },
          ],
          pagination: { page: 1, perPage: 100, total: 2, totalPages: 1 },
        });
        return;
      }
      const mockMessage = {
        uid: 77,
        path: 'INBOX',
        date: '2026-10-04T12:00:00.000Z',
        flags: ['\\Seen', '\\Flagged'],
        unseen: false,
        size: 128,
        subject: 'Mock invoice message',
        from: { name: 'Sender', address: 'sender@example.test' },
        to: [{ name: 'Alpha Info', address: 'info@alpha.example.test' }],
        cc: [],
        bcc: [],
        messageId: '<mock-77@example.test>',
        inReplyTo: null,
        attachments: [{
          id: 'att-77',
          contentType: 'text/plain',
          sizeBytes: 19,
          inline: false,
          filename: 'invoice.txt',
          contentId: '',
        }],
      };
      if (
        (request.method === 'GET' && url.pathname === '/api/v1/mailboxes/ACclientAlpha123/folders/INBOX/messages')
        || (request.method === 'POST' && url.pathname === '/api/v1/mailboxes/ACclientAlpha123/folders/INBOX/messages/search')
      ) {
        json(200, {
          data: [mockMessage],
          pagination: { page: 1, perPage: 25, total: 1, totalPages: 1 },
        });
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/v1/mailboxes/ACclientAlpha123/folders/INBOX/messages/77') {
        json(200, { data: mockMessage });
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/v1/mailboxes/ACclientAlpha123/folders/INBOX/messages/77/text') {
        json(200, { data: { text: 'Mock message body', html: '<p>Mock message body</p>' } });
        return;
      }
      if (
        request.method === 'GET'
        && url.pathname === '/api/v1/mailboxes/ACclientAlpha123/folders/INBOX/messages/77/attachments/att-77'
      ) {
        response.writeHead(200, { 'Content-Type': 'application/octet-stream' });
        response.end(Buffer.from('mock attachment data'));
        return;
      }
      if (request.method === 'POST' && url.pathname === '/api/v1/mailboxes/ACclientAlpha123/send') {
        response.writeHead(204);
        response.end();
        return;
      }
      json(404, { error: 'Not found', code: 'ERR_NOT_FOUND' });
    });
  });
  await new Promise((resolve, reject) => {
    hostingerMockServer.once('error', reject);
    hostingerMockServer.listen(0, '127.0.0.1', resolve);
  });
  const address = hostingerMockServer.address();
  if (!address || typeof address === 'string') throw new Error('Hostinger mock server did not bind to a TCP port.');
  hostingerMockOrigin = `http://127.0.0.1:${address.port}`;
}

async function requestJson(route, { token, method = 'GET', body, headers: extraHeaders = {} } = {}) {
  const headers = { Accept: 'application/json', ...extraHeaders };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${apiOrigin}${route}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

before(async () => {
  testDirectory = await mkdtemp(path.join(tmpdir(), 'codex-admin-api-'));
  await startHostingerMock();
  const sqlitePath = path.join(testDirectory, 'integration.sqlite');
  seedDatabase(sqlitePath);
  const port = await reservePort();
  apiOrigin = `http://127.0.0.1:${port}`;
  apiProcess = spawn('php', ['-S', `127.0.0.1:${port}`, apiRouter], {
    cwd: projectRoot,
    env: {
      ...process.env,
      CODEX_SQLITE_PATH: sqlitePath,
      HOSTINGER_MAIL_TEST_BASE_URL: hostingerMockOrigin,
      NODE_ENV: 'test',
      SESSION_SECRET: testSessionSecret,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  apiProcess.stdout.on('data', (chunk) => { serverOutput += chunk.toString(); });
  apiProcess.stderr.on('data', (chunk) => { serverOutput += chunk.toString(); });

  let ready = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (apiProcess.exitCode !== null) {
      throw new Error(`PHP API test server exited early:\n${serverOutput}`);
    }
    try {
      const response = await fetch(`${apiOrigin}/api/crm/settings`);
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!ready) throw new Error(`PHP API test server did not become ready:\n${serverOutput}`);
});

after(async () => {
  if (apiProcess && apiProcess.exitCode === null) {
    apiProcess.kill('SIGTERM');
    await new Promise((resolve) => {
      const timeout = setTimeout(resolve, 1000);
      apiProcess.once('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }
  if (hostingerMockServer) {
    await new Promise((resolve) => hostingerMockServer.close(resolve));
  }
  if (testDirectory) await rm(testDirectory, { recursive: true, force: true });
});

test('admin settings and appointments persist with role-scoped access', async (t) => {
  await t.test('settings persist and public responses redact the webhook URL', async () => {
    const unauthenticated = await requestJson('/api/admin/settings');
    assert.equal(unauthenticated.response.status, 401);

    const forbidden = await requestJson('/api/admin/settings', { token: teamLeaderToken });
    assert.equal(forbidden.response.status, 403);

    const saved = await requestJson('/api/admin/settings', {
      token: superAdminToken,
      method: 'PUT',
      body: {
        settings: { platformName: 'Persisted CRM Name', sessionTimeoutMinutes: 45 },
        site_config: {
          siteName: 'Persisted Site Name',
          webhookUrl: 'https://hooks.example.test/private-token',
          colors: { background: '#101010' },
        },
      },
    });
    assert.equal(saved.response.status, 200, JSON.stringify(saved.data));
    assert.equal(saved.data.settings.platformName, 'Persisted CRM Name');
    assert.equal(saved.data.settings.sessionTimeoutMinutes, 45);

    const reloaded = await requestJson('/api/admin/settings', { token: superAdminToken });
    assert.equal(reloaded.response.status, 200);
    assert.equal(reloaded.data.site_config.siteName, 'Persisted Site Name');
    assert.equal(reloaded.data.site_config.webhookUrl, 'https://hooks.example.test/private-token');

    const publicSettings = await requestJson('/api/crm/settings');
    assert.equal(publicSettings.response.status, 200);
    assert.equal(publicSettings.data.settings.platformName, 'Persisted CRM Name');
    assert.equal(publicSettings.data.site_config.siteName, 'Persisted Site Name');
    assert.equal('webhookUrl' in publicSettings.data.site_config, false);
  });

  await t.test('appointments persist and respect team-leader ownership', async () => {
    const unauthenticated = await requestJson('/api/admin/users/lead_direct/appointments');
    assert.equal(unauthenticated.response.status, 401);

    for (const leadId of ['lead_direct', 'lead_team']) {
      const visible = await requestJson(`/api/admin/users/${leadId}/appointments`, {
        token: teamLeaderToken,
      });
      assert.equal(visible.response.status, 200, JSON.stringify(visible.data));
      assert.deepEqual(visible.data.appointments, []);
    }

    const outOfScope = await requestJson('/api/admin/users/lead_other/appointments', {
      token: teamLeaderToken,
    });
    assert.equal(outOfScope.response.status, 404);

    const invalidDate = await requestJson('/api/admin/users/lead_direct/appointments', {
      token: teamLeaderToken,
      method: 'POST',
      body: { title: 'Discovery call', date: '2026-02-31', time: '09:30' },
    });
    assert.equal(invalidDate.response.status, 400);

    const created = await requestJson('/api/admin/users/lead_direct/appointments', {
      token: teamLeaderToken,
      method: 'POST',
      body: {
        title: 'Discovery call',
        date: '2027-02-28',
        time: '09:30',
        notes: 'Review project scope',
        type: 'call',
      },
    });
    assert.equal(created.response.status, 200, JSON.stringify(created.data));
    assert.equal(created.data.appointment.title, 'Discovery call');
    assert.equal(created.data.appointment.createdBy, 'Test Team Leader');

    const reloaded = await requestJson('/api/admin/users/lead_direct/appointments', {
      token: teamLeaderToken,
    });
    assert.equal(reloaded.response.status, 200);
    assert.equal(reloaded.data.appointments.length, 1);
    assert.equal(reloaded.data.appointments[0].time, '09:30');
  });

  await t.test('existing admin queue routes still respond', async () => {
    const pending = await requestJson('/api/admin/pending-counts', { token: superAdminToken });
    assert.equal(pending.response.status, 200);

    const resets = await requestJson('/api/admin/password-reset-requests', { token: superAdminToken });
    assert.equal(resets.response.status, 200);
  });
});

test('newsletter subscribers are validated, persisted centrally, and deduplicated', async () => {
  const invalid = await requestJson('/api/newsletter/subscribers', {
    method: 'POST',
    body: { email: 'not-an-email', source: 'integration-test' },
  });
  assert.equal(invalid.response.status, 422);
  assert.equal(invalid.data.ok, false);

  const first = await requestJson('/api/newsletter/subscribers', {
    method: 'POST',
    body: { email: 'digest@example.test', source: 'integration-test' },
  });
  assert.equal(first.response.status, 201, JSON.stringify(first.data));
  assert.equal(first.data.ok, true);
  assert.equal(first.data.alreadySubscribed, false);

  const duplicate = await requestJson('/api/newsletter/subscribers', {
    method: 'POST',
    body: { email: ' DIGEST@example.test ', source: 'footer' },
  });
  assert.equal(duplicate.response.status, 200, JSON.stringify(duplicate.data));
  assert.equal(duplicate.data.ok, true);
  assert.equal(duplicate.data.alreadySubscribed, true);
});

test('visitor and admin chat APIs persist messages across reloads', async () => {
  const chatToken = 'integration-test-visitor-chat-session-token-0001';
  const headers = { 'X-Chat-Token': chatToken };
  const empty = await requestJson('/api/crm/chat/messages', { headers });
  assert.equal(empty.response.status, 200, JSON.stringify(empty.data));
  assert.deepEqual(empty.data.messages, []);

  const visitorMessage = await requestJson('/api/crm/chat/messages', {
    method: 'POST',
    headers,
    body: { message: 'Can you share the project timeline?' },
  });
  assert.equal(visitorMessage.response.status, 201, JSON.stringify(visitorMessage.data));
  const clientId = visitorMessage.data.message.user_id;
  assert.equal(visitorMessage.data.message.sender, 'client');

  const staffMessage = await requestJson('/api/admin/messages', {
    token: superAdminToken,
    method: 'POST',
    body: { user_id: clientId, body: 'We will send the timeline today.' },
  });
  assert.equal(staffMessage.response.status, 200, JSON.stringify(staffMessage.data));
  assert.equal(staffMessage.data.message.sender, 'agent');

  const visitorReload = await requestJson('/api/crm/chat/messages', { headers });
  assert.equal(visitorReload.response.status, 200, JSON.stringify(visitorReload.data));
  assert.deepEqual(visitorReload.data.messages.map((message) => message.body).sort(), [
    'Can you share the project timeline?',
    'We will send the timeline today.',
  ].sort());

  const adminHistory = await requestJson(`/api/admin/messages?user_id=${encodeURIComponent(clientId)}`, {
    token: superAdminToken,
  });
  assert.equal(adminHistory.response.status, 200, JSON.stringify(adminHistory.data));
  assert.deepEqual(adminHistory.data.messages.map((message) => message.body).sort(), [
    'Can you share the project timeline?',
    'We will send the timeline today.',
  ].sort());

  const adminThreads = await requestJson('/api/admin/messages/threads', { token: superAdminToken });
  assert.equal(adminThreads.response.status, 200, JSON.stringify(adminThreads.data));
  const thread = adminThreads.data.threads.find((item) => item.id === clientId);
  assert.ok(thread, 'Admin chat should list the visitor thread');
  assert.ok(thread.last_message, 'The admin thread should expose its latest message');
});

test('staff notes are authenticated, saved, and returned from the database', async () => {
  const unauthenticated = await requestJson('/api/admin/staff/tl_test/notes');
  assert.equal(unauthenticated.response.status, 401);

  const created = await requestJson('/api/admin/staff/tl_test/notes', {
    token: superAdminToken,
    method: 'POST',
    body: { text: 'Confirm team-lead onboarding is complete.' },
  });
  assert.equal(created.response.status, 201, JSON.stringify(created.data));
  assert.equal(created.data.note.text, 'Confirm team-lead onboarding is complete.');

  const reloaded = await requestJson('/api/admin/staff/tl_test/notes', { token: superAdminToken });
  assert.equal(reloaded.response.status, 200, JSON.stringify(reloaded.data));
  assert.equal(reloaded.data.notes.length, 1);
  assert.equal(reloaded.data.notes[0].text, created.data.note.text);
  assert.equal(reloaded.data.notes[0].by, 'Test Super Admin');
});

test('client project milestones are scoped and approvals persist for the client and staff', async () => {
  const unauthenticated = await requestJson(
    '/api/portal/projects/project_test/milestones/milestone_test/approve',
    { method: 'POST' },
  );
  assert.equal(unauthenticated.response.status, 401);

  const created = await requestJson('/api/admin/client-projects', {
    token: superAdminToken,
    method: 'POST',
    body: {
      client_id: 'client_alpha',
      name: 'Portal Approval Integration Project',
      status: 'In Progress',
      progress: 35,
      milestones: [{
        id: 'milestone_design_review',
        title: 'Design review',
        status: 'in_progress',
        dueDate: '2027-01-15',
      }],
      recent_updates: [],
    },
  });
  assert.equal(created.response.status, 201, JSON.stringify(created.data));
  const projectId = created.data.project.id;
  const approvalPath = `/api/portal/projects/${encodeURIComponent(projectId)}/milestones/milestone_design_review/approve`;

  const impersonated = await requestJson(approvalPath, {
    token: clientAlphaImpersonationToken,
    method: 'POST',
  });
  assert.equal(impersonated.response.status, 403, JSON.stringify(impersonated.data));
  assert.match(impersonated.data.error, /read-only/i);

  const foreignClient = await requestJson(approvalPath, {
    token: clientBetaToken,
    method: 'POST',
  });
  assert.equal(foreignClient.response.status, 404, JSON.stringify(foreignClient.data));

  const approved = await requestJson(approvalPath, {
    token: clientAlphaToken,
    method: 'POST',
  });
  assert.equal(approved.response.status, 200, JSON.stringify(approved.data));
  const approvedMilestone = approved.data.project.milestones[0];
  assert.equal(approvedMilestone.clientApproved, true);
  assert.ok(approvedMilestone.clientApprovedAt);

  const repeatedApproval = await requestJson(approvalPath, {
    token: clientAlphaToken,
    method: 'POST',
  });
  assert.equal(repeatedApproval.response.status, 200, JSON.stringify(repeatedApproval.data));
  assert.equal(repeatedApproval.data.project.milestones[0].clientApprovedAt, approvedMilestone.clientApprovedAt);

  const portalReload = await requestJson('/api/portal/data?client_id=client_alpha', { token: clientAlphaToken });
  assert.equal(portalReload.response.status, 200, JSON.stringify(portalReload.data));
  const reloadedProject = portalReload.data.projects.find((project) => project.id === projectId);
  assert.ok(reloadedProject, 'The approved project should remain in portal data');
  const reloadedMilestones = typeof reloadedProject.milestones === 'string'
    ? JSON.parse(reloadedProject.milestones)
    : reloadedProject.milestones;
  assert.equal(reloadedMilestones[0].clientApproved, true);
  assert.equal(reloadedMilestones[0].clientApprovedAt, approvedMilestone.clientApprovedAt);

  const staffProjects = await requestJson('/api/admin/client-projects', { token: superAdminToken });
  assert.equal(staffProjects.response.status, 200, JSON.stringify(staffProjects.data));
  const staffProject = staffProjects.data.projects.find((project) => project.id === projectId);
  assert.equal(staffProject.milestones[0].clientApproved, true);
  assert.equal(staffProject.milestones[0].clientApprovedAt, approvedMilestone.clientApprovedAt);
});

test('identity reviews require Super Admin resolution and blocked merges leave data pending', async () => {
  const forbidden = await requestJson('/api/admin/client-identity-reviews?status=pending', {
    token: teamLeaderToken,
  });
  assert.equal(forbidden.response.status, 403);

  const pending = await requestJson('/api/admin/client-identity-reviews?status=pending', {
    token: superAdminToken,
  });
  assert.equal(pending.response.status, 200, JSON.stringify(pending.data));
  assert.ok(pending.data.reviews.some((review) =>
    review.client_id_a === 'client_alpha' && review.client_id_b === 'client_beta'));

  const blockedMerge = await requestJson('/api/admin/client-identity-reviews/client_alpha/client_beta', {
    token: superAdminToken,
    method: 'POST',
    body: { decision: 'merge', primary_client_id: 'client_alpha' },
  });
  assert.equal(blockedMerge.response.status, 409, JSON.stringify(blockedMerge.data));

  const stillPending = await requestJson('/api/admin/client-identity-reviews?status=pending', {
    token: superAdminToken,
  });
  assert.ok(stillPending.data.reviews.some((review) =>
    review.client_id_a === 'client_alpha' && review.client_id_b === 'client_beta'));

  const distinct = await requestJson('/api/admin/client-identity-reviews/client_alpha/client_beta', {
    token: superAdminToken,
    method: 'POST',
    body: { decision: 'distinct' },
  });
  assert.equal(distinct.response.status, 200, JSON.stringify(distinct.data));
  assert.equal(distinct.data.status, 'resolved_distinct');

  const resolved = await requestJson('/api/admin/client-identity-reviews?status=pending', {
    token: superAdminToken,
  });
  assert.equal(resolved.data.reviews.some((review) =>
    review.client_id_a === 'client_alpha' && review.client_id_b === 'client_beta'), false);
});

test('Hostinger mail access is client-scoped and integration responses redact the token', async (t) => {
  await t.test('the Hostinger integration remains Super Admin-only and never returns its stored value', async () => {
    const unauthenticated = await requestJson('/api/admin/integrations/hostinger-mail');
    assert.equal(unauthenticated.response.status, 401);

    const forbidden = await requestJson('/api/admin/integrations/hostinger-mail', {
      token: teamLeaderToken,
    });
    assert.equal(forbidden.response.status, 403);

    const configured = await requestJson('/api/admin/integrations/hostinger-mail', {
      token: superAdminToken,
    });
    assert.equal(configured.response.status, 200, JSON.stringify(configured.data));
    assert.equal(configured.data.integration.configured, true);
    assert.equal(JSON.stringify(configured.data).includes(encryptedTokenSentinel), false);
    assert.equal('encrypted_token' in configured.data.integration, false);
  });

  await t.test('mailbox lists use the authenticated client, not a client_id query parameter', async () => {
    const alphaMailboxes = await requestJson('/api/portal/mailboxes?client_id=client_beta', {
      token: clientAlphaToken,
    });
    assert.equal(alphaMailboxes.response.status, 200, JSON.stringify(alphaMailboxes.data));
    assert.deepEqual(
      alphaMailboxes.data.mailboxes.map((mailbox) => mailbox.providerMailboxId),
      ['ACclientAlpha123'],
    );
    assert.equal(alphaMailboxes.data.mailboxes[0].emailAddress, 'info@alpha.example.test');

    const betaMailboxes = await requestJson('/api/portal/mailboxes?client_id=client_alpha', {
      token: clientBetaToken,
    });
    assert.equal(betaMailboxes.response.status, 200, JSON.stringify(betaMailboxes.data));
    assert.deepEqual(
      betaMailboxes.data.mailboxes.map((mailbox) => mailbox.providerMailboxId),
      ['ACclientBeta456'],
    );
  });

  await t.test('a foreign mailbox is rejected before any Hostinger request is attempted', async () => {
    assert.equal(hostingerMockRequests.length, 0);
    const folders = await requestJson('/api/portal/mailboxes/ACclientBeta456/folders', {
      token: clientAlphaToken,
    });
    assert.equal(folders.response.status, 403, JSON.stringify(folders.data));

    const send = await requestJson('/api/portal/mailboxes/ACclientBeta456/send', {
      token: clientAlphaToken,
      method: 'POST',
      body: { to: ['recipient@example.test'], subject: 'Denied', text: 'Must not reach Hostinger.' },
    });
    assert.equal(send.response.status, 403, JSON.stringify(send.data));
    assert.equal(hostingerMockRequests.length, 0);

    const drafts = await requestJson('/api/portal/mailboxes/ACclientBeta456/drafts', {
      token: clientAlphaToken,
    });
    assert.equal(drafts.response.status, 403, JSON.stringify(drafts.data));
  });

  await t.test('configured account, folders, and send requests use the authenticated provider API', async () => {
    const account = await requestJson('/api/admin/hostinger/mailboxes', { token: superAdminToken });
    assert.equal(account.response.status, 200, JSON.stringify(account.data));
    const assignedMailbox = account.data.mailboxes.find((mailbox) => mailbox.resourceId === 'ACclientAlpha123');
    assert.equal(assignedMailbox.assignedClientId, 'client_alpha');
    const unassignedMailbox = account.data.mailboxes.find((mailbox) => mailbox.resourceId === 'ACunassigned789');
    assert.equal(unassignedMailbox.assignedClientId, null);

    const folders = await requestJson('/api/portal/mailboxes/ACclientAlpha123/folders', {
      token: clientAlphaToken,
    });
    assert.equal(folders.response.status, 200, JSON.stringify(folders.data));
    assert.deepEqual(folders.data.folders.map((folder) => folder.path), ['INBOX', 'Sent']);

    const messages = await requestJson('/api/portal/mailboxes/ACclientAlpha123/folders/INBOX/messages?page=1&perPage=25', {
      token: clientAlphaToken,
    });
    assert.equal(messages.response.status, 200, JSON.stringify(messages.data));
    assert.equal(messages.data.messages[0].uid, 77);
    assert.equal(messages.data.pagination.total, 1);

    const search = await requestJson('/api/portal/mailboxes/ACclientAlpha123/folders/INBOX/messages/search?page=1&perPage=25', {
      token: clientAlphaToken,
      method: 'POST',
      body: { text: 'invoice' },
    });
    assert.equal(search.response.status, 200, JSON.stringify(search.data));
    assert.equal(search.data.messages[0].subject, 'Mock invoice message');

    const opened = await requestJson('/api/portal/mailboxes/ACclientAlpha123/folders/INBOX/messages/77', {
      token: clientAlphaToken,
    });
    assert.equal(opened.response.status, 200, JSON.stringify(opened.data));
    assert.equal(opened.data.message.uid, 77);
    assert.equal(opened.data.body.text, 'Mock message body');

    const attachment = await fetch(
      `${apiOrigin}/api/portal/mailboxes/ACclientAlpha123/folders/INBOX/messages/77/attachments/att-77`,
      { headers: { Authorization: `Bearer ${clientAlphaToken}` } },
    );
    assert.equal(attachment.status, 200);
    assert.equal(attachment.headers.get('content-type'), 'application/octet-stream');
    assert.equal(await attachment.text(), 'mock attachment data');

    const sent = await requestJson('/api/portal/mailboxes/ACclientAlpha123/send', {
      token: clientAlphaToken,
      method: 'POST',
      body: {
        to: ['recipient@example.test'],
        cc: [],
        bcc: [],
        subject: 'Mocked provider send',
        text: 'This request is intercepted by the local provider test server.',
      },
    });
    assert.equal(sent.response.status, 200, JSON.stringify(sent.data));
    assert.equal(sent.data.sent, true);

    const accountRequest = hostingerMockRequests.find((item) => item.path === '/api/v1/me');
    assert.equal(accountRequest?.method, 'GET');
    assert.equal(accountRequest?.authorized, true);
    const searchRequest = hostingerMockRequests.find((item) => item.path.endsWith('/messages/search') && item.body.text);
    assert.equal(searchRequest?.authorized, true);
    assert.equal(searchRequest?.body.text, 'invoice');
    const attachmentRequest = hostingerMockRequests.find((item) => item.path.endsWith('/attachments/att-77'));
    assert.equal(attachmentRequest?.authorized, true);
    const sendRequest = hostingerMockRequests.find((item) => item.path.endsWith('/send'));
    assert.equal(sendRequest?.method, 'POST');
    assert.equal(sendRequest?.authorized, true);
    assert.match(sendRequest?.contentType || '', /application\/json/i);
    assert.equal(sendRequest?.body.displayName, 'Alpha Info');
    assert.deepEqual(sendRequest?.body.to, ['recipient@example.test']);
    assert.equal(sendRequest?.body.text, 'This request is intercepted by the local provider test server.');

    const unconfirmedTransfer = await requestJson('/api/admin/client-mailboxes/mailbox_alpha/reassign', {
      token: superAdminToken,
      method: 'POST',
      body: { targetClientId: 'client_beta', displayName: 'Beta Support' },
    });
    assert.equal(unconfirmedTransfer.response.status, 422);

    const transferred = await requestJson('/api/admin/client-mailboxes/mailbox_alpha/reassign', {
      token: superAdminToken,
      method: 'POST',
      body: { targetClientId: 'client_beta', displayName: 'Beta Support', confirmed: true },
    });
    assert.equal(transferred.response.status, 200, JSON.stringify(transferred.data));

    const alphaAfterTransfer = await requestJson('/api/portal/mailboxes', { token: clientAlphaToken });
    const betaAfterTransfer = await requestJson('/api/portal/mailboxes', { token: clientBetaToken });
    assert.deepEqual(alphaAfterTransfer.data.mailboxes, []);
    assert.deepEqual(
      betaAfterTransfer.data.mailboxes.map((mailbox) => [mailbox.providerMailboxId, mailbox.displayName]),
      [['ACclientAlpha123', 'Beta Support'], ['ACclientBeta456', 'Beta Info']],
    );
  });
});
test('audit log routes require a Super Admin and support entry deletion', async () => {
  const anonymous = await requestJson('/api/admin/audit');
  assert.equal(anonymous.response.status, 401);
  const teamLeader = await requestJson('/api/admin/audit', { token: teamLeaderToken });
  assert.equal(teamLeader.response.status, 403);
  const superAdmin = await requestJson('/api/admin/audit', { token: superAdminToken });
  assert.equal(superAdmin.response.status, 200);
  assert.ok(Array.isArray(superAdmin.data.log));

  const missing = await requestJson('/api/admin/audit/does-not-exist', { token: superAdminToken, method: 'DELETE' });
  assert.equal(missing.response.status, 404);
  const tlDelete = await requestJson('/api/admin/audit/does-not-exist', { token: teamLeaderToken, method: 'DELETE' });
  assert.equal(tlDelete.response.status, 403);
});

test('per-client notification inbox can be listed, pruned, and cleared by authorised staff', async () => {
  for (const message of ['First notice', 'Second notice']) {
    const sent = await requestJson('/api/admin/notifications/send', {
      token: superAdminToken, method: 'POST', body: { user_id: 'lead_direct', message },
    });
    assert.equal(sent.response.status, 200, JSON.stringify(sent.data));
  }

  const listed = await requestJson('/api/admin/users/lead_direct/notifications', { token: teamLeaderToken });
  assert.equal(listed.response.status, 200, JSON.stringify(listed.data));
  const direct = listed.data.notifications.filter((row) => row.user_id === 'lead_direct');
  assert.equal(direct.length, 2);
  assert.ok(direct.every((row) => typeof row.message === 'string' && row.is_broadcast === 0));

  const outside = await requestJson('/api/admin/users/lead_other/notifications', { token: teamLeaderToken });
  assert.ok([403, 404].includes(outside.response.status));

  const pruned = await requestJson('/api/admin/users/lead_direct/notifications/delete', {
    token: teamLeaderToken, method: 'POST', body: { ids: [direct[0].id] },
  });
  assert.equal(pruned.response.status, 200);
  assert.equal(pruned.data.deleted, 1);

  const tlClear = await requestJson('/api/admin/users/lead_direct/notifications/clear', { token: teamLeaderToken, method: 'DELETE' });
  assert.equal(tlClear.response.status, 403);
  const cleared = await requestJson('/api/admin/users/lead_direct/notifications/clear', { token: superAdminToken, method: 'DELETE' });
  assert.equal(cleared.response.status, 200);
  assert.equal(cleared.data.deleted, 1);
});

test('admin session works from the HttpOnly cookie and rejects cross-site writes', async () => {
  const cookie = `cdx_admin_session=${superAdminToken}`;
  const viaCookie = await requestJson('/api/admin/audit', { headers: { Cookie: cookie } });
  assert.equal(viaCookie.response.status, 200);

  const crossSite = await requestJson('/api/admin/audit/does-not-exist', {
    method: 'DELETE', headers: { Cookie: cookie, Origin: 'https://evil.example' },
  });
  assert.equal(crossSite.response.status, 403);

  const sameSite = await requestJson('/api/admin/audit/does-not-exist', {
    method: 'DELETE', headers: { Cookie: cookie, Origin: apiOrigin },
  });
  assert.equal(sameSite.response.status, 404);
});

test('CORS headers are only sent to allow-listed origins', async () => {
  const { response } = await requestJson('/api/crm/settings', { headers: { Origin: 'https://evil.example' } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), null);
});

test('admin login sets an HttpOnly SameSite session cookie and logout clears it', async () => {
  const login = await requestJson('/api/admin/login', {
    method: 'POST', body: { email: 'sa@example.test', password: 'not-used' },
  });
  assert.equal(login.response.status, 200, JSON.stringify(login.data));
  const setCookie = login.response.headers.get('set-cookie') || '';
  assert.match(setCookie, /cdx_admin_session=[a-f0-9]{64}/);
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Strict/i);
  const cookie = setCookie.split(';')[0];

  const logout = await requestJson('/api/admin/logout', { method: 'POST', headers: { Cookie: cookie } });
  assert.equal(logout.response.status, 200);
  const afterLogout = await requestJson('/api/admin/audit', { headers: { Cookie: cookie } });
  assert.equal(afterLogout.response.status, 401);
});
