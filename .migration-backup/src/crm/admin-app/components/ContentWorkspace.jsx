import React, { useState } from 'react';
import {
  BookOpen,
  BriefcaseBusiness,
  ExternalLink,
  Link2,
  Pencil,
  Plus,
  Star,
  Trash2,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { BlogsTab } from '../../../components/admin/BlogsTab';

const CONTENT_SECTIONS = [
  { id: 'blog', label: 'Blog & SEO', icon: BookOpen },
  { id: 'projects', label: 'Projects', icon: BriefcaseBusiness },
  { id: 'reviews', label: 'Reviews', icon: Star },
  { id: 'backlinks', label: 'Backlinks', icon: Link2 },
];

const EMPTY_FORMS = {
  backlink: { name: '', url: '', notes: '' },
  review: { author: '', rating: 5, comment: '', is_published: true },
  project: {
    title: '',
    site_name: '',
    site_url: '',
    description: '',
    category: 'Web Development',
    image_url: '',
    is_published: true,
  },
};

const SECTION_CONFIG = {
  projects: {
    type: 'project',
    icon: BriefcaseBusiness,
    title: 'Portfolio projects',
    description: 'Manage the work shown in the public portfolio and case-study areas.',
    addLabel: 'New project',
    rows: (data) => data.projects,
    primary: (row) => row.title || row.site_name || 'Untitled project',
    secondary: (row) => row.site_name || row.category || row.site_url || 'No project details',
  },
  reviews: {
    type: 'review',
    icon: Star,
    title: 'Client reviews',
    description: 'Manage testimonials and social proof displayed across the public site.',
    addLabel: 'New review',
    rows: (data) => data.reviews,
    primary: (row) => row.author || 'Anonymous reviewer',
    secondary: (row) => row.comment || 'No review text',
  },
  backlinks: {
    type: 'backlink',
    icon: Link2,
    title: 'SEO backlinks',
    description: 'Track referring domains and external citations for the SEO workflow.',
    addLabel: 'Add backlink',
    rows: (data) => data.backlinks,
    primary: (row) => row.name || row.url || 'Unnamed backlink',
    secondary: (row) => row.url || row.notes || 'No backlink URL',
  },
};

function HubButton({ children, onClick, secondary = false, danger = false, type = 'button' }) {
  return (
    <button
      type={type}
      className={`crm-content-hub-button${secondary ? ' secondary' : ''}${danger ? ' danger' : ''}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function Field({ label, value, onChange, multiline = false, type = 'text', placeholder }) {
  return (
    <label className="crm-content-hub-field">
      <span>{label}</span>
      {multiline ? (
        <textarea rows={4} value={value ?? ''} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
      ) : (
        <input type={type} value={value ?? ''} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
      )}
    </label>
  );
}

function RecordEditor({ type, initial, onCancel, onSave }) {
  const [form, setForm] = useState({ ...EMPTY_FORMS[type], ...(initial || {}) });
  const [saving, setSaving] = useState(false);

  const update = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await onSave(type, form);
      onCancel();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="crm-content-hub-editor" onSubmit={submit}>
      <div className="crm-content-hub-editor-header">
        <div>
          <span className="crm-content-hub-kicker">{initial?.id ? 'Edit record' : 'New record'}</span>
          <h3>{type === 'project' ? 'Portfolio project' : type === 'review' ? 'Client review' : 'SEO backlink'}</h3>
        </div>
        <HubButton secondary onClick={onCancel}>Close</HubButton>
      </div>

      {type === 'project' && (
        <>
          <div className="crm-content-hub-form-grid">
            <Field label="Project title" value={form.title} onChange={(value) => update('title', value)} />
            <Field label="Client / site name" value={form.site_name} onChange={(value) => update('site_name', value)} />
            <Field label="Project URL" value={form.site_url} onChange={(value) => update('site_url', value)} type="url" />
            <Field label="Category" value={form.category} onChange={(value) => update('category', value)} />
          </div>
          <Field label="Description" value={form.description} onChange={(value) => update('description', value)} multiline />
          <Field label="Image URL" value={form.image_url} onChange={(value) => update('image_url', value)} type="url" />
          <label className="crm-content-hub-check">
            <input type="checkbox" checked={Boolean(form.is_published)} onChange={(event) => update('is_published', event.target.checked)} />
            Published on the public site
          </label>
        </>
      )}

      {type === 'review' && (
        <>
          <div className="crm-content-hub-form-grid">
            <Field label="Author" value={form.author} onChange={(value) => update('author', value)} />
            <Field label="Rating (1–5)" value={form.rating} onChange={(value) => update('rating', Number(value))} type="number" />
          </div>
          <Field label="Review" value={form.comment} onChange={(value) => update('comment', value)} multiline />
          <label className="crm-content-hub-check">
            <input type="checkbox" checked={Boolean(form.is_published)} onChange={(event) => update('is_published', event.target.checked)} />
            Published on the public site
          </label>
        </>
      )}

      {type === 'backlink' && (
        <>
          <Field label="Referring site" value={form.name} onChange={(value) => update('name', value)} />
          <Field label="URL" value={form.url} onChange={(value) => update('url', value)} type="url" />
          <Field label="Notes" value={form.notes} onChange={(value) => update('notes', value)} multiline />
        </>
      )}

      <div className="crm-content-hub-form-actions">
        <HubButton secondary onClick={onCancel}>Cancel</HubButton>
        <HubButton type="submit">{saving ? 'Saving…' : 'Save record'}</HubButton>
      </div>
    </form>
  );
}

function RecordsSection({ section, data, onAction }) {
  const config = SECTION_CONFIG[section];
  const [editing, setEditing] = useState(null);
  const rows = config.rows(data);

  const save = async (type, payload) => {
    const createAction = {
      project: 'save_project',
      review: 'save_review',
      backlink: 'add_backlink',
    }[type];
    await onAction(payload.id ? `update_${type}` : createAction, payload);
  };

  const remove = async (id) => {
    await onAction(`delete_${config.type}`, { id });
  };

  return (
    <div className={`crm-content-hub-records crm-content-hub-records-${section}`}>
      <div className="crm-content-hub-section-heading">
        <div className="crm-content-hub-section-heading-copy">
          <span className="crm-content-hub-section-icon"><config.icon size={18} /></span>
          <div>
            <span className="crm-content-hub-kicker">Content library / {section}</span>
            <h3>{config.title}</h3>
            <p>{config.description}</p>
          </div>
        </div>
        <div className="crm-content-hub-section-actions">
          <span className="crm-content-hub-count">
            <strong>{rows.length}</strong>
            <span>{rows.length === 1 ? 'record' : 'records'}</span>
          </span>
          <HubButton onClick={() => setEditing({ type: config.type })}>
            <Plus size={14} /> {config.addLabel}
          </HubButton>
        </div>
      </div>

      {editing && (
        <RecordEditor
          type={config.type}
          initial={editing.type ? null : editing}
          onCancel={() => setEditing(null)}
          onSave={save}
        />
      )}

      <div className="crm-content-hub-record-list">
        {rows.length === 0 ? (
          <div className="crm-content-hub-empty">
            <config.icon size={22} />
            <strong>No {section} yet</strong>
            <span>Create the first record to start building this part of the public site.</span>
          </div>
        ) : (
          rows.map((row) => (
            <div className="crm-content-hub-record" key={row.id}>
              <div className="crm-content-hub-record-copy">
                <span className="crm-content-hub-record-type">
                  {section === 'projects' ? 'Portfolio project' : section === 'reviews' ? 'Client testimonial' : 'Referring domain'}
                </span>
                <strong>{config.primary(row)}</strong>
                <span>{config.secondary(row)}</span>
              </div>
              <div className="crm-content-hub-record-actions">
                {row.site_url && (
                  <a href={row.site_url} target="_blank" rel="noreferrer" className="crm-content-hub-icon-button" title="Open project">
                    <ExternalLink size={14} />
                  </a>
                )}
                <button type="button" className="crm-content-hub-icon-button" onClick={() => setEditing(row)} title="Edit">
                  <Pencil size={14} />
                </button>
                <button type="button" className="crm-content-hub-icon-button danger" onClick={() => remove(row.id)} title="Delete">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function LibrarySummary({ blogs = [], projects = [], reviews = [], backlinks = [] }) {
  const publishedBlogs = blogs.filter((blog) => blog.status === 'published' || !blog.status).length;
  const cards = [
    ['Articles', blogs.length, `${publishedBlogs} published`, BookOpen],
    ['Projects', projects.length, 'Portfolio records', BriefcaseBusiness],
    ['Reviews', reviews.length, 'Testimonials', Star],
    ['Backlinks', backlinks.length, 'SEO references', Link2],
  ];

  return (
    <div className="crm-content-hub-summary" aria-label="Content library summary">
      {cards.map(([label, value, detail, Icon]) => (
        <div className="crm-content-hub-summary-card" key={label}>
          <span className="crm-content-hub-summary-icon">
            <Icon size={18} strokeWidth={2.2} />
          </span>
          <div className="crm-content-hub-summary-body">
            <div className="crm-content-hub-summary-val-row">
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
            <small>{detail}</small>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ContentWorkspace({
  blogs = [],
  projects = [],
  reviews = [],
  backlinks = [],
  onAction = async () => ({}),
  showNotification = () => {},
}) {
  const [section, setSection] = useState('blog');
  const [isEditingBlog, setIsEditingBlog] = useState(false);
  const data = { projects, reviews, backlinks };

  const saveBlog = async (payload) => {
    await onAction(payload.id ? 'update_blog' : 'save_blog', payload);
    return true;
  };

  const deleteBlog = async (id) => {
    await onAction('delete_blog', { id });
    return true;
  };

  const toggleBlogStatus = async (id, status) => {
    await onAction('update_blog', { id, status });
    return true;
  };

  const duplicateBlog = async (id) => {
    const source = blogs.find((blog) => blog.id === id);
    if (!source) return false;
    const { id: _id, title, slug, ...rest } = source;
    const copyTitle = `${title || 'Untitled article'} (Copy)`;
    await onAction('save_blog', {
      ...rest,
      title: copyTitle,
      slug: `${slug || 'article'}-copy`,
      status: 'draft',
    });
    showNotification('Article duplicated as a draft.');
    return true;
  };

  return (
    <section className="crm-content-hub">
      {!isEditingBlog && (
        <>
          <header className="crm-content-hub-header">
            <div className="crm-content-hub-header-copy">
              <div className="crm-content-hub-title-row">
                <span className="crm-content-hub-header-mark"><BookOpen size={18} /></span>
                <div>
                  <span className="crm-content-hub-kicker">Leads / Content</span>
                  <h2>Content Studio</h2>
                </div>
              </div>
              <p>Write, optimize, publish, and manage the content that powers the public site.</p>
            </div>
            <div className="crm-content-hub-header-workflow">
              <div className="crm-content-hub-workflow-label">
                <Sparkles size={13} />
                <strong>Publishing workflow</strong>
              </div>
              <div className="crm-content-hub-workflow-steps">
                <span>Draft</span>
                <ArrowRight size={12} />
                <span>Optimize</span>
                <ArrowRight size={12} />
                <span>Publish</span>
              </div>
            </div>
          </header>

          <LibrarySummary blogs={blogs} projects={projects} reviews={reviews} backlinks={backlinks} />

          <nav className="crm-content-hub-nav" aria-label="Content sections">
            {CONTENT_SECTIONS.map(({ id, label, icon: Icon }) => {
              const count = id === 'blog' ? blogs.length : data[id].length;
              return (
              <button
                key={id}
                type="button"
                className={section === id ? 'active' : ''}
                onClick={() => setSection(id)}
              >
                <Icon size={15} />
                <span>{label}</span>
                <em>{count}</em>
              </button>
              );
            })}
          </nav>
        </>
      )}

      {section === 'blog' ? (
        <div className={`crm-content-hub-blog ${isEditingBlog ? 'editor-active' : ''}`}>
          <BlogsTab
            blogs={blogs}
            onSaveBlog={saveBlog}
            onDeleteBlog={deleteBlog}
            onToggleStatus={toggleBlogStatus}
            onDuplicateBlog={duplicateBlog}
            onEditorStateChange={setIsEditingBlog}
          />
        </div>
      ) : (
        <RecordsSection section={section} data={data} onAction={onAction} showNotification={showNotification} />
      )}
    </section>
  );
}