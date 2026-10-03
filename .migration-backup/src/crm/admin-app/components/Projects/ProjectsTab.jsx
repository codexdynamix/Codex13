import React, { useState, useEffect, useMemo, useRef } from 'react';
import './ProjectsTab.css';
import {
  Briefcase,
  Plus,
  Search,
  ExternalLink,
  Star,
  Eye,
  EyeOff,
  Edit3,
  Trash2,
  Copy,
  RefreshCw,
  CheckCircle2,
  SlidersHorizontal,
  LayoutGrid,
  List,
  Upload,
  Sparkles,
  Gauge,
  Image as ImageIcon,
  Check,
  X,
  ArrowUpRight,
  TrendingUp,
  Award,
  Layers,
  FileCode,
  Zap,
  Globe
} from 'lucide-react';
import { RECENT_WEB_PROJECTS } from '../../../../data/showcaseProjects';

const STORAGE_KEY = 'codex_custom_projects';

const CATEGORIES = [
  'All',
  'Websites & Web Apps',
  'CRMs & Calling Systems',
  'Graphic Design & Branding',
  'Meta & Google Ads',
  'Email Marketing',
  'Custom Software',
];

const PRESET_SAMPLE_IMAGES = [
  { label: 'E-Commerce Storefront', url: '/work/northline-logistics.jpg' },
  { label: 'VoIP Sales CRM', url: '/work/apex-sales.jpg' },
  { label: 'Branding & Figma UI', url: '/work/brand-identity.jpg' },
  { label: 'Performance Ads & Funnel', url: '/work/meta-ads.jpg' },
  { label: 'Lifecycle Marketing', url: '/work/email-marketing.jpg' },
  { label: 'FinTech Deal Pipeline', url: '/work/northline-logistics.jpg' },
];

export default function ProjectsTab({ showNotification = () => {} }) {
  // Projects State initialized from localStorage or default showcase data
  const [projects, setProjects] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      } catch (err) {
        console.error('Failed to parse stored projects', err);
      }
    }
    // Default to existing showcase projects
    return RECENT_WEB_PROJECTS.map(p => ({
      ...p,
      published: p.published !== false, // default published
    }));
  });

  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'published' | 'draft' | 'featured'
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'
  const [selectedIds, setSelectedIds] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [previewModalProject, setPreviewModalProject] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Form State for Create / Edit
  const [formData, setFormData] = useState({
    id: '',
    title: '',
    client: '',
    category: 'Websites & Web Apps',
    tag: '',
    completionDate: '2026',
    site_url: '',
    image: '',
    shortDescription: '',
    detailedDescription: '',
    challenge: '',
    solution: '',
    impact: '',
    techStack: [],
    newTechInput: '',
    metrics: [
      { label: 'Conversion Lift', value: '+45%', detail: 'In first 30 days' },
      { label: 'Lighthouse Score', value: '99/100', detail: 'Mobile & Desktop' },
    ],
    features: [
      'Sub-second edge rendering and zero layout shift',
      'Instant responsive layout & mobile optimization',
    ],
    newFeatureInput: '',
    lighthouse: {
      performance: 98,
      accessibility: 100,
      bestPractices: 100,
      seo: 100,
    },
    featured: false,
    published: true,
  });

  const fileInputRef = useRef(null);

  // Synchronize to localStorage, trigger storage events and postMessage to preview iframes
  const persistAndBroadcast = (updatedProjects) => {
    setProjects(updatedProjects);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedProjects));
      window.dispatchEvent(new CustomEvent('codex_projects_updated', { detail: updatedProjects }));

      // Broadcast to any active preview iframes
      const iframes = document.querySelectorAll('iframe');
      iframes.forEach(iframe => {
        try {
          iframe.contentWindow?.postMessage({
            type: 'CODEX_PROJECTS_UPDATE',
            projects: updatedProjects,
          }, '*');
        } catch {}
      });
    } catch (e) {
      console.error('Failed to persist projects', e);
    }
  };

  const handleSyncToSite = () => {
    setIsSyncing(true);
    persistAndBroadcast(projects);
    setTimeout(() => {
      setIsSyncing(false);
      showNotification('Client projects successfully synced to live portfolio showcase.');
    }, 400);
  };

  // Open modal for new project
  const handleOpenCreateModal = () => {
    setEditingProject(null);
    setFormData({
      id: `proj-${Date.now()}`,
      title: '',
      client: '',
      category: 'Websites & Web Apps',
      tag: 'Web Development · High-Performance',
      completionDate: 'Q4 2026',
      site_url: 'https://',
      image: '/work/northline-logistics.jpg',
      shortDescription: '',
      detailedDescription: '',
      challenge: '',
      solution: '',
      impact: '',
      techStack: ['React 19', 'TypeScript', 'Tailwind CSS'],
      newTechInput: '',
      metrics: [
        { label: 'Speed Score', value: '99/100', detail: 'Sub-second load' },
        { label: 'Conversion Lift', value: '+40%', detail: 'In first 30 days' },
      ],
      features: [
        'Edge-rendered sub-second page delivery',
        'Custom interactive UI component architecture',
      ],
      newFeatureInput: '',
      lighthouse: {
        performance: 99,
        accessibility: 100,
        bestPractices: 100,
        seo: 100,
      },
      featured: false,
      published: true,
    });
    setIsModalOpen(true);
  };

  // Open modal for editing existing project
  const handleOpenEditModal = (proj) => {
    setEditingProject(proj);
    setFormData({
      id: proj.id,
      title: proj.title || '',
      client: proj.client || '',
      category: proj.category || 'Websites & Web Apps',
      tag: proj.tag || '',
      completionDate: proj.completionDate || '2026',
      site_url: proj.site_url || '',
      image: proj.image || '',
      shortDescription: proj.shortDescription || '',
      detailedDescription: proj.detailedDescription || '',
      challenge: proj.challenge || '',
      solution: proj.solution || '',
      impact: proj.impact || '',
      techStack: Array.isArray(proj.techStack) ? [...proj.techStack] : [],
      newTechInput: '',
      metrics: Array.isArray(proj.metrics) ? proj.metrics.map(m => ({ ...m })) : [],
      features: Array.isArray(proj.features) ? [...proj.features] : [],
      newFeatureInput: '',
      lighthouse: proj.lighthouse || {
        performance: 98,
        accessibility: 100,
        bestPractices: 100,
        seo: 100,
      },
      featured: Boolean(proj.featured),
      published: proj.published !== false,
    });
    setIsModalOpen(true);
  };

  // Toggle Featured status
  const handleToggleFeatured = (id, e) => {
    e?.stopPropagation();
    const updated = projects.map(p => p.id === id ? { ...p, featured: !p.featured } : p);
    persistAndBroadcast(updated);
    const target = updated.find(p => p.id === id);
    showNotification(target.featured ? `Marked "${target.title}" as Featured.` : `Removed Featured from "${target.title}".`);
  };

  // Toggle Published status
  const handleTogglePublished = (id, e) => {
    e?.stopPropagation();
    const updated = projects.map(p => p.id === id ? { ...p, published: !p.published } : p);
    persistAndBroadcast(updated);
    const target = updated.find(p => p.id === id);
    showNotification(target.published ? `Published "${target.title}" to main site.` : `Unpublished "${target.title}" (hidden from main site).`);
  };

  // Duplicate Project
  const handleDuplicateProject = (proj, e) => {
    e?.stopPropagation();
    const newProj = {
      ...proj,
      id: `proj-${Date.now()}`,
      title: `${proj.title} (Copy)`,
      client: `${proj.client} (Clone)`,
      featured: false,
    };
    const updated = [newProj, ...projects];
    persistAndBroadcast(updated);
    showNotification(`Duplicated "${proj.title}".`);
  };

  // Delete single project
  const handleDeleteProject = (id, e) => {
    e?.stopPropagation();
    if (window.confirm('Are you sure you want to delete this project from the showcase?')) {
      const updated = projects.filter(p => p.id !== id);
      persistAndBroadcast(updated);
      setSelectedIds(prev => prev.filter(x => x !== id));
      showNotification('Project deleted.');
    }
  };

  // Bulk Delete
  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    if (window.confirm(`Are you sure you want to delete ${selectedIds.length} selected project(s)?`)) {
      const updated = projects.filter(p => !selectedIds.includes(p.id));
      persistAndBroadcast(updated);
      setSelectedIds([]);
      showNotification(`Deleted ${selectedIds.length} project(s).`);
    }
  };

  // Bulk Publish / Unpublish
  const handleBulkPublish = (publish = true) => {
    if (selectedIds.length === 0) return;
    const updated = projects.map(p => selectedIds.includes(p.id) ? { ...p, published: publish } : p);
    persistAndBroadcast(updated);
    showNotification(`${publish ? 'Published' : 'Unpublished'} ${selectedIds.length} project(s).`);
  };

  // Reset to Default 6 Showcase Projects
  const handleResetToDefaults = () => {
    if (window.confirm('Reset showcase to factory curated client projects? Custom uploaded projects will be replaced.')) {
      const defaults = RECENT_WEB_PROJECTS.map(p => ({ ...p, published: true }));
      persistAndBroadcast(defaults);
      showNotification('Reset to factory showcase projects.');
    }
  };

  // Image Upload handler (reads to Base64 DataURL or handles file)
  const handleImageFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showNotification('Image file is large (>5MB). Please select a compressed image.');
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      setFormData(prev => ({
        ...prev,
        image: uploadEvent.target.result
      }));
      showNotification('Image loaded into project preview.');
    };
    reader.readAsDataURL(file);
  };

  // Add Tech Tag
  const handleAddTechTag = () => {
    const tag = formData.newTechInput.trim();
    if (tag && !formData.techStack.includes(tag)) {
      setFormData(prev => ({
        ...prev,
        techStack: [...prev.techStack, tag],
        newTechInput: ''
      }));
    }
  };

  // Remove Tech Tag
  const handleRemoveTechTag = (tagToRemove) => {
    setFormData(prev => ({
      ...prev,
      techStack: prev.techStack.filter(t => t !== tagToRemove)
    }));
  };

  // Add Metric
  const handleAddMetric = () => {
    setFormData(prev => ({
      ...prev,
      metrics: [...prev.metrics, { label: 'New Metric', value: '+30%', detail: 'Performance metric' }]
    }));
  };

  // Update Metric
  const handleUpdateMetric = (index, field, value) => {
    setFormData(prev => {
      const nextMetrics = [...prev.metrics];
      nextMetrics[index] = { ...nextMetrics[index], [field]: value };
      return { ...prev, metrics: nextMetrics };
    });
  };

  // Remove Metric
  const handleRemoveMetric = (index) => {
    setFormData(prev => ({
      ...prev,
      metrics: prev.metrics.filter((_, i) => i !== index)
    }));
  };

  // Save Modal Project
  const handleSaveProjectForm = (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      showNotification('Please enter a project title.');
      return;
    }

    const projectRecord = {
      id: formData.id || `proj-${Date.now()}`,
      title: formData.title.trim(),
      client: formData.client.trim() || 'Enterprise Client',
      category: formData.category,
      tag: formData.tag.trim() || `${formData.category} · Client Work`,
      completionDate: formData.completionDate.trim() || '2026',
      site_url: formData.site_url.trim() || '',
      image: formData.image.trim() || '/work/northline-logistics.jpg',
      shortDescription: formData.shortDescription.trim() || `${formData.title} engineered for ${formData.client}.`,
      detailedDescription: formData.detailedDescription.trim() || formData.shortDescription.trim(),
      challenge: formData.challenge.trim() || 'Client required an upgraded high-performance web experience to elevate conversion and brand authority.',
      solution: formData.solution.trim() || 'Architected a custom digital platform utilizing modern edge rendering, intuitive UX, and robust integrations.',
      impact: formData.impact.trim() || 'Delivered significant business impact, heightened conversion velocity, and accelerated user engagement.',
      techStack: formData.techStack.length > 0 ? formData.techStack : ['React 19', 'TypeScript', 'Tailwind CSS'],
      metrics: formData.metrics.length > 0 ? formData.metrics : [{ label: 'Performance', value: '99/100', detail: 'Edge cached' }],
      features: formData.features.length > 0 ? formData.features : ['Responsive edge-rendered experience'],
      lighthouse: formData.lighthouse,
      featured: formData.featured,
      published: formData.published,
    };

    let updatedList;
    if (editingProject) {
      updatedList = projects.map(p => p.id === editingProject.id ? projectRecord : p);
      showNotification(`Updated project "${projectRecord.title}".`);
    } else {
      updatedList = [projectRecord, ...projects];
      showNotification(`Uploaded new project "${projectRecord.title}".`);
    }

    persistAndBroadcast(updatedList);
    setIsModalOpen(false);
  };

  // Filtered & Searched Projects list
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      const matchCat = activeCategory === 'All' || p.category === activeCategory;
      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'published' && p.published) ||
        (statusFilter === 'draft' && !p.published) ||
        (statusFilter === 'featured' && p.featured);

      if (!matchCat || !matchStatus) return false;

      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;

      const titleMatch = (p.title || '').toLowerCase().includes(q);
      const clientMatch = (p.client || '').toLowerCase().includes(q);
      const catMatch = (p.category || '').toLowerCase().includes(q);
      const tagMatch = (p.tag || '').toLowerCase().includes(q);
      const techMatch = Array.isArray(p.techStack) && p.techStack.some(t => t.toLowerCase().includes(q));

      return titleMatch || clientMatch || catMatch || tagMatch || techMatch;
    });
  }, [projects, activeCategory, statusFilter, searchQuery]);

  // Compute stat highlights
  const stats = useMemo(() => {
    const total = projects.length;
    const published = projects.filter(p => p.published).length;
    const featured = projects.filter(p => p.featured).length;
    const avgLighthouse = Math.round(
      projects.reduce((acc, p) => acc + (p.lighthouse?.performance || 98), 0) / (total || 1)
    );
    return { total, published, featured, avgLighthouse };
  }, [projects]);

  return (
    <div className="crm-projects-workspace">
      {/* ── Top Header ────────────────────────────────────────── */}
      <div className="crm-proj-header">
        <div className="crm-proj-title-group">
          <h2>
            <span className="crm-proj-title-icon">
              <Briefcase size={18} />
            </span>
            Client Projects & Portfolio Showcase
          </h2>
          <p>
            Upload and manage client projects that appear directly in the public <strong>/work</strong> and homepage showcase section of <strong>codexdynamics.com</strong>.
          </p>
        </div>

        <div className="crm-proj-header-actions">
          <button
            type="button"
            className="crm-btn-secondary"
            onClick={handleResetToDefaults}
            title="Reset to original 6 showcase projects"
          >
            <RefreshCw size={13} />
            <span>Reset Defaults</span>
          </button>

          <a
            href="/?page=work"
            target="_blank"
            rel="noreferrer"
            className="crm-btn-secondary"
            title="View live portfolio on public website"
          >
            <ExternalLink size={13} />
            <span>View on Site</span>
          </a>

          <button
            type="button"
            className="crm-btn-secondary"
            onClick={handleSyncToSite}
            disabled={isSyncing}
            title="Force push showcase updates to website"
          >
            <Sparkles size={13} color="var(--crm-accent)" />
            <span>{isSyncing ? 'Syncing...' : 'Sync to Main Site'}</span>
          </button>

          <button
            type="button"
            className="crm-btn-primary"
            onClick={handleOpenCreateModal}
          >
            <Plus size={14} />
            <span>Upload New Project</span>
          </button>
        </div>
      </div>

      {/* ── Stat Counters ─────────────────────────────────────── */}
      <div className="crm-proj-stats-grid">
        <div className="crm-proj-stat-card">
          <div className="crm-proj-stat-icon">
            <Layers size={20} />
          </div>
          <div className="crm-proj-stat-info">
            <span className="crm-proj-stat-label">Total Projects</span>
            <span className="crm-proj-stat-value">{stats.total}</span>
          </div>
        </div>

        <div className="crm-proj-stat-card">
          <div className="crm-proj-stat-icon green">
            <CheckCircle2 size={20} />
          </div>
          <div className="crm-proj-stat-info">
            <span className="crm-proj-stat-label">Published on Site</span>
            <span className="crm-proj-stat-value">{stats.published}</span>
          </div>
        </div>

        <div className="crm-proj-stat-card">
          <div className="crm-proj-stat-icon">
            <Star size={20} />
          </div>
          <div className="crm-proj-stat-info">
            <span className="crm-proj-stat-label">Featured Showcases</span>
            <span className="crm-proj-stat-value">{stats.featured}</span>
          </div>
        </div>

        <div className="crm-proj-stat-card">
          <div className="crm-proj-stat-icon blue">
            <Gauge size={20} />
          </div>
          <div className="crm-proj-stat-info">
            <span className="crm-proj-stat-label">Avg. Lighthouse</span>
            <span className="crm-proj-stat-value">{stats.avgLighthouse}/100</span>
          </div>
        </div>
      </div>

      {/* ── Filter & Search Toolbar ───────────────────────────── */}
      <div className="crm-proj-toolbar">
        <div className="crm-proj-toolbar-top">
          <div className="crm-proj-search-box">
            <Search size={15} className="crm-proj-search-icon" />
            <input
              type="text"
              className="crm-proj-search-input"
              placeholder="Search projects by title, client, or tech stack..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: 10, background: 'none', border: 'none', color: 'var(--crm-text-secondary)', cursor: 'pointer' }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="crm-proj-toolbar-actions">
            {/* Status Segmented Control */}
            <div className="crm-studio-segmented-tabs" style={{ padding: 2 }}>
              {[
                { id: 'all', label: 'All Status' },
                { id: 'published', label: 'Published' },
                { id: 'featured', label: 'Featured' },
                { id: 'draft', label: 'Draft' },
              ].map(st => (
                <button
                  key={st.id}
                  type="button"
                  className={`crm-studio-tab-btn ${statusFilter === st.id ? 'active' : ''}`}
                  onClick={() => setStatusFilter(st.id)}
                  style={{ padding: '4px 10px', fontSize: 11.5 }}
                >
                  {st.label}
                </button>
              ))}
            </div>

            {/* View Mode (Grid vs Table) */}
            <div className="crm-studio-segmented-tabs" style={{ padding: 2 }}>
              <button
                type="button"
                className={`crm-studio-tab-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
                title="Grid Card View"
                style={{ padding: '4px 8px' }}
              >
                <LayoutGrid size={13} />
              </button>
              <button
                type="button"
                className={`crm-studio-tab-btn ${viewMode === 'table' ? 'active' : ''}`}
                onClick={() => setViewMode('table')}
                title="Table View"
                style={{ padding: '4px 8px' }}
              >
                <List size={13} />
              </button>
            </div>
          </div>
        </div>

        {/* Category Pills */}
        <div className="crm-proj-category-pills">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              type="button"
              className={`crm-proj-cat-pill ${activeCategory === cat ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* ── Bulk Actions Floating Bar (When items selected) ──── */}
      {selectedIds.length > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          background: '#2B313A',
          border: '1px solid var(--crm-border)',
          borderRadius: 8,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
        }}>
          <span style={{ fontSize: 12.5, color: 'var(--crm-text-primary)', fontWeight: 600 }}>
            {selectedIds.length} project(s) selected
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="crm-btn-secondary"
              style={{ padding: '4px 10px', fontSize: 11.5 }}
              onClick={() => handleBulkPublish(true)}
            >
              Publish Selected
            </button>
            <button
              type="button"
              className="crm-btn-secondary"
              style={{ padding: '4px 10px', fontSize: 11.5 }}
              onClick={() => handleBulkPublish(false)}
            >
              Unpublish Selected
            </button>
            <button
              type="button"
              className="crm-super-admin-btn crm-super-admin-btn-small"
              style={{ background: '#c0392b', color: '#fff', padding: '4px 10px', fontSize: 11.5 }}
              onClick={handleBulkDelete}
            >
              Delete Selected
            </button>
          </div>
        </div>
      )}

      {/* ── Project Cards Grid View ───────────────────────────── */}
      {viewMode === 'grid' && (
        <div className="crm-proj-grid">
          {filteredProjects.map(proj => {
            const isSelected = selectedIds.includes(proj.id);
            const perfScore = proj.lighthouse?.performance || 98;

            return (
              <div
                key={proj.id}
                className={`crm-proj-card ${proj.featured ? 'featured' : ''}`}
                style={isSelected ? { borderColor: 'var(--crm-accent)', background: '#252932' } : {}}
              >
                {/* Media Image & Status Badges */}
                <div className="crm-proj-card-media">
                  <img
                    src={proj.image || '/work/northline-logistics.jpg'}
                    alt={proj.title}
                    className="crm-proj-card-img"
                    onError={(e) => { e.currentTarget.src = '/work/northline-logistics.jpg'; }}
                  />

                  <div className="crm-proj-media-badges">
                    <div className="crm-proj-badge-left">
                      <span className={`crm-proj-status-badge ${proj.published ? 'published' : 'draft'}`}>
                        {proj.published ? 'Live on Site' : 'Draft'}
                      </span>
                      {proj.featured && (
                        <span className="crm-proj-featured-badge">
                          <Star size={10} fill="#121418" /> Featured
                        </span>
                      )}
                    </div>

                    <div className="crm-proj-lighthouse-chip" title="Google Lighthouse Score">
                      <Zap size={10} />
                      <span>{perfScore}/100</span>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="crm-proj-card-content">
                  <div className="crm-proj-card-meta">
                    <span className="crm-proj-card-client">{proj.client}</span>
                    <span className="crm-proj-card-date">{proj.completionDate || '2026'}</span>
                  </div>

                  <h3 className="crm-proj-card-title">{proj.title}</h3>
                  <p className="crm-proj-card-desc">{proj.shortDescription}</p>

                  {/* Highlights Metrics */}
                  {Array.isArray(proj.metrics) && proj.metrics.length > 0 && (
                    <div className="crm-proj-metrics-row">
                      {proj.metrics.slice(0, 2).map((m, idx) => (
                        <div key={idx} className="crm-proj-metric-item">
                          <span className="crm-proj-metric-val">{m.value}</span>
                          <span className="crm-proj-metric-lbl">{m.label}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Tech Tags */}
                  {Array.isArray(proj.techStack) && proj.techStack.length > 0 && (
                    <div className="crm-proj-tech-tags">
                      {proj.techStack.slice(0, 4).map(tech => (
                        <span key={tech} className="crm-proj-tag-pill">{tech}</span>
                      ))}
                      {proj.techStack.length > 4 && (
                        <span className="crm-proj-tag-pill" style={{ opacity: 0.7 }}>
                          +{proj.techStack.length - 4}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Card Footer Actions */}
                  <div className="crm-proj-card-footer">
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 11.5, color: 'var(--crm-text-secondary)' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {
                          setSelectedIds(prev =>
                            isSelected ? prev.filter(x => x !== proj.id) : [...prev, proj.id]
                          );
                        }}
                      />
                      <span>Select</span>
                    </label>

                    <div className="crm-proj-card-actions">
                      {proj.site_url && (
                        <a
                          href={proj.site_url}
                          target="_blank"
                          rel="noreferrer"
                          className="crm-proj-action-btn"
                          title="Open live client website"
                        >
                          <Globe size={13} />
                        </a>
                      )}

                      <button
                        type="button"
                        className={`crm-proj-action-btn star ${proj.featured ? 'active' : ''}`}
                        onClick={(e) => handleToggleFeatured(proj.id, e)}
                        title={proj.featured ? 'Remove featured' : 'Mark as featured showcase'}
                      >
                        <Star size={13} fill={proj.featured ? 'currentColor' : 'none'} />
                      </button>

                      <button
                        type="button"
                        className="crm-proj-action-btn"
                        onClick={(e) => handleTogglePublished(proj.id, e)}
                        title={proj.published ? 'Unpublish from main site' : 'Publish to main site'}
                      >
                        {proj.published ? <Eye size={13} color="#0ECB81" /> : <EyeOff size={13} />}
                      </button>

                      <button
                        type="button"
                        className="crm-proj-action-btn"
                        onClick={(e) => handleDuplicateProject(proj, e)}
                        title="Duplicate project"
                      >
                        <Copy size={13} />
                      </button>

                      <button
                        type="button"
                        className="crm-proj-action-btn"
                        onClick={() => handleOpenEditModal(proj)}
                        title="Edit project details"
                      >
                        <Edit3 size={13} />
                      </button>

                      <button
                        type="button"
                        className="crm-proj-action-btn delete"
                        onClick={(e) => handleDeleteProject(proj.id, e)}
                        title="Delete project"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Table View ────────────────────────────────────────── */}
      {viewMode === 'table' && (
        <div className="crm-proj-table-wrap">
          <table className="crm-proj-table">
            <thead>
              <tr>
                <th style={{ width: 40, textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={filteredProjects.length > 0 && selectedIds.length === filteredProjects.length}
                    onChange={() => {
                      if (selectedIds.length === filteredProjects.length) {
                        setSelectedIds([]);
                      } else {
                        setSelectedIds(filteredProjects.map(p => p.id));
                      }
                    }}
                  />
                </th>
                <th style={{ width: 60 }}>Cover</th>
                <th>Project Title & Client</th>
                <th>Category</th>
                <th style={{ textAlign: 'center' }}>Lighthouse</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'center' }}>Featured</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.map(proj => {
                const isSelected = selectedIds.includes(proj.id);
                return (
                  <tr key={proj.id} style={isSelected ? { background: 'color-mix(in srgb, var(--crm-accent) 5%, transparent)' } : {}}>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {
                          setSelectedIds(prev =>
                            isSelected ? prev.filter(x => x !== proj.id) : [...prev, proj.id]
                          );
                        }}
                      />
                    </td>
                    <td>
                      <img
                        src={proj.image || '/work/northline-logistics.jpg'}
                        alt={proj.title}
                        style={{ width: 44, height: 32, borderRadius: 5, objectFit: 'cover' }}
                      />
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#FFFFFF' }}>{proj.title}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--crm-accent)', marginTop: 2 }}>{proj.client}</div>
                    </td>
                    <td>
                      <span className="crm-proj-tag-pill">{proj.category}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ color: '#0ECB81', fontWeight: 700, fontSize: 12 }}>
                        {proj.lighthouse?.performance || 98}/100
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={(e) => handleTogglePublished(proj.id, e)}
                        className={`crm-proj-status-badge ${proj.published ? 'published' : 'draft'}`}
                        style={{ cursor: 'pointer', border: 'none' }}
                      >
                        {proj.published ? 'Live' : 'Draft'}
                      </button>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={(e) => handleToggleFeatured(proj.id, e)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: proj.featured ? 'var(--crm-accent)' : '#555D6C' }}
                      >
                        <Star size={16} fill={proj.featured ? 'var(--crm-accent)' : 'none'} />
                      </button>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                          type="button"
                          className="crm-proj-action-btn"
                          onClick={() => handleOpenEditModal(proj)}
                          title="Edit"
                        >
                          <Edit3 size={12} />
                        </button>
                        <button
                          type="button"
                          className="crm-proj-action-btn delete"
                          onClick={(e) => handleDeleteProject(proj.id, e)}
                          title="Delete"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty State */}
      {filteredProjects.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '40px 20px',
          background: '#21252D',
          borderRadius: 12,
          border: '1px dashed var(--crm-card)'
        }}>
          <Briefcase size={36} color="var(--crm-text-secondary)" style={{ margin: '0 auto 12px' }} />
          <h4 style={{ color: '#FFFFFF', margin: '0 0 6px' }}>No projects found</h4>
          <p style={{ color: 'var(--crm-text-secondary)', fontSize: 13, margin: '0 0 16px' }}>
            No projects match the selected category or search query.
          </p>
          <button
            type="button"
            className="crm-btn-primary"
            onClick={handleOpenCreateModal}
          >
            <Plus size={14} />
            <span>Upload New Project</span>
          </button>
        </div>
      )}

      {/* ── Upload & Edit Modal ───────────────────────────────── */}
      {isModalOpen && (
        <div className="crm-proj-modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="crm-proj-modal" onClick={e => e.stopPropagation()}>
            <div className="crm-proj-modal-header">
              <h3>
                <Briefcase size={18} color="var(--crm-accent)" />
                <span>{editingProject ? 'Edit Client Project' : 'Upload New Client Project'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--crm-text-secondary)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveProjectForm} className="crm-proj-modal-body">
              {/* 1. Core Identification */}
              <div className="crm-proj-form-section">
                <span className="crm-proj-section-title">1. Project Identity & Client</span>

                <div className="crm-proj-form-grid-2">
                  <div className="crm-proj-form-group">
                    <label>Project Title *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. ApexStore: Headless E-Commerce Web App"
                      value={formData.title}
                      onChange={e => setFormData({ ...formData, title: e.target.value })}
                    />
                  </div>

                  <div className="crm-proj-form-group">
                    <label>Client / Brand Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Northline Global Commerce"
                      value={formData.client}
                      onChange={e => setFormData({ ...formData, client: e.target.value })}
                    />
                  </div>
                </div>

                <div className="crm-proj-form-grid-2">
                  <div className="crm-proj-form-group">
                    <label>Category</label>
                    <select
                      value={formData.category}
                      onChange={e => setFormData({ ...formData, category: e.target.value })}
                    >
                      {CATEGORIES.filter(c => c !== 'All').map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div className="crm-proj-form-group">
                    <label>Tag / Specialty Label</label>
                    <input
                      type="text"
                      placeholder="e.g. Web Development · E-Commerce"
                      value={formData.tag}
                      onChange={e => setFormData({ ...formData, tag: e.target.value })}
                    />
                  </div>
                </div>

                <div className="crm-proj-form-grid-2">
                  <div className="crm-proj-form-group">
                    <label>Live Website URL</label>
                    <input
                      type="url"
                      placeholder="https://client-project.com"
                      value={formData.site_url}
                      onChange={e => setFormData({ ...formData, site_url: e.target.value })}
                    />
                  </div>

                  <div className="crm-proj-form-group">
                    <label>Completion Year / Quarter</label>
                    <input
                      type="text"
                      placeholder="e.g. Q4 2026"
                      value={formData.completionDate}
                      onChange={e => setFormData({ ...formData, completionDate: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* 2. Media & Thumbnail Upload */}
              <div className="crm-proj-form-section">
                <span className="crm-proj-section-title">2. Cover Media & Image Asset</span>

                <div
                  className="crm-proj-dropzone"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleImageFileChange}
                  />
                  <Upload size={24} color="var(--crm-accent)" />
                  <div style={{ fontSize: 13, color: '#FFFFFF', fontWeight: 600 }}>
                    Click or drag & drop project screenshot here
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--crm-text-secondary)' }}>
                    Supports PNG, JPG, WebP, AVIF up to 5MB
                  </div>
                </div>

                {formData.image && (
                  <div className="crm-proj-image-preview-wrap">
                    <img
                      src={formData.image}
                      alt="Project Preview"
                      className="crm-proj-image-preview"
                    />
                    <button
                      type="button"
                      className="crm-proj-remove-img-btn"
                      onClick={() => setFormData({ ...formData, image: '' })}
                      title="Remove image"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}

                <div className="crm-proj-form-group">
                  <label>Or enter Direct Image URL</label>
                  <input
                    type="text"
                    placeholder="/work/northline-logistics.jpg or https://..."
                    value={formData.image}
                    onChange={e => setFormData({ ...formData, image: e.target.value })}
                  />
                </div>

                {/* Quick Presets for Demo */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: 'var(--crm-text-secondary)', alignSelf: 'center' }}>Presets:</span>
                  {PRESET_SAMPLE_IMAGES.map(preset => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setFormData({ ...formData, image: preset.url })}
                      className="crm-btn-secondary"
                      style={{ padding: '2px 8px', fontSize: 11 }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Narrative & Case Study */}
              <div className="crm-proj-form-section">
                <span className="crm-proj-section-title">3. Case Study & Results Narrative</span>

                <div className="crm-proj-form-group">
                  <label>Short Description (Shown on cards)</label>
                  <textarea
                    rows={2}
                    placeholder="A sub-second e-commerce web application replacing a legacy monolith..."
                    value={formData.shortDescription}
                    onChange={e => setFormData({ ...formData, shortDescription: e.target.value })}
                  />
                </div>

                <div className="crm-proj-form-group">
                  <label>Client Challenge (Problem statement)</label>
                  <textarea
                    rows={2}
                    placeholder="A sluggish legacy storefront with 6.2s Time-to-Interactive..."
                    value={formData.challenge}
                    onChange={e => setFormData({ ...formData, challenge: e.target.value })}
                  />
                </div>

                <div className="crm-proj-form-group">
                  <label>Our Solution (What Codex Dynamics engineered)</label>
                  <textarea
                    rows={2}
                    placeholder="Built a high-performance React 19 storefront running on edge runtime..."
                    value={formData.solution}
                    onChange={e => setFormData({ ...formData, solution: e.target.value })}
                  />
                </div>

                <div className="crm-proj-form-group">
                  <label>Measurable Impact (Business results)</label>
                  <textarea
                    rows={2}
                    placeholder="+41% conversion rate increase in the first 30 days..."
                    value={formData.impact}
                    onChange={e => setFormData({ ...formData, impact: e.target.value })}
                  />
                </div>
              </div>

              {/* 4. Tech Stack Tags */}
              <div className="crm-proj-form-section">
                <span className="crm-proj-section-title">4. Technologies & Tools</span>

                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    placeholder="e.g. React 19, TypeScript, WebRTC..."
                    value={formData.newTechInput}
                    onChange={e => setFormData({ ...formData, newTechInput: e.target.value })}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTechTag();
                      }
                    }}
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="crm-btn-secondary"
                    onClick={handleAddTechTag}
                  >
                    Add Tag
                  </button>
                </div>

                <div className="crm-proj-tech-tags" style={{ minHeight: 32 }}>
                  {formData.techStack.map(tag => (
                    <span key={tag} className="crm-proj-tag-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTechTag(tag)}
                        style={{ background: 'none', border: 'none', color: 'var(--crm-text-secondary)', cursor: 'pointer', padding: 0 }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* 5. Metrics & Lighthouse */}
              <div className="crm-proj-form-section">
                <span className="crm-proj-section-title">5. Business Metrics & Lighthouse Speed</span>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {formData.metrics.map((m, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        type="text"
                        placeholder="Label (e.g. Conversion)"
                        value={m.label}
                        onChange={e => handleUpdateMetric(idx, 'label', e.target.value)}
                        style={{ flex: 1 }}
                      />
                      <input
                        type="text"
                        placeholder="Value (e.g. +45%)"
                        value={m.value}
                        onChange={e => handleUpdateMetric(idx, 'value', e.target.value)}
                        style={{ width: 110 }}
                      />
                      <input
                        type="text"
                        placeholder="Detail (e.g. In 30 days)"
                        value={m.detail}
                        onChange={e => handleUpdateMetric(idx, 'detail', e.target.value)}
                        style={{ flex: 1 }}
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveMetric(idx)}
                        style={{ background: 'none', border: 'none', color: '#F6465D', cursor: 'pointer' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="crm-btn-secondary"
                    style={{ alignSelf: 'flex-start', fontSize: 11.5 }}
                    onClick={handleAddMetric}
                  >
                    + Add Metric Highlight
                  </button>
                </div>

                {/* Lighthouse Performance Score Input */}
                <div className="crm-proj-form-grid-2" style={{ marginTop: 10 }}>
                  <div className="crm-proj-form-group">
                    <label>Lighthouse Performance Score (0 - 100)</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={formData.lighthouse.performance}
                      onChange={e => setFormData({
                        ...formData,
                        lighthouse: { ...formData.lighthouse, performance: Number(e.target.value) || 98 }
                      })}
                    />
                  </div>
                  <div className="crm-proj-form-group">
                    <label>SEO Score (0 - 100)</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={formData.lighthouse.seo}
                      onChange={e => setFormData({
                        ...formData,
                        lighthouse: { ...formData.lighthouse, seo: Number(e.target.value) || 100 }
                      })}
                    />
                  </div>
                </div>
              </div>

              {/* 6. Visibility Toggles */}
              <div className="crm-proj-form-section" style={{ borderTop: '1px solid var(--crm-card)', paddingTop: 14 }}>
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.published}
                      onChange={e => setFormData({ ...formData, published: e.target.checked })}
                    />
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--crm-text-primary)' }}>
                      Publish Immediately to Website Showcase
                    </span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.featured}
                      onChange={e => setFormData({ ...formData, featured: e.target.checked })}
                    />
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--crm-accent)' }}>
                      Mark as Featured Showcase (Bento placement)
                    </span>
                  </label>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="crm-proj-modal-footer">
                <button
                  type="button"
                  className="crm-btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="crm-btn-primary"
                >
                  <Check size={14} />
                  <span>{editingProject ? 'Save Changes' : 'Upload & Publish'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
