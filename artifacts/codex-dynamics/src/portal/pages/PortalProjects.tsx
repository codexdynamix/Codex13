import React, { useEffect, useState } from 'react';
import {
  Briefcase,
  CheckCircle2,
  Clock,
  Calendar,
  User,
  ArrowRight,
  FolderOpen,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  ThumbsUp,
  FileCheck,
} from 'lucide-react';
import { portalDb, type PortalClient, type ClientProject } from '../../services/portalDatabase';

interface PortalProjectsProps {
  client: PortalClient;
  onNavigate: (path: string) => void;
}

export function PortalProjects({ client, onNavigate }: PortalProjectsProps) {
  const [projects, setProjects] = useState<ClientProject[]>([]);
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [approvalError, setApprovalError] = useState('');
  const [savingMilestoneKey, setSavingMilestoneKey] = useState('');

  useEffect(() => {
    let active = true;
    setProjects([]);
    setExpandedProjectId(null);
    setIsLoading(true);
    setLoadError('');
    void portalDb.syncWithServer(client.id)
      .then(() => {
        if (!active) return;
        const currentProjects = portalDb.getProjects(client.id);
        setProjects(currentProjects);
        setExpandedProjectId(currentProjects[0]?.id || null);
      })
      .catch((error) => {
        if (active) setLoadError(error instanceof Error ? error.message : 'Projects could not be loaded.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => { active = false; };
  }, [client.id]);

  const handleApprove = async (projectId: string, milestoneId: string) => {
    const key = `${projectId}:${milestoneId}`;
    if (savingMilestoneKey) return;
    setSavingMilestoneKey(key);
    setApprovalError('');
    try {
      const updatedProject = await portalDb.approveProjectMilestone(client.id, projectId, milestoneId);
      setProjects((current) => current.map((project) => project.id === updatedProject.id ? updatedProject : project));
    } catch (error) {
      setApprovalError(error instanceof Error ? error.message : 'Milestone approval could not be saved.');
    } finally {
      setSavingMilestoneKey('');
    }
  };

  return (
    <div className="space-y-8 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-black/[0.06] dark:border-white/[0.08]">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#0071E3] mb-1">
            Active Engagements
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight">
            Projects &amp; Milestones
          </h1>
          <p className="text-sm text-[#86868B] mt-1">
            Real-time delivery progress, milestone sign-offs, and engineering logs for <strong className="text-[#1D1D1F] dark:text-white font-medium">{client.company}</strong>.
          </p>
        </div>

        <button
          onClick={() => onNavigate('/portal/support')}
          className="px-4 py-2 rounded-2xl bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.07] dark:hover:bg-white/[0.12] text-[#1D1D1F] dark:text-[#F5F5F7] text-xs font-semibold border border-black/[0.04] dark:border-white/[0.06] transition-all flex items-center gap-1.5 self-start sm:self-auto"
        >
          <span>Request Custom Feature</span>
          <ArrowRight size={13} />
        </button>
      </div>

      {loadError && <div role="alert" data-testid="status-portal-project-load-error" className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-700 dark:text-red-300">{loadError}</div>}
      {approvalError && <div role="alert" data-testid="status-milestone-approval-error" className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-700 dark:text-red-300">{approvalError}</div>}
      {isLoading ? (
        <div role="status" aria-busy="true" data-testid="status-portal-projects-loading" className="rounded-3xl border border-black/[0.06] bg-white p-8 text-center text-sm text-[#86868B] dark:border-white/[0.08] dark:bg-[#1C1C1E]">
          Loading your projects…
        </div>
      ) : projects.length === 0 ? (
        <div className="p-16 text-center bg-white dark:bg-[#1C1C1E] border border-dashed border-black/[0.08] dark:border-white/[0.1] rounded-3xl">
          <Briefcase size={40} className="text-[#86868B] mx-auto mb-3" />
          <h3 className="text-base font-semibold text-[#1D1D1F] dark:text-white">No active projects assigned yet</h3>
          <p className="text-xs text-[#86868B] mt-1 max-w-md mx-auto">
            When a new website build, marketing sprint, or custom app is kicked off by Codex Dynamics, your project milestones will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {projects.map((proj) => {
            const isExpanded = expandedProjectId === proj.id;
            return (
              <div
                key={proj.id}
                className="p-7 rounded-3xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] shadow-[0_2px_8px_rgba(0,0,0,0.03)] space-y-6"
              >
                {/* Project Header Row */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#0071E3]/10 text-[#0071E3] dark:text-[#0A84FF]">
                        {proj.service}
                      </span>
                      <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#30D158]/10 text-[#248A3D] dark:text-[#32D74B] border border-[#30D158]/20">
                        {proj.status}
                      </span>
                    </div>
                    <h2 className="text-xl font-semibold text-[#1D1D1F] dark:text-white tracking-tight">{proj.name}</h2>
                    <p className="text-xs text-[#86868B] mt-1 max-w-2xl leading-relaxed">{proj.description}</p>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <div className="text-[10px] text-[#86868B] uppercase font-semibold">Progress</div>
                      <div className="text-2xl font-semibold text-[#1D1D1F] dark:text-white font-mono tabular-nums">{proj.progress}%</div>
                    </div>
                    <button
                      onClick={() => setExpandedProjectId(isExpanded ? null : proj.id)}
                      className="p-2.5 rounded-xl bg-black/[0.04] dark:bg-white/[0.08] text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-white transition-colors"
                      aria-label="Toggle project details"
                    >
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="w-full h-2 rounded-full bg-black/[0.05] dark:bg-white/[0.1] overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#0071E3] to-[#30D158] rounded-full transition-all duration-500"
                      style={{ width: `${proj.progress}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-[#86868B]">
                    <span>Kicked off: {new Date(proj.startDate).toLocaleDateString()}</span>
                    <span>Target Delivery: <strong className="text-[#1D1D1F] dark:text-white font-medium">{new Date(proj.targetDate).toLocaleDateString()}</strong></span>
                  </div>
                </div>

                {/* Milestones & Timeline (Collapsible) */}
                {isExpanded && (
                  <div className="space-y-6 pt-5 border-t border-black/[0.06] dark:border-white/[0.08] animate-in fade-in">
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-[#86868B] mb-3.5">
                        Milestone Schedule &amp; Approvals
                      </h3>

                      <div className="space-y-3">
                        {proj.milestones.map((m, idx) => {
                          const isApproved = Boolean(m.clientApproved);
                          const isSaving = savingMilestoneKey === `${proj.id}:${m.id}`;
                          return (
                            <div
                              key={m.id}
                              className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                                m.status === 'completed'
                                  ? 'bg-[#FBFBFC] dark:bg-[#252528] border-black/[0.05] dark:border-white/[0.07]'
                                  : m.status === 'in_progress'
                                  ? 'bg-[#0071E3]/[0.03] dark:bg-[#0071E3]/[0.08] border-[#0071E3]/30'
                                  : 'bg-[#FBFBFC]/50 dark:bg-[#252528]/40 border-black/[0.04] dark:border-white/[0.05] opacity-75'
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className="mt-0.5">
                                  {m.status === 'completed' ? (
                                    <CheckCircle2 size={18} className="text-[#248A3D] dark:text-[#32D74B]" />
                                  ) : m.status === 'in_progress' ? (
                                    <Clock size={18} className="text-[#0071E3]" />
                                  ) : (
                                    <div className="size-4 rounded-full border border-black/20 dark:border-white/30 mt-0.5" />
                                  )}
                                </div>
                                <div>
                                  <div className="text-xs sm:text-sm font-semibold text-[#1D1D1F] dark:text-white flex items-center gap-2">
                                    <span>Milestone {idx + 1}: {m.title}</span>
                                    {m.status === 'in_progress' && (
                                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#0071E3]/10 text-[#0071E3] dark:text-[#0A84FF] font-semibold">
                                        Current Sprint
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-[#86868B] mt-0.5">
                                    Target Date: {new Date(m.dueDate).toLocaleDateString()}
                                    {m.notes && <span className="ml-2 text-[#248A3D] dark:text-[#32D74B]">· {m.notes}</span>}
                                  </div>
                                </div>
                              </div>

                              <div className="shrink-0 flex items-center gap-2 self-end sm:self-center">
                                {m.status === 'completed' ? (
                                  <span className="text-xs font-semibold text-[#248A3D] dark:text-[#32D74B] flex items-center gap-1.5 bg-[#30D158]/10 px-3 py-1 rounded-full">
                                    <CheckCircle2 size={13} />
                                    <span>Delivered</span>
                                  </span>
                                ) : isApproved ? (
                                  <span className="text-xs font-semibold text-[#248A3D] dark:text-[#32D74B] flex items-center gap-1.5 bg-[#30D158]/10 px-3 py-1 rounded-full">
                                    <ThumbsUp size={13} />
                                    <span>Client Approved</span>
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => void handleApprove(proj.id, m.id)}
                                    disabled={Boolean(savingMilestoneKey)}
                                    data-testid={`button-approve-milestone-${proj.id}-${m.id}`}
                                    className="px-3.5 py-1.5 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] disabled:opacity-60 disabled:cursor-wait text-white text-xs font-semibold transition-all flex items-center gap-1.5 shadow-xs"
                                  >
                                    <ThumbsUp size={12} />
                                    <span>{isSaving ? 'Saving…' : 'Approve Milestone'}</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Engineering Updates */}
                    {proj.recentUpdates.length > 0 && (
                      <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-[#86868B] mb-3.5">
                          Engineering Activity &amp; Build Logs
                        </h3>
                        <div className="space-y-2.5">
                          {proj.recentUpdates.map((u) => (
                            <div key={u.id} className="p-4 rounded-2xl bg-[#FBFBFC] dark:bg-[#252528] border border-black/[0.05] dark:border-white/[0.07] text-xs">
                              <div className="flex items-center justify-between text-[#86868B] text-xs mb-1">
                                <span className="font-semibold text-[#1D1D1F] dark:text-white">{u.title}</span>
                                <span className="font-mono text-[11px]">{u.date} · {u.author}</span>
                              </div>
                              <p className="text-[#86868B] leading-relaxed">{u.message}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
