import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Inbox,
  Download,
  Search,
  X,
  Plus,
  Trash2,
  Copy,
  ExternalLink,
  MessageSquare,
} from 'lucide-react';
import { StatusDropdown } from '../shared';
import { createLeadApi, deleteLeadApi, fetchAllLeads, updateLeadApi } from '../adminApi';

function formatRelativeTime(dateString) {
  if (!dateString) return '-';
  try {
    const timestamp = new Date(dateString).getTime();
    if (isNaN(timestamp)) return dateString;
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return dateString;
  }
}

function cleanPhoneForWhatsApp(phone = '') {
  return String(phone).replace(/[^\d+]/g, '').replace(/^\+/, '');
}

function enquiryStatusFromLead(lead) {
  const stage = String(lead?.status || lead?.stage || 'new').trim().toLowerCase();
  if (['new', 'new intake'].includes(stage)) return 'new';
  if (['deposit', 'converted', 'won', 'client'].includes(stage)) return 'converted';
  if (['closed', 'lost', 'not interested', 'failed deposit', "didn't register", 'no potential'].includes(stage)) {
    return 'closed';
  }
  return 'contacted';
}

function leadStageFromEnquiryStatus(status) {
  return {
    new: 'New',
    contacted: 'In Line',
    converted: 'Deposit',
    closed: 'Not Interested',
  }[status] || 'New';
}

function mapLeadToEnquiry(lead) {
  const name = lead.name || `${lead.firstName || ''} ${lead.lastName || ''}`.trim();
  return {
    id: lead.id,
    leadId: lead.id,
    name: name || 'Anonymous Inquiry',
    email: lead.email || '',
    phone: lead.phone || '',
    company: lead.company || '',
    service: lead.service || 'General Inquiry',
    budget: lead.budget || '',
    timeline: lead.timeline || '',
    message: lead.message || '',
    source: lead.source || 'website_contact_modal',
    status: enquiryStatusFromLead(lead),
    stage: lead.stage || lead.status || 'New',
    created_at: lead.createdAt || lead.created_at || new Date().toISOString(),
    notes: lead.notes || '',
  };
}

function EnquiryMessagePreview({ message, name, service, budget, timeline, created_at }) {
  const [isHovered, setIsHovered] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, showAbove: false });
  const triggerRef = useRef(null);

  const cleanMsg = (message || '').trim();

  const handleMouseEnter = () => {
    if (!cleanMsg) return;
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const popoverWidth = 380;
      const left = Math.max(12, Math.min(rect.left - 20, window.innerWidth - popoverWidth - 20));
      const showAbove = rect.bottom + 260 > window.innerHeight && rect.top > 260;
      const top = showAbove ? rect.top - 8 : rect.bottom + 8;
      setCoords({ top, left, showAbove });
    }
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  return (
    <div
      ref={triggerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ position: 'relative', width: '100%', maxWidth: 170 }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          height: 26,
          padding: '0 8px',
          borderRadius: 6,
          background: isHovered ? '#282D37' : '#1F242D',
          border: `1px solid ${isHovered ? 'var(--crm-accent)' : 'var(--crm-border)'}`,
          cursor: cleanMsg ? 'pointer' : 'default',
          transition: 'all 0.15s ease',
          boxSizing: 'border-box',
          width: '100%',
        }}
      >
        <MessageSquare
          size={12}
          style={{
            color: isHovered ? 'var(--crm-accent)' : cleanMsg ? '#0A84FF' : '#555E6E',
            flexShrink: 0,
            transition: 'color 0.15s ease',
          }}
        />
        <span
          style={{
            color: isHovered ? '#FFFFFF' : cleanMsg ? '#D1D4DC' : '#707784',
            fontSize: 11.5,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            fontStyle: cleanMsg ? 'normal' : 'italic',
            flex: 1,
            lineHeight: '24px',
          }}
        >
          {cleanMsg || 'No message'}
        </span>
      </div>

      {isHovered && cleanMsg && (
        <div
          style={{
            position: 'fixed',
            top: coords.showAbove ? undefined : coords.top,
            bottom: coords.showAbove ? window.innerHeight - coords.top : undefined,
            left: coords.left,
            width: 380,
            maxWidth: 'calc(100vw - 32px)',
            background: '#181B22',
            border: '1px solid var(--crm-border)',
            borderRadius: 10,
            padding: '14px 16px',
            boxShadow: '0 18px 48px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.08)',
            zIndex: 999999,
            pointerEvents: 'none',
            animation: 'crmFadeIn 0.12s ease-out',
          }}
        >
          {/* Popover Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
              paddingBottom: 8,
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: 'var(--crm-accent)',
                  color: '#FFFFFF',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11.5,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {name ? name.charAt(0).toUpperCase() : 'C'}
              </span>
              <div>
                <div style={{ color: '#FFFFFF', fontSize: 13, fontWeight: 600 }}>
                  {name || 'Prospective Client'}
                </div>
                {service && (
                  <div style={{ color: '#0A84FF', fontSize: 11, fontWeight: 500 }}>
                    {service}
                  </div>
                )}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span
                style={{
                  display: 'inline-block',
                  background: 'color-mix(in srgb, var(--crm-accent) 15%, transparent)',
                  color: 'var(--crm-accent)',
                  fontSize: 9.5,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  padding: '1px 6px',
                  borderRadius: 4,
                  marginBottom: 2,
                }}
              >
                Inquiry Message
              </span>
              {created_at && (
                <div style={{ color: 'var(--crm-text-secondary)', fontSize: 10.5 }}>
                  {formatRelativeTime(created_at)}
                </div>
              )}
            </div>
          </div>

          {/* Popover Message Content: Multi-line, Pre-wrap, Proper Line Height */}
          <div
            style={{
              color: '#F4F5F7',
              fontSize: 12.5,
              lineHeight: 1.65,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              overflowWrap: 'break-word',
              maxHeight: 280,
              overflowY: 'auto',
              background: 'rgba(0, 0, 0, 0.4)',
              borderRadius: 8,
              padding: '12px 14px',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              fontStyle: 'normal',
            }}
          >
            "{cleanMsg}"
          </div>

          {/* Popover Footer Badges */}
          {(budget || timeline) && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginTop: 10,
                paddingTop: 8,
                borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                flexWrap: 'wrap',
              }}
            >
              {budget && (
                <span
                  style={{
                    fontSize: 11,
                    color: '#0ECB81',
                    background: 'rgba(14, 203, 129, 0.12)',
                    border: '1px solid rgba(14, 203, 129, 0.25)',
                    padding: '2px 7px',
                    borderRadius: 4,
                    fontFamily: 'monospace',
                    fontWeight: 600,
                  }}
                >
                  Budget: {budget}
                </span>
              )}
              {timeline && (
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--crm-accent)',
                    background: 'color-mix(in srgb, var(--crm-accent) 12%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--crm-accent) 25%, transparent)',
                    padding: '2px 7px',
                    borderRadius: 4,
                    fontWeight: 500,
                  }}
                >
                  Timeline: {timeline}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function EnquiriesWorkspace({
  showNotification = () => {},
  onOpenLeadProfile = null,
  leads = [],
}) {
  const [localList, setLocalList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    let active = true;
    const loadFromApi = async (initial = false) => {
      if (initial) setIsLoading(true);
      try {
        const result = await fetchAllLeads();
        if (!active) return;
        const items = (result.leads || [])
          .filter((lead) => !lead.deletedAt)
          .map(mapLeadToEnquiry)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setLocalList(items);
        setLoadError('');
      } catch (error) {
        if (active) setLoadError(error?.message || 'Could not load inquiries from the CRM API.');
      } finally {
        if (active && initial) setIsLoading(false);
      }
    };

    loadFromApi(true);
    const handleFocus = () => loadFromApi(false);
    window.addEventListener('focus', handleFocus);
    return () => {
      active = false;
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Statistics matching platform KPI boxes
  const stats = useMemo(() => {
    const total = localList.length;
    const newCount = localList.filter((e) => e.status === 'new').length;
    const contactedCount = localList.filter((e) => e.status === 'contacted').length;
    const convertedCount = localList.filter((e) => e.status === 'converted' || e.status === 'closed').length;
    return { total, newCount, contactedCount, convertedCount };
  }, [localList]);

  // Services list for filter
  const serviceOptions = useMemo(() => {
    const set = new Set();
    localList.forEach((e) => {
      if (e.service) set.add(e.service);
    });
    return Array.from(set);
  }, [localList]);

  // Filtered inquiries
  const filteredList = useMemo(() => {
    return localList.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) {
        return false;
      }
      if (serviceFilter !== 'all' && item.service !== serviceFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = item.name?.toLowerCase().includes(q);
        const matchEmail = item.email?.toLowerCase().includes(q);
        const matchPhone = item.phone?.toLowerCase().includes(q);
        const matchCompany = item.company?.toLowerCase().includes(q);
        const matchService = item.service?.toLowerCase().includes(q);
        const matchMessage = item.message?.toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchPhone && !matchCompany && !matchService && !matchMessage) {
          return false;
        }
      }
      return true;
    });
  }, [localList, statusFilter, serviceFilter, searchQuery]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter, serviceFilter]);

  // Paginated list
  const totalPages = Math.ceil(filteredList.length / pageSize) || 1;
  const paginatedList = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredList.slice(start, start + pageSize);
  }, [filteredList, page, pageSize]);

  // Selection handlers
  const handleToggleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(new Set([...selectedIds, ...paginatedList.map((i) => i.id)]));
    } else {
      const next = new Set(selectedIds);
      paginatedList.forEach((i) => next.delete(i.id));
      setSelectedIds(next);
    }
  };

  const handleToggleSelectOne = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  // Status updates
  const handleUpdateStatus = async (id, newStatus) => {
    const previous = localList.find((item) => item.id === id);
    setLocalList((prev) => prev.map((item) => (
      item.id === id ? { ...item, status: newStatus, stage: leadStageFromEnquiryStatus(newStatus) } : item
    )));
    try {
      await updateLeadApi(String(id), { stage: leadStageFromEnquiryStatus(newStatus) });
      showNotification(`Inquiry updated to "${newStatus}".`);
    } catch (error) {
      if (previous) {
        setLocalList((prev) => prev.map((item) => (item.id === id ? previous : item)));
      }
      showNotification(`Could not update inquiry: ${error?.message || 'API request failed.'}`);
    }
  };

  // Delete single inquiry
  const handleDeleteEnquiry = async (id, name = 'Inquiry') => {
    if (!window.confirm(`Delete inquiry from "${name}"?`)) return;
    try {
      await deleteLeadApi(String(id));
      setLocalList((prev) => prev.filter((item) => item.id !== id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      showNotification(`Deleted inquiry from ${name}.`);
    } catch (error) {
      showNotification(`Could not delete inquiry: ${error?.message || 'API request failed.'}`);
    }
  };

  // Bulk status update
  const handleBulkUpdateStatus = async (status) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const results = await Promise.allSettled(ids.map((id) => (
      updateLeadApi(String(id), { stage: leadStageFromEnquiryStatus(status) })
    )));
    const succeeded = new Set(ids.filter((_, index) => results[index].status === 'fulfilled'));
    setLocalList((prev) => prev.map((item) => (
      succeeded.has(item.id)
        ? { ...item, status, stage: leadStageFromEnquiryStatus(status) }
        : item
    )));
    const failed = ids.length - succeeded.size;
    showNotification(failed
      ? `Updated ${succeeded.size} inquiries; ${failed} could not be updated.`
      : `Updated ${ids.length} inquiries to "${status}".`);
    setSelectedIds(new Set());
  };

  // Bulk delete
  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!window.confirm(`Delete ${ids.length} selected inquiries?`)) return;
    const results = await Promise.allSettled(ids.map((id) => deleteLeadApi(String(id))));
    const succeeded = new Set(ids.filter((_, index) => results[index].status === 'fulfilled'));
    setLocalList((prev) => prev.filter((item) => !succeeded.has(item.id)));
    const failed = ids.length - succeeded.size;
    showNotification(failed
      ? `Deleted ${succeeded.size} inquiries; ${failed} could not be deleted.`
      : `Deleted ${ids.length} inquiries.`);
    setSelectedIds(new Set());
  };

  // Export CSV
  const handleExportCsv = () => {
    const items = selectedIds.size > 0 ? localList.filter((e) => selectedIds.has(e.id)) : filteredList;
    if (items.length === 0) {
      showNotification('No inquiries to export.');
      return;
    }
    const headers = ['ID', 'Name', 'Email', 'Phone', 'Company', 'Service', 'Budget', 'Timeline', 'Status', 'Date', 'Message'];
    const rows = items.map((e) => [
      e.id,
      `"${(e.name || '').replace(/"/g, '""')}"`,
      `"${(e.email || '').replace(/"/g, '""')}"`,
      `"${(e.phone || '').replace(/"/g, '""')}"`,
      `"${(e.company || '').replace(/"/g, '""')}"`,
      `"${(e.service || '').replace(/"/g, '""')}"`,
      `"${(e.budget || '').replace(/"/g, '""')}"`,
      `"${(e.timeline || '').replace(/"/g, '""')}"`,
      e.status,
      e.created_at,
      `"${(e.message || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `codex-enquiries-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    showNotification(`Exported ${items.length} inquiries to CSV.`);
  };

  // Export JSON
  const handleExportJson = () => {
    const items = selectedIds.size > 0 ? localList.filter((e) => selectedIds.has(e.id)) : filteredList;
    if (items.length === 0) {
      showNotification('No inquiries to export.');
      return;
    }
    const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `codex-enquiries-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    showNotification(`Exported ${items.length} inquiries to JSON.`);
  };

  // Open the unified lead profile modal that is created in CRM
  const handleOpenLead = (enquiry) => {
    let matched = null;
    const allLeads = Array.isArray(leads) ? leads : [];

    if (enquiry.leadId) {
      matched = allLeads.find((l) => l.id === enquiry.leadId);
    }
    if (!matched && enquiry.id) {
      matched = allLeads.find(
        (l) =>
          l.id === `ld_enq_${enquiry.id}` ||
          l.id === String(enquiry.id) ||
          l.enquiryId === enquiry.id
      );
    }
    if (!matched && enquiry.email) {
      const qEmail = enquiry.email.toLowerCase().trim();
      matched = allLeads.find(
        (l) => l.email && l.email.toLowerCase().trim() === qEmail
      );
    }
    if (!matched && enquiry.name) {
      const qName = enquiry.name.toLowerCase().trim();
      matched = allLeads.find(
        (l) => l.name && l.name.toLowerCase().trim() === qName
      );
    }

    // Merge or construct unified lead object with all intake details
    const parts = (enquiry.name || 'New Customer').trim().split(/\s+/);
    const first = parts[0] || 'New';
    const last = parts.slice(1).join(' ') || 'Lead';

    const unifiedLead = matched
      ? {
          ...matched,
          stage: enquiry.stage || matched.stage,
          status: enquiry.stage || matched.status || matched.stage,
          // Ensure all rich enquiry intake details are merged into the profile
          company: matched.company || enquiry.company || 'Individual / None',
          service: matched.service || enquiry.service || 'General Inquiry',
          funnel: matched.funnel || enquiry.service || 'Website Inquiry',
          budget: matched.budget || enquiry.budget || 'Not specified',
          timeline: matched.timeline || enquiry.timeline || 'Flexible',
          message: matched.message || enquiry.message || '',
          source: matched.source || enquiry.source || 'website_contact_modal',
          notes: matched.notes || enquiry.notes || '',
        }
      : {
          id: enquiry.leadId || `ld_enq_${enquiry.id || Date.now()}`,
          firstName: first,
          lastName: last,
          name: enquiry.name || `${first} ${last}`,
          email: enquiry.email || '',
          phone: enquiry.phone || '',
          country: enquiry.country || 'United Kingdom',
          countryCode: enquiry.countryCode || 'GB',
          company: enquiry.company || 'Individual / None',
          service: enquiry.service || 'General Inquiry',
          funnel: enquiry.service || 'Website Inquiry',
          budget: enquiry.budget || 'Not specified',
          timeline: enquiry.timeline || 'Flexible',
          message: enquiry.message || '',
          source: enquiry.source || 'website_contact_modal',
          stage: enquiry.stage || (enquiry.status === 'converted' ? 'Deposit' : enquiry.status === 'contacted' ? 'In Line' : 'New'),
          status: enquiry.status === 'converted' ? 'Deposit' : enquiry.status === 'contacted' ? 'In Line' : 'New',
          notes: enquiry.notes || '',
          registeredDate: new Date(enquiry.created_at || Date.now()).toLocaleDateString(),
          createdAt: enquiry.created_at || new Date().toISOString(),
          commentHistory: enquiry.message
            ? [
                {
                  id: `c_${Date.now()}`,
                  author: 'Website Intake',
                  text: `[${enquiry.service || 'Website Inquiry'}] ${enquiry.message}`,
                  timestamp: enquiry.created_at || new Date().toISOString(),
                },
              ]
            : [],
          statusHistory: [
            {
              id: `s_${Date.now()}`,
              status: 'New',
              timestamp: enquiry.created_at || new Date().toISOString(),
            },
          ],
        };

    if (onOpenLeadProfile) {
      onOpenLeadProfile(unifiedLead);
    }
  };

  const allPageSelected = paginatedList.length > 0 && paginatedList.every((i) => selectedIds.has(i.id));

  return (
    <div style={{ width: '100%' }}>
      {loadError && (
        <div role="alert" style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 8, background: 'rgba(255, 69, 58, 0.12)', color: '#FF8B83', fontSize: 12 }}>
          {loadError}
        </div>
      )}
      {isLoading && localList.length === 0 && (
        <div role="status" style={{ marginBottom: 12, color: 'var(--crm-text-secondary)', fontSize: 12 }}>
          Loading inquiries from the CRM…
        </div>
      )}
      {/* 1. Stat Summary Cards - Exactly Matching Leads Table Layout */}
      {/* 1. Metric Counter Boxes - Apple iOS Glass Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 18 }}>
        {[
          { label: 'Total Inquiries', value: stats.total, color: 'var(--crm-text-primary, #FFFFFF)', sub: 'Historical intake' },
          { label: 'New Intake', value: stats.newCount, color: '#30D158', sub: 'Awaiting first contact' },
          { label: 'Contacted', value: stats.contactedCount, color: 'var(--crm-accent, #0A84FF)', sub: 'In active discussion' },
          { label: 'Converted Client', value: stats.convertedCount, color: '#FF9F0A', sub: 'Moved to project' },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              background: 'var(--crm-card, #23242A)',
              border: '1px solid var(--crm-border, rgba(255, 255, 255, 0.08))',
              borderRadius: 14,
              padding: '14px 18px',
              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.15)',
              display: 'flex',
              flexDirection: 'column',
              transition: 'transform 0.15s ease, border-color 0.15s ease',
            }}
          >
            <div style={{ fontSize: 11, color: 'var(--crm-text-secondary, #8E8E93)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
              {s.label}
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: s.color, letterSpacing: '-0.02em', marginBottom: 2 }}>
              {s.value}
            </div>
            <div style={{ fontSize: 11, color: 'var(--crm-text-muted, #636366)' }}>
              {s.sub}
            </div>
          </div>
        ))}
      </div>

      {/* 2. Filters & Search Bar - Apple iOS Search Capsule */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 2, minWidth: 240 }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--crm-text-secondary, #8E8E93)' }} />
          <input
            type="text"
            className="crm-super-admin-input"
            placeholder="Search customer, email, phone, company, service..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', paddingLeft: 36, borderRadius: 9999, boxSizing: 'border-box' }}
          />
        </div>

        <select
          className="crm-super-admin-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ flex: 1, minWidth: 150, borderRadius: 9999 }}
        >
          <option value="all">All Statuses ({localList.length})</option>
          <option value="new">New Intake ({stats.newCount})</option>
          <option value="contacted">Contacted ({stats.contactedCount})</option>
          <option value="converted">Converted ({stats.convertedCount})</option>
          <option value="closed">Closed</option>
        </select>

        <select
          className="crm-super-admin-select"
          value={serviceFilter}
          onChange={(e) => setServiceFilter(e.target.value)}
          style={{ flex: 1, minWidth: 170, borderRadius: 9999 }}
        >
          <option value="all">All Services</option>
          {serviceOptions.map((svc) => (
            <option key={svc} value={svc}>
              {svc}
            </option>
          ))}
        </select>

        {(searchQuery || statusFilter !== 'all' || serviceFilter !== 'all') && (
          <button
            className="crm-super-admin-btn crm-super-admin-btn-small crm-super-admin-btn-secondary"
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('all');
              setServiceFilter('all');
              setPage(1);
            }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* 3. Action Toolbar & Bulk Operations - Apple iOS Buttons */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
        <button
          className="crm-super-admin-btn crm-super-admin-btn-small"
          style={{ background: 'var(--crm-accent, #0A84FF)', color: '#FFFFFF', fontWeight: 600 }}
          onClick={() => setIsAddModalOpen(true)}
        >
          <Plus size={14} /> Log Customer Enquiry
        </button>

        <button
          className="crm-super-admin-btn crm-super-admin-btn-small crm-super-admin-btn-secondary"
          onClick={handleExportCsv}
        >
          <Download size={14} /> Export CSV
        </button>

        <button
          className="crm-super-admin-btn crm-super-admin-btn-small crm-super-admin-btn-secondary"
          onClick={handleExportJson}
        >
          Export JSON
        </button>

        {selectedIds.size > 0 && (
          <>
            <span style={{ color: 'var(--crm-accent, #0A84FF)', fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span>{selectedIds.size} selected</span>
              <button
                onClick={() => setSelectedIds(new Set())}
                style={{
                  background: 'none',
                  border: '1px solid var(--crm-border, rgba(255, 255, 255, 0.15))',
                  color: 'var(--crm-text-secondary, #8E8E93)',
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 9999,
                  cursor: 'pointer',
                }}
              >
                Clear
              </button>
            </span>
            <span style={{ width: 1, height: 20, background: 'var(--crm-border, rgba(255, 255, 255, 0.1))' }} />
            <button
              className="crm-super-admin-btn crm-super-admin-btn-small"
              style={{ background: 'rgba(10,132,255,0.15)', color: '#0A84FF', border: '1px solid rgba(10,132,255,0.35)' }}
              onClick={() => handleBulkUpdateStatus('contacted')}
            >
              Mark Contacted
            </button>
            <button
              className="crm-super-admin-btn crm-super-admin-btn-small"
              style={{ background: 'rgba(48,209,88,0.15)', color: '#30D158', border: '1px solid rgba(48,209,88,0.35)' }}
              onClick={() => handleBulkUpdateStatus('converted')}
            >
              Mark Converted
            </button>
            <button
              className="crm-super-admin-btn crm-super-admin-btn-small"
              style={{ background: 'rgba(255,69,58,0.15)', color: '#FF453A', border: '1px solid rgba(255,69,58,0.35)' }}
              onClick={handleBulkDelete}
            >
              <Trash2 size={13} /> Delete Selected
            </button>
          </>
        )}
      </div>

      <div style={{ fontSize: 12, color: 'var(--crm-text-secondary)', marginBottom: 8 }}>
        Click any row to open the client profile. Showing {paginatedList.length} of {filteredList.length} enquiries (page {page}/{totalPages})
      </div>

      {/* 4. Table - Designed to fit cleanly on screen like the Leads Table */}
      <div
        className="crm-admin-table-container"
        style={{
          width: '100%',
          maxWidth: '100%',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          display: 'block',
          boxSizing: 'border-box',
        }}
      >
        <table className="crm-admin-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: 28 }}>
                <input
                  type="checkbox"
                  checked={allPageSelected}
                  onChange={handleToggleSelectAll}
                />
              </th>
              <th style={{ width: 75, whiteSpace: 'nowrap' }}>Client ID</th>
              <th>Customer</th>
              <th>Contact Details</th>
              <th>Service & Scope</th>
              <th style={{ minWidth: 120, maxWidth: 165 }}>Message Preview</th>
              <th style={{ width: 60, whiteSpace: 'nowrap' }}>Origin</th>
              <th style={{ width: 75, whiteSpace: 'nowrap' }}>Received</th>
              <th style={{ width: 115, whiteSpace: 'nowrap' }}>Status</th>
              <th style={{ width: 95, textAlign: 'right', whiteSpace: 'nowrap' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedList.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: 28, color: 'var(--crm-text-secondary)' }}>
                  No customer enquiries match your filters.
                </td>
              </tr>
            ) : (
              paginatedList.map((item) => {
                const isSelected = selectedIds.has(item.id);
                const displayId = item.leadId || `ld_${item.id}`;

                return (
                  <tr
                    key={item.id}
                    style={{
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(10, 132, 255, 0.12)' : undefined,
                    }}
                    onClick={() => handleOpenLead(item)}
                  >
                    {/* Checkbox */}
                    <td onClick={(e) => e.stopPropagation()} style={{ width: 28 }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelectOne(item.id)}
                      />
                    </td>

                    {/* Client ID with Copy */}
                    <td style={{ whiteSpace: 'nowrap', width: 75 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 12.5, color: 'var(--crm-text-primary)' }}>
                          {String(displayId).slice(0, 10)}
                        </span>
                        <button
                          title="Copy full ID"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(String(displayId));
                            showNotification('Client ID copied!');
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--crm-text-secondary)',
                            padding: '2px 4px',
                            lineHeight: 1,
                            borderRadius: 3,
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--crm-accent)')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--crm-text-secondary)')}
                        >
                          <Copy size={11} />
                        </button>
                      </div>
                    </td>

                    {/* Customer Name & Company (Stacked neatly like Leads table) */}
                    <td>
                      <div
                        style={{
                          fontWeight: 600,
                          color: 'var(--crm-text-primary)',
                          fontSize: 12.5,
                          maxWidth: 135,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {item.name}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: 'var(--crm-text-secondary)',
                          maxWidth: 135,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {item.company || 'Individual Client'}
                      </div>
                    </td>

                    {/* Contact Details (Email + Phone + WhatsApp) */}
                    <td onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {item.email && (
                          <a
                            href={`mailto:${item.email}`}
                            style={{
                              color: '#0A84FF',
                              textDecoration: 'none',
                              fontSize: 11.5,
                              maxWidth: 135,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              display: 'block',
                            }}
                            title={item.email}
                          >
                            {item.email}
                          </a>
                        )}
                        {item.phone && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <a
                              href={`tel:${item.phone}`}
                              style={{ color: 'var(--crm-text-secondary)', textDecoration: 'none', fontSize: 11 }}
                            >
                              {item.phone}
                            </a>
                            <a
                              href={`https://wa.me/${cleanPhoneForWhatsApp(item.phone)}?text=${encodeURIComponent(`Hi ${item.name}, thank you for contacting Codex Dynamics regarding ${item.service || 'your project'}.`)}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                color: '#0ECB81',
                                background: 'rgba(14,203,129,0.1)',
                                border: '1px solid rgba(14,203,129,0.3)',
                                borderRadius: 3,
                                padding: '1px 5px',
                                fontSize: 10,
                                textDecoration: 'none',
                                fontWeight: 600,
                              }}
                              title="Chat on WhatsApp"
                            >
                              WA
                            </a>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Service & Scope (Combined neatly to fit screen) */}
                    <td>
                      <div
                        style={{
                          color: 'var(--crm-text-primary)',
                          fontSize: 12,
                          fontWeight: 500,
                          maxWidth: 130,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {item.service || 'General Inquiry'}
                      </div>
                      {item.budget ? (
                        <span style={{ color: '#0ECB81', background: 'rgba(14,203,129,0.12)', padding: '1px 6px', borderRadius: 4, fontWeight: 600, fontSize: 10.5, fontFamily: 'monospace', display: 'inline-block', marginTop: 2 }}>
                          {item.budget}
                        </span>
                      ) : item.timeline ? (
                        <span style={{ color: 'var(--crm-accent)', background: 'color-mix(in srgb, var(--crm-accent) 12%, transparent)', padding: '1px 6px', borderRadius: 4, fontSize: 10.5, display: 'inline-block', marginTop: 2 }}>
                          {item.timeline}
                        </span>
                      ) : null}
                    </td>

                    {/* Message Preview (Interactive with Rich Hover Card) */}
                    <td onClick={(e) => e.stopPropagation()} style={{ minWidth: 120, maxWidth: 165 }}>
                      <EnquiryMessagePreview
                        message={item.message}
                        name={item.name}
                        service={item.service}
                        budget={item.budget}
                        timeline={item.timeline}
                        created_at={item.created_at}
                      />
                    </td>

                    {/* Origin */}
                    <td style={{ whiteSpace: 'nowrap', fontSize: 11, color: 'var(--crm-text-secondary)', width: 60 }}>
                      <span style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.08)', fontSize: 10.5 }}>
                        {item.source === 'website_contact_modal'
                          ? 'Modal'
                          : item.source === 'manual_crm_entry'
                          ? 'Manual'
                          : 'Form'}
                      </span>
                    </td>

                    {/* Received */}
                    <td
                      style={{ whiteSpace: 'nowrap', fontSize: 11, color: 'var(--crm-text-secondary)', width: 75 }}
                      title={new Date(item.created_at).toLocaleString()}
                    >
                      {formatRelativeTime(item.created_at)}
                    </td>

                    {/* Status Dropdown Menu (Designed consistently) */}
                    <td onClick={(e) => e.stopPropagation()} style={{ whiteSpace: 'nowrap', width: 115 }}>
                      <StatusDropdown
                        value={item.status}
                        options={[
                          { value: 'new', label: 'New' },
                          { value: 'contacted', label: 'Contacted' },
                          { value: 'converted', label: 'Converted' },
                          { value: 'closed', label: 'Closed' },
                        ]}
                        onChange={(nextStatus) => handleUpdateStatus(item.id, nextStatus)}
                      />
                    </td>

                    {/* Action Buttons */}
                    <td onClick={(e) => e.stopPropagation()} style={{ whiteSpace: 'nowrap', textAlign: 'right', width: 95 }}>
                      <button
                        className="crm-super-admin-btn crm-super-admin-btn-small"
                        style={{
                          fontSize: 11,
                          padding: '3px 8px',
                          background: '#3a7bd5',
                          color: '#fff',
                          fontWeight: 600,
                        }}
                        onClick={() => handleOpenLead(item)}
                        title="Open client profile"
                      >
                        Profile
                      </button>
                      <button
                        className="crm-super-admin-btn crm-super-admin-btn-small"
                        style={{
                          fontSize: 11,
                          padding: '3px 6px',
                          marginLeft: 4,
                          background: 'rgba(246,70,93,0.15)',
                          color: '#F6465D',
                          border: '1px solid rgba(246,70,93,0.3)',
                        }}
                        onClick={() => handleDeleteEnquiry(item.id, item.name)}
                        title="Delete enquiry"
                      >
                        🗑
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 5. Pagination Bar matching Leads table */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
          <button
            className="crm-super-admin-btn crm-super-admin-btn-small crm-pagination-btn-gold"
            disabled={page === 1}
            onClick={() => setPage(1)}
          >
            «
          </button>
          <button
            className="crm-super-admin-btn crm-super-admin-btn-small crm-pagination-btn-gold"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            ‹ Prev
          </button>
          <span style={{ color: 'var(--crm-text-secondary)', fontSize: 12 }}>
            Page {page} of {totalPages}
          </span>
          <button
            className="crm-super-admin-btn crm-super-admin-btn-small crm-pagination-btn-gold"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next ›
          </button>
          <button
            className="crm-super-admin-btn crm-super-admin-btn-small crm-pagination-btn-gold"
            disabled={page >= totalPages}
            onClick={() => setPage(totalPages)}
          >
            »
          </button>
        </div>
      )}

      {/* 6. Manual Log Enquiry Modal - Styled with CRM Platform Design */}
      {isAddModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            zIndex: 2000,
            overflowY: 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '32px 16px',
          }}
          onClick={() => setIsAddModalOpen(false)}
        >
          <div
            style={{
              background: 'var(--crm-card, #23242A)',
              border: '1px solid var(--crm-border, rgba(255, 255, 255, 0.1))',
              borderRadius: 16,
              width: '100%',
              maxWidth: 580,
              padding: 24,
              boxShadow: '0 24px 64px rgba(0, 0, 0, 0.55)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 18,
                paddingBottom: 14,
                borderBottom: '1px solid var(--crm-border, rgba(255, 255, 255, 0.08))',
              }}
            >
              <div>
                <span style={{ fontSize: 11, color: 'var(--crm-accent, #0A84FF)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Manual Intake</span>
                <h3 style={{ margin: 0, fontSize: 17, color: 'var(--crm-text-primary, #FFFFFF)', fontWeight: 700 }}>
                  Log Customer Enquiry / Lead
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="crm-modal-close-btn"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const name = String(formData.get('name') || 'Customer').trim();
                const [firstName, ...lastNameParts] = name.split(/\s+/);
                try {
                  const created = await createLeadApi({
                    firstName,
                    lastName: lastNameParts.join(' '),
                    email: String(formData.get('email') || ''),
                    phone: String(formData.get('phone') || ''),
                    company: String(formData.get('company') || ''),
                    service: String(formData.get('service') || 'General Inquiry'),
                    budget: String(formData.get('budget') || ''),
                    timeline: String(formData.get('timeline') || ''),
                    message: String(formData.get('message') || ''),
                    source: 'manual_crm_entry',
                    stage: 'New',
                  });
                  setLocalList((prev) => [mapLeadToEnquiry(created), ...prev]);
                  setIsAddModalOpen(false);
                  showNotification(`Logged customer inquiry from "${name}".`);
                } catch (error) {
                  showNotification(`Could not save inquiry: ${error?.message || 'API request failed.'}`);
                }
              }}
              style={{ display: 'grid', gap: 12 }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--crm-text-secondary)', display: 'block', marginBottom: 4 }}>
                    Customer Name *
                  </label>
                  <input
                    name="name"
                    required
                    placeholder="Full Name"
                    className="crm-super-admin-input"
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--crm-text-secondary)', display: 'block', marginBottom: 4 }}>
                    Company / Organization
                  </label>
                  <input
                    name="company"
                    placeholder="Business Name"
                    className="crm-super-admin-input"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--crm-text-secondary)', display: 'block', marginBottom: 4 }}>
                    Contact Email *
                  </label>
                  <input
                    name="email"
                    type="email"
                    required
                    placeholder="client@company.com"
                    className="crm-super-admin-input"
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--crm-text-secondary)', display: 'block', marginBottom: 4 }}>
                    Phone Number
                  </label>
                  <input
                    name="phone"
                    placeholder="+1 (555) 000-0000"
                    className="crm-super-admin-input"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--crm-text-secondary)', display: 'block', marginBottom: 4 }}>
                    Service Requested
                  </label>
                  <input
                    name="service"
                    defaultValue="High-Performance Website"
                    className="crm-super-admin-input"
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--crm-text-secondary)', display: 'block', marginBottom: 4 }}>
                    Estimated Budget
                  </label>
                  <input
                    name="budget"
                    placeholder="e.g. $15,000 - $25,000"
                    className="crm-super-admin-input"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, color: 'var(--crm-text-secondary)', display: 'block', marginBottom: 4 }}>
                  Customer Intake Message *
                </label>
                <textarea
                  name="message"
                  rows={3}
                  required
                  placeholder="Describe client requirements, project scope, or initial consultation notes..."
                  style={{
                    width: '100%',
                    background: 'var(--crm-bg)',
                    border: '1px solid var(--crm-border)',
                    borderRadius: 6,
                    color: 'var(--crm-text-primary)',
                    padding: '8px 10px',
                    fontSize: 12.5,
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="crm-super-admin-btn crm-super-admin-btn-small crm-super-admin-btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="crm-super-admin-btn crm-super-admin-btn-small"
                  style={{ background: '#0ECB81', color: '#FFFFFF', fontWeight: 600 }}
                >
                  Save & Register Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
