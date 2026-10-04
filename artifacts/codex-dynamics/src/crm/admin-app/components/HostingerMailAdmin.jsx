import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, KeyRound, Mail, Pencil, RefreshCw, ShieldCheck, Trash2, UserRound, X } from 'lucide-react';
import {
  assignClientMailboxAdmin, getClientMailboxesAdmin, getHostingerMailIntegrationAdmin,
  listHostingerMailboxesAdmin, removeClientMailboxAdmin, removeHostingerMailIntegrationAdmin,
  reassignClientMailboxAdmin, saveHostingerMailIntegrationAdmin, testHostingerMailIntegrationAdmin,
  updateClientMailboxAdmin,
} from '../adminApi.js';

const statusCopy = { connected: 'Connected', connection_error: 'Connection error', not_configured: 'Not configured' };
const dateLabel = value => value ? new Date(value).toLocaleString() : 'Not tested';

export function HostingerMailSettings() {
  const [status, setStatus] = useState(null);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const refresh = async () => {
    setError('');
    try { const d = await getHostingerMailIntegrationAdmin(); setStatus(d.integration || d.config || (typeof d.status === 'object' ? d.status : d)); }
    catch (e) { setError(e.message || 'Could not load Hostinger Mail settings.'); }
  };
  useEffect(() => { void refresh(); }, []);
  const run = async action => {
    setBusy(true); setError(''); setMessage('');
    try {
      if (action === 'save') { if (!token.trim()) throw new Error('Enter an API token before saving.'); await saveHostingerMailIntegrationAdmin(token.trim()); setToken(''); setMessage('Hostinger Mail API token saved and validated.'); }
      if (action === 'test') { const d = await testHostingerMailIntegrationAdmin(token.trim() || undefined); setMessage(d.message || 'Connection test completed.'); }
      if (action === 'remove') { if (!window.confirm('Remove the Hostinger Mail API configuration? Existing mailbox assignments will remain, but mail access may stop.')) return; await removeHostingerMailIntegrationAdmin(); setToken(''); setMessage('Integration configuration removed.'); }
      await refresh();
    } catch (e) { setError(e.message || 'The request failed.'); }
    finally { setBusy(false); }
  };
  const configured = Boolean(status?.configured);
  const connected = status?.status === 'connected';
  return <section className="crm-settings-panel" aria-label="Hostinger Mail API configuration">
    <div className="crm-settings-section-head"><div><h3><Mail size={17}/> Hostinger Mail API</h3><p>Connect Codex Dynamics to the Hostinger Mail API. Credentials are sent directly to the server and never retained in this form.</p></div><span className={`crm-status-pill ${connected?'saved':'unsaved'}`}><span className="crm-status-pulse" style={{background:connected?'#30D158':undefined}}/>{statusCopy[status?.status] || 'Checking status'}</span></div>
    {error && <div role="alert" className="crm-mail-admin-alert error"><AlertCircle size={16}/>{error}</div>}
    {message && <div role="status" className="crm-mail-admin-alert success"><CheckCircle2 size={16}/>{message}</div>}
    <div className="crm-mail-admin-status"><div><span>Configuration</span><strong>{configured ? 'Configured' : 'Not configured'}</strong></div><div><span>API key</span><strong>{configured ? (status?.maskedToken || 'Stored securely') : 'None stored'}</strong></div><div><span>Assigned mailboxes</span><strong>{status?.mailboxCount ?? '—'}</strong></div><div><span>Last tested</span><strong>{dateLabel(status?.lastTestedAt)}</strong></div><div><span>Last successful</span><strong>{dateLabel(status?.lastSuccessAt)}</strong></div></div>
    <div className="crm-mail-admin-callout"><ShieldCheck size={18}/><span>Only Super Admins can configure this integration. The token is not saved to browser storage, shown after save, or returned to the page.</span></div>
    <label className="crm-settings-field"><span>{configured?'Replace API token':'API token'}</span><input type="password" autoComplete="new-password" value={token} onChange={e=>setToken(e.target.value)} placeholder={configured?'Enter a new token to rotate':'Paste Hostinger Mail API token'} className="crm-settings-input" /></label>
    <div className="crm-mail-admin-actions"><button type="button" disabled={busy||!token.trim()} onClick={()=>void run('save')} className="crm-mail-primary">{busy?'Saving…':configured?'Save new token':'Save and validate token'}</button><button type="button" disabled={busy} onClick={()=>void run('test')} className="crm-mail-secondary"><RefreshCw size={14}/>{busy?'Working…':'Test connection'}</button>{configured&&<button type="button" disabled={busy} onClick={()=>void run('remove')} className="crm-mail-danger"><Trash2 size={14}/>Remove configuration</button>}</div>
  </section>;
}

export function ClientEmailAccounts({ client, clients = [] }) {
  const clientId = String(client?.id || '');
  const [assignments, setAssignments] = useState([]);
  const [providerMailboxes, setProviderMailboxes] = useState([]);
  const [selectedResource, setSelectedResource] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [editingId, setEditingId] = useState('');
  const [editingName, setEditingName] = useState('');
  const [transferTarget, setTransferTarget] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const refresh = async () => {
    setError('');
    try { const [assigned, all] = await Promise.all([getClientMailboxesAdmin(clientId), listHostingerMailboxesAdmin()]); setAssignments(assigned); setProviderMailboxes(all); }
    catch (e) { setError(e.message || 'Could not load client email accounts.'); }
  };
  useEffect(() => { if (clientId) void refresh(); }, [clientId]);
  const available = providerMailboxes.filter(m => !m.assignedClientId || String(m.assignedClientId) === clientId);
  const add = async e => {
    e.preventDefault(); if (!selectedResource) return;
    setBusy(true); setError(''); setNotice('');
    try { await assignClientMailboxAdmin(clientId, { providerMailboxId: selectedResource, displayName: displayName.trim() || (providerMailboxes.find(m=>m.resourceId===selectedResource)?.address || ''), enabled: true }); setSelectedResource(''); setDisplayName(''); await refresh(); setNotice('Mailbox access assigned. No Hostinger mailbox was created.'); }
    catch (err) { setError(err.message || 'Could not assign mailbox.'); }
    finally { setBusy(false); }
  };
  const update = async (a, patch) => { setBusy(true); setError(''); try { await updateClientMailboxAdmin(clientId, a.id, patch); await refresh(); return true; } catch(e) { setError(e.message || 'Could not update mailbox access.'); return false; } finally { setBusy(false); } };
  const saveDisplayName = async a => {
    const nextName = editingName.trim();
    if (!nextName || nextName.length > 191) { setError('Enter a display name of 1 to 191 characters.'); return; }
    if (await update(a, { displayName: nextName })) {
      setEditingId('');
      setNotice('Mailbox display name updated.');
    }
  };
  const remove = async a => { if (!window.confirm(`Remove ${a.emailAddress} access from ${client.name || client.company || 'this client'}? This removes only the CRM assignment, not the Hostinger mailbox.`)) return; setBusy(true); setError(''); try { await removeClientMailboxAdmin(clientId,a.id); await refresh(); setNotice('Client mailbox access removed. The Hostinger mailbox was not deleted.'); } catch(e) { setError(e.message || 'Could not remove access.'); } finally { setBusy(false); } };
  const transfer = async a => {
    const target = transferTarget[a.id];
    const clientName = clients.find(c=>String(c.id)===String(target))?.name || clients.find(c=>String(c.id)===String(target))?.company || target;
    if (!target || !window.confirm(`Transfer ${a.emailAddress} to ${clientName}? ${client.name || client.company} will immediately lose access. This moves the CRM assignment only; it does not create or delete a Hostinger mailbox.`)) return;
    setBusy(true); setError('');
    try { await reassignClientMailboxAdmin(a.id,target,a.displayName); await refresh(); setTransferTarget(t=>({...t,[a.id]:''})); setNotice(`Mailbox access transferred to ${clientName}.`); }
    catch(e) { setError(e.message || 'Could not transfer mailbox access.'); }
    finally { setBusy(false); }
  };
  return <section className="crm-email-accounts" aria-label="Client email accounts">
    <div className="crm-email-accounts-head"><div><div className="crm-email-eyebrow"><UserRound size={13}/> Super Admin · Client access</div><h3>Email Accounts</h3><p>Assign existing Hostinger mailboxes to {client.name || client.company || 'this client'}.</p></div><button type="button" onClick={()=>void refresh()} disabled={busy} className="crm-mail-icon" aria-label="Refresh mailbox assignments"><RefreshCw size={15}/></button></div>
    {error&&<div role="alert" className="crm-mail-admin-alert error"><AlertCircle size={15}/>{error}</div>}{notice&&<div role="status" className="crm-mail-admin-alert success"><CheckCircle2 size={15}/>{notice}</div>}
    {assignments.length ? <div className="crm-email-account-list">{assignments.map(a=><div className="crm-email-assignment" key={a.id}>
      <div className="crm-email-ident">
        <div className="crm-email-icon"><Mail size={16}/></div>
        <div className="crm-email-info">
          {editingId === a.id
            ? <div className="flex flex-wrap items-center gap-1"><input aria-label={`Display name for ${a.emailAddress}`} autoFocus maxLength={191} value={editingName} onChange={e=>setEditingName(e.target.value)} className="crm-settings-input" disabled={busy}/><button type="button" onClick={()=>void saveDisplayName(a)} disabled={busy} className="crm-mail-secondary">Save</button><button type="button" aria-label="Cancel display name edit" onClick={()=>setEditingId('')} disabled={busy} className="crm-mail-icon"><X size={14}/></button></div>
            : <div className="flex items-center gap-2"><strong>{a.displayName || a.emailAddress}</strong><button type="button" aria-label={`Edit display name for ${a.emailAddress}`} title="Edit display name" disabled={busy} onClick={()=>{setEditingId(a.id);setEditingName(a.displayName || a.emailAddress);setError('');setNotice('');}} className="crm-mail-icon"><Pencil size={13}/></button></div>}
          <span>{a.emailAddress}</span>
        </div>
        <span className={`crm-email-state ${a.enabled?'enabled':'disabled'}`}>{a.enabled?'Enabled':'Disabled'}</span>
      </div>
      <div className="crm-email-assignment-actions"><label><input type="checkbox" checked={Boolean(a.enabled)} disabled={busy} onChange={e=>void update(a,{enabled:e.target.checked})}/> Portal access</label><select value={transferTarget[a.id] || ''} disabled={busy} onChange={e=>setTransferTarget(t=>({...t,[a.id]:e.target.value}))}><option value="">Transfer to client…</option>{clients.filter(c=>String(c.id)!==clientId).map(c=><option key={c.id} value={c.id}>{c.name || c.company || c.id}</option>)}</select><button type="button" disabled={busy||!transferTarget[a.id]} onClick={()=>void transfer(a)} className="crm-mail-secondary">Transfer</button><button type="button" disabled={busy} onClick={()=>void remove(a)} className="crm-mail-danger"><Trash2 size={13}/>Remove access</button></div>
    </div>)}</div> : <div className="crm-email-empty"><Mail size={21}/><strong>No mailbox access assigned</strong><span>Assigning access never creates or deletes a mailbox with Hostinger.</span></div>}
    <form onSubmit={add} className="crm-email-assign-form"><div className="crm-email-form-title"><KeyRound size={15}/> Assign an existing mailbox</div><div className="crm-email-form-grid"><label className="crm-settings-field"><span>Available mailbox</span><select required value={selectedResource} onChange={e=>setSelectedResource(e.target.value)} className="crm-settings-select"><option value="">Choose mailbox</option>{available.map(m=><option key={m.resourceId} value={m.resourceId}>{m.address}{m.assignedClientId===clientId?' (already assigned)':''}</option>)}</select></label><label className="crm-settings-field"><span>Display name</span><input value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="e.g. Project team" className="crm-settings-input"/></label><button type="submit" disabled={busy||!selectedResource} className="crm-mail-primary">{busy?'Saving…':'Assign mailbox'}</button></div><p>Mailbox provisioning and billing remain managed in Hostinger. This controls portal access only.</p></form>
  </section>;
}