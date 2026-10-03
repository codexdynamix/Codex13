import React, { useState, useEffect } from 'react';
import { Bell, CheckCircle2, ArrowRight, Receipt, Compass, Briefcase, Headphones, FolderOpen, Shield } from 'lucide-react';
import { portalDb, type PortalClient, type ClientNotification } from '../../services/portalDatabase';

interface PortalNotificationsProps {
  client: PortalClient;
  onNavigate: (path: string) => void;
}

export function PortalNotifications({ client, onNavigate }: PortalNotificationsProps) {
  const [notifications, setNotifications] = useState<ClientNotification[]>(() => portalDb.getNotifications(client.id));
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const handleUpdate = () => {
      setNotifications(portalDb.getNotifications(client.id));
    };

    portalDb.syncWithServer(client.id)
      .then(handleUpdate)
      .catch((error) => setLoadError(error instanceof Error ? error.message : 'Could not load notifications.'));

    window.addEventListener('cdx_portal_notification_added', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('cdx_portal_notification_added', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [client.id]);

  const handleMarkAllRead = async () => {
    setLoadError('');
    try {
      await portalDb.markAllNotificationsRead(client.id);
      setNotifications(portalDb.getNotifications(client.id));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not update notifications.');
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'invoice':
        return <Receipt className="text-[#FF9F0A]" size={16} />;
      case 'domain':
        return <Compass className="text-[#30D158]" size={16} />;
      case 'project':
        return <Briefcase className="text-[#0071E3]" size={16} />;
      case 'support':
        return <Headphones className="text-purple-500" size={16} />;
      default:
        return <FolderOpen className="text-[#86868B]" size={16} />;
    }
  };

  return (
    <div className="space-y-8 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-black/[0.06] dark:border-white/[0.08]">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#0071E3] mb-1">
            Real-Time Activity
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight">
            Notifications Center
          </h1>
          <p className="text-sm text-[#86868B] mt-1">
            Audit alerts for billing, domain expirations, project deployments, and replies.
          </p>
        </div>

        {notifications.length > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="px-4 py-2 rounded-2xl bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.07] dark:hover:bg-white/[0.12] text-[#0071E3] text-xs font-semibold border border-black/[0.04] dark:border-white/[0.06] transition-all self-start sm:self-auto"
          >
            Mark all as read
          </button>
        )}
      </div>

      {loadError && (
        <div role="alert" className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {loadError}
        </div>
      )}

      {notifications.length === 0 ? (
        <div className="p-16 text-center bg-white dark:bg-[#1C1C1E] border border-dashed border-black/[0.08] dark:border-white/[0.1] rounded-3xl">
          <Bell size={40} className="text-[#86868B] mx-auto mb-3" />
          <h3 className="text-base font-semibold text-[#1D1D1F] dark:text-white">All caught up</h3>
          <p className="text-xs text-[#86868B] mt-1">You have no unread notifications.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => {
                portalDb.markNotificationRead(client.id, n.id);
                if (n.link) onNavigate(n.link);
              }}
              className={`p-5 rounded-2xl border flex items-center justify-between gap-4 transition-all cursor-pointer ${
                n.read
                  ? 'bg-white dark:bg-[#1C1C1E] border-black/[0.06] dark:border-white/[0.08] opacity-80 hover:opacity-100 shadow-[0_2px_8px_rgba(0,0,0,0.02)]'
                  : 'bg-white dark:bg-[#1C1C1E] border-[#0071E3]/40 shadow-sm ring-1 ring-[#0071E3]/20'
              }`}
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="size-10 rounded-2xl bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.04] dark:border-white/[0.06] flex items-center justify-center shrink-0">
                  {getIcon(n.type)}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[#1D1D1F] dark:text-white flex items-center gap-2">
                    <span className="truncate">{n.title}</span>
                    {!n.read && <span className="size-2 rounded-full bg-[#0071E3] shrink-0 animate-pulse" />}
                  </div>
                  <div className="text-xs text-[#86868B] mt-0.5 line-clamp-1">{n.description}</div>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-[#86868B] font-mono">
                  {new Date(n.createdAt).toLocaleDateString()}
                </span>
                <ArrowRight size={15} className="text-[#86868B]" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
