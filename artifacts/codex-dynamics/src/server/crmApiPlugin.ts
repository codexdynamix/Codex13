import type { Plugin } from 'vite';
import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { getSqliteDb } from './sqliteDb';

export function crmApiPlugin(): Plugin {
  return {
    name: 'codex-crm-api-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';
        if (!url.startsWith('/api/')) {
          return next();
        }

        const parsedUrl = new URL(url, 'http://localhost:3000');
        const pathname = parsedUrl.pathname;
        const method = req.method || 'GET';

        // Parse JSON Body
        let body: any = {};
        if (method === 'POST' || method === 'PATCH' || method === 'PUT' || method === 'DELETE') {
          try {
            const buffers: Buffer[] = [];
            for await (const chunk of req) {
              buffers.push(chunk);
            }
            const data = Buffer.concat(buffers).toString();
            if (data.trim()) {
              body = JSON.parse(data);
            }
          } catch (_) {
            body = {};
          }
        }

        const sendJson = (data: any, status = 200, engine = 'Embedded-SQLite') => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
          res.setHeader('X-Backend-Engine', engine);
          res.end(JSON.stringify(data));
        };

        if (method === 'OPTIONS') {
          return sendJson({ ok: true });
        }

        // -------------------------------------------------------------
        // /api/download-hostinger-zip: Generate Hostinger Package
        // -------------------------------------------------------------
        if (pathname === '/api/download-hostinger-zip') {
          try {
            const ZipClass = (JSZip as any).default || JSZip;
            const zip = new ZipClass();
            const serverDir = import.meta.dirname || __dirname;
            const appDir = path.resolve(serverDir, '../..');
            const distDir = path.resolve(appDir, 'dist');
            const publicDir = path.resolve(appDir, 'public');

            // Add README
            const readmePath = path.resolve(publicDir, 'README-HOSTINGER.txt');
            if (fs.existsSync(readmePath)) {
              zip.file('README-HOSTINGER.txt', fs.readFileSync(readmePath, 'utf-8'));
            }

            // Add .htaccess
            const htaccessPath = path.resolve(publicDir, '.htaccess');
            if (fs.existsSync(htaccessPath)) {
              zip.file('.htaccess', fs.readFileSync(htaccessPath, 'utf-8'));
            }

            // Add API files
            const apiDir = path.resolve(publicDir, 'api');
            if (fs.existsSync(apiDir)) {
              const addDirToZip = (dir: string, zipFolder: JSZip) => {
                const files = fs.readdirSync(dir);
                for (const file of files) {
                  const full = path.join(dir, file);
                  if (fs.statSync(full).isDirectory()) {
                    addDirToZip(full, zipFolder.folder(file)!);
                  } else {
                    zipFolder.file(file, fs.readFileSync(full));
                  }
                }
              };
              addDirToZip(apiDir, zip.folder('api')!);
            }

            // Add dist files if built
            if (fs.existsSync(distDir)) {
              const addDistToZip = (dir: string, zipFolder: JSZip) => {
                const files = fs.readdirSync(dir);
                for (const file of files) {
                  if (file === 'api' || file === '.htaccess' || file === 'README-HOSTINGER.txt') continue;
                  const full = path.join(dir, file);
                  if (fs.statSync(full).isDirectory()) {
                    addDistToZip(full, zipFolder.folder(file)!);
                  } else {
                    zipFolder.file(file, fs.readFileSync(full));
                  }
                }
              };
              addDistToZip(distDir, zip);
            }

            const content = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', 'attachment; filename="hostinger-public_html.zip"');
            res.end(content);
            return;
          } catch (err: any) {
            return sendJson({ error: 'Failed to generate zip: ' + err.message }, 500);
          }
        }

        // -------------------------------------------------------------
        // Resilient Embedded SQL Engine
        // -------------------------------------------------------------
        const db = getSqliteDb();

        if (pathname === '/api/public/content' || pathname === '/api/content') {
          const projects = db.prepare('SELECT * FROM projects WHERE is_published = 1 ORDER BY id DESC').all();
          const blogs = db.prepare("SELECT * FROM blogs WHERE status = 'published' ORDER BY id DESC").all();
          const reviews = db.prepare('SELECT * FROM reviews WHERE is_published = 1 ORDER BY id DESC').all();

          return sendJson({ ok: true, projects, blogs, reviews });
        }

        if (pathname === '/api/crm/leads' || pathname === '/api/admin/leads') {
          if (method === 'POST') {
            const id = 'ld_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
            const now = new Date().toISOString();
            const first = (body.firstName || body.first_name || 'New').trim();
            const last = (body.lastName || body.last_name || 'Lead').trim();
            const name = (body.name || `${first} ${last}`).trim();
            const email = (body.email || '').trim().toLowerCase();
            const phone = body.phone || '';
            const country = body.country || 'United Kingdom';
            const countryCode = body.countryCode || 'GB';
            const funnel = body.service || body.funnel || 'General';
            const company = body.company || '';
            const service = body.service || 'General Inquiry';
            const budget = body.budget || '';
            const timeline = body.timeline || '';
            const message = body.message || '';
            const source = body.source || 'website_contact_modal';
            const officeId = body.assigned_office_id || body.assignedToOffice || 'of_london';
            const teamId = body.assigned_team_id || body.assignedToTeam || 'tm_alpha';
            const agentId = body.assigned_agent_id || body.assignedToAgent || 'adm_ag';
            const clientPassword = (body.password || body.client_password || body.clientPassword || ('client' + Math.floor(100 + Math.random() * 900))).toString().trim();

            const registeredDate = (body.registered_date || body.registeredDate || new Date().toLocaleDateString()).trim();
            const commentHistory = message
              ? JSON.stringify([{ id: 'c_' + Date.now(), by_name: 'Website Intake', text: message, created_at: now }])
              : JSON.stringify([]);
            const statusHistory = JSON.stringify([{ id: 's_' + Date.now(), from_stage: 'New', to_stage: 'New', by_name: 'System', created_at: now }]);
            const activityRecord = JSON.stringify({ pageViews: 1, sessions: 1, lastLogin: now });

            db.prepare(`
              INSERT INTO leads (
                id, first_name, last_name, name, email, phone, country, country_code,
                stage, status, funnel, company, service, budget, timeline, message,
                source, client_password, assigned_office_id, assigned_team_id, assigned_agent_id,
                comment_history, status_history, appointments, activity_record, registered_date, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'New', 'New', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?, ?, ?)
            `).run(
              id, first, last, name, email, phone, country, countryCode,
              funnel, company, service, budget, timeline, message,
              source, clientPassword, officeId, teamId, agentId,
              commentHistory, statusHistory, activityRecord, registeredDate, now, now
            );

            db.prepare(`
              INSERT INTO portal_clients (id, name, company, email, password, phone, address, country, country_code, status, portal_enabled, tier, last_login_at, created_at)
              VALUES (?, ?, ?, ?, ?, ?, '', ?, ?, 'Active', 1, 'New Client', ?, ?)
            `).run(id, name, company || name, email, clientPassword, phone, country, countryCode, now, now);

            const newClient = {
              id,
              name,
              company: company || name,
              email,
              phone,
              address: '',
              country,
              countryCode,
              status: 'Active',
              portalEnabled: true,
              tier: 'New Client',
              lastLoginAt: now,
              createdAt: now,
            };

            const createdLead = db.prepare('SELECT * FROM leads WHERE id = ?').get(id);

            return sendJson({
              ok: true,
              id,
              lead: createdLead,
              client: newClient,
              token: `cdx_sess_${id}_${Date.now()}`,
              message: 'Client account created successfully'
            });
          }

          const rawLeads = db.prepare('SELECT * FROM leads ORDER BY created_at DESC').all();
          const leads = rawLeads.map((r: any) => ({
            ...r,
            registered_date: r.registered_date || (r.created_at ? new Date(r.created_at).toLocaleDateString() : new Date().toLocaleDateString()),
            registeredDate: r.registered_date || (r.created_at ? new Date(r.created_at).toLocaleDateString() : new Date().toLocaleDateString()),
            comment_history: r.comment_history ? (typeof r.comment_history === 'string' ? JSON.parse(r.comment_history) : r.comment_history) : [],
            status_history: r.status_history ? (typeof r.status_history === 'string' ? JSON.parse(r.status_history) : r.status_history) : [],
            appointments: r.appointments ? (typeof r.appointments === 'string' ? JSON.parse(r.appointments) : r.appointments) : [],
            activity_record: r.activity_record ? (typeof r.activity_record === 'string' ? JSON.parse(r.activity_record) : r.activity_record) : { pageViews: 1, sessions: 1, lastLogin: r.created_at },
          }));

          return sendJson({ ok: true, leads, total: leads.length, limit: 10000, offset: 0, has_more: false });
        }

        if (pathname === '/api/admin/leads/search') {
          const q = (parsedUrl.searchParams.get('q') || '').trim().toLowerCase();
          const limit = Math.min(100, Math.max(1, Number(parsedUrl.searchParams.get('limit')) || 8));
          const term = `%${q}%`;
          const rawLeads = db.prepare(`
            SELECT * FROM leads
            WHERE LOWER(name) LIKE ? OR LOWER(email) LIKE ? OR LOWER(company) LIKE ? OR phone LIKE ? OR id LIKE ?
            ORDER BY created_at DESC
            LIMIT ?
          `).all(term, term, term, term, term, limit);
          return sendJson({ ok: true, leads: rawLeads });
        }

        if (pathname.startsWith('/api/admin/leads/') && !pathname.endsWith('/assign') && !pathname.endsWith('/set-password')) {
          const leadId = pathname.split('/')[4];
          if (method === 'PATCH') {
            const updates = body || {};
            const fields: string[] = [];
            const vals: any[] = [];
            if (updates.stage !== undefined) { fields.push('stage = ?'); vals.push(updates.stage); }
            if (updates.status !== undefined) { fields.push('status = ?'); vals.push(updates.status); }
            if (updates.notes !== undefined) { fields.push('notes = ?'); vals.push(updates.notes); }
            if (updates.funnel !== undefined) { fields.push('funnel = ?'); vals.push(updates.funnel); }
            if (updates.company !== undefined) { fields.push('company = ?'); vals.push(updates.company); }
            if (updates.phone !== undefined) { fields.push('phone = ?'); vals.push(updates.phone); }
            if (updates.email !== undefined) { fields.push('email = ?'); vals.push(updates.email); }
            if (updates.firstName !== undefined || updates.first_name !== undefined) { fields.push('first_name = ?'); vals.push(updates.firstName || updates.first_name); }
            if (updates.lastName !== undefined || updates.last_name !== undefined) { fields.push('last_name = ?'); vals.push(updates.lastName || updates.last_name); }
            if (updates.name !== undefined) { fields.push('name = ?'); vals.push(updates.name); }
            if (updates.assigned_office_id !== undefined) { fields.push('assigned_office_id = ?'); vals.push(updates.assigned_office_id); }
            if (updates.assigned_team_id !== undefined) { fields.push('assigned_team_id = ?'); vals.push(updates.assigned_team_id); }
            if (updates.assigned_agent_id !== undefined) { fields.push('assigned_agent_id = ?'); vals.push(updates.assigned_agent_id); }
            if (updates.comment_history !== undefined) { fields.push('comment_history = ?'); vals.push(typeof updates.comment_history === 'string' ? updates.comment_history : JSON.stringify(updates.comment_history)); }
            if (updates.status_history !== undefined) { fields.push('status_history = ?'); vals.push(typeof updates.status_history === 'string' ? updates.status_history : JSON.stringify(updates.status_history)); }
            if (updates.registered_date !== undefined || updates.registeredDate !== undefined) {
              fields.push('registered_date = ?');
              vals.push(updates.registered_date || updates.registeredDate);
            }
            fields.push('updated_at = ?'); vals.push(new Date().toISOString());

            if (fields.length > 1) {
              vals.push(leadId);
              db.prepare(`UPDATE leads SET ${fields.join(', ')} WHERE id = ?`).run(...vals);
            }
            const updated = db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId);
            return sendJson({ ok: true, lead: updated });
          }
          if (method === 'DELETE') {
            db.prepare('DELETE FROM leads WHERE id = ?').run(leadId);
            return sendJson({ ok: true });
          }
          const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId);
          return sendJson({ ok: true, lead });
        }

        if (pathname === '/api/crm/action') {
          const action = body.action || '';

          if (action === 'toggle_project') {
            const id = Number(body.id);
            const isPub = body.is_published ? 1 : 0;
            db.prepare('UPDATE projects SET is_published = ? WHERE id = ?').run(isPub, id);
            return sendJson({ ok: true, id, is_published: Boolean(isPub) });
          }

          if (action === 'save_project') {
            const title = body.title || 'New Project';
            const siteName = body.site_name || '';
            const siteUrl = body.site_url || '';
            const desc = body.description || '';
            const cat = body.category || 'Websites & Web Apps';
            const img = body.image_url || '/hero/web-apps.jpg';
            const isPub = body.is_published !== false ? 1 : 0;
            const now = new Date().toISOString();

            const res = db.prepare(`
              INSERT INTO projects (title, site_name, site_url, description, category, image_url, is_published, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(title, siteName, siteUrl, desc, cat, img, isPub, now);

            return sendJson({ ok: true, id: Number(res.lastInsertRowid) });
          }

          if (action === 'delete_project') {
            const id = Number(body.id);
            db.prepare('DELETE FROM projects WHERE id = ?').run(id);
            return sendJson({ ok: true });
          }

          if (action === 'save_blog' || action === 'update_blog') {
            const now = new Date().toISOString();
            const title = body.title || 'Untitled Article';
            const slug = body.slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            const content = body.content || '';
            const excerpt = body.excerpt || '';
            const category = body.category || 'Engineering';
            const author = body.author || 'Codex Architecture Team';
            const status = body.status || 'published';
            const img = body.featured_image || '/hero/web-dev.jpg';
            const meta = body.meta_description || excerpt;
            const readingTime = Math.max(1, Math.round((content || '').split(/\s+/).length / 200));

            if (body.id) {
              db.prepare(`
                UPDATE blogs
                SET title = ?, slug = ?, content = ?, excerpt = ?, category = ?, author = ?, status = ?, featured_image = ?, meta_description = ?, reading_time = ?, updated_at = ?
                WHERE id = ?
              `).run(title, slug, content, excerpt, category, author, status, img, meta, readingTime, now, Number(body.id));

              return sendJson({ ok: true, id: Number(body.id) });
            }

            const res = db.prepare(`
              INSERT INTO blogs (title, slug, content, excerpt, category, author, status, featured_image, meta_description, reading_time, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(title, slug, content, excerpt, category, author, status, img, meta, readingTime, now, now);

            return sendJson({ ok: true, id: Number(res.lastInsertRowid) });
          }

          if (action === 'delete_blog') {
            const id = Number(body.id);
            db.prepare('DELETE FROM blogs WHERE id = ?').run(id);
            return sendJson({ ok: true });
          }

          if (action === 'toggle_website_access') {
            const websiteId = body.website_id || body.websiteId;
            const enabled = body.access_enabled !== false && body.accessEnabled !== false ? 1 : 0;
            db.prepare('UPDATE client_websites SET access_enabled = ?, updated_at = ? WHERE id = ?').run(enabled, new Date().toISOString(), websiteId);
            return sendJson({ ok: true, website_id: websiteId, access_enabled: Boolean(enabled) });
          }

          if (action === 'update_client_password') {
            const clientId = body.client_id || body.clientId;
            const password = body.password || 'client123';
            db.prepare('UPDATE portal_clients SET password = ? WHERE id = ?').run(password, clientId);
            db.prepare('UPDATE leads SET client_password = ? WHERE id = ?').run(password, clientId);
            return sendJson({ ok: true, client_id: clientId });
          }

          return sendJson({ ok: true });
        }

        // -------------------------------------------------------------
        // /api/admin/login: Staff Authentication backed by SQLite
        // -------------------------------------------------------------
        if (pathname === '/api/admin/login' && method === 'POST') {
          const email = (body.email || '').trim().toLowerCase();
          const password = (body.password || '').trim();

          const staff = db.prepare('SELECT * FROM staff_users WHERE LOWER(email) = ?').get(email) as any;
          if (!staff || staff.password !== password) {
            return sendJson({ ok: false, error: 'Invalid staff email or password.' }, 401);
          }

          if (staff.status !== 'Active') {
            return sendJson({ ok: false, error: 'This staff account is currently suspended.' }, 403);
          }

          const now = new Date().toISOString();
          db.prepare('UPDATE staff_users SET last_login_at = ? WHERE id = ?').run(now, staff.id);

          const token = `token_${staff.id}_${Date.now()}`;
          const capabilities = staff.capabilities ? JSON.parse(staff.capabilities) : {
            lead_upload: true, create_agent: true, registrations: true, notifications: true,
            security: true, content: true, enquiries: true, chat: true, settings: true
          };

          return sendJson({
            ok: true,
            token,
            user: {
              id: staff.id,
              name: staff.name,
              email: staff.email,
              role: staff.role,
              office_id: staff.office_id,
              team_id: staff.team_id,
              officeId: staff.office_id,
              teamId: staff.team_id,
              status: staff.status,
              last_login_at: now,
              capabilities,
            },
          });
        }

        // -------------------------------------------------------------
        // /api/portal/login: Client Authentication backed by SQLite
        // -------------------------------------------------------------
        if (pathname === '/api/portal/login' && method === 'POST') {
          const email = (body.email || '').trim().toLowerCase();
          const password = (body.password || '').trim();

          const client = db.prepare('SELECT * FROM portal_clients WHERE LOWER(email) = ?').get(email) as any;
          if (!client) {
            return sendJson({ ok: false, error: 'No client account found with this email address.' }, 404);
          }

          if (!client.portal_enabled && client.portal_enabled !== 1) {
            return sendJson({ ok: false, error: 'This client portal account is currently disabled.' }, 403);
          }

          if (client.password && password && client.password !== password) {
            return sendJson({ ok: false, error: 'Incorrect password. Please try again.' }, 401);
          }

          const now = new Date().toISOString();
          db.prepare('UPDATE portal_clients SET last_login_at = ? WHERE id = ?').run(now, client.id);

          const token = `cdx_sess_${client.id}_${Date.now()}`;
          return sendJson({
            ok: true,
            token,
            client: {
              id: client.id,
              name: client.name,
              company: client.company,
              email: client.email,
              phone: client.phone,
              address: client.address,
              country: client.country,
              countryCode: client.country_code,
              status: client.status,
              portalEnabled: Boolean(client.portal_enabled),
              tier: client.tier,
              lastLoginAt: now,
              createdAt: client.created_at,
            },
          });
        }

        // -------------------------------------------------------------
        // /api/portal/data: Complete Client Portal Data from SQLite
        // -------------------------------------------------------------
        if (pathname === '/api/portal/data') {
          const clientId = parsedUrl.searchParams.get('client_id') || '';
          if (!clientId) {
            return sendJson({ error: 'Missing client_id parameter' }, 400);
          }

          const client = db.prepare('SELECT * FROM portal_clients WHERE id = ?').get(clientId) as any;
          const websites = db.prepare('SELECT * FROM client_websites WHERE client_id = ?').all(clientId).map((w: any) => ({
            ...w,
            clientId: w.client_id,
            websiteUrl: w.website_url,
            backOfficeUrl: w.back_office_url,
            connectionStatus: w.connection_status,
            connectorId: w.connector_id,
            connectorSecret: w.connector_secret,
            accessEnabled: Boolean(w.access_enabled),
            techStack: w.tech_stack ? (w.tech_stack.startsWith('[') ? JSON.parse(w.tech_stack) : w.tech_stack.split(',').map((s: string) => s.trim())) : [],
            hostingPlan: w.hosting_plan,
            sslStatus: w.ssl_status,
            createdAt: w.created_at,
            updatedAt: w.updated_at,
          }));

          const projects = db.prepare('SELECT * FROM client_projects WHERE client_id = ?').all(clientId).map((p: any) => ({
            ...p,
            clientId: p.client_id,
            startDate: p.start_date,
            targetDate: p.target_date,
            teamLead: p.team_lead,
            milestones: p.milestones ? JSON.parse(p.milestones) : [],
            recentUpdates: p.recent_updates ? JSON.parse(p.recent_updates) : [],
          }));

          const invoices = db.prepare('SELECT * FROM client_invoices WHERE client_id = ?').all(clientId).map((i: any) => ({
            ...i,
            clientId: i.client_id,
            invoiceNumber: i.invoice_number,
            issueDate: i.issue_date,
            dueDate: i.due_date,
            paidDate: i.paid_date,
            amountPaid: i.amount_paid,
            balanceDue: i.balance_due,
            paymentMethod: i.payment_method,
            lineItems: i.line_items ? JSON.parse(i.line_items) : [],
          }));

          const payments = db.prepare('SELECT * FROM client_payments WHERE client_id = ?').all(clientId).map((p: any) => ({
            ...p,
            clientId: p.client_id,
            invoiceId: p.invoice_id,
            receiptNumber: p.receipt_number,
            paymentDate: p.payment_date,
            paymentMethod: p.payment_method,
            transactionReference: p.transaction_reference,
          }));

          const hosting = db.prepare('SELECT * FROM client_hosting WHERE client_id = ?').all(clientId).map((h: any) => ({
            ...h,
            clientId: h.client_id,
            websiteId: h.website_id,
            websiteName: h.website_name,
            startDate: h.start_date,
            renewalDate: h.renewal_date,
            billingFrequency: h.billing_frequency,
            autoRenew: Boolean(h.auto_renew),
            serverRegion: h.server_region,
            ipAddress: h.ip_address,
          }));

          const domains = db.prepare('SELECT * FROM client_domains WHERE client_id = ?').all(clientId).map((d: any) => ({
            ...d,
            clientId: d.client_id,
            domainName: d.domain_name,
            registrationDate: d.registration_date,
            expirationDate: d.expiration_date,
            renewalStatus: d.renewal_status,
            autoRenew: Boolean(d.auto_renew),
            dnsManagement: Boolean(d.dns_management),
            nameservers: d.nameservers ? JSON.parse(d.nameservers) : [],
            records: d.records ? JSON.parse(d.records) : [],
          }));

          const tickets = db.prepare('SELECT * FROM client_support_tickets WHERE client_id = ? ORDER BY created_at DESC').all(clientId).map((t: any) => ({
            ...t,
            clientId: t.client_id,
            ticketNumber: t.ticket_number,
            assignedAgent: t.assigned_agent,
            messages: t.messages ? JSON.parse(t.messages) : [],
          }));

          const files = db.prepare('SELECT * FROM client_files WHERE client_id = ?').all(clientId).map((f: any) => ({
            ...f,
            clientId: f.client_id,
            uploadedAt: f.uploaded_at,
            fileType: f.file_type,
            downloadUrl: f.download_url,
          }));

          const notifications = db.prepare('SELECT * FROM notifications WHERE user_id = ? OR user_id IS NULL ORDER BY created_at DESC').all(clientId).map((n: any) => ({
            ...n,
            clientId: n.user_id,
            read: Boolean(n.is_read),
          }));

          return sendJson({
            ok: true,
            client: client ? {
              id: client.id,
              name: client.name,
              company: client.company,
              email: client.email,
              phone: client.phone,
              address: client.address,
              country: client.country,
              countryCode: client.country_code,
              status: client.status,
              portalEnabled: Boolean(client.portal_enabled),
              tier: client.tier,
              lastLoginAt: client.last_login_at,
              createdAt: client.created_at,
            } : null,
            websites,
            projects,
            invoices,
            payments,
            hosting,
            domains,
            tickets,
            files,
            notifications,
          });
        }

        // -------------------------------------------------------------
        // /api/portal/ticket: Create or Reply to Support Ticket in SQLite
        // -------------------------------------------------------------
        if (pathname === '/api/portal/ticket' && method === 'POST') {
          const clientId = body.clientId || body.client_id;
          const ticketId = body.ticketId || body.ticket_id;
          const text = (body.text || body.message || '').trim();
          const sender = body.sender || 'client';
          const senderName = body.senderName || body.sender_name || 'Client';
          const now = new Date().toISOString();

          if (ticketId) {
            // Reply to existing ticket
            const existing = db.prepare('SELECT * FROM client_support_tickets WHERE id = ?').get(ticketId) as any;
            if (existing) {
              const msgs = existing.messages ? JSON.parse(existing.messages) : [];
              msgs.push({ id: 'msg_' + Date.now(), sender, senderName, text, createdAt: now });
              const nextStatus = sender === 'client' ? 'Open' : existing.status;
              db.prepare('UPDATE client_support_tickets SET messages = ?, status = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(msgs), nextStatus, now, ticketId);
              return sendJson({ ok: true, ticket_id: ticketId, messages: msgs });
            }
          } else {
            // Create new ticket
            const newId = 'tick_' + Date.now();
            const ticketNumber = 'TICK-' + Math.floor(100 + Math.random() * 900);
            const subject = body.subject || 'Support Request';
            const category = body.category || 'General';
            const priority = body.priority || 'Medium';
            const initialMsgs = [{ id: 'msg_' + Date.now(), sender: 'client', senderName, text, createdAt: now }];

            db.prepare(`
              INSERT INTO client_support_tickets (id, client_id, ticket_number, subject, category, priority, status, assigned_agent, messages, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, 'Open', 'Alex Agent', ?, ?, ?)
            `).run(newId, clientId, ticketNumber, subject, category, priority, JSON.stringify(initialMsgs), now, now);

            return sendJson({ ok: true, ticket_id: newId, ticket_number: ticketNumber });
          }
        }

        // -------------------------------------------------------------
        // /api/portal/profile: Update Client Profile in SQLite
        // -------------------------------------------------------------
        if (pathname === '/api/portal/profile' && method === 'POST') {
          const clientId = body.clientId || body.client_id;
          const name = body.name || '';
          const company = body.company || '';
          const phone = body.phone || '';
          const address = body.address || '';
          const country = body.country || 'United Kingdom';
          const password = body.password || '';

          if (password) {
            db.prepare('UPDATE portal_clients SET name = ?, company = ?, phone = ?, address = ?, country = ?, password = ? WHERE id = ?')
              .run(name, company, phone, address, country, password, clientId);
            db.prepare('UPDATE leads SET name = ?, company = ?, phone = ?, country = ?, client_password = ? WHERE id = ?')
              .run(name, company, phone, country, password, clientId);
          } else {
            db.prepare('UPDATE portal_clients SET name = ?, company = ?, phone = ?, address = ?, country = ? WHERE id = ?')
              .run(name, company, phone, address, country, clientId);
            db.prepare('UPDATE leads SET name = ?, company = ?, phone = ?, country = ? WHERE id = ?')
              .run(name, company, phone, country, clientId);
          }

          return sendJson({ ok: true, client_id: clientId });
        }

        // -------------------------------------------------------------
        // /api/admin/offices: Management of regional offices
        // -------------------------------------------------------------
        if (pathname === '/api/admin/offices') {
          if (method === 'POST') {
            const id = 'of_' + Date.now();
            const name = body.name || 'New Office';
            const now = new Date().toISOString();
            let manager: any = null;
            let managerId = null;
            let managerName = body.manager_name || 'Unassigned';
            let managerEmail = body.manager_email || '';

            if (body.manager_name && body.manager_password) {
              managerId = 'adm_' + Date.now();
              managerEmail = managerEmail || `manager_${Date.now()}@codexdynamics.com`;
              const caps = JSON.stringify({
                lead_upload: true, create_agent: true, registrations: true, notifications: true, content: true, enquiries: true, chat: true
              });
              db.prepare(`
                INSERT INTO staff_users (id, email, password, name, role, office_id, team_id, status, capabilities, created_at)
                VALUES (?, ?, ?, ?, 'Office Manager', ?, null, 'Active', ?, ?)
              `).run(managerId, managerEmail, body.manager_password, managerName, id, caps, now);
              manager = { id: managerId, name: managerName, email: managerEmail, role: 'Office Manager', office_id: id };
            }

            db.prepare('INSERT INTO offices (id, name, manager_id, manager_name, manager_email, created_at) VALUES (?, ?, ?, ?, ?, ?)')
              .run(id, name, managerId, managerName, managerEmail, now);
            const createdOffice = { id, name, manager_id: managerId, manager_name: managerName, manager_email: managerEmail, team_count: 0, agent_count: 0, lead_count: 0, created_at: now };
            return sendJson({ ok: true, office: createdOffice, manager });
          }

          const offices = db.prepare('SELECT * FROM offices ORDER BY created_at DESC').all().map((o: any) => {
            const team_count = (db.prepare('SELECT COUNT(*) as c FROM teams WHERE office_id = ?').get(o.id) as any)?.c || 0;
            const agent_count = (db.prepare("SELECT COUNT(*) as c FROM staff_users WHERE office_id = ? AND role = 'Agent'").get(o.id) as any)?.c || 0;
            const lead_count = (db.prepare('SELECT COUNT(*) as c FROM leads WHERE assigned_office_id = ?').get(o.id) as any)?.c || 0;
            return { ...o, team_count, agent_count, lead_count };
          });
          return sendJson({ ok: true, offices });
        }

        if (pathname.startsWith('/api/admin/offices/')) {
          const parts = pathname.split('/');
          const officeId = parts[4];
          if (parts[5] === 'manager' && method === 'POST') {
            const managerId = body.manager_id;
            const manager = db.prepare('SELECT * FROM staff_users WHERE id = ?').get(managerId) as any;
            if (manager) {
              db.prepare('UPDATE offices SET manager_id = ?, manager_name = ?, manager_email = ? WHERE id = ?')
                .run(manager.id, manager.name, manager.email, officeId);
              db.prepare('UPDATE staff_users SET office_id = ? WHERE id = ?').run(officeId, manager.id);
            }
            const office = db.prepare('SELECT * FROM offices WHERE id = ?').get(officeId);
            return sendJson({ ok: true, office, manager });
          }
          if (method === 'PATCH') {
            if (body.name) {
              db.prepare('UPDATE offices SET name = ? WHERE id = ?').run(body.name, officeId);
            }
            const office = db.prepare('SELECT * FROM offices WHERE id = ?').get(officeId);
            return sendJson({ ok: true, office });
          }
          if (method === 'DELETE') {
            db.prepare('DELETE FROM offices WHERE id = ?').run(officeId);
            return sendJson({ ok: true });
          }
          const office = db.prepare('SELECT * FROM offices WHERE id = ?').get(officeId);
          return sendJson({ ok: true, office });
        }

        // -------------------------------------------------------------
        // /api/admin/teams: Management of strategic sales teams
        // -------------------------------------------------------------
        if (pathname === '/api/admin/teams') {
          if (method === 'POST') {
            const id = 'tm_' + Date.now();
            const name = body.name || 'New Team';
            const officeId = body.office_id || null;
            const maxSize = Number(body.max_size) || 10;
            const now = new Date().toISOString();
            let leader: any = null;
            let leaderId = null;
            let leaderName = body.leader_name || 'Unassigned';
            let leaderEmail = body.leader_email || '';

            if (body.leader_name && body.leader_password) {
              leaderId = 'adm_' + Date.now();
              leaderEmail = leaderEmail || `leader_${Date.now()}@codexdynamics.com`;
              const caps = JSON.stringify({
                lead_upload: true, create_agent: true, registrations: true, notifications: true, content: true, enquiries: true, chat: true
              });
              db.prepare(`
                INSERT INTO staff_users (id, email, password, name, role, office_id, team_id, status, capabilities, created_at)
                VALUES (?, ?, ?, ?, 'Team Leader', ?, ?, 'Active', ?, ?)
              `).run(leaderId, leaderEmail, body.leader_password, leaderName, officeId, id, caps, now);
              leader = { id: leaderId, name: leaderName, email: leaderEmail, role: 'Team Leader', office_id: officeId, team_id: id };
            }

            db.prepare('INSERT INTO teams (id, name, office_id, leader_id, leader_name, max_size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
              .run(id, name, officeId, leaderId, leaderName, maxSize, now);
            const createdTeam = { id, name, office_id: officeId, leader_id: leaderId, leader_name: leaderName, max_size: maxSize, agent_count: 0, lead_count: 0, created_at: now };
            return sendJson({ ok: true, team: createdTeam, leader });
          }

          const teams = db.prepare('SELECT * FROM teams ORDER BY created_at DESC').all().map((t: any) => {
            const agent_count = (db.prepare("SELECT COUNT(*) as c FROM staff_users WHERE team_id = ? AND role = 'Agent'").get(t.id) as any)?.c || 0;
            const lead_count = (db.prepare('SELECT COUNT(*) as c FROM leads WHERE assigned_team_id = ?').get(t.id) as any)?.c || 0;
            return { ...t, agent_count, lead_count };
          });
          return sendJson({ ok: true, teams });
        }

        if (pathname.startsWith('/api/admin/teams/')) {
          const parts = pathname.split('/');
          const teamId = parts[4];
          if (method === 'PATCH') {
            if (body.name) db.prepare('UPDATE teams SET name = ? WHERE id = ?').run(body.name, teamId);
            if (body.max_size) db.prepare('UPDATE teams SET max_size = ? WHERE id = ?').run(Number(body.max_size), teamId);
            const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(teamId);
            return sendJson({ ok: true, team });
          }
          if (method === 'DELETE') {
            db.prepare('DELETE FROM teams WHERE id = ?').run(teamId);
            return sendJson({ ok: true });
          }
          const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(teamId);
          return sendJson({ ok: true, team });
        }

        // -------------------------------------------------------------
        // /api/admin/staff: Staff (Agent, Team Leader, Office Manager)
        // -------------------------------------------------------------
        if (pathname === '/api/admin/staff') {
          if (method === 'POST') {
            const id = 'adm_' + Date.now();
            const name = body.name || 'New Staff';
            const email = (body.email || `agent_${Date.now()}@codexdynamics.com`).toLowerCase().trim();
            const password = body.password || 'admin123';
            const role = body.role || 'Agent';
            const teamId = body.team_id || null;
            let officeId = body.office_id || null;
            if (teamId && !officeId) {
              const team = db.prepare('SELECT office_id FROM teams WHERE id = ?').get(teamId) as any;
              if (team) officeId = team.office_id;
            }
            const now = new Date().toISOString();
            const caps = JSON.stringify({
              lead_upload: true, create_agent: true, registrations: true, notifications: true, content: true, enquiries: true, chat: true
            });
            db.prepare(`
              INSERT INTO staff_users (id, email, password, name, role, office_id, team_id, status, capabilities, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?)
            `).run(id, email, password, name, role, officeId, teamId, caps, now);
            const createdStaff = { id, name, email, role, office_id: officeId, team_id: teamId, status: 'Active', capabilities: JSON.parse(caps), created_at: now };
            return sendJson({ ok: true, staff: createdStaff });
          }

          const staff = db.prepare('SELECT id, email, name, role, office_id, team_id, status, capabilities, last_login_at, created_at FROM staff_users ORDER BY name ASC').all().map((s: any) => ({
            ...s,
            capabilities: s.capabilities ? (typeof s.capabilities === 'string' ? JSON.parse(s.capabilities) : s.capabilities) : {}
          }));
          return sendJson({ ok: true, staff });
        }

        if (pathname.startsWith('/api/admin/staff/')) {
          const parts = pathname.split('/');
          const staffId = parts[4];
          if (parts[5] === 'block' && method === 'POST') {
            db.prepare("UPDATE staff_users SET status = 'Suspended' WHERE id = ?").run(staffId);
            const staff = db.prepare('SELECT * FROM staff_users WHERE id = ?').get(staffId);
            return sendJson({ ok: true, staff });
          }
          if (parts[5] === 'unblock' && method === 'POST') {
            db.prepare("UPDATE staff_users SET status = 'Active' WHERE id = ?").run(staffId);
            const staff = db.prepare('SELECT * FROM staff_users WHERE id = ?').get(staffId);
            return sendJson({ ok: true, staff });
          }
          if (method === 'PATCH') {
            if (body.name) db.prepare('UPDATE staff_users SET name = ? WHERE id = ?').run(body.name, staffId);
            if (body.email) db.prepare('UPDATE staff_users SET email = ? WHERE id = ?').run(body.email, staffId);
            if (body.password) db.prepare('UPDATE staff_users SET password = ? WHERE id = ?').run(body.password, staffId);
            if (body.team_id !== undefined) db.prepare('UPDATE staff_users SET team_id = ? WHERE id = ?').run(body.team_id, staffId);
            const staff = db.prepare('SELECT * FROM staff_users WHERE id = ?').get(staffId);
            return sendJson({ ok: true, staff });
          }
        }

        // -------------------------------------------------------------
        // Lead Assignment & Client Credential Updates
        // -------------------------------------------------------------
        if (pathname.startsWith('/api/admin/leads/') && pathname.endsWith('/assign') && method === 'POST') {
          const leadId = pathname.split('/')[4];
          const officeId = body.officeId || body.office_id || null;
          const teamId = body.teamId || body.team_id || null;
          const agentId = body.agentId || body.agent_id || null;
          const now = new Date().toISOString();
          db.prepare('UPDATE leads SET assigned_office_id = ?, assigned_team_id = ?, assigned_agent_id = ?, updated_at = ? WHERE id = ?')
            .run(officeId, teamId, agentId, now, leadId);
          const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId);
          return sendJson({ ok: true, lead });
        }

        if (pathname.endsWith('/set-password') && method === 'POST') {
          const parts = pathname.split('/');
          const userId = parts[parts.length - 2];
          const newPassword = (body.password || body.client_password || '').trim();
          if (!newPassword) {
            return sendJson({ ok: false, error: 'Password cannot be empty.' }, 400);
          }
          db.prepare('UPDATE portal_clients SET password = ? WHERE id = ? OR email = ?').run(newPassword, userId, userId);
          db.prepare('UPDATE leads SET client_password = ? WHERE id = ? OR email = ?').run(newPassword, userId, userId);
          const now = new Date().toISOString();
          const auditId = 'aud_' + Date.now();
          db.prepare("INSERT INTO audit_logs (id, user_id, action, details, created_at) VALUES (?, ?, 'PASSWORD_RESET', 'Password updated', ?)")
            .run(auditId, userId, now);
          return sendJson({ ok: true, message: 'Password updated', password: newPassword });
        }

        if (pathname === '/api/admin/users') {
          const search = (parsedUrl.searchParams.get('search') || '').trim();
          const limit = Math.min(200, Math.max(1, Number(parsedUrl.searchParams.get('limit')) || 100));

          let clients;
          if (search) {
            const term = `%${search}%`;
            clients = db.prepare(`
              SELECT id, name, company, email, phone, country, country_code, status, password as clientPassword, tier, last_login_at, created_at
              FROM portal_clients
              WHERE name LIKE ? OR email LIKE ? OR company LIKE ? OR id LIKE ?
              ORDER BY name ASC
              LIMIT ?
            `).all(term, term, term, term, limit);
          } else {
            clients = db.prepare(`
              SELECT id, name, company, email, phone, country, country_code, status, password as clientPassword, tier, last_login_at, created_at
              FROM portal_clients
              ORDER BY name ASC
              LIMIT ?
            `).all(limit);
          }

          return sendJson({ ok: true, users: clients, total: clients.length });
        }

        // Messages fallback
        if (pathname === '/api/admin/messages' || pathname === '/api/client/messages') {
          if (method === 'POST') {
            const userId = (body.user_id || body.userId || '').trim();
            const text = (body.body || body.text || '').trim();
            const sender = body.sender === 'client' ? 'client' : 'agent';
            const senderName = body.sender_name || (sender === 'client' ? 'Client' : 'Support Agent');
            const now = new Date().toISOString();
            const msgId = 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);

            db.prepare(`
              INSERT INTO messages (id, user_id, sender, sender_name, body, is_read, created_at)
              VALUES (?, ?, ?, ?, ?, 0, ?)
            `).run(msgId, userId, sender, senderName, text, now);

            return sendJson({
              ok: true,
              message: { id: msgId, user_id: userId, sender, sender_name: senderName, body: text, created_at: now },
            });
          }

          const userId = parsedUrl.searchParams.get('user_id') || '';
          const msgs = userId
            ? db.prepare('SELECT * FROM messages WHERE user_id = ? ORDER BY created_at ASC').all(userId)
            : db.prepare('SELECT * FROM messages ORDER BY created_at ASC').all();

          return sendJson({ ok: true, user: { id: userId }, messages: msgs, unread_count: 0 });
        }

        // Notifications fallback
        if (pathname === '/api/admin/notifications/send' && method === 'POST') {
          const userId = body.user_id || body.userId || null;
          const message = (body.message || '').trim();
          const kind = body.kind || 'info';
          const title = (body.title || 'Administrator Notice').trim();
          const now = new Date().toISOString();
          const notifId = 'notif_' + Date.now();

          db.prepare(`
            INSERT INTO notifications (id, user_id, title, description, kind, type, is_read, link, sent_by, created_at)
            VALUES (?, ?, ?, ?, ?, 'project', 0, '/portal/notifications', 'Admin', ?)
          `).run(notifId, userId, title, message, kind, now);

          return sendJson({ ok: true, id: notifId, sent: 1 });
        }

        if (pathname === '/api/admin/notifications/sent-log' || pathname === '/api/client/notifications') {
          const targetUserId = parsedUrl.searchParams.get('user_id');
          const notifs = targetUserId
            ? db.prepare("SELECT * FROM notifications WHERE user_id = ? OR user_id IS NULL ORDER BY created_at DESC LIMIT 100").all(targetUserId)
            : db.prepare('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 100').all();
          return sendJson({ ok: true, notifications: notifs, log: notifs, total: notifs.length });
        }

        // Audit log fallback
        if (pathname === '/api/admin/audit') {
          const userId = parsedUrl.searchParams.get('user_id');
          const logs = userId
            ? db.prepare('SELECT * FROM audit_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(userId)
            : db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100').all();
          return sendJson({ ok: true, log: logs, history: logs, total: logs.length });
        }

        sendJson({ ok: true, timestamp: new Date().toISOString() });
      });
    },
  };
}
