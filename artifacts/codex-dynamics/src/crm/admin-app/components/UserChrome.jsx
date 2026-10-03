import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROLE } from '../shared';
import {
  adminLogout,
  getAdminToken,
  getAdminUnreadMessageCounts,
  getAdminNotificationsUnread,
  markAllAdminNotificationsRead,
  markAllAdminMessagesRead,
  updateStaffApi,
  getAdminPendingCounts,
} from '../adminApi';
import { usePlatformSettings } from '../../platformDefaults';

const POLL_INTERVAL_MS = 30_000;

function useAdminUnreadCounts(enabled) {
  const [counts, setCounts] = useState({ messages: 0, notifications: 0 });
  const msgUserIds  = useRef([]);
  const prevTotal   = useRef(0);
  const [ring, setRing]       = useState(false);
  const [clearing, setClearing] = useState(false);

  const poll = useCallback(async () => {
    if (!enabled) return;
    try {
      const [msg, notif] = await Promise.all([
        getAdminUnreadMessageCounts(),
        getAdminNotificationsUnread(),
      ]);
      const messages      = msg.total || 0;
      const notifications = notif.unreadCount || 0;
      const total         = messages + notifications;

      msgUserIds.current = Object.keys(msg.counts || {}).filter(
        (uid) => (msg.counts[uid] || 0) > 0
      );

      setCounts({ messages, notifications });

      if (total > prevTotal.current && prevTotal.current >= 0) {
        setRing(true);
        setTimeout(() => setRing(false), 1200);
      }
      prevTotal.current = total;
    } catch (_) {}
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [enabled, poll]);

  const markAllRead = useCallback(async () => {
    if (clearing) return;
    setClearing(true);
    setCounts({ messages: 0, notifications: 0 });
    prevTotal.current = 0;
    try {
      await Promise.allSettled([
        markAllAdminNotificationsRead(),
        markAllAdminMessagesRead(msgUserIds.current),
      ]);
    } finally {
      setClearing(false);
      poll();
    }
  }, [clearing, poll]);

  return { counts, ring, marking: clearing, markAllRead };
}

const ROLE_LOGIN_PATH = {
  [ROLE.SUPER_ADMIN]: '/admin/login/super-admin',
  [ROLE.OFFICE_MANAGER]: '/admin/login/office-manager',
  [ROLE.TEAM_LEADER]: '/admin/login/team-leader',
  [ROLE.AGENT]: '/admin/login/agent',
};

const ICON_PROPS = {
  width: 12,
  height: 12,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};
function CopyIcon() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="9" y="9" width="11" height="11" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg {...ICON_PROPS}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function EyeIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function EyeOffIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a19.77 19.77 0 0 1 4.22-5.22" />
      <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 7 11 7a19.86 19.86 0 0 1-3.17 4.19" />
      <path d="M14.12 14.12A3 3 0 1 1 9.88 9.88" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}
function LogoutIcon({ size = 14 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="crm-logout-svg"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function BellIcon({ size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

const ROLE_TAB_MAP = {
  'Super Admin':    { alerts: 'Notifications', messages: 'Client Management' },
  'Agent':          { alerts: 'notifications', messages: 'leads' },
  'Team Leader':    { alerts: 'notifications', messages: 'leads' },
  'Office Manager': { alerts: 'notifications', messages: 'leads' },
};

function NotificationBell({ user }) {
  const isAuthed = Boolean(user && getAdminToken());
  const isSuperAdmin = user?.role === ROLE.SUPER_ADMIN;
  const { counts, ring, marking, markAllRead } = useAdminUnreadCounts(isAuthed);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  const total = counts.messages + counts.notifications;

  useEffect(() => {
    if (!isSuperAdmin || !isAuthed) return;
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, [isSuperAdmin, isAuthed]);

  const gotoTab = useCallback((kind) => {
    const tabs = ROLE_TAB_MAP[user?.role] || ROLE_TAB_MAP['Agent'];
    const tab  = kind === 'alerts' ? tabs.alerts : tabs.messages;
    window.dispatchEvent(new CustomEvent('admin:goto-tab', { detail: { tab } }));
    setOpen(false);
  }, [user?.role]);

  const settings    = usePlatformSettings();
  const baseTitle   = `${settings.platformName || 'Codex Dynamics'} Admin`;

  useEffect(() => {
    if (!isAuthed) return;
    document.title = total > 0 ? `(${total}) ${baseTitle}` : baseTitle;
    return () => { document.title = baseTitle; };
  }, [total, baseTitle, isAuthed]);

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  if (!isAuthed) return null;

  return (
    <div className="crm-notif-bell-wrap" ref={ref}>
      <button
        type="button"
        className={`crm-notif-bell-btn${ring ? ' crm-notif-bell-ring' : ''}`}
        onClick={() => setOpen((o) => !o)}
        title="Notifications"
        aria-label={total > 0 ? `${total} unread` : 'Notifications'}
      >
        <BellIcon size={15} />
        {total > 0 && (
          <span className="crm-notif-badge" aria-hidden="true">
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>

      {open && (
        <div className="crm-notif-dropdown" role="dialog" aria-label="Notifications summary">
          <div className="crm-notif-dropdown-header">
            <span className="crm-notif-dropdown-title">Activity</span>
            {total > 0 && <span className="crm-notif-dropdown-count">{total} unread</span>}
          </div>
          <div className="crm-notif-dropdown-body">
            <div
              className={`crm-notif-row${counts.messages > 0 ? ' is-unread' : ''}`}
              onClick={() => gotoTab('messages')}
              style={{ cursor: 'pointer' }}
              title="Go to messages"
            >
              <span className="crm-notif-row-icon">💬</span>
              <span className="crm-notif-row-label">Client messages</span>
              <span className="crm-notif-row-val">
                {counts.messages > 0 ? (
                  <span className="crm-notif-pill">{counts.messages}</span>
                ) : (
                  <span className="crm-notif-row-clear">All read</span>
                )}
              </span>
              <span style={{ marginLeft: 6, color: 'var(--crm-text-secondary)', fontSize: 10 }}>›</span>
            </div>
            <div
              className={`crm-notif-row${counts.notifications > 0 ? ' is-unread' : ''}`}
              onClick={() => gotoTab('alerts')}
              style={{ cursor: 'pointer' }}
              title="Go to notifications"
            >
              <span className="crm-notif-row-icon">🔔</span>
              <span className="crm-notif-row-label">System alerts</span>
              <span className="crm-notif-row-val">
                {counts.notifications > 0 ? (
                  <span className="crm-notif-pill">{counts.notifications}</span>
                ) : (
                  <span className="crm-notif-row-clear">All read</span>
                )}
              </span>
              <span style={{ marginLeft: 6, color: 'var(--crm-text-secondary)', fontSize: 10 }}>›</span>
            </div>
          </div>
          <div className="crm-notif-dropdown-footer">
            {total > 0 ? (
              <button
                type="button"
                className="crm-notif-mark-all-btn"
                onClick={markAllRead}
                disabled={marking}
              >
                {marking ? 'Clearing...' : 'Mark all as read'}
              </button>
            ) : (
              <span className="crm-notif-all-clear">All caught up</span>
            )}
            <span className="crm-notif-refresh-hint">Refreshes every 30 s</span>
          </div>
        </div>
      )}
    </div>
  );
}

function getInitials(name) {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/);
  const letters = parts.map((p) => p[0] || '').join('');
  return (letters || name[0] || '?').slice(0, 2).toUpperCase();
}

export function UserChrome({ user, data, setData }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [copied, setCopied] = useState('');
  const [signingOut, setSigningOut] = useState(false);

  const isSuperAdmin = user?.role === ROLE.SUPER_ADMIN;
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editConfirm, setEditConfirm] = useState('');
  const [editPwShown, setEditPwShown] = useState(false);
  const [editConfirmShown, setEditConfirmShown] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');

  const office = useMemo(
    () => (user?.officeId ? (data?.offices || []).find((o) => o.id === user.officeId) : null),
    [user, data]
  );
  const team = useMemo(
    () => (user?.teamId ? (data?.teams || []).find((t) => t.id === user.teamId) : null),
    [user, data]
  );

  useEffect(() => {
    if (open && isSuperAdmin) {
      setEditName(user.name || '');
      setEditEmail(user.email || '');
      setEditPassword('');
      setEditConfirm('');
      setEditError('');
      setEditSuccess('');
      setEditPwShown(false);
      setEditConfirmShown(false);
    }
  }, [open, isSuperAdmin, user?.id]);

  const saveAccountDetails = async () => {
    setEditError('');
    setEditSuccess('');
    if (!editName.trim()) return setEditError('Name cannot be empty.');
    if (!editEmail.trim()) return setEditError('Email cannot be empty.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(editEmail.trim())) return setEditError('Please enter a valid email address.');
    if (editPassword && editPassword.length < 8)
      return setEditError('Password must be at least 8 characters.');
    if (editPassword && editPassword !== editConfirm)
      return setEditError('Passwords do not match.');

    setEditSaving(true);
    try {
      const updates = { name: editName.trim(), email: editEmail.trim() };
      if (editPassword) updates.password = editPassword;
      const updated = await updateStaffApi(user.id, updates);
      if (setData) {
        setData(prev => ({
          ...prev,
          users: prev.users.map(u => u.id === user.id ? { ...u, ...updated } : u),
        }));
      }
      setEditPassword('');
      setEditConfirm('');
      setEditSuccess('Details saved successfully.');
    } catch (err) {
      setEditError(err?.message || 'Failed to save. Please try again.');
    } finally {
      setEditSaving(false);
    }
  };

  if (!user) return null;

  const loginPath = ROLE_LOGIN_PATH[user.role] || '/admin';
  const initials = getInitials(user.name);

  const copy = (text, key) => {
    if (!text) return;
    try {
      navigator.clipboard.writeText(text);
    } catch (_) {
      /* clipboard unavailable; ignore */
    }
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? '' : c)), 1400);
  };

  const closeModal = () => {
    setOpen(false);
    setShowPwd(false);
  };

  // Real logout: tell the backend to clear cookies, wipe the local token +
  // profile, then navigate to the role-specific login page with replace so
  // the panel URL can't be revisited via the browser back button.
  const handleLogout = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await adminLogout();
    } finally {
      setOpen(false);
      setShowPwd(false);
      navigate(loginPath, { replace: true });
      setSigningOut(false);
    }
  };

  return (
    <>
      <NotificationBell user={user} />
      <div className="crm-user-chrome">
        <button
          type="button"
          className="crm-user-chip"
          onClick={() => setOpen(true)}
          title="View profile"
        >
          <span className="crm-user-chip-avatar" aria-hidden="true">{initials}</span>
          <span className="crm-user-chip-text">
            <span className="crm-user-chip-name">{user.name}</span>
            <span className="crm-user-chip-role">{user.role}</span>
          </span>
        </button>
        <button
          type="button"
          onClick={handleLogout}
          disabled={signingOut}
          className="crm-logout-btn"
          title="Sign out"
        >
          <span className="crm-logout-icon" aria-hidden="true">
            <LogoutIcon size={14} />
          </span>
          <span className="crm-logout-label">{signingOut ? 'Signing out...' : 'Logout'}</span>
        </button>
      </div>

      {open && (
        <div
          className="crm-profile-overlay"
          onClick={closeModal}
          role="presentation"
        >
          <div
            className="crm-profile-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`${user.name} profile`}
          >
            <div className="crm-profile-header">
              <div className="crm-profile-avatar">{initials}</div>
              <div className="crm-profile-id">
                <h3>{user.name}</h3>
                <span className="crm-profile-role">{user.role}</span>
              </div>
              <button
                type="button"
                className="crm-profile-close"
                onClick={closeModal}
                aria-label="Close profile"
              >
                ✕
              </button>
            </div>

            <div className="crm-profile-body">
              <ProfileRow label="Email" value={user.email || '-'}>
                {user.email && (
                  <button
                    type="button"
                    className="crm-profile-copy"
                    onClick={() => copy(user.email, 'email')}
                    title="Copy email"
                    aria-label="Copy email"
                  >
                    {copied === 'email' ? <CheckIcon /> : <CopyIcon />}
                  </button>
                )}
              </ProfileRow>

              {office && <ProfileRow label="Office" value={office.name} />}
              {team && <ProfileRow label="Team" value={team.name} />}

              <ProfileRow
                label="Password"
                value={
                  showPwd
                    ? (user.password || (isSuperAdmin ? '- update via Edit Account below' : '-'))
                    : '••••••••'
                }
                mono
              >
                <button
                  type="button"
                  className="crm-profile-copy"
                  onClick={() => setShowPwd((v) => !v)}
                  title={showPwd ? 'Hide password' : 'Show password'}
                  aria-label={showPwd ? 'Hide password' : 'Show password'}
                >
                  {showPwd ? <EyeOffIcon /> : <EyeIcon />}
                </button>
                {user.password && (
                  <button
                    type="button"
                    className="crm-profile-copy"
                    onClick={() => copy(user.password, 'pwd')}
                    title="Copy password"
                    aria-label="Copy password"
                  >
                    {copied === 'pwd' ? <CheckIcon /> : <CopyIcon />}
                  </button>
                )}
              </ProfileRow>

              {user.loginLink && (
                <ProfileRow label="Login link" value={user.loginLink} mono link>
                  <button
                    type="button"
                    className="crm-profile-copy"
                    onClick={() => copy(user.loginLink, 'link')}
                    title="Copy login link"
                    aria-label="Copy login link"
                  >
                    {copied === 'link' ? <CheckIcon /> : <CopyIcon />}
                  </button>
                </ProfileRow>
              )}

              <ProfileRow
                label="Status"
                value={
                  <>
                    <span
                      className={
                        'crm-profile-status ' + (user.isLoggedIn ? 'is-online' : 'is-offline')
                      }
                    />
                    {user.isLoggedIn ? 'Online' : 'Offline'}
                  </>
                }
              />
            </div>

            {isSuperAdmin && (
              <div className="crm-profile-edit-section">
                <div className="crm-profile-edit-heading">Edit Account</div>

                {editError && (
                  <div className="crm-profile-edit-banner crm-profile-edit-error">{editError}</div>
                )}
                {editSuccess && (
                  <div className="crm-profile-edit-banner crm-profile-edit-success">{editSuccess}</div>
                )}

                <div className="crm-profile-edit-field">
                  <label className="crm-profile-edit-label">Display Name</label>
                  <input
                    className="crm-super-admin-input"
                    type="text"
                    value={editName}
                    onChange={e => { setEditName(e.target.value); setEditError(''); setEditSuccess(''); }}
                    placeholder="Your full name"
                    autoComplete="name"
                  />
                </div>

                <div className="crm-profile-edit-field">
                  <label className="crm-profile-edit-label">Login Email</label>
                  <input
                    className="crm-super-admin-input"
                    type="email"
                    value={editEmail}
                    onChange={e => { setEditEmail(e.target.value); setEditError(''); setEditSuccess(''); }}
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </div>

                <div className="crm-profile-edit-field">
                  <label className="crm-profile-edit-label">New Password <span className="crm-profile-edit-hint">(leave blank to keep current)</span></label>
                  <div className="crm-pw-input-wrap">
                    <input
                      className="crm-pw-input"
                      type={editPwShown ? 'text' : 'password'}
                      value={editPassword}
                      onChange={e => { setEditPassword(e.target.value); setEditError(''); setEditSuccess(''); }}
                      placeholder="Min. 8 characters"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="crm-pw-toggle"
                      onClick={() => setEditPwShown(v => !v)}
                      aria-label={editPwShown ? 'Hide password' : 'Show password'}
                      title={editPwShown ? 'Hide password' : 'Show password'}
                    >
                      {editPwShown ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a19.77 19.77 0 0 1 4.22-5.22" />
                          <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 7 11 7a19.86 19.86 0 0 1-3.17 4.19" />
                          <path d="M14.12 14.12A3 3 0 1 1 9.88 9.88" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {editPassword && (
                  <div className="crm-profile-edit-field">
                    <label className="crm-profile-edit-label">Confirm New Password</label>
                    <div className="crm-pw-input-wrap">
                      <input
                        className="crm-pw-input"
                        type={editConfirmShown ? 'text' : 'password'}
                        value={editConfirm}
                        onChange={e => { setEditConfirm(e.target.value); setEditError(''); setEditSuccess(''); }}
                        placeholder="Repeat new password"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className="crm-pw-toggle"
                        onClick={() => setEditConfirmShown(v => !v)}
                        aria-label={editConfirmShown ? 'Hide password' : 'Show password'}
                        title={editConfirmShown ? 'Hide password' : 'Show password'}
                      >
                        {editConfirmShown ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a19.77 19.77 0 0 1 4.22-5.22" />
                            <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 7 11 7a19.86 19.86 0 0 1-3.17 4.19" />
                            <path d="M14.12 14.12A3 3 0 1 1 9.88 9.88" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>
                    {editConfirm && editPassword !== editConfirm && (
                      <span className="crm-profile-edit-mismatch">Passwords do not match</span>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  className="crm-profile-edit-save"
                  onClick={saveAccountDetails}
                  disabled={editSaving || (editPassword && editPassword !== editConfirm)}
                >
                  {editSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            )}

            <div className="crm-profile-footer">
              <button
                type="button"
                className="crm-profile-secondary"
                onClick={closeModal}
              >
                Close
              </button>
              <button
                type="button"
                className="crm-profile-logout"
                onClick={handleLogout}
                disabled={signingOut}
              >
                <LogoutIcon size={14} />
                <span>{signingOut ? 'Signing out...' : 'Logout'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ProfileRow({ label, value, mono, link, children }) {
  return (
    <div className="crm-profile-row">
      <span className="crm-profile-label">{label}</span>
      <span
        className={
          'crm-profile-value' +
          (mono ? ' crm-profile-mono' : '') +
          (link ? ' crm-profile-link' : '')
        }
      >
        {value}
      </span>
      {children}
    </div>
  );
}

/**
 * SearchAutocomplete
 * A typeahead-style search input. The parent owns the value (so all existing
 * filtering logic keeps working unchanged); we only add a small floating list
 * of matching suggestions while typing. Picking a suggestion sets the value
 * to its `value` field and closes the dropdown.
 *
 * Props:
 *   value, onChange, placeholder, className, style, autoComplete
 *   buildSuggestions(query) -> Array<{ value, label, meta?, key? }>
 *   fetchSuggestions(query) -> Promise<Array<{ value, label, meta?, key? }>>
 *   onSelect(suggestion) -> optional callback with the selected suggestion
 *   maxSuggestions (default 8)
 *   inputProps (extra props forwarded to the <input>)
 */
export function SearchAutocomplete({
  value,
  onChange,
  placeholder,
  className = 'crm-super-admin-input',
  style,
  autoComplete = 'off',
  buildSuggestions,
  fetchSuggestions,
  onSelect,
  maxSuggestions = 8,
  inputProps = {},
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [remoteSuggestions, setRemoteSuggestions] = useState([]);
  const wrapRef = useRef(null);
  const requestRef = useRef(0);

  const localSuggestions = useMemo(() => {
    const q = (value || '').trim();
    if (!q || !buildSuggestions) return [];
    let list = [];
    try {
      list = buildSuggestions(q) || [];
    } catch (_) {
      list = [];
    }
    return list.slice(0, maxSuggestions);
  }, [value, buildSuggestions, maxSuggestions]);

  useEffect(() => {
    if (!fetchSuggestions) return undefined;

    const q = (value || '').trim();
    const requestId = ++requestRef.current;
    if (!q) {
      setRemoteSuggestions([]);
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const result = await fetchSuggestions(q, { limit: maxSuggestions });
        if (!cancelled && requestId === requestRef.current) {
          setRemoteSuggestions(Array.isArray(result) ? result.slice(0, maxSuggestions) : []);
        }
      } catch (_) {
        // The parent search/table remains usable if the typeahead request
        // fails. Never replace newer results with an older failed request.
        if (!cancelled && requestId === requestRef.current) setRemoteSuggestions([]);
      }
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value, fetchSuggestions, maxSuggestions]);

  const suggestions = fetchSuggestions ? remoteSuggestions : localSuggestions;

  useEffect(() => {
    function onClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  // Keep highlight in range when the suggestion list shrinks/grows.
  useEffect(() => {
    if (highlight >= suggestions.length) setHighlight(-1);
  }, [suggestions, highlight]);

  const showDropdown = open && suggestions.length > 0;

  const pick = (s) => {
    if (!s) return;
    onChange(s.value);
    if (onSelect) onSelect(s);
    setOpen(false);
    setHighlight(-1);
  };

  return (
    <div
      ref={wrapRef}
      className="crm-search-autocomplete"
      style={{
        position: 'relative',
        flex: style?.flex,
        minWidth: style?.minWidth,
        maxWidth: style?.maxWidth,
        width: style?.width,
      }}
    >
      <input
        {...inputProps}
        className={className}
        placeholder={placeholder}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setHighlight(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && suggestions.length > 0) {
            e.preventDefault();
            setOpen(true);
            setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
          } else if (e.key === 'ArrowUp' && suggestions.length > 0) {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
          } else if (e.key === 'Enter') {
            if (showDropdown && highlight >= 0) {
              e.preventDefault();
              pick(suggestions[highlight]);
            }
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
          if (inputProps.onKeyDown) inputProps.onKeyDown(e);
        }}
        style={{ ...style, width: '100%' }}
      />
      {showDropdown && (
        <div className="crm-search-suggest" role="listbox">
          {suggestions.map((s, i) => (
            <button
              type="button"
              key={s.key != null ? s.key : `${s.value}-${i}`}
              role="option"
              aria-selected={i === highlight}
              className={
                'crm-search-suggest-item' + (i === highlight ? ' is-active' : '')
              }
              onMouseEnter={() => setHighlight(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(s);
              }}
            >
              <span className="crm-search-suggest-label">{s.label}</span>
              {s.meta != null && s.meta !== '' && (
                <span className="crm-search-suggest-meta">{s.meta}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default UserChrome;
