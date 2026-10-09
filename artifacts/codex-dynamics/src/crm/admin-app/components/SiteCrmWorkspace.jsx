import React, { useEffect, useMemo, useState } from 'react';
import ContentWorkspace from './ContentWorkspace.jsx';
import LiveChatWorkspace from './LiveChatWorkspace.jsx';
import EnquiriesWorkspace from './EnquiriesWorkspace.jsx';
import {
  getAdminSiteContent,
  importLegacySiteContentAdmin,
  listAdminClients,
  runAdminSiteContentAction,
  uploadAdminSiteImage,
  changeCurrentAdminPassword,
  getAdminWebhookSettings,
  getStoredAdminProfile,
  saveAdminWebhookSettings,
  testAdminWebhookSettings,
} from '../adminApi.js';

const TABS = [
  ['overview', 'Overview'],
  ['tools', 'Tools'],
];

const emptyForms = {
  backlink: { name: '', url: '', notes: '' },
  blog: { title: '', slug: '', excerpt: '', content: '', status: 'draft', category: 'Engineering' },
  review: { author: '', rating: 5, comment: '', is_published: true },
  project: { title: '', site_name: '', site_url: '', description: '', category: 'Web Development', image_url: '', is_published: true },
};

async function crmAction(action, payload = {}) {
  if (action === 'restore_backup') {
    return importLegacySiteContentAdmin(payload.backupData || {});
  }
  if (action === 'upload_image') {
    return uploadAdminSiteImage(payload);
  }
  if (action === 'save_webhook') return saveAdminWebhookSettings(payload.url);
  if (action === 'test_webhook') return testAdminWebhookSettings();
  if (action === 'change_password') return changeCurrentAdminPassword(payload.currentPassword, payload.newPassword);
  return runAdminSiteContentAction(action, payload);
}

function Button({ children, onClick, danger = false, secondary = false, disabled = false, type = 'button' }) {
  return <button type={type} disabled={disabled} className={`crm-site-crm-btn${secondary ? ' secondary' : ''}${danger ? ' danger' : ''}`} onClick={onClick}>{children}</button>;
}

function Field({ label, value, onChange, multiline = false, type = 'text', autoComplete, minLength }) {
  const props = { value: value ?? '', onChange: (e) => onChange(e.target.value), type, autoComplete, minLength };
  return <label className="crm-site-crm-field"><span>{label}</span>{multiline ? <textarea {...props} rows={4} /> : <input {...props} />}</label>;
}

function RecordForm({ type, onSaved, onCancel, initial }) {
  const [form, setForm] = useState({ ...emptyForms[type], ...(initial || {}) });
  const [saving, setSaving] = useState(false);
  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const action = initial?.id
        ? ({ backlink: 'update_backlink', blog: 'update_blog', review: 'update_review', project: 'update_project' }[type])
        : ({ backlink: 'add_backlink', blog: 'save_blog', review: 'save_review', project: 'save_project' }[type]);
      await crmAction(action, initial?.id ? { id: initial.id, ...form } : form);
      onSaved();
    } catch (error) {
      window.alert(error.message);
    } finally { setSaving(false); }
  };
  return <form className="crm-site-crm-form" onSubmit={submit}>
    {type === 'backlink' && <><Field label="Name" value={form.name} onChange={(v) => set('name', v)} /><Field label="URL" value={form.url} onChange={(v) => set('url', v)} /><Field label="Notes" value={form.notes} onChange={(v) => set('notes', v)} multiline /></>}
    {type === 'blog' && <><Field label="Title" value={form.title} onChange={(v) => set('title', v)} /><Field label="Slug" value={form.slug} onChange={(v) => set('slug', v)} /><Field label="Excerpt" value={form.excerpt} onChange={(v) => set('excerpt', v)} multiline /><Field label="Content" value={form.content} onChange={(v) => set('content', v)} multiline /><Field label="Category" value={form.category} onChange={(v) => set('category', v)} /></>}
    {type === 'review' && <><Field label="Author" value={form.author} onChange={(v) => set('author', v)} /><Field label="Rating" value={form.rating} onChange={(v) => set('rating', Number(v))} type="number" /><Field label="Comment" value={form.comment} onChange={(v) => set('comment', v)} multiline /><label className="crm-site-crm-check"><input type="checkbox" checked={Boolean(form.is_published)} onChange={(e) => set('is_published', e.target.checked)} /> Published</label></>}
    {type === 'project' && <><Field label="Title" value={form.title} onChange={(v) => set('title', v)} /><Field label="Site name" value={form.site_name} onChange={(v) => set('site_name', v)} /><Field label="Site URL" value={form.site_url} onChange={(v) => set('site_url', v)} /><Field label="Category" value={form.category} onChange={(v) => set('category', v)} /><Field label="Description" value={form.description} onChange={(v) => set('description', v)} multiline /><Field label="Image URL" value={form.image_url} onChange={(v) => set('image_url', v)} /><label className="crm-site-crm-check"><input type="checkbox" checked={Boolean(form.is_published)} onChange={(e) => set('is_published', e.target.checked)} /> Published</label></>}
    <div className="crm-site-crm-form-actions"><Button secondary onClick={onCancel}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button></div>
  </form>;
}

function Table({ children }) { return <div className="crm-site-crm-table-wrap"><table className="crm-site-crm-table"><tbody>{children}</tbody></table></div>; }

export default function SiteCrmWorkspace({
  showNotification = () => {},
  defaultTab = 'overview',
  standalone = false,
  onOpenLeadProfile = null,
  leads = [],
}) {
  const [tab, setTab] = useState(defaultTab);
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [formType, setFormType] = useState(null);
  const [editing, setEditing] = useState(null);
  const [webhook, setWebhook] = useState('');
  const [webhookError, setWebhookError] = useState('');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [webhookSaving, setWebhookSaving] = useState(false);
  const [webhookTesting, setWebhookTesting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const profile = getStoredAdminProfile();
      setIsSuperAdmin(profile?.role === 'Super Admin');
      const [content, clientResult] = await Promise.all([
        getAdminSiteContent(),
        listAdminClients({ limit: 500 }),
      ]);
      if (profile?.role === 'Super Admin') {
        try {
          const webhookSettings = await getAdminWebhookSettings();
          setWebhook(webhookSettings.url || '');
          setWebhookError('');
        } catch (error) {
          setWebhookError(error.message || 'Webhook settings could not be loaded.');
        }
      }
      const clients = clientResult.clients || [];
      const enquiries = clients.filter((client) => client.source && /website|contact|enquiry/i.test(client.source));
      setData({
        enquiries,
        blogs: content.blogs || [],
        reviews: content.reviews || [],
        projects: content.projects || [],
        backlinks: content.backlinks || [],
        stats: {
          totalLeads: clients.length,
          totalEnquiries: enquiries.length,
          totalBlogs: (content.blogs || []).length,
          totalReviews: (content.reviews || []).length,
          totalProjects: (content.projects || []).length,
        },
        settings: content.settings || {},
      });
    } catch (error) {
      setLoadError(error.message || 'The Site CRM data could not be loaded.');
      setData(null);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { setTab(defaultTab); }, [defaultTab]);

  const run = async (action, payload = {}) => {
    try {
      const result = await crmAction(action, payload);
      if (action !== 'test_webhook') await load();
      showNotification(result?.message || (action === 'test_webhook' ? 'Webhook test sent.' : 'Saved to the database.'));
      return true;
    } catch (error) {
      window.alert(error.message);
      return false;
    }
  };
  const enquiries = data?.enquiries || [];
  const blogs = data?.blogs || [];
  const reviews = data?.reviews || [];
  const projects = data?.projects || [];
  const backlinks = data?.backlinks || [];
  const stats = data?.stats || {};
  const formTitle = formType ? `${editing ? 'Edit' : 'Add'} ${formType}` : '';
  const closeForm = () => { setFormType(null); setEditing(null); };
  const edit = (type, item) => { setFormType(type); setEditing(item); };

  const saveWebhook = async () => {
    setWebhookSaving(true);
    setWebhookError('');
    try {
      const result = await saveAdminWebhookSettings(webhook);
      setWebhook(result.url ?? webhook);
      showNotification(result.message || 'Webhook URL saved.');
    } catch (error) {
      setWebhookError(error.message || 'Webhook URL could not be saved.');
    } finally {
      setWebhookSaving(false);
    }
  };

  const testWebhook = async () => {
    setWebhookTesting(true);
    setWebhookError('');
    try {
      const result = await testAdminWebhookSettings();
      showNotification(result.message || 'Webhook test sent.');
    } catch (error) {
      setWebhookError(error.message || 'Webhook test failed.');
    } finally {
      setWebhookTesting(false);
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) return window.alert('New passwords do not match.');
    if (passwords.newPassword.length < 12) return window.alert('New password must be at least 12 characters.');
    setPasswordSaving(true);
    try {
      const result = await crmAction('change_password', {
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      });
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
      showNotification(result?.message || 'Password updated.');
    } catch (error) {
      window.alert(error.message);
    } finally {
      setPasswordSaving(false);
    }
  };
  const uploadImage = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const result = await crmAction('upload_image', { name: file.name, data });
      await navigator.clipboard?.writeText(result.url || '');
      showNotification(`Uploaded ${file.name}. URL copied.`);
    } catch (error) { window.alert(error.message); } finally { setUploading(false); event.target.value = ''; }
  };

  if (loading || !data) return <div className="crm-site-crm-loading">Loading shared site CRM...</div>;
  const visibleTabs = standalone ? [] : TABS;
  return <section className="crm-site-crm-workspace">
    {!standalone && <nav className="crm-site-crm-tabs">{visibleTabs.map(([key, label]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}</button>)}</nav>}

    {tab === 'overview' && <div className="crm-site-crm-grid">
      {[['Clients', stats.totalLeads || 0], ['Enquiries', stats.totalEnquiries || enquiries.length], ['Blogs', stats.totalBlogs || blogs.length], ['Reviews', stats.totalReviews || reviews.length], ['Projects', stats.totalProjects || projects.length]].map(([label, value]) => <div className="crm-site-crm-stat" key={label}><span>{label}</span><strong>{value}</strong></div>)}
      <div className="crm-site-crm-panel wide"><h3>Recent enquiries</h3>{enquiries.slice(0, 6).map((row) => <div className="crm-site-crm-row" key={row.id} style={{ cursor: onOpenLeadProfile ? 'pointer' : 'default' }} onClick={() => { if (onOpenLeadProfile) { const match = (leads || []).find((l) => l.id === row.leadId || (row.email && l.email?.toLowerCase() === row.email?.toLowerCase()) || (row.name && l.name?.toLowerCase() === row.name?.toLowerCase())) || row; onOpenLeadProfile(match); } }}><div><strong>{row.name}</strong><span>{row.email}</span></div><em>{row.status}</em></div>)}</div>
    </div>}

    {tab === 'enquiries' && (
      <EnquiriesWorkspace
        enquiries={enquiries}
        onAction={run}
        showNotification={showNotification}
        onOpenLeadProfile={onOpenLeadProfile}
        leads={leads}
      />
    )}

    {tab === 'content' && (
      <ContentWorkspace
        blogs={blogs}
        projects={projects}
        reviews={reviews}
        backlinks={backlinks}
        onAction={run}
        showNotification={showNotification}
      />
    )}

    {tab === 'chat' && (
      <LiveChatWorkspace showNotification={showNotification} />
    )}

    {tab === 'tools' && (
      <div className="crm-site-crm-tools">
        {isSuperAdmin && (
          <div className="crm-site-crm-panel">
            <h3>Webhook</h3>
            {webhookError && <p role="alert" className="crm-error-text">{webhookError}</p>}
            <Field label="Webhook URL" value={webhook} onChange={setWebhook} />
            <Button disabled={webhookSaving} onClick={saveWebhook}>{webhookSaving ? 'Saving…' : 'Save webhook'}</Button>
            <Button secondary disabled={webhookTesting} onClick={testWebhook}>{webhookTesting ? 'Sending…' : 'Send test'}</Button>
          </div>
        )}
        <div className="crm-site-crm-panel">
          <h3>Backup and restore</h3>
          <p>Download the shared CRM data or restore a previous JSON snapshot.</p>
          <Button onClick={() => {
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `codex-site-crm-${new Date().toISOString().slice(0, 10)}.json`;
            link.click();
            URL.revokeObjectURL(link.href);
          }}>Export backup</Button>
          <label className="crm-site-crm-upload">Restore backup<input type="file" accept="application/json" onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              await run('restore_backup', { backupData: JSON.parse(await file.text()) });
            } catch (error) {
              window.alert(error.message || 'Backup file is invalid.');
            } finally {
              e.target.value = '';
            }
          }} /></label>
        </div>
        <div className="crm-site-crm-panel">
          <h3>Admin password</h3>
          <form className="crm-site-crm-form" onSubmit={changePassword}>
            <Field label="Current password" value={passwords.currentPassword} onChange={(v) => setPasswords((p) => ({ ...p, currentPassword: v }))} type="password" autoComplete="current-password" />
            <Field label="New password" value={passwords.newPassword} onChange={(v) => setPasswords((p) => ({ ...p, newPassword: v }))} type="password" autoComplete="new-password" minLength={12} />
            <Field label="Confirm new password" value={passwords.confirmPassword} onChange={(v) => setPasswords((p) => ({ ...p, confirmPassword: v }))} type="password" autoComplete="new-password" minLength={12} />
            <p>Use at least 12 characters. Your other active sessions will be signed out.</p>
            <Button type="submit" disabled={passwordSaving}>{passwordSaving ? 'Updating…' : 'Change password'}</Button>
          </form>
        </div>
        <div className="crm-site-crm-panel">
          <h3>Media upload</h3>
          <p>Upload an image to the shared site media library. The resulting URL is copied for use in content.</p>
          <label className="crm-site-crm-upload">{uploading ? 'Uploading...' : 'Choose image'}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" disabled={uploading} onChange={uploadImage} /></label>
        </div>
      </div>
    )}

    {formType && <div className="crm-site-crm-modal"><div className="crm-site-crm-modal-card"><div className="crm-site-crm-panel-heading"><h3>{formTitle}</h3><Button secondary onClick={closeForm}>Close</Button></div><RecordForm type={formType} initial={editing} onCancel={closeForm} onSaved={async () => { closeForm(); await load(); }} /></div></div>}
  </section>;
}
