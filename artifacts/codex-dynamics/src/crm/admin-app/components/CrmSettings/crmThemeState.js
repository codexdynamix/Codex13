// CRM Theme & Appearance State Manager

import { COLOR_PALETTES, generateRandomHarmoniousPalette } from '../SiteSettings/ThemeAndPalettePresets';
import { saveSettingsToApi } from '../../../platformDefaults';

export { COLOR_PALETTES };

export const CRM_THEME_PRESETS = [
  {
    id: 'apple-space-gray',
    name: 'Apple Space Gray (Original Standard)',
    category: 'Dark',
    desc: 'A neutral dark workspace with distinct solid surfaces, clear borders, and Cupertino Blue.',
    isLight: false,
    accent: '#0A84FF',
    accentHover: '#0071E3',
    bg: '#16171B',
    card: '#23242A',
    cardHover: '#2D2F36',
    border: 'rgba(255, 255, 255, 0.14)',
    borderHover: 'rgba(255, 255, 255, 0.22)',
    textPrimary: '#F5F5F7',
    textSecondary: '#B0B0B5',
    textMuted: '#929298',
    inputBg: '#1C1C1E',
    tag: 'Apple Default',
  },
  {
    id: 'apple-dark-graphite',
    name: 'Apple Dark Graphite (Titanium)',
    category: 'Dark',
    desc: 'A restrained graphite workspace with an Indigo accent.',
    isLight: false,
    accent: '#5E5CE6',
    accentHover: '#7D7AFF',
    bg: '#121214',
    card: '#1C1C1E',
    cardHover: '#2C2C2E',
    border: 'rgba(255, 255, 255, 0.14)',
    borderHover: 'rgba(255, 255, 255, 0.22)',
    textPrimary: '#F5F5F7',
    textSecondary: '#B0B0B5',
    textMuted: '#929298',
    inputBg: '#1C1C1E',
    tag: 'Graphite',
  },
  {
    id: 'apple-light',
    name: 'Apple Light (Cupertino Clean)',
    category: 'Light',
    desc: 'White panels on a soft gray canvas, clear dividers, and Cupertino Blue.',
    isLight: true,
    accent: '#0071E3',
    accentHover: '#0077ED',
    bg: '#F5F5F7',
    card: '#FFFFFF',
    cardHover: '#F2F2F7',
    border: 'rgba(29, 29, 31, 0.16)',
    borderHover: 'rgba(29, 29, 31, 0.24)',
    textPrimary: '#1D1D1F',
    textSecondary: '#6E6E73',
    textMuted: '#6E6E73',
    inputBg: '#FFFFFF',
    tag: 'Cupertino Light',
  },
  {
    id: 'macos-slate-gray',
    name: 'macOS Slate Gray',
    category: 'Dark',
    desc: 'A cool slate workspace with solid surfaces and a restrained cyan accent.',
    isLight: false,
    accent: '#00C7BE',
    accentHover: '#30D8D1',
    bg: '#171B21',
    card: '#222831',
    cardHover: '#2A323D',
    border: 'rgba(255, 255, 255, 0.14)',
    borderHover: 'rgba(255, 255, 255, 0.22)',
    textPrimary: '#F0F4F8',
    textSecondary: '#8B98A5',
    textMuted: '#586574',
    inputBg: '#1C1C1E',
    tag: 'Slate',
  },
  {
    id: 'sunset-gold',
    name: 'Sunset Amber & Gold',
    category: 'Luxury',
    desc: 'Warm charcoal obsidian and amber gold palette delivering high-end agency prestige.',
    isLight: false,
    accent: '#FF9F0A',
    accentHover: '#FFB340',
    bg: '#161412',
    card: '#221E1A',
    cardHover: '#2E2822',
    border: 'rgba(255, 159, 10, 0.16)',
    borderHover: 'rgba(255, 159, 10, 0.32)',
    textPrimary: '#FAF5EE',
    textSecondary: '#A39587',
    textMuted: '#6B6055',
    inputBg: 'rgba(255, 255, 255, 0.05)',
    tag: 'Luxury Gold',
  },
  {
    id: 'emerald-mint',
    name: 'Apple Mint & Pine',
    category: 'Dark',
    desc: 'Deep evergreen pine canvas paired with crisp Apple Mint green metrics and clean typography.',
    isLight: false,
    accent: '#30D158',
    accentHover: '#34E061',
    bg: '#121714',
    card: '#1D2520',
    cardHover: '#26312B',
    border: 'rgba(48, 209, 88, 0.16)',
    borderHover: 'rgba(48, 209, 88, 0.3)',
    textPrimary: '#EDF8F1',
    textSecondary: '#7CA88D',
    textMuted: '#4C6E59',
    inputBg: 'rgba(255, 255, 255, 0.05)',
    tag: 'Apple Mint',
  },
  {
    id: 'royal-purple',
    name: 'Royal Amethyst',
    category: 'Dark',
    desc: 'A dark neutral canvas with a restrained purple accent.',
    isLight: false,
    accent: '#BF5AF2',
    accentHover: '#D17CFA',
    bg: '#16121D',
    card: '#221C2E',
    cardHover: '#2E253E',
    border: 'rgba(191, 90, 242, 0.18)',
    borderHover: 'rgba(191, 90, 242, 0.35)',
    textPrimary: '#F7F2FC',
    textSecondary: '#9A8AA8',
    textMuted: '#635570',
    inputBg: 'rgba(255, 255, 255, 0.05)',
    tag: 'Amethyst',
  },
  {
    id: 'obsidian-cyber',
    name: 'Obsidian Jet & Gold',
    category: 'Dark',
    desc: 'Deepest pure jet-black foundation with crisp Codex Gold and razor-sharp Apple hairlines.',
    isLight: false,
    accent: '#F0B90B',
    accentHover: '#FCD535',
    bg: '#0F1012',
    card: '#1A1C1F',
    cardHover: '#22252A',
    border: 'rgba(240, 185, 11, 0.15)',
    borderHover: 'rgba(240, 185, 11, 0.3)',
    textPrimary: '#EAECEF',
    textSecondary: '#848E9C',
    textMuted: '#5E6673',
    inputBg: 'rgba(255, 255, 255, 0.05)',
    tag: 'Codex Gold',
  },
];

export const ACCENT_SWATCHES = [
  { name: 'Cupertino Blue', hex: '#0071E3' },
  { name: 'Azure Vibrant', hex: '#0A84FF' },
  { name: 'Apple Mint', hex: '#30D158' },
  { name: 'Apple Indigo', hex: '#5E5CE6' },
  { name: 'Apple Amber', hex: '#FF9F0A' },
  { name: 'Apple Rose', hex: '#FF375F' },
  { name: 'Apple Cyan', hex: '#00C7BE' },
  { name: 'Apple Purple', hex: '#BF5AF2' },
  { name: 'Codex Gold', hex: '#F0B90B' },
  { name: 'Titanium Gray', hex: '#8E8E93' },
];

export const DENSITY_OPTIONS = [
  { id: 'compact', name: 'Compact', desc: 'Maximum data density (38px rows, tighter padding)' },
  { id: 'comfortable', name: 'Comfortable', desc: 'Apple standard balance (48px rows, balanced whitespace)' },
  { id: 'spacious', name: 'Spacious', desc: 'Relaxed touch-friendly flow (56px rows, airy padding)' },
];

export const RADIUS_OPTIONS = [
  { id: 'ios-modern', name: 'iOS Squircle (14px)', radius: '14px' },
  { id: 'clean', name: 'Refined Rounded (8px)', radius: '8px' },
  { id: 'subtle', name: 'Crisp Minimal (4px)', radius: '4px' },
];

// Harmonious seeds for Coolors generator
export const COOLORS_SEEDS = [
  {
    name: 'Apple Space Gray Pro',
    accent: '#0A84FF',
    bg: '#16171B',
    card: '#23242A',
    glow: '#64D2FF',
    secondary: '#2D2F36',
    isLight: false,
  },
  {
    name: 'Cupertino Clean Ivory',
    accent: '#0071E3',
    bg: '#F5F5F7',
    card: '#FFFFFF',
    glow: '#38BDF8',
    secondary: '#E5E5EA',
    isLight: true,
  },
  {
    name: 'Graphite Titanium Mint',
    accent: '#30D158',
    bg: '#141416',
    card: '#1F2024',
    glow: '#34E061',
    secondary: '#2A2C32',
    isLight: false,
  },
  {
    name: 'Pacific Azure Marina',
    accent: '#00C7BE',
    bg: '#0E1721',
    card: '#172230',
    glow: '#30D8D1',
    secondary: '#202D3E',
    isLight: false,
  },
  {
    name: 'Sunset Imperial Amber',
    accent: '#FF9F0A',
    bg: '#171412',
    card: '#241F1A',
    glow: '#FFB340',
    secondary: '#302A24',
    isLight: false,
  },
  {
    name: 'Royal Velvet Indigo',
    accent: '#5E5CE6',
    bg: '#15121E',
    card: '#221C30',
    glow: '#7D7AFF',
    secondary: '#2E2740',
    isLight: false,
  },
  {
    name: 'Obsidian Gold Reserve',
    accent: '#F0B90B',
    bg: '#111215',
    card: '#1C1E23',
    glow: '#FCD535',
    secondary: '#272A31',
    isLight: false,
  },
  {
    name: 'Neon Cyber Azure',
    accent: '#00E5FF',
    bg: '#0B0F17',
    card: '#141C2B',
    glow: '#00FF88',
    secondary: '#1C273C',
    isLight: false,
  },
];

export function generateHarmoniousCrmColors(mode = 'dark', currentColors = []) {
  const pal = generateRandomHarmoniousPalette(mode === 'light' ? 'light' : mode === 'all' ? null : 'dark');
  return {
    accent: pal.primary,
    bg: pal.bg,
    card: pal.card,
    glow: pal.accent,
    secondary: pal.secondary,
    name: pal.name,
    isLight: pal.isLight,
  };
}

export function calcContrast(hex1, hex2) {
  if (!hex1 || !hex2) return '10:1';
  function lum(hex) {
    const clean = hex.replace('#', '');
    const num = parseInt(clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    const [rs, gs, bs] = [r, g, b].map(v => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  }
  const l1 = lum(hex1);
  const l2 = lum(hex2);
  const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  return `${ratio.toFixed(1)}:1`;
}

const STORAGE_KEY = 'cdx_crm_theme_settings';

export const DEFAULT_CRM_SETTINGS = {
  themeId: 'apple-space-gray',
  accentColor: '#0A84FF',
  customBg: '',
  customCard: '',
  density: 'comfortable',
  radius: 'clean',
  glassEffect: false,
  cardElevation: 'flat',
  tableZebra: false,
};

export function getCrmThemeSettings() {
  if (typeof window === 'undefined') return DEFAULT_CRM_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CRM_SETTINGS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_CRM_SETTINGS, ...parsed, glassEffect: false };
  } catch (_) {
    return DEFAULT_CRM_SETTINGS;
  }
}

export function applyCrmThemeToDom(settings = getCrmThemeSettings()) {
  if (typeof document === 'undefined') return;

  const preset = CRM_THEME_PRESETS.find(p => p.id === settings.themeId) || CRM_THEME_PRESETS[0];
  const accent = settings.accentColor || preset.accent;
  const isHex = (value) => typeof value === 'string' && /^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(value.trim());
  const isLightColor = (value) => {
    if (!isHex(value)) return false;
    let clean = value.slice(1);
    if (clean.length === 3) clean = clean.split('').map((char) => char + char).join('');
    const channels = [0, 2, 4].map((offset) => parseInt(clean.slice(offset, offset + 2), 16));
    const [r, g, b] = channels.map((channel) => {
      const normalized = channel / 255;
      return normalized <= 0.04045
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.42;
  };
  const bg = isHex(settings.customBg) ? settings.customBg : preset.bg;
  const isLight = isLightColor(bg);
  const standardCard = isLight ? '#FFFFFF' : '#242426';
  const presetCard = isLightColor(preset.card) === isLight ? preset.card : standardCard;
  const card = isHex(settings.customCard) && isLightColor(settings.customCard) === isLight
    ? settings.customCard
    : presetCard;
  const cardHover = isLight ? '#F2F2F7' : '#2C2C2E';
  const border = isLight ? 'rgba(29, 29, 31, 0.16)' : 'rgba(255, 255, 255, 0.14)';
  const borderHover = isLight ? 'rgba(29, 29, 31, 0.24)' : 'rgba(255, 255, 255, 0.22)';
  const textPrimary = isLight ? '#1D1D1F' : '#F5F5F7';
  const textSecondary = isLight ? '#626269' : '#B0B0B5';
  const textMuted = isLight ? '#6E6E73' : '#929298';
  const inputBg = isLight ? '#FFFFFF' : '#1C1C1E';
  const accentForeground = isLightColor(accent) ? '#1D1D1F' : '#FFFFFF';

  const root = document.querySelector('.crm-admin-app') || document.documentElement;

  // Set data attributes for selector targeting
  root.setAttribute('data-crm-theme', settings.themeId);
  root.setAttribute('data-crm-mode', isLight ? 'light' : 'dark');
  root.setAttribute('data-crm-density', settings.density);
  root.setAttribute('data-crm-radius', settings.radius);
  root.setAttribute('data-crm-glass', 'false');
  root.style.colorScheme = isLight ? 'light' : 'dark';

  // Compute radii
  const radiusValue = settings.radius === 'ios-modern' ? '14px' : settings.radius === 'clean' ? '8px' : '4px';
  const radiusSm = settings.radius === 'ios-modern' ? '8px' : settings.radius === 'clean' ? '4px' : '2px';

  // Apply CSS Variables directly for instant styling
  root.style.setProperty('--crm-bg', bg);
  root.style.setProperty('--crm-card', card);
  root.style.setProperty('--crm-card-hover', cardHover);
  root.style.setProperty('--crm-border', border);
  root.style.setProperty('--crm-border-hover', borderHover);
  root.style.setProperty('--crm-text-primary', textPrimary);
  root.style.setProperty('--crm-text-secondary', textSecondary);
  root.style.setProperty('--crm-text-muted', textMuted);
  root.style.setProperty('--crm-input-bg', inputBg);
  root.style.setProperty('--crm-accent', accent);
  root.style.setProperty('--crm-accent-hover', preset.accentHover || accent);
  root.style.setProperty('--crm-radius', radiusValue);
  root.style.setProperty('--crm-radius-sm', radiusSm);
  root.style.setProperty('--crm-accent-fg', accentForeground);
  root.style.setProperty('--crm-surface-alt', cardHover);
  root.style.setProperty('--cdx-accent-glow', 'transparent');
  root.style.setProperty('--cdx-bg', bg);
  root.style.setProperty('--cdx-surface', card);
  root.style.setProperty('--cdx-surface-2', cardHover);
   root.style.setProperty('--cdx-text', textPrimary);
   root.style.setProperty('--cdx-muted', textSecondary);
  root.style.setProperty('--cdx-accent', accent);
  root.style.setProperty('--cdx-accent-hi', preset.accentHover || accent);

  // Map legacy color variables to ensure entire admin app switches gracefully
  root.style.setProperty('--color-primary-dark', bg);
  root.style.setProperty('--color-primary-darker', bg);
  root.style.setProperty('--color-surface-0', bg);
  root.style.setProperty('--color-surface-1', card);
  root.style.setProperty('--color-surface-2', cardHover);
  root.style.setProperty('--color-surface-3', cardHover);
  root.style.setProperty('--color-surface-hover', cardHover);
  root.style.setProperty('--color-border-primary', border);
  root.style.setProperty('--color-border-secondary', border);
  root.style.setProperty('--color-border-subtle', border);
  root.style.setProperty('--color-text-primary', textPrimary);
  root.style.setProperty('--color-text-secondary', textSecondary);
  root.style.setProperty('--color-text-tertiary', textMuted);
  root.style.setProperty('--color-primary-yellow', accent);
  root.style.setProperty('--color-accent-yellow', accent);
  root.style.setProperty('--color-accent-blue', accent);

  // Legacy fallback aliases
  root.style.setProperty('--bg', bg);
  root.style.setProperty('--panel', card);
  root.style.setProperty('--surface', card);
  root.style.setProperty('--border', border);
  root.style.setProperty('--muted', textSecondary);
  root.style.setProperty('--text', textPrimary);
  root.style.setProperty('--accent', accent);
  root.style.setProperty('--button-color', accent);
  root.style.setProperty('--card-color', card);
  root.style.setProperty('--bg-input', inputBg);
}

// The CRM theme is stored in platform settings (`settings.crmTheme`). The
// localStorage copy is only a first-paint cache of the server value.
export async function loadCrmThemeFromServer() {
  const response = await fetch('/api/crm/settings', { headers: { Accept: 'application/json' } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok === false) throw new Error(data?.error || 'CRM theme could not be loaded.');
  const serverTheme = data?.settings?.crmTheme;
  if (!serverTheme || typeof serverTheme !== 'object') return getCrmThemeSettings();
  return cacheAndApplyCrmTheme({ ...DEFAULT_CRM_SETTINGS, ...serverTheme, glassEffect: false });
}

function cacheAndApplyCrmTheme(merged) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch (_) {}
  applyCrmThemeToDom(merged);
  window.dispatchEvent(new CustomEvent('cdx:crm-theme-changed', { detail: merged }));
  return merged;
}

export async function saveCrmThemeSettings(newSettings) {
  if (typeof window === 'undefined') return undefined;
  const merged = { ...getCrmThemeSettings(), ...newSettings, glassEffect: false };
  await saveSettingsToApi({ crmTheme: merged });
  return cacheAndApplyCrmTheme(merged);
}
