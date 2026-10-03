import React, { useState, useEffect, useRef } from 'react';
import './HealthIndicator.css';
import { getAdminStatus } from '../../adminApi';

export default function HealthIndicator({ token }) {
  const [status, setStatus] = useState(null);
  const [open, setOpen]     = useState(false);
  const popRef = useRef(null);

  const fetchStatus = async () => {
    try {
      const data = await getAdminStatus(token);
      if (data) setStatus(data);
    } catch (_) {}
  };

  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, 15000);
    return () => clearInterval(id);
  }, [token]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (popRef.current && !popRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (!status) {
    return (
      <div className="hi-pill hi-loading" title="Loading system status...">
        <span className="hi-dot hi-dot-grey" />
        <span className="hi-label">...</span>
      </div>
    );
  }

  const dbMs     = status.db_ms ?? 0;
  const dotClass = dbMs < 50 ? 'hi-dot-green' : dbMs < 200 ? 'hi-dot-yellow' : 'hi-dot-red';

  return (
    <div className="hi-wrapper" ref={popRef}>
      <button
        className="hi-pill"
        onClick={() => setOpen(v => !v)}
        title="System health - click for details"
      >
        <span className={`hi-dot ${dotClass}`} />
        <span className="hi-label">{status.online_total} online</span>
        <span className="hi-sep"> / </span>
        <span className="hi-label hi-ms">{dbMs}ms</span>
      </button>

      {open && (
        <div className="hi-popup">
          <div className="hi-popup-title">System Status</div>
          <div className="hi-popup-row">
            <span className="hi-popup-key">DB response</span>
            <span className={`hi-popup-val ${dbMs < 50 ? 'hi-green' : dbMs < 200 ? 'hi-yellow' : 'hi-red'}`}>
              {dbMs}ms
            </span>
          </div>
          <div className="hi-popup-divider" />
          <div className="hi-popup-row">
            <span className="hi-popup-key">Staff online</span>
            <span className="hi-popup-val hi-green">{status.online_staff}</span>
          </div>
          <div className="hi-popup-row">
            <span className="hi-popup-key">Clients online</span>
            <span className="hi-popup-val hi-green">{status.online_clients}</span>
          </div>
          <div className="hi-popup-row">
            <span className="hi-popup-key">Visitors today</span>
            <span className="hi-popup-val">{status.visitor_today}</span>
          </div>
          <div className="hi-popup-footer">Updates every 15 s</div>
        </div>
      )}
    </div>
  );
}
