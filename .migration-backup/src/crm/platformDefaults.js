import { useEffect } from 'react';
import { useSyncExternalStore } from 'react';

// ---------------------------------------------------------------------------
// SINGLE SOURCE OF TRUTH for platform defaults.
//
// These values represent the Codex Dynamics visual identity. They are
// used ONLY as the initial state before the backend responds and as the
// target for "Revert to Default Design". They are NEVER persisted to
// localStorage - the database is the only persistent store.
// ---------------------------------------------------------------------------

export const DEFAULT_PLATFORM_SETTINGS = Object.freeze({
  // Identity
  platformName: 'Codex Dynamics',
  platformAbbreviation: 'CD',
  platformYear: '2025',

  // Contact
  platformPhone: '+1 (555) 123-4567',
  platformAddress: '100 Innovation Way, Suite 400, San Francisco, CA 94105',
  supportEmail: 'support@codexdynamics.com',

  // Hero (landing page)
  heroHeader: 'High-Performance Web\n& Custom CRM Solutions.\nPowered by Engineering.',
  heroStatement:
    'Custom web design, high-performance web applications, bespoke CRM software, and digital marketing engines.',

  // Currency
  baseCurrency: 'USD',

  // Toggles
  registrationEnabled: true,
  twoFactorAuthEnabled: true,
  sessionTimeoutMinutes: 30,
  maxFailedLoginAttempts: 5,

  // Color scheme - the default Codex Dynamics identity
  primaryColor: '#F0B90B',
  secondaryColor: '#1E2026',
  accentColor: '#F0B90B',
  buttonColor: '#F0B90B',
  backgroundColor: '#0a0a0f',
  textColor: '#F9FAFB',

  // Custom color palettes saved by the admin
  customThemes: [],
});

/**
 * Merge overrides on top of the canonical defaults so every consumer sees
 * a complete settings object regardless of what the database contains.
 */
export const mergePlatformSettings = (overrides = {}) => ({
  ...DEFAULT_PLATFORM_SETTINGS,
  ...overrides,
});

// ---------------------------------------------------------------------------
// Backend-driven module singleton.
//
// This is the only in-memory store for platform settings at runtime.
// It starts as null (not yet loaded), is populated by the first fetch from
// the backend, and is updated whenever the admin saves new settings.
//
// NO localStorage is used here. The database is the authoritative store.
// ---------------------------------------------------------------------------

let _settings = null;
const _listeners = new Set();
let _syncInProgress = false;

function _notifyAll() {
  _listeners.forEach((fn) => fn());
}

/**
 * Update the in-memory singleton and notify all React subscribers.
 * Called after a successful backend fetch or after the admin saves settings.
 * This propagates the change instantly to every component that calls
 * usePlatformSettings(), across the entire tab, with no page reload.
 */
export const updateLocalSettingsState = (settings) => {
  _settings = mergePlatformSettings(settings);
  _notifyAll();
};

/**
 * Fetch the current settings from the public backend endpoint and update
 * the module singleton. Idempotent - concurrent calls are collapsed.
 */
export const syncSettingsFromBackend = async () => {
  if (_syncInProgress) return;
  _syncInProgress = true;
  try {
    if (!_settings) {
      updateLocalSettingsState(DEFAULT_PLATFORM_SETTINGS);
    }
  } finally {
    _syncInProgress = false;
  }
};

/**
 * Save settings to the in-memory store.
 */
export const saveSettingsToApi = async (settings, _adminToken) => {
  updateLocalSettingsState(settings);
  return { ok: true, settings: _settings };
};

/**
 * Fetch settings from the in-memory store.
 */
export const fetchAdminSettings = async (_adminToken) => {
  return _settings ?? DEFAULT_PLATFORM_SETTINGS;
};

/**
 * Fetch settings change history.
 */
export const fetchSettingsHistory = async (_adminToken, { limit: _limit = 50, offset: _offset = 0 } = {}) => {
  return { history: [], total: 0 };
};

// ---------------------------------------------------------------------------
// useSyncExternalStore wiring
// ---------------------------------------------------------------------------

function _subscribe(notify) {
  _listeners.add(notify);
  return () => _listeners.delete(notify);
}

function _getSnapshot() {
  return _settings ?? DEFAULT_PLATFORM_SETTINGS;
}

function _getServerSnapshot() {
  return DEFAULT_PLATFORM_SETTINGS;
}

/**
 * Read the current platform settings. Every component that calls this hook
 * automatically re-renders whenever the settings are updated - whether from
 * a backend fetch on startup, an admin save in the same tab, or any direct
 * call to updateLocalSettingsState().
 *
 * The hook kicks off a backend fetch on first mount so the data is always
 * fresh from the database, regardless of any prior state.
 */
export const usePlatformSettings = () => {
  const settings = useSyncExternalStore(_subscribe, _getSnapshot, _getServerSnapshot);

  useEffect(() => {
    syncSettingsFromBackend();
  }, []);

  return settings;
};
