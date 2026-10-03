import React from 'react';
import { useConfirmDialog } from './components/ConfirmModal/ConfirmModal';
import './components/modal.css';
import { CountrySelect, PhoneInput, isPhoneValid, parseStoredPhone, buildStoredPhone } from './components/CountryPhoneInput/CountryPhoneInput';
import { COUNTRY_LIST, getCountryByCode, getCountryByName } from './countryData';
import { fetchLeadById } from './adminApi';

export const ROLE = {
  SUPER_ADMIN: 'Super Admin',
  OFFICE_MANAGER: 'Office Manager',
  TEAM_LEADER: 'Team Leader',
  AGENT: 'Agent',
};

export function assignableAgents(users, currentUser, { officeId = null, teamId = null } = {}) {
  return (users || []).filter((u) => {
    if (u.role !== ROLE.AGENT) return false;
    if (officeId && u.officeId !== officeId) return false;
    if (teamId && u.teamId !== teamId) return false;
    return true;
  });
}

export function assignableAgentLabel(agent) {
  return agent?.name || '-';
}

export const LEAD_STATUSES = ['New','In Line','No Answer','Deposit','Failed Deposit','Didn\'t Register','Not Interested','Low Potential','NA1','NA2','NA3','Never Answer','No Potential','Wrong Person','Wrong Number','Call Back'];

// Distinct color per lead stage so every pill in the status workflow timeline
// has its own identity instead of falling back to a generic gray.
export const STAGE_COLOR_MAP = {
  'New':              '#8ab89a',
  'In Line':          '#7a9bc4',
  'No Answer':        '#c9a86a',
  'Deposit':          '#7fb89a',
  'Failed Deposit':   '#d98a8a',
  "Didn't Register":  '#a89cc4',
  'Not Interested':   '#c89aa0',
  'Low Potential':    '#c9b56a',
  'NA1':              '#7eb5c0',
  'NA2':              '#6ea0ad',
  'NA3':              '#5e8a9a',
  'Never Answer':     '#c98a8a',
  'No Potential':     '#b07070',
  'Wrong Person':     '#c489a8',
  'Wrong Number':     '#b888c4',
  'Call Back':        '#7eb59a',
};

// Stable fallback palette for any unknown / future stage so we never grey-out.
// We hash the stage name to pick a palette slot deterministically.
const STAGE_FALLBACK_PALETTE = [
  '#a89cc4', '#7eb5b0', '#c9a085', '#7a9bc4', '#c9b56a',
  '#a0b88a', '#c98a8a', '#7eb5c0', '#b89cc4', '#d98a8a',
];

export const stageColor = (stage) => {
  if (!stage) return STAGE_FALLBACK_PALETTE[0];
  if (STAGE_COLOR_MAP[stage]) return STAGE_COLOR_MAP[stage];
  let hash = 0;
  for (let i = 0; i < stage.length; i += 1) {
    hash = (hash * 31 + stage.charCodeAt(i)) >>> 0;
  }
  return STAGE_FALLBACK_PALETTE[hash % STAGE_FALLBACK_PALETTE.length];
};

export function getStatusTheme(status) {
  const norm = String(status || '').toLowerCase().trim();
  if (norm === 'new') {
    return {
      dot: '#0ECB81',
      bg: 'rgba(14, 203, 129, 0.14)',
      color: '#0ECB81',
      border: 'rgba(14, 203, 129, 0.35)',
    };
  }
  if (norm === 'contacted' || norm === 'in line') {
    return {
      dot: '#0A84FF',
      bg: 'rgba(10, 132, 255, 0.14)',
      color: '#0A84FF',
      border: 'rgba(10, 132, 255, 0.35)',
    };
  }
  if (norm === 'converted' || norm === 'deposit' || norm === 'qualified' || norm === 'won') {
    return {
      dot: 'var(--crm-accent)',
      bg: 'color-mix(in srgb, var(--crm-accent) 15%, transparent)',
      color: 'var(--crm-accent)',
      border: 'color-mix(in srgb, var(--crm-accent) 35%, transparent)',
    };
  }
  if (norm === 'call back') {
    return {
      dot: '#7eb59a',
      bg: 'rgba(126, 181, 154, 0.16)',
      color: '#7eb59a',
      border: 'rgba(126, 181, 154, 0.35)',
    };
  }
  if (norm === 'no answer' || norm === 'na1' || norm === 'na2' || norm === 'na3') {
    return {
      dot: '#c9a86a',
      bg: 'rgba(201, 168, 106, 0.16)',
      color: '#c9a86a',
      border: 'rgba(201, 168, 106, 0.35)',
    };
  }
  if (norm === 'not interested' || norm === 'failed deposit' || norm === 'never answer' || norm === 'no potential') {
    return {
      dot: '#F6465D',
      bg: 'rgba(246, 70, 93, 0.14)',
      color: '#F6465D',
      border: 'rgba(246, 70, 93, 0.35)',
    };
  }
  if (norm === 'closed' || norm === 'archived' || norm === 'frozen' || norm === 'blocked') {
    return {
      dot: 'var(--crm-text-secondary)',
      bg: 'rgba(132, 142, 156, 0.14)',
      color: 'var(--crm-text-secondary)',
      border: 'rgba(132, 142, 156, 0.3)',
    };
  }
  // Custom fallback by stageColor
  const baseColor = stageColor(status);
  return {
    dot: baseColor,
    bg: `${baseColor}18`,
    color: baseColor,
    border: `${baseColor}40`,
  };
}

export function StatusDropdown({ value, options, onChange, disabled = false, style = {} }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [coords, setCoords] = React.useState({ top: 0, left: 0, showAbove: false, width: 130 });
  const buttonRef = React.useRef(null);
  const menuRef = React.useRef(null);
  const theme = getStatusTheme(value);

  const parsedOptions = React.useMemo(() => {
    return (options || []).map((opt) => {
      if (typeof opt === 'string') return { value: opt, label: opt };
      return { value: opt.value, label: opt.label || opt.value };
    });
  }, [options]);

  const currentOption = parsedOptions.find(
    (o) => String(o.value).toLowerCase() === String(value).toLowerCase()
  ) || {
    value,
    label: value || 'Select status',
  };

  const handleToggle = (e) => {
    e.stopPropagation();
    if (disabled) return;
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const menuHeight = Math.min(260, parsedOptions.length * 34 + 30);
      const showAbove = rect.bottom + menuHeight > window.innerHeight && rect.top > menuHeight;
      setCoords({
        top: showAbove ? rect.top - 5 : rect.bottom + 5,
        left: Math.max(8, Math.min(rect.left, window.innerWidth - 170)),
        showAbove,
        width: Math.max(124, rect.width),
      });
    }
    setIsOpen((prev) => !prev);
  };

  React.useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e) => {
      if (
        buttonRef.current &&
        !buttonRef.current.contains(e.target) &&
        menuRef.current &&
        !menuRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };
    const handleScrollOrResize = () => {
      setIsOpen(false);
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleOutsideClick, true);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick, true);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (val, e) => {
    if (e) e.stopPropagation();
    if (disabled) return;
    setIsOpen(false);
    if (val !== value && onChange) {
      onChange(val);
    }
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        position: 'relative',
        ...style,
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 6,
          height: 28,
          minWidth: 104,
          padding: '0 8px 0 9px',
          borderRadius: 6,
          background: isOpen ? '#282D37' : '#1F242D',
          border: `1px solid ${isOpen ? 'var(--crm-accent)' : 'var(--crm-border)'}`,
          color: 'var(--crm-text-primary)',
          fontSize: 12,
          fontWeight: 500,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          boxShadow: isOpen
            ? '0 0 0 2px color-mix(in srgb, var(--crm-accent) 25%, transparent)'
            : '0 1px 2px rgba(0, 0, 0, 0.25)',
          transition: 'all 0.15s ease',
          userSelect: 'none',
          whiteSpace: 'nowrap',
          boxSizing: 'border-box',
        }}
        onMouseEnter={(e) => {
          if (!disabled && !isOpen) {
            e.currentTarget.style.borderColor = '#555E6E';
            e.currentTarget.style.background = '#262B34';
          }
        }}
        onMouseLeave={(e) => {
          if (!disabled && !isOpen) {
            e.currentTarget.style.borderColor = 'var(--crm-border)';
            e.currentTarget.style.background = '#1F242D';
          }
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              backgroundColor: theme.dot,
              boxShadow: `0 0 6px ${theme.dot}90`,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              color: theme.color,
              fontWeight: 600,
              fontSize: 11.5,
              letterSpacing: '0.01em',
            }}
          >
            {currentOption.label}
          </span>
        </span>
        <svg
          style={{
            width: 10,
            height: 10,
            color: 'var(--crm-text-secondary)',
            transition: 'transform 0.15s ease',
            transform: isOpen ? 'rotate(180deg)' : 'none',
            flexShrink: 0,
            marginLeft: 2,
          }}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          role="listbox"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: coords.showAbove ? undefined : coords.top,
            bottom: coords.showAbove ? window.innerHeight - coords.top : undefined,
            left: coords.left,
            width: Math.max(140, coords.width),
            minWidth: 140,
            background: '#1F242D',
            border: '1px solid var(--crm-border)',
            borderRadius: 8,
            padding: 4,
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.08)',
            zIndex: 999999,
            animation: 'crmFadeIn 0.12s ease-out',
            maxHeight: 260,
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              padding: '4px 6px 4px 6px',
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--crm-text-secondary)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
              marginBottom: 3,
            }}
          >
            Change Status
          </div>
          {parsedOptions.map((opt) => {
            const isSelected =
              String(opt.value).toLowerCase() === String(value).toLowerCase();
            const optTheme = getStatusTheme(opt.value);
            return (
              <div
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                onClick={(e) => handleSelect(opt.value, e)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  padding: '6px 8px',
                  borderRadius: 5,
                  cursor: 'pointer',
                  background: isSelected ? 'color-mix(in srgb, var(--crm-accent) 12%, transparent)' : 'transparent',
                  color: isSelected ? '#FFFFFF' : 'var(--crm-text-primary)',
                  fontSize: 12,
                  fontWeight: isSelected ? 600 : 400,
                  transition: 'background 0.1s ease',
                  userSelect: 'none',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, overflow: 'hidden' }}>
                  <span
                    style={{
                      width: 6.5,
                      height: 6.5,
                      borderRadius: '50%',
                      backgroundColor: optTheme.dot,
                      boxShadow: `0 0 5px ${optTheme.dot}80`,
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {opt.label}
                  </span>
                </div>
                {isSelected && (
                  <svg
                    style={{ width: 12, height: 12, color: 'var(--crm-accent)', flexShrink: 0 }}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export const normalizeStage = (stage) => {
  if (!stage || typeof stage !== 'string') return 'Unknown';
  const normalized = stage.trim();
  if (normalized.toLowerCase() === 'contacted') {
    // 'Contacted' is intentionally removed as a visible status in Agent Portfolio.
    return 'In Line';
  }
  return normalized;
};

export const NotificationContext = React.createContext(null);
export const DataContext = React.createContext(null);

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 30, color: '#fff', background: 'var(--crm-bg)', minHeight: '100vh' }}>
          <h1>Something went wrong</h1>
          <p>{this.state.error?.message || 'Unexpected error.'}</p>
          <p>Check console for details.</p>
        </div>
      );
    }

    return this.props.children;
  }
}

export const makeLoginLink = (userId, role) => {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  if (!role || role === ROLE.SUPER_ADMIN) return `${origin}/admin/login/super-admin`;
  if (role === ROLE.OFFICE_MANAGER) return `${origin}/admin/login/office-manager`;
  if (role === ROLE.TEAM_LEADER) return `${origin}/admin/login/team-leader`;
  if (role === ROLE.AGENT) return `${origin}/admin/login/agent`;
  return `${origin}/admin/staff-login`;
};

/**
 * initialData
 *
 * Empty bootstrap state. The admin app is backend-driven: offices, teams,
 * staff (admins/agents) and leads come from the CRM API on every mount.
 * We intentionally do NOT seed any mock offices, teams,
 * agents, or leads here - those would otherwise drown out the real records
 * the user creates and persists through the CRM panels.
 */
export const initialData = {
  users: [
    {
      id: "adm_sa",
      name: "Sarah Admin",
      email: "superadmin@codexdynamics.com",
      role: "Super Admin",
      status: "Active",
      isLoggedIn: true,
      lastLoginAt: new Date().toISOString(),
      capabilities: {
        lead_upload: true,
        create_agent: true,
        registrations: true,
        notifications: true,
        security: true,
      },
    },
    {
      id: "adm_om",
      name: "Olivia Manager",
      email: "manager@codexdynamics.com",
      role: "Office Manager",
      officeId: "of_london",
      officeName: "London Operations",
      status: "Active",
      isLoggedIn: true,
      lastLoginAt: new Date().toISOString(),
      capabilities: {
        lead_upload: true,
        create_agent: true,
        registrations: true,
        notifications: true,
        security: true,
      },
    },
    {
      id: "adm_tl",
      name: "Thomas Leader",
      email: "leader@codexdynamics.com",
      role: "Team Leader",
      officeId: "of_london",
      officeName: "London Operations",
      teamId: "tm_alpha",
      teamName: "Alpha Strategy",
      status: "Active",
      isLoggedIn: true,
      lastLoginAt: new Date().toISOString(),
      capabilities: {
        lead_upload: true,
        create_agent: true,
        registrations: true,
        notifications: true,
        security: true,
      },
    },
    {
      id: "adm_ag",
      name: "Alex Agent",
      email: "agent@codexdynamics.com",
      role: "Agent",
      officeId: "of_london",
      officeName: "London Operations",
      teamId: "tm_alpha",
      teamName: "Alpha Strategy",
      status: "Active",
      isLoggedIn: true,
      lastLoginAt: new Date().toISOString(),
      capabilities: {
        lead_upload: true,
        create_agent: true,
        registrations: true,
        notifications: true,
        security: true,
      },
    },
  ],
  offices: [
    {
      id: "of_london",
      name: "London Operations",
      manager_id: "adm_om",
      managerName: "Olivia Manager",
      managerEmail: "manager@codexdynamics.com",
      team_count: 1,
      agent_count: 1,
      lead_count: 4,
    },
    {
      id: "of_newyork",
      name: "New York Hub",
      manager_id: null,
      managerName: "Unassigned",
      managerEmail: "",
      team_count: 1,
      agent_count: 1,
      lead_count: 2,
    },
  ],
  teams: [
    {
      id: "tm_alpha",
      name: "Alpha Strategy",
      officeId: "of_london",
      leaderId: "adm_tl",
      leaderName: "Thomas Leader",
      maxSize: 10,
      agent_count: 1,
      lead_count: 4,
    },
    {
      id: "tm_beta",
      name: "Beta Enterprise",
      officeId: "of_newyork",
      leaderId: null,
      leaderName: "Unassigned",
      maxSize: 10,
      agent_count: 1,
      lead_count: 2,
    },
  ],
  leads: [
    {
      id: "ld_1001",
      firstName: "James",
      lastName: "Morrison",
      name: "James Morrison",
      email: "james.morrison@enterprise.co.uk",
      phone: "+44 20 7946 0912",
      country: "United Kingdom",
      countryCode: "GB",
      status: "In Line",
      stage: "In Line",
      assignedToOffice: "of_london",
      assignedToTeam: "tm_alpha",
      assignedToAgent: "adm_ag",
      funnel: "Web Development",
      notes: "Requirements discovery for global corporate web platform.",
      commentHistory: [
        { id: "c1", author: "Alex Agent", text: "Scope consultation held with executive stakeholder.", timestamp: new Date(Date.now() - 86400000).toISOString() },
      ],
      statusHistory: [
        { id: "s1", status: "New", timestamp: new Date(Date.now() - 172800000).toISOString() },
        { id: "s2", status: "In Line", timestamp: new Date(Date.now() - 86400000).toISOString() },
      ],
      createdAt: new Date(Date.now() - 172800000).toISOString(),
    },
    {
      id: "ld_1002",
      firstName: "Elena",
      lastName: "Rostova",
      name: "Elena Rostova",
      email: "elena.rostova@techscale.io",
      phone: "+1 415 555 0198",
      country: "United States",
      countryCode: "US",
      status: "New",
      stage: "New",
      assignedToOffice: "of_london",
      assignedToTeam: "tm_alpha",
      assignedToAgent: "adm_ag",
      funnel: "Custom Web Application",
      notes: "Next-generation analytics dashboard and customer portal.",
      commentHistory: [],
      statusHistory: [
        { id: "s3", status: "New", timestamp: new Date(Date.now() - 43200000).toISOString() },
      ],
      createdAt: new Date(Date.now() - 43200000).toISOString(),
    },
    {
      id: "ld_1003",
      firstName: "Marcus",
      lastName: "Vance",
      name: "Marcus Vance",
      email: "m.vance@vanceholding.com",
      phone: "+61 2 9876 5432",
      country: "Australia",
      countryCode: "AU",
      status: "Deposit",
      stage: "Deposit",
      assignedToOffice: "of_newyork",
      assignedToTeam: "tm_beta",
      assignedToAgent: null,
      funnel: "Brand Identity",
      notes: "Commercial design system and brand identity guidelines.",
      commentHistory: [],
      statusHistory: [],
      createdAt: new Date(Date.now() - 259200000).toISOString(),
    },
    {
      id: "ld_1004",
      firstName: "Sophia",
      lastName: "Chen",
      name: "Sophia Chen",
      email: "sophia.chen@apexglobal.sg",
      phone: "+65 6789 0123",
      country: "Singapore",
      countryCode: "SG",
      status: "In Line",
      stage: "In Line",
      assignedToOffice: "of_london",
      assignedToTeam: "tm_alpha",
      assignedToAgent: "adm_ag",
      funnel: "Performance Marketing",
      notes: "Multi-channel paid ads and conversion rate optimization engagement.",
      commentHistory: [],
      statusHistory: [],
      createdAt: new Date(Date.now() - 129600000).toISOString(),
    },
    {
      id: "ld_enq_1789912001",
      firstName: "Eleanor",
      lastName: "Vance",
      name: "Eleanor Vance",
      email: "eleanor.vance@vancetech.io",
      phone: "+1 (415) 890-2341",
      country: "United States",
      countryCode: "US",
      status: "New",
      stage: "New",
      assignedToOffice: "of_london",
      assignedToTeam: "tm_alpha",
      assignedToAgent: "adm_ag",
      company: "Vance Tech Capital",
      service: "High-Performance Website",
      budget: "$15,000 - $25,000",
      timeline: "Within 1 Month",
      message: "We need a complete rebuild of our venture fund corporate portal with real-time portfolio performance dashboards and interactive investor LP access.",
      source: "website_contact_modal",
      funnel: "High-Performance Website",
      notes: "High priority lead. Referred through LinkedIn showcase.",
      commentHistory: [
        { id: "c_ev1", author: "Website Intake", text: "[High-Performance Website Inquiry] We need a complete rebuild of our venture fund corporate portal with real-time portfolio performance dashboards and interactive investor LP access.", timestamp: new Date(Date.now() - 1000 * 60 * 35).toISOString() },
      ],
      statusHistory: [
        { id: "s_ev1", status: "New", timestamp: new Date(Date.now() - 1000 * 60 * 35).toISOString() },
      ],
      registeredDate: new Date(Date.now() - 1000 * 60 * 35).toLocaleDateString(),
      createdAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
    },
    {
      id: "ld_enq_1789912002",
      firstName: "Marcus",
      lastName: "Brody",
      name: "Marcus Brody",
      email: "marcus@brodydesign.co",
      phone: "+44 20 7946 0912",
      country: "United Kingdom",
      countryCode: "GB",
      status: "In Line",
      stage: "In Line",
      assignedToOffice: "of_london",
      assignedToTeam: "tm_alpha",
      assignedToAgent: "adm_ag",
      company: "Brody Luxury Goods",
      service: "Web Design & UI/UX",
      budget: "$10,000 - $18,000",
      timeline: "Immediate",
      message: "Looking for a bespoke e-commerce experience with 3D product previews and ultra-fast mobile checkout similar to Apple storefront aesthetics.",
      source: "website_contact_form",
      funnel: "Web Design & UI/UX",
      notes: "Initial introduction email sent. Waiting for brand asset pack.",
      commentHistory: [
        { id: "c_mb1", author: "Website Intake", text: "[Web Design & UI/UX Inquiry] Looking for a bespoke e-commerce experience with 3D product previews and ultra-fast mobile checkout similar to Apple storefront aesthetics.", timestamp: new Date(Date.now() - 1000 * 60 * 180).toISOString() },
      ],
      statusHistory: [
        { id: "s_mb1", status: "New", timestamp: new Date(Date.now() - 1000 * 60 * 180).toISOString() },
        { id: "s_mb2", status: "In Line", timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString() },
      ],
      registeredDate: new Date(Date.now() - 1000 * 60 * 180).toLocaleDateString(),
      createdAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    },
    {
      id: "ld_enq_1789912003",
      firstName: "Sarah",
      lastName: "Lin",
      name: "Dr. Sarah Lin",
      email: "slin@biovista.health",
      phone: "+1 (617) 555-0198",
      country: "United States",
      countryCode: "US",
      status: "New",
      stage: "New",
      assignedToOffice: "of_newyork",
      assignedToTeam: "tm_beta",
      assignedToAgent: null,
      company: "BioVista Health",
      service: "Full-Stack Web App",
      budget: "$30,000+",
      timeline: "1-3 Months",
      message: "Seeking a custom CRM and patient onboarding platform with integrated telephony/VoIP calling and HIPAA-compliant data routing.",
      source: "website_contact_form",
      funnel: "Full-Stack Web App",
      notes: "",
      commentHistory: [
        { id: "c_sl1", author: "Website Intake", text: "[Full-Stack Web App Inquiry] Seeking a custom CRM and patient onboarding platform with integrated telephony/VoIP calling and HIPAA-compliant data routing.", timestamp: new Date(Date.now() - 1000 * 60 * 540).toISOString() },
      ],
      statusHistory: [
        { id: "s_sl1", status: "New", timestamp: new Date(Date.now() - 1000 * 60 * 540).toISOString() },
      ],
      registeredDate: new Date(Date.now() - 1000 * 60 * 540).toLocaleDateString(),
      createdAt: new Date(Date.now() - 1000 * 60 * 540).toISOString(),
    },
    {
      id: "ld_enq_1789912004",
      firstName: "Julian",
      lastName: "Rossi",
      name: "Julian Rossi",
      email: "j.rossi@rossimotors.it",
      phone: "+39 02 8765 4321",
      country: "Italy",
      countryCode: "IT",
      status: "Deposit",
      stage: "Deposit",
      assignedToOffice: "of_london",
      assignedToTeam: "tm_alpha",
      assignedToAgent: "adm_ag",
      company: "Rossi Dynamics",
      service: "SEO & Digital Marketing",
      budget: "$5,000 - $10,000/mo",
      timeline: "Ongoing Retainer",
      message: "We want to scale our European customer acquisition with Google & Meta Ads performance campaigns and automated retention funnels.",
      source: "website_contact_modal",
      funnel: "SEO & Digital Marketing",
      notes: "Agreement signed. Kickoff scheduled for next Tuesday.",
      commentHistory: [
        { id: "c_jr1", author: "Website Intake", text: "[SEO & Digital Marketing Inquiry] We want to scale our European customer acquisition with Google & Meta Ads performance campaigns and automated retention funnels.", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 28).toISOString() },
      ],
      statusHistory: [
        { id: "s_jr1", status: "New", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 28).toISOString() },
        { id: "s_jr2", status: "Deposit", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString() },
      ],
      registeredDate: new Date(Date.now() - 1000 * 60 * 60 * 28).toLocaleDateString(),
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 28).toISOString(),
    },
  ],
  deletedLeads: [],
};

export const getOfficeName = (officeId, offices) => offices.find((o) => o.id === officeId)?.name || '-';
export const getTeamName = (teamId, teams) => teams.find((t) => t.id === teamId)?.name || '-';
export const getUserName = (userId, users) => users.find((u) => u.id === userId)?.name || '-';

export const normalizeLeadAssignment = (lead, users, teams) => {
  if (!lead) return lead;
  const normalized = { ...lead };
  const agent = normalized.assignedToAgent ? users.find((u) => u.id === normalized.assignedToAgent) : null;
  const team = normalized.assignedToTeam ? teams.find((t) => t.id === normalized.assignedToTeam) : null;

  if (agent) {
    normalized.assignedToTeam = agent.teamId || null;
    normalized.assignedToOffice = agent.officeId || null;
  } else if (team) {
    normalized.assignedToOffice = team.officeId || null;
  }

  if (normalized.assignedToTeam) {
    const teamFromLead = teams.find((t) => t.id === normalized.assignedToTeam);
    if (teamFromLead) {
      normalized.assignedToOffice = teamFromLead.officeId || normalized.assignedToOffice;
    }
  }

  return normalized;
};

export const getCountryFlag = (code, countryName) => {
  const countryCode = code || getCountryByName(countryName)?.code || '';
  if (!countryCode || typeof countryCode !== 'string') {
    return <span className="crm-flag-fallback" title={countryName || 'Unknown'}>[unknown]</span>;
  }
  const normalized = countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) {
    return <span className="crm-flag-fallback" title={countryName || countryCode}>{countryCode}</span>;
  }
  const emoji = normalized
    .split('')
    .map((char) => String.fromCodePoint(0x1f1e6 + char.charCodeAt(0) - 65))
    .join('');
  const url = `https://flagcdn.com/24x18/${normalized.toLowerCase()}.png`;
  return (
    <span className="crm-country-flag-wrapper" title={countryName || normalized}>
      <span className="crm-flag-emoji" aria-label={`Flag of ${countryName || normalized}`} role="img">{emoji}</span>
      <img
        className="crm-flag-image"
        src={url}
        alt={countryName || normalized}
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
      />
    </span>
  );
};
export const getTeamAgentCount = (teamId, users) => users.filter((u) => u.role === ROLE.AGENT && u.teamId === teamId).length;
export const countByRole = (users, role) => users.filter((u) => u.role === role).length;
export const countOnlineByRole = (users, role) => users.filter((u) => u.role === role && u.isLoggedIn).length;

export const formatLeadId = (id) => {
  if (!id || typeof id !== 'string') return '#00000';
  const match = id.match(/(\d+)/);
  const num = match ? Number(match[1]) : NaN;
  if (Number.isNaN(num)) return '#00000';
  return `#${String(num).padStart(5, '0')}`;
};

export const statusClass = (stage) => {
  const key = stage
    ?.toLowerCase()
    ?.replace(/[^a-z0-9]+/g, '-')
    ?.replace(/^-+|-+$/g, '') || 'unknown';
  return `crm-status-${key}`;
};


// --- Edit Lead modal: lets super admin / staff edit core lead fields. ---
function leadPasswordStrength(pw) {
  if (!pw) return { level: 0, label: 'Empty' };
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (pw.length >= 12) score += 1;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score += 1;
  if (/\d/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;
  const labels = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong', 'Excellent'];
  return { level: score, label: labels[score] };
}

function generateLeadPassword() {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%^&*';
  const pool = upper + lower + digits + symbols;
  const pick = (s) => s[Math.floor(Math.random() * s.length)];
  let pwd = pick(upper) + pick(lower) + pick(digits) + pick(symbols);
  for (let i = 0; i < 10; i += 1) pwd += pick(pool);
  return pwd.split('').sort(() => Math.random() - 0.5).join('');
}

export function EditLeadModal({ lead, onClose, onSave }) {
  const [originalPassword, setOriginalPassword] = React.useState(lead?.clientPassword || '');
  const [firstName, setFirstName] = React.useState(lead?.firstName || '');
  const [lastName, setLastName] = React.useState(lead?.lastName || '');
  const [email, setEmail] = React.useState(lead?.email || '');
  const [clientPassword, setClientPassword] = React.useState(lead?.clientPassword || '');
  const [showPwd, setShowPwd] = React.useState(false);
  const [formError, setFormError] = React.useState('');
  const [pwFetching, setPwFetching] = React.useState(false);

  React.useEffect(() => {
    if (!lead?.id) return;
    let cancelled = false;
    setPwFetching(true);
    fetchLeadById(lead.id)
      .then((fresh) => {
        if (cancelled) return;
        const freshPwd = fresh?.clientPassword || '';
        setOriginalPassword(freshPwd);
        setClientPassword((prev) => {
          const initVal = lead?.clientPassword || '';
          return prev === initVal ? freshPwd : prev;
        });
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setPwFetching(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead?.id]);

  const initCountry = React.useMemo(
    () => getCountryByCode(lead?.countryCode) || getCountryByName(lead?.country) || null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const [selectedCountry, setSelectedCountry] = React.useState(initCountry);

  const initPhone = React.useMemo(() => {
    const parsed = parseStoredPhone(lead?.phone || '');
    const countryCode = parsed.countryCode
      || initCountry?.code
      || '';
    return { countryCode, number: parsed.number };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [phoneCountryCode, setPhoneCountryCode] = React.useState(initPhone.countryCode);
  const [phoneNumber, setPhoneNumber] = React.useState(initPhone.number);

  if (!lead) return null;

  const pwStrength = leadPasswordStrength(clientPassword);
  const passwordChanged = clientPassword !== originalPassword;

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    const trimmedEmail = email.trim();
    if (!trimmedFirst || !trimmedLast || !trimmedEmail) {
      setFormError('First name, last name and email are required.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmedEmail)) {
      setFormError('Please enter a valid email address.');
      return;
    }
    setFormError('');
    const fullPhone = buildStoredPhone(phoneCountryCode, phoneNumber);
    const payload = {
      firstName: trimmedFirst,
      lastName: trimmedLast,
      name: `${trimmedFirst} ${trimmedLast}`,
      email: trimmedEmail,
      phone: fullPhone,
      country: selectedCountry?.name || '',
      countryCode: selectedCountry?.code || '',
    };
    if (passwordChanged) {
      payload.clientPassword = clientPassword;
    }
    onSave(payload);
  };

  const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 9999, overflowY: 'auto', padding: '24px 16px', WebkitOverflowScrolling: 'touch' };
  const card = { background: 'var(--crm-card)', border: '1px solid var(--crm-border)', borderRadius: 12, padding: 24, width: '100%', maxWidth: 520, maxHeight: 'calc(100vh - 48px)', overflowY: 'auto', color: 'var(--crm-text-primary)', boxShadow: '0 24px 64px rgba(0,0,0,0.6)', boxSizing: 'border-box', margin: 'auto' };
  const labelStyle = { display: 'block', fontSize: 12, color: 'var(--crm-text-secondary)', marginBottom: 6, marginTop: 12 };
  const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--crm-border)', background: 'var(--crm-card)', color: 'var(--crm-text-primary)', fontSize: 14, boxSizing: 'border-box' };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={card} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Edit Lead Profile</h2>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--crm-text-secondary)', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>
        <p style={{ margin: '0 0 8px 0', color: 'var(--crm-text-secondary)', fontSize: 13 }}>Changes here propagate everywhere this lead is shown.</p>
        {formError && (
          <div style={{ background: 'rgba(255,69,58,0.12)', border: '1px solid rgba(255,69,58,0.45)', color: '#FF6B61', padding: '8px 12px', borderRadius: 8, fontSize: 13, marginBottom: 8 }}>
            {formError}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>First Name</label>
              <input style={inputStyle} value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            </div>
            <div>
              <label style={labelStyle}>Last Name</label>
              <input style={inputStyle} value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </div>
          </div>
          <label style={labelStyle}>Email</label>
          <input type="email" style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)} required />
          <label style={labelStyle}>Country</label>
          <CountrySelect
            value={selectedCountry?.code || ''}
            onChange={(c) => setSelectedCountry(c)}
          />
          <label style={labelStyle}>Phone</label>
          <PhoneInput
            countryCode={phoneCountryCode}
            onCountryCodeChange={(code) => {
              setPhoneCountryCode(code);
              if (!selectedCountry) {
                const c = COUNTRY_LIST.find(x => x.code === code);
                if (c) setSelectedCountry(c);
              }
            }}
            number={phoneNumber}
            onNumberChange={setPhoneNumber}
          />
          <div className="crm-pw-field" style={{ marginTop: 16 }}>
            <div className="crm-pw-field-head">
              <label className="crm-pw-field-label" htmlFor="crm-lead-pw-input">
                Account password
              </label>
              <button
                type="button"
                className="crm-pw-generate"
                onClick={() => { setClientPassword(generateLeadPassword()); setShowPwd(true); }}
                title="Generate a strong password"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="23 4 23 10 17 10" />
                  <polyline points="1 20 1 14 7 14" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
                Generate
              </button>
            </div>
            <div className="crm-pw-input-wrap">
              <input
                id="crm-lead-pw-input"
                className="crm-pw-input"
                type={showPwd ? 'text' : 'password'}
                value={clientPassword}
                onChange={(e) => setClientPassword(e.target.value)}
                placeholder="Set / change account password"
                autoComplete="new-password"
              />
              <button
                type="button"
                className="crm-pw-toggle"
                onClick={() => setShowPwd(s => !s)}
                title={showPwd ? 'Hide password' : 'Show password'}
                aria-label={showPwd ? 'Hide password' : 'Show password'}
              >
                {showPwd ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a19.77 19.77 0 0 1 4.22-5.22" />
                    <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 7 11 7a19.86 19.86 0 0 1-3.17 4.19" />
                    <path d="M14.12 14.12A3 3 0 1 1 9.88 9.88" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
            <div className="crm-pw-meta">
              <div className="crm-pw-strength" data-level={pwStrength.level}>
                {[0, 1, 2, 3, 4].map((i) => (
                  <span
                    key={i}
                    className={'crm-pw-bar' + (i < pwStrength.level ? ' is-on' : '')}
                  />
                ))}
              </div>
              <span className="crm-pw-hint" style={passwordChanged ? { color: 'var(--crm-accent)' } : {}}>
                {pwFetching
                  ? 'Loading current password...'
                  : passwordChanged
                    ? `Will update  /  ${pwStrength.label}  /  ${clientPassword.length} chars`
                    : clientPassword
                      ? 'Unchanged - edit to update'
                      : 'Use 12+ chars with letters, numbers, and a symbol'}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 22 }}>
            <button type="button" onClick={onClose} style={{ padding: '10px 18px', borderRadius: 8, border: '1px solid var(--crm-border)', background: 'transparent', color: 'var(--crm-text-primary)', cursor: 'pointer' }}>Cancel</button>
            <button type="submit" style={{ padding: '10px 22px', borderRadius: 8, border: 'none', background: 'var(--crm-accent)', color: '#FFFFFF', fontWeight: 700, cursor: 'pointer' }}>Save Changes</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- Shared modal primitives (used by Edit*Modal below) ---
function _EyeIcon({ visible }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {visible ? (
        <><path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a19.77 19.77 0 0 1 4.22-5.22"/><path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 7 11 7a19.86 19.86 0 0 1-3.17 4.19"/><path d="M14.12 14.12A3 3 0 1 1 9.88 9.88"/><line x1="1" y1="1" x2="23" y2="23"/></>
      ) : (
        <><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></>
      )}
    </svg>
  );
}

function CopyBtn({ link }) {
  const [copied, setCopied] = React.useState(false);
  const copy = () => {
    if (!link) return;
    navigator.clipboard.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => {});
  };
  return (
    <button
      type="button"
      onClick={copy}
      title={copied ? 'Copied!' : 'Copy link'}
      style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 4, border: '1px solid var(--crm-border)', background: copied ? 'rgba(14,203,129,0.12)' : 'var(--crm-bg)', color: copied ? '#0ECB81' : 'var(--crm-text-secondary)', cursor: 'pointer', padding: 0, transition: 'color 0.15s, background 0.15s' }}
    >
      {copied
        ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
        : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      }
    </button>
  );
}

function PwField({ value, onChange, readOnly, placeholder, autoComplete }) {
  const [show, setShow] = React.useState(false);
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', border: '1px solid var(--crm-border)', borderRadius: 4, background: 'var(--crm-bg)', overflow: 'hidden' }}>
      <input
        style={{ flex: 1, width: 'auto', padding: '7px 10px', border: 'none', background: 'transparent', color: value ? 'var(--crm-text-primary)' : '#5E6673', fontSize: 13, minWidth: 0, outline: 'none', boxShadow: 'none', fontStyle: value ? 'normal' : 'italic' }}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        placeholder={placeholder}
        autoComplete={autoComplete}
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        title={show ? 'Hide' : 'Reveal'}
        disabled={!value && readOnly}
        style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, background: 'none', border: 'none', borderLeft: '1px solid var(--crm-border)', color: (!value && readOnly) ? '#3A3F4A' : 'var(--crm-text-secondary)', cursor: (!value && readOnly) ? 'default' : 'pointer', padding: 0 }}
      >
        <_EyeIcon visible={show} />
      </button>
    </div>
  );
}

function _PwSection({ currentPassword, newPassword, onNewPasswordChange, newPasswordLabel }) {
  const hasStored = !!currentPassword;
  return (
    <>
      <div style={_fg}>
        <label style={_lbl}>Current Password</label>
        <PwField value={currentPassword} readOnly placeholder="not recorded" />
        {!hasStored && (
          <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--crm-text-secondary)', lineHeight: 1.4 }}>
            This account's password predates our records. Set a new one below to store it going forward.
          </p>
        )}
      </div>
      <div style={_fg}>
        <label style={_lbl}>
          {newPasswordLabel || 'New Password'}{' '}
          <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(blank = keep current)</span>
        </label>
        <PwField value={newPassword} onChange={onNewPasswordChange} placeholder="Enter new password..." autoComplete="new-password" />
      </div>
    </>
  );
}

function _SectionDivider({ label, blockBtn }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--crm-border)', margin: '14px 0 10px', paddingTop: 10 }}>
      <span style={{ fontSize: 10, color: 'var(--crm-text-secondary)', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{label}</span>
      {blockBtn}
    </div>
  );
}

function _BlockBtn({ isBlocked, onBlock }) {
  return (
    <button
      type="button"
      onClick={onBlock}
      style={{ padding: '2px 8px', borderRadius: 4, border: `1px solid ${isBlocked ? 'rgba(14,203,129,0.35)' : 'rgba(246,70,93,0.35)'}`, background: isBlocked ? 'rgba(14,203,129,0.1)' : 'rgba(246,70,93,0.1)', color: isBlocked ? '#0ECB81' : '#F6465D', fontSize: 11, cursor: 'pointer', fontWeight: 600, lineHeight: 1.4 }}
    >
      {isBlocked ? 'Unblock' : 'Block'}
    </button>
  );
}

const _fg = { marginBottom: 8 };
const _lbl = { display: 'block', fontSize: 11, color: 'var(--crm-text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 };
const _lnkRow = { display: 'flex', alignItems: 'center', gap: 4 };
const _lnkInput = { flex: 1, width: 'auto', padding: '7px 10px', borderRadius: 4, border: '1px solid var(--crm-border)', background: 'var(--crm-bg)', color: 'var(--crm-text-secondary)', fontSize: 11, minWidth: 0, outline: 'none', cursor: 'default', boxShadow: 'none' };
const _errBox = { background: 'rgba(246,70,93,0.1)', border: '1px solid rgba(246,70,93,0.35)', color: '#F6465D', padding: '6px 10px', borderRadius: 4, fontSize: 12, marginBottom: 10 };

// --- Edit Office modal ---
export function EditOfficeModal({ office, officeManager, isManagerBlocked, onBlock, onClose, onSave }) {
  const [officeName, setOfficeName] = React.useState(office?.name || '');
  const [managerName, setManagerName] = React.useState(officeManager?.name || '');
  const [managerEmail, setManagerEmail] = React.useState(officeManager?.email || '');
  const [newPassword, setNewPassword] = React.useState('');
  const [error, setError] = React.useState('');

  if (!office) return null;

  const currentPassword = officeManager?.password || officeManager?.clientPassword || '';
  const loginLink = officeManager ? (officeManager.loginLink || makeLoginLink(officeManager.id, ROLE.OFFICE_MANAGER)) : null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmedOfficeName = officeName.trim();
    if (!trimmedOfficeName) { setError('Office name is required.'); return; }
    const trimmedEmail = managerEmail.trim();
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) { setError('Login email is not valid.'); return; }
    setError('');
    onSave({
      officeName: trimmedOfficeName,
      managerName: managerName.trim() || undefined,
      managerEmail: trimmedEmail || undefined,
      managerPassword: newPassword.trim() || undefined,
    });
  };

  return (
    <div className="crm-modal-overlay" onClick={onClose}>
      <div className="crm-modal-content" style={{ maxWidth: 390 }} onClick={e => e.stopPropagation()}>
        <div className="crm-modal-header">
          <span className="crm-modal-title">Edit Office</span>
          <button type="button" className="crm-modal-close-btn" onClick={onClose} title="Close">✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="crm-modal-body" style={{ padding: '14px 18px' }}>
            {error && <div style={_errBox}>{error}</div>}
            <div style={_fg}>
              <label style={_lbl}>Office Name</label>
              <input value={officeName} onChange={e => setOfficeName(e.target.value)} required autoFocus />
            </div>

            {officeManager ? (
              <>
                <_SectionDivider
                  label="Office Manager"
                  blockBtn={onBlock && <_BlockBtn isBlocked={isManagerBlocked} onBlock={onBlock} />}
                />
                <div style={_fg}>
                  <label style={_lbl}>Manager Name</label>
                  <input value={managerName} onChange={e => setManagerName(e.target.value)} />
                </div>
                <div style={_fg}>
                  <label style={_lbl}>Login Email</label>
                  <input type="email" value={managerEmail} onChange={e => setManagerEmail(e.target.value)} placeholder="manager@example.com" autoComplete="off" />
                </div>
                <_PwSection
                  currentPassword={currentPassword}
                  newPassword={newPassword}
                  onNewPasswordChange={e => setNewPassword(e.target.value)}
                />
                <div style={_fg}>
                  <label style={_lbl}>Login Link</label>
                  <div style={_lnkRow}>
                    <input style={_lnkInput} value={loginLink || ''} readOnly />
                    <CopyBtn link={loginLink} />
                  </div>
                </div>
              </>
            ) : (
              <p style={{ margin: '8px 0 0', color: 'var(--crm-text-secondary)', fontSize: 12 }}>No manager assigned yet.</p>
            )}
          </div>
          <div className="crm-modal-footer">
            <button type="button" className="crm-modal-btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="crm-modal-btn-primary">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- Edit Team modal ---
export function EditTeamModal({ team, offices, teamLeader, isLeaderBlocked, onBlock, onClose, onSave }) {
  const [name, setName] = React.useState(team?.name || '');
  const [maxSize, setMaxSize] = React.useState(team?.maxSize != null ? String(team.maxSize) : '');
  const [officeId, setOfficeId] = React.useState(team?.officeId || '');
  const [leaderName, setLeaderName] = React.useState(teamLeader?.name || '');
  const [leaderEmail, setLeaderEmail] = React.useState(teamLeader?.email || '');
  const [newPassword, setNewPassword] = React.useState('');
  const [error, setError] = React.useState('');
  if (!team) return null;

  const currentPassword = teamLeader?.password || teamLeader?.clientPassword || '';
  const loginLink = teamLeader ? (teamLeader.loginLink || makeLoginLink(teamLeader.id, ROLE.TEAM_LEADER)) : null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) { setError('Team name is required.'); return; }
    const trimmedEmail = leaderEmail.trim();
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) { setError('Login email is not valid.'); return; }
    setError('');
    const payload = { name: trimmedName };
    if (maxSize !== '') payload.maxSize = Number(maxSize);
    if (officeId) payload.officeId = officeId;
    if (leaderName.trim()) payload.leaderName = leaderName.trim();
    if (trimmedEmail) payload.leaderEmail = trimmedEmail;
    if (newPassword.trim()) payload.leaderPassword = newPassword.trim();
    onSave(payload);
  };

  return (
    <div className="crm-modal-overlay" onClick={onClose}>
      <div className="crm-modal-content" style={{ maxWidth: 390 }} onClick={e => e.stopPropagation()}>
        <div className="crm-modal-header">
          <span className="crm-modal-title">Edit Team</span>
          <button type="button" className="crm-modal-close-btn" onClick={onClose} title="Close">✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="crm-modal-body" style={{ padding: '14px 18px' }}>
            {error && <div style={_errBox}>{error}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <div>
                <label style={_lbl}>Team Name</label>
                <input value={name} onChange={e => setName(e.target.value)} required autoFocus />
              </div>
              <div>
                <label style={_lbl}>Max Agents</label>
                <input type="number" min="1" value={maxSize} onChange={e => setMaxSize(e.target.value)} placeholder="No limit" />
              </div>
            </div>
            {offices && offices.length > 0 && (
              <div style={_fg}>
                <label style={_lbl}>Office</label>
                <select value={officeId} onChange={e => setOfficeId(e.target.value)}>
                  <option value="">- Keep current -</option>
                  {offices.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
            )}

            {teamLeader ? (
              <>
                <_SectionDivider
                  label="Team Leader"
                  blockBtn={onBlock && <_BlockBtn isBlocked={isLeaderBlocked} onBlock={onBlock} />}
                />
                <div style={_fg}>
                  <label style={_lbl}>Leader Name</label>
                  <input value={leaderName} onChange={e => setLeaderName(e.target.value)} />
                </div>
                <div style={_fg}>
                  <label style={_lbl}>Login Email</label>
                  <input type="email" value={leaderEmail} onChange={e => setLeaderEmail(e.target.value)} placeholder="leader@example.com" autoComplete="off" />
                </div>
                <_PwSection
                  currentPassword={currentPassword}
                  newPassword={newPassword}
                  onNewPasswordChange={e => setNewPassword(e.target.value)}
                />
                <div style={_fg}>
                  <label style={_lbl}>Login Link</label>
                  <div style={_lnkRow}>
                    <input style={_lnkInput} value={loginLink || ''} readOnly />
                    <CopyBtn link={loginLink} />
                  </div>
                </div>
              </>
            ) : (
              <p style={{ margin: '8px 0 0', color: 'var(--crm-text-secondary)', fontSize: 12 }}>No leader assigned yet.</p>
            )}
          </div>
          <div className="crm-modal-footer">
            <button type="button" className="crm-modal-btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="crm-modal-btn-primary">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- Edit Agent modal ---
export function EditAgentModal({ agent, teams, isBlocked, onBlock, onClose, onSave }) {
  const [name, setName] = React.useState(agent?.name || '');
  const [agentEmail, setAgentEmail] = React.useState(agent?.email || '');
  const [newPassword, setNewPassword] = React.useState('');
  const [teamId, setTeamId] = React.useState(agent?.teamId || '');
  const [error, setError] = React.useState('');
  if (!agent) return null;

  const currentPassword = agent?.password || agent?.clientPassword || '';
  const loginLink = agent ? (agent.loginLink || makeLoginLink(agent.id, ROLE.AGENT)) : null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) { setError('Agent name is required.'); return; }
    const trimmedEmail = agentEmail.trim();
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) { setError('Login email is not valid.'); return; }
    setError('');
    const payload = { name: trimmedName };
    if (trimmedEmail) payload.email = trimmedEmail;
    if (newPassword.trim()) payload.password = newPassword.trim();
    if (teamId) payload.teamId = teamId;
    onSave(payload);
  };

  return (
    <div className="crm-modal-overlay" onClick={onClose}>
      <div className="crm-modal-content" style={{ maxWidth: 390 }} onClick={e => e.stopPropagation()}>
        <div className="crm-modal-header">
          <span className="crm-modal-title">Edit Agent</span>
          <button type="button" className="crm-modal-close-btn" onClick={onClose} title="Close">✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="crm-modal-body" style={{ padding: '14px 18px' }}>
            {error && <div style={_errBox}>{error}</div>}
            <div style={{ ...(_fg), display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <label style={{ ..._lbl, margin: 0 }}>Agent Name</label>
                {onBlock && <_BlockBtn isBlocked={isBlocked} onBlock={onBlock} />}
              </div>
              <input value={name} onChange={e => setName(e.target.value)} required autoFocus />
            </div>
            <div style={_fg}>
              <label style={_lbl}>Login Email</label>
              <input type="email" value={agentEmail} onChange={e => setAgentEmail(e.target.value)} placeholder="agent@example.com" autoComplete="off" />
            </div>
            <_PwSection
              currentPassword={currentPassword}
              newPassword={newPassword}
              onNewPasswordChange={e => setNewPassword(e.target.value)}
            />
            <div style={_fg}>
              <label style={_lbl}>Login Link</label>
              <div style={_lnkRow}>
                <input style={_lnkInput} value={loginLink || ''} readOnly />
                <CopyBtn link={loginLink} />
              </div>
            </div>
            {teams && teams.length > 0 && (
              <div style={_fg}>
                <label style={_lbl}>Team</label>
                <select value={teamId} onChange={e => setTeamId(e.target.value)}>
                  <option value="">- Keep current -</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            )}
          </div>
          <div className="crm-modal-footer">
            <button type="button" className="crm-modal-btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="crm-modal-btn-primary">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- Create Agent modal for delegated Team Leader / Agent portfolios ---
export function CreateAgentModal({ team, onClose, onCreate }) {
  const [name, setName] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedPassword = password.trim();
    if (!trimmedName) { setError('Agent name is required.'); return; }
    if (!trimmedPassword) { setError('Agent password is required.'); return; }
    setError('');
    setSaving(true);
    try {
      const created = await onCreate(trimmedName, trimmedPassword);
      if (created) onClose();
      else setError('Could not create the agent.');
    } catch (createError) {
      setError(createError?.message || 'Could not create the agent.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="crm-modal-overlay" onClick={onClose}>
      <div className="crm-modal-content" style={{ maxWidth: 390 }} onClick={event => event.stopPropagation()}>
        <div className="crm-modal-header">
          <span className="crm-modal-title">Add Agent</span>
          <button type="button" className="crm-modal-close-btn" onClick={onClose} title="Close">✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="crm-modal-body" style={{ padding: '14px 18px' }}>
            {error && <div style={_errBox}>{error}</div>}
            <div style={_fg}>
              <label style={_lbl}>Team</label>
              <input value={team?.name || 'Current team'} readOnly />
            </div>
            <div style={_fg}>
              <label style={_lbl}>Agent Name</label>
              <input value={name} onChange={event => setName(event.target.value)} required autoFocus autoComplete="off" />
            </div>
            <div style={_fg}>
              <label style={_lbl}>Agent Password</label>
              <input type="password" value={password} onChange={event => setPassword(event.target.value)} required autoComplete="new-password" />
            </div>
          </div>
          <div className="crm-modal-footer">
            <button type="button" className="crm-modal-btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="crm-modal-btn-primary" disabled={saving}>{saving ? 'Creating...' : 'Create Agent'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}


// --- Create Lead modal: spawn a new lead with optional team/agent target. ---
//
// Used by OfficeManagerPanel + TeamLeaderPanel. The backend auto-defaults the
// office/team to the caller's scope when those fields are omitted, so the
// modal only surfaces selectors for the levels the actor can choose. The
// SuperAdminPanel has its own (much richer) lead-import flow and does not
// use this modal.
export function CreateLeadModal({ scope, teamsForOffice = [], agents = [], onClose, onCreate }) {
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [selectedCountry, setSelectedCountry] = React.useState(null);
  const [phoneCountryCode, setPhoneCountryCode] = React.useState('');
  const [phoneNumber, setPhoneNumber] = React.useState('');
  const [funnel, setFunnel] = React.useState('');
  const [teamId, setTeamId] = React.useState(scope?.teamId || '');
  const [agentId, setAgentId] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState('');

  React.useEffect(() => {
    if (selectedCountry && !phoneCountryCode) setPhoneCountryCode(selectedCountry.code);
  }, [selectedCountry, phoneCountryCode]);

  const filteredAgents = teamId
    ? agents.filter(a => a.teamId === teamId)
    : agents;
  const phoneValid = isPhoneValid(phoneCountryCode, phoneNumber);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const f = firstName.trim();
    const l = lastName.trim();
    const em = email.trim();
    if (!f || !l || !em) {
      setFormError('First name, last name and email are required.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)) {
      setFormError('Please enter a valid email address.');
      return;
    }
    setFormError('');
    setSubmitting(true);
    const fullPhone = buildStoredPhone(phoneCountryCode, phoneNumber);
    try {
      await onCreate({
        firstName:   f,
        lastName:    l,
        name:        `${f} ${l}`,
        email:       em,
        phone:       fullPhone,
        country:     selectedCountry?.name || '',
        countryCode: selectedCountry?.code || '',
        stage:       'New',
        funnel:      funnel.trim() || null,
        assignedToOffice: scope?.officeId || null,
        assignedToTeam:   teamId || scope?.teamId || null,
        assignedToAgent:  agentId || scope?.agentId || null,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 9999, overflowY: 'auto', padding: '24px 16px' };
  const card = { background: 'var(--crm-card)', border: '1px solid var(--crm-border)', borderRadius: 12, padding: 24, width: '100%', maxWidth: 520, maxHeight: 'calc(100vh - 48px)', overflowY: 'auto', color: 'var(--crm-text-primary)', boxShadow: '0 24px 64px rgba(0,0,0,0.6)', boxSizing: 'border-box', margin: 'auto' };
  const labelStyle = { display: 'block', fontSize: 12, color: 'var(--crm-text-secondary)', marginBottom: 6, marginTop: 12 };
  const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--crm-border)', background: 'var(--crm-card)', color: 'var(--crm-text-primary)', fontSize: 14, boxSizing: 'border-box' };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={card} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>New Lead</h2>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--crm-text-secondary)', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>
        <p style={{ margin: '0 0 8px 0', color: 'var(--crm-text-secondary)', fontSize: 13 }}>
          {scope?.teamId
            ? 'Lead will be created inside your team.'
            : scope?.officeId
              ? 'Lead will be created inside your office. Pick a team and agent if you already know who should work it.'
              : 'Lead will be created in the unassigned pool.'}
        </p>
        {formError && (
          <div style={{ background: 'rgba(255,69,58,0.12)', border: '1px solid rgba(255,69,58,0.45)', color: '#FF6B61', padding: '8px 12px', borderRadius: 8, fontSize: 13, marginBottom: 8 }}>
            {formError}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>First Name *</label>
              <input style={inputStyle} value={firstName} onChange={(e) => setFirstName(e.target.value)} required autoFocus />
            </div>
            <div>
              <label style={labelStyle}>Last Name *</label>
              <input style={inputStyle} value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </div>
          </div>
          <label style={labelStyle}>Email *</label>
          <input type="email" style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)} required />
          <label style={labelStyle}>Country</label>
          <CountrySelect
            value={selectedCountry?.code || ''}
            onChange={(c) => setSelectedCountry(c)}
          />
          <label style={labelStyle}>Phone</label>
          <PhoneInput
            countryCode={phoneCountryCode}
            onCountryCodeChange={(code) => {
              setPhoneCountryCode(code);
              if (!selectedCountry) {
                const c = COUNTRY_LIST.find(x => x.code === code);
                if (c) setSelectedCountry(c);
              }
            }}
            number={phoneNumber}
            onNumberChange={setPhoneNumber}
          />
          <label style={labelStyle}>Funnel</label>
          <input style={inputStyle} value={funnel} onChange={(e) => setFunnel(e.target.value)} placeholder="organic, paid, etc." />
          {teamsForOffice.length > 0 && !scope?.teamId && (
            <>
              <label style={labelStyle}>Team (optional)</label>
              <select style={inputStyle} value={teamId} onChange={(e) => { setTeamId(e.target.value); setAgentId(''); }}>
                <option value="">- Unassigned -</option>
                {teamsForOffice.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </>
          )}
          {filteredAgents.length > 0 && (
            <>
              <label style={labelStyle}>Agent (optional)</label>
              <select style={inputStyle} value={agentId} onChange={(e) => setAgentId(e.target.value)}>
                <option value="">- Unassigned -</option>
                {filteredAgents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 22 }}>
            <button type="button" onClick={onClose} style={{ padding: '10px 18px', borderRadius: 8, border: '1px solid var(--crm-border)', background: 'transparent', color: 'var(--crm-text-primary)', cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={submitting || !phoneValid} style={{ padding: '10px 22px', borderRadius: 8, border: 'none', background: 'var(--crm-accent)', color: '#FFFFFF', fontWeight: 700, cursor: (submitting || !phoneValid) ? 'not-allowed' : 'pointer', opacity: (submitting || !phoneValid) ? 0.5 : 1 }}>
              {submitting ? 'Creating...' : 'Create Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- Add Comment modal: append a single comment to a lead's thread. ---
//
// Used by OfficeManagerPanel + TeamLeaderPanel + (already in) AgentPanel.
// On submit, calls onSubmit(text) which is expected to call updateLead with
// `{ comment: text }`. The backend appends a row to lead_comments and bumps
// last_comment_date - the optimistic+canonical refresh in App.updateLead
// keeps the UI in sync.
export function AddCommentModal({ leadName, onClose, onSubmit }) {
  const [text, setText] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setSubmitting(true);
    try {
      await onSubmit(t);
    } finally {
      setSubmitting(false);
    }
  };

  const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 };
  const card = { background: 'var(--crm-card)', border: '1px solid var(--crm-border)', borderRadius: 12, padding: 24, width: '100%', maxWidth: 480, color: 'var(--crm-text-primary)', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={card} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>Add Comment</h2>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--crm-text-secondary)', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>
        {leadName && (
          <p style={{ margin: '0 0 12px 0', color: 'var(--crm-text-secondary)', fontSize: 13 }}>
            Lead: <span style={{ color: 'var(--crm-text-primary)' }}>{leadName}</span>
          </p>
        )}
        <form onSubmit={handleSubmit}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            autoFocus
            placeholder="Type your note..."
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--crm-border)', background: 'var(--crm-card)', color: 'var(--crm-text-primary)', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
            <button type="button" onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--crm-border)', background: 'transparent', color: 'var(--crm-text-primary)', cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={submitting || !text.trim()} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: 'var(--crm-accent)', color: '#FFFFFF', fontWeight: 700, cursor: (submitting || !text.trim()) ? 'not-allowed' : 'pointer', opacity: (submitting || !text.trim()) ? 0.5 : 1 }}>
              {submitting ? 'Saving...' : 'Save Comment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

