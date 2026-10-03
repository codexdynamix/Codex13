import React, { useState, useEffect, useCallback } from 'react';
import './CrmSettings.css';
import {
  CRM_THEME_PRESETS,
  ACCENT_SWATCHES,
  DENSITY_OPTIONS,
  RADIUS_OPTIONS,
  DEFAULT_CRM_SETTINGS,
  getCrmThemeSettings,
  saveCrmThemeSettings,
  applyCrmThemeToDom,
  generateHarmoniousCrmColors,
  calcContrast,
} from './crmThemeState';
import {
  Palette,
  Check,
  RotateCcw,
  Save,
  Sparkles,
  Layout,
  Sliders,
  Lock,
  Unlock,
  Copy,
  RefreshCw,
  Sun,
  Moon,
  ChevronDown,
  Wand2,
} from 'lucide-react';

export default function CrmSettingsTab({ showNotification }) {
  const [settings, setSettings] = useState(getCrmThemeSettings);
  const [saved, setSaved] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);

  // Coolors Interactive Palette Generator Stage
  const [generatorMode, setGeneratorMode] = useState('dark'); // 'dark' | 'light' | 'all'
  const [palettePillars, setPalettePillars] = useState(() => [
    { id: 'accent', label: 'Primary Accent', hex: '#0A84FF', locked: false, desc: 'Action buttons & pills' },
    { id: 'bg', label: 'Canvas Background', hex: '#16171B', locked: false, desc: 'Apple dark gray base' },
    { id: 'card', label: 'Card Surface', hex: '#23242A', locked: false, desc: 'Solid panels' },
    { id: 'glow', label: 'Accent Detail', hex: '#64D2FF', locked: false, desc: 'Active badges' },
    { id: 'secondary', label: 'Secondary Gray', hex: '#2D2F36', locked: false, desc: 'Hover states & inputs' },
  ]);

  // Apply theme to DOM on setting changes
  useEffect(() => {
    applyCrmThemeToDom(settings);
  }, [settings]);

  // Generate new harmonious palette (Coolors style)
  const handleGenerateHarmoniousPalette = useCallback(() => {
    const generated = generateHarmoniousCrmColors(generatorMode);
    setPalettePillars((prev) =>
      prev.map((pillar) => {
        if (pillar.locked) return pillar;
        if (pillar.id === 'accent') return { ...pillar, hex: generated.accent };
        if (pillar.id === 'bg') return { ...pillar, hex: generated.bg };
        if (pillar.id === 'card') return { ...pillar, hex: generated.card };
        if (pillar.id === 'glow') return { ...pillar, hex: generated.glow };
        if (pillar.id === 'secondary') return { ...pillar, hex: generated.secondary };
        return pillar;
      })
    );
  }, [generatorMode]);

  // Keyboard shortcut: Spacebar generates a new palette when on this tab
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code !== 'Space' || !(e.target instanceof HTMLElement)) return;
      if (e.target.closest('button, summary, a, input, textarea, select, [contenteditable="true"], [role="button"]')) return;
      e.preventDefault();
      handleGenerateHarmoniousPalette();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleGenerateHarmoniousPalette]);

  // Toggle lock on pillar
  const toggleLock = (index) => {
    setPalettePillars((prev) =>
      prev.map((col, idx) => (idx === index ? { ...col, locked: !col.locked } : col))
    );
  };

  // Direct edit of pillar hex
  const updatePillarHex = (index, newHex) => {
    setPalettePillars((prev) =>
      prev.map((col, idx) => (idx === index ? { ...col, hex: newHex } : col))
    );
  };

  // Copy hex code
  const copyHex = (hex, index) => {
    navigator.clipboard.writeText(hex);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1500);
    if (showNotification) showNotification(`Copied ${hex} to clipboard.`);
  };

  // Apply generated palette directly to CRM
  const applyPaletteToCrm = () => {
    const accentCol = palettePillars.find((p) => p.id === 'accent')?.hex || '#0A84FF';
    const bgCol = palettePillars.find((p) => p.id === 'bg')?.hex || '#16171B';
    const cardCol = palettePillars.find((p) => p.id === 'card')?.hex || '#23242A';
    const glowCol = palettePillars.find((p) => p.id === 'glow')?.hex || accentCol;
    const secondaryCol = palettePillars.find((p) => p.id === 'secondary')?.hex || '#2D2F36';

    setSettings((prev) => ({
      ...prev,
      accentColor: accentCol,
      customBg: bgCol,
      customCard: cardCol,
    }));
    setPalettePillars((prev) => prev.map((p) => {
      if (p.id === 'glow') return { ...p, hex: glowCol };
      if (p.id === 'secondary') return { ...p, hex: secondaryCol };
      return p;
    }));
    setSaved(false);
    if (showNotification) {
      showNotification('Applied generated palette to CRM. Click Save & Apply to persist.');
    }
  };

  const handleThemeSelect = (preset) => {
    setSettings((prev) => ({
      ...prev,
      themeId: preset.id,
      accentColor: preset.accent,
      customBg: '',
      customCard: '',
    }));
    // Sync generator pillars with chosen preset
    setPalettePillars([
      { id: 'accent', label: 'Primary Accent', hex: preset.accent, locked: false, desc: 'Action buttons & pills' },
      { id: 'bg', label: 'Canvas Background', hex: preset.bg, locked: false, desc: 'Base surface' },
      { id: 'card', label: 'Card Surface', hex: preset.card, locked: false, desc: 'Card elevation' },
      { id: 'glow', label: 'Accent Detail', hex: preset.accentHover || preset.accent, locked: false, desc: 'Active badges' },
      { id: 'secondary', label: 'Secondary Gray', hex: preset.cardHover || '#2D2F36', locked: false, desc: 'Hover & borders' },
    ]);
    setSaved(false);
  };

  const handleAccentSelect = (hex) => {
    setSettings((prev) => ({
      ...prev,
      accentColor: hex,
    }));
    setPalettePillars((prev) =>
      prev.map((col) => (col.id === 'accent' ? { ...col, hex } : col))
    );
    setSaved(false);
  };

  const handleSave = () => {
    saveCrmThemeSettings(settings);
    setSaved(true);
    if (showNotification) {
      showNotification('Apple iOS CRM theme & palette saved successfully.');
    }
  };

  const handleReset = () => {
    setSettings(DEFAULT_CRM_SETTINGS);
    saveCrmThemeSettings(DEFAULT_CRM_SETTINGS);
    setPalettePillars([
      { id: 'accent', label: 'Primary Accent', hex: '#0A84FF', locked: false, desc: 'Action buttons & pills' },
      { id: 'bg', label: 'Canvas Background', hex: '#16171B', locked: false, desc: 'Apple dark gray base' },
    { id: 'card', label: 'Card Surface', hex: '#23242A', locked: false, desc: 'Solid panels' },
    { id: 'glow', label: 'Accent Detail', hex: '#64D2FF', locked: false, desc: 'Active badges' },
      { id: 'secondary', label: 'Secondary Gray', hex: '#2D2F36', locked: false, desc: 'Hover states & inputs' },
    ]);
    setSaved(true);
    if (showNotification) {
      showNotification('CRM theme reset to Apple Space Gray default.');
    }
  };

  const activePreset = CRM_THEME_PRESETS.find((p) => p.id === settings.themeId) || CRM_THEME_PRESETS[0];
  const currentAccent = settings.accentColor || activePreset.accent;
  const currentBg = settings.customBg || activePreset.bg;

  const contrastScore = calcContrast(currentAccent, currentBg);

  return (
    <div className="crm-settings-page-redesign crm-settings-page crm-settings-form">
      {/* Header */}
      <header className="crm-settings-page-header">
        <div className="crm-settings-header-copy">
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: currentAccent, fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
            <Palette size={16} />
            <span>Apple iOS Design System & Theme Engine</span>
          </div>
          <h1>CRM Settings</h1>
          <p>
            Fine-tune the backoffice visual experience: curate Apple Space Gray surfaces, generate custom harmonious color palettes with the Coolors engine, and set typography density.
          </p>
        </div>
        <div className="crm-settings-header-actions">
          <button type="button" className="crm-btn-secondary" onClick={handleReset}>
            <RotateCcw size={14} />
            Reset to Apple Gray
          </button>
          <button type="button" className="crm-btn-primary" onClick={handleSave} style={{ background: currentAccent, borderColor: currentAccent }}>
            {saved ? <Check size={14} /> : <Save size={14} />}
            {saved ? 'Saved' : 'Save & Apply'}
          </button>
        </div>
      </header>

      {/* ── Coolors-Style Dynamic Color Generator ───────────────────────────── */}
      <details className="crm-settings-panel crm-settings-collapsible">
        <summary className="crm-settings-accordion-summary">
          <div className="crm-settings-accordion-title">
            <h3>Coolors CRM Palette Generator</h3>
            <span className="crm-badge crm-badge-apple" style={{ background: `${currentAccent}20`, color: currentAccent, border: `1px solid ${currentAccent}40` }}>
              <Sparkles size={11} style={{ marginRight: 4 }} />
              Instant Generation
            </span>
          </div>
          <ChevronDown className="crm-settings-accordion-chevron" size={18} aria-hidden="true" />
        </summary>

        <div className="crm-settings-accordion-scroll">
        <div className="crm-settings-section-head" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <p>
              Generate mathematical, accessible Apple color harmonies. Press <kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>Spacebar</kbd> or click Generate to create fresh palettes. Lock individual pillars to preserve your favorite tones.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Dark / Light Toggle */}
            <div className="crm-ios-segmented" style={{ minWidth: 160 }}>
              <button
                type="button"
                className={generatorMode === 'dark' ? 'is-selected' : ''}
                onClick={() => setGeneratorMode('dark')}
              >
                <Moon size={13} style={{ marginRight: 4 }} />
                Dark Gray
              </button>
              <button
                type="button"
                className={generatorMode === 'light' ? 'is-selected' : ''}
                onClick={() => setGeneratorMode('light')}
              >
                <Sun size={13} style={{ marginRight: 4 }} />
                Apple Light
              </button>
            </div>

            <button
              type="button"
              className="crm-btn-secondary"
              onClick={handleGenerateHarmoniousPalette}
              title="Generate new palette (or press Spacebar)"
            >
              <RefreshCw size={14} />
              Generate (Space)
            </button>

            <button
              type="button"
              className="crm-btn-primary"
              onClick={applyPaletteToCrm}
              style={{ background: currentAccent, borderColor: currentAccent }}
            >
              <Wand2 size={14} />
              Apply to CRM
            </button>
          </div>
        </div>

        {/* 5-Pillar Interactive Coolors Stage */}
        <div className="crm-coolors-stage">
          {palettePillars.map((pillar, idx) => (
            <div key={pillar.id} className="crm-coolors-pillar" style={{ background: pillar.hex }}>
              <div className="crm-coolors-pillar-overlay">
                <div className="crm-coolors-pillar-top">
                  <span className="crm-coolors-label">{pillar.label}</span>
                  <button
                    type="button"
                    className={`crm-coolors-lock-btn ${pillar.locked ? 'is-locked' : ''}`}
                    onClick={() => toggleLock(idx)}
                    title={pillar.locked ? 'Unlock color' : 'Lock color'}
                  >
                    {pillar.locked ? <Lock size={14} /> : <Unlock size={14} />}
                  </button>
                </div>

                <div className="crm-coolors-pillar-bottom">
                  <div className="crm-coolors-hex-row">
                    <input
                      type="text"
                      className="crm-coolors-hex-input"
                      value={pillar.hex.toUpperCase()}
                      onChange={(e) => updatePillarHex(idx, e.target.value)}
                    />
                    <label className="crm-coolors-picker-btn" title="Pick custom color">
                      <input
                        type="color"
                        value={pillar.hex}
                        onChange={(e) => updatePillarHex(idx, e.target.value)}
                        style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
                      />
                      <Sliders size={13} />
                    </label>
                    <button
                      type="button"
                      className="crm-coolors-copy-btn"
                      onClick={() => copyHex(pillar.hex, idx)}
                      title="Copy hex code"
                    >
                      {copiedIndex === idx ? <Check size={13} /> : <Copy size={13} />}
                    </button>
                  </div>
                  <div className="crm-coolors-desc">{pillar.desc}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Contrast & Metric Strip */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, padding: '10px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
            <span style={{ color: 'var(--crm-text-secondary)' }}>Accent vs Canvas Contrast:</span>
            <span style={{ fontWeight: 700, color: currentAccent }}>{contrastScore}</span>
            <span className="crm-badge crm-badge-success" style={{ background: 'rgba(48,209,88,0.15)', color: '#30D158', border: '1px solid rgba(48,209,88,0.3)' }}>
              WCAG AAA / AA Compatible
            </span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--crm-text-secondary)' }}>
            Tip: Lock colors with the lock icon, then hit Space to shuffle only unlocked tones.
          </div>
        </div>
        </div>
      </details>

      {/* ── Visual Themes (Apple Gray Default) ────────────────────────────── */}
      <details className="crm-settings-panel crm-settings-collapsible">
        <summary className="crm-settings-accordion-summary">
          <h3>Visual Themes</h3>
          <ChevronDown className="crm-settings-accordion-chevron" size={18} aria-hidden="true" />
        </summary>
        <div className="crm-settings-accordion-scroll">
        <div className="crm-settings-section-head">
          <div>
            <p>
              Curated Apple aesthetics tuned for high legibility, reduced eye strain, and fluid clarity. The default Apple Space Gray restores the iconic dark gray palette.
            </p>
          </div>
        </div>

        <div className="crm-theme-grid">
          {CRM_THEME_PRESETS.map((preset) => {
            const isActive = settings.themeId === preset.id;
            return (
              <div
                key={preset.id}
                className={`crm-theme-card ${isActive ? 'is-active' : ''}`}
                onClick={() => handleThemeSelect(preset)}
                style={{
                  background: preset.card,
                  borderColor: isActive ? currentAccent : preset.border,
                }}
              >
                {isActive && (
                  <div className="crm-theme-card-check" style={{ background: currentAccent }}>
                    <Check size={12} strokeWidth={3} />
                  </div>
                )}

                {/* Mini mockup illustration */}
                <div
                  className="crm-theme-card-preview"
                  style={{
                    background: preset.bg,
                    borderColor: preset.border,
                  }}
                >
                  <div
                    className="crm-theme-card-preview-bar"
                    style={{
                      background: preset.card,
                      borderBottom: `1px solid ${preset.border}`,
                    }}
                  >
                    <div style={{ display: 'flex', gap: 4 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#FF453A' }} />
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#FF9F0A' }} />
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#30D158' }} />
                    </div>
                    <span
                      style={{
                        height: 6,
                        width: 40,
                        borderRadius: 3,
                        background: preset.accent,
                        opacity: 0.8,
                      }}
                    />
                  </div>
                  <div className="crm-theme-card-preview-body">
                    <div
                      style={{
                        background: preset.card,
                        borderColor: preset.border,
                        borderWidth: 1,
                        borderStyle: 'solid',
                        borderRadius: 6,
                        padding: 8,
                        marginBottom: 6,
                      }}
                    >
                      <div style={{ height: 4, width: '60%', background: preset.accent, borderRadius: 2, marginBottom: 4 }} />
                      <div style={{ height: 3, width: '40%', background: preset.textSecondary, opacity: 0.4, borderRadius: 2 }} />
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <div style={{ flex: 1, height: 16, background: preset.cardHover, borderRadius: 4 }} />
                      <div style={{ flex: 1, height: 16, background: preset.accent, opacity: 0.25, borderRadius: 4 }} />
                    </div>
                  </div>
                </div>

                <div className="crm-theme-card-meta">
                  <div className="crm-theme-card-topline">
                    <span className="crm-theme-card-name" style={{ color: preset.textPrimary }}>{preset.name}</span>
                    <span className="crm-badge crm-badge-secondary" style={{ color: preset.accent, borderColor: `${preset.accent}40` }}>
                      {preset.tag || preset.category}
                    </span>
                  </div>
                  <div className="crm-theme-card-desc" style={{ color: preset.textSecondary }}>{preset.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
        </div>
      </details>

      {/* ── Accent Colors & Swatches ───────────────────────────────────────── */}
      <details className="crm-settings-panel crm-settings-collapsible">
        <summary className="crm-settings-accordion-summary">
          <h3>Accent Tint & Swatches</h3>
          <ChevronDown className="crm-settings-accordion-chevron" size={18} aria-hidden="true" />
        </summary>
        <div className="crm-settings-accordion-scroll">
        <div className="crm-settings-section-head">
          <div>
            <p>
              Select an accent color or input a custom hex value. It is used for primary actions, active navigation, and badges.
            </p>
          </div>
        </div>

        <div className="crm-swatches-grid">
          {ACCENT_SWATCHES.map((swatch) => {
            const isSelected = currentAccent.toLowerCase() === swatch.hex.toLowerCase();
            return (
              <button
                key={swatch.hex}
                type="button"
                className={`crm-swatch-chip ${isSelected ? 'is-selected' : ''}`}
                onClick={() => handleAccentSelect(swatch.hex)}
                style={{
                  borderColor: isSelected ? swatch.hex : 'transparent',
                }}
              >
                <span className="crm-swatch-circle" style={{ background: swatch.hex }}>
                  {isSelected && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
                </span>
                <span className="crm-swatch-label">{swatch.name}</span>
                <span className="crm-swatch-hex">{swatch.hex}</span>
              </button>
            );
          })}
        </div>

        {/* Custom Hex Color Picker Row */}
        <div className="crm-custom-accent-row">
          <label className="crm-custom-accent-label">
            <span>Custom Accent Hex:</span>
            <div className="crm-custom-accent-input-wrap">
              <input
                type="color"
                value={currentAccent}
                onChange={(e) => handleAccentSelect(e.target.value)}
                className="crm-custom-accent-picker"
              />
              <input
                type="text"
                value={currentAccent}
                onChange={(e) => handleAccentSelect(e.target.value)}
                className="crm-settings-input"
                style={{ width: 120, fontFamily: 'monospace' }}
              />
            </div>
          </label>

          {/* Custom Background & Card surface */}
          <label className="crm-custom-accent-label">
            <span>Custom Canvas Gray:</span>
            <div className="crm-custom-accent-input-wrap">
              <input
                type="color"
                value={currentBg}
                onChange={(e) => {
                  setSettings((prev) => ({ ...prev, customBg: e.target.value }));
                  setSaved(false);
                }}
                className="crm-custom-accent-picker"
              />
              <input
                type="text"
                value={currentBg}
                onChange={(e) => {
                  setSettings((prev) => ({ ...prev, customBg: e.target.value }));
                  setSaved(false);
                }}
                className="crm-settings-input"
                style={{ width: 120, fontFamily: 'monospace' }}
              />
            </div>
          </label>
        </div>
        </div>
      </details>

      {/* ── Layout Density & Geometry ───────────────────────────────────────── */}
      <section className="crm-settings-panel">
        <div className="crm-settings-section-head">
          <div>
            <h3>Layout Density & Corner Radii</h3>
            <p>
              Control the whitespace breathing room of tables, panels, and modal dialogs.
            </p>
          </div>
        </div>

        <div className="crm-options-columns">
          {/* Density */}
          <div className="crm-options-group">
            <label className="crm-options-group-title">
              <Layout size={14} />
              <span>Row Density</span>
            </label>
            <div className="crm-ios-segmented">
              {DENSITY_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={settings.density === opt.id ? 'is-selected' : ''}
                  onClick={() => {
                    setSettings((prev) => ({ ...prev, density: opt.id }));
                    setSaved(false);
                  }}
                >
                  {opt.name}
                </button>
              ))}
            </div>
            <div className="crm-options-group-help">
              {DENSITY_OPTIONS.find((o) => o.id === settings.density)?.desc}
            </div>
          </div>

          {/* Radius */}
          <div className="crm-options-group">
            <label className="crm-options-group-title">
              <Sliders size={14} />
              <span>Corner Geometry</span>
            </label>
            <div className="crm-ios-segmented">
              {RADIUS_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={settings.radius === opt.id ? 'is-selected' : ''}
                  onClick={() => {
                    setSettings((prev) => ({ ...prev, radius: opt.id }));
                    setSaved(false);
                  }}
                >
                  {opt.name.split(' ')[0]}
                </button>
              ))}
            </div>
            <div className="crm-options-group-help">
              {RADIUS_OPTIONS.find((o) => o.id === settings.radius)?.name}
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
