import React from 'react';
import { Server, ShieldCheck, CheckCircle2, AlertTriangle, RefreshCw, Cpu, HardDrive, Wifi, ExternalLink } from 'lucide-react';
import { portalDb, type PortalClient } from '../../services/portalDatabase';

interface PortalHostingProps {
  client: PortalClient;
  onNavigate: (path: string) => void;
}

export function PortalHosting({ client, onNavigate }: PortalHostingProps) {
  const hostingList = portalDb.getHosting(client.id);

  return (
    <div className="space-y-8 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-black/[0.06] dark:border-white/[0.08]">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#0071E3] mb-1">
            Cloud Infrastructure
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight">
            Hosting &amp; Server Infrastructure
          </h1>
          <p className="text-sm text-[#86868B] mt-1">
            Dedicated nodes, auto-scaling clusters, and high-availability SLAs for <strong className="text-[#1D1D1F] dark:text-white font-medium">{client.company}</strong>.
          </p>
        </div>

        <button
          onClick={() => onNavigate('/portal/support')}
          className="px-4 py-2 rounded-2xl bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.07] dark:hover:bg-white/[0.12] text-[#1D1D1F] dark:text-[#F5F5F7] text-xs font-semibold border border-black/[0.04] dark:border-white/[0.06] transition-all self-start sm:self-auto"
        >
          Request Scale Up
        </button>
      </div>

      {hostingList.length === 0 ? (
        <div className="p-16 text-center bg-white dark:bg-[#1C1C1E] border border-dashed border-black/[0.08] dark:border-white/[0.1] rounded-3xl">
          <Server size={40} className="text-[#86868B] mx-auto mb-3" />
          <h3 className="text-base font-semibold text-[#1D1D1F] dark:text-white">No hosting nodes assigned</h3>
          <p className="text-xs text-[#86868B] mt-1 max-w-md mx-auto">
            Hosting subscriptions and dedicated server clusters will appear here once provisioned.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {hostingList.map((host) => (
            <div
              key={host.id}
              className="p-7 rounded-3xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] shadow-[0_2px_8px_rgba(0,0,0,0.03)] space-y-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-[11px] font-semibold tracking-wide text-[#0071E3] bg-[#0071E3]/10 px-2.5 py-0.5 rounded-full">
                    {host.provider}
                  </span>
                  <h3 className="text-lg font-semibold text-[#1D1D1F] dark:text-white mt-2 tracking-tight">{host.websiteName}</h3>
                  <div className="text-xs text-[#86868B] mt-0.5">{host.plan}</div>
                </div>

                <span className="px-3 py-1 rounded-full text-[11px] font-semibold bg-[#30D158]/10 text-[#248A3D] dark:text-[#32D74B] border border-[#30D158]/20 flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-[#30D158] animate-pulse" />
                  <span>{host.status}</span>
                </span>
              </div>

              {/* Server Specs Table */}
              <div className="p-5 rounded-2xl bg-[#FBFBFC] dark:bg-[#252528] border border-black/[0.05] dark:border-white/[0.07] text-xs space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[#86868B] flex items-center gap-2">
                    <Wifi size={14} />
                    <span>Server Region:</span>
                  </span>
                  <span className="text-[#1D1D1F] dark:text-white font-medium">{host.serverRegion}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-[#86868B] flex items-center gap-2">
                    <Cpu size={14} />
                    <span>IP Address:</span>
                  </span>
                  <span className="font-mono text-[#1D1D1F] dark:text-white">{host.ipAddress}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-[#86868B] flex items-center gap-2">
                    <HardDrive size={14} />
                    <span>Uptime Guarantee:</span>
                  </span>
                  <span className="text-[#248A3D] dark:text-[#32D74B] font-semibold">{host.uptime}</span>
                </div>

                <div className="flex justify-between items-center pt-2.5 border-t border-black/[0.05] dark:border-white/[0.06]">
                  <span className="text-[#86868B]">Renewal Date:</span>
                  <span className="text-[#1D1D1F] dark:text-white font-medium">{new Date(host.renewalDate).toLocaleDateString()}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-[#86868B]">Billing Frequency:</span>
                  <span className="text-[#1D1D1F] dark:text-white font-medium">${host.amount} / {host.billingFrequency}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-[#86868B]">Auto-Renewal:</span>
                  <span className={host.autoRenew ? 'text-[#248A3D] dark:text-[#32D74B] font-semibold' : 'text-[#FF9F0A] font-semibold'}>
                    {host.autoRenew ? 'Enabled (Automatic)' : 'Manual Renewal'}
                  </span>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between text-xs text-[#86868B]">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-[#30D158]" />
                  <span>Automated daily backups verified</span>
                </span>
                <button
                  onClick={() => onNavigate('/portal/support')}
                  className="text-[#0071E3] hover:underline font-semibold"
                >
                  Server settings &rarr;
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
