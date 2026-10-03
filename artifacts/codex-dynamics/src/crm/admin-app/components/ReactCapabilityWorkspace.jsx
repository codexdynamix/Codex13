import React, { useEffect, useState } from 'react';
import Notifications from './Notifications/Notifications.jsx';
import SiteCrmWorkspace from './SiteCrmWorkspace.jsx';
import { DataContext, NotificationContext } from '../shared';
import { getStaffCapabilities } from '../adminApi';

const ContentTool = (props) => <SiteCrmWorkspace {...props} defaultTab="content" standalone />;
const EnquiriesTool = (props) => <SiteCrmWorkspace {...props} defaultTab="enquiries" standalone />;
const ChatTool = (props) => <SiteCrmWorkspace {...props} defaultTab="chat" standalone />;

// Security section in header is removed because Lead Security is directly managed in the client profile
const TOOLS = [
  ['notifications', 'Notifications', Notifications],
  ['content', 'Content', ContentTool],
  ['enquiries', 'Enquiries', EnquiriesTool],
  ['chat', 'Chat', ChatTool],
];

const DEFAULT_CAPABILITIES = {
  notifications: true,
  content: true,
  enquiries: true,
  chat: true,
};

export default function ReactCapabilityWorkspace({
  data,
  currentUser,
  showNotification,
  activeTab,
  onActiveChange,
  nativeTabKeys = [],
  fallbackTab,
  excludeTools = [],
  showPanel = true,
}) {
  const [capabilities, setCapabilities] = useState({});
  const [internalActive, setInternalActive] = useState('');
  const [capabilitiesLoaded, setCapabilitiesLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const refreshCapabilities = () => {
      setCapabilitiesLoaded(false);
      Promise.resolve(getStaffCapabilities(currentUser?.id))
        .then((payload) => {
          if (cancelled) return;
          const next = {
            ...DEFAULT_CAPABILITIES,
            ...(payload?.capabilities || {}),
          };
          setCapabilities(next);
          const first = TOOLS.find(([key]) => next[key]);
          setInternalActive((prev) => (prev && next[prev] ? prev : (first?.[0] || '')));
          setCapabilitiesLoaded(true);
        })
        .catch(() => {
          if (!cancelled) setCapabilitiesLoaded(true);
        });
    };

    refreshCapabilities();

    const handleUpdated = (event) => {
      const detail = event?.detail;
      if (!detail || !currentUser?.id || detail.staffId === currentUser.id) {
        refreshCapabilities();
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('codex-capabilities-updated', handleUpdated);
    }
    return () => {
      cancelled = true;
      if (typeof window !== 'undefined') {
        window.removeEventListener('codex-capabilities-updated', handleUpdated);
      }
    };
  }, [currentUser?.id]);

  const visibleTools = TOOLS.filter(([key]) => capabilities[key] && !excludeTools.includes(key));
  const selectedKey = activeTab === undefined ? internalActive : activeTab;
  const current = visibleTools.find(([key]) => key === selectedKey);

  useEffect(() => {
    if (!capabilitiesLoaded || activeTab === undefined || nativeTabKeys.includes(activeTab)) return;
    if (!visibleTools.some(([key]) => key === activeTab) && fallbackTab) {
      onActiveChange?.(fallbackTab);
    }
  }, [activeTab, capabilitiesLoaded, fallbackTab, nativeTabKeys, onActiveChange, visibleTools]);

  if (!visibleTools.length) return null;
  const Component = current?.[2];
  const scopedClients = data?.leads || [];
  const props = ['content', 'enquiries', 'chat'].includes(current?.[0])
    ? { showNotification, leads: scopedClients }
    : {};

  const contextValue = {
    currentUser,
    clientUsers: scopedClients,
    leads: scopedClients, setLeads: () => {},
    users: scopedClients, setUsers: () => {},
    activityLog: [], setActivityLog: () => {},
    logAdminAction: () => {}, logActivity: () => {},
  };

  return (
    <DataContext.Provider value={contextValue}>
      <NotificationContext.Provider value={showNotification || (() => {})}>
        <section className="crm-react-capability-workspace">
          <div className="crm-super-admin-header crm-role-panel-header crm-react-capability-header">
            <nav className="crm-super-admin-tabs crm-react-capability-tabs" aria-label="Granted tools">
              {visibleTools.map(([key, label]) => (
                <button key={key} type="button" className={`crm-super-admin-tab-btn ${selectedKey === key ? 'crm-active' : ''}`} onClick={() => { setInternalActive(key); onActiveChange?.(key); }}>
                  {label}
                </button>
              ))}
            </nav>
          </div>
          {showPanel && current && <div className="crm-react-capability-panel"><Component {...props} /></div>}
        </section>
      </NotificationContext.Provider>
    </DataContext.Provider>
  );
}
