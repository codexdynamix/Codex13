import { AnimatePresence, motion } from "framer-motion";
import { Menu, X, Lock } from "lucide-react";
import { useEffect, useState, type MouseEvent } from "react";
import {
  FacebookLogo,
  GitHubLogo,
  InstagramLogo,
  LinkedInLogo,
  PhoneLogo,
  TelegramLogo,
  TwitterXLogo,
  ViberLogo,
  WhatsAppLogo,
} from "@/components/BrandMarks";
import { NAV_LINKS } from "@/lib/nav";
import { CONTACT, LINKS } from "@/lib/site";
import { cn } from "@/lib/utils";
import { useSiteConfig } from "@/context/SiteConfigContext";
import { useContactModal } from "@/context/ContactModalContext";
import { usePreviewMode } from "@/context/PreviewModeContext";
import { hrefToPreviewPage } from "@/lib/theme-engine";
import { useLoginView } from "@/context/LoginViewContext";
import { readPortalSession, type PortalSession } from "@/services/portalAuth";
import { useTheme } from "@/context/ThemeContext";

function Mark({ letter, logoUrl }: { letter?: string; logoUrl?: string }) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt="Logo"
        className="size-7 object-contain rounded-[6px]"
      />
    );
  }
  return (
    <span
      className="relative flex size-7 shrink-0 items-center justify-center rounded-[8px] bg-blue text-white shadow-[inset_0_0.5px_0_rgb(255_255_255_/_0.35)]"
      aria-hidden="true"
    >
      <span className="text-[13px] leading-none font-semibold tracking-tight">
        {letter || "C"}
      </span>
    </span>
  );
}

function HeaderSocials({
  headerSocials,
  fallbackSocials,
  isDarkPill,
}: {
  headerSocials?: any;
  fallbackSocials?: {
    instagram?: string;
    facebook?: string;
    linkedin?: string;
    twitter?: string;
    github?: string;
  };
  isDarkPill?: boolean;
}) {
  const items = [
    {
      key: "linkedin",
      enabled: headerSocials?.linkedin !== undefined ? Boolean(headerSocials.linkedin.enabled) : true,
      url: headerSocials?.linkedin?.url || fallbackSocials?.linkedin || LINKS.linkedin,
      label: "LinkedIn",
      logo: LinkedInLogo,
    },
    {
      key: "x",
      enabled: headerSocials?.x !== undefined ? Boolean(headerSocials.x.enabled) : true,
      url: headerSocials?.x?.url || fallbackSocials?.twitter || LINKS.twitter,
      label: "Twitter / X",
      logo: TwitterXLogo,
    },
    {
      key: "github",
      enabled: headerSocials?.github !== undefined ? Boolean(headerSocials.github.enabled) : true,
      url: headerSocials?.github?.url || fallbackSocials?.github || LINKS.github,
      label: "GitHub",
      logo: GitHubLogo,
    },
    {
      key: "instagram",
      enabled: headerSocials?.instagram !== undefined ? Boolean(headerSocials.instagram.enabled) : true,
      url: headerSocials?.instagram?.url || fallbackSocials?.instagram || LINKS.instagram,
      label: "Instagram",
      logo: InstagramLogo,
    },
    {
      key: "facebook",
      enabled: headerSocials?.facebook !== undefined ? Boolean(headerSocials.facebook.enabled) : true,
      url: headerSocials?.facebook?.url || fallbackSocials?.facebook || LINKS.facebook,
      label: "Facebook",
      logo: FacebookLogo,
    },
  ];

  const activeItems = items.filter((item) => item.enabled && item.url);
  if (activeItems.length === 0) return null;

  return (
    <div className="flex items-center gap-0.5 sm:gap-1">
      {activeItems.map((item) => {
        const Icon = item.logo;
        return (
          <a
            key={item.key}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={item.label}
            className={cn(
              "size-7 rounded-full transition-all flex items-center justify-center cursor-pointer",
              isDarkPill
                ? "text-white/70 hover:text-white hover:bg-white/10"
                : "text-[#111113]/70 hover:text-[#111113] hover:bg-black/5"
            )}
          >
            <Icon className="size-4" />
          </a>
        );
      })}
    </div>
  );
}

export function Nav() {
  const { config, socialsGrouped, primaryPhone, primaryWhatsApp, primaryTelegram, primaryViber } =
    useSiteConfig();
  const { isDark } = useTheme();

  const brandName = config.siteName || "Codex Dynamics";
  const brandInitial = brandName.trim().charAt(0).toUpperCase() || "C";

  const instagramHref = config.headerSocials?.instagram?.url || socialsGrouped.instagram?.[0]?.href || LINKS.instagram;
  const facebookHref = config.headerSocials?.facebook?.url || socialsGrouped.facebook?.[0]?.href || LINKS.facebook;
  const linkedinHref = config.headerSocials?.linkedin?.url || socialsGrouped.linkedin?.[0]?.href || LINKS.linkedin;
  const twitterHref = config.headerSocials?.x?.url || socialsGrouped.twitter?.[0]?.href || LINKS.twitter;
  const githubHref = config.headerSocials?.github?.url || socialsGrouped.github?.[0]?.href || LINKS.github;

  const whatsappHref = config.whatsapp?.phone
    ? `https://wa.me/${config.whatsapp.phone.replace(/[^0-9]/g, "")}`
    : primaryWhatsApp?.href || socialsGrouped.whatsapp?.[0]?.href || LINKS.whatsapp;
  const telegramHref = primaryTelegram?.href || socialsGrouped.telegram?.[0]?.href || LINKS.telegram;
  const viberHref = primaryViber?.href || socialsGrouped.viber?.[0]?.href || LINKS.viber;
  const phoneHref = primaryPhone?.href || socialsGrouped.phone?.[0]?.href || LINKS.tel;

  const { openContactModal } = useContactModal();
  const preview = usePreviewMode();

  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [overHero, setOverHero] = useState(true);

  const { openLogin } = useLoginView();
  const [portalSession, setPortalSessionState] = useState<PortalSession | null>(() => readPortalSession());

  useEffect(() => {
    const handleAuth = () => setPortalSessionState(readPortalSession());
    const handleOpenLogin = () => openLogin();
    window.addEventListener("cdx_portal_auth_changed", handleAuth);
    window.addEventListener("cdx_open_login_modal", handleOpenLogin);
    return () => {
      window.removeEventListener("cdx_portal_auth_changed", handleAuth);
      window.removeEventListener("cdx_open_login_modal", handleOpenLogin);
    };
  }, [openLogin]);

  const onNavHref = (href: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (preview.isPreview && preview.navigateTo) {
      e.preventDefault();
      preview.navigateTo(hrefToPreviewPage(href));
      setOpen(false);
      return;
    }

    if (href.startsWith("#")) {
      e.preventDefault();
      const targetId = href.slice(1);
      const el = document.getElementById(targetId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
      }
      if (window.location.hash) {
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      }
      setOpen(false);
    }
  };

  const pin = preview.isPreview ? "absolute" : "fixed";

  useEffect(() => {
    const onScroll = () => {
      const hero = document.getElementById("hero");
      const heroBottom = hero ? hero.getBoundingClientRect().bottom : 320;
      setOverHero(heroBottom > 75);
      setScrolled(window.scrollY > 12);

      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      setProgress(max > 0 ? doc.scrollTop / max : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // High contrast assurance:
  // Over the dark hero video, or in dark theme, or when mobile menu is open: dark pill with pure white text
  // When scrolled down onto a light theme page: light pill with pure dark text
  const isDarkPill = isDark || overHero || open;

  return (
    <header className={cn("pointer-events-none inset-x-0 top-0 z-50 pt-[max(0.6rem,env(safe-area-inset-top))]", pin)}>
      <div className="flex justify-center px-3 sm:px-5 xl:px-8">
        <nav
          className={cn(
            "pointer-events-auto relative z-50 flex h-12 sm:h-13 w-full max-w-[72rem] items-center justify-between px-3 sm:px-4 rounded-full transition-all duration-300 backdrop-blur-2xl",
            isDarkPill
              ? "bg-[#121214]/88 text-white border border-white/15 shadow-[0_8px_32px_rgba(0,0,0,0.35)]"
              : "bg-white/92 text-[#111113] border border-black/10 shadow-[0_8px_30px_rgba(0,0,0,0.08)]",
            scrolled && (isDarkPill ? "bg-[#121214]/96 shadow-[0_12px_40px_rgba(0,0,0,0.5)]" : "bg-white/96 shadow-[0_12px_36px_rgba(0,0,0,0.12)]"),
          )}
          aria-label="Primary"
        >
          {/* Left: Brand Identity */}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="flex items-center gap-2.5 rounded-full py-1 pr-3 pl-1 transition-opacity hover:opacity-80 cursor-pointer shrink-0"
            aria-label={`${brandName} home`}
          >
            <Mark letter={brandInitial} logoUrl={config.branding?.logoLight || config.branding?.logoDark} />
            <span
              className={cn(
                "text-[13px] sm:text-sm font-semibold tracking-tight font-display transition-colors",
                isDarkPill ? "text-white" : "text-[#111113]"
              )}
            >
              {brandName}
            </span>
          </button>

          {/* Center: Navigation Links (Desktop) */}
          <div className="hidden md:flex items-center gap-1 lg:gap-1.5">
            {NAV_LINKS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={onNavHref(item.href)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors",
                  isDarkPill
                    ? "text-white/80 hover:text-white hover:bg-white/10"
                    : "text-[#111113]/80 hover:text-[#111113] hover:bg-black/5"
                )}
              >
                {item.label}
              </a>
            ))}
          </div>

          {/* Right: Socials + Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {/* Header Social Icons (clean, proportioned, visible) */}
            <div className="hidden lg:flex items-center pr-1 border-r border-hairline">
              <HeaderSocials
                headerSocials={config.headerSocials}
                fallbackSocials={{
                  instagram: instagramHref,
                  facebook: facebookHref,
                  linkedin: linkedinHref,
                  twitter: twitterHref,
                  github: githubHref,
                }}
                isDarkPill={isDarkPill}
              />
            </div>

            {/* Login / Client Portal Button */}
            <button
              type="button"
              onClick={() => openLogin()}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer shadow-xs",
                isDarkPill
                  ? "bg-white/10 hover:bg-white/15 text-white border-white/15"
                  : "bg-black/5 hover:bg-black/10 text-[#111113] border-black/10"
              )}
            >
              <Lock size={12} className={isDarkPill ? "text-blue-400" : "text-blue"} />
              <span>{portalSession?.client ? "Portal" : "Login"}</span>
            </button>

            {/* Talk to Us CTA Button */}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                openContactModal();
              }}
              className="hidden sm:inline-flex h-8 items-center justify-center px-4 rounded-full text-xs font-semibold bg-blue hover:bg-blue-hover text-white transition-all shadow-xs cursor-pointer active:scale-98"
            >
              Talk to us
            </button>

            {/* Mobile Menu Toggle Button */}
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className={cn(
                "flex size-9 items-center justify-center rounded-full transition-colors md:hidden cursor-pointer",
                isDarkPill
                  ? "text-white hover:bg-white/10"
                  : "text-[#111113] hover:bg-black/5"
              )}
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>

          {/* Scroll progress bar at bottom of pill */}
          <span
            className="pointer-events-none absolute inset-x-4 bottom-1 h-px origin-left rounded-full bg-blue/50"
            style={{ transform: `scaleX(${progress})` }}
            aria-hidden="true"
          />
        </nav>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {open ? (
          <motion.div
            key="menu"
            initial={{ opacity: 0, y: -8, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -6, filter: "blur(6px)" }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-auto fixed inset-0 z-40 bg-[#0d0e12]/98 backdrop-blur-2xl md:hidden text-white"
          >
            <div className="flex h-full flex-col px-6 pt-24 pb-10 justify-between">
              <div className="flex flex-col gap-2">
                {NAV_LINKS.map((item, i) => (
                  <motion.a
                    key={item.href}
                    href={item.href}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.04 * i, duration: 0.3 }}
                    onClick={(e) => {
                      onNavHref(item.href)(e);
                      setOpen(false);
                    }}
                    className="py-2.5 text-2xl sm:text-3xl font-bold tracking-tight text-white font-display hover:text-blue transition-colors"
                  >
                    {item.label}
                  </motion.a>
                ))}

                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    openLogin();
                  }}
                  className="mt-4 flex items-center justify-between px-5 py-3.5 rounded-2xl bg-white/10 border border-white/15 text-white font-semibold text-base transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Lock size={16} className="text-blue-400" />
                    <span>{portalSession?.client ? "Client Portal" : "Client Login"}</span>
                  </span>
                  <span className="text-white/60">&rarr;</span>
                </button>
              </div>

              {/* Bottom Quick Contact */}
              <div className="space-y-4 pt-6 border-t border-white/15">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    openContactModal();
                  }}
                  className="w-full py-3 rounded-full bg-blue hover:bg-blue-hover text-white font-semibold text-sm shadow-sm cursor-pointer"
                >
                  Talk to us
                </button>

                <div className="flex items-center justify-center gap-4 pt-2">
                  <a href={whatsappHref} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">
                    <WhatsAppLogo className="size-9" />
                  </a>
                  <a href={telegramHref} target="_blank" rel="noopener noreferrer" aria-label="Telegram">
                    <TelegramLogo className="size-9" />
                  </a>
                  <a href={viberHref} target="_blank" rel="noopener noreferrer" aria-label="Viber">
                    <ViberLogo className="size-9" />
                  </a>
                  <a href={phoneHref} aria-label="Call">
                    <PhoneLogo className="size-9" />
                  </a>
                </div>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
