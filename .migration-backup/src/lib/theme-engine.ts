import type { CSSProperties } from "react";
import type { SiteColors, SiteConfig, ThemeSettings } from "@/types/site-editor";

export const DEFAULT_THEME_ID = "codex-pro";

export const DEFAULT_HOME_SEQUENCE = [
  "hero",
  "highlights",
  "services",
  "portfolio",
  "results",
  "about",
  "blog",
  "reviews",
  "contact",
] as const;

export const THEME_COMPONENT_IDS = [
  "header-builder",
  "hero-clip",
  "bento-highlights",
  "portfolio-showcase",
  "results-counter",
  "reviews-slider",
  "services-carousel",
  "gutenberg-blocks",
  "footer-widgets",
  "sticky-contact-dock",
  "tidio-chat-widget",
] as const;

export type ThemeComponentId = (typeof THEME_COMPONENT_IDS)[number];

export const DEFAULT_ENABLED_COMPONENTS: string[] = [
  "header-builder",
  "hero-clip",
  "bento-highlights",
  "portfolio-showcase",
  "results-counter",
  "reviews-slider",
  "services-carousel",
  "gutenberg-blocks",
  "footer-widgets",
  "sticky-contact-dock",
];

const CAMEL_TO_KEBAB: Record<string, string> = {
  headerBuilder: "header-builder",
  gutenbergBlocks: "gutenberg-blocks",
  footerWidgets: "footer-widgets",
  stickyContactDock: "sticky-contact-dock",
  videoHero: "hero-clip",
  highlightsBento: "bento-highlights",
  portfolioShowcase: "portfolio-showcase",
  resultsCounter: "results-counter",
  reviewsSlider: "reviews-slider",
  tidioChat: "tidio-chat-widget",
  megaMenu: "header-builder",
  mobileDrawer: "header-builder",
};

export type PreviewPage = "home" | "work" | "services" | "studio" | "blog" | "contact";

export function isDefaultThemeId(id?: string | null) {
  return !id || id === DEFAULT_THEME_ID;
}

export function isDarkHex(hex?: string): boolean {
  if (!hex || typeof hex !== "string") return false;
  const clean = hex.replace("#", "").trim();
  if (clean.length !== 3 && clean.length !== 6) return false;
  const r = parseInt(clean.length === 3 ? clean[0] + clean[0] : clean.substring(0, 2), 16);
  const g = parseInt(clean.length === 3 ? clean[1] + clean[1] : clean.substring(2, 4), 16);
  const b = parseInt(clean.length === 3 ? clean[2] + clean[2] : clean.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return false;
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq < 135;
}

export function normalizeComponentIds(active: ThemeSettings["activeComponents"] | undefined): string[] {
  if (!active) return [...DEFAULT_ENABLED_COMPONENTS];
  if (Array.isArray(active)) {
    return active.filter((id) => typeof id === "string");
  }
  if (typeof active === "object") {
    const ids: string[] = [];
    const seen = new Set<string>();
    for (const [key, value] of Object.entries(active)) {
      const id = CAMEL_TO_KEBAB[key] || key;
      seen.add(id);
      if (value) ids.push(id);
    }
    for (const id of DEFAULT_ENABLED_COMPONENTS) {
      if (!seen.has(id)) ids.push(id);
    }
    return ids.length ? ids : [...DEFAULT_ENABLED_COMPONENTS];
  }
  return [...DEFAULT_ENABLED_COMPONENTS];
}

export function isComponentEnabled(config: SiteConfig, id: string) {
  return normalizeComponentIds(config.theme?.activeComponents).includes(id);
}

export function resolveFontPair(font?: string): { display: string; sans: string } {
  switch (font) {
    case "playfair":
      return {
        display: "'Playfair Display', Georgia, serif",
        sans: "'Inter', system-ui, sans-serif",
      };
    case "syne":
      return {
        display: "'Syne', sans-serif",
        sans: "'Space Grotesk', system-ui, sans-serif",
      };
    case "inter":
      return {
        display: "'Plus Jakarta Sans', 'Inter', sans-serif",
        sans: "'Plus Jakarta Sans', 'Inter', sans-serif",
      };
    case "newsreader":
      return {
        display: "'Newsreader', Georgia, serif",
        sans: "'Inter', system-ui, sans-serif",
      };
    default:
      return {
        display: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif",
        sans: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', sans-serif",
      };
  }
}

export function radiusTokens(br?: string) {
  switch (br) {
    case "sharp":
      return { sm: "0px", md: "2px", lg: "4px", xl: "6px", xxl: "8px" };
    case "clean":
      return { sm: "4px", md: "8px", lg: "12px", xl: "16px", xxl: "20px" };
    case "pill":
      return { sm: "9999px", md: "9999px", lg: "24px", xl: "36px", xxl: "48px" };
    case "modern":
    default:
      return { sm: "8px", md: "12px", lg: "18px", xl: "28px", xxl: "36px" };
  }
}

export function typeScalePx(scale?: string) {
  switch (scale) {
    case "compact":
      return 15;
    case "spacious":
      return 17;
    case "editorial":
    case "large":
      return 18;
    case "normal":
    case "standard":
    default:
      return 16;
  }
}

export function isCanonicalDefaultLayout(theme?: ThemeSettings) {
  if (!theme) return true;
  if (!isDefaultThemeId(theme.activeTheme)) return false;
  const order = theme.layout?.sectionsOrder || theme.sectionsOrder;
  if (order && order.join() !== DEFAULT_HOME_SEQUENCE.join()) return false;
  const hero = theme.heroLayout || theme.layout?.heroLayout;
  if (hero && hero !== "streamer") return false;
  const header = theme.headerStyle;
  if (header && header !== "floating") return false;
  return true;
}

export function resolveSectionsOrder(theme?: ThemeSettings): string[] {
  const order = theme?.layout?.sectionsOrder || theme?.sectionsOrder;
  if (order && order.length) return order;
  return [...DEFAULT_HOME_SEQUENCE];
}

export function resolveSectionVisibility(theme?: ThemeSettings): Record<string, boolean> {
  const vis =
    theme?.layout?.sectionVisibility ||
    (theme as any)?.sectionsVisibility ||
    (theme as any)?.sectionVisibility;
  if (vis) return vis;
  return Object.fromEntries(DEFAULT_HOME_SEQUENCE.map((id) => [id, true]));
}

export function buildThemeStyle(config: SiteConfig): CSSProperties {
  const c = config.colors || ({} as SiteColors);
  const t = config.theme;
  const isDark = isDarkHex(c.background);
  const fonts = resolveFontPair(t?.fontFamily);
  const radius = radiusTokens(t?.borderRadius);
  const scale = t?.fontSizeScale || t?.layout?.fontSizeScale;
  const leading = t?.lineHeight;
  const cw = t?.containerWidth || "1280px";
  const primaryFg = "#ffffff";

  // Strict contrast resolution:
  // If background is dark, text MUST be light. If background is light, text MUST be dark.
  const hasDarkTextMain = c.textMain ? isDarkHex(c.textMain) : false;
  const textMain = isDark
    ? (hasDarkTextMain || !c.textMain ? "#eaecef" : c.textMain)
    : (!hasDarkTextMain || !c.textMain ? "#1d1d1f" : c.textMain);

  const textMuted = isDark ? "#848e9c" : "#6e6e73";
  const border = isDark ? "#363b44" : "#d2d2d7";
  const hairline = isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.08)";
  const hairlineOnDark = "rgba(255, 255, 255, 0.16)";
  const cardBg = isDark
    ? (c.cardBg && isDarkHex(c.cardBg) ? c.cardBg : "#181a20")
    : (c.cardBg && !isDarkHex(c.cardBg) ? c.cardBg : "#ffffff");
  const bg = isDark
    ? (c.background && isDarkHex(c.background) ? c.background : "#0f1216")
    : (c.background && !isDarkHex(c.background) ? c.background : "#f5f5f7");
  const fill = isDark ? "#14171a" : "#f2f2f7";
  const fillElevated = isDark ? "#1e2329" : "#fafafc";
  const mutedBg = isDark ? "#232830" : "#e8e8ed";

  const style: Record<string, string> = {
    "--color-primary": c.primary || (isDark ? "#f0b90b" : "#0071e3"),
    "--color-primary-foreground": primaryFg,
    "--color-blue": c.primary || "#0071e3",
    "--color-blue-hover": c.highlight || c.accent || c.primary || "#0077ed",
    "--color-brand": c.primary || (isDark ? "#f0b90b" : "#0071e3"),
    "--color-ring": c.ring || c.primary || "#0071e3",
    "--color-accent": c.accent || c.primary || "#0071e3",
    "--color-accent-foreground": primaryFg,
    "--color-background": bg,
    "--color-site-bg": bg,
    "--color-fill": c.secondary || fill,
    "--color-fill-elevated": c.surface || fillElevated,
    "--color-secondary": c.secondary || fill,
    "--color-card": cardBg,
    "--color-site-card": cardBg,
    "--color-paper": "#ffffff",
    "--color-ink": "#000000",
    "--color-surface": c.surface || cardBg,
    "--color-foreground": textMain,
    "--color-label": textMain,
    "--color-card-foreground": textMain,
    "--color-popover": cardBg,
    "--color-popover-foreground": textMain,
    "--color-muted": mutedBg,
    "--color-muted-foreground": textMuted,
    "--color-subtle": textMuted,
    "--color-border": border,
    "--color-input": isDark ? "#23272e" : "#e8e8ed",
    "--color-hairline": hairline,
    "--color-hairline-on-dark": hairlineOnDark,
    "--color-highlight": c.highlight || c.accent || c.primary || "#0071e3",
    "--color-inverse": isDark ? "#ffffff" : "#1d1d1f",
    "--font-display": fonts.display,
    "--font-sans": fonts.sans,
    "--radius-sm": radius.sm,
    "--radius-md": radius.md,
    "--radius-lg": radius.lg,
    "--radius-xl": radius.xl,
    "--radius-2xl": radius.xxl,
    "--container-max": cw === "full" ? "100%" : cw,
    fontFamily: fonts.sans,
  };

  if (scale && scale !== "normal" && scale !== "standard") {
    style["font-size"] = `${typeScalePx(scale)}px`;
  }
  if (typeof leading === "number" && leading > 0) {
    style["--body-leading"] = String(leading);
    style["line-height"] = String(leading);
  }

  return style as CSSProperties;
}

export function hrefToPreviewPage(href: string): PreviewPage {
  if (href.includes("work") || href.includes("portfolio") || href.includes("project")) return "work";
  if (href.includes("capabilities") || href.includes("services")) return "services";
  if (href.includes("studio") || href.includes("process") || href.includes("about")) return "studio";
  if (href.includes("insights") || href.includes("blog")) return "blog";
  if (href.includes("contact")) return "contact";
  return "home";
}

export async function persistSiteConfig(config: SiteConfig) {
  const res = await fetch("/api/crm/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "save_site_content",
      payload: { config },
    }),
  });
  if (!res.ok) {
    throw new Error(`Could not save site config (${res.status})`);
  }
  return res.json().catch(() => ({}));
}
