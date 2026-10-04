import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from "react";
import { DEFAULT_SITE_CONFIG, type SiteConfig, type SocialContact, type AddressItem } from "@/types/site-editor";

interface SiteConfigContextType {
  config: SiteConfig;
  isLoading: boolean;
  refetch: () => Promise<void>;
  updateLocalConfig: (updated: SiteConfig) => void;
  primaryPhone?: SocialContact;
  primaryWhatsApp?: SocialContact;
  primaryTelegram?: SocialContact;
  primaryViber?: SocialContact;
  primaryEmail?: SocialContact;
  primaryAddress?: AddressItem;
  socialsGrouped: {
    whatsapp: SocialContact[];
    telegram: SocialContact[];
    viber: SocialContact[];
    phone: SocialContact[];
    email: SocialContact[];
    instagram: SocialContact[];
    facebook: SocialContact[];
    linkedin: SocialContact[];
    twitter: SocialContact[];
    github: SocialContact[];
    custom: SocialContact[];
  };
  addresses: AddressItem[];
}

function safeMergeConfig(base: SiteConfig, override: Partial<SiteConfig>): SiteConfig {
  if (!override || typeof override !== "object") return base;
  return {
    ...base,
    ...override,
    colors: { ...base.colors, ...(override.colors || {}) },
    hero: { ...base.hero, ...(override.hero || {}) },
    highlights: { ...base.highlights, ...(override.highlights || {}) },
    services: {
      ...base.services,
      ...(override.services || {}),
      items: Array.isArray(override.services?.items) && override.services.items.length > 0
        ? override.services.items.map((it) => {
            const def = base.services?.items?.find((d) => d.id === it.id) || {};
            return { ...def, ...it };
          })
        : (base.services?.items || []),
    },
    about: { ...base.about, ...(override.about || {}) },
    studio: { ...base.studio, ...(override.studio || {}) },
    results: { ...base.results, ...(override.results || {}) },
    contact: { ...base.contact, ...(override.contact || {}) },
    footer: { ...base.footer, ...(override.footer || {}) },
    theme: {
      ...base.theme,
      ...(override.theme || {}),
      layout: {
        ...base.theme?.layout,
        ...(override.theme?.layout || {}),
        sectionVisibility:
          override.theme?.layout?.sectionVisibility ||
          override.theme?.sectionsVisibility ||
          (override.theme as any)?.sectionVisibility ||
          base.theme?.layout?.sectionVisibility,
        sectionsOrder:
          override.theme?.layout?.sectionsOrder ||
          override.theme?.sectionsOrder ||
          base.theme?.layout?.sectionsOrder,
      },
      sectionsOrder:
        override.theme?.sectionsOrder ||
        override.theme?.layout?.sectionsOrder ||
        base.theme?.sectionsOrder,
      sectionsVisibility:
        override.theme?.sectionsVisibility ||
        override.theme?.layout?.sectionVisibility ||
        base.theme?.sectionsVisibility,
    } as any,
    tidio: { ...base.tidio, ...(override.tidio || {}) } as any,
    headerSocials: {
      ...base.headerSocials,
      ...(override.headerSocials || {}),
      linkedin: { ...base.headerSocials?.linkedin, ...(override.headerSocials?.linkedin || {}) },
      x: { ...base.headerSocials?.x, ...(override.headerSocials?.x || {}) },
      github: { ...base.headerSocials?.github, ...(override.headerSocials?.github || {}) },
      instagram: { ...base.headerSocials?.instagram, ...(override.headerSocials?.instagram || {}) },
      facebook: { ...base.headerSocials?.facebook, ...(override.headerSocials?.facebook || {}) },
    } as any,
    socialContacts: Array.isArray(override.socialContacts) && override.socialContacts.length > 0
      ? override.socialContacts
      : (base.socialContacts || []),
    addresses: Array.isArray(override.addresses) && override.addresses.length > 0
      ? override.addresses
      : (base.addresses || []),
    branding: { ...base.branding, ...(override.branding || {}) },
    banner: { ...base.banner, ...(override.banner || {}) } as any,
    whatsapp: { ...base.whatsapp, ...(override.whatsapp || {}) } as any,
    contactForm: { ...base.contactForm, ...(override.contactForm || {}) },
    seo: { ...base.seo, ...(override.seo || {}) } as any,
    emergency: {
      ...base.emergency,
      ...(override.emergency || {}),
      subtext: (override.emergency?.subtext || override.emergency?.message || base.emergency?.subtext || "") as string,
      message: (override.emergency?.message || override.emergency?.subtext || base.emergency?.message || "") as string,
      estimatedLaunch: override.emergency?.estimatedLaunch || override.emergency?.estimatedReturn || base.emergency?.estimatedLaunch,
      estimatedReturn: override.emergency?.estimatedReturn || override.emergency?.estimatedLaunch || base.emergency?.estimatedReturn,
    } as any,
    codeInjection: { ...base.codeInjection, ...(override.codeInjection || {}) },
    snapshots: Array.isArray(override.snapshots) ? override.snapshots : (base.snapshots || []),
  } as SiteConfig;
}

const SiteConfigContext = createContext<SiteConfigContextType | null>(null);

export function SiteConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<SiteConfig>(DEFAULT_SITE_CONFIG);
  const [isLoading, setIsLoading] = useState(false);

  const fetchConfig = useCallback(async () => {
    try {
      setIsLoading(true);
      if (typeof window !== "undefined") {
        const isPreview =
          window.self !== window.top ||
          window.location.search.includes("preview=1") ||
          sessionStorage.getItem("codex_is_preview") === "true";

        const liveRaw = isPreview
          ? sessionStorage.getItem("codex_live_preview_config") ||
            localStorage.getItem("codex_live_preview_config")
          : null;

        if (!liveRaw) {
          const response = await fetch("/api/crm/settings", {
            headers: { Accept: "application/json" },
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok || data?.ok === false) {
            throw new Error(data?.error || `Site settings request failed (${response.status}).`);
          }
          if (data.site_config) {
            setConfig((prev) => safeMergeConfig(prev || DEFAULT_SITE_CONFIG, data.site_config));
            localStorage.setItem("codex_site_config", JSON.stringify(data.site_config));
          } else {
            setConfig(DEFAULT_SITE_CONFIG);
          }
          return;
        }

        const raw = liveRaw || localStorage.getItem("codex_site_config");
        if (raw) {
          const parsed = JSON.parse(raw);
          setConfig((prev) => safeMergeConfig(prev || DEFAULT_SITE_CONFIG, parsed));
        }
      }
    } catch {
      // Keep DEFAULT_SITE_CONFIG as fallback
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();

    const handleMessage = (e: MessageEvent) => {
      if (e.data && e.data.type === "CODEX_PREVIEW_UPDATE" && e.data.config) {
        setConfig((prev) => safeMergeConfig(prev || DEFAULT_SITE_CONFIG, e.data.config));
      }
      if (e.data && e.data.type === "CODEX_PREVIEW_SCROLL_TO" && e.data.sectionId) {
        const targetId = e.data.sectionId;
        const el =
          document.getElementById(targetId) ||
          document.querySelector(`[data-section-id="${targetId}"]`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
          el.classList.add("ring-2", "ring-amber-400", "ring-offset-4", "ring-offset-black");
          setTimeout(() => {
            el.classList.remove("ring-2", "ring-amber-400", "ring-offset-4", "ring-offset-black");
          }, 2400);
        }
      }
    };

    const handleConfigUpdate = (e: Event) => {
      const config = (e as CustomEvent).detail;
      if (config?.reset === true) {
        setConfig(DEFAULT_SITE_CONFIG);
        return;
      }
      if (config && typeof config === "object") {
        setConfig((prev) => safeMergeConfig(prev || DEFAULT_SITE_CONFIG, config));
      }
    };

    window.addEventListener("message", handleMessage);
    window.addEventListener("codex_config_updated", handleConfigUpdate);

    if (typeof window !== "undefined" && window.self !== window.top) {
      window.parent.postMessage({ type: "CODEX_PREVIEW_READY" }, "*");
    }

    return () => {
      window.removeEventListener("message", handleMessage);
      window.removeEventListener("codex_config_updated", handleConfigUpdate);
    };
  }, [fetchConfig]);

  const updateLocalConfig = useCallback((updated: SiteConfig) => {
    setConfig(safeMergeConfig(DEFAULT_SITE_CONFIG, updated));
  }, []);

  const contacts = Array.isArray(config?.socialContacts) ? config.socialContacts : DEFAULT_SITE_CONFIG.socialContacts;
  const addressList = Array.isArray(config?.addresses) ? config.addresses : DEFAULT_SITE_CONFIG.addresses;

  const primaryPhone = useMemo(() => {
    return (
      contacts.find((c) => c.type === "phone" && c.isPrimary) ||
      contacts.find((c) => c.type === "phone")
    );
  }, [contacts]);

  const primaryWhatsApp = useMemo(() => {
    return (
      contacts.find((c) => c.type === "whatsapp" && c.isPrimary) ||
      contacts.find((c) => c.type === "whatsapp")
    );
  }, [contacts]);

  const primaryTelegram = useMemo(() => {
    return (
      contacts.find((c) => c.type === "telegram" && c.isPrimary) ||
      contacts.find((c) => c.type === "telegram")
    );
  }, [contacts]);

  const primaryViber = useMemo(() => {
    return (
      contacts.find((c) => c.type === "viber" && c.isPrimary) ||
      contacts.find((c) => c.type === "viber")
    );
  }, [contacts]);

  const primaryEmail = useMemo(() => {
    return (
      contacts.find((c) => c.type === "email" && c.isPrimary) ||
      contacts.find((c) => c.type === "email")
    );
  }, [contacts]);

  const primaryAddress = useMemo(() => {
    return (
      addressList.find((a) => a.isPrimary) ||
      addressList[0]
    );
  }, [addressList]);

  const socialsGrouped = useMemo(() => {
    const grouped = {
      whatsapp: [] as SocialContact[],
      telegram: [] as SocialContact[],
      viber: [] as SocialContact[],
      phone: [] as SocialContact[],
      email: [] as SocialContact[],
      instagram: [] as SocialContact[],
      facebook: [] as SocialContact[],
      linkedin: [] as SocialContact[],
      twitter: [] as SocialContact[],
      github: [] as SocialContact[],
      custom: [] as SocialContact[],
    };

    for (const item of contacts) {
      if (item.type in grouped) {
        grouped[item.type as keyof typeof grouped].push(item);
      } else {
        grouped.custom.push(item);
      }
    }

    return grouped;
  }, [contacts]);

  const value = useMemo<SiteConfigContextType>(
    () => ({
      config,
      isLoading,
      refetch: fetchConfig,
      updateLocalConfig,
      primaryPhone,
      primaryWhatsApp,
      primaryTelegram,
      primaryViber,
      primaryEmail,
      primaryAddress,
      socialsGrouped,
      addresses: addressList,
    }),
    [
      config,
      isLoading,
      fetchConfig,
      updateLocalConfig,
      primaryPhone,
      primaryWhatsApp,
      primaryTelegram,
      primaryViber,
      primaryEmail,
      primaryAddress,
      socialsGrouped,
      addressList,
    ]
  );

  return <SiteConfigContext.Provider value={value}>{children}</SiteConfigContext.Provider>;
}

function deriveFromConfig(config: SiteConfig) {
  const safeConfig = safeMergeConfig(DEFAULT_SITE_CONFIG, config || {});
  const contacts = Array.isArray(safeConfig.socialContacts) ? safeConfig.socialContacts : [];
  const addresses = Array.isArray(safeConfig.addresses) ? safeConfig.addresses : [];

  const pick = (type: SocialContact["type"]) =>
    contacts.find((c) => c.type === type && c.isPrimary) ||
    contacts.find((c) => c.type === type);

  const grouped = {
    whatsapp: [] as SocialContact[],
    telegram: [] as SocialContact[],
    viber: [] as SocialContact[],
    phone: [] as SocialContact[],
    email: [] as SocialContact[],
    instagram: [] as SocialContact[],
    facebook: [] as SocialContact[],
    linkedin: [] as SocialContact[],
    twitter: [] as SocialContact[],
    github: [] as SocialContact[],
    custom: [] as SocialContact[],
  };
  for (const item of contacts) {
    if (item.type in grouped) grouped[item.type as keyof typeof grouped].push(item);
    else grouped.custom.push(item);
  }

  return {
    primaryPhone: pick("phone"),
    primaryWhatsApp: pick("whatsapp"),
    primaryTelegram: pick("telegram"),
    primaryViber: pick("viber"),
    primaryEmail: pick("email"),
    primaryAddress: addresses.find((a) => a.isPrimary) || addresses[0],
    socialsGrouped: grouped,
    addresses: addresses,
  };
}

export function SiteConfigOverrideProvider({
  config,
  children,
}: {
  config: SiteConfig;
  children: React.ReactNode;
}) {
  const derived = useMemo(() => deriveFromConfig(config), [config]);
  const value = useMemo<SiteConfigContextType>(
    () => ({
      config,
      isLoading: false,
      refetch: async () => {},
      updateLocalConfig: () => {},
      ...derived,
    }),
    [config, derived],
  );
  return <SiteConfigContext.Provider value={value}>{children}</SiteConfigContext.Provider>;
}

export function useSiteConfig() {
  const ctx = useContext(SiteConfigContext);
  if (!ctx) {
    return {
      config: DEFAULT_SITE_CONFIG,
      isLoading: false,
      refetch: async () => {},
      updateLocalConfig: () => {},
      primaryPhone: DEFAULT_SITE_CONFIG.socialContacts.find((c) => c.type === "phone"),
      primaryWhatsApp: DEFAULT_SITE_CONFIG.socialContacts.find((c) => c.type === "whatsapp"),
      primaryTelegram: DEFAULT_SITE_CONFIG.socialContacts.find((c) => c.type === "telegram"),
      primaryViber: DEFAULT_SITE_CONFIG.socialContacts.find((c) => c.type === "viber"),
      primaryEmail: DEFAULT_SITE_CONFIG.socialContacts.find((c) => c.type === "email"),
      primaryAddress: DEFAULT_SITE_CONFIG.addresses[0],
      socialsGrouped: {
        whatsapp: DEFAULT_SITE_CONFIG.socialContacts.filter((c) => c.type === "whatsapp"),
        telegram: DEFAULT_SITE_CONFIG.socialContacts.filter((c) => c.type === "telegram"),
        viber: DEFAULT_SITE_CONFIG.socialContacts.filter((c) => c.type === "viber"),
        phone: DEFAULT_SITE_CONFIG.socialContacts.filter((c) => c.type === "phone"),
        email: DEFAULT_SITE_CONFIG.socialContacts.filter((c) => c.type === "email"),
        instagram: DEFAULT_SITE_CONFIG.socialContacts.filter((c) => c.type === "instagram"),
        facebook: DEFAULT_SITE_CONFIG.socialContacts.filter((c) => c.type === "facebook"),
        linkedin: DEFAULT_SITE_CONFIG.socialContacts.filter((c) => c.type === "linkedin"),
        twitter: DEFAULT_SITE_CONFIG.socialContacts.filter((c) => c.type === "twitter"),
        github: DEFAULT_SITE_CONFIG.socialContacts.filter((c) => c.type === "github"),
        custom: [],
      },
      addresses: DEFAULT_SITE_CONFIG.addresses,
    };
  }
  return ctx;
}
