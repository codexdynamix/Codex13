import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apiRouter = path.join(projectRoot, 'artifacts/codex-dynamics/public/api/index.php');
const dbModule = path.join(projectRoot, 'artifacts/codex-dynamics/public/api/db.php');
const superAdminToken = 'api-test-super-admin-token';
const teamLeaderToken = 'api-test-team-leader-token';

let testDirectory;
let apiProcess;
let apiOrigin;
let serverOutput = '';

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
  `;
  execFileSync('php', ['-r', seed], {
    cwd: projectRoot,
    env: { ...process.env, CODEX_SQLITE_PATH: sqlitePath, NODE_ENV: 'test' },
    stdio: 'pipe',
  });
}

async function requestJson(route, { token, method = 'GET', body } = {}) {
  const headers = { Accept: 'application/json' };
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
  const sqlitePath = path.join(testDirectory, 'integration.sqlite');
  seedDatabase(sqlitePath);
  const port = await reservePort();
  apiOrigin = `http://127.0.0.1:${port}`;
  apiProcess = spawn('php', ['-S', `127.0.0.1:${port}`, apiRouter], {
    cwd: projectRoot,
    env: { ...process.env, CODEX_SQLITE_PATH: sqlitePath, NODE_ENV: 'test' },
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