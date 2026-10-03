import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { useEffect, useState, type MouseEvent } from "react";
import {
  FacebookLogo,
  GitHubLogo,
  GmailLogo,
  InstagramLogo,
  LinkedInLogo,
  PhoneLogo,
  TelegramLogo,
  TwitterXLogo,
  ViberLogo,
  WhatsAppLogo,
} from "@/components/BrandMarks";
import { Button } from "@/components/ui/button";
import { NAV_LINKS } from "@/lib/nav";
import { CONTACT, LINKS } from "@/lib/site";
import { cn } from "@/lib/utils";
import { useSiteConfig } from "@/context/SiteConfigContext";
import { useContactModal } from "@/context/ContactModalContext";
import { usePreviewMode } from "@/context/PreviewModeContext";
import { hrefToPreviewPage, isDarkHex } from "@/lib/theme-engine";
import { ThemeToggle } from "@/components/ThemeToggle";

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
      className="relative flex size-7 shrink-0 items-center justify-center rounded-[8px] bg-blue text-paper shadow-[inset_0_0.5px_0_rgb(255_255_255_/_0.35)]"
      aria-hidden="true"
    >
      <span className="text-[13px] leading-none font-semibold tracking-tight">
        {letter || "C"}
      </span>
    </span>
  );
}

function HeaderSocials({
  className,
  headerSocials,
  fallbackSocials,
}: {
  className?: string;
  headerSocials?: any;
  fallbackSocials?: {
    instagram?: string;
    facebook?: string;
    linkedin?: string;
    twitter?: string;
    github?: string;
  };
}) {
  const items = [
    {
      key: "linkedin",
      enabled: headerSocials?.linkedin !== undefined ? Boolean(headerSocials.linkedin.enabled) : true,
      url: headerSocials?.linkedin?.url || fallbackSocials?.linkedin || LINKS.linkedin,
      label: "LinkedIn",
      logo: LinkedInLogo,
      iconClass: "size-5 sm:size-6",
    },
    {
      key: "x",
      enabled: headerSocials?.x !== undefined ? Boolean(headerSocials.x.enabled) : true,
      url: headerSocials?.x?.url || fallbackSocials?.twitter || LINKS.twitter,
      label: "Twitter / X",
      logo: TwitterXLogo,
      iconClass: "size-5 sm:size-6",
    },
    {
      key: "github",
      enabled: headerSocials?.github !== undefined ? Boolean(headerSocials.github.enabled) : true,
      url: headerSocials?.github?.url || fallbackSocials?.github || LINKS.github,
      label: "GitHub",
      logo: GitHubLogo,
      iconClass: "size-5 sm:size-6",
    },
    {
      key: "instagram",
      enabled: headerSocials?.instagram !== undefined ? Boolean(headerSocials.instagram.enabled) : true,
      url: headerSocials?.instagram?.url || fallbackSocials?.instagram || LINKS.instagram,
      label: "Instagram",
      logo: InstagramLogo,
      iconClass: "size-6 sm:size-7",
    },
    {
      key: "facebook",
      enabled: headerSocials?.facebook !== undefined ? Boolean(headerSocials.facebook.enabled) : true,
      url: headerSocials?.facebook?.url || fallbackSocials?.facebook || LINKS.facebook,
      label: "Facebook",
      logo: FacebookLogo,
      iconClass: "size-6 sm:size-7",
    },
  ];

  const visible = items.filter((item) => item.enabled && item.url);
  if (visible.length === 0) return null;

  return (
    <div className={cn("flex items-center gap-0.5 sm:gap-1", className)}>
      {visible.map((item) => {
        const LogoComponent = item.logo;
        return (
          <a
            key={item.key}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={item.label}
            title={item.label}
            className="flex size-8 sm:size-9 items-center justify-center rounded-full transition-transform duration-150 ease-out hover:scale-105 active:scale-[0.96]"
          >
            <LogoComponent className={item.iconClass} />
          </a>
        );
      })}
    </div>
  );
}

export function Nav() {
  const {
    config,
    primaryPhone,
    primaryEmail,
    primaryAddress,
    primaryWhatsApp,
    primaryTelegram,
    primaryViber,
    socialsGrouped,
  } = useSiteConfig();

  const brandName = config.siteName || "Codex";
  const brandInitial = brandName.trim()[0]?.toUpperCase() || "C";
  const phoneDisplay = primaryPhone?.value || CONTACT.phoneDisplay;
  const phoneHref = primaryPhone?.href || LINKS.tel;
  const emailRecipient = config.formSubmitEmail || primaryEmail?.value || CONTACT.email;
  const currentAddress = primaryAddress || {
    street: CONTACT.addressStreet,
    city: "Kyiv",
  };

  const whatsappHref = primaryWhatsApp?.href || LINKS.whatsapp;
  const telegramHref = primaryTelegram?.href || LINKS.telegram;
  const viberHref = primaryViber?.href || LINKS.viber;
  const instagramHref = config.headerSocials?.instagram?.url || socialsGrouped.instagram?.[0]?.href || LINKS.instagram;
  const facebookHref = config.headerSocials?.facebook?.url || socialsGrouped.facebook?.[0]?.href || LINKS.facebook;
  const linkedinHref = config.headerSocials?.linkedin?.url || socialsGrouped.linkedin?.[0]?.href || LINKS.linkedin;
  const twitterHref = config.headerSocials?.x?.url || socialsGrouped.twitter?.[0]?.href || LINKS.twitter;
  const githubHref = config.headerSocials?.github?.url || socialsGrouped.github?.[0]?.href || LINKS.github;

  const { openContactModal } = useContactModal();
  const preview = usePreviewMode();

  const [overLight, setOverLight] = useState(false);
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [scrolled, setScrolled] = useState(false);

  const onNavHref = (href: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (preview.isPreview && preview.navigateTo) {
      e.preventDefault();
      preview.navigateTo(hrefToPreviewPage(href));
      setOpen(false);
    }
  };

  const pin = preview.isPreview ? "absolute" : "fixed";

  useEffect(() => {
    const onScroll = () => {
      const hero = document.getElementById("hero");
      const heroLayout = config.theme?.heroLayout || config.theme?.layout?.heroLayout || "streamer";
      const isDarkHero = heroLayout === "streamer";
      const isSiteDark = isDarkHex(config.colors?.background);

      if (isSiteDark) {
        setOverLight(false);
      } else {
        if (hero) {
          setOverLight(!isDarkHero || hero.getBoundingClientRect().bottom < 88);
        } else {
          setOverLight(true);
        }
      }
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      setProgress(max > 0 ? doc.scrollTop / max : 0);
      setScrolled(window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [config.theme?.heroLayout, config.theme?.layout?.heroLayout, config.colors?.background]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const light = overLight && !open;
  const headerStyle = config.theme?.headerStyle || "floating";

  if (headerStyle === "classic") {
    return (
      <header className={cn("pointer-events-none inset-x-0 top-0 z-50 border-b border-hairline bg-background/95 backdrop-blur-xl", pin)}>
        <div className="pointer-events-auto mx-auto w-full max-w-[72rem] px-4 sm:px-6">
          <div className="flex flex-col items-center py-5 text-center">
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="text-[1.35rem] font-semibold tracking-tight text-label font-display"
            >
              {brandName}
            </button>
            <p className="mt-1 text-[11px] tracking-[0.22em] text-subtle uppercase">
              {config.siteTagline || "Digital Agency"}
            </p>
          </div>
          <nav className="flex items-center justify-center gap-1 border-t border-hairline py-2" aria-label="Primary">
            {NAV_LINKS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={onNavHref(item.href)}
                className="rounded-full px-3 py-2 text-[12px] font-medium text-label/80 hover:text-label"
              >
                {item.label}
              </a>
            ))}
            <ThemeToggle variant="icon" className="mx-1" />
            <button
              type="button"
              onClick={() => openContactModal()}
              className="ml-1 rounded-full bg-label px-3.5 py-1.5 text-[12px] font-semibold text-paper"
            >
              Talk to us
            </button>
          </nav>
        </div>
      </header>
    );
  }

  if (headerStyle === "sticky") {
    return (
      <header className={cn("pointer-events-none inset-x-0 top-0 z-50 border-b border-hairline bg-background/80 backdrop-blur-2xl", pin, scrolled && "shadow-xs")}>
        <nav className="pointer-events-auto mx-auto flex h-14 w-full max-w-[80rem] items-center justify-between px-4 sm:px-6" aria-label="Primary">
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="flex items-center gap-2"
          >
            <Mark letter={brandInitial} logoUrl={config.branding?.logoLight || config.branding?.logoDark} />
            <span className="text-[14px] font-semibold tracking-tight text-label">{brandName}</span>
          </button>
          <div className="hidden items-center gap-1 lg:flex">
            {NAV_LINKS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={onNavHref(item.href)}
                className="rounded-full px-3 py-1.5 text-[13px] font-medium text-label/80 hover:bg-black/5"
              >
                {item.label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle variant="icon" />
            <Button
              type="button"
              size="sm"
              className="hidden h-8 px-3.5 text-[13px] md:inline-flex"
              onClick={() => openContactModal()}
            >
              Talk to us
            </Button>
            <button type="button" className="lg:hidden size-10" onClick={() => setOpen((v) => !v)} aria-label="Menu">
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </nav>
        {open ? (
          <div className="pointer-events-auto border-t border-hairline bg-background px-4 py-4 lg:hidden">
            {NAV_LINKS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={onNavHref(item.href)}
                className="block py-2.5 text-sm font-medium text-label"
              >
                {item.label}
              </a>
            ))}
          </div>
        ) : null}
      </header>
    );
  }

  if (headerStyle === "minimal") {
    return (
      <header className={cn("pointer-events-none inset-x-0 top-0 z-50", pin)}>
        <nav className="pointer-events-auto mx-auto flex h-12 w-full max-w-[56rem] items-center justify-between px-5" aria-label="Primary">
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="text-[13px] font-semibold tracking-tight text-label"
          >
            {brandName}
          </button>
          <div className="hidden items-center gap-5 sm:flex">
            {NAV_LINKS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={onNavHref(item.href)}
                className="text-[12px] font-medium text-muted-foreground hover:text-label"
              >
                {item.label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle variant="icon" />
            <button
              type="button"
              onClick={() => openContactModal()}
              className="text-[12px] font-semibold text-primary"
            >
              Contact
            </button>
          </div>
        </nav>
        <div className="h-px w-full bg-hairline" />
      </header>
    );
  }

  return (
    <header className={cn("pointer-events-none inset-x-0 top-0 z-50 pt-[max(0.7rem,env(safe-area-inset-top))]", pin)}>

      <div className={cn("flex justify-center", "px-3 sm:px-5 xl:px-8")}>
        <nav
          className={cn(
            "ios-island pointer-events-auto relative z-50 flex h-12 w-full items-center justify-between gap-2 px-2 transition-[background-color,box-shadow,backdrop-filter,transform] duration-300 sm:h-[3.25rem] sm:px-2.5",
            "max-w-[72rem]",
            light ? "ios-island-light text-label" : "ios-island-dark text-paper",
            scrolled && "ios-island-scrolled",
            open && "ios-island-open",
          )}
          aria-label="Primary"
        >
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="flex min-h-11 items-center gap-2 rounded-full py-1 pr-2 pl-0.5"
            aria-label={`${brandName} home`}
          >
            <Mark letter={brandInitial} logoUrl={config.branding?.logoLight || config.branding?.logoDark} />
            <span className="text-[13px] font-semibold tracking-tight">
              {brandName}
            </span>
          </button>

          <div className="absolute left-1/2 hidden -translate-x-1/2 items-center lg:flex">
            {NAV_LINKS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={onNavHref(item.href)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-[13px] font-medium transition-opacity duration-150 hover:opacity-55",
                  light ? "text-label" : "text-paper/90",
                )}
              >
                {item.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <HeaderSocials
              headerSocials={config.headerSocials}
              fallbackSocials={{
                instagram: instagramHref,
                facebook: facebookHref,
                linkedin: linkedinHref,
                twitter: twitterHref,
                github: githubHref,
              }}
            />
            <ThemeToggle variant="icon" />
            <Button
              type="button"
              size="sm"
              variant={light ? "default" : "inverted"}
              className="hidden h-8 min-h-8 px-3.5 text-[13px] md:inline-flex cursor-pointer shadow-xs"
              onClick={() => {
                setOpen(false);
                openContactModal();
              }}
            >
              Talk to us
            </Button>

            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className={cn(
                "relative z-20 flex size-10 items-center justify-center rounded-full md:hidden",
                light ? "text-label" : "text-paper",
              )}
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>

          <span
            className={cn(
              "pointer-events-none absolute inset-x-4 bottom-1 h-px origin-left rounded-full",
              light ? "bg-label/20" : "bg-paper/25",
            )}
            style={{ transform: `scaleX(${progress})` }}
            aria-hidden="true"
          />
        </nav>
      </div>

      <AnimatePresence>
        {open ? (
          <motion.div
            key="menu"
            initial={{ opacity: 0, y: -8, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -6, filter: "blur(6px)" }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="ios-sheet pointer-events-auto fixed inset-0 z-40 md:hidden"
          >
            <div className="flex h-full flex-col px-6 pt-24 pb-10">
              <div className="flex flex-1 flex-col justify-center gap-1">
                {NAV_LINKS.map((item, i) => (
                  <motion.a
                    key={item.href}
                    href={item.href}
                    initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    transition={{ delay: 0.05 * i, duration: 0.4 }}
                    onClick={(e) => {
                      onNavHref(item.href)(e);
                      setOpen(false);
                    }}
                    className="py-3 text-4xl font-semibold tracking-tight text-paper"
                  >
                    {item.label}
                  </motion.a>
                ))}
              </div>

              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-3">
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="WhatsApp"
                  >
                    <WhatsAppLogo className="size-11" />
                  </a>
                  <a
                    href={telegramHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Telegram"
                  >
                    <TelegramLogo className="size-11" />
                  </a>
                  <a
                    href={viberHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Viber"
                  >
                    <ViberLogo className="size-11" />
                  </a>
                  <a href={phoneHref} aria-label="Call">
                    <PhoneLogo className="size-11" />
                  </a>
                  <a
                    href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(emailRecipient)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Gmail"
                  >
                    <GmailLogo className="size-11" />
                  </a>
                  <a
                    href={linkedinHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="LinkedIn"
                  >
                    <LinkedInLogo className="size-11" />
                  </a>
                  <a
                    href={twitterHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Twitter / X"
                  >
                    <TwitterXLogo className="size-11" />
                  </a>
                  <a
                    href={githubHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="GitHub"
                  >
                    <GitHubLogo className="size-11" />
                  </a>
                  <a
                    href={instagramHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Instagram"
                  >
                    <InstagramLogo className="size-11" />
                  </a>
                  <a
                    href={facebookHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Facebook"
                  >
                    <FacebookLogo className="size-11" />
                  </a>
                </div>

                <p className="text-sm text-paper/70">
                  {phoneDisplay}
                  <span className="mx-2 text-paper/30">·</span>
                  {currentAddress.street}, {currentAddress.city}
                </p>
                <div className="py-2">
                  <ThemeToggle variant="pill" showLabel className="w-full justify-center py-2.5" />
                </div>
                <Button
                  type="button"
                  size="lg"
                  variant="inverted"
                  className="w-full cursor-pointer shadow-md"
                  onClick={() => {
                    setOpen(false);
                    openContactModal();
                  }}
                >
                  Talk to us
                </Button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
