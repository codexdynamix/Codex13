import React, { useState, useEffect, useCallback } from 'react';
import {
  listAdminNotificationsPage,
  markAdminNotificationRead,
  markAllAdminNotificationsRead,
  deleteAdminNotificationApi,
  clearAdminNotificationsApi,
} from '../../adminApi';
import ConfirmModal from '../ConfirmModal/ConfirmModal';

export default function AdminNotificationsInbox({ pollMs = 30000 }) {
  const [rows, setRows] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await listAdminNotificationsPage({ limit: 50 });
      setRows(data.notifications || []);
      setUnreadCount(data.unreadCount ?? 0);
      setError('');
    } catch (e) {
      setError(e?.message || 'Could not load notifications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, pollMs);
    return () => clearInterval(id);
  }, [load, pollMs]);

  const handleRead = async (id) => {
    try {
      await markAdminNotificationRead(id);
      setRows((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (_) {}
  };

  const handleReadAll = async () => {
    try {
      await markAllAdminNotificationsRead();
      setRows((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (_) {}
  };

  const handleDelete = async (id) => {
    try {
      await deleteAdminNotificationApi(id);
      const wasUnread = rows.find(n => n.id === id && !n.read);
      setRows((prev) => prev.filter((n) => n.id !== id));
      if (wasUnread) setUnreadCount((c) => Math.max(0, c - 1));
    } catch (_) {}
  };

  const handleClearAll = () => {
    setConfirm({
      message: 'Clear all admin notifications? This cannot be undone.',
      onConfirm: async () => {
        setConfirm(null);
        try {
          await clearAdminNotificationsApi();
          setRows([]);
          setUnreadCount(0);
        } catch (_) {}
      },
    });
  };

  if (loading && rows.length === 0) {
    return <p style={{ color: 'var(--crm-text-secondary)', fontSize: 13 }}>Loading notifications...</p>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--crm-text-secondary)' }}>
          {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          {unreadCount > 0 && (
            <button type="button" className="crm-small-btn" onClick={handleReadAll}>
              Mark all read
            </button>
          )}
          {rows.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              style={{
                padding: '4px 10px', background: 'rgba(246,70,93,0.12)',
                border: '1px solid #F6465D55', color: '#F6465D',
                borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: 'pointer',
              }}
            >
              🗑 Clear All
            </button>
          )}
        </div>
      </div>
      {error && <p style={{ color: '#F6465D', fontSize: 13 }}>{error}</p>}
      {rows.length === 0 ? (
        <p style={{ color: 'var(--crm-text-secondary)', fontSize: 13 }}>No admin alerts yet - billing, project updates, and messages appear here.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map((n) => (
            <li
              key={n.id}
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                background: n.read ? 'transparent' : 'color-mix(in srgb, var(--crm-accent) 8%, transparent)',
                border: `1px solid ${n.read ? '#2B3139' : 'color-mix(in srgb, var(--crm-accent) 25%, transparent)'}`,
                cursor: n.read ? 'default' : 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 8,
              }}
              onClick={() => !n.read && handleRead(n.id)}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--crm-text-primary)' }}>{n.title || n.kind}</div>
                {n.body && <div style={{ fontSize: 12, color: 'var(--crm-text-secondary)', marginTop: 4 }}>{n.body}</div>}
                <div style={{ fontSize: 11, color: '#5E6673', marginTop: 6 }}>
                  {n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}
                </div>
              </div>
              <button
                title="Delete notification"
                onClick={(e) => { e.stopPropagation(); handleDelete(n.id); }}
                style={{
                  background: 'none', border: '1px solid #F6465D44', color: '#F6465D',
                  borderRadius: 4, padding: '2px 7px', fontSize: 11, cursor: 'pointer', flexShrink: 0,
                }}
              >
                🗑
              </button>
            </li>
          ))}
        </ul>
      )}
      {confirm && (
        <ConfirmModal
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
          confirmLabel="Clear All"
        />
      )}
    </div>
  );
}
