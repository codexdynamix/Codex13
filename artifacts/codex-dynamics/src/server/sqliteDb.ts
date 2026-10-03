import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { DatabaseSync } = require('node:sqlite');

export interface SqliteDbInstance {
  exec: (sql: string) => void;
  prepare: (sql: string) => {
    all: (...params: any[]) => any[];
    get: (...params: any[]) => any;
    run: (...params: any[]) => { lastInsertRowid: number | bigint; changes: number };
  };
}

let dbInstance: SqliteDbInstance | null = null;

export function getSqliteDb(): SqliteDbInstance {
  if (dbInstance) {
    return dbInstance;
  }

  // Ensure data directory exists
  const serverDir = typeof import.meta !== 'undefined' && import.meta.dirname ? import.meta.dirname : __dirname;
  const projectRoot = path.resolve(serverDir, '../..');
  const dataDir = path.resolve(projectRoot, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbFilePath = path.join(dataDir, 'codex.sqlite');
  let db: any;
  try {
    db = new DatabaseSync(dbFilePath);
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA foreign_keys = ON;');
    initSqlSchema(db);
  } catch (err) {
    console.warn('[AI Studio] SQLite error, falling back to memory database:', err);
    try {
      db = new DatabaseSync(':memory:');
      initSqlSchema(db);
    } catch {
      db = {
        exec: () => {},
        prepare: () => ({ all: () => [], get: () => null, run: () => ({ lastInsertRowid: 0, changes: 0 }) }),
      };
    }
  }

  dbInstance = db;
  return db;
}

function initSqlSchema(db: SqliteDbInstance) {
  // 1. Leads Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      first_name TEXT,
      last_name TEXT,
      name TEXT,
      email TEXT,
      phone TEXT,
      country TEXT DEFAULT 'United Kingdom',
      country_code TEXT DEFAULT 'GB',
      stage TEXT DEFAULT 'New',
      status TEXT DEFAULT 'New',
      funnel TEXT DEFAULT 'General',
      company TEXT,
      service TEXT,
      budget TEXT,
      timeline TEXT,
      message TEXT,
      source TEXT DEFAULT 'direct',
      notes TEXT,
      client_password TEXT,
      assigned_office_id TEXT,
      assigned_team_id TEXT,
      assigned_agent_id TEXT,
      assigned_by TEXT,
      is_online INTEGER DEFAULT 0,
      comment_history TEXT,
      status_history TEXT,
      appointments TEXT,
      activity_record TEXT,
      registered_date TEXT,
      created_at TEXT,
      updated_at TEXT
    );
  `);

  try {
    db.exec('ALTER TABLE leads ADD COLUMN registered_date TEXT;');
  } catch (_) {}

  // 2. Clients / Users Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS portal_clients (
      id TEXT PRIMARY KEY,
      name TEXT,
      company TEXT,
      email TEXT UNIQUE,
      password TEXT,
      phone TEXT,
      address TEXT,
      country TEXT DEFAULT 'United Kingdom',
      country_code TEXT DEFAULT 'GB',
      status TEXT DEFAULT 'Active',
      portal_enabled INTEGER DEFAULT 1,
      tier TEXT DEFAULT 'Enterprise Partner',
      last_login_at TEXT,
      created_at TEXT
    );
  `);

  // 3. Notifications Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      title TEXT,
      description TEXT,
      kind TEXT DEFAULT 'info',
      type TEXT DEFAULT 'project',
      is_read INTEGER DEFAULT 0,
      link TEXT,
      sent_by TEXT DEFAULT 'Admin',
      created_at TEXT
    );
  `);

  // 4. Messages Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      sender TEXT NOT NULL,
      sender_name TEXT,
      body TEXT NOT NULL,
      attachment_name TEXT,
      attachment_path TEXT,
      is_read INTEGER DEFAULT 0,
      created_at TEXT
    );
  `);

  // 5. Audit Log (Activity) Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      client_name TEXT,
      action TEXT NOT NULL,
      details TEXT,
      ip_address TEXT,
      created_at TEXT
    );
  `);

  // 6. Portfolio Projects Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      site_name TEXT,
      site_url TEXT,
      description TEXT,
      category TEXT DEFAULT 'Websites & Web Apps',
      image_url TEXT,
      is_published INTEGER DEFAULT 1,
      created_at TEXT
    );
  `);

  // 7. Blog Posts Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS blogs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT UNIQUE,
      content TEXT,
      excerpt TEXT,
      category TEXT DEFAULT 'Engineering',
      author TEXT DEFAULT 'Codex Team',
      status TEXT DEFAULT 'published',
      featured_image TEXT,
      meta_description TEXT,
      reading_time INTEGER DEFAULT 5,
      created_at TEXT,
      updated_at TEXT
    );
  `);

  // 8. Reviews Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      author TEXT NOT NULL,
      rating INTEGER DEFAULT 5,
      comment TEXT,
      is_published INTEGER DEFAULT 1,
      created_at TEXT
    );
  `);

  // 9. Backlinks Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS backlinks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      notes TEXT,
      created_at TEXT
    );
  `);

  // 10. Staff Users Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS staff_users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      office_id TEXT,
      team_id TEXT,
      status TEXT DEFAULT 'Active',
      capabilities TEXT,
      last_login_at TEXT,
      created_at TEXT
    );
  `);

  // 11. Client Websites Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS client_websites (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      name TEXT NOT NULL,
      domain TEXT NOT NULL,
      website_url TEXT NOT NULL,
      back_office_url TEXT NOT NULL,
      status TEXT DEFAULT 'Active',
      connection_status TEXT DEFAULT 'Connected',
      connector_id TEXT,
      connector_secret TEXT,
      access_enabled INTEGER DEFAULT 1,
      tech_stack TEXT,
      hosting_plan TEXT,
      ssl_status TEXT,
      created_at TEXT,
      updated_at TEXT
    );
  `);

  // 12. Client Projects Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS client_projects (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      service TEXT,
      status TEXT DEFAULT 'In Progress',
      progress INTEGER DEFAULT 0,
      start_date TEXT,
      target_date TEXT,
      team_lead TEXT,
      milestones TEXT,
      recent_updates TEXT,
      created_at TEXT,
      updated_at TEXT
    );
  `);

  // 13. Client Invoices Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS client_invoices (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      invoice_number TEXT NOT NULL,
      issue_date TEXT NOT NULL,
      due_date TEXT NOT NULL,
      paid_date TEXT,
      status TEXT DEFAULT 'Pending',
      currency TEXT DEFAULT 'USD',
      subtotal REAL DEFAULT 0,
      tax REAL DEFAULT 0,
      total REAL DEFAULT 0,
      amount_paid REAL DEFAULT 0,
      balance_due REAL DEFAULT 0,
      payment_method TEXT,
      line_items TEXT,
      notes TEXT,
      created_at TEXT
    );
  `);

  // 14. Client Payments Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS client_payments (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      invoice_id TEXT,
      receipt_number TEXT NOT NULL,
      payment_date TEXT NOT NULL,
      amount REAL DEFAULT 0,
      payment_method TEXT,
      transaction_reference TEXT,
      description TEXT,
      status TEXT DEFAULT 'Completed',
      created_at TEXT
    );
  `);

  // 15. Client Hosting Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS client_hosting (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      website_id TEXT,
      website_name TEXT,
      provider TEXT,
      plan TEXT,
      status TEXT DEFAULT 'Active',
      start_date TEXT,
      renewal_date TEXT,
      billing_frequency TEXT DEFAULT 'Monthly',
      amount REAL DEFAULT 0,
      auto_renew INTEGER DEFAULT 1,
      server_region TEXT,
      ip_address TEXT,
      uptime TEXT DEFAULT '99.99%'
    );
  `);

  // 16. Client Domains Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS client_domains (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      domain_name TEXT NOT NULL,
      registrar TEXT DEFAULT 'Codex Managed',
      registration_date TEXT,
      expiration_date TEXT,
      renewal_status TEXT DEFAULT 'Auto-Renew Active',
      auto_renew INTEGER DEFAULT 1,
      dns_management INTEGER DEFAULT 1,
      nameservers TEXT,
      records TEXT
    );
  `);

  // 17. Client Support Tickets Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS client_support_tickets (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      ticket_number TEXT NOT NULL,
      subject TEXT NOT NULL,
      category TEXT DEFAULT 'General',
      priority TEXT DEFAULT 'Medium',
      status TEXT DEFAULT 'Open',
      assigned_agent TEXT,
      messages TEXT,
      created_at TEXT,
      updated_at TEXT
    );
  `);

  // 18. Client Files Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS client_files (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT DEFAULT 'Deliverables',
      size TEXT,
      uploaded_at TEXT,
      file_type TEXT,
      download_url TEXT
    );
  `);

  // 19. Offices Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS offices (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      manager_id TEXT,
      manager_name TEXT,
      manager_email TEXT,
      created_at TEXT
    );
  `);

  // 20. Teams Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      office_id TEXT,
      leader_id TEXT,
      leader_name TEXT,
      max_size INTEGER DEFAULT 10,
      created_at TEXT
    );
  `);

  // Seed Initial SQL Data if empty
  seedSqlData(db);
}

function seedSqlData(db: SqliteDbInstance) {
  const clientCount = db.prepare('SELECT COUNT(*) as cnt FROM portal_clients').get() as { cnt: number };
  const now = new Date().toISOString();

  if (clientCount.cnt === 0) {
    const insertClient = db.prepare(`
      INSERT INTO portal_clients (id, name, company, email, password, phone, address, country, country_code, status, portal_enabled, tier, last_login_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', 1, ?, ?, ?)
    `);

    insertClient.run(
      'client_vance',
      'Eleanor Vance',
      'Vance Tech Capital',
      'eleanor.vance@vancetech.io',
      'client123',
      '+1 (415) 890-2341',
      '450 Mission St, Suite 1800, San Francisco, CA 94105',
      'United States',
      'US',
      'Enterprise Partner',
      new Date(Date.now() - 3600000).toISOString(),
      now
    );

    insertClient.run(
      'client_brody',
      'Marcus Brody',
      'Brody Luxury Goods',
      'marcus@brodydesign.co',
      'client123',
      '+44 20 7946 0912',
      '14 Berkeley Square, Mayfair, London W1J 6BL',
      'United Kingdom',
      'GB',
      'Growth Tier',
      new Date(Date.now() - 7200000).toISOString(),
      now
    );

    insertClient.run(
      'usr_client',
      'Alex Morgan',
      'Morgan Digital Media',
      'client@codexdynamics.com',
      'client123',
      '+1 (555) 234-5678',
      '777 Broadway, 12th Floor, New York, NY 10003',
      'United States',
      'US',
      'Dedicated Agency',
      new Date(Date.now() - 1800000).toISOString(),
      now
    );
  }

  const leadCount = db.prepare('SELECT COUNT(*) as cnt FROM leads').get() as { cnt: number };
  if (leadCount.cnt === 0) {
    const insertLead = db.prepare(`
      INSERT INTO leads (id, first_name, last_name, name, email, phone, country, country_code, stage, status, funnel, company, service, budget, timeline, message, source, notes, client_password, assigned_office_id, assigned_team_id, assigned_agent_id, is_online, comment_history, status_history, appointments, activity_record, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertLead.run(
      'client_vance',
      'Eleanor',
      'Vance',
      'Eleanor Vance',
      'eleanor.vance@vancetech.io',
      '+1 (415) 890-2341',
      'United States',
      'US',
      'New',
      'New',
      'High-Performance Website',
      'Vance Tech Capital',
      'High-Performance Website',
      '$15,000 - $25,000',
      'Within 1 Month',
      'We need a complete rebuild of our venture fund corporate portal with real-time portfolio performance dashboards and interactive investor LP access.',
      'website_contact_modal',
      'High priority lead.',
      'client123',
      'of_london',
      'tm_alpha',
      'adm_ag',
      1,
      JSON.stringify([{ id: 'c1', by_name: 'Website Intake', text: 'Intake submitted via corporate booking modal.', created_at: now }]),
      JSON.stringify([{ id: 's1', from_stage: 'New', to_stage: 'New', by_name: 'System', created_at: now }]),
      JSON.stringify([]),
      JSON.stringify({ pageViews: 28, sessions: 7, lastLogin: new Date(Date.now() - 3600000).toISOString() }),
      now,
      now
    );

    insertLead.run(
      'client_brody',
      'Marcus',
      'Brody',
      'Marcus Brody',
      'marcus@brodydesign.co',
      '+44 20 7946 0912',
      'United Kingdom',
      'GB',
      'In Line',
      'In Line',
      'Web Design & UI/UX',
      'Brody Luxury Goods',
      'Web Design & UI/UX',
      '$10,000 - $18,000',
      'Immediate',
      'Looking for a bespoke e-commerce experience with 3D product previews and ultra-fast mobile checkout.',
      'website_contact_form',
      'Waiting for brand pack.',
      'client123',
      'of_london',
      'tm_alpha',
      'adm_ag',
      0,
      JSON.stringify([]),
      JSON.stringify([]),
      JSON.stringify([]),
      JSON.stringify({ pageViews: 14, sessions: 4, lastLogin: new Date(Date.now() - 7200000).toISOString() }),
      now,
      now
    );

    insertLead.run(
      'ld_1001',
      'James',
      'Morrison',
      'James Morrison',
      'james.morrison@enterprise.co.uk',
      '+44 20 7946 0912',
      'United Kingdom',
      'GB',
      'In Line',
      'In Line',
      'Web Development',
      'Enterprise UK',
      'Web Development',
      '$20,000+',
      '1-2 Months',
      'Requirements discovery for global corporate web platform.',
      'direct',
      'Discovery call completed.',
      'client123',
      'of_london',
      'tm_alpha',
      'adm_ag',
      0,
      JSON.stringify([]),
      JSON.stringify([]),
      JSON.stringify([]),
      JSON.stringify({ pageViews: 19, sessions: 5, lastLogin: new Date(Date.now() - 14400000).toISOString() }),
      now,
      now
    );
  }

  const projCount = db.prepare('SELECT COUNT(*) as cnt FROM projects').get() as { cnt: number };
  if (projCount.cnt === 0) {
    const insertProj = db.prepare(`
      INSERT INTO projects (title, site_name, site_url, description, category, image_url, is_published, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertProj.run(
      'Vance Tech Capital Portal',
      'Vance Capital',
      'https://vancetech.io',
      'Next-generation venture capital portfolio management and investor dashboard.',
      'Websites & Web Apps',
      '/hero/web-apps.jpg',
      1,
      now
    );

    insertProj.run(
      'Brody Luxury Storefront',
      'Brody Goods',
      'https://brodydesign.co',
      'Bespoke high-conversion storefront with 3D product previews and instant checkout.',
      'Websites & Web Apps',
      '/hero/design.jpg',
      1,
      now
    );

    insertProj.run(
      'Apex Telephony & CRM Gateway',
      'Apex VoIP',
      'https://apextelecom.net',
      'Omnichannel calling system, VoIP routing, and automated sales pipeline engine.',
      'CRMs & Calling Systems',
      '/services/crm-calling.jpg',
      1,
      now
    );

    insertProj.run(
      'Kroma Digital Studio',
      'Kroma Brand',
      'https://kromastudio.art',
      'Identity guidelines, custom 3D design system, and multi-channel brand assets.',
      'Graphic Design & Branding',
      '/services/graphic-design.jpg',
      1,
      now
    );
  }

  const blogCount = db.prepare('SELECT COUNT(*) as cnt FROM blogs').get() as { cnt: number };
  if (blogCount.cnt === 0) {
    const insertBlog = db.prepare(`
      INSERT INTO blogs (title, slug, content, excerpt, category, author, status, featured_image, meta_description, reading_time, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertBlog.run(
      'Engineering High-Throughput Web Applications on Edge Networks',
      'engineering-high-throughput-web-apps-edge',
      '<p>Modern enterprise platforms require sub-100ms global latency and zero-downtime rollouts. In this guide, we dive into how Codex Dynamics engineers edge architectures...</p>',
      'How modern edge networks, reactive client state, and distributed caching unlock instantaneous web experiences.',
      'Engineering',
      'Codex Architecture Team',
      'published',
      '/hero/web-dev.jpg',
      'Architecture blueprints for enterprise high-throughput web applications.',
      4,
      now,
      now
    );

    insertBlog.run(
      'The Blueprint for High-Converting Digital Storefronts',
      'blueprint-high-converting-storefronts',
      '<p>Conversion rate optimization starts with layout clarity, tactile typography, and frictionless checkout flows...</p>',
      'Strategic design patterns and technical optimizations that drive 3x conversion improvements for commerce brands.',
      'Design & UX',
      'Codex Creative Studio',
      'published',
      '/hero/design.jpg',
      'Design patterns and optimizations for high-converting ecommerce storefronts.',
      5,
      now,
      now
    );
  }

  const revCount = db.prepare('SELECT COUNT(*) as cnt FROM reviews').get() as { cnt: number };
  if (revCount.cnt === 0) {
    const insertRev = db.prepare(`
      INSERT INTO reviews (author, rating, comment, is_published, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    insertRev.run(
      'Eleanor Vance (Vance Tech Capital)',
      5,
      'Codex Dynamics completely transformed our corporate presence. The client portal and real-time reporting have been a game changer for our LP relationships.',
      1,
      now
    );

    insertRev.run(
      'Marcus Brody (Brody Luxury Goods)',
      5,
      'Incredible execution speed and attention to detail. Our mobile conversion went up 42% in the first two weeks post-launch.',
      1,
      now
    );
  }

  const notifCount = db.prepare('SELECT COUNT(*) as cnt FROM notifications').get() as { cnt: number };
  if (notifCount.cnt === 0) {
    const insertNotif = db.prepare(`
      INSERT INTO notifications (id, user_id, title, description, kind, type, is_read, link, sent_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertNotif.run(
      'notif_init_1',
      'client_vance',
      'Project Milestone Reached',
      'Frontend architectural review completed successfully for Vance Capital.',
      'project',
      'project',
      0,
      '/portal/projects',
      'Sarah Admin',
      new Date(Date.now() - 3600000 * 2).toISOString()
    );

    insertNotif.run(
      'notif_init_2',
      null,
      'Platform Security Update',
      'Scheduled infrastructure maintenance completed with zero downtime.',
      'system',
      'domain',
      1,
      '/portal/notifications',
      'System',
      new Date(Date.now() - 86400000).toISOString()
    );
  }

  const msgCount = db.prepare('SELECT COUNT(*) as cnt FROM messages').get() as { cnt: number };
  if (msgCount.cnt === 0) {
    const insertMsg = db.prepare(`
      INSERT INTO messages (id, user_id, sender, sender_name, body, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    insertMsg.run(
      'msg_init_1',
      'client_vance',
      'client',
      'Eleanor Vance',
      'Hello team, could you please provide an update on the dashboard integration timeline?',
      1,
      new Date(Date.now() - 3600000 * 4).toISOString()
    );

    insertMsg.run(
      'msg_init_2',
      'client_vance',
      'agent',
      'Alex Agent',
      'Hi Eleanor! The dashboard APIs are wired and our team is running final end-to-end load tests today.',
      1,
      new Date(Date.now() - 3600000 * 2).toISOString()
    );
  }

  const audCount = db.prepare('SELECT COUNT(*) as cnt FROM audit_logs').get() as { cnt: number };
  if (audCount.cnt === 0) {
    const insertAud = db.prepare(`
      INSERT INTO audit_logs (id, user_id, client_name, action, details, ip_address, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    insertAud.run(
      'aud_1',
      'client_vance',
      'Eleanor Vance',
      'CLIENT_LOGIN',
      'Logged into Client Portal dashboard from Chrome on macOS',
      '192.168.1.104',
      new Date(Date.now() - 3600000).toISOString()
    );

    insertAud.run(
      'aud_2',
      'client_vance',
      'Eleanor Vance',
      'PAGE_VIEW',
      'Viewed Portfolio Projects and Milestone Deliverables',
      '192.168.1.104',
      new Date(Date.now() - 3500000).toISOString()
    );
  }

  // Seed Staff Users
  const staffCount = db.prepare('SELECT COUNT(*) as cnt FROM staff_users').get() as { cnt: number };
  if (staffCount.cnt === 0) {
    const insertStaff = db.prepare(`
      INSERT INTO staff_users (id, email, password, name, role, office_id, team_id, status, capabilities, last_login_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?, ?)
    `);

    const superAdminCaps = JSON.stringify({
      lead_upload: true, create_agent: true, registrations: true, notifications: true,
      security: true, content: true, enquiries: true, chat: true, settings: true
    });
    insertStaff.run('adm_sa', 'superadmin@codexdynamics.com', 'admin123', 'Sarah Admin', 'Super Admin', null, null, superAdminCaps, now, now);
    insertStaff.run('adm_om', 'manager@codexdynamics.com', 'admin123', 'Olivia Manager', 'Office Manager', 'of_london', null, superAdminCaps, now, now);
    insertStaff.run('adm_tl', 'leader@codexdynamics.com', 'admin123', 'Thomas Leader', 'Team Leader', 'of_london', 'tm_alpha', superAdminCaps, now, now);
    insertStaff.run('adm_ag', 'agent@codexdynamics.com', 'admin123', 'Alex Agent', 'Agent', 'of_london', 'tm_alpha', superAdminCaps, now, now);
  }

  // Seed Client Websites
  const webCount = db.prepare('SELECT COUNT(*) as cnt FROM client_websites').get() as { cnt: number };
  if (webCount.cnt === 0) {
    const insertWeb = db.prepare(`
      INSERT INTO client_websites (id, client_id, name, domain, website_url, back_office_url, status, connection_status, connector_id, connector_secret, access_enabled, tech_stack, hosting_plan, ssl_status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertWeb.run(
      'web_vance_01', 'client_vance', 'Vance Tech Capital Public Site', 'vancetech.io',
      'https://vancetech.io', 'https://vancetech.io/admin', 'Active', 'Connected',
      'cdx-connector-v1', 'sec_vance_89f72b', 1,
      JSON.stringify(['Next.js 15', 'Tailwind CSS', 'Vercel Edge', 'Cloudflare']),
      'Enterprise Dedicated Edge Node', 'Active & Auto-Renewing', now, now
    );

    insertWeb.run(
      'web_vance_02', 'client_vance', 'Vance Capital LP Portal', 'lp.vancetech.io',
      'https://lp.vancetech.io', 'https://lp.vancetech.io/admin', 'Active', 'Connected',
      'cdx-connector-v1', 'sec_vance_lp_33c91', 1,
      JSON.stringify(['React 19', 'PostgreSQL', 'Auth0 SSO', 'Docker']),
      'High-Security Dedicated Node', 'Active & Auto-Renewing', now, now
    );

    insertWeb.run(
      'web_brody_01', 'client_brody', 'Brody Luxury Storefront', 'brodyluxury.com',
      'https://brodyluxury.com', 'https://brodyluxury.com/admin', 'Active', 'Connected',
      'cdx-connector-v1', 'sec_brody_44d189', 1,
      JSON.stringify(['Shopify Headless', 'Next.js 14', 'Three.js 3D', 'Stripe']),
      'High-Concurrency E-Commerce Node', 'Active & Auto-Renewing', now, now
    );

    insertWeb.run(
      'web_morgan_01', 'usr_demo', 'Morgan Media Global', 'morganmedia.com',
      'https://morganmedia.com', 'https://morganmedia.com/admin', 'Active', 'Connected',
      'cdx-connector-v1', 'sec_morgan_77b4', 1,
      JSON.stringify(['React', 'Node.js Express', 'PostgreSQL']),
      'Cloud Pro Node', 'Active & Auto-Renewing', now, now
    );
  }

  // Seed Client Projects
  const projectCount = db.prepare('SELECT COUNT(*) as cnt FROM client_projects').get() as { cnt: number };
  if (projectCount.cnt === 0) {
    const insertProject = db.prepare(`
      INSERT INTO client_projects (id, client_id, name, description, service, status, progress, start_date, target_date, team_lead, milestones, recent_updates, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertProject.run(
      'proj_vance_01', 'client_vance', 'Venture Capital Portal Rebuild',
      'Next-generation LP investor portal with real-time portfolio IRR performance, capital call automation, and document vault.',
      'High-Performance Web App', 'In Progress', 75, '2026-08-01', '2026-10-30', 'Marcus Vance (Technical Lead)',
      JSON.stringify([
        { id: 'm1', title: 'Architecture Specification & Security Sign-off', status: 'completed', dueDate: '2026-08-15', notes: 'Completed ahead of schedule' },
        { id: 'm2', title: 'Interactive Portfolio Analytics Dashboard', status: 'completed', dueDate: '2026-09-10', notes: 'Sign-off received from investment committee' },
        { id: 'm3', title: 'LP Document Vault & Single Sign-On', status: 'in_progress', dueDate: '2026-10-15', notes: 'SSO connector staging verification active' },
        { id: 'm4', title: 'Production Security Audit & Launch', status: 'pending', dueDate: '2026-10-30' },
      ]),
      JSON.stringify([
        { id: 'u1', date: '2026-10-01', title: 'SSO Connector Staging Ready', author: 'Codex Engineering', message: 'The standard Codex Dynamics connector has been deployed to staging for testing.' },
        { id: 'u2', date: '2026-09-22', title: 'Portfolio Chart Engine Optimized', author: 'Codex Frontend', message: 'Render speed improved by 60% with WebGL-backed time-series charts.' },
      ]),
      now, now
    );

    insertProject.run(
      'proj_brody_01', 'client_brody', 'Luxury E-Commerce 3D Storefront',
      'High-conversion bespoke storefront with 3D product previews, multi-currency Apple Pay checkout, and CRM integration.',
      'Web Design & E-Commerce', 'Review', 90, '2026-08-15', '2026-10-18', 'Sarah Lin (Creative Director)',
      JSON.stringify([
        { id: 'mb1', title: 'Art Direction & 3D Lighting Setup', status: 'completed', dueDate: '2026-08-30' },
        { id: 'mb2', title: 'Mobile Checkout Flow & Apple Pay', status: 'completed', dueDate: '2026-09-18' },
        { id: 'mb3', title: 'Final Client Acceptance Review', status: 'in_progress', dueDate: '2026-10-10' },
        { id: 'mb4', title: 'Global CDN Deployment & Cutover', status: 'pending', dueDate: '2026-10-18' },
      ]),
      JSON.stringify([
        { id: 'ub1', date: '2026-09-29', title: '3D Configurator Review Build', author: 'Codex Design', message: 'Bespoke watch model rendering completed at 60fps on mobile.' },
      ]),
      now, now
    );
  }

  // Seed Client Invoices
  const invCount = db.prepare('SELECT COUNT(*) as cnt FROM client_invoices').get() as { cnt: number };
  if (invCount.cnt === 0) {
    const insertInv = db.prepare(`
      INSERT INTO client_invoices (id, client_id, invoice_number, issue_date, due_date, paid_date, status, currency, subtotal, tax, total, amount_paid, balance_due, payment_method, line_items, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertInv.run(
      'INV-2026-001', 'client_vance', 'INV-2026-001', '2026-08-01', '2026-08-15', '2026-08-10', 'Paid', 'USD',
      18500, 0, 18500, 18500, 0, 'Bank Wire Transfer',
      JSON.stringify([
        { id: 'li1', description: 'Venture Capital Portal Phase 1: Architecture & UI System', quantity: 1, unitPrice: 12500, total: 12500 },
        { id: 'li2', description: 'High-Security Cloud Node Provisioning & Dedicated Hardware', quantity: 1, unitPrice: 6000, total: 6000 },
      ]),
      'Payment received in full. Thank you for your partnership.', now
    );

    insertInv.run(
      'INV-2026-004', 'client_vance', 'INV-2026-004', '2026-09-25', '2026-10-09', null, 'Pending', 'USD',
      6500, 0, 6500, 0, 6500, null,
      JSON.stringify([
        { id: 'li3', description: 'Venture Capital Portal Phase 2: LP Vault & SSO Integration', quantity: 1, unitPrice: 6500, total: 6500 },
      ]),
      'Due via wire transfer to Barclays UK Codex Dynamics account.', now
    );

    insertInv.run(
      'INV-2026-002', 'client_brody', 'INV-2026-002', '2026-08-15', '2026-08-30', '2026-08-25', 'Paid', 'USD',
      12000, 0, 12000, 12000, 0, 'Stripe Credit Card',
      JSON.stringify([
        { id: 'lib1', description: 'Luxury 3D Storefront Phase 1: 3D Engine & Product Configurator', quantity: 1, unitPrice: 12000, total: 12000 },
      ]),
      'Paid via Stripe.', now
    );

    insertInv.run(
      'INV-2026-005', 'client_brody', 'INV-2026-005', '2026-09-20', '2026-10-04', '2026-09-28', 'Paid', 'USD',
      3200, 0, 3200, 3200, 0, 'Stripe Credit Card',
      JSON.stringify([
        { id: 'lib2', description: 'Mobile Checkout Integration & Apple Pay Certification', quantity: 1, unitPrice: 3200, total: 3200 },
      ]),
      'Payment confirmed.', now
    );

    insertInv.run(
      'INV-2026-003', 'usr_demo', 'INV-2026-003', '2026-09-01', '2026-09-15', '2026-09-12', 'Paid', 'USD',
      4500, 0, 4500, 4500, 0, 'Direct Debit',
      JSON.stringify([
        { id: 'lid1', description: 'Web Platform Architecture & Retainer', quantity: 1, unitPrice: 4500, total: 4500 },
      ]),
      'Retainer completed.', now
    );
  }

  // Seed Client Payments
  const payCount = db.prepare('SELECT COUNT(*) as cnt FROM client_payments').get() as { cnt: number };
  if (payCount.cnt === 0) {
    const insertPay = db.prepare(`
      INSERT INTO client_payments (id, client_id, invoice_id, receipt_number, payment_date, amount, payment_method, transaction_reference, description, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Completed', ?)
    `);

    insertPay.run('REC-2026-001', 'client_vance', 'INV-2026-001', 'REC-2026-001', '2026-08-10', 18500, 'Bank Wire Transfer', 'TXN-998234-WIRE', 'Payment for Invoice INV-2026-001 (Phase 1)', now);
    insertPay.run('REC-2026-002', 'client_brody', 'INV-2026-002', 'REC-2026-002', '2026-08-25', 12000, 'Stripe Credit Card', 'ch_3N8792019482', 'Payment for Invoice INV-2026-002', now);
    insertPay.run('REC-2026-005', 'client_brody', 'INV-2026-005', 'REC-2026-005', '2026-09-28', 3200, 'Stripe Credit Card', 'ch_3P1928472910', 'Payment for Invoice INV-2026-005', now);
  }

  // Seed Client Hosting
  const hostCount = db.prepare('SELECT COUNT(*) as cnt FROM client_hosting').get() as { cnt: number };
  if (hostCount.cnt === 0) {
    const insertHost = db.prepare(`
      INSERT INTO client_hosting (id, client_id, website_id, website_name, provider, plan, status, start_date, renewal_date, billing_frequency, amount, auto_renew, server_region, ip_address, uptime)
      VALUES (?, ?, ?, ?, ?, ?, 'Active', ?, ?, 'Monthly', ?, 1, ?, ?, '99.99%')
    `);

    insertHost.run('host_vance_01', 'client_vance', 'web_vance_01', 'Vance Tech Capital Public Site', 'Cloudflare Enterprise & AWS eu-west-2', 'High-Performance Enterprise Node', '2026-07-10', '2026-11-15', 180, 'London, UK (eu-west-2)', '162.159.135.42');
    insertHost.run('host_vance_02', 'client_vance', 'web_vance_02', 'Vance Capital LP Portal', 'AWS Dedicated Virtual Private Cloud', 'Dedicated High-Security Isolated Node', '2026-08-15', '2026-11-15', 350, 'London, UK (eu-west-2)', '52.56.182.90');
    insertHost.run('host_brody_01', 'client_brody', 'web_brody_01', 'Brody Luxury Storefront', 'Fastly Edge & AWS eu-west-1', 'Global E-Commerce Scalable Node', '2026-08-01', '2026-11-01', 220, 'Dublin, Ireland (eu-west-1)', '151.101.65.140');
    insertHost.run('host_demo_01', 'usr_demo', 'web_morgan_01', 'Morgan Media Global', 'Vercel Enterprise Edge Network', 'Cloud Pro Node', '2026-06-20', '2026-10-20', 120, 'Frankfurt, Germany (eu-central-1)', '76.76.21.21');
  }

  // Seed Client Domains
  const domCount = db.prepare('SELECT COUNT(*) as cnt FROM client_domains').get() as { cnt: number };
  if (domCount.cnt === 0) {
    const insertDom = db.prepare(`
      INSERT INTO client_domains (id, client_id, domain_name, registrar, registration_date, expiration_date, renewal_status, auto_renew, dns_management, nameservers, records)
      VALUES (?, ?, ?, 'Codex Managed', ?, ?, ?, ?, 1, ?, ?)
    `);

    insertDom.run('dom_vance_01', 'client_vance', 'vancetech.io', '2025-07-10', '2027-07-10', 'Auto-Renew Active', 1,
      JSON.stringify(['ns1.codexdynamics.net', 'ns2.codexdynamics.net']),
      JSON.stringify([{ type: 'A', name: '@', value: '162.159.135.42', ttl: 'Auto' }, { type: 'CNAME', name: 'www', value: 'vancetech.io', ttl: 'Auto' }])
    );

    insertDom.run('dom_vance_02', 'client_vance', 'vancecapital.com', '2024-10-22', '2026-10-22', 'Expiring Soon (20 days)', 0,
      JSON.stringify(['ns1.codexdynamics.net', 'ns2.codexdynamics.net']),
      JSON.stringify([{ type: 'CNAME', name: '@', value: 'vancetech.io', ttl: 'Auto' }])
    );

    insertDom.run('dom_brody_01', 'client_brody', 'brodyluxury.com', '2025-08-01', '2027-08-01', 'Auto-Renew Active', 1,
      JSON.stringify(['ns1.codexdynamics.net', 'ns2.codexdynamics.net']),
      JSON.stringify([{ type: 'A', name: '@', value: '151.101.65.140', ttl: 'Auto' }])
    );
  }

  // Seed Client Support Tickets
  const ticketCount = db.prepare('SELECT COUNT(*) as cnt FROM client_support_tickets').get() as { cnt: number };
  if (ticketCount.cnt === 0) {
    const insertTicket = db.prepare(`
      INSERT INTO client_support_tickets (id, client_id, ticket_number, subject, category, priority, status, assigned_agent, messages, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertTicket.run(
      'tick_101', 'client_vance', 'TICK-101', 'LP Portal Fiscal Quarter Distribution Filter',
      'Website & Code', 'High', 'Open', 'Alex Agent',
      JSON.stringify([
        { id: 'tm1', sender: 'client', senderName: 'Eleanor Vance', text: 'Can we add a multi-year filter for portfolio distributions so LPs can export 2024 through 2026 together?', createdAt: new Date(Date.now() - 3600000 * 24).toISOString() },
        { id: 'tm2', sender: 'staff', senderName: 'Alex Agent', text: 'Hi Eleanor, absolutely! Our engineering team has prepared the database query patch and will roll it into today staging build.', createdAt: new Date(Date.now() - 3600000 * 18).toISOString() },
      ]),
      now, now
    );

    insertTicket.run(
      'tick_102', 'client_brody', 'TICK-102', '3D Configurator Apple Pay Staging Certification',
      'Billing & Payments', 'Medium', 'Resolved', 'Sarah Admin',
      JSON.stringify([
        { id: 'tmb1', sender: 'client', senderName: 'Marcus Brody', text: 'We need merchant verification domain association for Apple Pay on staging.', createdAt: new Date(Date.now() - 3600000 * 48).toISOString() },
        { id: 'tmb2', sender: 'staff', senderName: 'Sarah Admin', text: 'Domain association file uploaded to /.well-known/apple-developer-merchantid-domain-association and verified.', createdAt: new Date(Date.now() - 3600000 * 36).toISOString() },
      ]),
      now, now
    );
  }

  // Seed Client Files
  const fileCount = db.prepare('SELECT COUNT(*) as cnt FROM client_files').get() as { cnt: number };
  if (fileCount.cnt === 0) {
    const insertFile = db.prepare(`
      INSERT INTO client_files (id, client_id, name, category, size, uploaded_at, file_type, download_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertFile.run('file_vance_01', 'client_vance', 'Vance_Tech_BrandGuidelines_v2.pdf', 'Designs & Branding', '8.4 MB', '2026-08-10', 'pdf', '#download_brand_guidelines');
    insertFile.run('file_vance_02', 'client_vance', 'Vance_LP_Architecture_Diagram_Signed.pdf', 'Contracts & SOWs', '2.1 MB', '2026-08-15', 'pdf', '#download_architecture');
    insertFile.run('file_brody_01', 'client_brody', 'Brody_Luxury_Product_Catalog_Final.pdf', 'Designs & Branding', '14.2 MB', '2026-08-20', 'pdf', '#download_brody_catalog');
    insertFile.run('file_brody_02', 'client_brody', '3D_Assets_AssetPack_GLTF.zip', 'Deliverables', '68.9 MB', '2026-09-15', 'zip', '#download_3d_pack');
  }

  // Seed Offices & Teams
  const officeCount = db.prepare('SELECT COUNT(*) as cnt FROM offices').get() as { cnt: number };
  if (officeCount.cnt === 0) {
    const insertOffice = db.prepare(`
      INSERT INTO offices (id, name, manager_id, manager_name, manager_email, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertOffice.run('of_london', 'London Operations', 'adm_om', 'Olivia Manager', 'manager@codexdynamics.com', now);
    insertOffice.run('of_newyork', 'New York Hub', null, 'Unassigned', '', now);
  }

  const teamCount = db.prepare('SELECT COUNT(*) as cnt FROM teams').get() as { cnt: number };
  if (teamCount.cnt === 0) {
    const insertTeam = db.prepare(`
      INSERT INTO teams (id, name, office_id, leader_id, leader_name, max_size, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertTeam.run('tm_alpha', 'Alpha Strategy', 'of_london', 'adm_tl', 'Thomas Leader', 10, now);
    insertTeam.run('tm_beta', 'Beta Enterprise', 'of_newyork', null, 'Unassigned', 10, now);
  }
}
