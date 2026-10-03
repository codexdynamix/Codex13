import React, { useEffect, useMemo, useState } from 'react';
import ContentWorkspace from './ContentWorkspace.jsx';
import LiveChatWorkspace from './LiveChatWorkspace.jsx';
import EnquiriesWorkspace from './EnquiriesWorkspace.jsx';

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

const localSiteCrmStore = {
  enquiries: [],
  blogs: [],
  reviews: [],
  projects: [],
  backlinks: [],
  stats: { enquiries: 0, visitors: 0, publishedBlogs: 0, publishedProjects: 0, publishedReviews: 0 },
  settings: { webhookUrl: '' },
};

const SITE_CRM_STORAGE_KEY = 'codex_site_crm_content';

function readSiteCrmStore() {
  try {
    const stored = window.localStorage.getItem(SITE_CRM_STORAGE_KEY);
    if (!stored) return localSiteCrmStore;
    const parsed = JSON.parse(stored);
    return {
      ...localSiteCrmStore,
      ...parsed,
      enquiries: Array.isArray(parsed.enquiries) ? parsed.enquiries : [],
      blogs: Array.isArray(parsed.blogs) ? parsed.blogs : [],
      reviews: Array.isArray(parsed.reviews) ? parsed.reviews : [],
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
      backlinks: Array.isArray(parsed.backlinks) ? parsed.backlinks : [],
      settings: { ...localSiteCrmStore.settings, ...(parsed.settings || {}) },
    };
  } catch {
    return localSiteCrmStore;
  }
}

function persistSiteCrmStore() {
  try {
    window.localStorage.setItem(SITE_CRM_STORAGE_KEY, JSON.stringify(localSiteCrmStore));
  } catch {
    // Storage can be unavailable in private browsing; the in-memory store remains usable.
  }
}

async function crmAction(action, payload = {}) {
  const id = payload.id || Date.now();
  if (action === 'add_backlink') localSiteCrmStore.backlinks.push({ id, ...payload });
  if (action === 'update_backlink') localSiteCrmStore.backlinks = localSiteCrmStore.backlinks.map((x) => (x.id === id ? { ...x, ...payload } : x));
  if (action === 'delete_backlink') localSiteCrmStore.backlinks = localSiteCrmStore.backlinks.filter((x) => x.id !== id);
  if (action === 'save_blog') localSiteCrmStore.blogs.push({ id, ...payload });
  if (action === 'update_blog') localSiteCrmStore.blogs = localSiteCrmStore.blogs.map((x) => (x.id === id ? { ...x, ...payload } : x));
  if (action === 'delete_blog') localSiteCrmStore.blogs = localSiteCrmStore.blogs.filter((x) => x.id !== id);
  if (action === 'save_review') localSiteCrmStore.reviews.push({ id, ...payload });
  if (action === 'update_review') localSiteCrmStore.reviews = localSiteCrmStore.reviews.map((x) => (x.id === id ? { ...x, ...payload } : x));
  if (action === 'delete_review') localSiteCrmStore.reviews = localSiteCrmStore.reviews.filter((x) => x.id !== id);
  if (action === 'save_project') localSiteCrmStore.projects.push({ id, ...payload });
  if (action === 'update_project') localSiteCrmStore.projects = localSiteCrmStore.projects.map((x) => (x.id === id ? { ...x, ...payload } : x));
  if (action === 'delete_project') localSiteCrmStore.projects = localSiteCrmStore.projects.filter((x) => x.id !== id);
  if (action === 'save_enquiry') localSiteCrmStore.enquiries.unshift({ id, ...payload });
  if (action === 'delete_enquiry') localSiteCrmStore.enquiries = localSiteCrmStore.enquiries.filter((x) => x.id !== id);
  if (action === 'update_enquiry_status') {
    localSiteCrmStore.enquiries = localSiteCrmStore.enquiries.map((x) => (x.id === id ? { ...x, status: payload.status } : x));
  }
  if (action === 'save_webhook') {
    localSiteCrmStore.settings = { ...localSiteCrmStore.settings, webhookUrl: payload.url || '' };
  }
  if (action === 'restore_backup' && payload.backupData) {
    const restored = payload.backupData;
    localSiteCrmStore.enquiries = Array.isArray(restored.enquiries) ? restored.enquiries : [];
    localSiteCrmStore.blogs = Array.isArray(restored.blogs) ? restored.blogs : [];
    localSiteCrmStore.reviews = Array.isArray(restored.reviews) ? restored.reviews : [];
    localSiteCrmStore.projects = Array.isArray(restored.projects) ? restored.projects : [];
    localSiteCrmStore.backlinks = Array.isArray(restored.backlinks) ? restored.backlinks : [];
    localSiteCrmStore.settings = { ...localSiteCrmStore.settings, ...(restored.settings || {}) };
  }
  persistSiteCrmStore();
  return { ok: true, url: payload.data || '' };
}

function Button({ children, onClick, danger = false, secondary = false, disabled = false }) {
  return <button type="button" disabled={disabled} className={`crm-site-crm-btn${secondary ? ' secondary' : ''}${danger ? ' danger' : ''}`} onClick={onClick}>{children}</button>;
}

function Field({ label, value, onChange, multiline = false, type = 'text' }) {
  const props = { value: value ?? '', onChange: (e) => onChange(e.target.value), type };
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
    <div className="crm-site-crm-form-actions"><Button secondary onClick={onCancel}>Cancel</Button><Button disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button></div>
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
  const [formType, setFormType] = useState(null);
  const [editing, setEditing] = useState(null);
  const [webhook, setWebhook] = useState('');
  const [chatThreads, setChatThreads] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [selectedThread, setSelectedThread] = useState(null);
  const [loading, setLoading] = useState(true);
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const stored = readSiteCrmStore();
      Object.assign(localSiteCrmStore, stored);
      setData({
        ...stored,
        enquiries: [...stored.enquiries],
        blogs: [...stored.blogs],
        reviews: [...stored.reviews],
        projects: [...stored.projects],
        backlinks: [...stored.backlinks],
      });
      setWebhook(stored.settings?.webhookUrl || '');
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { setTab(defaultTab); }, [defaultTab]);

  const run = async (action, payload = {}) => {
    try { await crmAction(action, payload); await load(); showNotification('Saved successfully.'); }
    catch (error) { window.alert(error.message); }
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

  useEffect(() => {
    if (tab !== 'chat') return;
    setChatThreads([]);
  }, [tab]);
  const selectThread = async (thread) => {
    setSelectedThread(thread);
    setChatMessages([]);
  };
  const changePassword = async (event) => {
    event.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) return window.alert('New passwords do not match.');
    await run('change_password', { currentPassword: passwords.currentPassword, newPassword: passwords.newPassword });
    setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
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
      {[['Leads', stats.totalLeads || 0], ['Enquiries', stats.totalEnquiries || enquiries.length], ['Blogs', stats.totalBlogs || blogs.length], ['Reviews', stats.totalReviews || reviews.length], ['Projects', stats.totalProjects || projects.length]].map(([label, value]) => <div className="crm-site-crm-stat" key={label}><span>{label}</span><strong>{value}</strong></div>)}
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

    {tab === 'tools' && <div className="crm-site-crm-tools"><div className="crm-site-crm-panel"><h3>Webhook</h3><Field label="Webhook URL" value={webhook} onChange={setWebhook} /><Button onClick={() => run('save_webhook', { url: webhook })}>Save webhook</Button><Button secondary onClick={() => run('test_webhook', { url: webhook })}>Send test</Button></div><div className="crm-site-crm-panel"><h3>Backup and restore</h3><p>Download the shared CRM data or restore a previous JSON snapshot.</p><Button onClick={() => { const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `codex-site-crm-${new Date().toISOString().slice(0, 10)}.json`; link.click(); }}>Export backup</Button><label className="crm-site-crm-upload">Restore backup<input type="file" accept="application/json" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; await run('restore_backup', { backupData: JSON.parse(await file.text()) }); }} /></label></div><div className="crm-site-crm-panel"><h3>Admin password</h3><form className="crm-site-crm-form" onSubmit={changePassword}><Field label="Current password" value={passwords.currentPassword} onChange={(v) => setPasswords((p) => ({ ...p, currentPassword: v }))} type="password" /><Field label="New password" value={passwords.newPassword} onChange={(v) => setPasswords((p) => ({ ...p, newPassword: v }))} type="password" /><Field label="Confirm new password" value={passwords.confirmPassword} onChange={(v) => setPasswords((p) => ({ ...p, confirmPassword: v }))} type="password" /><Button>Change password</Button></form></div><div className="crm-site-crm-panel"><h3>Media upload</h3><p>Upload an image to the shared site media library. The resulting URL is copied for use in content.</p><label className="crm-site-crm-upload">{uploading ? 'Uploading...' : 'Choose image'}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" disabled={uploading} onChange={uploadImage} /></label></div></div>}

    {formType && <div className="crm-site-crm-modal"><div className="crm-site-crm-modal-card"><div className="crm-site-crm-panel-heading"><h3>{formTitle}</h3><Button secondary onClick={closeForm}>Close</Button></div><RecordForm type={formType} initial={editing} onCancel={closeForm} onSaved={async () => { closeForm(); await load(); }} /></div></div>}
  </section>;
}
