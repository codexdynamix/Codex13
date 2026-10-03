import React, { useState, useEffect, useCallback } from 'react';
import './Sessions.css';
import {
  listSessions,
  getAdminStatus,
  deleteSession,
  bulkDeleteSessions,
  forceLogoutSession,
  getSessionDetail,
} from '../../adminApi';

export default function Sessions({ token }) {
  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState({
    online_total: 0,
    online_staff: 0,
    online_clients: 0,
    visitor_today: 0,
  });
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [activeDetail, setActiveDetail] = useState(null);
  const [toast, setToast] = useState('');

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [sessRes, statRes] = await Promise.all([
        listSessions(token, { type: activeTab === 'all' ? undefined : activeTab }),
        getAdminStatus(token),
      ]);
      setSessions(sessRes?.sessions || []);
      if (statRes) setStats(statRes);
    } catch (err) {
      console.error('Error loading sessions:', err);
    } finally {
      setLoading(false);
    }
  }, [token, activeTab]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, [loadData]);

  const filteredSessions = sessions.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (s.display_name && s.display_name.toLowerCase().includes(q)) ||
      (s.display_email && s.display_email.toLowerCase().includes(q)) ||
      (s.role && s.role.toLowerCase().includes(q)) ||
      (s.city && s.city.toLowerCase().includes(q)) ||
      (s.country && s.country.toLowerCase().includes(q)) ||
      (s.ip && s.ip.includes(q))
    );
  });

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(filteredSessions.map((s) => s.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleDelete = async (id) => {
    try {
      await deleteSession(token, id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      showToast('Session terminated');
    } catch {
      showToast('Failed to terminate session');
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;
    try {
      await bulkDeleteSessions(token, selectedIds);
      setSessions((prev) => prev.filter((s) => !selectedIds.includes(s.id)));
      setSelectedIds([]);
      showToast(`${selectedIds.length} sessions cleared`);
    } catch {
      showToast('Bulk delete failed');
    }
  };

  const handleForceLogout = async (id) => {
    try {
      await forceLogoutSession(token, id);
      showToast('User logged out successfully');
      loadData();
    } catch {
      showToast('Force logout failed');
    }
  };

  const handleOpenDetail = async (id) => {
    try {
      const detail = await getSessionDetail(token, id);
      setActiveDetail(detail);
    } catch (err) {
      console.error(err);
    }
  };

  const formatTime = (sec) => {
    if (!sec) return '-';
    return new Date(sec * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getRoleClass = (role) => {
    switch (role) {
      case 'Super Admin':
        return 'sess-role-sa';
      case 'Office Manager':
        return 'sess-role-om';
      case 'Team Leader':
        return 'sess-role-tl';
      case 'Agent':
        return 'sess-role-ag';
      default:
        return 'sess-role-cl';
    }
  };

  return (
    <div className="sess-page">
      {toast && <div className="sess-toast sess-toast-success">{toast}</div>}

      <div className="sess-stats">
        <div className="sess-stat-card green">
          <div className="sess-stat-num">{stats.online_total || sessions.length}</div>
          <div className="sess-stat-lbl">Active Now</div>
        </div>
        <div className="sess-stat-card blue">
          <div className="sess-stat-num">{stats.online_staff || 0}</div>
          <div className="sess-stat-lbl">Staff Online</div>
        </div>
        <div className="sess-stat-card">
          <div className="sess-stat-num">{stats.online_clients || 0}</div>
          <div className="sess-stat-lbl">Clients Online</div>
        </div>
        <div className="sess-stat-card">
          <div className="sess-stat-num">{stats.visitor_today || 0}</div>
          <div className="sess-stat-lbl">Visitors Today</div>
        </div>
      </div>

      <div className="sess-tabs">
        {['all', 'admin', 'client'].map((tab) => (
          <button
            key={tab}
            className={`sess-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'all' ? 'All Sessions' : tab === 'admin' ? 'Staff' : 'Clients'}
          </button>
        ))}
      </div>

      {selectedIds.length > 0 && (
        <div className="sess-bulk-bar">
          <span className="sess-bulk-count">{selectedIds.length} selected</span>
          <button className="sess-bulk-btn delete" onClick={handleBulkDelete}>
            Terminate Selected
          </button>
          <button className="sess-bulk-btn cancel" onClick={() => setSelectedIds([])}>
            Cancel
          </button>
        </div>
      )}

      <div className="sess-search">
        <input
          type="text"
          className="sess-search-input"
          placeholder="Filter by name, email, IP, role, or country..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="sess-table-wrap">
        <table className="sess-table">
          <thead>
            <tr>
              <th style={{ width: 32 }}>
                <input
                  type="checkbox"
                  checked={
                    filteredSessions.length > 0 &&
                    selectedIds.length === filteredSessions.length
                  }
                  onChange={handleSelectAll}
                />
              </th>
              <th>User</th>
              <th>Role</th>
              <th>Status</th>
              <th>Location / IP</th>
              <th>Current Page</th>
              <th>Logged In</th>
              <th>Last Seen</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="9" className="sess-empty">Loading sessions...</td>
              </tr>
            ) : filteredSessions.length === 0 ? (
              <tr>
                <td colSpan="9" className="sess-empty">No active sessions found</td>
              </tr>
            ) : (
              filteredSessions.map((s) => (
                <tr
                  key={s.id}
                  className={`sess-row ${selectedIds.includes(s.id) ? 'selected' : ''}`}
                >
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(s.id)}
                      onChange={() => handleToggleSelect(s.id)}
                    />
                  </td>
                  <td>
                    <div
                      className="sess-name-cell"
                      style={{ cursor: 'pointer' }}
                      onClick={() => handleOpenDetail(s.id)}
                    >
                      <div className="sess-avatar">
                        {(s.display_name || 'U').charAt(0)}
                      </div>
                      <div>
                        <div className="sess-name">{s.display_name || 'Anonymous'}</div>
                        <div className="sess-email">{s.display_email || s.ip}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`sess-role-badge ${getRoleClass(s.role)}`}>
                      {s.role || s.user_type || 'Guest'}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`sess-online-dot ${s.is_online ? 'online' : ''}`}
                    />
                    <span style={{ fontSize: 11 }}>{s.is_online ? 'Online' : 'Offline'}</span>
                  </td>
                  <td>
                    <div className="sess-flag-wrap">
                      <span className="sess-city">{s.city ? `${s.city}, ` : ''}{s.country || s.ip}</span>
                    </div>
                  </td>
                  <td className="sess-path">{s.current_page || '/'}</td>
                  <td className="sess-time">{formatTime(s.logged_in_at)}</td>
                  <td className="sess-time">{formatTime(s.last_seen_at)}</td>
                  <td>
                    <div className="sess-action-cell">
                      <button
                        className="sess-track-btn"
                        onClick={() => handleOpenDetail(s.id)}
                        title="View session details"
                      >
                        Details
                      </button>
                      <button
                        className="sess-track-btn danger"
                        onClick={() => handleForceLogout(s.id)}
                        title="Force logout"
                      >
                        Logout
                      </button>
                      <button
                        className="sess-track-btn delete-btn"
                        onClick={() => handleDelete(s.id)}
                        title="Terminate session"
                      >
                        ×
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {activeDetail && (
        <div className="sess-modal-overlay" onClick={() => setActiveDetail(null)}>
          <div className="sess-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sess-detail-header">
              <div className="sess-detail-identity">
                <div className="sess-detail-avatar">
                  {(activeDetail.session?.display_name || 'U').charAt(0)}
                </div>
                <div>
                  <div className="sess-detail-name">
                    {activeDetail.session?.display_name || 'Session Detail'}
                  </div>
                  <div className="sess-detail-email">
                    {activeDetail.session?.display_email || activeDetail.session?.ip}
                  </div>
                </div>
              </div>
              <button
                className="sess-modal-close"
                onClick={() => setActiveDetail(null)}
              >
                ✕
              </button>
            </div>
            <div className="sess-detail-body">
              <div className="sess-detail-stats-row">
                <div className="sess-detail-stat">
                  <div className="sess-detail-stat-num">
                    {activeDetail.stats?.total_sessions || 1}
                  </div>
                  <div className="sess-detail-stat-lbl">Total Sessions</div>
                </div>
                <div className="sess-detail-stat">
                  <div className="sess-detail-stat-num">
                    {Math.round((activeDetail.stats?.avg_duration_sec || 0) / 60)}m
                  </div>
                  <div className="sess-detail-stat-lbl">Avg Duration</div>
                </div>
              </div>
              <div className="sess-detail-info-grid">
                <div className="sess-info-row">
                  <span className="sess-info-lbl">IP Address:</span>
                  <span className="sess-info-val">{activeDetail.session?.ip || '-'}</span>
                </div>
                <div className="sess-info-row">
                  <span className="sess-info-lbl">Location:</span>
                  <span className="sess-info-val">
                    {activeDetail.session?.city ? `${activeDetail.session.city}, ` : ''}
                    {activeDetail.session?.country || '-'}
                  </span>
                </div>
                <div className="sess-info-row">
                  <span className="sess-info-lbl">Current Page:</span>
                  <span className="sess-info-val">{activeDetail.session?.current_page || '-'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
