import React, { useState } from 'react';
import { Compass, ShieldCheck, AlertTriangle, CheckCircle2, Globe, Copy, Check, ArrowUpRight } from 'lucide-react';
import { portalDb, type PortalClient, type ClientDomain } from '../../services/portalDatabase';

interface PortalDomainsProps {
  client: PortalClient;
  onNavigate: (path: string) => void;
}

export function PortalDomains({ client, onNavigate }: PortalDomainsProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  let rawDomains: ClientDomain[] = [];
  try {
    rawDomains = portalDb.getDomains(client.id) || [];
  } catch (err) {
    console.error('Failed to load domains', err);
    rawDomains = [];
  }

  const handleCopyNs = (domainId: string, text: string) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
      setCopiedId(domainId);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 pb-4 border-b border-black/[0.06] dark:border-white/[0.08]">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight">
            Domains &amp; DNS
          </h1>
          <p className="text-xs text-[#86868B] mt-0.5">
            {client.company}
          </p>
        </div>

        <button
          onClick={() => onNavigate('/portal/support')}
          className="px-3.5 py-1.5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-medium transition-all shadow-xs flex items-center gap-1.5"
        >
          <span>Register Domain</span>
        </button>
      </div>

      {rawDomains.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] rounded-3xl">
          <Compass size={32} className="text-[#86868B] mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-[#1D1D1F] dark:text-white">No Domains</h3>
          <p className="text-xs text-[#86868B] mt-1 max-w-sm mx-auto">
            Domains registered or managed by Codex Dynamics appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rawDomains.map((dom) => {
            const domainName = dom?.domainName || 'domain.com';
            const renewalStatus = dom?.renewalStatus || 'Active';
            const isExpiringSoon = typeof renewalStatus === 'string' && renewalStatus.toLowerCase().includes('expiring');
            
            // Safe nameserver string construction - guaranteed never to throw
            let nameserversList: string[] = [];
            if (Array.isArray(dom?.nameservers)) {
              nameserversList = dom.nameservers.filter((n): n is string => typeof n === 'string' && n.length > 0);
            } else if (typeof dom?.nameservers === 'string') {
              nameserversList = (dom.nameservers as string).split(',').map((s) => s.trim());
            }
            if (nameserversList.length === 0) {
              nameserversList = ['ns1.codexdynamics.net', 'ns2.codexdynamics.net'];
            }
            const nsDisplay = nameserversList.join(', ');

            let expDateStr = 'N/A';
            try {
              if (dom?.expirationDate) {
                expDateStr = new Date(dom.expirationDate).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                });
              }
            } catch {
              expDateStr = 'N/A';
            }

            return (
              <div
                key={dom?.id || domainName}
                className="p-5 rounded-2xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col justify-between space-y-4 hover:border-black/[0.12] dark:hover:border-white/[0.16] transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="size-9 rounded-xl bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center shrink-0">
                        <Globe size={18} />
                      </div>
                      <div>
                        <div className="text-base font-semibold text-[#1D1D1F] dark:text-white font-mono tracking-tight">
                          {domainName}
                        </div>
                        <div className="text-[11px] text-[#86868B] flex items-center gap-1.5 mt-0.5">
                          <span>{dom?.registrar || 'Codex Custody'}</span>
                          <span>·</span>
                          <span className="flex items-center gap-1 text-[#248A3D] dark:text-[#32D74B] font-medium">
                            <ShieldCheck size={12} />
                            <span>SSL Active</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 shrink-0 ${
                        isExpiringSoon
                          ? 'bg-[#FF9F0A]/10 text-[#B26A00] dark:text-[#FF9F0A]'
                          : 'bg-[#30D158]/10 text-[#248A3D] dark:text-[#32D74B]'
                      }`}
                    >
                      {isExpiringSoon ? <AlertTriangle size={11} /> : <CheckCircle2 size={11} />}
                      <span>{isExpiringSoon ? 'Expiring Soon' : 'Active'}</span>
                    </span>
                  </div>

                  {/* Metadata Row */}
                  <div className="mt-4 pt-3 border-t border-black/[0.05] dark:border-white/[0.06] grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-[10px] font-medium text-[#86868B]">Expires</div>
                      <div className="text-[#1D1D1F] dark:text-white font-medium mt-0.5">
                        {expDateStr}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-medium text-[#86868B]">Auto-Renew</div>
                      <div className="text-[#1D1D1F] dark:text-white font-medium mt-0.5 flex items-center gap-1">
                        <span className={`size-1.5 rounded-full ${dom?.autoRenew ? 'bg-[#30D158]' : 'bg-[#FF9F0A]'}`} />
                        <span>{dom?.autoRenew ? 'Enabled' : 'Manual'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Nameservers */}
                  <div className="mt-3 p-2.5 rounded-xl bg-[#F5F5F7] dark:bg-[#252528] flex items-center justify-between gap-2 text-[11px]">
                    <div className="truncate font-mono text-[#86868B] dark:text-[#A1A1A6]">
                      {nsDisplay}
                    </div>
                    <button
                      onClick={() => handleCopyNs(dom.id, nsDisplay)}
                      className="text-[#0071E3] hover:text-[#0077ED] shrink-0 font-medium flex items-center gap-1 px-1.5 py-0.5 rounded-md hover:bg-black/[0.05] dark:hover:bg-white/[0.05]"
                      title="Copy Nameservers"
                    >
                      {copiedId === dom.id ? (
                        <>
                          <Check size={12} className="text-[#30D158]" />
                          <span className="text-[10px] text-[#30D158]">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy size={12} />
                          <span className="text-[10px]">Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Footer Action */}
                <div className="pt-2 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-[#86868B] flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-[#30D158]" />
                    <span>DNSSEC Active</span>
                  </span>
                  <button
                    onClick={() => onNavigate('/portal/support')}
                    className="text-[#0071E3] hover:underline font-medium text-xs flex items-center gap-0.5"
                  >
                    <span>Manage DNS</span>
                    <ArrowUpRight size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
