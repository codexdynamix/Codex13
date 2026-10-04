import React, { useMemo, useState } from 'react';

const PROJECT_STATUSES = [
  'Planning',
  'In Progress',
  'Waiting for Client',
  'Review',
  'Completed',
  'Maintenance',
];

const inputStyle = {
  width: '100%',
  minHeight: 38,
  padding: '9px 11px',
  border: '1px solid var(--crm-border, rgba(255,255,255,.14))',
  borderRadius: 7,
  background: 'var(--crm-input-bg, #1c1c1e)',
  color: 'var(--crm-text-primary, #f5f5f7)',
  font: 'inherit',
  fontSize: 13,
};

const buttonBase = {
  minHeight: 34,
  padding: '7px 11px',
  border: '1px solid var(--crm-border, rgba(255,255,255,.14))',
  borderRadius: 6,
  background: 'var(--crm-card, #242426)',
  color: 'var(--crm-text-primary, #f5f5f7)',
  font: 'inherit',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
};

function handleDialogKeyDown(event, onClose, locked = false) {
  if (event.key === 'Escape' && !locked) {
    onClose();
    return;
  }
  if (event.key !== 'Tab') return;
  const dialog = event.currentTarget.querySelector('[role="dialog"], [role="alertdialog"]');
  const focusable = [...(dialog?.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') || [])];
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function parseJson(value, original, originalText, defaultEmpty = false) {
  if (value === originalText) return original === undefined && defaultEmpty ? [] : original;
  return value.trim() ? JSON.parse(value) : [];
}

function jsonText(value) {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '';
  }
}

function dateFieldValue(value) {
  if (!value) return '';
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function Field({ label, id, children, hint }) {
  return (
    <label htmlFor={id} style={{ display: 'grid', gap: 5, color: 'var(--crm-text-secondary, #b0b0b5)', fontSize: 12, fontWeight: 600 }}>
      <span>{label}</span>
      {children}
      {hint && <small style={{ color: 'var(--crm-text-muted, #929298)', fontWeight: 400 }}>{hint}</small>}
    </label>
  );
}

function ProjectDialog({ clients, project, onClose, onSave }) {
  const [form, setForm] = useState(() => ({
    client_id: project?.client_id ?? '',
    name: project?.name ?? '',
    description: project?.description ?? '',
    service: project?.service ?? '',
    status: project?.status ?? 'Planning',
    progress: String(project?.progress ?? 0),
    start_date: dateFieldValue(project?.start_date),
    target_date: dateFieldValue(project?.target_date),
    team_lead: project?.team_lead ?? '',
    milestonesText: jsonText(project?.milestones),
    recentUpdatesText: jsonText(project?.recent_updates),
  }));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const initialMilestonesText = jsonText(project?.milestones);
  const initialUpdatesText = jsonText(project?.recent_updates);
  const initialStartDate = dateFieldValue(project?.start_date);
  const initialTargetDate = dateFieldValue(project?.target_date);

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event) => {
    event.preventDefault();
    setFormError('');
    if (!String(form.client_id).trim()) {
      setFormError('Choose a client for this project.');
      return;
    }
    if (!form.name.trim()) {
      setFormError('Project name is required.');
      return;
    }
    let milestones;
    let recentUpdates;
    try {
      milestones = parseJson(form.milestonesText, project?.milestones, initialMilestonesText, !project);
      recentUpdates = parseJson(form.recentUpdatesText, project?.recent_updates, initialUpdatesText, !project);
    } catch {
      setFormError('Milestones and recent updates must contain valid JSON.');
      return;
    }
    setSaving(true);
    try {
      const selectedClientId = project && String(form.client_id) === String(project.client_id)
        ? project.client_id
        : form.client_id;
      const payload = {
        ...(project || {}),
        client_id: selectedClientId,
        name: form.name.trim(),
        description: form.description,
        service: form.service,
        status: form.status,
        progress: Math.max(0, Math.min(100, Math.round(Number(form.progress) || 0))),
        start_date: project && form.start_date === initialStartDate ? project.start_date : form.start_date,
        target_date: project && form.target_date === initialTargetDate ? project.target_date : form.target_date,
        team_lead: form.team_lead,
        milestones,
        recent_updates: recentUpdates,
      };
      delete payload.id;
      delete payload.client_name;
      delete payload.client_company;
      await onSave(payload);
      onClose();
    } catch (error) {
      setFormError(error?.message || 'The project could not be saved. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}
      onKeyDown={(event) => handleDialogKeyDown(event, onClose, saving)}
      style={{ position: 'fixed', inset: 0, zIndex: 2100, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(0,0,0,.68)' }}
      data-testid="overlay-project-dialog"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-dialog-title"
        aria-describedby="project-dialog-description"
        style={{ width: 'min(720px, 100%)', maxHeight: 'min(92dvh, 900px)', overflowY: 'auto', padding: 22, border: '1px solid var(--crm-border, rgba(255,255,255,.14))', borderRadius: 12, background: 'var(--crm-card, #242426)', color: 'var(--crm-text-primary, #f5f5f7)', boxShadow: '0 22px 70px rgba(0,0,0,.45)' }}
        data-testid="dialog-project-form"
      >
        <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, marginBottom: 18 }}>
          <div>
            <p style={{ margin: '0 0 4px', color: 'var(--crm-accent, #0a84ff)', fontSize: 10, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase' }}>Client delivery</p>
            <h3 id="project-dialog-title" style={{ margin: 0, fontSize: 20 }}>{project ? 'Edit project' : 'Create project'}</h3>
            <p id="project-dialog-description" style={{ margin: '5px 0 0', color: 'var(--crm-text-secondary, #b0b0b5)', fontSize: 12 }}>Manage delivery details for a client account. These records are separate from the public portfolio.</p>
          </div>
          <button type="button" style={buttonBase} onClick={onClose} disabled={saving} aria-label="Close project form" data-testid="button-close-project-dialog">Close</button>
        </header>

        <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
          <div className="project-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
            <Field label="Client *" id="project-client-id">
              <select
                id="project-client-id"
                required
                autoFocus
                value={String(form.client_id)}
                onChange={(event) => update('client_id', event.target.value)}
                style={inputStyle}
                data-testid="select-project-client"
              >
                <option value="">Choose a client</option>
                {project?.client_id != null && !clients.some((client) => String(client.id) === String(project.client_id)) && (
                  <option value={String(project.client_id)}>{project.client_name || `Client ${project.client_id}`}</option>
                )}
                {clients.map((client) => <option key={client.id} value={String(client.id)}>{client.company ? `${client.name} · ${client.company}` : client.name}</option>)}
              </select>
            </Field>
            <Field label="Project name *" id="project-name">
              <input id="project-name" required maxLength={180} value={form.name} onChange={(event) => update('name', event.target.value)} style={inputStyle} placeholder="Client portal rebuild" data-testid="input-project-name" />
            </Field>
            <Field label="Service" id="project-service">
              <input id="project-service" value={form.service} onChange={(event) => update('service', event.target.value)} style={inputStyle} placeholder="Web application" data-testid="input-project-service" />
            </Field>
            <Field label="Status" id="project-status">
              <select id="project-status" value={form.status} onChange={(event) => update('status', event.target.value)} style={inputStyle} data-testid="select-project-status">
                {!PROJECT_STATUSES.includes(form.status) && form.status && <option value={form.status}>{form.status}</option>}
                {PROJECT_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </Field>
            <Field label="Progress" id="project-progress" hint="Whole number from 0 to 100.">
              <input id="project-progress" type="number" min="0" max="100" step="1" value={form.progress} onChange={(event) => update('progress', event.target.value)} style={inputStyle} data-testid="input-project-progress" />
            </Field>
            <Field label="Team lead" id="project-team-lead">
              <input id="project-team-lead" value={form.team_lead} onChange={(event) => update('team_lead', event.target.value)} style={inputStyle} placeholder="Assigned staff member" data-testid="input-project-team-lead" />
            </Field>
            <Field label="Start date" id="project-start-date">
              <input id="project-start-date" type="date" value={form.start_date} onChange={(event) => update('start_date', event.target.value)} style={inputStyle} data-testid="input-project-start-date" />
            </Field>
            <Field label="Target date" id="project-target-date">
              <input id="project-target-date" type="date" value={form.target_date} onChange={(event) => update('target_date', event.target.value)} style={inputStyle} data-testid="input-project-target-date" />
            </Field>
          </div>
          <Field label="Description" id="project-description">
            <textarea id="project-description" rows={3} value={form.description} onChange={(event) => update('description', event.target.value)} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Scope, outcomes, or delivery context" data-testid="textarea-project-description" />
          </Field>
          <div className="project-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
            <Field label="Milestones (JSON)" id="project-milestones" hint="Existing API data is preserved unless changed.">
              <textarea id="project-milestones" rows={4} value={form.milestonesText} onChange={(event) => update('milestonesText', event.target.value)} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'var(--font-family-mono, monospace)', fontSize: 11 }} placeholder="[]" data-testid="textarea-project-milestones" />
            </Field>
            <Field label="Recent updates (JSON)" id="project-recent-updates" hint="Existing API data is preserved unless changed.">
              <textarea id="project-recent-updates" rows={4} value={form.recentUpdatesText} onChange={(event) => update('recentUpdatesText', event.target.value)} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'var(--font-family-mono, monospace)', fontSize: 11 }} placeholder="[]" data-testid="textarea-project-updates" />
            </Field>
          </div>
          {formError && <p role="alert" style={{ margin: 0, padding: '9px 11px', border: '1px solid rgba(246,70,93,.35)', borderRadius: 6, background: 'rgba(246,70,93,.08)', color: '#ff8d96', fontSize: 12 }} data-testid="alert-project-form-error">{formError}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 2 }}>
            <button type="button" style={buttonBase} onClick={onClose} disabled={saving} data-testid="button-cancel-project">Cancel</button>
            <button type="submit" style={{ ...buttonBase, borderColor: 'var(--crm-accent, #0a84ff)', background: 'var(--crm-accent, #0a84ff)', color: 'var(--crm-accent-fg, #fff)' }} disabled={saving} data-testid="button-save-project">{saving ? 'Saving…' : project ? 'Save changes' : 'Create project'}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function ArchiveDialog({ project, onClose, onConfirm, busy, error }) {
  return (
    <div
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}
      onKeyDown={(event) => handleDialogKeyDown(event, onClose, busy)}
      style={{ position: 'fixed', inset: 0, zIndex: 2100, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(0,0,0,.68)' }}
      data-testid="overlay-archive-project"
    >
      <section role="alertdialog" aria-modal="true" aria-labelledby="archive-project-title" aria-describedby="archive-project-copy" style={{ width: 'min(440px, 100%)', padding: 22, border: '1px solid var(--crm-border, rgba(255,255,255,.14))', borderRadius: 12, background: 'var(--crm-card, #242426)', color: 'var(--crm-text-primary, #f5f5f7)' }} data-testid="dialog-archive-project">
        <h3 id="archive-project-title" style={{ margin: '0 0 8px', fontSize: 18 }}>Archive this project?</h3>
        <p id="archive-project-copy" style={{ margin: '0 0 16px', color: 'var(--crm-text-secondary, #b0b0b5)', fontSize: 13, lineHeight: 1.5 }}>“{project.name}” will be removed from this active project list. This action is handled by the project service.</p>
        {error && <p role="alert" style={{ margin: '0 0 12px', color: '#ff8d96', fontSize: 12 }} data-testid="alert-archive-project-error">{error}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" autoFocus style={buttonBase} onClick={onClose} disabled={busy} data-testid="button-cancel-archive-project">Keep project</button>
          <button type="button" style={{ ...buttonBase, borderColor: 'rgba(246,70,93,.5)', background: 'rgba(246,70,93,.12)', color: '#ff929a' }} onClick={onConfirm} disabled={busy} data-testid="button-confirm-archive-project">{busy ? 'Archiving…' : 'Archive project'}</button>
        </div>
      </section>
    </div>
  );
}

export default function ClientProjectsWorkspace({
  clients = [],
  projects = [],
  loading = false,
  error = '',
  onReload = () => {},
  onCreate = async () => {},
  onUpdate = async () => {},
  onDelete = async () => {},
}) {
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [projectDialog, setProjectDialog] = useState(null);
  const [archiveProject, setArchiveProject] = useState(null);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [archiveError, setArchiveError] = useState('');

  const filteredProjects = useMemo(() => {
    const query = search.trim().toLowerCase();
    return projects.filter((project) => {
      if (clientFilter && String(project.client_id) !== clientFilter) return false;
      if (statusFilter && project.status !== statusFilter) return false;
      if (!query) return true;
      const client = clients.find((item) => String(item.id) === String(project.client_id));
      return [
        project.name,
        project.description,
        project.service,
        project.status,
        project.team_lead,
        project.client_name,
        project.client_company,
        client?.name,
        client?.company,
      ].some((value) => String(value || '').toLowerCase().includes(query));
    });
  }, [projects, clients, search, clientFilter, statusFilter]);

  const saveProject = async (payload) => {
    if (projectDialog?.project) await onUpdate(projectDialog.project.id, payload);
    else await onCreate(payload);
  };

  const archive = async () => {
    if (!archiveProject) return;
    setArchiveBusy(true);
    setArchiveError('');
    try {
      await onDelete(archiveProject.id);
      setArchiveProject(null);
    } catch (reason) {
      setArchiveError(reason?.message || 'The project could not be archived.');
    } finally {
      setArchiveBusy(false);
    }
  };

  const statusCounts = useMemo(() => PROJECT_STATUSES.reduce((counts, status) => {
    counts[status] = projects.filter((project) => project.status === status).length;
    return counts;
  }, {}), [projects]);

  return (
    <section className="client-projects-workspace" aria-labelledby="client-projects-title" style={{ display: 'grid', gap: 16, color: 'var(--crm-text-primary, #f5f5f7)' }} data-testid="workspace-client-projects">
      <style>{`
        @media (max-width: 767px) {
          .client-projects-workspace .client-projects-summary,
          .client-projects-workspace .client-project-toolbar,
          .client-projects-workspace .project-form-grid,
          .client-projects-workspace .project-meta-grid { grid-template-columns: minmax(0, 1fr) !important; }
        }
      `}</style>
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <p style={{ margin: '0 0 4px', color: 'var(--crm-accent, #0a84ff)', fontSize: 10, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase' }}>Delivery operations</p>
          <h2 id="client-projects-title" style={{ margin: 0, fontSize: 22, letterSpacing: '-.03em' }}>Client projects</h2>
          <p style={{ margin: '5px 0 0', color: 'var(--crm-text-secondary, #b0b0b5)', fontSize: 12 }}>Work in progress for client accounts, separate from public portfolio projects.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" style={buttonBase} onClick={onReload} disabled={loading} data-testid="button-reload-client-projects">{loading ? 'Refreshing…' : 'Refresh'}</button>
          <button type="button" style={{ ...buttonBase, borderColor: 'var(--crm-accent, #0a84ff)', background: 'var(--crm-accent, #0a84ff)', color: 'var(--crm-accent-fg, #fff)' }} onClick={() => setProjectDialog({ project: null })} disabled={clients.length === 0} data-testid="button-create-client-project">Create project</button>
        </div>
      </header>

      <div className="client-projects-summary" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))', gap: 9 }} data-testid="summary-project-statuses">
        {[
          ['Active projects', projects.filter((project) => !['Completed', 'Maintenance'].includes(project.status)).length, 'var(--crm-accent, #0a84ff)'],
          ['In progress', statusCounts['In Progress'], '#44d3a2'],
          ['Waiting on client', statusCounts['Waiting for Client'], '#f0b865'],
          ['Completed', statusCounts.Completed, 'var(--crm-text-secondary, #b0b0b5)'],
        ].map(([label, value, color]) => (
          <div key={label} style={{ padding: '12px 14px', border: '1px solid var(--crm-border, rgba(255,255,255,.14))', borderRadius: 8, background: 'var(--crm-card, #242426)' }} data-testid={`stat-client-projects-${String(label).toLowerCase().replaceAll(' ', '-')}`}>
            <span style={{ display: 'block', color: 'var(--crm-text-secondary, #b0b0b5)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em' }}>{label}</span>
            <strong style={{ display: 'block', marginTop: 4, color, fontSize: 21, lineHeight: 1.1 }}>{value}</strong>
          </div>
        ))}
      </div>

      {error && <div role="alert" style={{ padding: '10px 12px', border: '1px solid rgba(246,70,93,.35)', borderRadius: 7, background: 'rgba(246,70,93,.08)', color: '#ff8d96', fontSize: 12 }} data-testid="alert-client-projects-error">{error}</div>}

      <div className="client-project-toolbar" style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1.5fr) repeat(auto-fit, minmax(160px, .8fr))', gap: 9, padding: 12, border: '1px solid var(--crm-border, rgba(255,255,255,.14))', borderRadius: 9, background: 'var(--crm-card, #242426)' }}>
        <label htmlFor="client-project-search" style={{ display: 'grid', gap: 5, color: 'var(--crm-text-secondary, #b0b0b5)', fontSize: 11, fontWeight: 600 }}>Search projects
          <input id="client-project-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, client, service, team lead…" style={inputStyle} data-testid="input-search-client-projects" />
        </label>
        <label htmlFor="client-project-filter-client" style={{ display: 'grid', gap: 5, color: 'var(--crm-text-secondary, #b0b0b5)', fontSize: 11, fontWeight: 600 }}>Client
          <select id="client-project-filter-client" value={clientFilter} onChange={(event) => setClientFilter(event.target.value)} style={inputStyle} data-testid="filter-client-projects-client">
            <option value="">All clients</option>
            {clients.map((client) => <option key={client.id} value={String(client.id)}>{client.name}{client.company ? ` · ${client.company}` : ''}</option>)}
          </select>
        </label>
        <label htmlFor="client-project-filter-status" style={{ display: 'grid', gap: 5, color: 'var(--crm-text-secondary, #b0b0b5)', fontSize: 11, fontWeight: 600 }}>Status
          <select id="client-project-filter-status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={inputStyle} data-testid="filter-client-projects-status">
            <option value="">All statuses</option>
            {PROJECT_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </label>
      </div>

      {loading && (
        <div aria-label="Loading client projects" aria-busy="true" style={{ display: 'grid', gap: 9 }} data-testid="loading-client-projects">
          {[0, 1, 2].map((index) => <div key={index} style={{ height: 118, border: '1px solid var(--crm-border, rgba(255,255,255,.14))', borderRadius: 9, background: 'linear-gradient(90deg, var(--crm-card, #242426), var(--crm-card-hover, #2c2c2e), var(--crm-card, #242426))', opacity: .65 }} data-testid={`skeleton-client-project-${index}`} />)}
        </div>
      )}

      {!loading && error && projects.length === 0 && (
        <div style={{ padding: '24px 22px', border: '1px solid rgba(246,70,93,.3)', borderRadius: 9, background: 'rgba(246,70,93,.05)', textAlign: 'center' }} data-testid="error-state-client-projects">
          <h3 style={{ margin: 0, fontSize: 15 }}>Projects could not be loaded</h3>
          <p style={{ margin: '6px 0 14px', color: 'var(--crm-text-secondary, #b0b0b5)', fontSize: 12 }}>{error}</p>
          <button type="button" style={buttonBase} onClick={onReload} data-testid="button-retry-client-projects">Try again</button>
        </div>
      )}

      {!loading && !error && projects.length === 0 && (
        <div style={{ padding: '30px 22px', border: '1px dashed var(--crm-border, rgba(255,255,255,.2))', borderRadius: 10, textAlign: 'center', background: 'color-mix(in srgb, var(--crm-accent, #0a84ff) 4%, var(--crm-card, #242426))' }} data-testid="empty-client-projects">
          <span style={{ display: 'block', margin: '0 auto 12px', width: 34, height: 34, border: '1px solid color-mix(in srgb, var(--crm-accent, #0a84ff) 45%, transparent)', borderRadius: 9, color: 'var(--crm-accent, #0a84ff)', fontSize: 18, lineHeight: '32px' }}>+</span>
          <h3 style={{ margin: 0, fontSize: 15 }}>No delivery projects yet</h3>
          <p style={{ margin: '6px auto 15px', maxWidth: 390, color: 'var(--crm-text-secondary, #b0b0b5)', fontSize: 12 }}>Create a project and assign it to a client account to begin tracking delivery.</p>
          <button type="button" style={{ ...buttonBase, borderColor: 'var(--crm-accent, #0a84ff)', color: 'var(--crm-accent, #0a84ff)' }} onClick={() => setProjectDialog({ project: null })} disabled={clients.length === 0} data-testid="button-create-first-client-project">Create first project</button>
          {clients.length === 0 && <p style={{ margin: '10px 0 0', color: 'var(--crm-text-muted, #929298)', fontSize: 11 }} data-testid="text-no-project-clients">Add a client account before creating a project.</p>}
        </div>
      )}

      {!loading && projects.length > 0 && filteredProjects.length === 0 && (
        <div style={{ padding: 22, border: '1px dashed var(--crm-border, rgba(255,255,255,.2))', borderRadius: 9, color: 'var(--crm-text-secondary, #b0b0b5)', textAlign: 'center', fontSize: 13 }} data-testid="empty-filtered-client-projects">No projects match these filters. Adjust the search or choose another client or status.</div>
      )}

      {!loading && filteredProjects.length > 0 && (
        <div style={{ display: 'grid', gap: 9 }} data-testid="list-client-projects">
          {filteredProjects.map((project) => {
            const client = clients.find((item) => String(item.id) === String(project.client_id));
            const progress = Math.max(0, Math.min(100, Number(project.progress) || 0));
            const approvedMilestones = Array.isArray(project.milestones)
              ? project.milestones.filter((milestone) => milestone?.clientApproved)
              : [];
            return (
              <article key={project.id} style={{ padding: '15px 16px', border: '1px solid var(--crm-border, rgba(255,255,255,.14))', borderRadius: 9, background: 'var(--crm-card, #242426)' }} data-testid={`card-client-project-${project.id}`}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0, flex: '1 1 260px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <h3 style={{ margin: 0, fontSize: 15, lineHeight: 1.3 }} data-testid={`text-project-name-${project.id}`}>{project.name}</h3>
                      <span style={{ padding: '3px 7px', border: '1px solid color-mix(in srgb, var(--crm-accent, #0a84ff) 30%, transparent)', borderRadius: 999, background: 'color-mix(in srgb, var(--crm-accent, #0a84ff) 10%, transparent)', color: 'var(--crm-accent, #0a84ff)', fontSize: 10, fontWeight: 700 }} data-testid={`status-project-${project.id}`}>{project.status || 'Planning'}</span>
                    </div>
                    <p style={{ margin: '5px 0 0', color: 'var(--crm-text-secondary, #b0b0b5)', fontSize: 12 }} data-testid={`text-project-client-${project.id}`}>{project.client_name || client?.name || `Client ${project.client_id}`}{project.client_company || client?.company ? ` · ${project.client_company || client?.company}` : ''}</p>
                    {project.description && <p style={{ margin: '8px 0 0', color: 'var(--crm-text-secondary, #b0b0b5)', fontSize: 12, lineHeight: 1.5 }} data-testid={`text-project-description-${project.id}`}>{project.description}</p>}
                  </div>
                  <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                    <button type="button" style={buttonBase} onClick={() => setProjectDialog({ project })} data-testid={`button-edit-project-${project.id}`}>Edit</button>
                    <button type="button" style={{ ...buttonBase, color: '#ff929a', borderColor: 'rgba(246,70,93,.3)' }} onClick={() => { setArchiveProject(project); setArchiveError(''); }} data-testid={`button-archive-project-${project.id}`}>Archive</button>
                  </div>
                </div>
                <div className="project-meta-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 1.1fr) repeat(auto-fit, minmax(110px, .65fr))', alignItems: 'center', gap: 12, marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--crm-border, rgba(255,255,255,.1))' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, color: 'var(--crm-text-secondary, #b0b0b5)', fontSize: 10 }}><span>Delivery progress</span><strong style={{ color: 'var(--crm-text-primary, #f5f5f7)' }} data-testid={`text-project-progress-${project.id}`}>{progress}%</strong></div>
                    <div role="progressbar" aria-label={`${project.name} progress`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={progress} style={{ height: 5, overflow: 'hidden', borderRadius: 9, background: 'var(--crm-bg, #1c1c1e)' }} data-testid={`progress-project-${project.id}`}><div style={{ width: `${progress}%`, height: '100%', borderRadius: 9, background: 'var(--crm-accent, #0a84ff)' }} /></div>
                  </div>
                  <div data-testid={`text-project-service-${project.id}`}><span style={{ display: 'block', color: 'var(--crm-text-muted, #929298)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em' }}>Service</span><span style={{ fontSize: 12 }}>{project.service || 'Not set'}</span></div>
                  <div data-testid={`text-project-team-lead-${project.id}`}><span style={{ display: 'block', color: 'var(--crm-text-muted, #929298)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em' }}>Team lead</span><span style={{ fontSize: 12 }}>{project.team_lead || 'Unassigned'}</span></div>
                  <div data-testid={`text-project-dates-${project.id}`}><span style={{ display: 'block', color: 'var(--crm-text-muted, #929298)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em' }}>Target date</span><span style={{ fontSize: 12 }}>{project.target_date ? String(project.target_date).slice(0, 10) : 'Not set'}</span></div>
                </div>
                {(Array.isArray(project.milestones) && project.milestones.length > 0) && <p style={{ margin: '10px 0 0', color: 'var(--crm-text-muted, #929298)', fontSize: 11 }} data-testid={`text-project-milestone-count-${project.id}`}>{project.milestones.length} milestone{project.milestones.length === 1 ? '' : 's'}</p>}
                {approvedMilestones.length > 0 && (
                  <div style={{ marginTop: 10, padding: '9px 11px', border: '1px solid rgba(68,211,162,.24)', borderRadius: 7, background: 'rgba(68,211,162,.05)', color: 'var(--crm-text-secondary, #b0b0b5)', fontSize: 11 }} data-testid={`list-client-approved-milestones-${project.id}`}>
                    <strong style={{ color: '#72d8af' }}>Client-approved milestones</strong>
                    <ul style={{ margin: '5px 0 0', paddingLeft: 18 }}>
                      {approvedMilestones.map((milestone) => (
                        <li key={milestone.id}>
                          {milestone.title || 'Milestone'}
                          {milestone.clientApprovedAt ? ` · ${String(milestone.clientApprovedAt).slice(0, 10)}` : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {project.recent_updates && <details style={{ marginTop: 8, color: 'var(--crm-text-secondary, #b0b0b5)', fontSize: 11 }} data-testid={`details-project-updates-${project.id}`}><summary style={{ cursor: 'pointer' }}>Recent updates</summary><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', color: 'var(--crm-text-muted, #929298)' }}>{jsonText(project.recent_updates)}</pre></details>}
              </article>
            );
          })}
        </div>
      )}

      {projectDialog && <ProjectDialog clients={clients} project={projectDialog.project} onClose={() => setProjectDialog(null)} onSave={saveProject} />}
      {archiveProject && <ArchiveDialog project={archiveProject} onClose={() => setArchiveProject(null)} onConfirm={archive} busy={archiveBusy} error={archiveError} />}
    </section>
  );
}