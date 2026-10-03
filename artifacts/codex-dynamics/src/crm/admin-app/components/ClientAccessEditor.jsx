import React, { useEffect, useState } from 'react';
import { getClientAccessAdmin, saveClientAccessAdmin } from '../adminApi.js';

const emptyAccess = {
  websiteUrl: '',
  websiteUsername: '',
  emailAddress: '',
  webmailUrl: '',
  imapHost: 'imap.hostinger.com',
  imapPort: 993,
  smtpHost: 'smtp.hostinger.com',
  smtpPort: 465,
  hasWebsitePassword: false,
  hasEmailPassword: false,
};

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  border: '1px solid var(--crm-border, #3b3d45)',
  borderRadius: 8,
  background: 'var(--crm-card, #23242a)',
  color: 'var(--crm-text-primary, #fff)',
  fontSize: 13,
};

function Field({ label, children }) {
  return (
    <label style={{ display: 'grid', gap: 6, color: 'var(--crm-text-secondary, #a1a1aa)', fontSize: 12, fontWeight: 600 }}>
      {label}
      {children}
    </label>
  );
}

export default function ClientAccessEditor({ clientId, showNotification, canEdit = true }) {
  const [access, setAccess] = useState(emptyAccess);
  const [websitePassword, setWebsitePassword] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    getClientAccessAdmin(clientId)
      .then((value) => active && setAccess({ ...emptyAccess, ...(value || {}) }))
      .catch((reason) => active && setError(reason?.message || 'Could not load saved access details.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [clientId]);

  const update = (key, value) => setAccess((current) => ({ ...current, [key]: value }));

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await saveClientAccessAdmin(clientId, { ...access, websitePassword, emailPassword });
      setWebsitePassword('');
      setEmailPassword('');
      setAccess((current) => ({
        ...current,
        hasWebsitePassword: current.hasWebsitePassword || Boolean(websitePassword),
        hasEmailPassword: current.hasEmailPassword || Boolean(emailPassword),
      }));
      showNotification?.('Client access details saved securely.');
    } catch (reason) {
      setError(reason?.message || 'Could not save client access details.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p style={{ color: 'var(--crm-text-secondary, #a1a1aa)', fontSize: 13 }}>Loading client access…</p>;

  return (
    <form onSubmit={save} style={{ display: 'grid', gap: 18 }}>
      <div style={{ padding: 16, border: '1px solid var(--crm-border, #3b3d45)', borderRadius: 12 }}>
        <h3 style={{ margin: '0 0 5px', color: 'var(--crm-text-primary, #fff)', fontSize: 15 }}>Website back office</h3>
        <p style={{ margin: '0 0 14px', color: 'var(--crm-text-secondary, #a1a1aa)', fontSize: 12 }}>
          Clients will see a direct sign-in link and their login details in the portal.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
          <Field label="Back-office link">
            <input disabled={!canEdit} style={inputStyle} type="url" value={access.websiteUrl} onChange={(e) => update('websiteUrl', e.target.value)} placeholder="https://example.com/admin" />
          </Field>
          <Field label="Username or email">
            <input disabled={!canEdit} style={inputStyle} value={access.websiteUsername} onChange={(e) => update('websiteUsername', e.target.value)} autoComplete="off" />
          </Field>
          <Field label={`Password${access.hasWebsitePassword ? ' (saved; leave blank to keep)' : ''}`}>
            {canEdit
              ? <input style={inputStyle} type="password" value={websitePassword} onChange={(e) => setWebsitePassword(e.target.value)} autoComplete="new-password" />
              : <div style={{ ...inputStyle, color: 'var(--crm-text-secondary, #a1a1aa)' }}>{access.hasWebsitePassword ? 'Saved securely · value hidden' : 'Not set'}</div>}
          </Field>
        </div>
      </div>

      <div style={{ padding: 16, border: '1px solid var(--crm-border, #3b3d45)', borderRadius: 12 }}>
        <h3 style={{ margin: '0 0 5px', color: 'var(--crm-text-primary, #fff)', fontSize: 15 }}>Email inbox</h3>
        <p style={{ margin: '0 0 14px', color: 'var(--crm-text-secondary, #a1a1aa)', fontSize: 12 }}>
          Configure the mailbox once. The client can read and reply inside their portal; the password stays encrypted on the server.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
          <Field label="Email address">
            <input disabled={!canEdit} style={inputStyle} type="email" value={access.emailAddress} onChange={(e) => update('emailAddress', e.target.value)} autoComplete="off" />
          </Field>
          <Field label="Hostinger Webmail link">
            <input disabled={!canEdit} style={inputStyle} type="url" value={access.webmailUrl} onChange={(e) => update('webmailUrl', e.target.value)} placeholder="https://mail.hostinger.com" />
          </Field>
          <Field label={`Email password${access.hasEmailPassword ? ' (saved; leave blank to keep)' : ''}`}>
            {canEdit
              ? <input style={inputStyle} type="password" value={emailPassword} onChange={(e) => setEmailPassword(e.target.value)} autoComplete="new-password" />
              : <div style={{ ...inputStyle, color: 'var(--crm-text-secondary, #a1a1aa)' }}>{access.hasEmailPassword ? 'Saved securely · value hidden' : 'Not set'}</div>}
          </Field>
          <Field label="Incoming mail server (IMAP)">
            <input disabled={!canEdit} style={inputStyle} value={access.imapHost} onChange={(e) => update('imapHost', e.target.value)} placeholder="imap.hostinger.com" />
          </Field>
          <Field label="IMAP port">
            <input disabled={!canEdit} style={inputStyle} type="number" min="1" max="65535" value={access.imapPort} onChange={(e) => update('imapPort', Number(e.target.value))} />
          </Field>
          <Field label="Outgoing mail server (SMTP)">
            <input disabled={!canEdit} style={inputStyle} value={access.smtpHost} onChange={(e) => update('smtpHost', e.target.value)} placeholder="smtp.hostinger.com" />
          </Field>
          <Field label="SMTP port">
            <input disabled={!canEdit} style={inputStyle} type="number" min="1" max="65535" value={access.smtpPort} onChange={(e) => update('smtpPort', Number(e.target.value))} />
          </Field>
        </div>
        <div style={{ marginTop: 10, color: 'var(--crm-text-secondary, #a1a1aa)', fontSize: 11 }}>
          Standard Hostinger settings are prefilled: IMAP over SSL on 993 and SMTP over SSL on 465. Change them if this mailbox uses different settings.
        </div>
      </div>

      {error && <div role="alert" style={{ color: '#ff716b', fontSize: 12 }}>{error}</div>}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--crm-text-secondary, #a1a1aa)', fontSize: 11 }}>
          {canEdit
            ? 'Passwords are encrypted at rest and their saved values stay hidden.'
            : 'Read-only access. Saved passwords remain hidden.'}
        </span>
        {canEdit && (
          <button type="submit" disabled={saving} style={{ border: 0, borderRadius: 8, padding: '10px 16px', background: '#0A84FF', color: '#fff', fontWeight: 700, cursor: saving ? 'wait' : 'pointer' }}>
            {saving ? 'Saving…' : 'Save client access'}
          </button>
        )}
      </div>
    </form>
  );
}