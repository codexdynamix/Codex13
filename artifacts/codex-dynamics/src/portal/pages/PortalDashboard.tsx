import React, { useState } from 'react';
import {
  Globe,
  Briefcase,
  Receipt,
  Server,
  Compass,
  Headphones,
  ExternalLink,
  Lock,
  ArrowRight,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Calendar,
  Sparkles,
  ShieldCheck,
  ChevronRight,
  CreditCard,
} from 'lucide-react';
import { portalDb, type PortalClient } from '../../services/portalDatabase';

interface PortalDashboardProps {
  client: PortalClient;
  onNavigate: (path: string) => void;
}

export function PortalDashboard({ client, onNavigate }: PortalDashboardProps) {
  const [ssoLoadingWebsiteId, setSsoLoadingWebsiteId] = useState<string | null>(null);
  const [ssoError, setSsoError] = useState<string | null>(null);
  const [ssoSuccessModal, setSsoSuccessModal] = useState<{
    launchUrl: string;
    token: string;
    websiteName: string;
    expiresAt: number;
  } | null>(null);

  // Fetch client-isolated data
  const websites = portalDb.getWebsites(client.id);
  const projects = portalDb.getProjects(client.id);
  const invoices = portalDb.getInvoices(client.id);
  const hosting = portalDb.getHosting(client.id);
  const domains = portalDb.getDomains(client.id);
  const tickets = portalDb.getSupportTickets(client.id);
  const notifications = portalDb.getNotifications(client.id);

  // Calculate metrics
  const activeProjects = projects.filter((p) => p.status === 'In Progress' || p.status === 'Review');
  const openTickets = tickets.filter((t) => t.status === 'Open' || t.status === 'In Progress');
  const outstandingInvoices = invoices.filter((i) => i.status === 'Pending' || i.status === 'Overdue');
  const totalBalanceDue = outstandingInvoices.reduce((sum, i) => sum + i.balanceDue, 0);

  // Next upcoming payment
  const nextPaymentInvoice = outstandingInvoices.sort(
    (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  )[0];

  // Next upcoming hosting renewal
  const nextHostingRenewal = hosting.sort(
    (a, b) => new Date(a.renewalDate).getTime() - new Date(b.renewalDate).getTime()
  )[0];

  // Next expiring domain
  const nextDomainExpiry = domains.sort(
    (a, b) => new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime()
  )[0];

  // Action required items
  const actionItems: { title: string; desc: string; link: string; severity: 'high' | 'medium' | 'info' }[] = [];
  if (totalBalanceDue > 0 && nextPaymentInvoice) {
    actionItems.push({
      title: `Invoice #${nextPaymentInvoice.invoiceNumber} Due ($${nextPaymentInvoice.balanceDue.toLocaleString()})`,
      desc: `Due on ${new Date(nextPaymentInvoice.dueDate).toLocaleDateString()} for ${nextPaymentInvoice.lineItems[0]?.description || 'services'}.`,
      link: '/portal/billing',
      severity: 'high',
    });
  }

  const expiringSoonDomain = domains.find((d) => d.renewalStatus.includes('Expiring Soon'));
  if (expiringSoonDomain) {
    actionItems.push({
      title: `Domain Renewal Alert: ${expiringSoonDomain.domainName}`,
      desc: `Expires on ${new Date(expiringSoonDomain.expirationDate).toLocaleDateString()}. Action required to prevent service interruption.`,
      link: '/portal/domains',
      severity: 'high',
    });
  }

  const ticketWaiting = tickets.find((t) => t.status === 'Waiting for Client');
  if (ticketWaiting) {
    actionItems.push({
      title: `Reply Required: Ticket #${ticketWaiting.ticketNumber}`,
      desc: `Codex Dynamics staff responded to "${ticketWaiting.subject}".`,
      link: '/portal/support',
      severity: 'medium',
    });
  }

  const reviewProject = projects.find((p) => p.status === 'Review');
  if (reviewProject) {
    actionItems.push({
      title: `Milestone Approval: ${reviewProject.name}`,
      desc: 'Deliverables ready for your final inspection and review.',
      link: '/portal/projects',
      severity: 'medium',
    });
  }

  // Handle SSO Click
  const handleOpenBackOffice = (websiteId: string) => {
    setSsoLoadingWebsiteId(websiteId);
    setSsoError(null);

    try {
      const result = portalDb.generateBackOfficeSso(client.id, websiteId);
      setSsoSuccessModal({
        launchUrl: result.launchUrl,
        token: result.ssoToken,
        websiteName: result.website.name,
        expiresAt: result.expiresAt,
      });
    } catch (err: any) {
      setSsoError(err.message || 'Could not authenticate with back office.');
    } finally {
      setSsoLoadingWebsiteId(null);
    }
  };

  return (
    <div className="space-y-8 font-sans">
      {/* Welcome Banner - Apple Cupertino Studio Aesthetic */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-7 sm:p-9 rounded-3xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] shadow-[0_2px_12px_rgba(0,0,0,0.03),0_1px_2px_rgba(0,0,0,0.02)]">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold tracking-wide bg-[#30D158]/10 text-[#248A3D] dark:text-[#32D74B] border border-[#30D158]/20">
              <span className="size-1.5 rounded-full bg-[#30D158] animate-pulse" />
              <span>Account Active</span>
              <span className="opacity-40">·</span>
              <span>{client.tier}</span>
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight">
            Welcome back, {client.name.split(' ')[0]}
          </h1>
          <p className="text-sm text-[#86868B] mt-1.5 leading-relaxed max-w-xl">
            Managing digital properties, ongoing engagements, and infrastructure for{' '}
            <strong className="text-[#1D1D1F] dark:text-white font-medium">{client.company}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('/portal/websites')}
            className="px-5 py-2.5 rounded-2xl bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold transition-all shadow-xs flex items-center gap-2 active:scale-[0.98]"
          >
            <Globe size={15} />
            <span>My Websites ({websites.length})</span>
          </button>
          <button
            onClick={() => onNavigate('/portal/billing')}
            className="px-5 py-2.5 rounded-2xl bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.07] dark:hover:bg-white/[0.12] text-[#1D1D1F] dark:text-[#F5F5F7] text-xs font-semibold border border-black/[0.04] dark:border-white/[0.06] transition-all flex items-center gap-1.5"
          >
            <Receipt size={15} />
            <span>Billing</span>
          </button>
        </div>
      </div>

      {/* Action Required Banner */}
      {actionItems.length > 0 && (
        <div className="p-6 rounded-3xl bg-[#FF9F0A]/[0.06] dark:bg-[#FF9F0A]/[0.1] border border-[#FF9F0A]/25 relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <span className="p-1.5 rounded-xl bg-[#FF9F0A]/15 text-[#B26A00] dark:text-[#FF9F0A]">
                <AlertTriangle size={17} />
              </span>
              <h2 className="text-xs sm:text-sm font-semibold text-[#1D1D1F] dark:text-white uppercase tracking-wider">
                Action Required ({actionItems.length})
              </h2>
            </div>
            <span className="text-xs text-[#86868B]">Items requiring your attention</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {actionItems.map((item, idx) => (
              <div
                key={idx}
                onClick={() => onNavigate(item.link)}
                className="p-4 rounded-2xl bg-white dark:bg-[#1C1C1E] border border-black/[0.05] dark:border-white/[0.08] hover:border-[#0071E3]/40 transition-all cursor-pointer flex items-start justify-between group shadow-xs"
              >
                <div>
                  <div className="text-xs sm:text-sm font-semibold text-[#1D1D1F] dark:text-white group-hover:text-[#0071E3] transition-colors">
                    {item.title}
                  </div>
                  <div className="text-xs text-[#86868B] mt-1 leading-relaxed">{item.desc}</div>
                </div>
                <ArrowRight size={15} className="text-[#86868B] group-hover:text-[#0071E3] group-hover:translate-x-0.5 transition-all shrink-0 mt-1 ml-2" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Primary KPI Metrics Grid - Spacious 4 Columns with Apple Typography */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Websites Card */}
        <div
          onClick={() => onNavigate('/portal/websites')}
          className="p-6 rounded-3xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-[#86868B] text-xs font-medium">
            <span>Web Properties</span>
            <div className="size-8 rounded-xl bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center">
              <Globe size={16} />
            </div>
          </div>
          <div className="text-3xl sm:text-4xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight mt-3 font-mono tabular-nums">
            {websites.length}
          </div>
          <div className="text-xs text-[#248A3D] dark:text-[#32D74B] font-medium mt-2 flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-[#30D158]" />
            <span>All systems nominal</span>
          </div>
        </div>

        {/* Projects Card */}
        <div
          onClick={() => onNavigate('/portal/projects')}
          className="p-6 rounded-3xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-[#86868B] text-xs font-medium">
            <span>Active Engagements</span>
            <div className="size-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Briefcase size={16} />
            </div>
          </div>
          <div className="text-3xl sm:text-4xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight mt-3 font-mono tabular-nums">
            {activeProjects.length}
          </div>
          <div className="text-xs text-[#86868B] font-medium mt-2">
            <span>{projects.length} Total Deliverables</span>
          </div>
        </div>

        {/* Balance Due Card */}
        <div
          onClick={() => onNavigate('/portal/billing')}
          className="p-6 rounded-3xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-[#86868B] text-xs font-medium">
            <span>Outstanding Balance</span>
            <div className="size-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Receipt size={16} />
            </div>
          </div>
          <div
            className={`text-3xl sm:text-4xl font-semibold tracking-tight mt-3 font-mono tabular-nums ${
              totalBalanceDue > 0 ? 'text-[#B26A00] dark:text-[#FF9F0A]' : 'text-[#1D1D1F] dark:text-[#F5F5F7]'
            }`}
          >
            ${totalBalanceDue.toLocaleString()}
          </div>
          <div className="text-xs text-[#86868B] font-medium mt-2">
            {totalBalanceDue > 0 ? `${outstandingInvoices.length} Pending Invoice` : 'All invoices settled'}
          </div>
        </div>

        {/* Infrastructure & Hosting */}
        <div
          onClick={() => onNavigate('/portal/hosting')}
          className="p-6 rounded-3xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-[#86868B] text-xs font-medium">
            <span>Infrastructure Health</span>
            <div className="size-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Server size={16} />
            </div>
          </div>
          <div className="text-3xl sm:text-4xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight mt-3 font-mono tabular-nums">
            99.98%
          </div>
          <div className="text-xs text-[#248A3D] dark:text-[#32D74B] font-medium mt-2 flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-[#30D158]" />
            <span>High availability SLA</span>
          </div>
        </div>
      </div>

      {/* SSO Error Banner */}
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

      {/* ASSIGNED WEBSITES & BACK OFFICES */}
      <div className="p-7 sm:p-9 rounded-3xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-[#1D1D1F] dark:text-white tracking-tight flex items-center gap-2.5">
              <Globe size={20} className="text-[#0071E3]" />
              <span>Assigned Websites &amp; Back Offices</span>
            </h2>
            <p className="text-xs sm:text-sm text-[#86868B] mt-1">
              Production web applications and administrative consoles engineered by Codex Dynamics.
            </p>
          </div>
          <button
            onClick={() => onNavigate('/portal/websites')}
            className="text-xs text-[#0071E3] hover:underline font-semibold flex items-center gap-1 self-start sm:self-auto"
          >
            <span>View All ({websites.length})</span>
            <ChevronRight size={14} />
          </button>
        </div>

        {websites.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-black/[0.08] dark:border-white/[0.1] rounded-2xl text-xs text-[#86868B]">
            No websites have been assigned to your account yet. Contact your Codex Dynamics project manager.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {websites.map((site) => (
              <div
                key={site.id}
                className="p-6 rounded-2xl bg-[#FBFBFC] dark:bg-[#252528] border border-black/[0.05] dark:border-white/[0.07] hover:border-black/[0.1] dark:hover:border-white/[0.14] transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    <div>
                      <h3 className="text-base font-semibold text-[#1D1D1F] dark:text-white leading-snug">
                        {site.name}
                      </h3>
                      <a
                        href={site.websiteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-[#0071E3] hover:underline font-mono inline-flex items-center gap-1 mt-1 font-medium"
                      >
                        <span>{site.domain}</span>
                        <ExternalLink size={12} />
                      </a>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-[#30D158]/10 text-[#248A3D] dark:text-[#32D74B] border border-[#30D158]/20 flex items-center gap-1">
                        <span className="size-1.5 rounded-full bg-[#30D158]" />
                        <span>{site.status}</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 my-3">
                    {(site?.techStack || []).map((tech) => (
                      <span
                        key={tech}
                        className="px-2.5 py-0.5 rounded-lg bg-black/[0.04] dark:bg-white/[0.08] text-[#86868B] dark:text-[#98989D] text-[11px] font-medium"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>

                  <div className="text-xs text-[#86868B] space-y-2 mb-5 pt-3 border-t border-black/[0.05] dark:border-white/[0.06]">
                    <div className="flex items-center justify-between">
                      <span>Hosting Infrastructure:</span>
                      <span className="text-[#1D1D1F] dark:text-white font-medium">{site.hostingPlan}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>SSL Security:</span>
                      <span className="text-[#248A3D] dark:text-[#32D74B] font-medium">{site.sslStatus}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Single Sign-On Status:</span>
                      <span className={site.accessEnabled ? 'text-[#248A3D] dark:text-[#32D74B] font-semibold' : 'text-[#FF3B30] font-semibold'}>
                        {site.accessEnabled ? 'SSO Enabled' : 'Access Restricted'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions: Visit Site & Open Back Office SSO */}
                <div className="flex items-center gap-3 pt-3 border-t border-black/[0.05] dark:border-white/[0.06]">
                  <a
                    href={site.websiteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 py-2.5 px-4 rounded-xl bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.07] dark:hover:bg-white/[0.12] text-[#1D1D1F] dark:text-[#F5F5F7] text-xs font-semibold text-center transition-all flex items-center justify-center gap-1.5"
                  >
                    <span>Visit Website</span>
                    <ExternalLink size={13} />
                  </a>

                  <button
                    onClick={() => handleOpenBackOffice(site.id)}
                    disabled={!site.accessEnabled || ssoLoadingWebsiteId === site.id}
                    title={!site.accessEnabled ? 'Access disabled by administrator' : 'Launch secure Back Office'}
                    className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] ${
                      site.accessEnabled
                        ? 'bg-[#0071E3] hover:bg-[#0077ED] text-white shadow-xs'
                        : 'bg-black/[0.04] dark:bg-white/[0.04] text-[#86868B] cursor-not-allowed border border-black/[0.05] dark:border-white/[0.06]'
                    }`}
                  >
                    {ssoLoadingWebsiteId === site.id ? (
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

      {/* Two-Column Section: Active Projects Progress & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Projects (2 Cols) */}
        <div className="lg:col-span-2 p-7 sm:p-8 rounded-3xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] shadow-[0_2px_8px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base sm:text-lg font-semibold text-[#1D1D1F] dark:text-white tracking-tight flex items-center gap-2">
                <Briefcase size={18} className="text-[#0071E3]" />
                <span>Active Project Milestones</span>
              </h2>
              <button
                onClick={() => onNavigate('/portal/projects')}
                className="text-xs text-[#0071E3] hover:underline font-semibold"
              >
                View timeline
              </button>
            </div>

            {projects.length === 0 ? (
              <div className="text-xs text-[#86868B] text-center py-8">No active projects assigned yet.</div>
            ) : (
              <div className="space-y-4">
                {projects.slice(0, 2).map((proj) => (
                  <div key={proj.id} className="p-5 rounded-2xl bg-[#FBFBFC] dark:bg-[#252528] border border-black/[0.05] dark:border-white/[0.07]">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-semibold text-[#1D1D1F] dark:text-white">{proj.name}</div>
                      <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-[#0071E3]/10 text-[#0071E3] dark:text-[#0A84FF]">
                        {proj.status}
                      </span>
                    </div>
                    <div className="text-xs text-[#86868B] mb-3.5 leading-relaxed">{proj.description}</div>

                    {/* Apple Progress Bar */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs text-[#86868B]">
                        <span>Milestone Completion</span>
                        <span className="font-semibold text-[#1D1D1F] dark:text-white font-mono tabular-nums">{proj.progress}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-black/[0.05] dark:bg-white/[0.1] overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#0071E3] to-[#30D158] rounded-full transition-all duration-500"
                          style={{ width: `${proj.progress}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-[#86868B] mt-3.5 pt-3 border-t border-black/[0.05] dark:border-white/[0.06]">
                      <span>Target Launch: {new Date(proj.targetDate).toLocaleDateString()}</span>
                      <span className="font-medium text-[#1D1D1F] dark:text-white">{proj.teamLead}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between text-xs text-[#86868B]">
            <span>Need a custom milestone adjustment?</span>
            <button
              onClick={() => onNavigate('/portal/support')}
              className="text-[#0071E3] hover:underline font-semibold"
            >
              Request revision &rarr;
            </button>
          </div>
        </div>

        {/* Recent Activity Feed (1 Col) */}
        <div className="p-7 sm:p-8 rounded-3xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] shadow-[0_2px_8px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-[#1D1D1F] dark:text-white tracking-tight mb-5 flex items-center gap-2">
              <Clock size={18} className="text-[#30D158]" />
              <span>Recent Activity</span>
            </h2>

            <div className="space-y-3">
              {notifications.slice(0, 4).map((n) => (
                <div
                  key={n.id}
                  onClick={() => onNavigate(n.link || '/portal/notifications')}
                  className="p-3.5 rounded-2xl bg-[#FBFBFC] dark:bg-[#252528] border border-black/[0.04] dark:border-white/[0.06] hover:border-[#0071E3]/30 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between text-[10px] text-[#86868B] mb-1">
                    <span className="font-semibold uppercase tracking-wider text-[#0071E3]">{n.type}</span>
                    <span className="font-mono">{new Date(n.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="text-xs font-semibold text-[#1D1D1F] dark:text-white">{n.title}</div>
                  <div className="text-[11px] text-[#86868B] mt-0.5 line-clamp-2 leading-relaxed">{n.description}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-black/[0.06] dark:border-white/[0.08] text-center">
            <button
              onClick={() => onNavigate('/portal/notifications')}
              className="text-xs text-[#0071E3] hover:underline font-semibold"
            >
              View complete activity audit &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* SSO Launch Modal Simulation */}
      {ssoSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/[0.1] rounded-3xl p-6 sm:p-7 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3.5 border-b border-black/[0.06] dark:border-white/[0.08]">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-2xl bg-[#30D158]/10 text-[#30D158] flex items-center justify-center">
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#1D1D1F] dark:text-white">SSO Token Generated</h3>
                  <p className="text-xs text-[#86868B]">{ssoSuccessModal.websiteName}</p>
                </div>
              </div>
              <button
                onClick={() => setSsoSuccessModal(null)}
                className="text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-white text-sm p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-4 bg-[#F5F5F7] dark:bg-[#2C2C2E] rounded-2xl border border-black/[0.04] dark:border-white/[0.06] text-xs space-y-2.5">
              <div className="text-xs text-[#248A3D] dark:text-[#32D74B] font-semibold flex items-center gap-1.5">
                <CheckCircle2 size={15} />
                <span>Single-Use Cryptographic Handoff Token (60s TTL)</span>
              </div>
              <div className="font-mono text-[11px] text-[#1D1D1F] dark:text-white break-all bg-white dark:bg-[#1C1C1E] p-3 rounded-xl border border-black/[0.06] dark:border-white/[0.08]">
                {ssoSuccessModal.token}
              </div>
              <div className="text-xs text-[#86868B] leading-relaxed">
                The Codex Dynamics Portal has validated your identity. Clicking launch will securely hand off this token to the website&apos;s Codex Connector.
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setSsoSuccessModal(null)}
                className="px-4 py-2 rounded-xl bg-black/[0.04] dark:bg-white/[0.08] text-[#1D1D1F] dark:text-white text-xs font-semibold hover:bg-black/[0.07]"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setSsoSuccessModal(null);
                  onNavigate('/portal/connector-demo?token=' + encodeURIComponent(ssoSuccessModal.token));
                }}
                className="px-5 py-2 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs"
              >
                <span>Launch Back Office Simulator</span>
                <ExternalLink size={13} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
