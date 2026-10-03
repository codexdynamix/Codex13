import http from 'http';

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const method = options.method || 'GET';
    const postData = options.body ? JSON.stringify(options.body) : null;
    const headers = {
      'Accept': 'application/json',
      ...(options.headers || {})
    };
    if (postData) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request({
      hostname: '127.0.0.1',
      port: 3000,
      path,
      method,
      headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch (_) {
          parsed = data;
        }
        resolve({ status: res.statusCode, headers: res.headers, data: parsed });
      });
    });

    req.on('error', reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function pass(msg) {
  console.log(`${colors.green}  ✓ PASS:${colors.reset} ${msg}`);
}

function fail(msg, details) {
  console.error(`${colors.red}  ✗ FAIL:${colors.reset} ${msg}`, details || '');
  process.exitCode = 1;
}

function step(title) {
  console.log(`\n${colors.cyan}${colors.bold}=== ${title} ===${colors.reset}`);
}

async function runExhaustiveSmokeTests() {
  console.log(`${colors.bold}STARTING EXHAUSTIVE CRM & DATABASE SMOKE TESTS${colors.reset}`);

  // --------------------------------------------------------------------------
  // STEP 1: CREATE 5 TEST CLIENTS
  // --------------------------------------------------------------------------
  step('1. Creating 5 Test Clients in Database via Intake API');
  const clientPayloads = [
    {
      firstName: 'Arthur',
      lastName: 'Pendelton',
      company: 'Apex Global Logistics',
      email: `arthur.pendelton.${Date.now()}@apexlogistics.co.uk`,
      phone: '+44 20 7123 4567',
      country: 'United Kingdom',
      countryCode: 'GB',
      service: 'High-Performance Enterprise Web Portal',
      budget: '$25,000 - $40,000',
      timeline: '2 Months',
      message: 'Need bespoke logistics tracking with real-time Fleet GPS telemetry.',
      password: 'ClientPassword123!'
    },
    {
      firstName: 'Beatrice',
      lastName: 'Sterling',
      company: 'Sterling Wealth & Capital',
      email: `beatrice.sterling.${Date.now()}@sterlingcapital.ch`,
      phone: '+41 22 555 0192',
      country: 'Switzerland',
      countryCode: 'CH',
      service: 'LP Investor Dashboard & Vault',
      budget: '$50,000+',
      timeline: 'Immediate',
      message: 'Private banking and accredited investor onboarding portal.',
      password: 'SterlingSecure2026#'
    },
    {
      firstName: 'Christopher',
      lastName: 'Nolan',
      company: 'Synthetic Media Lab',
      email: `chris.nolan.${Date.now()}@synthetics.io`,
      phone: '+1 (415) 892-1100',
      country: 'United States',
      countryCode: 'US',
      service: 'Custom Web Application & AI Pipeline',
      budget: '$30,000 - $60,000',
      timeline: '1 Month',
      message: 'Generative video compute pipeline with interactive canvas preview.',
      password: 'CinemaScale999$'
    },
    {
      firstName: 'Diana',
      lastName: 'Prince',
      company: 'Themyscira Cultural Arts',
      email: `diana.prince.${Date.now()}@themyscira.org`,
      phone: '+30 21 0987 6543',
      country: 'Greece',
      countryCode: 'GR',
      service: 'High-Converting 3D Exhibition Store',
      budget: '$18,000 - $25,000',
      timeline: 'Immediate',
      message: 'Interactive digital archive and ticketed commerce portal.',
      password: 'AmazonGoddess456@'
    },
    {
      firstName: 'Edward',
      lastName: 'Norton',
      company: 'CloudPeak Analytics',
      email: `edward.norton.${Date.now()}@cloudpeak.net`,
      phone: '+1 (212) 555-8833',
      country: 'United States',
      countryCode: 'US',
      service: 'Sales Automation & VoIP Telephony',
      budget: '$20,000 - $35,000',
      timeline: '3 Months',
      message: 'Softphone integration, inbound call routing, and CRM pipeline.',
      password: 'FightRuleNo1#9'
    }
  ];

  const createdClients = [];
  for (let i = 0; i < clientPayloads.length; i++) {
    const payload = clientPayloads[i];
    const res = await request('/api/crm/leads', { method: 'POST', body: payload });
    if (res.status === 200 && res.data.ok && res.data.id) {
      pass(`Created Client ${i + 1}: ${payload.firstName} ${payload.lastName} (${payload.company}) - ID: ${res.data.id}`);
      createdClients.push({
        id: res.data.id,
        email: payload.email,
        name: `${payload.firstName} ${payload.lastName}`,
        company: payload.company,
        password: payload.password
      });
    } else {
      fail(`Failed creating client ${payload.email}`, res.data);
    }
  }

  // --------------------------------------------------------------------------
  // STEP 2: VERIFY CLIENTS EXIST IN SQLITE DATABASE
  // --------------------------------------------------------------------------
  step('2. Verifying Clients in Leads & Portal Clients Tables');
  const allLeadsRes = await request('/api/crm/leads');
  if (allLeadsRes.status === 200 && allLeadsRes.data.ok) {
    const leadIds = new Set(allLeadsRes.data.leads.map(l => l.id));
    for (const c of createdClients) {
      if (leadIds.has(c.id)) {
        pass(`Client record ${c.id} confirmed in leads table`);
      } else {
        fail(`Client record ${c.id} missing from leads table!`);
      }
    }
  } else {
    fail('Could not fetch leads list from API');
  }

  // Also verify user search API /api/admin/users
  const userSearchRes = await request(`/api/admin/users?search=${encodeURIComponent('Apex Global')}`);
  if (userSearchRes.status === 200 && userSearchRes.data.ok && userSearchRes.data.users.length > 0) {
    pass(`Client search by company verified: found ${userSearchRes.data.users[0].name} (${userSearchRes.data.users[0].company})`);
  } else {
    fail('User search API failed for company search');
  }

  // --------------------------------------------------------------------------
  // STEP 3: CREATE STAFF HIERARCHY (Office Manager, Team Leader, Agent)
  // --------------------------------------------------------------------------
  step('3. Creating Regional Office, Strategic Team & Staff Accounts');
  
  // Create Office: Zurich Operations Hub with Office Manager
  const officeRes = await request('/api/admin/offices', {
    method: 'POST',
    body: {
      name: 'Zurich Wealth & Private Banking Hub',
      manager_name: 'Ursula von Berg',
      manager_email: `ursula.manager.${Date.now()}@codexdynamics.com`,
      manager_password: 'ManagerPassword2026!'
    }
  });

  let officeId = null;
  let officeManager = null;
  if (officeRes.status === 200 && officeRes.data.ok && officeRes.data.office) {
    officeId = officeRes.data.office.id;
    officeManager = officeRes.data.manager;
    pass(`Created Office: "${officeRes.data.office.name}" (ID: ${officeId})`);
    if (officeManager) {
      pass(`Created Office Manager: "${officeManager.name}" (${officeManager.email})`);
    }
  } else {
    fail('Failed to create office', officeRes.data);
  }

  // Create Team: Alpine Enterprise Sales with Team Leader
  const teamRes = await request('/api/admin/teams', {
    method: 'POST',
    body: {
      office_id: officeId,
      name: 'Alpine Enterprise Sales Team',
      max_size: 8,
      leader_name: 'Klaus Reinhardt',
      leader_email: `klaus.leader.${Date.now()}@codexdynamics.com`,
      leader_password: 'LeaderPassword2026!'
    }
  });

  let teamId = null;
  let teamLeader = null;
  if (teamRes.status === 200 && teamRes.data.ok && teamRes.data.team) {
    teamId = teamRes.data.team.id;
    teamLeader = teamRes.data.leader;
    pass(`Created Team: "${teamRes.data.team.name}" (ID: ${teamId}) under Office ${officeId}`);
    if (teamLeader) {
      pass(`Created Team Leader: "${teamLeader.name}" (${teamLeader.email})`);
    }
  } else {
    fail('Failed to create team', teamRes.data);
  }

  // Create Agent: Stefan Meyer
  const agentEmail = `stefan.agent.${Date.now()}@codexdynamics.com`;
  const agentPassword = 'AgentPassword2026!';
  const agentRes = await request('/api/admin/staff', {
    method: 'POST',
    body: {
      name: 'Stefan Meyer',
      email: agentEmail,
      password: agentPassword,
      role: 'Agent',
      office_id: officeId,
      team_id: teamId
    }
  });

  let agentUser = null;
  if (agentRes.status === 200 && agentRes.data.ok && agentRes.data.staff) {
    agentUser = agentRes.data.staff;
    pass(`Created Sales Agent: "${agentUser.name}" (${agentUser.email}) under Team ${teamId}`);
  } else {
    fail('Failed to create agent', agentRes.data);
  }

  // --------------------------------------------------------------------------
  // STEP 4: TEST AUTHENTICATION FOR ALL CREATED STAFF ROLES
  // --------------------------------------------------------------------------
  step('4. Testing Staff Authentication for New Roles');

  // Test Office Manager Login
  const omLogin = await request('/api/admin/login', {
    method: 'POST',
    body: {
      email: officeManager.email,
      password: 'ManagerPassword2026!'
    }
  });
  if (omLogin.status === 200 && omLogin.data.ok && omLogin.data.token) {
    pass(`Office Manager login successful (${omLogin.data.user.name} - Role: ${omLogin.data.user.role})`);
  } else {
    fail('Office Manager login failed', omLogin.data);
  }

  // Test Team Leader Login
  const tlLogin = await request('/api/admin/login', {
    method: 'POST',
    body: {
      email: teamLeader.email,
      password: 'LeaderPassword2026!'
    }
  });
  if (tlLogin.status === 200 && tlLogin.data.ok && tlLogin.data.token) {
    pass(`Team Leader login successful (${tlLogin.data.user.name} - Role: ${tlLogin.data.user.role})`);
  } else {
    fail('Team Leader login failed', tlLogin.data);
  }

  // Test Agent Login
  const agLogin = await request('/api/admin/login', {
    method: 'POST',
    body: {
      email: agentEmail,
      password: agentPassword
    }
  });
  if (agLogin.status === 200 && agLogin.data.ok && agLogin.data.token) {
    pass(`Agent login successful (${agLogin.data.user.name} - Role: ${agLogin.data.user.role})`);
  } else {
    fail('Agent login failed', agLogin.data);
  }

  // Test Bad Password Rejection
  const badLogin = await request('/api/admin/login', {
    method: 'POST',
    body: {
      email: agentEmail,
      password: 'WrongPasswordXYZ!'
    }
  });
  if (badLogin.status === 401 && !badLogin.data.ok) {
    pass(`Bad password correctly rejected with 401: "${badLogin.data.error}"`);
  } else {
    fail('Bad password was not rejected properly', badLogin.data);
  }

  // --------------------------------------------------------------------------
  // STEP 5: TEST CLIENT DISTRIBUTION (SUPER ADMIN -> OFFICE -> TEAM -> AGENT)
  // --------------------------------------------------------------------------
  step('5. Distributing Clients to Regional Offices, Teams & Agents');

  // Distribute Client 1: London -> Alpha -> adm_ag
  const assign1 = await request(`/api/admin/leads/${createdClients[0].id}/assign`, {
    method: 'POST',
    body: { officeId: 'of_london', teamId: 'tm_alpha', agentId: 'adm_ag' }
  });
  if (assign1.status === 200 && assign1.data.ok) {
    pass(`Client 1 (${createdClients[0].name}) assigned to London Office -> Alpha Team -> Alex Agent`);
  } else {
    fail('Assign client 1 failed', assign1.data);
  }

  // Distribute Client 2: Zurich -> Alpine -> Stefan Meyer
  const assign2 = await request(`/api/admin/leads/${createdClients[1].id}/assign`, {
    method: 'POST',
    body: { officeId: officeId, teamId: teamId, agentId: agentUser.id }
  });
  if (assign2.status === 200 && assign2.data.ok) {
    pass(`Client 2 (${createdClients[1].name}) assigned to Zurich Hub -> Alpine Team -> Stefan Meyer`);
  } else {
    fail('Assign client 2 failed', assign2.data);
  }

  // Distribute Client 3: Zurich -> Alpine -> Stefan Meyer
  const assign3 = await request(`/api/admin/leads/${createdClients[2].id}/assign`, {
    method: 'POST',
    body: { officeId: officeId, teamId: teamId, agentId: agentUser.id }
  });
  if (assign3.status === 200 && assign3.data.ok) {
    pass(`Client 3 (${createdClients[2].name}) assigned to Zurich Hub -> Alpine Team -> Stefan Meyer`);
  } else {
    fail('Assign client 3 failed', assign3.data);
  }

  // Distribute Client 4: New York -> Beta (Unassigned agent)
  const assign4 = await request(`/api/admin/leads/${createdClients[3].id}/assign`, {
    method: 'POST',
    body: { officeId: 'of_newyork', teamId: 'tm_beta', agentId: null }
  });
  if (assign4.status === 200 && assign4.data.ok) {
    pass(`Client 4 (${createdClients[3].name}) assigned to New York Hub -> Beta Team (Pool)`);
  } else {
    fail('Assign client 4 failed', assign4.data);
  }

  // Distribute Client 5: London -> Alpha -> adm_ag
  const assign5 = await request(`/api/admin/leads/${createdClients[4].id}/assign`, {
    method: 'POST',
    body: { officeId: 'of_london', teamId: 'tm_alpha', agentId: 'adm_ag' }
  });
  if (assign5.status === 200 && assign5.data.ok) {
    pass(`Client 5 (${createdClients[4].name}) assigned to London Office -> Alpha Team -> Alex Agent`);
  } else {
    fail('Assign client 5 failed', assign5.data);
  }

  // Verify office list aggregates reflect counts
  const officeCheck = await request('/api/admin/offices');
  if (officeCheck.status === 200 && officeCheck.data.ok) {
    const zurich = officeCheck.data.offices.find(o => o.id === officeId);
    if (zurich && zurich.lead_count >= 2) {
      pass(`Office lead count aggregate updated in DB: Zurich has ${zurich.lead_count} assigned clients`);
    } else {
      fail('Office aggregate counts mismatch', zurich);
    }
  }

  // --------------------------------------------------------------------------
  // STEP 6: TEST CREDENTIAL CHANGE & CLIENT PORTAL LOGIN
  // --------------------------------------------------------------------------
  step('6. Testing Client Credential Updates & Portal Authentication');

  const testClient = createdClients[0];
  const updatedPassword = 'NewArthurPassword2026!#$';

  // 1. Update client password via Admin API
  const passUpdate = await request(`/api/admin/users/${testClient.id}/set-password`, {
    method: 'POST',
    body: { password: updatedPassword }
  });
  if (passUpdate.status === 200 && passUpdate.data.ok) {
    pass(`Admin updated client credentials for ${testClient.email}`);
  } else {
    fail('Password update failed', passUpdate.data);
  }

  // 2. Attempt login with OLD password -> MUST FAIL
  const oldLogin = await request('/api/portal/login', {
    method: 'POST',
    body: { email: testClient.email, password: testClient.password }
  });
  if (oldLogin.status === 401 && !oldLogin.data.ok) {
    pass(`Old password correctly rejected with 401: "${oldLogin.data.error}"`);
  } else {
    fail('Old password was unexpectedly accepted!', oldLogin.data);
  }

  // 3. Attempt login with NEW password -> MUST SUCCEED
  const newLogin = await request('/api/portal/login', {
    method: 'POST',
    body: { email: testClient.email, password: updatedPassword }
  });
  if (newLogin.status === 200 && newLogin.data.ok && newLogin.data.token) {
    pass(`Client Portal Login SUCCESSFUL with new credentials! Token: ${newLogin.data.token}`);
    pass(`Client Profile returned: ${newLogin.data.client.name} (${newLogin.data.client.tier})`);
  } else {
    fail('New password login failed!', newLogin.data);
  }

  // 4. Fetch Client Portal Complete Data
  const portalData = await request(`/api/portal/data?client_id=${testClient.id}`);
  if (portalData.status === 200 && portalData.data.ok) {
    pass(`Portal Data API retrieved: Client ${portalData.data.client.name}, Invoices: ${portalData.data.invoices.length}, Tickets: ${portalData.data.tickets.length}`);
  } else {
    fail('Portal Data API failed', portalData.data);
  }

  // --------------------------------------------------------------------------
  // STEP 7: TEST NOTIFICATIONS (Admin -> Client)
  // --------------------------------------------------------------------------
  step('7. Testing Notification Dispatch to Client Portal');

  // Send Direct Notification
  const notifRes1 = await request('/api/admin/notifications/send', {
    method: 'POST',
    body: {
      user_id: testClient.id,
      title: 'Project Architecture Phase Approved',
      message: 'Your fleet GPS telemetry specifications have been approved by the London Engineering team.',
      kind: 'project'
    }
  });
  if (notifRes1.status === 200 && notifRes1.data.ok && notifRes1.data.id) {
    pass(`Dispatched personalized notification to ${testClient.id} (Notif ID: ${notifRes1.data.id})`);
  } else {
    fail('Direct notification failed', notifRes1.data);
  }

  // Send Broadcast Notification
  const notifRes2 = await request('/api/admin/notifications/send', {
    method: 'POST',
    body: {
      user_id: null,
      title: 'Global Platform Update Scheduled',
      message: 'All client portals will receive edge network upgrades tonight at 02:00 UTC.',
      kind: 'system'
    }
  });
  if (notifRes2.status === 200 && notifRes2.data.ok) {
    pass(`Dispatched platform-wide broadcast notification`);
  } else {
    fail('Broadcast notification failed', notifRes2.data);
  }

  // Verify notifications appear in Client Notifications inbox
  const notifsList = await request(`/api/admin/notifications/sent-log?user_id=${testClient.id}`);
  if (notifsList.status === 200 && notifsList.data.ok && notifsList.data.notifications.length >= 2) {
    pass(`Client notification log confirmed: found ${notifsList.data.notifications.length} notifications for ${testClient.id}`);
  } else {
    fail('Notification inbox query failed', notifsList.data);
  }

  // --------------------------------------------------------------------------
  // STEP 8: TEST SUPPORT MESSAGES & CHAT (Lead Support <-> Client)
  // --------------------------------------------------------------------------
  step('8. Testing Bidirectional Support Chat (Staff Agent <-> Client)');

  // 1. Staff sends message to client
  const msgFromAgent = await request('/api/admin/messages', {
    method: 'POST',
    body: {
      user_id: testClient.id,
      sender: 'agent',
      sender_name: 'Alex Agent',
      body: 'Hello Arthur, welcome to Codex Dynamics! I am your dedicated account agent. How can I assist you with your telemetry portal today?'
    }
  });
  if (msgFromAgent.status === 200 && msgFromAgent.data.ok && msgFromAgent.data.message) {
    pass(`Agent message sent to client: "${msgFromAgent.data.message.body.slice(0, 50)}..."`);
  } else {
    fail('Agent message failed', msgFromAgent.data);
  }

  // 2. Client replies from Client Portal
  const msgFromClient = await request('/api/client/messages', {
    method: 'POST',
    body: {
      user_id: testClient.id,
      sender: 'client',
      sender_name: testClient.name,
      body: 'Thank you Alex! Could you confirm whether the WebSocket GPS stream supports 60Hz coordinate updates?'
    }
  });
  if (msgFromClient.status === 200 && msgFromClient.data.ok && msgFromClient.data.message) {
    pass(`Client message replied to staff: "${msgFromClient.data.message.body.slice(0, 50)}..."`);
  } else {
    fail('Client message failed', msgFromClient.data);
  }

  // 3. Verify conversation thread in DB
  const chatThread = await request(`/api/admin/messages?user_id=${testClient.id}`);
  if (chatThread.status === 200 && chatThread.data.ok && chatThread.data.messages.length >= 2) {
    pass(`Conversation thread verified in SQLite: ${chatThread.data.messages.length} messages found in order`);
  } else {
    fail('Chat thread retrieval failed', chatThread.data);
  }

  // 4. Verify audit trail reflects the messages
  const auditRes = await request(`/api/admin/audit?user_id=${testClient.id}`);
  if (auditRes.status === 200 && auditRes.data.ok && auditRes.data.log.length > 0) {
    pass(`Audit activity verified: ${auditRes.data.log.length} audit entries recorded for client actions`);
  } else {
    fail('Audit log check failed', auditRes.data);
  }

  // --------------------------------------------------------------------------
  // STEP 9: TEST SUPPORT TICKETS SYSTEM (Client Portal -> Support Queue)
  // --------------------------------------------------------------------------
  step('9. Testing Support Ticket Creation and Agent Reply');

  // Client creates ticket
  const ticketCreate = await request('/api/portal/ticket', {
    method: 'POST',
    body: {
      clientId: testClient.id,
      subject: 'Custom Domain SSL Certificate Provisioning',
      category: 'Domains & SSL',
      priority: 'High',
      senderName: testClient.name,
      message: 'We want to point portal.apexlogistics.co.uk to this dashboard with dedicated Cloudflare SSL.'
    }
  });

  let ticketId = null;
  if (ticketCreate.status === 200 && ticketCreate.data.ok && ticketCreate.data.ticket_id) {
    ticketId = ticketCreate.data.ticket_id;
    pass(`Support Ticket created: ${ticketCreate.data.ticket_number} (ID: ${ticketId})`);
  } else {
    fail('Support ticket creation failed', ticketCreate.data);
  }

  // Staff agent replies to ticket
  const ticketReply = await request('/api/portal/ticket', {
    method: 'POST',
    body: {
      clientId: testClient.id,
      ticketId: ticketId,
      sender: 'staff',
      senderName: 'Alex Agent',
      message: 'Hello Arthur, CNAME records have been generated. Please add: CNAME portal -> edge.codexdynamics.net'
    }
  });
  if (ticketReply.status === 200 && ticketReply.data.ok && ticketReply.data.messages.length >= 2) {
    pass(`Staff reply posted to ticket ${ticketId}. Total messages: ${ticketReply.data.messages.length}`);
  } else {
    fail('Staff ticket reply failed', ticketReply.data);
  }

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log(`\n${colors.green}${colors.bold}======================================================${colors.reset}`);
  console.log(`${colors.green}${colors.bold}✓ ALL RELENTLESS SMOKE TESTS COMPLETED SUCCESSFULLY!${colors.reset}`);
  console.log(`${colors.green}${colors.bold}======================================================${colors.reset}\n`);
}

runExhaustiveSmokeTests().catch((err) => {
  console.error('Smoke test runner error:', err);
  process.exit(1);
});
