import React, { useState } from 'react';
import {
  Globe,
  ExternalLink,
  Lock,
  ShieldCheck,
  Server,
  Compass,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ArrowRight,
  Info,
  Clock,
  Sparkles,
} from 'lucide-react';
import { portalDb, type PortalClient, type ClientWebsite } from '../../services/portalDatabase';

interface PortalWebsitesProps {
  client: PortalClient;
  onNavigate: (path: string) => void;
}

export function PortalWebsites({ client, onNavigate }: PortalWebsitesProps) {
  const websites = portalDb.getWebsites(client.id);
  const [ssoLoadingId, setSsoLoadingId] = useState<string | null>(null);
  const [ssoError, setSsoError] = useState<string | null>(null);

  const handleOpenBackOffice = (site: ClientWebsite) => {
    setSsoLoadingId(site.id);
    setSsoError(null);

    try {
      const result = portalDb.generateBackOfficeSso(client.id, site.id);
      onNavigate(`/portal/connector-demo?token=${encodeURIComponent(result.ssoToken)}&websiteId=${encodeURIComponent(site.id)}`);
    } catch (err: any) {
      setSsoError(err.message || 'Back office authentication failed.');
    } finally {
      setSsoLoadingId(null);
    }
  };

  return (
    <div className="space-y-8 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-black/[0.06] dark:border-white/[0.08]">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#0071E3] mb-1">
            Digital Properties
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight">
            My Websites &amp; Back Offices
          </h1>
          <p className="text-sm text-[#86868B] mt-1">
            Websites and applications engineered and maintained for <strong className="text-[#1D1D1F] dark:text-white font-medium">{client.company}</strong> by Codex Dynamics.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => onNavigate('/portal/connector-demo')}
            className="px-4 py-2 rounded-2xl bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.07] dark:hover:bg-white/[0.12] text-[#0071E3] text-xs font-semibold border border-black/[0.04] dark:border-white/[0.06] transition-all flex items-center gap-1.5"
          >
            <Layers size={14} />
            <span>SSO Connector Protocol</span>
          </button>
        </div>
      </div>

      {/* Error alert */}
      {ssoError && (
        <div className="p-4 rounded-2xl bg-[#FF3B30]/10 border border-[#FF3B30]/30 text-[#FF3B30] text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} />
            <span>{ssoError}</span>
          </div>
          <button onClick={() => setSsoError(null)} className="text-[#1D1D1F] dark:text-white hover:underline text-xs font-medium">
            Dismiss
          </button>
        </div>
      )}

      {/* Security Architecture Info Box - Apple Callout */}
      <div className="p-5 rounded-2xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] text-xs text-[#86868B] flex items-start gap-3.5 shadow-[0_1px_4px_rgba(0,0,0,0.02)]">
        <div className="size-8 rounded-xl bg-[#30D158]/10 text-[#30D158] flex items-center justify-center shrink-0">
          <ShieldCheck size={18} />
        </div>
        <div className="leading-relaxed">
          <strong className="text-[#1D1D1F] dark:text-white font-medium">Single Sign-On (SSO) Technology:</strong> Clicking{' '}
          <span className="text-[#0071E3] font-semibold">Open Back Office</span> issues a signed, cryptographically verified
          handoff token to your website&apos;s standard Codex Connector. You enter the administrative console with full privileges
          without entering passwords or exposing database secrets.
        </div>
      </div>

      {/* Website Cards Grid */}
      {websites.length === 0 ? (
        <div className="p-16 text-center bg-white dark:bg-[#1C1C1E] border border-dashed border-black/[0.08] dark:border-white/[0.1] rounded-3xl">
          <Globe size={40} className="text-[#86868B] mx-auto mb-3" />
          <h3 className="text-base font-semibold text-[#1D1D1F] dark:text-white">No websites assigned yet</h3>
          <p className="text-xs text-[#86868B] mt-1 max-w-md mx-auto">
            Once a website build or staging link is connected by your Codex Dynamics project manager, it will appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {websites.map((site) => (
            <div
              key={site.id}
              className="p-7 rounded-3xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                {/* Header: Name, domain, status */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h3 className="text-lg font-semibold text-[#1D1D1F] dark:text-white tracking-tight">{site.name}</h3>
                    <div className="text-xs text-[#0071E3] font-mono mt-1 flex items-center gap-1.5 font-medium">
                      <span>{site.domain}</span>
                      <span className="text-black/20 dark:text-white/20">·</span>
                      <span className="text-[#86868B]">{site.connectorId}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-3 py-1 rounded-full text-[11px] font-semibold bg-[#30D158]/10 text-[#248A3D] dark:text-[#32D74B] border border-[#30D158]/20 flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-[#30D158] animate-pulse" />
                      <span>{site.status}</span>
                    </span>
                  </div>
                </div>

                {/* Tech Stack Badges */}
                <div className="flex flex-wrap gap-1.5 my-4">
                  {(site?.techStack || []).map((tech) => (
                    <span
                      key={tech}
                      className="px-2.5 py-1 rounded-xl bg-black/[0.04] dark:bg-white/[0.08] text-[#86868B] dark:text-[#98989D] text-[11px] font-medium"
                    >
                      {tech}
                    </span>
                  ))}
                </div>

                {/* Meta details list */}
                <div className="space-y-2.5 py-3.5 border-t border-b border-black/[0.05] dark:border-white/[0.06] text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[#86868B] flex items-center gap-1.5">
                      <Server size={14} />
                      <span>Hosting Plan:</span>
                    </span>
                    <span className="font-medium text-[#1D1D1F] dark:text-white">{site.hostingPlan}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[#86868B] flex items-center gap-1.5">
                      <Compass size={14} />
                      <span>SSL Status:</span>
                    </span>
                    <span className="font-semibold text-[#248A3D] dark:text-[#32D74B]">{site.sslStatus}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[#86868B] flex items-center gap-1.5">
                      <Lock size={14} />
                      <span>Back Office SSO:</span>
                    </span>
                    <span
                      className={`font-semibold ${
                        site.accessEnabled ? 'text-[#248A3D] dark:text-[#32D74B]' : 'text-[#FF3B30]'
                      }`}
                    >
                      {site.accessEnabled ? 'Enabled (Instant Handoff)' : 'Disabled by Admin'}
                    </span>
                  </div>
                </div>

                {/* Disabled notice banner if disabled from CRM */}
                {!site.accessEnabled && (
                  <div className="mt-3 p-3 rounded-2xl bg-[#FF3B30]/10 border border-[#FF3B30]/20 text-xs text-[#FF3B30] flex items-center gap-2">
                    <AlertTriangle size={15} className="shrink-0" />
                    <span>Administrator has disabled back office access for this site.</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3 mt-6 pt-4 border-t border-black/[0.05] dark:border-white/[0.06]">
                <a
                  href={site.websiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="py-2.5 px-4 rounded-2xl bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.07] dark:hover:bg-white/[0.12] text-[#1D1D1F] dark:text-[#F5F5F7] text-xs font-semibold text-center transition-all flex items-center justify-center gap-1.5"
                >
                  <span>Visit Website</span>
                  <ExternalLink size={13} />
                </a>

                <button
                  type="button"
                  onClick={() => handleOpenBackOffice(site)}
                  disabled={!site.accessEnabled || ssoLoadingId === site.id}
                  className={`py-2.5 px-4 rounded-2xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] ${
                    site.accessEnabled
                      ? 'bg-[#0071E3] hover:bg-[#0077ED] text-white shadow-xs'
                      : 'bg-black/[0.04] dark:bg-white/[0.04] text-[#86868B] cursor-not-allowed border border-black/[0.05] dark:border-white/[0.06]'
                  }`}
                >
                  {ssoLoadingId === site.id ? (
                    <span className="inline-block size-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Lock size={13} />
                      <span>Open Back Office</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
