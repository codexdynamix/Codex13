import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import './SiteSettings.css';
import {
  DEFAULT_PLATFORM_SETTINGS,
  usePlatformSettings,
  updateLocalSettingsState,
  saveSettingsToApi
} from '../../../platformDefaults';
import {
  Palette,
  Phone,
  Share2,
  Layout,
  Search,
  Shield,
  Save,
  RotateCcw,
  Check,
  Plus,
  Trash2,
  Edit,
  Copy,
  ExternalLink,
  RefreshCw,
  Send,
  Download,
  Upload,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Globe,
  MessageCircle,
  HelpCircle,
  CheckCircle2,
  X,
  Sliders,
  Sparkles,
  MapPin,
  Monitor,
  Tablet,
  Smartphone,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  Layers,
  Compass,
  Sun,
  Moon,
  Dices,
  KeyRound,
  LayoutGrid,
  Crown,
  Building2,
  Terminal,
  Zap,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import {
  THEME_LAYOUT_PRESETS,
  COLOR_PALETTES,
  generateRandomHarmoniousPalette
} from './ThemeAndPalettePresets';
import {
  WhatsAppLogo,
  TelegramLogo,
  GmailLogo,
  PhoneLogo,
  ViberLogo,
  InstagramLogo,
  FacebookLogo,
  LinkedInLogo,
  TwitterXLogo,
  GitHubLogo,
  MapsLogo
} from '../../../../components/BrandMarks';

export function hexToRgb(hex) {
  if (!hex || typeof hex !== 'string') return null;
  const cleaned = hex.replace('#', '').trim();
  if (cleaned.length === 3) {
    return {
      r: parseInt(cleaned[0] + cleaned[0], 16),
      g: parseInt(cleaned[1] + cleaned[1], 16),
      b: parseInt(cleaned[2] + cleaned[2], 16),
    };
  }
  if (cleaned.length === 6) {
    return {
      r: parseInt(cleaned.slice(0, 2), 16),
      g: parseInt(cleaned.slice(2, 4), 16),
      b: parseInt(cleaned.slice(4, 6), 16),
    };
  }
  return null;
}

export function getLuminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function calcContrastRatio(hex1, hex2) {
  const lum1 = getLuminance(hex1);
  const lum2 = getLuminance(hex2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  const ratio = (brightest + 0.05) / (darkest + 0.05);
  return Number(ratio.toFixed(1));
}

export function getWcagLevel(ratio) {
  if (ratio >= 7.0) return { level: 'AAA', label: 'WCAG AAA (Enhanced)' };
  if (ratio >= 4.5) return { level: 'AA', label: 'WCAG AA (Standard)' };
  if (ratio >= 3.0) return { level: 'AA Large', label: 'WCAG AA (Large Text)' };
  return { level: 'Fail', label: 'Low Contrast' };
}

export const PROTOCOL_OPTIONS = [
  { id: 'whatsapp', name: 'WhatsApp', Logo: WhatsAppLogo, placeholder: '+44 7911 123456', hint: 'WhatsApp phone with country code', color: '#25D366' },
  { id: 'telegram', name: 'Telegram', Logo: TelegramLogo, placeholder: '@CodexDynamics or https://t.me/...', hint: 'Telegram handle or direct link', color: '#26A5E4' },
  { id: 'phone', name: 'Phone Line', Logo: PhoneLogo, placeholder: '+1 (555) 019-2834', hint: 'Direct telephone line or call center', color: '#34C759' },
  { id: 'email', name: 'Gmail / Email', Logo: GmailLogo, placeholder: 'hello@codexdynamics.com', hint: 'Inbound email inbox', color: '#EA4335' },
  { id: 'viber', name: 'Viber', Logo: ViberLogo, placeholder: '+380 99 123 4567', hint: 'Viber phone number or chat link', color: '#9B8DF8' },
  { id: 'instagram', name: 'Instagram', Logo: InstagramLogo, placeholder: '@codexdynamics', hint: 'Instagram handle or profile link', color: '#FD5949' },
  { id: 'facebook', name: 'Facebook', Logo: FacebookLogo, placeholder: 'https://facebook.com/...', hint: 'Facebook page or Messenger', color: '#1877F2' },
  { id: 'linkedin', name: 'LinkedIn', Logo: LinkedInLogo, placeholder: 'https://linkedin.com/company/...', hint: 'LinkedIn company page', color: '#388BFD' },
  { id: 'twitter', name: 'X (Twitter)', Logo: TwitterXLogo, placeholder: '@CodexDynamics', hint: 'X / Twitter handle', color: '#FFFFFF' },
  { id: 'custom', name: 'Office / Custom', Logo: MapsLogo, placeholder: 'Sportyvna Square, 1A, Kyiv, Ukraine', hint: 'Physical location or office address', color: 'var(--crm-accent)' },
];

export function OfficialProtocolBadge({ type }) {
  const normType = (type || 'custom').toLowerCase();

  switch (normType) {
    case 'whatsapp':
      return (
        <div className="crm-protocol-item">
          <WhatsAppLogo className="crm-protocol-logo" />
          <span style={{ color: '#25D366' }}>WhatsApp</span>
        </div>
      );
    case 'telegram':
      return (
        <div className="crm-protocol-item">
          <TelegramLogo className="crm-protocol-logo" />
          <span style={{ color: '#26A5E4' }}>Telegram</span>
        </div>
      );
    case 'phone':
      return (
        <div className="crm-protocol-item">
          <PhoneLogo className="crm-protocol-logo" />
          <span style={{ color: '#34C759' }}>Phone Line</span>
        </div>
      );
    case 'email':
      return (
        <div className="crm-protocol-item">
          <GmailLogo className="crm-protocol-logo" />
          <span style={{ color: '#EA4335' }}>Gmail / Email</span>
        </div>
      );
    case 'viber':
      return (
        <div className="crm-protocol-item">
          <ViberLogo className="crm-protocol-logo" />
          <span style={{ color: '#9B8DF8' }}>Viber</span>
        </div>
      );
    case 'instagram':
      return (
        <div className="crm-protocol-item">
          <InstagramLogo className="crm-protocol-logo" />
          <span style={{ color: '#FD5949' }}>Instagram</span>
        </div>
      );
    case 'facebook':
      return (
        <div className="crm-protocol-item">
          <FacebookLogo className="crm-protocol-logo" />
          <span style={{ color: '#1877F2' }}>Facebook</span>
        </div>
      );
    case 'linkedin':
      return (
        <div className="crm-protocol-item">
          <LinkedInLogo className="crm-protocol-logo" />
          <span style={{ color: '#388BFD' }}>LinkedIn</span>
        </div>
      );
    case 'twitter':
      return (
        <div className="crm-protocol-item">
          <TwitterXLogo className="crm-protocol-logo" />
          <span style={{ color: 'var(--crm-text-primary)' }}>X (Twitter)</span>
        </div>
      );
    default:
      return (
        <div className="crm-protocol-item">
          <MapsLogo className="crm-protocol-logo" />
          <span style={{ color: 'var(--crm-accent)' }}>Office / Custom</span>
        </div>
      );
  }
}

const SUB_TABS = [
  { id: 'layout', label: 'Layout & Modules', icon: Layout },
  { id: 'contacts', label: 'Contact Channels', icon: Phone },
  { id: 'socials', label: 'Header Socials', icon: Share2 },
  { id: 'seo', label: 'SEO & Search', icon: Search },
  { id: 'security', label: 'Security & System', icon: Shield },
];

const RADIUS_OPTIONS = [
  { id: 'sharp', label: 'Sharp (0px)', desc: 'Architectural precision standard' },
  { id: 'clean', label: 'Clean (6px)', desc: 'Industrial CRM precision standard' },
  { id: 'modern', label: 'Modern (12px)', desc: 'Sleek rounded SaaS surfaces' },
  { id: 'pill', label: 'Pill (20px)', desc: 'Organic capsule curves' },
];

const FONT_OPTIONS = [
  { id: 'system', name: 'Apple System / Inter Sans', sample: 'Precision engineering' },
  { id: 'playfair', name: 'Playfair Display', sample: 'Editorial luxury styling' },
  { id: 'syne', name: 'Syne Geometric', sample: 'Avant-garde digital studio' },
  { id: 'mono', name: 'JetBrains / SF Mono', sample: 'High-tech developer feel' },
];

const DEFAULT_SECTIONS = [
  { id: 'hero', name: 'Hero Showcase', category: 'Opening', desc: 'Main headline, tagline & dynamic interactive reel' },
  { id: 'highlights', name: 'Key Highlights (Bento)', category: 'Capabilities', desc: 'Core agency capabilities & focus metrics' },
  { id: 'services', name: 'Services & Capabilities', category: 'Offerings', desc: 'Web apps, CRM engineering & marketing services' },
  { id: 'portfolio', name: 'Selected Work / Case Studies', category: 'Case Studies', desc: 'Interactive portfolio grid & live project preview' },
  { id: 'results', name: 'Performance Results & KPIs', category: 'Proof', desc: 'Real-time counters, statistics & benchmark metrics' },
  { id: 'about', name: 'About Codex Dynamics', category: 'Story', desc: 'Engineering principles, studio history & headquarters' },
  { id: 'blog', name: 'Blog & Technical Insights', category: 'Content', desc: 'Latest articles, architectural guides & research' },
  { id: 'reviews', name: 'Client Testimonials', category: 'Social Proof', desc: 'Verified stakeholder reviews & ratings' },
  { id: 'contact', name: 'Contact & Inquiry Hub', category: 'Conversion', desc: 'Lead consultation form, calendar & channels' },
];

const HERO_LAYOUT_OPTIONS = [
  { id: 'streamer', label: 'Streamer Video Reel', desc: 'Video background reel with floating live status badge' },
  { id: 'split', label: 'Split Media (50/50)', desc: 'High-contrast split editorial layout with side-by-side showcase' },
  { id: 'centered', label: 'Centered Minimal Focus', desc: 'Pure high-impact typography with centered CTA stack' },
  { id: 'bento', label: 'Bento Interactive Grid', desc: 'Multi-panel bento cards integrated directly into the hero zone' },
];

const HEADER_OPTIONS = [
  { id: 'floating', label: 'Floating Island Bar', desc: 'Detached pill navigation with blur backdrop' },
  { id: 'minimal', label: 'Clean Edge-to-Edge', desc: 'Minimal borderless top navigation bar' },
  { id: 'sticky', label: 'Sticky Top Header', desc: 'Header pinned to top on scroll with subtle border' },
];

export default function SiteSettingsTab({ showNotification = () => {} }) {
  const platformSettings = usePlatformSettings();
  const [activeSubTab, setActiveSubTab] = useState('layout');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [webhookTestStatus, setWebhookTestStatus] = useState(null);

  // Copy state tracker for feedback
  const [copiedKey, setCopiedKey] = useState(null);
  const copyTimeoutRef = useRef(null);

  // Theme & Layout Studio Filter State
  const [themeModeFilter, setThemeModeFilter] = useState('all'); // 'all' | 'dark' | 'light'
  const [themeCategoryFilter, setThemeCategoryFilter] = useState('all');
  const [themeSearchQuery, setThemeSearchQuery] = useState('');

  // Brand Palette Studio Filter State
  const [paletteModeFilter, setPaletteModeFilter] = useState('all'); // 'all' | 'dark' | 'light' | 'cyber' | 'luxury' | 'ocean' | 'nature' | 'warm'
  const [paletteSearchQuery, setPaletteSearchQuery] = useState('');
  const [copiedPaletteId, setCopiedPaletteId] = useState(null);

  // Interactive Coolors Generator Stage State
  const [coolorsStage, setCoolorsStage] = useState(() => ({
    name: 'Dynamic Studio Harmony',
    mode: 'dark', // 'dark' | 'light'
    colors: [
      { id: 'primary', label: 'Primary', hex: 'var(--crm-accent)', locked: false },
      { id: 'bg', label: 'Canvas BG', hex: '#0F1216', locked: false },
      { id: 'card', label: 'Card Surface', hex: '#181A20', locked: false },
      { id: 'accent', label: 'Accent', hex: 'var(--crm-accent-hover)', locked: false },
      { id: 'secondary', label: 'Secondary', hex: '#1E2329', locked: false },
    ],
    contrastRatio: '14.8:1',
    contrastRating: 'AAA',
  }));
  const [copiedPillarIdx, setCopiedPillarIdx] = useState(null);
  const [coolorsAutoApply, setCoolorsAutoApply] = useState(true);

  // Left Column Sections Collapse / Expand state & Quick Navigator
  const [expandedSections, setExpandedSections] = useState({
    identity: true,
    themes: true,
    palettes: true,
    hero: true,
    sequence: true,
    conversion: true,
  });
  const [activeNavSection, setActiveNavSection] = useState('identity');
  const [studioLayoutMode, setStudioLayoutMode] = useState('split'); // 'split' | 'editor' | 'preview'

  // Track active section as user scrolls through the left column
  useEffect(() => {
    if (activeSubTab !== 'layout') return;
    const sectionKeys = ['identity', 'themes', 'palettes', 'hero', 'sequence', 'conversion'];
    const handleScroll = () => {
      let current = sectionKeys[0];
      for (const key of sectionKeys) {
        const el = document.getElementById(`studio-card-${key}`);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 160) {
            current = key;
          }
        }
      }
      setActiveNavSection(current);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [activeSubTab]);

  const toggleSectionCollapse = (secKey) => {
    setExpandedSections(prev => ({ ...prev, [secKey]: !prev[secKey] }));
  };

  const handleExpandAll = (expand = true) => {
    setExpandedSections({
      identity: expand,
      themes: expand,
      palettes: expand,
      hero: expand,
      sequence: expand,
      conversion: expand,
    });
  };

  const scrollToSection = (secKey) => {
    setExpandedSections(prev => ({ ...prev, [secKey]: true }));
    setActiveNavSection(secKey);
    setTimeout(() => {
      const el = document.getElementById(`studio-card-${secKey}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 40);
  };

  const handleCopyValue = useCallback((text, key, label = 'Value') => {
    if (!text) return;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
    setCopiedKey(key);
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = setTimeout(() => {
      setCopiedKey(null);
    }, 1800);
    showNotification(`${label} copied to clipboard.`);
  }, [showNotification]);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  // Contact multi-select state
  const [selectedContactIds, setSelectedContactIds] = useState([]);

  // Contact Modal & Form State
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [editingContactId, setEditingContactId] = useState(null);
  const [confirmDeleteContactId, setConfirmDeleteContactId] = useState(null);
  const [contactForm, setContactForm] = useState({
    type: 'phone',
    label: '',
    value: '',
    extraValues: [],
    isPrimary: false,
  });

  // Office Location Modal & Form State
  const [officeModalOpen, setOfficeModalOpen] = useState(false);
  const [editingOfficeId, setEditingOfficeId] = useState(null);
  const [officeForm, setOfficeForm] = useState({
    label: '',
    fullAddress: '',
    phone: '',
    isPrimary: false,
  });

  const [passwordState, setPasswordState] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [showPasswords, setShowPasswords] = useState({
    current: false,
    newPass: false,
    confirm: false,
  });

  // Config State
  const [siteConfig, setSiteConfig] = useState(() => {
    let localCfg = {};
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('codex_site_config');
        if (raw) localCfg = JSON.parse(raw);
      } catch (err) {
        console.error('Failed to parse codex_site_config:', err);
      }
    }

    return {
      siteName: localCfg.siteName || platformSettings?.platformName || 'Codex Dynamics',
      copyrightYear: localCfg.copyrightYear || platformSettings?.platformYear || '2026',
      supportEmail: localCfg.supportEmail || platformSettings?.supportEmail || 'support@codexdynamics.com',
      formSubmitEmail: localCfg.formSubmitEmail || 'codexdynamix@gmail.com',
      baseCurrency: localCfg.baseCurrency || platformSettings?.baseCurrency || 'USD',
      heroTitle: localCfg.hero?.title || 'Precision on every screen.',
      heroSubtitle: localCfg.hero?.subtitle || 'High-performance websites, custom CRM software, and digital marketing engines.',
      heroBadge: localCfg.hero?.badge || 'Codex Dynamics',

      // Branding
      activeTheme: localCfg.theme?.activeTheme || 'codex-gold',
      primaryColor: localCfg.colors?.primary || platformSettings?.primaryColor || 'var(--crm-accent)',
      secondaryColor: localCfg.colors?.secondary || platformSettings?.secondaryColor || '#1E2329',
      accentColor: localCfg.colors?.accent || platformSettings?.accentColor || 'var(--crm-accent)',
      backgroundColor: localCfg.colors?.background || platformSettings?.backgroundColor || '#0F1216',
      cardBg: localCfg.colors?.cardBg || '#181A20',
      borderRadius: localCfg.theme?.borderRadius || 'clean',
      fontFamily: localCfg.theme?.fontFamily || 'system',
      headerStyle: localCfg.theme?.headerStyle || 'floating',
      heroLayout: localCfg.theme?.heroLayout || 'streamer',
      cardStyle: localCfg.theme?.cardStyle === 'glass' ? 'bordered' : localCfg.theme?.cardStyle || 'bordered',

      // Contacts list
      socialContacts: Array.isArray(localCfg.socialContacts) && localCfg.socialContacts.length > 0
        ? localCfg.socialContacts
        : [
            { id: 'c-1', type: 'phone', label: 'Direct Line', value: '+380 (63) 640-67-83', isPrimary: true },
            { id: 'c-2', type: 'whatsapp', label: 'WhatsApp Priority', value: '+380636406783', isPrimary: true },
            { id: 'c-3', type: 'telegram', label: 'Telegram Desk', value: '@codexdynamics', isPrimary: true },
            { id: 'c-4', type: 'email', label: 'Client Inquiries', value: 'contact@codexdynamics.com', isPrimary: true },
            { id: 'c-5', type: 'viber', label: 'Viber Hotline', value: '+380636406783', isPrimary: false },
          ],

      // Addresses list
      addresses: Array.isArray(localCfg.addresses) && localCfg.addresses.length > 0
        ? localCfg.addresses
        : [
            { id: 'a-1', label: 'Kyiv HQ', street: 'Sportyvna Square, 1A', city: 'Kyiv, Ukraine', fullAddress: 'Sportyvna Square, 1A, Kyiv 012023, Ukraine', isPrimary: true },
            { id: 'a-2', label: 'San Francisco Tech Lab', street: '100 Innovation Way, Suite 400', city: 'San Francisco, CA', fullAddress: '100 Innovation Way, Suite 400, San Francisco, CA 94105', isPrimary: false }
          ],

      // Header socials
      headerSocials: {
        x: { enabled: true, url: 'https://x.com/codexdynamics', handle: '@codexdynamics' },
        linkedin: { enabled: true, url: 'https://linkedin.com/company/codexdynamics', handle: 'codexdynamics' },
        github: { enabled: true, url: 'https://github.com/codexdynamix', handle: 'codexdynamix' },
        instagram: { enabled: false, url: 'https://instagram.com/codexdynamics', handle: '@codexdynamics' },
        facebook: { enabled: false, url: 'https://facebook.com/codexdynamics', handle: 'codexdynamics' },
        ...(localCfg.headerSocials || {})
      },

      // Layout & modules
      sectionsOrder: Array.isArray(localCfg.theme?.sectionsOrder)
        ? localCfg.theme.sectionsOrder
        : DEFAULT_SECTIONS.map(s => s.id),
      sectionsVisibility: localCfg.theme?.sectionsVisibility || {
        hero: true,
        highlights: true,
        services: true,
        portfolio: true,
        results: true,
        about: true,
        blog: true,
        reviews: true,
        contact: true
      },

      // Floating WhatsApp dock
      whatsappDock: {
        enabled: localCfg.whatsapp?.enabled ?? true,
        number: localCfg.whatsapp?.number || '+380636406783',
        defaultMessage: localCfg.whatsapp?.defaultMessage || "Hello Codex Dynamics, I'm interested in building a high-performance web project.",
        position: localCfg.whatsapp?.position || 'bottom-right'
      },

      // Tidio Chat
      tidioChat: {
        enabled: localCfg.tidio?.enabled ?? false,
        publicKey: localCfg.tidio?.publicKey || '',
        position: localCfg.tidio?.position || 'bottom-right'
      },

      // SEO
      seo: {
        metaTitle: localCfg.seo?.metaTitle || 'Codex Dynamics | High-Performance Websites & Custom CRMs',
        metaDescription: localCfg.seo?.metaDescription || 'High-performance websites, web design, web development, custom CRMs, and digital marketing agency.',
        keywords: localCfg.seo?.keywords || 'web development, custom CRM, react, web design, digital marketing, high performance',
        canonicalUrl: localCfg.seo?.canonicalUrl || 'https://codexdynamics.com',
        ogImage: localCfg.seo?.ogImage || '/og.jpg',
        allowIndexing: localCfg.seo?.allowIndexing ?? true
      },

      // Security & System
      security: {
        registrationEnabled: platformSettings?.registrationEnabled ?? true,
        twoFactorAuthEnabled: platformSettings?.twoFactorAuthEnabled ?? true,
        sessionTimeoutMinutes: platformSettings?.sessionTimeoutMinutes ?? 30,
        maxFailedLoginAttempts: platformSettings?.maxFailedLoginAttempts ?? 5,
        webhookUrl: localCfg.webhookUrl || ''
      }
    };
  });

  const fileInputRef = useRef(null);

  // Live Preview Studio State
  const [viewportMode, setViewportMode] = useState('desktop'); // 'desktop' | 'tablet' | 'mobile'
  const [zoomLevel, setZoomLevel] = useState(100); // 100 | 85 | 75 | 60
  const [previewPage, setPreviewPage] = useState('home'); // 'home' | 'services' | 'work' | 'studio' | 'blog' | 'contact'
  const [isFullscreenPreview, setIsFullscreenPreview] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const [highlightedSection, setHighlightedSection] = useState(null);
  const previewIframeRef = useRef(null);
  const fullscreenIframeRef = useRef(null);

  useEffect(() => {
    setPreviewLoaded(false);
  }, [previewPage, previewKey]);

  const isDarkColor = (hex) => {
    if (!hex || typeof hex !== 'string') return true;
    const clean = hex.replace('#', '').trim();
    if (clean.length !== 3 && clean.length !== 6) return true;
    const r = parseInt(clean.length === 3 ? clean[0] + clean[0] : clean.substring(0, 2), 16);
    const g = parseInt(clean.length === 3 ? clean[1] + clean[1] : clean.substring(2, 4), 16);
    const b = parseInt(clean.length === 3 ? clean[2] + clean[2] : clean.substring(4, 6), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return true;
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq < 135;
  };

  // Filtered lists for Theme Studio & Coolors Studio
  const filteredThemes = useMemo(() => {
    return THEME_LAYOUT_PRESETS.filter((preset) => {
      if (themeModeFilter === 'dark' && preset.isLight) return false;
      if (themeModeFilter === 'light' && !preset.isLight) return false;
      if (themeCategoryFilter !== 'all' && preset.category !== themeCategoryFilter) return false;
      if (themeSearchQuery.trim()) {
        const q = themeSearchQuery.toLowerCase();
        const matchesName = preset.name.toLowerCase().includes(q);
        const matchesBadge = (preset.badge || '').toLowerCase().includes(q);
        const matchesDesc = (preset.desc || '').toLowerCase().includes(q);
        const matchesTags = (preset.layoutTags || []).some(t => t.toLowerCase().includes(q));
        if (!matchesName && !matchesBadge && !matchesDesc && !matchesTags) return false;
      }
      return true;
    });
  }, [themeModeFilter, themeCategoryFilter, themeSearchQuery]);

  const filteredPalettes = useMemo(() => {
    return COLOR_PALETTES.filter((pal) => {
      if (paletteModeFilter === 'dark' && pal.isLight) return false;
      if (paletteModeFilter === 'light' && !pal.isLight) return false;
      if (['cyber', 'luxury', 'ocean', 'nature', 'warm'].includes(paletteModeFilter) && pal.category !== paletteModeFilter) return false;
      if (paletteSearchQuery.trim()) {
        const q = paletteSearchQuery.toLowerCase();
        const matchesName = pal.name.toLowerCase().includes(q);
        const matchesTags = (pal.tags || []).some(t => t.toLowerCase().includes(q));
        const matchesHex = [pal.primary, pal.bg, pal.card, pal.accent, pal.secondary].some(h => (h || '').toLowerCase().includes(q));
        if (!matchesName && !matchesTags && !matchesHex) return false;
      }
      return true;
    });
  }, [paletteModeFilter, paletteSearchQuery]);

  const syncToPreview = useCallback((configToSync) => {
    const isDark = isDarkColor(configToSync.backgroundColor);
    const fullPreviewConfig = {
      siteName: configToSync.siteName,
      copyrightYear: configToSync.copyrightYear,
      supportEmail: configToSync.supportEmail,
      formSubmitEmail: configToSync.formSubmitEmail,
      baseCurrency: configToSync.baseCurrency,
      hero: {
        title: configToSync.heroTitle,
        subtitle: configToSync.heroSubtitle,
        badge: configToSync.heroBadge
      },
      colors: {
        primary: configToSync.primaryColor,
        secondary: configToSync.secondaryColor,
        accent: configToSync.accentColor,
        background: configToSync.backgroundColor,
        cardBg: configToSync.cardBg,
        surface: configToSync.cardBg,
        textMain: isDark ? 'var(--crm-text-primary)' : '#1D1D1F',
        textMuted: isDark ? 'var(--crm-text-secondary)' : '#6E6E73',
        border: isDark ? 'var(--crm-card)' : '#D2D2D7',
        hairline: isDark ? 'rgba(255, 255, 255, 0.10)' : 'rgba(0, 0, 0, 0.08)',
      },
      theme: {
        activeTheme: configToSync.activeTheme || 'codex-pro',
        borderRadius: configToSync.borderRadius,
        fontFamily: configToSync.fontFamily,
        headerStyle: configToSync.headerStyle,
        heroLayout: configToSync.heroLayout || 'streamer',
        cardStyle: configToSync.cardStyle === 'glass' ? 'bordered' : configToSync.cardStyle || 'bordered',
        sectionsOrder: configToSync.sectionsOrder,
        sectionsVisibility: configToSync.sectionsVisibility,
        layout: {
          sectionsOrder: configToSync.sectionsOrder,
          sectionVisibility: configToSync.sectionsVisibility,
          sectionsVisibility: configToSync.sectionsVisibility,
          heroLayout: configToSync.heroLayout || 'streamer',
          cardStyle: configToSync.cardStyle === 'glass' ? 'bordered' : configToSync.cardStyle || 'bordered',
        }
      },
      socialContacts: configToSync.socialContacts,
      addresses: configToSync.addresses,
      headerSocials: configToSync.headerSocials,
      whatsapp: {
        enabled: configToSync.whatsappDock.enabled,
        number: configToSync.whatsappDock.number,
        defaultMessage: configToSync.whatsappDock.defaultMessage,
        position: configToSync.whatsappDock.position
      },
      tidio: {
        enabled: configToSync.tidioChat.enabled,
        publicKey: configToSync.tidioChat.publicKey,
        position: configToSync.tidioChat.position
      }
    };

    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('codex_live_preview_config', JSON.stringify(fullPreviewConfig));
        sessionStorage.setItem('codex_is_preview', 'true');
      } catch {}
    }

    const iframes = [previewIframeRef.current, fullscreenIframeRef.current];
    iframes.forEach(iframe => {
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({
          type: 'CODEX_PREVIEW_UPDATE',
          config: fullPreviewConfig
        }, '*');
      }
    });
  }, []);

  useEffect(() => {
    syncToPreview(siteConfig);
  }, [siteConfig, syncToPreview]);

  useEffect(() => {
    const handleParentMsg = (e) => {
      if (e.data && e.data.type === 'CODEX_PREVIEW_READY') {
        syncToPreview(siteConfig);
      }
    };
    window.addEventListener('message', handleParentMsg);
    return () => window.removeEventListener('message', handleParentMsg);
  }, [siteConfig, syncToPreview]);

  const handleJumpToSection = (secId) => {
    setHighlightedSection(secId);
    setTimeout(() => setHighlightedSection(null), 2500);

    const iframes = [previewIframeRef.current, fullscreenIframeRef.current];
    iframes.forEach(iframe => {
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({
          type: 'CODEX_PREVIEW_SCROLL_TO',
          sectionId: secId
        }, '*');
      }
    });
  };

  const handleApplyTemplatePreset = (preset) => {
    // 1) Ensure layout is applied perfectly paying attention to every detail
    // 2) Guarantee all sections are active/visible so no idle sections exist
    const allSectionsVisible = Object.fromEntries(DEFAULT_SECTIONS.map((s) => [s.id, true]));

    setSiteConfig((prev) => ({
      ...prev,
      activeTheme: preset.id,
      primaryColor: preset.primary,
      secondaryColor: preset.secondary || preset.card,
      accentColor: preset.accent,
      backgroundColor: preset.bg,
      cardBg: preset.card,
      heroLayout: preset.heroLayout || 'streamer',
      headerStyle: preset.headerStyle || 'floating',
      cardStyle: preset.cardStyle === 'glass' ? 'bordered' : preset.cardStyle || 'bordered',
      fontFamily: preset.fontFamily || 'system',
      borderRadius: preset.borderRadius || 'clean',
      sectionsOrder: preset.sectionsOrder || prev.sectionsOrder || DEFAULT_SECTIONS.map((s) => s.id),
      sectionsVisibility: allSectionsVisible,
    }));
    setHasUnsavedChanges(true);
    showNotification(`Applied Theme & Layout: ${preset.name}`);
  };

  const handleApplyPalette = (palette) => {
    setSiteConfig((prev) => ({
      ...prev,
      primaryColor: palette.primary,
      secondaryColor: palette.secondary || palette.card,
      accentColor: palette.accent,
      backgroundColor: palette.bg,
      cardBg: palette.card,
    }));
    setHasUnsavedChanges(true);
    showNotification(`Applied Color Palette: ${palette.name}`);
  };

  const handleCopyPaletteHexes = (palette, e) => {
    if (e) e.stopPropagation();
    const hexes = `${palette.name}: Primary ${palette.primary} | BG ${palette.bg} | Card ${palette.card} | Accent ${palette.accent} | Secondary ${palette.secondary}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(hexes);
    }
    setCopiedPaletteId(palette.id);
    setTimeout(() => setCopiedPaletteId(null), 1800);
    showNotification(`Copied ${palette.name} hex values`);
  };

  const handleCoolorsStageGenerate = () => {
    const isCurrentlyDark = coolorsStage.mode === 'dark' || (coolorsStage.mode === 'auto' && isDarkColor(siteConfig.backgroundColor));
    const newPal = generateRandomHarmoniousPalette(isCurrentlyDark ? 'dark' : 'light');

    const updatedColors = [
      { id: 'primary', label: 'Primary', hex: newPal.primary },
      { id: 'bg', label: 'Canvas BG', hex: newPal.bg },
      { id: 'card', label: 'Card Surface', hex: newPal.card },
      { id: 'accent', label: 'Accent', hex: newPal.accent },
      { id: 'secondary', label: 'Secondary', hex: newPal.secondary },
    ];

    setCoolorsStage(prev => ({
      ...prev,
      name: newPal.name,
      contrastRating: newPal.contrastLevel || 'AAA',
      contrastRatio: isCurrentlyDark ? '14.8:1' : '11.5:1',
      colors: updatedColors
    }));

    if (coolorsAutoApply) {
      setSiteConfig(prev => ({
        ...prev,
        primaryColor: newPal.primary,
        backgroundColor: newPal.bg,
        cardBg: newPal.card,
        accentColor: newPal.accent,
        secondaryColor: newPal.secondary,
      }));
      setHasUnsavedChanges(true);
    }

    showNotification(`🎲 Generated Coolors Palette: ${newPal.name}`);
  };

  const handleCopyPillarHex = (hex, index) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(hex);
    }
    setCopiedPillarIdx(index);
    setTimeout(() => setCopiedPillarIdx(null), 1500);
    showNotification(`Copied hex: ${hex}`);
  };

  const handleApplyCoolorsStage = () => {
    const primary = coolorsStage.colors.find(c => c.id === 'primary')?.hex || siteConfig.primaryColor;
    const bg = coolorsStage.colors.find(c => c.id === 'bg')?.hex || siteConfig.backgroundColor;
    const card = coolorsStage.colors.find(c => c.id === 'card')?.hex || siteConfig.cardBg;
    const accent = coolorsStage.colors.find(c => c.id === 'accent')?.hex || siteConfig.accentColor;
    const secondary = coolorsStage.colors.find(c => c.id === 'secondary')?.hex || siteConfig.secondaryColor;

    setSiteConfig(prev => ({
      ...prev,
      primaryColor: primary,
      backgroundColor: bg,
      cardBg: card,
      accentColor: accent,
      secondaryColor: secondary,
    }));
    setHasUnsavedChanges(true);
    showNotification(`Applied Coolors Engine palette to live website!`);
  };

  const handleCoolorsRandomize = () => {
    handleCoolorsStageGenerate();
  };

  const handleResetSectionOrder = () => {
    const defaultIds = DEFAULT_SECTIONS.map(s => s.id);
    const defaultVis = Object.fromEntries(DEFAULT_SECTIONS.map(s => [s.id, true]));
    setSiteConfig(prev => ({
      ...prev,
      sectionsOrder: defaultIds,
      sectionsVisibility: defaultVis
    }));
    setHasUnsavedChanges(true);
    showNotification('Restored default section sequence.');
  };

  // Field change helpers
  const updateField = (field, value) => {
    setSiteConfig(prev => ({ ...prev, [field]: value }));
    setHasUnsavedChanges(true);
  };

  const updateNestedField = (parent, field, value) => {
    setSiteConfig(prev => ({
      ...prev,
      [parent]: {
        ...prev[parent],
        [field]: value
      }
    }));
    setHasUnsavedChanges(true);
  };

  // Preset picker
  const handleApplyPreset = (preset) => {
    setSiteConfig(prev => ({
      ...prev,
      activeTheme: preset.id,
      primaryColor: preset.primary,
      secondaryColor: preset.secondary,
      accentColor: preset.accent,
      backgroundColor: preset.bg,
      cardBg: preset.card
    }));
    setHasUnsavedChanges(true);
    showNotification(`Applied palette: ${preset.name}`);
  };

  // Section order & visibility
  const moveSection = (index, direction) => {
    const newOrder = [...siteConfig.sectionsOrder];
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= newOrder.length) return;
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIdx];
    newOrder[targetIdx] = temp;
    updateField('sectionsOrder', newOrder);
  };

  const toggleSectionVisibility = (secId) => {
    setSiteConfig(prev => ({
      ...prev,
      sectionsVisibility: {
        ...prev.sectionsVisibility,
        [secId]: !prev.sectionsVisibility[secId]
      }
    }));
    setHasUnsavedChanges(true);
  };

  // ── Contact Actions (CRUD + Multi-Endpoints) ──────────────────────
  const openAddContactModal = () => {
    setEditingContactId(null);
    setContactForm({
      type: 'phone',
      label: '',
      value: '',
      extraValues: [],
      isPrimary: false,
    });
    setContactModalOpen(true);
  };

  const openEditContactModal = (contact) => {
    setEditingContactId(contact.id);
    setContactForm({
      type: contact.type,
      label: contact.label,
      value: contact.value,
      extraValues: Array.isArray(contact.extraValues) ? [...contact.extraValues] : [],
      isPrimary: Boolean(contact.isPrimary),
    });
    setContactModalOpen(true);
  };

  const handleAddModalExtraValue = () => {
    setContactForm(prev => ({
      ...prev,
      extraValues: [...(Array.isArray(prev.extraValues) ? prev.extraValues : []), ''],
    }));
  };

  const handleUpdateModalExtraValue = (index, val) => {
    setContactForm(prev => {
      const updated = [...(Array.isArray(prev.extraValues) ? prev.extraValues : [])];
      updated[index] = val;
      return { ...prev, extraValues: updated };
    });
  };

  const handleRemoveModalExtraValue = (index) => {
    setContactForm(prev => {
      const updated = [...(Array.isArray(prev.extraValues) ? prev.extraValues : [])];
      updated.splice(index, 1);
      return { ...prev, extraValues: updated };
    });
  };

  const handleSaveContactSubmit = (e) => {
    e.preventDefault();
    if (!contactForm.value.trim()) {
      showNotification('Please enter at least one contact value.');
      return;
    }

    const filteredExtras = (contactForm.extraValues || [])
      .map(v => typeof v === 'string' ? v.trim() : (v?.value || '').trim())
      .filter(Boolean);

    let updatedContacts = [...siteConfig.socialContacts];

    if (editingContactId) {
      updatedContacts = updatedContacts.map(c => {
        if (c.id === editingContactId) {
          return {
            ...c,
            type: contactForm.type,
            label: contactForm.label.trim() || `${contactForm.type.toUpperCase()} Channel`,
            value: contactForm.value.trim(),
            extraValues: filteredExtras,
            isPrimary: contactForm.isPrimary,
          };
        }
        if (contactForm.isPrimary && c.type === contactForm.type) {
          return { ...c, isPrimary: false };
        }
        return c;
      });
      showNotification('Contact channel updated.');
    } else {
      const newContactItem = {
        id: `c-${Date.now()}`,
        type: contactForm.type,
        label: contactForm.label.trim() || `${contactForm.type.toUpperCase()} Channel`,
        value: contactForm.value.trim(),
        extraValues: filteredExtras,
        isPrimary: contactForm.isPrimary,
      };

      if (contactForm.isPrimary) {
        updatedContacts = updatedContacts.map(c => c.type === contactForm.type ? { ...c, isPrimary: false } : c);
      }
      updatedContacts.push(newContactItem);
      showNotification('Contact channel added.');
    }

    setSiteConfig(prev => ({ ...prev, socialContacts: updatedContacts }));
    setHasUnsavedChanges(true);
    setContactModalOpen(false);
  };

  const executeDeleteContact = (id) => {
    const contact = siteConfig.socialContacts.find(c => c.id === id);
    setSiteConfig(prev => ({
      ...prev,
      socialContacts: prev.socialContacts.filter(c => c.id !== id),
    }));
    setSelectedContactIds(prev => prev.filter(x => x !== id));
    setConfirmDeleteContactId(null);
    setHasUnsavedChanges(true);
    showNotification(`Deleted contact channel "${contact?.label || 'item'}".`);
  };

  const handleBulkDeleteContacts = () => {
    if (selectedContactIds.length === 0) return;
    const count = selectedContactIds.length;
    setSiteConfig(prev => ({
      ...prev,
      socialContacts: prev.socialContacts.filter(c => !selectedContactIds.includes(c.id)),
    }));
    setSelectedContactIds([]);
    setHasUnsavedChanges(true);
    showNotification(`Deleted ${count} contact channel(s).`);
  };

  const handleToggleSelectContact = (id) => {
    setSelectedContactIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAllContacts = (e) => {
    if (e.target.checked) {
      setSelectedContactIds(siteConfig.socialContacts.map(c => c.id));
    } else {
      setSelectedContactIds([]);
    }
  };

  const handleRemoveExtraValueFromContact = (contactId, idx) => {
    setSiteConfig(prev => ({
      ...prev,
      socialContacts: prev.socialContacts.map(c => {
        if (c.id !== contactId) return c;
        const current = Array.isArray(c.extraValues) ? [...c.extraValues] : [];
        current.splice(idx, 1);
        return {
          ...c,
          extraValues: current
        };
      })
    }));
    setHasUnsavedChanges(true);
    showNotification('Endpoint removed.');
  };

  const handleSetPrimaryContact = (id, type) => {
    setSiteConfig(prev => ({
      ...prev,
      socialContacts: prev.socialContacts.map(c => {
        if (c.type !== type) return c;
        return { ...c, isPrimary: c.id === id };
      })
    }));
    setHasUnsavedChanges(true);
    showNotification('Primary channel updated.');
  };

  // ── Office Locations (CRUD) ───────────────────────────────────────
  const openAddOfficeModal = () => {
    setEditingOfficeId(null);
    setOfficeForm({
      label: '',
      fullAddress: '',
      phone: '',
      isPrimary: false,
    });
    setOfficeModalOpen(true);
  };

  const openEditOfficeModal = (addr) => {
    setEditingOfficeId(addr.id);
    setOfficeForm({
      label: addr.label,
      fullAddress: addr.fullAddress,
      phone: addr.phone || '',
      isPrimary: Boolean(addr.isPrimary),
    });
    setOfficeModalOpen(true);
  };

  const handleSaveOfficeSubmit = (e) => {
    e.preventDefault();
    if (!officeForm.label.trim() || !officeForm.fullAddress.trim()) {
      showNotification('Please fill in office name and physical address.');
      return;
    }

    let updatedAddresses = [...siteConfig.addresses];
    if (editingOfficeId) {
      updatedAddresses = updatedAddresses.map(a => {
        if (a.id === editingOfficeId) {
          return {
            ...a,
            label: officeForm.label.trim(),
            fullAddress: officeForm.fullAddress.trim(),
            phone: officeForm.phone.trim(),
            isPrimary: officeForm.isPrimary,
          };
        }
        if (officeForm.isPrimary) return { ...a, isPrimary: false };
        return a;
      });
      showNotification('Office location updated.');
    } else {
      const newAddr = {
        id: `a-${Date.now()}`,
        label: officeForm.label.trim(),
        street: officeForm.fullAddress.trim(),
        city: '',
        fullAddress: officeForm.fullAddress.trim(),
        phone: officeForm.phone.trim(),
        lat: 0,
        lng: 0,
        isPrimary: officeForm.isPrimary,
      };
      if (officeForm.isPrimary) {
        updatedAddresses = updatedAddresses.map(a => ({ ...a, isPrimary: false }));
      }
      updatedAddresses.push(newAddr);
      showNotification('Office location added.');
    }

    setSiteConfig(prev => ({ ...prev, addresses: updatedAddresses }));
    setHasUnsavedChanges(true);
    setOfficeModalOpen(false);
  };

  const handleDeleteOffice = (id) => {
    const addr = siteConfig.addresses.find(a => a.id === id);
    if (!window.confirm(`Delete office location "${addr?.label || 'this location'}"?`)) return;
    setSiteConfig(prev => ({
      ...prev,
      addresses: prev.addresses.filter(a => a.id !== id),
    }));
    setHasUnsavedChanges(true);
    showNotification('Office location deleted.');
  };

  const handleSetPrimaryOffice = (id) => {
    setSiteConfig(prev => ({
      ...prev,
      addresses: prev.addresses.map(a => ({
        ...a,
        isPrimary: a.id === id
      }))
    }));
    setHasUnsavedChanges(true);
    showNotification('Headquarters office designation updated.');
  };

  // Webhook Test
  const handleTestWebhook = async () => {
    if (!siteConfig.security.webhookUrl) {
      showNotification('Please enter a webhook URL first.');
      return;
    }
    setTestingWebhook(true);
    setWebhookTestStatus(null);
    try {
      const res = await fetch('/api/crm/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test_webhook',
          payload: { url: siteConfig.security.webhookUrl }
        })
      });
      if (res.ok) {
        setWebhookTestStatus({ success: true, message: 'Ping acknowledged (200 OK).' });
        showNotification('Webhook test successful!');
      } else {
        setWebhookTestStatus({ success: false, message: `Server returned HTTP ${res.status}.` });
        showNotification('Webhook test returned an error.');
      }
    } catch (err) {
      setWebhookTestStatus({ success: false, message: err.message || 'Connection failed.' });
      showNotification('Webhook ping failed.');
    } finally {
      setTestingWebhook(false);
    }
  };

  // Password Update
  const handleChangePassword = (e) => {
    e.preventDefault();
    if (!passwordState.currentPassword || !passwordState.newPassword) {
      showNotification('Please fill all password fields.');
      return;
    }
    if (passwordState.newPassword !== passwordState.confirmPassword) {
      showNotification('New passwords do not match.');
      return;
    }
    if (passwordState.newPassword.length < 6) {
      showNotification('New password must be at least 6 characters.');
      return;
    }
    showNotification('Admin credentials updated successfully.');
    setPasswordState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  };

  // Backup & Restore
  const handleExportBackup = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(siteConfig, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `codex-site-settings-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showNotification('Settings backup exported as JSON.');
  };

  const handleImportBackup = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (parsed && typeof parsed === 'object') {
          setSiteConfig(prev => ({ ...prev, ...parsed }));
          setHasUnsavedChanges(true);
          showNotification('Backup imported into preview. Click "Save All Changes" to publish.');
        }
      } catch (err) {
        showNotification('Invalid JSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Save All Changes
  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const fullConfig = {
        siteName: siteConfig.siteName,
        copyrightYear: siteConfig.copyrightYear,
        supportEmail: siteConfig.supportEmail,
        formSubmitEmail: siteConfig.formSubmitEmail,
        baseCurrency: siteConfig.baseCurrency,
        hero: {
          title: siteConfig.heroTitle,
          subtitle: siteConfig.heroSubtitle,
          badge: siteConfig.heroBadge
        },
        colors: {
          primary: siteConfig.primaryColor,
          secondary: siteConfig.secondaryColor,
          accent: siteConfig.accentColor,
          background: siteConfig.backgroundColor,
          cardBg: siteConfig.cardBg,
          textMain: 'var(--crm-text-primary)',
          textMuted: 'var(--crm-text-secondary)'
        },
        theme: {
          activeTheme: siteConfig.activeTheme || 'codex-pro',
          borderRadius: siteConfig.borderRadius,
          fontFamily: siteConfig.fontFamily,
          headerStyle: siteConfig.headerStyle,
          heroLayout: siteConfig.heroLayout || 'streamer',
          cardStyle: siteConfig.cardStyle === 'glass' ? 'bordered' : siteConfig.cardStyle || 'bordered',
          sectionsOrder: siteConfig.sectionsOrder,
          sectionsVisibility: siteConfig.sectionsVisibility
        },
        socialContacts: siteConfig.socialContacts,
        addresses: siteConfig.addresses,
        headerSocials: siteConfig.headerSocials,
        whatsapp: {
          enabled: siteConfig.whatsappDock.enabled,
          number: siteConfig.whatsappDock.number,
          defaultMessage: siteConfig.whatsappDock.defaultMessage,
          position: siteConfig.whatsappDock.position
        },
        tidio: {
          enabled: siteConfig.tidioChat.enabled,
          publicKey: siteConfig.tidioChat.publicKey,
          position: siteConfig.tidioChat.position
        },
        seo: siteConfig.seo,
        webhookUrl: siteConfig.security.webhookUrl
      };

      if (typeof window !== 'undefined') {
        localStorage.setItem('codex_site_config', JSON.stringify(fullConfig));
      }

      const newPlatformSettings = {
        platformName: siteConfig.siteName,
        platformYear: siteConfig.copyrightYear,
        platformPhone: siteConfig.socialContacts.find(c => c.type === 'phone')?.value || DEFAULT_PLATFORM_SETTINGS.platformPhone,
        platformAddress: siteConfig.addresses[0]?.fullAddress || DEFAULT_PLATFORM_SETTINGS.platformAddress,
        supportEmail: siteConfig.supportEmail,
        heroHeader: siteConfig.heroTitle,
        heroStatement: siteConfig.heroSubtitle,
        baseCurrency: siteConfig.baseCurrency,
        registrationEnabled: siteConfig.security.registrationEnabled,
        twoFactorAuthEnabled: siteConfig.security.twoFactorAuthEnabled,
        sessionTimeoutMinutes: Number(siteConfig.security.sessionTimeoutMinutes) || 30,
        maxFailedLoginAttempts: Number(siteConfig.security.maxFailedLoginAttempts) || 5,
        primaryColor: siteConfig.primaryColor,
        secondaryColor: siteConfig.secondaryColor,
        accentColor: siteConfig.accentColor,
        buttonColor: siteConfig.primaryColor,
        backgroundColor: siteConfig.backgroundColor
      };

      updateLocalSettingsState(newPlatformSettings);
      await saveSettingsToApi(newPlatformSettings).catch(() => {});

      await fetch('/api/crm/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_site_content',
          payload: { config: fullConfig }
        })
      }).catch(() => {});

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('codex_config_updated', { detail: fullConfig }));
      }

      setHasUnsavedChanges(false);
      showNotification('All site & platform settings saved and published successfully.');
    } catch (err) {
      console.error('Save failed:', err);
      showNotification('Failed to save settings: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefaults = () => {
    if (!window.confirm('Reset all site settings to official Codex Dynamics defaults?')) return;
    const defaultData = {
      siteName: DEFAULT_PLATFORM_SETTINGS.platformName,
      copyrightYear: '2026',
      supportEmail: DEFAULT_PLATFORM_SETTINGS.supportEmail,
      formSubmitEmail: 'codexdynamix@gmail.com',
      baseCurrency: 'USD',
      heroTitle: 'Precision on every screen.',
      heroSubtitle: 'High-performance websites, custom CRM software, and digital marketing engines.',
      heroBadge: 'Codex Dynamics',
      primaryColor: 'var(--crm-accent)',
      secondaryColor: '#1E2329',
      accentColor: 'var(--crm-accent)',
      backgroundColor: '#0F1216',
      cardBg: '#181A20',
      borderRadius: 'clean',
      fontFamily: 'system',
      headerStyle: 'floating',
      socialContacts: [
        { id: 'c-1', type: 'phone', label: 'Direct Line', value: '+380 (63) 640-67-83', isPrimary: true },
        { id: 'c-2', type: 'whatsapp', label: 'WhatsApp Priority', value: '+380636406783', isPrimary: true },
        { id: 'c-3', type: 'telegram', label: 'Telegram Desk', value: '@codexdynamics', isPrimary: true },
        { id: 'c-4', type: 'email', label: 'Client Inquiries', value: 'contact@codexdynamics.com', isPrimary: true },
        { id: 'c-5', type: 'viber', label: 'Viber Hotline', value: '+380636406783', isPrimary: false },
      ],
      addresses: [
        { id: 'a-1', label: 'Kyiv HQ', street: 'Sportyvna Square, 1A', city: 'Kyiv, Ukraine', fullAddress: 'Sportyvna Square, 1A, Kyiv 012023, Ukraine', isPrimary: true },
      ],
      sectionsOrder: DEFAULT_SECTIONS.map(s => s.id),
      sectionsVisibility: {
        hero: true, highlights: true, services: true, portfolio: true, results: true, about: true, blog: true, reviews: true, contact: true
      },
      whatsappDock: {
        enabled: true,
        number: '+380636406783',
        defaultMessage: "Hello Codex Dynamics, I'm interested in building a high-performance web project.",
        position: 'bottom-right'
      },
      tidioChat: { enabled: false, publicKey: '', position: 'bottom-right' },
      seo: {
        metaTitle: 'Codex Dynamics | High-Performance Websites & Custom CRMs',
        metaDescription: 'High-performance websites, web design, web development, custom CRMs, and digital marketing agency.',
        keywords: 'web development, custom CRM, react, web design, digital marketing',
        canonicalUrl: 'https://codexdynamics.com',
        ogImage: '/og.jpg',
        allowIndexing: true
      },
      security: {
        registrationEnabled: true,
        twoFactorAuthEnabled: true,
        sessionTimeoutMinutes: 30,
        maxFailedLoginAttempts: 5,
        webhookUrl: ''
      }
    };

    setSiteConfig(defaultData);
    setHasUnsavedChanges(true);
    showNotification('Settings reverted to defaults. Click "Save All Changes" to publish.');
  };

  // Dynamic WCAG 2.1 Contrast Calculations (computed after siteConfig is initialized)
  const wcagTextMetrics = useMemo(() => {
    const bgHex = siteConfig?.backgroundColor || '#0F1216';
    const textHex = isDarkColor(bgHex) ? 'var(--crm-text-primary)' : '#14171A';
    const ratio = calcContrastRatio(textHex, bgHex);
    return { ratio, ...getWcagLevel(ratio) };
  }, [siteConfig?.backgroundColor]);

  const wcagAccentMetrics = useMemo(() => {
    const bgHex = siteConfig?.backgroundColor || '#0F1216';
    const accentHex = siteConfig?.primaryColor || 'var(--crm-accent)';
    const ratio = calcContrastRatio(accentHex, bgHex);
    return { ratio, ...getWcagLevel(ratio) };
  }, [siteConfig?.backgroundColor, siteConfig?.primaryColor]);

  // Global Keyboard Shortcuts (⌘S / Ctrl+S to save, '/' to search)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveAll();
      }
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        const searchInput = document.querySelector('.crm-studio-search-input');
        if (searchInput) {
          searchInput.focus();
          searchInput.select?.();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSaveAll]);

  return (
    <div className="crm-site-settings-root">
      {/* ── Page Header ────────────────────────────────────────── */}
      <div className="crm-site-settings-header">
        <div className="crm-site-settings-title-group">
          <h2>
            <span className="crm-title-icon">⚙</span>
            Site & Platform Settings
          </h2>
          <p>
            Configure public website visual identity, communication endpoints, page section sequence, and CRM security invariants.
          </p>
        </div>

        <div className="crm-site-settings-actions">
          {hasUnsavedChanges ? (
            <div className="crm-status-pill unsaved">
              <span className="crm-status-pulse" />
              Unsaved Changes
            </div>
          ) : (
            <div className="crm-status-pill saved">
              <Check size={13} strokeWidth={2.5} />
              Synced & Live
            </div>
          )}

          <button
            type="button"
            className="crm-btn-secondary"
            onClick={handleResetToDefaults}
            title="Revert form to factory defaults"
          >
            <RotateCcw size={13} />
            <span>Reset</span>
          </button>

          <button
            type="button"
            className="crm-btn-primary"
            onClick={handleSaveAll}
            disabled={saving}
          >
            <Save size={14} />
            <span>{saving ? 'Publishing...' : 'Save All Changes'}</span>
          </button>
        </div>
      </div>

      {/* ── Sub-Tabs Navigation Bar ────────────────────────────── */}
      <nav className="crm-settings-tab-bar" aria-label="Site settings sub-navigation">
        {SUB_TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          let badgeText = '';
          if (tab.id === 'layout') badgeText = '6 Modules';
          if (tab.id === 'contacts') badgeText = `${siteConfig.socialContacts?.length || 0}`;
          if (tab.id === 'socials') badgeText = `${Object.values(siteConfig.headerSocials || {}).filter(s => s.enabled).length} Active`;
          if (tab.id === 'seo') badgeText = 'SERP Ready';
          if (tab.id === 'security') badgeText = siteConfig.security?.twoFactorAuthEnabled ? '2FA Active' : 'RBAC';

          return (
            <button
              key={tab.id}
              type="button"
              className={`crm-settings-tab-btn ${isActive ? 'active' : ''}`}
              onClick={() => setActiveSubTab(tab.id)}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
              {badgeText && (
                <span className={`crm-tab-count-pill ${isActive ? 'active' : ''}`}>
                  {badgeText}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* ── 2. Contact Channels ────────────────────────────────── */}
      {activeSubTab === 'contacts' && (
        <div className="crm-settings-panel">
          <div className="crm-settings-section-head">
            <div>
              <h3><Phone size={16} color="#0ECB81" /> Communication Endpoints & Offices</h3>
              <p>Manage telephone lines, direct WhatsApp links, Telegram handles, and physical office addresses shown on the website.</p>
            </div>
            <button
              type="button"
              className="crm-btn-primary"
              onClick={openAddContactModal}
            >
              <Plus size={14} />
              <span>Add Channel</span>
            </button>
          </div>

          {selectedContactIds.length > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 14px',
              background: '#2B313A',
              border: '1px solid var(--crm-border)',
              borderRadius: 6,
              marginBottom: 10
            }}>
              <span style={{ fontSize: 12, color: 'var(--crm-text-primary)', fontWeight: 600 }}>
                {selectedContactIds.length} contact channel(s) selected
              </span>
              <button
                type="button"
                className="crm-super-admin-btn crm-super-admin-btn-small"
                style={{ background: '#c0392b', color: '#fff' }}
                onClick={handleBulkDeleteContacts}
              >
                ✕ Delete Selected ({selectedContactIds.length})
              </button>
            </div>
          )}

          {/* Contact Channels Table - Designed exactly like Leads Table in Leads Management */}
          <div className="crm-admin-table-container">
            <table className="crm-admin-table">
              <thead>
                <tr>
                  <th style={{ width: 40, textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={siteConfig.socialContacts.length > 0 && selectedContactIds.length === siteConfig.socialContacts.length}
                      onChange={handleSelectAllContacts}
                      title="Select all channels"
                    />
                  </th>
                  <th style={{ width: 170 }}>Protocol</th>
                  <th style={{ width: 180 }}>Channel Name</th>
                  <th>Contact Endpoint(s)</th>
                  <th style={{ width: 120, textAlign: 'center' }}>Status</th>
                  <th style={{ width: 170, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {siteConfig.socialContacts.map(contact => {
                  const isCopied = copiedKey === `contact-${contact.id}`;
                  const isSelected = selectedContactIds.includes(contact.id);
                  const hasExtras = Array.isArray(contact.extraValues) && contact.extraValues.length > 0;
                  const isConfirmingDelete = confirmDeleteContactId === contact.id;

                  return (
                    <tr key={contact.id} className={isSelected ? 'crm-row-selected' : ''}>
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectContact(contact.id)}
                        />
                      </td>
                      <td>
                        <OfficialProtocolBadge type={contact.type} />
                      </td>
                      <td>
                        <div className="crm-channel-name-cell">
                          <strong className="crm-channel-title">{contact.label}</strong>
                          <span className="crm-channel-sub">{contact.id}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div className="crm-endpoint-primary-row">
                            <span className="crm-endpoint-val-text">{contact.value}</span>
                            <button
                              type="button"
                              className="crm-endpoint-copy-icon-btn"
                              title={`Copy ${contact.value}`}
                              onClick={() => handleCopyValue(contact.value, `contact-${contact.id}`, contact.label)}
                            >
                              {isCopied ? <Check size={11} color="#0ECB81" /> : <Copy size={11} />}
                            </button>
                          </div>

                          {hasExtras && (
                            <div className="crm-endpoint-extra-list">
                              {contact.extraValues.map((extraVal, exIdx) => {
                                const exCopied = copiedKey === `contact-${contact.id}-extra-${exIdx}`;
                                return (
                                  <div key={exIdx} className="crm-endpoint-extra-row">
                                    <span className="crm-endpoint-extra-bullet">•</span>
                                    <span className="crm-endpoint-extra-val-text">{extraVal}</span>
                                    <button
                                      type="button"
                                      className="crm-endpoint-copy-icon-btn"
                                      onClick={() => handleCopyValue(extraVal, `contact-${contact.id}-extra-${exIdx}`, `${contact.label} (#${exIdx + 2})`)}
                                      title="Copy additional value"
                                    >
                                      {exCopied ? <Check size={10} color="#0ECB81" /> : <Copy size={10} />}
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {contact.isPrimary ? (
                          <span className="crm-status-primary-badge">
                            ★ Primary
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="crm-btn-set-primary"
                            onClick={() => handleSetPrimaryContact(contact.id, contact.type)}
                            title="Designate as primary channel"
                          >
                            Set Primary
                          </button>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {isConfirmingDelete ? (
                          <div className="crm-inline-confirm-del-box">
                            <span className="crm-del-prompt">Delete?</span>
                            <button
                              type="button"
                              className="crm-del-btn-confirm"
                              onClick={() => executeDeleteContact(contact.id)}
                            >
                              Yes
                            </button>
                            <button
                              type="button"
                              className="crm-del-btn-cancel"
                              onClick={() => setConfirmDeleteContactId(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="crm-actions-cluster">
                            <button
                              type="button"
                              className="crm-action-btn crm-action-change"
                              onClick={() => openEditContactModal(contact)}
                              title="Change channel details, protocol, or endpoints"
                            >
                              <Edit size={12} />
                              <span>Change</span>
                            </button>
                            <button
                              type="button"
                              className="crm-action-btn crm-action-delete"
                              onClick={() => setConfirmDeleteContactId(contact.id)}
                              title="Delete this contact channel"
                            >
                              <Trash2 size={12} />
                              <span>Delete</span>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Physical Headquarters Section - Leads Table Design */}
          <div style={{ marginTop: 12 }}>
            <div className="crm-settings-section-head" style={{ marginBottom: 12 }}>
              <div>
                <h4 style={{ margin: 0, fontSize: 13, color: 'var(--crm-text-primary)', fontWeight: 600 }}>📍 Physical Office Locations</h4>
                <p style={{ margin: '3px 0 0 0', fontSize: 11.5, color: 'var(--crm-text-secondary)' }}>Rendered in footer, contact modals, and geo-navigation.</p>
              </div>
            </div>

            <div className="crm-admin-table-container">
              <table className="crm-admin-table">
                <thead>
                  <tr>
                    <th style={{ width: 220 }}>Office Location</th>
                    <th>Full Physical Address</th>
                    <th style={{ width: 120 }}>Designation</th>
                    <th style={{ width: 100, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {siteConfig.addresses.map((addr, idx) => {
                    const isAddrCopied = copiedKey === `addr-${addr.id}`;
                    return (
                      <tr key={addr.id}>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--crm-text-primary)' }}>{addr.label}</div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input
                              type="text"
                              className="crm-settings-input"
                              value={addr.fullAddress}
                              onChange={e => {
                                const updated = [...siteConfig.addresses];
                                updated[idx] = { ...addr, fullAddress: e.target.value };
                                updateField('addresses', updated);
                              }}
                              style={{ flex: 1, minWidth: 240 }}
                            />
                            <button
                              title={addr.fullAddress}
                              onClick={() => handleCopyValue(addr.fullAddress, `addr-${addr.id}`, addr.label)}
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: isAddrCopied ? '#0ECB81' : 'var(--crm-text-secondary)',
                                padding: '2px 4px',
                                lineHeight: 1,
                                borderRadius: 3,
                                display: 'inline-flex',
                                alignItems: 'center'
                              }}
                              onMouseEnter={e => { if (!isAddrCopied) e.currentTarget.style.color = 'var(--crm-accent)'; }}
                              onMouseLeave={e => { if (!isAddrCopied) e.currentTarget.style.color = isAddrCopied ? '#0ECB81' : 'var(--crm-text-secondary)'; }}
                            >
                              {isAddrCopied ? <Check size={12} color="#0ECB81" /> : <Copy size={12} />}
                            </button>
                          </div>
                        </td>
                        <td>
                          {addr.isPrimary ? (
                            <span className="crm-status-badge crm-status-pending" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              ★ HQ Hub
                            </span>
                          ) : (
                            <span className="crm-status-badge crm-status-suspended">
                              Regional
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="crm-btn-secondary"
                            style={{ padding: '4px 10px', fontSize: 11.5, gap: 5, borderRadius: 6, display: 'inline-flex', alignItems: 'center' }}
                            onClick={() => handleCopyValue(addr.fullAddress, `addr-${addr.id}`, addr.label)}
                          >
                            {isAddrCopied ? <Check size={11} color="#0ECB81" /> : <Copy size={11} />}
                            <span>{isAddrCopied ? 'Copied' : 'Copy'}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── 3. Header Socials ──────────────────────────────────── */}
      {activeSubTab === 'socials' && (
        <div className="crm-settings-panel">
          <div className="crm-settings-section-head">
            <div>
              <h3><Share2 size={16} color="#2979F0" /> Header Social Profiles</h3>
              <p>Configure official brand presence icons rendered across the website navigation header and footer directory.</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { key: 'x', name: 'X (formerly Twitter)', defaultUrl: 'https://x.com/codexdynamics', Logo: TwitterXLogo, desc: 'Broadcast platform announcements, milestone releases & engineering updates.' },
              { key: 'linkedin', name: 'LinkedIn Company Profile', defaultUrl: 'https://linkedin.com/company/codexdynamics', Logo: LinkedInLogo, desc: 'Corporate identity, B2B institutional relationships & executive recruitment.' },
              { key: 'github', name: 'GitHub Organization', defaultUrl: 'https://github.com/codexdynamix', Logo: GitHubLogo, desc: 'Open-source components, developer API libraries & integration SDKs.' },
              { key: 'instagram', name: 'Instagram Portfolio', defaultUrl: 'https://instagram.com/codexdynamics', Logo: InstagramLogo, desc: 'Design showcases, studio life, interactive culture & stories.' },
              { key: 'facebook', name: 'Facebook Page', defaultUrl: 'https://facebook.com/codexdynamics', Logo: FacebookLogo, desc: 'Community engagement, verified client reviews & company announcements.' },
            ].map(social => {
              const item = siteConfig.headerSocials[social.key] || { enabled: false, url: social.defaultUrl, handle: '' };
              const isSocialCopied = copiedKey === `social-${social.key}`;
              const LogoComp = social.Logo;

              return (
                <div key={social.key} className="crm-social-card">
                  <div className="crm-social-card-avatar" title={social.name}>
                    <LogoComp style={{ width: 22, height: 22, display: 'block' }} />
                  </div>

                  <div className="crm-social-card-content">
                    <div className="crm-social-card-header">
                      <div className="crm-social-card-title-wrap">
                        <span className="crm-social-card-title">{social.name}</span>
                        {item.enabled ? (
                          <span className="crm-status-pill saved" style={{ fontSize: 10, padding: '2px 8px' }}>
                            Active in Header
                          </span>
                        ) : (
                          <span className="crm-status-pill" style={{ fontSize: 10, padding: '2px 8px', background: 'rgba(255,255,255,0.05)', color: 'var(--crm-text-secondary)', border: '1px solid var(--crm-border)' }}>
                            Hidden
                          </span>
                        )}
                      </div>
                      <p className="crm-social-card-desc">{social.desc}</p>
                    </div>

                    <div className="crm-social-input-row">
                      <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
                        <input
                          type="text"
                          className="crm-settings-input"
                          placeholder={social.defaultUrl}
                          value={item.url}
                          disabled={!item.enabled}
                          onChange={e => {
                            const updated = {
                              ...siteConfig.headerSocials,
                              [social.key]: { ...item, url: e.target.value }
                            };
                            updateField('headerSocials', updated);
                          }}
                          style={{
                            width: '100%',
                            paddingRight: item.enabled && item.url ? 36 : 12,
                            opacity: item.enabled ? 1 : 0.65
                          }}
                        />
                        {item.enabled && item.url && (
                          <button
                            type="button"
                            className={`crm-settings-copy-btn ${isSocialCopied ? 'copied' : ''}`}
                            onClick={() => handleCopyValue(item.url, `social-${social.key}`, social.name)}
                            title={isSocialCopied ? 'Copied!' : 'Copy URL'}
                            aria-label={`Copy URL for ${social.name}`}
                            style={{ position: 'absolute', right: 6 }}
                          >
                            {isSocialCopied ? <Check size={12} strokeWidth={2.5} /> : <Copy size={12} />}
                          </button>
                        )}
                      </div>

                      {/* Standard Apple/iOS Toggle Switch */}
                      <label className="crm-toggle-switch" title={`Toggle ${social.name} visibility`}>
                        <input
                          type="checkbox"
                          checked={item.enabled}
                          onChange={() => {
                            const updated = {
                              ...siteConfig.headerSocials,
                              [social.key]: { ...item, enabled: !item.enabled }
                            };
                            updateField('headerSocials', updated);
                          }}
                        />
                        <span className="crm-toggle-slider" />
                      </label>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 4. Layout & Modules: WordPress-Style Template Customizer & Live Site Preview Studio ────────────────────────────────── */}
      {activeSubTab === 'layout' && (
        <div className="crm-layout-studio-wrapper">
          {/* Top Headline & Quick Actions */}
          <div className="crm-settings-section-head" style={{ marginBottom: 0 }}>
            <div>
              <h3><Layout size={16} color="var(--crm-accent)" /> Template Customizer & Live Site Studio</h3>
              <p>WordPress-style live website preview, instant theme presets, sequence reordering, and conversion modules.</p>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="crm-studio-segmented-tabs" style={{ padding: 3 }}>
                <button
                  type="button"
                  className={`crm-studio-tab-btn ${studioLayoutMode === 'split' ? 'active' : ''}`}
                  onClick={() => setStudioLayoutMode('split')}
                  title="Split view (Controls & Live Preview side by side)"
                >
                  <LayoutGrid size={11} />
                  <span>Split</span>
                </button>
                <button
                  type="button"
                  className={`crm-studio-tab-btn ${studioLayoutMode === 'editor' ? 'active' : ''}`}
                  onClick={() => setStudioLayoutMode('editor')}
                  title="Full width editor (Controls only)"
                >
                  <Sliders size={11} />
                  <span>Full Editor</span>
                </button>
                <button
                  type="button"
                  className={`crm-studio-tab-btn ${studioLayoutMode === 'preview' ? 'active' : ''}`}
                  onClick={() => setStudioLayoutMode('preview')}
                  title="Live preview only"
                >
                  <Eye size={11} />
                  <span>Preview Only</span>
                </button>
              </div>

              <button
                type="button"
                className="crm-preview-action-icon-btn"
                onClick={() => setIsFullscreenPreview(true)}
                title="Open immersive full-window customizer"
              >
                <Maximize2 size={13} />
                <span>Fullscreen Studio</span>
              </button>
              <a
                href="/?preview=1"
                target="_blank"
                rel="noreferrer"
                className="crm-preview-action-icon-btn"
                title="Open live site preview in new browser tab"
              >
                <ExternalLink size={13} />
                <span>New Tab</span>
              </a>
            </div>
          </div>

          {/* 2-Column Split Studio Grid */}
          <div className={`crm-layout-studio-grid mode-${studioLayoutMode}`}>
            {/* ── Left Column: Controls & Presets ── */}
            {studioLayoutMode !== 'preview' && (
              <div className="crm-layout-controls-col">
              {/* Quick Navigation & Section Jumper Bar */}
              <div className="crm-layout-controls-sticky-bar">
                <div className="crm-layout-controls-nav-chips">
                  <button
                    type="button"
                    onClick={() => scrollToSection('identity')}
                    className={`crm-nav-chip ${activeNavSection === 'identity' ? 'active' : ''}`}
                    title="Jump to Identity & Typography"
                  >
                    <Sliders size={12} color={activeNavSection === 'identity' ? '#121418' : '#0A84FF'} />
                    <span>Identity</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollToSection('themes')}
                    className={`crm-nav-chip ${activeNavSection === 'themes' ? 'active' : ''}`}
                    title="Jump to Themes & Layouts"
                  >
                    <Sparkles size={12} color={activeNavSection === 'themes' ? '#121418' : '#FF9F0A'} />
                    <span>Themes ({filteredThemes.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollToSection('palettes')}
                    className={`crm-nav-chip ${activeNavSection === 'palettes' ? 'active' : ''}`}
                    title="Jump to Brand Palettes & Coolors"
                  >
                    <Palette size={12} color={activeNavSection === 'palettes' ? '#121418' : '#BF5AF2'} />
                    <span>Colors ({filteredPalettes.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollToSection('hero')}
                    className={`crm-nav-chip ${activeNavSection === 'hero' ? 'active' : ''}`}
                    title="Jump to Hero & Header Navigation"
                  >
                    <Layers size={12} color={activeNavSection === 'hero' ? '#121418' : '#64D2FF'} />
                    <span>Hero & Nav</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollToSection('sequence')}
                    className={`crm-nav-chip ${activeNavSection === 'sequence' ? 'active' : ''}`}
                    title="Jump to Homepage Sections Sequence"
                  >
                    <Compass size={12} color={activeNavSection === 'sequence' ? '#121418' : '#FF6B00'} />
                    <span>Sections ({siteConfig.sectionsOrder.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollToSection('conversion')}
                    className={`crm-nav-chip ${activeNavSection === 'conversion' ? 'active' : ''}`}
                    title="Jump to Conversion Modules"
                  >
                    <MessageCircle size={12} color={activeNavSection === 'conversion' ? '#121418' : '#30D158'} />
                    <span>Modules</span>
                  </button>
                </div>
                <button
                  type="button"
                  className="crm-expand-toggle-btn"
                  onClick={() => handleExpandAll(!Object.values(expandedSections).every(Boolean))}
                  title="Expand or collapse all setting sections"
                >
                  {Object.values(expandedSections).every(Boolean) ? 'Collapse All' : 'Expand All'}
                </button>
              </div>

              {/* 1. Core Visual Identity & Typography */}
              <div className="crm-ios-card" id="studio-card-identity">
                <div
                  className={`crm-ios-card-head ${!expandedSections.identity ? 'collapsed' : ''}`}
                  onClick={() => toggleSectionCollapse('identity')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && toggleSectionCollapse('identity')}
                  title="Click to toggle section collapse"
                >
                  <div className="crm-ios-head-left">
                    <div className="crm-ios-icon-badge blue">
                      <Sliders size={20} />
                    </div>
                    <div className="crm-ios-title-wrap">
                      <h4>Site Identity & Typography</h4>
                      <p>Company branding, public display typefaces, and global theme mode.</p>
                    </div>
                  </div>
                  <div className="crm-ios-card-head-right">
                    <span
                      className="crm-status-pill saved crm-system-tag-pill"
                      style={{
                        fontSize: 11,
                        padding: '4px 11px',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                        maxWidth: 'none',
                        width: 'auto',
                        overflow: 'visible',
                        textOverflow: 'unset',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                      title={`${siteConfig.siteName || 'Codex Dynamics'} · ${siteConfig.fontFamily === 'system' ? 'System' : siteConfig.fontFamily}`}
                    >
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#0ECB81', flexShrink: 0 }} />
                      <span style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {siteConfig.siteName || 'Codex Dynamics'} · {siteConfig.fontFamily === 'system' ? 'System' : siteConfig.fontFamily}
                      </span>
                    </span>
                    <div className="crm-ios-card-collapse-btn">
                      {expandedSections.identity ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </div>
                  </div>
                </div>

                {expandedSections.identity && (
                  <div className="crm-ios-card-body">
                    <div className="crm-ios-inset-box">
                      <div className="crm-ios-form-row-2" style={{ alignItems: 'flex-start', gap: 12 }}>
                        <div className="crm-settings-field" style={{ flex: 1, minWidth: 0 }}>
                          <label>Company / Platform Name</label>
                          <input
                            type="text"
                            className="crm-settings-input"
                            value={siteConfig.siteName}
                            onChange={e => updateField('siteName', e.target.value)}
                            placeholder="e.g. Codex Dynamics"
                          />
                        </div>

                        <div className="crm-settings-field" style={{ width: 110, minWidth: 100, flexShrink: 0 }}>
                          <label>Base Currency</label>
                          <select
                            className="crm-settings-select"
                            value={siteConfig.baseCurrency}
                            onChange={e => updateField('baseCurrency', e.target.value)}
                          >
                            <option value="USD">USD ($)</option>
                            <option value="EUR">EUR (€)</option>
                            <option value="GBP">GBP (£)</option>
                            <option value="UAH">UAH (₴)</option>
                          </select>
                        </div>
                      </div>

                      <div className="crm-settings-field" style={{ width: '100%', minWidth: 0 }}>
                        <label>Hero Badge Tagline</label>
                        <input
                          type="text"
                          className="crm-settings-input"
                          value={siteConfig.heroBadge}
                          onChange={e => updateField('heroBadge', e.target.value)}
                          placeholder="e.g. Codex Dynamics"
                        />
                      </div>

                      <div className="crm-settings-field" style={{ width: '100%', minWidth: 0 }}>
                        <label>Hero Headline (Display Title)</label>
                        <textarea
                          className="crm-settings-textarea"
                          rows={2}
                          value={siteConfig.heroTitle}
                          onChange={e => updateField('heroTitle', e.target.value)}
                          placeholder="e.g. Precision on every screen."
                        />
                      </div>

                      <div className="crm-settings-field" style={{ width: '100%', minWidth: 0 }}>
                        <label>Hero Supporting Statement</label>
                        <textarea
                          className="crm-settings-textarea"
                          rows={2}
                          value={siteConfig.heroSubtitle}
                          onChange={e => updateField('heroSubtitle', e.target.value)}
                          placeholder="e.g. High-performance websites, custom CRM software, and digital marketing engines."
                        />
                      </div>
                    </div>

                    {/* Quick Theme Switcher (Apple Inset Grid) */}
                    <div className="crm-ios-inset-box">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Palette size={15} color="var(--crm-accent)" /> Global Theme Mode
                          </div>
                          <div style={{ fontSize: 11.5, color: '#98989D', marginTop: 2 }}>
                            Instant switch between Apple Light and Luxury Dark aesthetic.
                          </div>
                        </div>
                        <span className="crm-status-pill saved" style={{ fontSize: 10, padding: '2px 8px' }}>
                          {isDarkColor(siteConfig.backgroundColor) ? '🌙 Dark Active' : '☀️ Light Active'}
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, width: '100%' }}>
                        <button
                          type="button"
                          onClick={() => {
                            handleApplyPreset({
                              id: 'titanium-light',
                              name: 'Titanium Apple Light',
                              primary: '#0071E3',
                              secondary: '#F2F2F7',
                              accent: '#0071E3',
                              bg: '#F5F5F7',
                              card: '#FFFFFF'
                            });
                          }}
                          className={`crm-ios-mode-btn ${!isDarkColor(siteConfig.backgroundColor) ? 'active' : ''}`}
                        >
                          <Sun size={14} color={!isDarkColor(siteConfig.backgroundColor) ? 'var(--crm-accent)' : '#8E8E93'} />
                          <span>Apple Light</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            handleApplyPreset({
                              id: 'codex-gold',
                              name: 'Codex Gold (Dark)',
                              primary: 'var(--crm-accent)',
                              secondary: '#1E2329',
                              accent: 'var(--crm-accent)',
                              bg: '#0F1216',
                              card: '#181A20'
                            });
                          }}
                          className={`crm-ios-mode-btn ${isDarkColor(siteConfig.backgroundColor) ? 'active' : ''}`}
                        >
                          <Moon size={14} color={isDarkColor(siteConfig.backgroundColor) ? 'var(--crm-accent)' : '#8E8E93'} />
                          <span>Luxury Dark</span>
                        </button>
                      </div>
                    </div>

                    {/* Typography & Radii */}
                    <div className="crm-ios-inset-box">
                      <div className="crm-form-responsive-grid">
                        <div className="crm-settings-field" style={{ minWidth: 0 }}>
                          <label>Display & Body Typography</label>
                          <select
                            className="crm-settings-select"
                            value={siteConfig.fontFamily}
                            onChange={e => updateField('fontFamily', e.target.value)}
                          >
                            {FONT_OPTIONS.map(opt => (
                              <option key={opt.id} value={opt.id}>{opt.name} — ({opt.sample})</option>
                            ))}
                          </select>
                        </div>

                        <div className="crm-settings-field" style={{ minWidth: 0 }}>
                          <label>Surface Border Radius Style</label>
                          <select
                            className="crm-settings-select"
                            value={siteConfig.borderRadius}
                            onChange={e => updateField('borderRadius', e.target.value)}
                          >
                            {RADIUS_OPTIONS.map(opt => (
                              <option key={opt.id} value={opt.id}>{opt.label} — {opt.desc}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Theme & Layout Architecture */}
              <div className="crm-ios-card" id="studio-card-themes">
                <div
                  className={`crm-ios-card-head ${!expandedSections.themes ? 'collapsed' : ''}`}
                  onClick={() => toggleSectionCollapse('themes')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && toggleSectionCollapse('themes')}
                  title="Click to toggle section collapse"
                >
                  <div className="crm-ios-head-left">
                    <div className="crm-ios-icon-badge amber">
                      <Sparkles size={20} />
                    </div>
                    <div className="crm-ios-title-wrap">
                      <h4>Theme & Layout Architecture</h4>
                      <p>Meticulously designed agency layouts with full visual hierarchy, hero structures, and typography.</p>
                    </div>
                  </div>
                  <div className="crm-ios-card-head-right">
                    <div className="crm-status-pill saved" style={{ fontSize: 11, padding: '4px 10px' }}>
                      {filteredThemes.length} Layouts
                    </div>
                    <div className="crm-ios-card-collapse-btn">
                      {expandedSections.themes ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </div>
                  </div>
                </div>

                {expandedSections.themes && (
                  <div className="crm-ios-card-body">
                    {/* Filter Toolbar */}
                    <div className="crm-studio-filter-toolbar">
                      <div className="crm-studio-filter-row">
                        <div className="crm-studio-segmented-tabs">
                          <button
                            type="button"
                            className={`crm-studio-tab-btn ${themeModeFilter === 'all' ? 'active' : ''}`}
                            onClick={() => setThemeModeFilter('all')}
                          >
                            All ({THEME_LAYOUT_PRESETS.length})
                          </button>
                          <button
                            type="button"
                            className={`crm-studio-tab-btn ${themeModeFilter === 'dark' ? 'active' : ''}`}
                            onClick={() => setThemeModeFilter('dark')}
                          >
                            <Moon size={11} /> Dark ({THEME_LAYOUT_PRESETS.filter(t => !t.isLight).length})
                          </button>
                          <button
                            type="button"
                            className={`crm-studio-tab-btn ${themeModeFilter === 'light' ? 'active' : ''}`}
                            onClick={() => setThemeModeFilter('light')}
                          >
                            <Sun size={11} /> Light ({THEME_LAYOUT_PRESETS.filter(t => t.isLight).length})
                          </button>
                        </div>

                        <div className="crm-studio-search-wrapper" style={{ minWidth: 200, position: 'relative', display: 'flex', alignItems: 'center' }}>
                          <Search size={13} color="var(--crm-text-secondary)" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', zIndex: 3 }} />
                          <input
                            type="text"
                            className="crm-studio-search-input"
                            placeholder="Search themes, styles, fonts..."
                            value={themeSearchQuery}
                            onChange={(e) => setThemeSearchQuery(e.target.value)}
                            style={{ paddingLeft: '34px', minHeight: '34px', height: '34px', fontSize: '12px' }}
                          />
                          {themeSearchQuery && (
                            <button
                              type="button"
                              onClick={() => setThemeSearchQuery('')}
                              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--crm-text-secondary)', cursor: 'pointer', zIndex: 3 }}
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Spacious Apple Category Filter Pills */}
                      <div className="crm-apple-filter-pills-row">
                        {[
                          { id: 'all', label: 'All Categories', icon: LayoutGrid, count: THEME_LAYOUT_PRESETS.length },
                          { id: 'luxury', label: 'Luxury & Atelier', icon: Crown, count: THEME_LAYOUT_PRESETS.filter(t => t.category === 'luxury').length },
                          { id: 'enterprise', label: 'SaaS & Enterprise', icon: Building2, count: THEME_LAYOUT_PRESETS.filter(t => t.category === 'enterprise').length },
                          { id: 'creative', label: 'Creative Studio', icon: Sparkles, count: THEME_LAYOUT_PRESETS.filter(t => t.category === 'creative').length },
                          { id: 'performance', label: 'Performance', icon: Zap, count: THEME_LAYOUT_PRESETS.filter(t => t.category === 'performance').length },
                          { id: 'architectural', label: 'Architectural', icon: Compass, count: THEME_LAYOUT_PRESETS.filter(t => t.category === 'architectural').length },
                          { id: 'cyber', label: 'Cyber & Terminal', icon: Terminal, count: THEME_LAYOUT_PRESETS.filter(t => t.category === 'cyber').length },
                          { id: 'minimal', label: 'Minimalist', icon: Sliders, count: THEME_LAYOUT_PRESETS.filter(t => t.category === 'minimal').length }
                        ].map(cat => {
                          const Icon = cat.icon;
                          const isActive = themeCategoryFilter === cat.id;
                          return (
                            <button
                              key={cat.id}
                              type="button"
                              className={`crm-apple-filter-pill ${isActive ? 'active' : ''}`}
                              onClick={() => setThemeCategoryFilter(cat.id)}
                            >
                              <Icon size={13} />
                              <span>{cat.label}</span>
                              <span style={{
                                fontSize: 10,
                                padding: '1px 6px',
                                borderRadius: 10,
                                background: isActive ? 'rgba(0, 0, 0, 0.25)' : 'rgba(255, 255, 255, 0.08)',
                                color: isActive ? '#121418' : '#8E8E93',
                                fontWeight: 600,
                                marginLeft: 2
                              }}>
                                {cat.count}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Single-Column Spacious Theme Cards */}
                    <div className="crm-scrollable-studio-container" style={{ maxHeight: 440 }}>
                      <div className="crm-theme-single-column">
                        {filteredThemes.map((preset) => {
                          const isSelected =
                            siteConfig.activeTheme === preset.id ||
                            (siteConfig.heroLayout === preset.heroLayout &&
                             siteConfig.fontFamily === preset.fontFamily &&
                             siteConfig.borderRadius === preset.borderRadius &&
                             siteConfig.primaryColor === preset.primary &&
                             siteConfig.backgroundColor === preset.bg);

                          return (
                            <div
                              key={preset.id}
                              className={`crm-apple-theme-card ${isSelected ? 'active' : ''}`}
                              onClick={() => handleApplyTemplatePreset(preset)}
                            >
                              <div className="crm-apple-theme-card-top">
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0, flex: 1 }}>
                                  <span className="crm-apple-theme-title">
                                    {preset.name}
                                  </span>
                                  <span className="crm-template-layout-pill">
                                    {preset.heroLayout} hero
                                  </span>
                                  <span className="crm-apple-theme-badge">
                                    {preset.badge}
                                  </span>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                  <span style={{ fontSize: 11, color: '#8E8E93', fontWeight: 500 }}>
                                    {preset.isLight ? '☀️ Light' : '🌙 Dark'}
                                  </span>
                                  {isSelected ? (
                                    <span className="crm-status-pill saved" style={{ fontSize: 10.5, padding: '3px 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                      <Check size={11} /> Active
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      className="crm-apple-apply-stage-btn"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleApplyTemplatePreset(preset);
                                      }}
                                      style={{ padding: '3px 10px', fontSize: 11 }}
                                    >
                                      Apply
                                    </button>
                                  )}
                                </div>
                              </div>

                              <p className="crm-apple-theme-desc">
                                {preset.desc}
                              </p>

                              <div className="crm-apple-theme-specs-row">
                                <div className="crm-apple-theme-tags-group">
                                  <span className="crm-apple-spec-pill">Nav: {preset.headerStyle}</span>
                                  <span className="crm-apple-spec-pill">Font: {preset.fontFamily}</span>
                                  <span className="crm-apple-spec-pill">Radius: {preset.borderRadius}</span>
                                  {(preset.layoutTags || []).slice(0, 2).map(tag => (
                                    <span key={tag} className="crm-apple-spec-pill" style={{ opacity: 0.8 }}>{tag}</span>
                                  ))}
                                </div>

                                {/* 5-Color Swatch Strip */}
                                <div className="crm-apple-palette-dots-large" title="Theme Color Harmony">
                                  <span className="crm-apple-palette-dot-lg" style={{ background: preset.primary }} title={`Primary: ${preset.primary}`} />
                                  <span className="crm-apple-palette-dot-lg" style={{ background: preset.bg }} title={`Background: ${preset.bg}`} />
                                  <span className="crm-apple-palette-dot-lg" style={{ background: preset.card }} title={`Card Surface: ${preset.card}`} />
                                  <span className="crm-apple-palette-dot-lg" style={{ background: preset.accent }} title={`Accent: ${preset.accent}`} />
                                  <span className="crm-apple-palette-dot-lg" style={{ background: preset.secondary }} title={`Secondary: ${preset.secondary}`} />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Professional Color Palette Studio & Coolors Generator */}
              <div className="crm-ios-card" id="studio-card-palettes">
                <div
                  className={`crm-ios-card-head ${!expandedSections.palettes ? 'collapsed' : ''}`}
                  onClick={() => toggleSectionCollapse('palettes')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && toggleSectionCollapse('palettes')}
                  title="Click to toggle section collapse"
                >
                  <div className="crm-ios-head-left">
                    <div className="crm-ios-icon-badge purple">
                      <Palette size={20} />
                    </div>
                    <div className="crm-ios-title-wrap">
                      <h4>Brand Palette Studio & Coolors Generator</h4>
                      <p>Interactive 5-color generator engine and curated professional color harmonies.</p>
                    </div>
                  </div>
                  <div className="crm-ios-card-head-right">
                    <div className="crm-status-pill saved" style={{ fontSize: 11, padding: '4px 10px' }}>
                      {filteredPalettes.length} Palettes
                    </div>
                    <div className="crm-ios-card-collapse-btn">
                      {expandedSections.palettes ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </div>
                  </div>
                </div>

                {expandedSections.palettes && (
                  <div className="crm-ios-card-body">
                    {/* 🎲 Interactive Coolors Generator Stage */}
                    <div className="crm-coolors-interactive-stage">
                      <div className="crm-coolors-stage-head">
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: 7 }}>
                            <Dices size={16} color="var(--crm-accent)" />
                            Coolors Interactive Color Studio
                          </div>
                          <div style={{ fontSize: 11.5, color: 'var(--crm-text-secondary)', marginTop: 2 }}>
                            Click 'Generate Colors' to shuffle the harmony live, or tap any swatch to copy HEX.
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span
                            className={`crm-wcag-matrix-pill ${wcagTextMetrics.level === 'AAA' ? 'aaa' : wcagTextMetrics.level.startsWith('AA') ? 'aa' : 'fail'}`}
                            title={`WCAG 2.1 Contrast: Text (${isDarkColor(siteConfig.backgroundColor) ? 'var(--crm-text-primary)' : '#14171A'}) vs Background (${siteConfig.backgroundColor}) is ${wcagTextMetrics.ratio}:1`}
                          >
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
                            <span>WCAG {wcagTextMetrics.level} · {wcagTextMetrics.ratio}:1</span>
                          </span>

                          <span
                            className={`crm-wcag-matrix-pill ${wcagAccentMetrics.level === 'AAA' ? 'aaa' : wcagAccentMetrics.level.startsWith('AA') ? 'aa' : 'fail'}`}
                            title={`WCAG 2.1 Contrast: Primary Accent (${siteConfig.primaryColor}) vs Background (${siteConfig.backgroundColor}) is ${wcagAccentMetrics.ratio}:1`}
                          >
                            <span>Accent · {wcagAccentMetrics.ratio}:1</span>
                          </span>

                          <div className="crm-studio-segmented-tabs" style={{ padding: 2 }}>
                            <button
                              type="button"
                              className={`crm-studio-tab-btn ${coolorsStage.mode === 'dark' ? 'active' : ''}`}
                              onClick={() => setCoolorsStage(prev => ({ ...prev, mode: 'dark' }))}
                              style={{ padding: '3px 8px', fontSize: 10.5 }}
                            >
                              <Moon size={10} /> Dark
                            </button>
                            <button
                              type="button"
                              className={`crm-studio-tab-btn ${coolorsStage.mode === 'light' ? 'active' : ''}`}
                              onClick={() => setCoolorsStage(prev => ({ ...prev, mode: 'light' }))}
                              style={{ padding: '3px 8px', fontSize: 10.5 }}
                            >
                              <Sun size={10} /> Light
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* 5 Interactive Pillars - Pure Apple Minimalism without Lock Icons */}
                      <div className="crm-coolors-pillars-grid">
                        {coolorsStage.colors.map((c, idx) => {
                          const displayLabel = c.id === 'bg' ? 'CANVAS' : c.id === 'card' ? 'SURFACE' : c.id === 'secondary' ? 'MUTED' : c.label.toUpperCase();
                          return (
                            <div
                              key={c.id}
                              className="crm-coolors-pillar"
                              style={{ background: c.hex }}
                              onClick={() => handleCopyPillarHex(c.hex, idx)}
                              title={`Click to copy ${c.hex} (${c.label})`}
                            >
                              <div className="crm-coolors-pillar-label">{displayLabel}</div>
                              <div className="crm-coolors-pillar-hex">
                                {copiedPillarIdx === idx ? 'COPIED!' : c.hex}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Generator Controls */}
                      <div className="crm-coolors-stage-controls">
                        <div className="crm-coolors-stage-actions">
                          <button
                            type="button"
                            className="crm-apple-gen-btn"
                            onClick={handleCoolorsStageGenerate}
                          >
                            <Dices size={15} />
                            <span>Generate Colors</span>
                          </button>

                          <button
                            type="button"
                            className="crm-apple-apply-stage-btn"
                            onClick={handleApplyCoolorsStage}
                          >
                            <Sparkles size={13} color="var(--crm-accent)" />
                            <span>Apply to Website</span>
                          </button>
                        </div>

                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#98989D', cursor: 'pointer', userSelect: 'none' }}>
                          <input
                            type="checkbox"
                            checked={coolorsAutoApply}
                            onChange={(e) => setCoolorsAutoApply(e.target.checked)}
                            style={{ accentColor: 'var(--crm-accent)' }}
                          />
                          Auto-apply on generate
                        </label>
                      </div>
                    </div>

                    {/* Filter Toolbar for Curated Palettes */}
                    <div className="crm-studio-filter-toolbar">
                      <div className="crm-studio-filter-row">
                        <div className="crm-studio-segmented-tabs" style={{ flexWrap: 'wrap' }}>
                          {[
                            { id: 'all', label: 'All', icon: null },
                            { id: 'dark', label: 'Dark', icon: Moon },
                            { id: 'light', label: 'Light', icon: Sun },
                            { id: 'cyber', label: 'Cyber', icon: Sparkles },
                            { id: 'luxury', label: 'Luxury', icon: null },
                            { id: 'ocean', label: 'Ocean', icon: null },
                            { id: 'nature', label: 'Mint', icon: null },
                            { id: 'warm', label: 'Sunset', icon: null }
                          ].map(tab => {
                            const Icon = tab.icon;
                            return (
                              <button
                                key={tab.id}
                                type="button"
                                className={`crm-studio-tab-btn ${paletteModeFilter === tab.id ? 'active' : ''}`}
                                onClick={() => setPaletteModeFilter(tab.id)}
                                style={{ padding: '4px 9px', fontSize: 11 }}
                              >
                                {Icon && <Icon size={10} />}
                                {tab.label}
                              </button>
                            );
                          })}
                        </div>

                        <div className="crm-studio-search-wrapper" style={{ minWidth: 200, position: 'relative', display: 'flex', alignItems: 'center' }}>
                          <Search size={13} color="var(--crm-text-secondary)" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', zIndex: 3 }} />
                          <input
                            type="text"
                            className="crm-studio-search-input"
                            placeholder="Search colors or hex..."
                            value={paletteSearchQuery}
                            onChange={(e) => setPaletteSearchQuery(e.target.value)}
                            style={{ paddingLeft: '34px', minHeight: '34px', height: '34px', fontSize: '12px' }}
                          />
                          {paletteSearchQuery && (
                            <button
                              type="button"
                              onClick={() => setPaletteSearchQuery('')}
                              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--crm-text-secondary)', cursor: 'pointer', zIndex: 3 }}
                            >
                              <X size={11} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Scrollable Palette List */}
                    <div className="crm-scrollable-studio-container" style={{ maxHeight: 360 }}>
                      <div className="crm-coolors-palette-list">
                        {filteredPalettes.map((pal) => {
                          const isSelected =
                            siteConfig.primaryColor === pal.primary &&
                            siteConfig.backgroundColor === pal.bg &&
                            siteConfig.cardBg === pal.card;

                          return (
                            <div
                              key={pal.id}
                              className={`crm-coolors-palette-card ${isSelected ? 'active' : ''}`}
                              onClick={() => handleApplyPalette(pal)}
                            >
                              <div className="crm-coolors-card-meta">
                                <div className="crm-coolors-card-title">
                                  <span>{pal.name}</span>
                                  {isSelected && <CheckCircle2 size={12} color="var(--crm-accent)" />}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span className={`crm-coolors-card-badge ${pal.isLight ? 'light' : 'dark'}`}>
                                    {pal.contrastLevel} · {pal.isLight ? 'LIGHT' : 'DARK'}
                                  </span>
                                </div>
                              </div>

                              {/* 5-Color Horizontal Swatch Strip */}
                              <div className="crm-coolors-swatch-strip">
                                <div className="crm-coolors-swatch-bar" style={{ background: pal.primary }} title={`Primary: ${pal.primary}`}>
                                  {pal.primary}
                                </div>
                                <div className="crm-coolors-swatch-bar" style={{ background: pal.bg }} title={`Background: ${pal.bg}`}>
                                  {pal.bg}
                                </div>
                                <div className="crm-coolors-swatch-bar" style={{ background: pal.card }} title={`Card Surface: ${pal.card}`}>
                                  {pal.card}
                                </div>
                                <div className="crm-coolors-swatch-bar" style={{ background: pal.accent }} title={`Accent: ${pal.accent}`}>
                                  {pal.accent}
                                </div>
                                <div className="crm-coolors-swatch-bar" style={{ background: pal.secondary }} title={`Secondary: ${pal.secondary}`}>
                                  {pal.secondary}
                                </div>
                              </div>

                              <div className="crm-coolors-actions-row">
                                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                  {(pal.tags || []).slice(0, 2).map(tag => (
                                    <span key={tag} className="crm-template-tag-chip" style={{ fontSize: 9 }}>
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <button
                                    type="button"
                                    className="crm-coolors-apply-btn"
                                    onClick={(e) => handleCopyPaletteHexes(pal, e)}
                                    title="Copy all 5 hex values"
                                  >
                                    {copiedPaletteId === pal.id ? <Check size={10} color="#0ECB81" /> : <Copy size={10} />}
                                    <span>{copiedPaletteId === pal.id ? 'Copied' : 'Copy'}</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="crm-coolors-apply-btn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleApplyPalette(pal);
                                    }}
                                  >
                                    {isSelected ? <Check size={10} /> : <CheckCircle2 size={10} />}
                                    <span>{isSelected ? 'Active' : 'Apply'}</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Integrated Granular Live Color Customizer */}
                    <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: 12, marginTop: 4 }}>
                      <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--crm-text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Granular Hex Fine-Tuning
                      </div>
                      <div className="crm-color-swatch-bar">
                        <div className="crm-color-swatch-item">
                          <label>Brand Primary</label>
                          <div className="crm-color-picker-input-wrapper">
                            <input
                              type="color"
                              value={siteConfig.primaryColor}
                              onChange={(e) => updateField('primaryColor', e.target.value)}
                            />
                            <span className="crm-color-picker-hex">{siteConfig.primaryColor}</span>
                          </div>
                        </div>

                        <div className="crm-color-swatch-item">
                          <label>Canvas BG</label>
                          <div className="crm-color-picker-input-wrapper">
                            <input
                              type="color"
                              value={siteConfig.backgroundColor}
                              onChange={(e) => updateField('backgroundColor', e.target.value)}
                            />
                            <span className="crm-color-picker-hex">{siteConfig.backgroundColor}</span>
                          </div>
                        </div>

                        <div className="crm-color-swatch-item">
                          <label>Card Surface</label>
                          <div className="crm-color-picker-input-wrapper">
                            <input
                              type="color"
                              value={siteConfig.cardBg}
                              onChange={(e) => updateField('cardBg', e.target.value)}
                            />
                            <span className="crm-color-picker-hex">{siteConfig.cardBg}</span>
                          </div>
                        </div>

                        <div className="crm-color-swatch-item">
                          <label>Accent Tone</label>
                          <div className="crm-color-picker-input-wrapper">
                            <input
                              type="color"
                              value={siteConfig.accentColor}
                              onChange={(e) => updateField('accentColor', e.target.value)}
                            />
                            <span className="crm-color-picker-hex">{siteConfig.accentColor}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 4. Hero Structure & Header Navigation */}
              <div className="crm-ios-card" id="studio-card-hero">
                <div
                  className={`crm-ios-card-head ${!expandedSections.hero ? 'collapsed' : ''}`}
                  onClick={() => toggleSectionCollapse('hero')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && toggleSectionCollapse('hero')}
                  title="Click to toggle section collapse"
                >
                  <div className="crm-ios-head-left">
                    <div className="crm-ios-icon-badge teal">
                      <Layers size={20} />
                    </div>
                    <div className="crm-ios-title-wrap">
                      <h4>Hero Structure & Header Navigation</h4>
                      <p>Opening block visual layout and persistent navigation bar behavior.</p>
                    </div>
                  </div>
                  <div className="crm-ios-card-head-right">
                    <span className="crm-status-pill saved" style={{ fontSize: 10, padding: '3px 8px' }}>
                      {(siteConfig.heroLayout || 'streamer').toUpperCase()} · {siteConfig.headerStyle || 'floating'}
                    </span>
                    <div className="crm-ios-card-collapse-btn">
                      {expandedSections.hero ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </div>
                  </div>
                </div>

                {expandedSections.hero && (
                  <div className="crm-ios-card-body">
                    <div className="crm-ios-inset-box">
                      <div style={{ fontSize: 11.5, fontWeight: 600, color: '#C4C9D3', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Hero Opening Block Structure
                      </div>
                      <div className="crm-ios-tiles-grid">
                        {HERO_LAYOUT_OPTIONS.map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            className={`crm-ios-tile-btn ${(siteConfig.heroLayout || 'streamer') === opt.id ? 'active' : ''}`}
                            onClick={() => updateField('heroLayout', opt.id)}
                          >
                            <div className="crm-ios-tile-header">
                              <span className="crm-ios-tile-title">{opt.label}</span>
                              {(siteConfig.heroLayout || 'streamer') === opt.id && <CheckCircle2 size={13} color="var(--crm-accent)" />}
                            </div>
                            <span className="crm-ios-tile-desc">{opt.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="crm-ios-inset-box">
                      <div style={{ fontSize: 11.5, fontWeight: 600, color: '#C4C9D3', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Header Navigation Style
                      </div>
                      <div className="crm-ios-stack-options">
                        {HEADER_OPTIONS.map((opt) => {
                          const isSelected = (siteConfig.headerStyle || 'floating') === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              className={`crm-ios-stack-row ${isSelected ? 'active' : ''}`}
                              onClick={() => updateField('headerStyle', opt.id)}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                                <div className={`crm-ios-radio-circle ${isSelected ? 'checked' : ''}`}>
                                  {isSelected && <div className="crm-ios-radio-dot" />}
                                </div>
                                <div style={{ minWidth: 0 }}>
                                  <div className="crm-ios-tile-title">{opt.label}</div>
                                  <div className="crm-ios-tile-desc">{opt.desc}</div>
                                </div>
                              </div>
                              {isSelected && (
                                <span className="crm-status-pill saved" style={{ fontSize: 10, padding: '2px 7px', flexShrink: 0 }}>Active</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 5. Homepage Section Sequence & Visibility */}
              <div className="crm-ios-card" id="studio-card-sequence">
                <div
                  className={`crm-ios-card-head ${!expandedSections.sequence ? 'collapsed' : ''}`}
                  onClick={() => toggleSectionCollapse('sequence')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && toggleSectionCollapse('sequence')}
                  title="Click to toggle section collapse"
                >
                  <div className="crm-ios-head-left">
                    <div className="crm-ios-icon-badge orange">
                      <Compass size={20} />
                    </div>
                    <div className="crm-ios-title-wrap">
                      <h4>Homepage Section Sequence</h4>
                      <p>Reorder layout sequence, toggle visibility, and inspect live in preview.</p>
                    </div>
                  </div>
                  <div className="crm-ios-card-head-right">
                    <button
                      type="button"
                      className="crm-apple-apply-stage-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleResetSectionOrder();
                      }}
                      title="Reset to default sequence"
                      style={{ padding: '4px 10px', fontSize: 11 }}
                    >
                      <RotateCcw size={11} />
                      <span>Reset</span>
                    </button>
                    <div className="crm-ios-card-collapse-btn">
                      {expandedSections.sequence ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </div>
                  </div>
                </div>

                {expandedSections.sequence && (
                  <div className="crm-ios-card-body">
                    <div className="crm-ios-reorder-container">
                      {siteConfig.sectionsOrder.map((secId, idx) => {
                        const meta = DEFAULT_SECTIONS.find((s) => s.id === secId) || { name: secId, desc: '', category: 'Section' };
                        const isVisible = siteConfig.sectionsVisibility[secId] !== false;
                        const isHighlighted = highlightedSection === secId;

                        return (
                          <div
                            key={secId}
                            className={`crm-ios-reorder-row ${isHighlighted ? 'highlighted' : ''}`}
                            style={{ opacity: isVisible ? 1 : 0.55 }}
                          >
                            <div className="crm-ios-reorder-left">
                              <div className="crm-ios-order-arrows">
                                <button
                                  type="button"
                                  className="crm-ios-arrow-btn"
                                  disabled={idx === 0}
                                  onClick={() => moveSection(idx, -1)}
                                  title="Move section up"
                                >
                                  <ArrowUp size={11} />
                                </button>
                                <button
                                  type="button"
                                  className="crm-ios-arrow-btn"
                                  disabled={idx === siteConfig.sectionsOrder.length - 1}
                                  onClick={() => moveSection(idx, 1)}
                                  title="Move section down"
                                >
                                  <ArrowDown size={11} />
                                </button>
                              </div>
                              <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: '#8E8E93', width: 22, flexShrink: 0 }}>
                                0{idx + 1}
                              </span>
                              <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                                  <span className="crm-ios-sec-name" style={{ textDecoration: isVisible ? 'none' : 'line-through' }}>
                                    {meta.name}
                                  </span>
                                  <span className="crm-ios-sec-cat">{meta.category}</span>
                                </div>
                                <div className="crm-ios-sec-desc">
                                  {meta.desc}
                                </div>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                              {isVisible && (
                                <button
                                  type="button"
                                  className="crm-apple-apply-stage-btn"
                                  onClick={() => handleJumpToSection(secId)}
                                  title="Scroll preview to this section"
                                  style={{ padding: '4px 8px', fontSize: 11 }}
                                >
                                  <Eye size={11} />
                                  <span>Inspect</span>
                                </button>
                              )}
                              <button
                                type="button"
                                className={`crm-ios-arrow-btn ${isVisible ? '' : 'danger'}`}
                                onClick={() => toggleSectionVisibility(secId)}
                                title={isVisible ? 'Hide section' : 'Show section'}
                                style={{ width: 28, height: 28, borderRadius: 6 }}
                              >
                                {isVisible ? <Eye size={13} /> : <EyeOff size={13} color="#F6465D" />}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* 6. Floating Conversion Modules */}
              <div className="crm-ios-card" id="studio-card-conversion">
                <div
                  className={`crm-ios-card-head ${!expandedSections.conversion ? 'collapsed' : ''}`}
                  onClick={() => toggleSectionCollapse('conversion')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && toggleSectionCollapse('conversion')}
                  title="Click to toggle section collapse"
                >
                  <div className="crm-ios-head-left">
                    <div className="crm-ios-icon-badge green">
                      <MessageCircle size={20} />
                    </div>
                    <div className="crm-ios-title-wrap">
                      <h4>Floating Conversion Modules</h4>
                      <p>Persistent floating visitor engagement buttons on the live site.</p>
                    </div>
                  </div>
                  <div className="crm-ios-card-head-right">
                    <span className={`crm-status-pill ${siteConfig.whatsappDock?.enabled ? 'saved' : 'unsaved'}`} style={{ fontSize: 10.5, padding: '3px 8px' }}>
                      {siteConfig.whatsappDock?.enabled ? 'WhatsApp Active' : 'Disabled'}
                    </span>
                    <div className="crm-ios-card-collapse-btn">
                      {expandedSections.conversion ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </div>
                  </div>
                </div>

                {expandedSections.conversion && (
                  <div className="crm-ios-card-body">
                    <div className="crm-ios-inset-box">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: 7 }}>
                            <WhatsAppLogo width={18} height={18} />
                            Floating WhatsApp Quick-Contact Dock
                          </div>
                          <div style={{ fontSize: 11.5, color: '#98989D', marginTop: 2 }}>
                            Persistent bottom-corner button with instant pre-filled chat greeting.
                          </div>
                        </div>
                        <label className="crm-toggle-switch" title="Toggle WhatsApp dock">
                          <input
                            type="checkbox"
                            checked={siteConfig.whatsappDock?.enabled}
                            onChange={() => updateNestedField('whatsappDock', 'enabled', !siteConfig.whatsappDock?.enabled)}
                          />
                          <span className="crm-toggle-slider" />
                        </label>
                      </div>

                      {siteConfig.whatsappDock?.enabled && (
                        <div className="crm-form-responsive-grid" style={{ paddingTop: 12, marginTop: 4, borderTop: '1px solid rgba(255, 255, 255, 0.07)' }}>
                          <div className="crm-settings-field">
                            <label>WhatsApp Number (International format)</label>
                            <input
                              type="text"
                              className="crm-settings-input"
                              value={siteConfig.whatsappDock?.number || ''}
                              onChange={(e) => updateNestedField('whatsappDock', 'number', e.target.value)}
                              placeholder="+380636406783"
                            />
                          </div>
                          <div className="crm-settings-field">
                            <label>Prefilled Greeting Message</label>
                            <input
                              type="text"
                              className="crm-settings-input"
                              value={siteConfig.whatsappDock?.defaultMessage || ''}
                              onChange={(e) => updateNestedField('whatsappDock', 'defaultMessage', e.target.value)}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            )}

            {/* ── Right Column: Live Interactive Site Preview ── */}
            {studioLayoutMode !== 'editor' && (
              <div className="crm-layout-preview-col">
              <div className="crm-preview-studio-card">
                {/* 1. Browser Chrome Bar */}
                <div className="crm-preview-chrome-bar">
                  <div className="crm-preview-url-box">
                    <span className="crm-preview-ssl-badge">
                      <span className="crm-preview-ssl-dot" />
                      <span className="crm-preview-https">https://</span>
                    </span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      codexdynamics.com/{previewPage !== 'home' ? previewPage : ''}
                    </span>
                  </div>

                  {/* Device Switcher */}
                  <div className="crm-preview-controls-group">
                    <div className="crm-preview-segmented">
                      <button
                        type="button"
                        className={`crm-preview-segmented-btn ${viewportMode === 'desktop' ? 'active' : ''}`}
                        onClick={() => setViewportMode('desktop')}
                        title="Desktop view (100% wide)"
                      >
                        <Monitor size={12} />
                        <span>Desktop</span>
                      </button>
                      <button
                        type="button"
                        className={`crm-preview-segmented-btn ${viewportMode === 'tablet' ? 'active' : ''}`}
                        onClick={() => setViewportMode('tablet')}
                        title="Tablet view (768px iPad)"
                      >
                        <Tablet size={12} />
                        <span>Tablet</span>
                      </button>
                      <button
                        type="button"
                        className={`crm-preview-segmented-btn ${viewportMode === 'mobile' ? 'active' : ''}`}
                        onClick={() => setViewportMode('mobile')}
                        title="Mobile view (390px iPhone)"
                      >
                        <Smartphone size={12} />
                        <span>Mobile</span>
                      </button>
                    </div>

                    {/* Zoom Switcher */}
                    <div className="crm-preview-segmented">
                      {[100, 85, 75, 60].map((z) => (
                        <button
                          key={z}
                          type="button"
                          className={`crm-preview-segmented-btn ${zoomLevel === z ? 'active' : ''}`}
                          style={{ padding: '3px 6px', fontSize: 10 }}
                          onClick={() => setZoomLevel(z)}
                          title={`Scale zoom to ${z}%`}
                        >
                          {z}%
                        </button>
                      ))}
                    </div>

                    {/* Action buttons */}
                    <button
                      type="button"
                      className="crm-preview-action-icon-btn"
                      onClick={() => {
                        setPreviewLoaded(false);
                        setPreviewKey((k) => k + 1);
                      }}
                      title="Reload preview iframe"
                    >
                      <RefreshCw size={12} />
                    </button>
                    <button
                      type="button"
                      className="crm-preview-action-icon-btn"
                      onClick={() => setIsFullscreenPreview(true)}
                      title="Expand to Fullscreen Preview Studio"
                    >
                      <Maximize2 size={12} />
                    </button>
                  </div>
                </div>

                {/* 2. Secondary Subnav Bar: Page Switcher & Section Jumper */}
                <div className="crm-preview-subnav-bar">
                  <div className="crm-preview-page-tabs">
                    {[
                      { id: 'home', label: 'Homepage' },
                      { id: 'services', label: 'Services' },
                      { id: 'work', label: 'Case Studies' },
                      { id: 'studio', label: 'Kyiv Studio' },
                      { id: 'blog', label: 'Insights' },
                      { id: 'contact', label: 'Contact' },
                    ].map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className={`crm-preview-page-tab ${previewPage === p.id ? 'active' : ''}`}
                        onClick={() => setPreviewPage(p.id)}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <select
                      className="crm-preview-jump-select"
                      onChange={(e) => {
                        if (e.target.value) handleJumpToSection(e.target.value);
                      }}
                      defaultValue=""
                    >
                      <option value="" disabled>Jump to section...</option>
                      {siteConfig.sectionsOrder.map((secId) => {
                        const meta = DEFAULT_SECTIONS.find((s) => s.id === secId);
                        const isVisible = siteConfig.sectionsVisibility[secId] !== false;
                        if (!isVisible) return null;
                        return (
                          <option key={secId} value={secId}>
                            {meta?.name || secId}
                          </option>
                        );
                      })}
                    </select>

                    <div
                      className="crm-live-preview-pill"
                      style={{
                        padding: '3px 9px',
                        fontSize: 10.5,
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        flexShrink: 0,
                        whiteSpace: 'nowrap',
                        maxWidth: 'none',
                        width: 'auto',
                        overflow: 'visible',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                    >
                      <span className="crm-status-pulse" style={{ flexShrink: 0 }} />
                      <span style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>LIVE PREVIEW</span>
                    </div>
                  </div>
                </div>

                {/* 3. Viewport Stage & Device Frame */}
                <div className="crm-preview-stage">
                  {!previewLoaded && (
                    <div className="crm-preview-loading" role="status" aria-live="polite">
                      <span className="crm-preview-loading-spinner" aria-hidden="true" />
                      <span>Loading website preview…</span>
                    </div>
                  )}
                  <div
                    className={`crm-device-shell ${viewportMode}`}
                    style={{
                      transform: zoomLevel !== 100 ? `scale(${zoomLevel / 100})` : undefined,
                      transformOrigin: 'top center',
                      marginBottom: zoomLevel < 100 ? `-${(100 - zoomLevel) * 6}px` : undefined,
                    }}
                  >
                    {viewportMode === 'mobile' && <div className="crm-device-notch" />}
                    <iframe
                      key={previewKey}
                      ref={previewIframeRef}
                      src={`/?preview=1${previewPage !== 'home' ? `&page=${previewPage}` : ''}`}
                      className="crm-preview-iframe"
                      onLoad={() => {
                        setPreviewLoaded(true);
                        syncToPreview(siteConfig);
                      }}
                      title="Codex Dynamics Real-Time Site Preview"
                    />
                  </div>
                </div>
              </div>
            </div>
            )}
          </div>
        </div>
      )}

      {/* ── 5. SEO & Search ────────────────────────────────────── */}
      {activeSubTab === 'seo' && (
        <div className="crm-settings-panel">
          <div className="crm-settings-section-head">
            <div>
              <h3><Search size={16} color="var(--crm-accent)" /> Search Engine Optimization & Social Sharing</h3>
              <p>Configure search snippet tags, metadata descriptions, and OpenGraph social card previews for web crawlers.</p>
            </div>
          </div>

          {/* Group 1: Search Indexing & Canonical Metadata */}
          <div className="crm-seo-group-card">
            <div className="crm-seo-group-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <Globe size={15} color="var(--crm-accent)" />
                <span className="crm-seo-group-title">Search Engine Snippet & Canonical Routing</span>
              </div>
              <span className="crm-status-pill saved" style={{ fontSize: 10.5, padding: '2px 8px' }}>
                SERP Optimized
              </span>
            </div>

            <div className="crm-form-grid-2">
              <div className="crm-settings-field">
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>Meta Title (Browser Tab & Search Result)</span>
                  <span className={`crm-char-counter-pill ${siteConfig.seo.metaTitle.length > 60 ? 'warning' : 'good'}`}>
                    {siteConfig.seo.metaTitle.length}/60 chars
                  </span>
                </label>
                <input
                  type="text"
                  className="crm-settings-input"
                  value={siteConfig.seo.metaTitle}
                  onChange={e => updateNestedField('seo', 'metaTitle', e.target.value)}
                  placeholder="Codex Dynamics | Enterprise Architecture & CRM Systems"
                />
              </div>

              <div className="crm-settings-field">
                <label>Canonical Production URL</label>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', position: 'relative' }}>
                  <input
                    type="text"
                    className="crm-settings-input"
                    value={siteConfig.seo.canonicalUrl}
                    onChange={e => updateNestedField('seo', 'canonicalUrl', e.target.value)}
                    placeholder="https://codexdynamics.com"
                    style={{ flex: 1, paddingRight: 36 }}
                  />
                  <button
                    type="button"
                    className={`crm-settings-copy-btn ${copiedKey === 'canonical' ? 'copied' : ''}`}
                    onClick={() => handleCopyValue(siteConfig.seo.canonicalUrl, 'canonical', 'Canonical URL')}
                    title={copiedKey === 'canonical' ? 'Copied!' : 'Copy Canonical URL'}
                    aria-label="Copy Canonical URL"
                    style={{ position: 'absolute', right: 5 }}
                  >
                    {copiedKey === 'canonical' ? <Check size={12} strokeWidth={2.5} /> : <Copy size={12} />}
                  </button>
                </div>
              </div>
            </div>

            <div className="crm-settings-field" style={{ marginTop: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Meta Description (Crawler Summary & Social Snippet)</span>
                <span className={`crm-char-counter-pill ${siteConfig.seo.metaDescription.length > 160 ? 'warning' : 'good'}`}>
                  {siteConfig.seo.metaDescription.length}/160 chars
                </span>
              </label>
              <textarea
                className="crm-settings-textarea"
                rows={3}
                value={siteConfig.seo.metaDescription}
                onChange={e => updateNestedField('seo', 'metaDescription', e.target.value)}
                placeholder="Brief summary of platform capabilities and strategic technology consulting services..."
              />
            </div>

            <div className="crm-form-grid-2" style={{ marginTop: 12 }}>
              <div className="crm-settings-field">
                <label>Meta Keywords (Comma-separated index terms)</label>
                <input
                  type="text"
                  className="crm-settings-input"
                  value={siteConfig.seo.keywords}
                  onChange={e => updateNestedField('seo', 'keywords', e.target.value)}
                  placeholder="CRM, Enterprise Software, Client Management, Fintech Architecture"
                />
              </div>

              <div className="crm-settings-field">
                <label>OpenGraph Social Share Image (OG Banner URL)</label>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', position: 'relative' }}>
                  <input
                    type="text"
                    className="crm-settings-input"
                    value={siteConfig.seo.ogImage}
                    onChange={e => updateNestedField('seo', 'ogImage', e.target.value)}
                    placeholder="/og.jpg or https://cdn.codexdynamics.com/og.jpg"
                    style={{ flex: 1, paddingRight: 36 }}
                  />
                  <button
                    type="button"
                    className={`crm-settings-copy-btn ${copiedKey === 'ogImage' ? 'copied' : ''}`}
                    onClick={() => handleCopyValue(siteConfig.seo.ogImage, 'ogImage', 'OG Image URL')}
                    title={copiedKey === 'ogImage' ? 'Copied!' : 'Copy OG Image URL'}
                    aria-label="Copy OG Image URL"
                    style={{ position: 'absolute', right: 5 }}
                  >
                    {copiedKey === 'ogImage' ? <Check size={12} strokeWidth={2.5} /> : <Copy size={12} />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Group 2: Dual Live Simulations (Google SERP & OpenGraph Social Card) */}
          <div className="crm-seo-simulations-grid">
            {/* Google Search Live Preview */}
            <div className="crm-seo-sim-card">
              <div className="crm-seo-sim-head">
                <span className="crm-seo-sim-badge google">
                  <span style={{ color: '#4285F4' }}>G</span>
                  <span style={{ color: '#EA4335' }}>o</span>
                  <span style={{ color: '#FBBC05' }}>o</span>
                  <span style={{ color: '#4285F4' }}>g</span>
                  <span style={{ color: '#34A853' }}>l</span>
                  <span style={{ color: '#EA4335' }}>e</span>
                  <span style={{ marginLeft: 4, color: 'var(--crm-text-secondary)' }}>Search Snippet</span>
                </span>
                <span style={{ fontSize: 11, color: 'var(--crm-text-secondary)' }}>Desktop & Mobile SERP</span>
              </div>
              <div className="crm-google-preview">
                <div className="crm-google-url">
                  <div className="crm-google-favicon">C</div>
                  <span className="crm-google-domain">{siteConfig.seo.canonicalUrl.replace(/^https?:\/\//, '') || 'codexdynamics.com'}</span>
                  <span className="crm-google-sep">›</span>
                  <span className="crm-google-breadcrumb">home</span>
                </div>
                <div className="crm-google-title">
                  {siteConfig.seo.metaTitle || 'Codex Dynamics | Enterprise Architecture & CRM Systems'}
                </div>
                <div className="crm-google-desc">
                  {siteConfig.seo.metaDescription || 'Premier technology engineering and algorithmic trading systems consultancy. Delivering high-throughput platform infrastructure and custom lead workflows.'}
                </div>
              </div>
            </div>

            {/* Social Share Card (OpenGraph / Twitter / iMessage) */}
            <div className="crm-seo-sim-card">
              <div className="crm-seo-sim-head">
                <span className="crm-seo-sim-badge social">
                  <Share2 size={12} color="#2979F0" />
                  <span>OpenGraph Social Card</span>
                </span>
                <span style={{ fontSize: 11, color: 'var(--crm-text-secondary)' }}>iMessage · X · LinkedIn</span>
              </div>
              <div className="crm-og-social-card-box">
                <div className="crm-og-social-banner" style={{ background: siteConfig.backgroundColor || '#181A20' }}>
                  <div className="crm-og-brand-pill">
                    <span className="crm-palette-dot" style={{ background: siteConfig.primaryColor || 'var(--crm-accent)' }} />
                    <span style={{ fontWeight: 700, color: '#FFFFFF', fontSize: 11 }}>CODEX DYNAMICS</span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--crm-text-secondary)', marginTop: 'auto' }}>1200 × 630 Web Sharing Card</span>
                </div>
                <div className="crm-og-social-body">
                  <span className="crm-og-social-domain">
                    {siteConfig.seo.canonicalUrl.replace(/^https?:\/\//, '') || 'codexdynamics.com'}
                  </span>
                  <div className="crm-og-social-title">
                    {siteConfig.seo.metaTitle || 'Codex Dynamics | Enterprise Architecture'}
                  </div>
                  <div className="crm-og-social-desc">
                    {siteConfig.seo.metaDescription || 'Premier technology engineering and algorithmic trading systems consultancy.'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 6. Security & System ───────────────────────────────── */}
      {activeSubTab === 'security' && (
        <div className="crm-settings-panel">
          <div className="crm-settings-section-head">
            <div>
              <h3><Shield size={16} color="#0ECB81" /> CRM Security Invariants & Integration Webhooks</h3>
              <p>Configure authentication controls, outbound lead webhooks, administrator credentials, and system snapshots.</p>
            </div>
          </div>

          {/* Section 1: Authentication Invariants */}
          <div className="crm-settings-group-block">
            <div className="crm-settings-group-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Shield size={16} color="#0ECB81" />
                <span className="crm-settings-group-title">Authentication & Staff Access Controls</span>
              </div>
              <span className="crm-status-pill saved" style={{ fontSize: 10.5, padding: '2px 8px' }}>
                Enforced Invariants
              </span>
            </div>

            <div className="crm-form-grid-2">
              <div className="crm-toggle-card">
                <div className="crm-toggle-card-info">
                  <div className="crm-toggle-card-title">
                    <span>Client Self-Registration</span>
                    <span className={`crm-status-pill ${siteConfig.security.registrationEnabled ? 'saved' : ''}`} style={{ fontSize: 10, padding: '1px 7px' }}>
                      {siteConfig.security.registrationEnabled ? 'Open' : 'Restricted'}
                    </span>
                  </div>
                  <div className="crm-toggle-card-desc">Permit prospective enterprise clients to register self-service portal accounts.</div>
                </div>
                <label className="crm-toggle-switch" title="Toggle Client Self-Registration">
                  <input
                    type="checkbox"
                    checked={siteConfig.security.registrationEnabled}
                    onChange={() => updateNestedField('security', 'registrationEnabled', !siteConfig.security.registrationEnabled)}
                  />
                  <span className="crm-toggle-slider" />
                </label>
              </div>

              <div className="crm-toggle-card">
                <div className="crm-toggle-card-info">
                  <div className="crm-toggle-card-title">
                    <span>Two-Factor Authentication (2FA)</span>
                    <span className="crm-status-pill saved" style={{ fontSize: 10, padding: '1px 7px' }}>
                      {siteConfig.security.twoFactorAuthEnabled ? 'Mandatory' : 'Optional'}
                    </span>
                  </div>
                  <div className="crm-toggle-card-desc">Enforce two-factor TOTP verification security on all backoffice staff logins.</div>
                </div>
                <label className="crm-toggle-switch" title="Toggle Two-Factor Authentication">
                  <input
                    type="checkbox"
                    checked={siteConfig.security.twoFactorAuthEnabled}
                    onChange={() => updateNestedField('security', 'twoFactorAuthEnabled', !siteConfig.security.twoFactorAuthEnabled)}
                  />
                  <span className="crm-toggle-slider" />
                </label>
              </div>
            </div>

            <div className="crm-form-grid-2" style={{ marginTop: 12 }}>
              <div className="crm-settings-field">
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>Session Idle Timeout (minutes)</span>
                  <span className="crm-char-counter-pill good">Auto Inactivity Logoff</span>
                </label>
                <input
                  type="number"
                  min={5}
                  max={1440}
                  className="crm-settings-input"
                  value={siteConfig.security.sessionTimeoutMinutes}
                  onChange={e => updateNestedField('security', 'sessionTimeoutMinutes', e.target.value)}
                />
              </div>

              <div className="crm-settings-field">
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>Max Failed Login Lockout Threshold</span>
                  <span className="crm-char-counter-pill good">Brute-Force Guard</span>
                </label>
                <input
                  type="number"
                  min={3}
                  max={20}
                  className="crm-settings-input"
                  value={siteConfig.security.maxFailedLoginAttempts}
                  onChange={e => updateNestedField('security', 'maxFailedLoginAttempts', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Outbound Lead Integration Webhook */}
          <div className="crm-settings-group-block">
            <div className="crm-settings-group-header">
              <div>
                <strong style={{ fontSize: 13, color: 'var(--crm-text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Send size={15} color="#2979F0" />
                  Lead Integration Webhook Endpoint
                </strong>
                <p style={{ margin: '2px 0 0 0', fontSize: 11.5, color: 'var(--crm-text-secondary)' }}>
                  Dispatches new inbound website consultation leads to Zapier, Make, or custom CRM APIs.
                </p>
              </div>
              <span className={`crm-status-pill ${siteConfig.security.webhookUrl ? 'saved' : ''}`} style={{ fontSize: 10.5, padding: '2px 8px' }}>
                {siteConfig.security.webhookUrl ? 'Active Relay' : 'Unconfigured'}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 260, display: 'flex', alignItems: 'center' }}>
                <input
                  type="url"
                  className="crm-settings-input"
                  style={{ width: '100%', paddingRight: siteConfig.security.webhookUrl ? 36 : 12 }}
                  placeholder="https://hooks.zapier.com/hooks/catch/..."
                  value={siteConfig.security.webhookUrl}
                  onChange={e => updateNestedField('security', 'webhookUrl', e.target.value)}
                />
                {siteConfig.security.webhookUrl && (
                  <button
                    type="button"
                    className={`crm-settings-copy-btn ${copiedKey === 'webhook' ? 'copied' : ''}`}
                    onClick={() => handleCopyValue(siteConfig.security.webhookUrl, 'webhook', 'Webhook URL')}
                    title={copiedKey === 'webhook' ? 'Copied!' : 'Copy Webhook URL'}
                    aria-label="Copy Webhook URL"
                    style={{ position: 'absolute', right: 5 }}
                  >
                    {copiedKey === 'webhook' ? <Check size={12} strokeWidth={2.5} /> : <Copy size={12} />}
                  </button>
                )}
              </div>
              <button
                type="button"
                className="crm-btn-secondary"
                disabled={testingWebhook}
                onClick={handleTestWebhook}
                style={{ padding: '8px 14px', fontSize: 12, borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <RefreshCw size={13} className={testingWebhook ? 'crm-spin' : ''} />
                <span>{testingWebhook ? 'Pinging Endpoint...' : 'Send Test Ping'}</span>
              </button>
            </div>

            {webhookTestStatus && (
              <div style={{
                marginTop: 10,
                fontSize: 12,
                color: webhookTestStatus.success ? '#0ECB81' : '#F6465D',
                background: webhookTestStatus.success ? 'rgba(14, 203, 129, 0.08)' : 'rgba(246, 70, 93, 0.08)',
                border: `1px solid ${webhookTestStatus.success ? 'rgba(14, 203, 129, 0.25)' : 'rgba(246, 70, 93, 0.25)'}`,
                borderRadius: 8,
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
                {webhookTestStatus.success ? <CheckCircle2 size={14} /> : <HelpCircle size={14} />}
                <span>{webhookTestStatus.message}</span>
              </div>
            )}
          </div>

          {/* Section 3: Admin Password Management */}
          <div className="crm-settings-group-block">
            <div className="crm-settings-group-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <KeyRound size={16} color="var(--crm-accent)" />
                <span className="crm-settings-group-title">Super Admin Credentials</span>
              </div>
              <span style={{ fontSize: 11, color: 'var(--crm-text-secondary)' }}>Minimum 6 characters</span>
            </div>

            <form onSubmit={handleChangePassword} className="crm-form-grid-3" style={{ marginTop: 10 }}>
              <div className="crm-settings-field">
                <label>Current Password</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type={showPasswords.current ? 'text' : 'password'}
                    className="crm-settings-input"
                    value={passwordState.currentPassword}
                    onChange={e => setPasswordState(prev => ({ ...prev, currentPassword: e.target.value }))}
                    placeholder="••••••••"
                    style={{ width: '100%', paddingRight: 34 }}
                  />
                  <button
                    type="button"
                    className="crm-icon-btn"
                    onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                    style={{ position: 'absolute', right: 5, padding: 3 }}
                    title={showPasswords.current ? 'Hide password' : 'Show password'}
                  >
                    {showPasswords.current ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              </div>

              <div className="crm-settings-field">
                <label>New Password</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type={showPasswords.newPass ? 'text' : 'password'}
                    className="crm-settings-input"
                    value={passwordState.newPassword}
                    onChange={e => setPasswordState(prev => ({ ...prev, newPassword: e.target.value }))}
                    placeholder="Minimum 6 characters"
                    style={{ width: '100%', paddingRight: 34 }}
                  />
                  <button
                    type="button"
                    className="crm-icon-btn"
                    onClick={() => setShowPasswords(prev => ({ ...prev, newPass: !prev.newPass }))}
                    style={{ position: 'absolute', right: 5, padding: 3 }}
                    title={showPasswords.newPass ? 'Hide password' : 'Show password'}
                  >
                    {showPasswords.newPass ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              </div>

              <div className="crm-settings-field">
                <label>Confirm New Password</label>
                <div style={{ display: 'flex', gap: 6, position: 'relative', alignItems: 'center' }}>
                  <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
                    <input
                      type={showPasswords.confirm ? 'text' : 'password'}
                      className="crm-settings-input"
                      value={passwordState.confirmPassword}
                      onChange={e => setPasswordState(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      placeholder="Repeat new password"
                      style={{ width: '100%', paddingRight: 34 }}
                    />
                    <button
                      type="button"
                      className="crm-icon-btn"
                      onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                      style={{ position: 'absolute', right: 5, padding: 3 }}
                      title={showPasswords.confirm ? 'Hide password' : 'Show password'}
                    >
                      {showPasswords.confirm ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>
                  <button type="submit" className="crm-btn-primary" style={{ whiteSpace: 'nowrap', padding: '8px 14px', borderRadius: 6 }}>
                    Update
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Section 4: Configuration Snapshots & Portability */}
          <div className="crm-settings-group-block">
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <div>
                <strong style={{ fontSize: 13, color: 'var(--crm-text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Layers size={15} color="var(--crm-accent)" />
                  Configuration Snapshots & Portability
                </strong>
                <p style={{ margin: '2px 0 0 0', fontSize: 11.5, color: 'var(--crm-text-secondary)' }}>
                  Export full website layout parameters, brand swatches, and CRM invariants as a JSON snapshot, or restore previous configuration states.
                </p>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="crm-btn-secondary"
                  onClick={handleExportBackup}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 6 }}
                >
                  <Download size={13} />
                  <span>Export JSON</span>
                </button>

                <button
                  type="button"
                  className="crm-btn-secondary"
                  onClick={() => fileInputRef.current?.click()}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 6 }}
                >
                  <Upload size={13} />
                  <span>Restore JSON</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json"
                  style={{ display: 'none' }}
                  onChange={handleImportBackup}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Add / Edit Contact Modal ──────────────────────────── */}
      {contactModalOpen && (
        <div className="crm-settings-modal-backdrop" onClick={() => setContactModalOpen(false)}>
          <div className="crm-settings-modal-card" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="crm-settings-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: 'rgba(14, 203, 129, 0.15)',
                  border: '1px solid rgba(14, 203, 129, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {editingContactId ? <Edit size={16} color="#0ECB81" /> : <Plus size={16} color="#0ECB81" />}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--crm-text-primary)' }}>
                    {editingContactId ? 'Change Communication Channel' : '+ Add Communication Channel'}
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--crm-text-secondary)' }}>
                    Configure protocol, official badge, and multiple endpoints on this item
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="crm-icon-btn"
                onClick={() => setContactModalOpen(false)}
                title="Close modal"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Form with scrollable body and fixed sticky footer */}
            <form
              onSubmit={handleSaveContactSubmit}
              style={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                minHeight: 0,
                overflow: 'hidden'
              }}
            >
              <div className="crm-settings-modal-body">
                {/* 1. Protocol Visual Grid */}
                <div className="crm-settings-field">
                  <label style={{ marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Official Channel Protocol</span>
                    <span style={{ fontSize: 11, color: 'var(--crm-text-secondary)', fontWeight: 'normal' }}>
                      Selected: <strong style={{ color: 'var(--crm-text-primary)' }}>{PROTOCOL_OPTIONS.find(p => p.id === contactForm.type)?.name || contactForm.type}</strong>
                    </span>
                  </label>
                  <div className="crm-protocol-chips-grid">
                    {PROTOCOL_OPTIONS.map(proto => {
                      const isActive = contactForm.type === proto.id;
                      const LogoComponent = proto.Logo;
                      return (
                        <button
                          key={proto.id}
                          type="button"
                          className={`crm-protocol-chip-btn ${isActive ? 'active' : ''}`}
                          style={isActive ? { borderColor: proto.color, color: 'var(--crm-text-primary)' } : {}}
                          onClick={() => {
                            setContactForm(prev => ({
                              ...prev,
                              type: proto.id,
                              label: prev.label ? prev.label : `${proto.name} Support`
                            }));
                          }}
                        >
                          <LogoComponent className="crm-chip-logo" />
                          <span>{proto.name}</span>
                          {isActive && <Check size={12} color={proto.color} style={{ marginLeft: 'auto' }} />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Descriptive Label */}
                <div className="crm-settings-field">
                  <label>Descriptive Label</label>
                  <input
                    type="text"
                    className="crm-settings-input"
                    placeholder="e.g. London Office Direct, VIP Customer Desk, Sales Line"
                    value={contactForm.label}
                    onChange={e => setContactForm(prev => ({ ...prev, label: e.target.value }))}
                  />
                  <span style={{ fontSize: 11, color: '#6C7584', marginTop: 3 }}>
                    Internal and public name for this communication line.
                  </span>
                </div>

                {/* 3. Primary Contact Value */}
                {(() => {
                  const currentProto = PROTOCOL_OPTIONS.find(p => p.id === contactForm.type) || PROTOCOL_OPTIONS[0];
                  return (
                    <div className="crm-settings-field">
                      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>Primary {currentProto.name} Endpoint / Value *</span>
                        <span style={{ fontSize: 11, color: 'var(--crm-text-secondary)', fontWeight: 'normal' }}>{currentProto.hint}</span>
                      </label>
                      <input
                        type="text"
                        className="crm-settings-input"
                        placeholder={`e.g. ${currentProto.placeholder}`}
                        value={contactForm.value}
                        onChange={e => setContactForm(prev => ({ ...prev, value: e.target.value }))}
                        required
                      />
                    </div>
                  );
                })()}

                {/* 4. Multiple Endpoints / Numbers on this Item (Add More) */}
                <div className="crm-modal-extras-card">
                  <div className="crm-modal-extras-header">
                    <div>
                      <h4 className="crm-modal-extras-title">
                        Multiple Endpoints / Numbers
                        <span className="crm-modal-extras-count">
                          {(contactForm.extraValues?.length || 0) + 1} total
                        </span>
                      </h4>
                      <p className="crm-modal-extras-desc">
                        Add extra telephone numbers, WhatsApp lines, backup email inboxes, or handles to this single contact item.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="crm-btn-add-extra-val"
                      onClick={handleAddModalExtraValue}
                    >
                      <Plus size={13} />
                      <span>+ Add More</span>
                    </button>
                  </div>

                  {contactForm.extraValues && contactForm.extraValues.length > 0 ? (
                    <div className="crm-modal-extras-list">
                      {contactForm.extraValues.map((val, idx) => (
                        <div key={idx} className="crm-modal-extra-item">
                          <span className="crm-modal-extra-tag">#{idx + 2}</span>
                          <input
                            type="text"
                            className="crm-settings-input"
                            style={{ flex: 1 }}
                            placeholder={`Additional ${PROTOCOL_OPTIONS.find(p => p.id === contactForm.type)?.name || ''} endpoint #${idx + 2}`}
                            value={val}
                            onChange={e => handleUpdateModalExtraValue(idx, e.target.value)}
                          />
                          <button
                            type="button"
                            className="crm-modal-extra-del-btn"
                            onClick={() => handleRemoveModalExtraValue(idx)}
                            title="Remove this additional value"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="crm-modal-extras-empty">
                      Currently 1 endpoint. Click <strong style={{ color: 'var(--crm-accent)' }}>"+ Add More"</strong> above to attach additional telephone numbers, WhatsApp lines, or inboxes to this channel.
                    </div>
                  )}
                </div>

                {/* 5. Primary Designation Switch */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  background: '#2B313A',
                  borderRadius: 8,
                  border: '1px solid var(--crm-border)'
                }}>
                  <div>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--crm-text-primary)', display: 'block' }}>
                      Designate as Primary {PROTOCOL_OPTIONS.find(p => p.id === contactForm.type)?.name || contactForm.type} Channel
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--crm-text-secondary)' }}>
                      Features prominently across header CTA buttons, hero section, and quick dials.
                    </span>
                  </div>
                  <label className="crm-toggle-switch">
                    <input
                      type="checkbox"
                      checked={contactForm.isPrimary}
                      onChange={e => setContactForm(prev => ({ ...prev, isPrimary: e.target.checked }))}
                    />
                    <span className="crm-toggle-slider" />
                  </label>
                </div>
              </div>

              {/* Fixed Sticky Footer - Guaranteed to fit on any screen */}
              <div className="crm-settings-modal-footer">
                {editingContactId ? (
                  <button
                    type="button"
                    className="crm-action-btn crm-action-delete"
                    style={{ padding: '8px 14px' }}
                    onClick={() => {
                      executeDeleteContact(editingContactId);
                      setContactModalOpen(false);
                    }}
                    title="Delete this contact channel"
                  >
                    <Trash2 size={13} />
                    <span>Delete Channel</span>
                  </button>
                ) : <div />}

                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <button
                    type="button"
                    className="crm-btn-secondary"
                    style={{ padding: '8px 16px', borderRadius: 8 }}
                    onClick={() => setContactModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="crm-btn-primary"
                    style={{
                      padding: '8px 20px',
                      borderRadius: 8,
                      background: '#0ECB81',
                      color: '#0B111A',
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <Check size={15} strokeWidth={2.5} />
                    <span>{editingContactId ? 'Save Changes' : 'Add Channel'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Fullscreen WordPress-Style Customizer Modal ── */}
      {isFullscreenPreview && (
        <div className="crm-customizer-fullscreen-overlay">
          {/* Top Bar */}
          <div className="crm-fullscreen-topbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Layout size={18} color="var(--crm-accent)" />
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--crm-text-primary)' }}>
                  WordPress-Style Live Site Customizer
                </span>
              </div>
              <div
                className="crm-live-preview-pill"
                style={{
                  padding: '3px 9px',
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                  maxWidth: 'none',
                  width: 'auto',
                  overflow: 'visible',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <span className="crm-status-pulse" style={{ flexShrink: 0 }} />
                <span style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>LIVE PREVIEW</span>
              </div>
              <div className="crm-preview-url-box" style={{ maxWidth: 300 }}>
                <span className="crm-preview-ssl-badge">
                  <span className="crm-preview-ssl-dot" />
                  <span className="crm-preview-https">https://</span>
                </span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  codexdynamics.com/{previewPage !== 'home' ? previewPage : ''}
                </span>
              </div>
            </div>

            {/* Center: Device & Zoom Switchers */}
            <div className="crm-preview-controls-group">
              <div className="crm-preview-segmented">
                <button
                  type="button"
                  className={`crm-preview-segmented-btn ${viewportMode === 'desktop' ? 'active' : ''}`}
                  onClick={() => setViewportMode('desktop')}
                  title="Desktop View (100% wide)"
                >
                  <Monitor size={12} />
                  <span>Desktop</span>
                </button>
                <button
                  type="button"
                  className={`crm-preview-segmented-btn ${viewportMode === 'tablet' ? 'active' : ''}`}
                  onClick={() => setViewportMode('tablet')}
                  title="Tablet View (768px iPad)"
                >
                  <Tablet size={12} />
                  <span>Tablet</span>
                </button>
                <button
                  type="button"
                  className={`crm-preview-segmented-btn ${viewportMode === 'mobile' ? 'active' : ''}`}
                  onClick={() => setViewportMode('mobile')}
                  title="Mobile View (390px iPhone)"
                >
                  <Smartphone size={12} />
                  <span>Mobile</span>
                </button>
              </div>

              <div className="crm-preview-segmented">
                {[100, 85, 75, 60].map((z) => (
                  <button
                    key={z}
                    type="button"
                    className={`crm-preview-segmented-btn ${zoomLevel === z ? 'active' : ''}`}
                    style={{ padding: '3px 6px', fontSize: 10 }}
                    onClick={() => setZoomLevel(z)}
                    title={`Scale to ${z}%`}
                  >
                    {z}%
                  </button>
                ))}
              </div>

              <button
                type="button"
                className="crm-preview-action-icon-btn"
                onClick={() => setPreviewKey((k) => k + 1)}
                title="Reload preview"
              >
                <RefreshCw size={12} />
              </button>

              <a
                href={`/?preview=1${previewPage !== 'home' ? `&page=${previewPage}` : ''}`}
                target="_blank"
                rel="noreferrer"
                className="crm-preview-action-icon-btn"
                title="Open in new browser tab"
              >
                <ExternalLink size={12} />
              </a>
            </div>

            {/* Right: Save & Close buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                type="button"
                className="crm-btn-primary"
                style={{
                  padding: '6px 16px',
                  borderRadius: 6,
                  background: '#0ECB81',
                  color: '#0B111A',
                  fontWeight: 700,
                  fontSize: 12,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  border: 'none',
                  cursor: 'pointer'
                }}
                onClick={handleSaveAll}
                disabled={saving}
              >
                <Check size={14} />
                <span>{saving ? 'Publishing...' : 'Save & Publish'}</span>
              </button>

              <button
                type="button"
                className="crm-preview-action-icon-btn"
                style={{ padding: '6px 12px', fontSize: 12, color: 'var(--crm-text-primary)', background: 'var(--crm-card)' }}
                onClick={() => setIsFullscreenPreview(false)}
                title="Exit fullscreen customizer"
              >
                <X size={14} />
                <span>Exit Fullscreen</span>
              </button>
            </div>
          </div>

          {/* Fullscreen Body: Split Sidebar & Stage */}
          <div className="crm-fullscreen-body">
            <div className="crm-fullscreen-sidebar">
              {/* Page navigation */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--crm-text-secondary)', marginBottom: 8, textTransform: 'uppercase' }}>
                  Preview Page
                </div>
                <div className="crm-preview-page-tabs" style={{ flexWrap: 'wrap' }}>
                  {[
                    { id: 'home', label: 'Homepage' },
                    { id: 'services', label: 'Services' },
                    { id: 'work', label: 'Case Studies' },
                    { id: 'studio', label: 'Kyiv Studio' },
                    { id: 'blog', label: 'Insights' },
                    { id: 'contact', label: 'Contact' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`crm-preview-page-tab ${previewPage === p.id ? 'active' : ''}`}
                      onClick={() => setPreviewPage(p.id)}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Template Presets */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--crm-text-secondary)', marginBottom: 8, textTransform: 'uppercase' }}>
                  Theme & Template Presets
                </div>
                <div className="crm-template-presets-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', maxHeight: 280, overflowY: 'auto', paddingRight: 4 }}>
                  {THEME_LAYOUT_PRESETS.map((preset) => {
                    const isSelected =
                      siteConfig.activeTheme === preset.id ||
                      (siteConfig.primaryColor === preset.primary && siteConfig.backgroundColor === preset.bg);

                    return (
                      <button
                        key={preset.id}
                        type="button"
                        className={`crm-template-card ${isSelected ? 'active' : ''}`}
                        onClick={() => handleApplyTemplatePreset(preset)}
                      >
                        <div className="crm-template-palette-dots">
                          <span className="crm-palette-dot" style={{ background: preset.primary }} />
                          <span className="crm-palette-dot" style={{ background: preset.bg }} />
                          <span className="crm-palette-dot" style={{ background: preset.card }} />
                          <span className="crm-palette-dot" style={{ background: preset.accent }} />
                        </div>
                        <div className="crm-template-title">{preset.name}</div>
                        <div className="crm-template-badge">{preset.badge}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Color Customizer */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--crm-text-secondary)', marginBottom: 8, textTransform: 'uppercase' }}>
                  Live Color Swatches
                </div>
                <div className="crm-color-swatch-bar">
                  <div className="crm-color-swatch-item">
                    <label>Primary</label>
                    <div className="crm-color-picker-input-wrapper">
                      <input
                        type="color"
                        value={siteConfig.primaryColor}
                        onChange={(e) => updateField('primaryColor', e.target.value)}
                      />
                      <span className="crm-color-picker-hex">{siteConfig.primaryColor}</span>
                    </div>
                  </div>
                  <div className="crm-color-swatch-item">
                    <label>Canvas BG</label>
                    <div className="crm-color-picker-input-wrapper">
                      <input
                        type="color"
                        value={siteConfig.backgroundColor}
                        onChange={(e) => updateField('backgroundColor', e.target.value)}
                      />
                      <span className="crm-color-picker-hex">{siteConfig.backgroundColor}</span>
                    </div>
                  </div>
                  <div className="crm-color-swatch-item">
                    <label>Card BG</label>
                    <div className="crm-color-picker-input-wrapper">
                      <input
                        type="color"
                        value={siteConfig.cardBg}
                        onChange={(e) => updateField('cardBg', e.target.value)}
                      />
                      <span className="crm-color-picker-hex">{siteConfig.cardBg}</span>
                    </div>
                  </div>
                  <div className="crm-color-swatch-item">
                    <label>Accent</label>
                    <div className="crm-color-picker-input-wrapper">
                      <input
                        type="color"
                        value={siteConfig.accentColor}
                        onChange={(e) => updateField('accentColor', e.target.value)}
                      />
                      <span className="crm-color-picker-hex">{siteConfig.accentColor}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Hero & Navigation Layout */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--crm-text-secondary)', marginBottom: 6, textTransform: 'uppercase' }}>
                  Hero Opening Block
                </div>
                <div className="crm-options-pill-grid">
                  {HERO_LAYOUT_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      className={`crm-options-pill-btn ${(siteConfig.heroLayout || 'streamer') === opt.id ? 'active' : ''}`}
                      onClick={() => updateField('heroLayout', opt.id)}
                    >
                      <span className="crm-options-pill-title">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Section Sequence & Visibility */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--crm-text-secondary)', textTransform: 'uppercase' }}>
                    Section Sequence & Visibility
                  </div>
                  <button
                    type="button"
                    className="crm-sec-inspect-btn"
                    onClick={handleResetSectionOrder}
                    title="Reset to default sequence"
                  >
                    <RotateCcw size={11} />
                    <span>Reset</span>
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {siteConfig.sectionsOrder.map((secId, idx) => {
                    const meta = DEFAULT_SECTIONS.find((s) => s.id === secId) || { name: secId, desc: '', category: 'Section' };
                    const isVisible = siteConfig.sectionsVisibility[secId] !== false;

                    return (
                      <div
                        key={secId}
                        className={`crm-order-item-enhanced ${!isVisible ? 'hidden-sec' : ''}`}
                        style={{ padding: '6px 8px' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
                          <span className="crm-order-sec-num" style={{ fontSize: 10 }}>0{idx + 1}</span>
                          <span
                            style={{
                              fontSize: 11.5,
                              fontWeight: 600,
                              color: isVisible ? 'var(--crm-text-primary)' : '#5E6673',
                              textDecoration: isVisible ? 'none' : 'line-through',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {meta.name}
                          </span>
                        </div>

                        <div style={{ display: 'flex', gap: 3, alignItems: 'center', flexShrink: 0, whiteSpace: 'nowrap' }}>
                          {isVisible && (
                            <button
                              type="button"
                              className="crm-sec-inspect-btn"
                              style={{ padding: '2px 5px', fontSize: 10 }}
                              onClick={() => handleJumpToSection(secId)}
                              title="Scroll preview to this section"
                            >
                              <Eye size={10} />
                              <span>Inspect</span>
                            </button>
                          )}
                          <button
                            type="button"
                            className="crm-icon-btn"
                            disabled={idx === 0}
                            onClick={() => moveSection(idx, -1)}
                            style={{ padding: 3 }}
                          >
                            <ArrowUp size={11} />
                          </button>
                          <button
                            type="button"
                            className="crm-icon-btn"
                            disabled={idx === siteConfig.sectionsOrder.length - 1}
                            onClick={() => moveSection(idx, 1)}
                            style={{ padding: 3 }}
                          >
                            <ArrowDown size={11} />
                          </button>
                          <button
                            type="button"
                            className={`crm-icon-btn ${isVisible ? '' : 'danger'}`}
                            onClick={() => toggleSectionVisibility(secId)}
                            style={{ padding: 3 }}
                          >
                            {isVisible ? <Eye size={11} /> : <EyeOff size={11} />}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Fullscreen Stage */}
            <div className="crm-fullscreen-stage">
              <div
                className={`crm-device-shell ${viewportMode}`}
                style={{
                  transform: zoomLevel !== 100 ? `scale(${zoomLevel / 100})` : undefined,
                  transformOrigin: 'top center',
                }}
              >
                {viewportMode === 'mobile' && <div className="crm-device-notch" />}
                <iframe
                  key={`fs-${previewKey}`}
                  ref={fullscreenIframeRef}
                  src={`/?preview=1${previewPage !== 'home' ? `&page=${previewPage}` : ''}`}
                  className="crm-preview-iframe"
                  onLoad={() => syncToPreview(siteConfig)}
                  title="Codex Dynamics Fullscreen Preview"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Apple Cupertino Floating Action Capsule (Bottom Dock) ── */}
      <div className={`crm-floating-action-capsule ${hasUnsavedChanges ? 'active' : 'idle'}`}>
        <div className="crm-floating-capsule-inner">
          {hasUnsavedChanges ? (
            <>
              <div className="crm-floating-status">
                <span className="crm-status-pulse" />
                <span className="crm-floating-status-text">Unsaved Changes</span>
              </div>
              <div className="crm-floating-divider" />
              <button
                type="button"
                className="crm-floating-btn secondary"
                onClick={handleResetToDefaults}
                title="Discard unsaved changes and revert form"
              >
                <RotateCcw size={12} />
                <span>Revert</span>
              </button>
              <button
                type="button"
                className="crm-floating-btn primary"
                onClick={handleSaveAll}
                disabled={saving}
                title="Publish changes (Keyboard shortcut: ⌘S or Ctrl+S)"
              >
                <Save size={13} />
                <span>{saving ? 'Publishing...' : 'Save Changes'}</span>
                <kbd className="crm-kbd">⌘S</kbd>
              </button>
            </>
          ) : (
            <div className="crm-floating-synced-status">
              <Check size={13} color="#0ECB81" strokeWidth={2.5} />
              <span>All Configurations Synced & Live</span>
            </div>
          )}
        </div>
      </div>

      {/* Floating Quick Preview Trigger (When in Full Editor mode) */}
      {activeSubTab === 'layout' && studioLayoutMode === 'editor' && (
        <button
          type="button"
          className="crm-floating-preview-trigger"
          onClick={() => setStudioLayoutMode('split')}
          title="Return to split view with Live Preview"
        >
          <Eye size={13} color="var(--crm-accent)" />
          <span>Show Live Preview</span>
        </button>
      )}
    </div>
  );
}
