import React, { useState, useContext, useMemo } from 'react';
import { DataContext } from '../../shared';
import { deleteAuditEntryApi, clearAuditLogApi } from '../../adminApi';

const AuditLog = () => {
  const { auditLog, setAuditLog } = useContext(DataContext);
  const [searchQuery, setSearchQuery] = useState('');
  const [clearing, setClearing] = useState(false);

  const formattedLogs = useMemo(() => {
    const base = (auditLog || []).map((log) => ({
      ...log,
      timestamp: log.timestamp instanceof Date ? log.timestamp : new Date(log.timestamp),
    }));
    base.sort((a, b) => (b.timestamp?.getTime?.() || 0) - (a.timestamp?.getTime?.() || 0));
    return base;
  }, [auditLog]);

  const filteredLogs = useMemo(() => {
    return formattedLogs.filter((log) => {
      if (searchQuery) {
        const haystack = `${log.admin || ''} ${log.action || ''} ${log.details || ''} ${log.clientName || ''}`.toLowerCase();
        if (!haystack.includes(searchQuery.toLowerCase())) return false;
      }
      return true;
    });
  }, [formattedLogs, searchQuery]);

  const handleDeleteEntry = async (log) => {
    if (!window.confirm('Delete this audit log entry?')) return;
    try {
      await deleteAuditEntryApi(log.id);
      if (setAuditLog) setAuditLog(prev => prev.filter(e => e.id !== log.id));
    } catch (err) {
      alert('Could not delete entry: ' + (err.message || 'Unknown error'));
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('Clear the ENTIRE audit log? This cannot be undone.')) return;
    setClearing(true);
    try {
      await clearAuditLogApi();
      if (setAuditLog) setAuditLog([]);
    } catch (err) {
      alert('Could not clear audit log: ' + (err.message || 'Unknown error'));
    } finally {
      setClearing(false);
    }
  };

  return (
    <div id="audit-log-section" className="crm-admin-section">
      <h2>[list] Audit & Activity Logs</h2>

      <div
        className="search-container"
        style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 12 }}
      >
        <input
          type="search"
          id="audit-log-search"
          className="crm-search-input"
          placeholder="[search]  Search by admin, action, client..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ flex: '1 1 240px', minWidth: 220 }}
        />

        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            style={{
              padding: '6px 12px',
              background: 'var(--crm-border)',
              color: '#a3adc0',
              border: '1px solid var(--crm-border)',
              borderRadius: 6,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Clear Search
          </button>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--crm-text-secondary)' }}>
            {filteredLogs.length} of {formattedLogs.length} records
          </span>
          <button
            type="button"
            onClick={handleClearAll}
            disabled={clearing || formattedLogs.length === 0}
            className="crm-btn-danger"
            style={{
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 6,
              background: 'rgba(246,70,93,0.12)',
              border: '1px solid #F6465D',
              color: '#F6465D',
              cursor: clearing || formattedLogs.length === 0 ? 'not-allowed' : 'pointer',
              opacity: clearing || formattedLogs.length === 0 ? 0.5 : 1,
            }}
          >
            {clearing ? 'Clearing...' : 'Clear All Logs'}
          </button>
        </div>
      </div>

      <div className="crm-admin-table-container">
        <table className="crm-admin-table">
          <thead>
            <tr>
              <th style={{ width: '180px' }}>Timestamp</th>
              <th style={{ width: '160px' }}>Actor</th>
              <th style={{ width: '220px' }}>Action</th>
              <th>Details</th>
              <th style={{ width: '70px', textAlign: 'center' }}>Delete</th>
            </tr>
          </thead>
          <tbody id="audit-log-tbody">
            {filteredLogs.length === 0 ? (
              <tr>
                <td
                  colSpan="5"
                  style={{ textAlign: 'center', padding: '32px', color: '#a3adc0' }}
                >
                  No audit logs found.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => (
                <tr key={log.id || `${log.timestamp?.getTime?.()}-${log.action}`}>
                  <td style={{ fontSize: '0.85rem' }}>
                    {log.timestamp instanceof Date && !isNaN(log.timestamp)
                      ? log.timestamp.toLocaleString()
                      : '-'}
                  </td>
                  <td>
                    <strong>{log.admin}</strong>
                  </td>
                  <td>
                    <code
                      style={{
                        fontSize: '0.85rem',
                        background: 'var(--crm-border)',
                        padding: '2px 6px',
                        borderRadius: '3px',
                      }}
                    >
                      {log.action}
                    </code>
                  </td>
                  <td style={{ fontSize: '0.9rem', color: '#b5bac1' }}>{log.details}</td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      title="Delete this entry"
                      onClick={() => handleDeleteEntry(log)}
                      style={{
                        background: 'none',
                        border: '1px solid #F6465D55',
                        color: '#F6465D',
                        borderRadius: 4,
                        padding: '2px 7px',
                        fontSize: 11,
                        cursor: 'pointer',
                      }}
                    >
                      🗑
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AuditLog;
