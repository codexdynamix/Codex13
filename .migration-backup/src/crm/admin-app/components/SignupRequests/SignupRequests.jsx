import React, { useState, useEffect, useCallback } from 'react';
import {
  listSignupRequests,
  approveSignupRequest,
  rejectSignupRequest,
  deleteSignupRequestApi,
} from '../../adminApi';
import MessageReasonPicker from '../MessageReasonPicker/MessageReasonPicker';
import { SIGNUP_REJECTION_REASONS } from '../../data/messageCatalogs';
import { usePlatformSettings } from '../../../platformDefaults';
import '../modal.css';

const REJECTION_REASONS = SIGNUP_REJECTION_REASONS;
const REJECTION_CATEGORIES = Object.keys(REJECTION_REASONS);

function buildApprovalTemplate(name, email, code, platformName) {
  return `Subject: Your ${platformName} Account Has Been Approved

Dear ${name},

Your registration request for ${platformName} has been reviewed and approved.

To complete your account setup, please enter the following verification code when prompted on the platform:

    Verification Code: ${code}

This code is valid for 1 hour. Please visit ${platformName} and sign in using your email address (${email}), then enter the code above to activate your account.

If you have any questions, please do not hesitate to contact our support team.

Best regards,
${platformName} Support Team`;
}

function CopyTemplate({ name, email, code, platformName }) {
  const [copied, setCopied] = useState(false);
  const text = buildApprovalTemplate(name, email, code, platformName);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <div style={{ marginTop: 16, background: '#0B0E11', border: '1px solid #2B3139', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 14px', borderBottom: '1px solid #2B3139', background: 'var(--crm-bg)' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--crm-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          [list] Email template - copy &amp; send manually
        </span>
        <button
          type="button"
          onClick={handleCopy}
          style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #2B3139',
            background: copied ? 'rgba(14,203,129,0.15)' : 'transparent',
            color: copied ? '#0ECB81' : 'var(--crm-text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <pre style={{ margin: 0, padding: '12px 14px', fontSize: 12, color: '#C8CDD5',
        lineHeight: 1.65, fontFamily: 'ui-monospace, monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {text}
      </pre>
    </div>
  );
}

export default function SignupRequests({ data, onLeadCreated, showNotification }) {
  const settings = usePlatformSettings();
  const platformName = settings.platformName || 'Codex Dynamics';

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [action, setAction] = useState(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [assignAgent, setAssignAgent] = useState('');
  const [assignOffice, setAssignOffice] = useState('');
  const [assignTeam, setAssignTeam] = useState('');
  const [rejectMsg, setRejectMsg] = useState('');
  const [selectedReason, setSelectedReason] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { items: rows } = await listSignupRequests(filter);
      setItems(rows);
      setErr('');
    } catch (e) {
      setItems([]);
      setErr(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setSelectedIds([]); }, [filter]);

  const openApprove = (item) => {
    setAction({ item, mode: 'approve' });
    setVerifyCode('');
    setAssignAgent('');
    setAssignOffice('');
    setAssignTeam('');
    setErr('');
  };

  const openReject = (item) => {
    setAction({ item, mode: 'reject' });
    setRejectMsg('');
    setSelectedReason(null);
    setErr('');
  };

  const handleApprove = async () => {
    if (!action?.item || !/^\d{6}$/.test(verifyCode.trim())) {
      setErr('Set a 6-digit verification code to send to the client.');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const result = await approveSignupRequest(action.item.id, {
        verification_code: verifyCode.trim(),
        agent_id: assignAgent || undefined,
        assigned_office_id: assignOffice || undefined,
        assigned_team_id: assignTeam || undefined,
      });
      if (result?.lead && onLeadCreated) onLeadCreated(result.lead);
      showNotification?.(`Approved ${action.item.email} - share verification code with client.`);
      setAction(null);
      load();
    } catch (e) {
      setErr(e?.message || 'Approve failed');
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    if (!action?.item || !rejectMsg.trim()) {
      setErr('Select or enter a rejection reason.');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      await rejectSignupRequest(action.item.id, {
        reason: rejectMsg,
        code: selectedReason?.code || '',
      });
      showNotification?.(`Registration declined for ${action.item.email}`);
      setAction(null);
      load();
    } catch (e) {
      setErr(e?.message || 'Reject failed');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete registration for ${item.email}? This cannot be undone.`)) return;
    try {
      await deleteSignupRequestApi(item.id);
      setItems(prev => prev.filter(r => r.id !== item.id));
      setSelectedIds(prev => prev.filter(id => id !== item.id));
      showNotification?.(`Registration request for ${item.email} deleted.`);
    } catch (e) {
      showNotification?.('Delete failed: ' + (e?.message || 'server error'));
    }
  };

  const handleBulkDelete = async () => {
    const n = selectedIds.length;
    if (!n || !window.confirm(`Permanently delete ${n} registration request(s)? This cannot be undone.`)) return;
    const toDelete = [...selectedIds];
    setSelectedIds([]);
    setItems(prev => prev.filter(r => !toDelete.includes(r.id)));
    await Promise.all(toDelete.map(id => deleteSignupRequestApi(id).catch(() => {})));
    showNotification?.(`Deleted ${n} registration request(s).`);
  };

  const agents = (data?.users || []).filter((u) => u.role === 'Agent');
  const allSelected = items.length > 0 && items.every(r => selectedIds.includes(r.id));

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, color: 'var(--crm-text-primary)', fontSize: 20 }}>Client registrations</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--crm-text-secondary)', fontSize: 13 }}>
            Review signup requests, approve to create leads, and set the email verification code the client will enter.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['pending', 'approved', 'rejected', 'verified', ''].map((s) => (
            <button
              key={s || 'all'}
              type="button"
              onClick={() => setFilter(s)}
              style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: filter === s ? 'var(--crm-accent)' : 'transparent',
                color: filter === s ? '#1A1D23' : 'var(--crm-text-secondary)',
                border: `1px solid ${filter === s ? 'var(--crm-accent)' : '#2B3139'}`,
              }}
            >
              {s || 'All'}
            </button>
          ))}
          <button type="button" className="crm-small-btn" onClick={load}>Refresh</button>
        </div>
      </div>

      {action && (
        <div className="dr-modal-overlay" onClick={() => !busy && setAction(null)}>
          <div className="dr-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">

            <div className="dr-modal__header">
              <h3 className="dr-modal__title">
                {action.mode === 'approve' ? 'Approve registration' : 'Decline registration'}
              </h3>
              <p className="dr-modal__subtitle">
                {action.item.name}  /  {action.item.email}
              </p>
            </div>

            <div className="dr-modal__body">
              {action.mode === 'approve' ? (
                <>
                  <label className="dr-modal__label">6-digit verification code (email to client)</label>
                  <input
                    className="dr-modal__input"
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="e.g. 847291"
                    inputMode="numeric"
                    maxLength={6}
                    pattern="\d{6}"
                    style={{ fontFamily: 'ui-monospace, monospace', letterSpacing: '0.25em', fontSize: 17, textAlign: 'center' }}
                  />

                  {verifyCode.length === 6 && (
                    <CopyTemplate
                      name={action.item.name}
                      email={action.item.email}
                      code={verifyCode}
                      platformName={platformName}
                    />
                  )}

                  <label className="dr-modal__label" style={{ marginTop: 14 }}>Assign to agent (optional)</label>
                  <select className="dr-modal__input" value={assignAgent} onChange={(e) => setAssignAgent(e.target.value)}>
                    <option value="">- Unassigned -</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </>
              ) : (
                <>
                  <p className="dr-modal-section-label">Select a reason - the client will see this message on the login page.</p>
                  <div className="dr-modal-picker-wrap">
                    <MessageReasonPicker
                      catalog={REJECTION_REASONS}
                      categories={REJECTION_CATEGORIES}
                      selectedCode={selectedReason?.code}
                      onSelect={(r) => { setSelectedReason(r); setRejectMsg(r.message); }}
                    />
                  </div>
                  <label className="dr-modal__label">Message to client</label>
                  <textarea
                    className="dr-modal__textarea"
                    value={rejectMsg}
                    onChange={(e) => setRejectMsg(e.target.value)}
                    rows={4}
                  />
                </>
              )}
            </div>

            <div className="dr-modal__footer">
              {err && <div className="dr-modal__error">{err}</div>}
              <div className="dr-modal__actions">
                <button type="button" className="dr-modal__btn dr-modal__btn--ghost" disabled={busy} onClick={() => setAction(null)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className={`dr-modal__btn ${action.mode === 'approve' ? 'dr-modal__btn--approve' : 'dr-modal__btn--reject'}`}
                  disabled={busy}
                  onClick={action.mode === 'approve' ? handleApprove : handleReject}
                >
                  {busy ? 'Processing...' : action.mode === 'approve' ? 'Approve & create lead' : 'Decline registration'}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {selectedIds.length > 0 && (
        <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:12, padding:'8px 14px', background:'var(--crm-card)', borderRadius:8, border:'1px solid rgba(246,70,93,0.3)', flexWrap:'wrap' }}>
          <span style={{ color:'var(--crm-accent)', fontWeight:600, fontSize:12 }}>{selectedIds.length} selected</span>
          <button type="button" onClick={handleBulkDelete}
            style={{ padding:'5px 12px', background:'rgba(246,70,93,0.15)', border:'1px solid rgba(246,70,93,0.4)', borderRadius:6, color:'#F6465D', cursor:'pointer', fontWeight:600, fontSize:12 }}>
            🗑 Delete Selected
          </button>
          <button type="button" onClick={() => setSelectedIds([])}
            style={{ marginLeft:'auto', padding:'4px 10px', background:'transparent', border:'1px solid var(--crm-border)', borderRadius:5, color:'var(--crm-text-secondary)', cursor:'pointer', fontSize:11 }}>
            Clear
          </button>
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--crm-text-secondary)' }}>Loading...</p>
      ) : items.length === 0 ? (
        <p style={{ color: 'var(--crm-text-secondary)' }}>No {filter || ''} registration requests.</p>
      ) : (
        <table className="crm-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: 28 }}>
                <input type="checkbox"
                  checked={allSelected}
                  onChange={e => {
                    if (e.target.checked) setSelectedIds(items.map(r => r.id));
                    else setSelectedIds([]);
                  }}
                />
              </th>
              <th>Name</th><th>Email</th><th>Status</th><th>Submitted</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id}>
                <td>
                  <input type="checkbox"
                    checked={selectedIds.includes(row.id)}
                    onChange={e => setSelectedIds(e.target.checked ? [...selectedIds, row.id] : selectedIds.filter(id => id !== row.id))}
                  />
                </td>
                <td>{row.name}</td>
                <td>{row.email}</td>
                <td>{row.status}</td>
                <td style={{ fontSize: 11, color: 'var(--crm-text-secondary)' }}>{row.createdAt?.slice(0, 16)}</td>
                <td>
                  <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {row.status === 'pending' && (
                      <>
                        <button type="button" className="crm-small-btn" onClick={() => openApprove(row)}>Approve</button>
                        <button type="button" className="crm-small-btn" style={{ color: '#F6465D' }} onClick={() => openReject(row)}>Decline</button>
                      </>
                    )}
                    <button type="button" className="crm-small-btn"
                      title="Delete this request"
                      style={{ color: '#F6465D', background: 'rgba(246,70,93,0.1)', border: '1px solid rgba(246,70,93,0.25)' }}
                      onClick={() => handleDelete(row)}>🗑</button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
