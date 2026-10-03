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
import { CONTACT, LINKS } from "@/lib/site";
import { useSiteConfig } from "@/context/SiteConfigContext";
import { NewsletterSignup } from "@/components/NewsletterSignup";
import { useContactModal } from "@/context/ContactModalContext";
import { MessageSquare } from "lucide-react";

export function Footer() {
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

  const { openContactModal } = useContactModal();

  const year = config.copyrightYear || new Date().getFullYear().toString();
  const brandName = config.siteName || "CODEX";
  const bio =
    config.footer?.tagline ||
    "Web development, web design, and social media marketing. We build the site, then we grow it.";

  const phoneItem = primaryPhone || { value: CONTACT.phoneDisplay, href: LINKS.tel };
  const emailItem = primaryEmail || { value: CONTACT.email, href: LINKS.mailto };
  const addressItem = primaryAddress || {
    id: "addr-kyiv",
    label: "Kyiv Office",
    city: "Kyiv",
    street: CONTACT.addressStreet,
    fullAddress: CONTACT.addressFull,
    lat: 50.4385,
    lng: 30.5235,
  };

  const whatsappUrl = primaryWhatsApp?.href || LINKS.whatsapp;
  const telegramUrl = primaryTelegram?.href || LINKS.telegram;
  const viberUrl = primaryViber?.href || LINKS.viber;
  const instagramUrl = config.headerSocials?.instagram?.url || socialsGrouped.instagram?.[0]?.href || LINKS.instagram;
  const facebookUrl = config.headerSocials?.facebook?.url || socialsGrouped.facebook?.[0]?.href || LINKS.facebook;
  const linkedinUrl = config.headerSocials?.linkedin?.url || socialsGrouped.linkedin?.[0]?.href || LINKS.linkedin;
  const twitterUrl = config.headerSocials?.x?.url || socialsGrouped.twitter?.[0]?.href || LINKS.twitter;
  const githubUrl = config.headerSocials?.github?.url || socialsGrouped.github?.[0]?.href || LINKS.github;

  return (
    <footer className="border-t border-hairline bg-background py-14 pb-28 text-sm text-muted-foreground sm:py-16 sm:pb-28">
      <div className="shell">
        {/* Main Footer Grid */}
        <div className="grid gap-12 lg:grid-cols-12">
          {/* Brand & Direct Messaging */}
          <div className="lg:col-span-4 space-y-4">
            <div className="text-[13px] font-semibold tracking-[0.2em] text-label uppercase">
              {brandName}
            </div>
            <p className="max-w-sm leading-relaxed text-xs sm:text-sm">
              {bio}
            </p>

            {/* Direct Connect Icons */}
            <div className="pt-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-label mb-2">
                Direct Channels
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {whatsappUrl && (
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="WhatsApp"
                    className="hover:scale-105 transition-transform"
                    title="WhatsApp"
                  >
                    <WhatsAppLogo className="size-8" />
                  </a>
                )}
                {telegramUrl && (
                  <a
                    href={telegramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Telegram"
                    className="hover:scale-105 transition-transform"
                    title="Telegram"
                  >
                    <TelegramLogo className="size-8" />
                  </a>
                )}
                {viberUrl && (
                  <a
                    href={viberUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Viber"
                    className="hover:scale-105 transition-transform"
                    title="Viber"
                  >
                    <ViberLogo className="size-8" />
                  </a>
                )}
                {phoneItem.href && (
                  <a
                    href={phoneItem.href}
                    aria-label="Call"
                    className="hover:scale-105 transition-transform"
                    title="Call"
                  >
                    <PhoneLogo className="size-8" />
                  </a>
                )}
                {emailItem.value && (
                  <a
                    href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(emailItem.value)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Gmail"
                    className="hover:scale-105 transition-transform"
                    title="Gmail"
                  >
                    <GmailLogo className="size-8" />
                  </a>
                )}
                {instagramUrl && (
                  <a
                    href={instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Instagram"
                    className="hover:scale-105 transition-transform"
                    title="Instagram"
                  >
                    <InstagramLogo className="size-8" />
                  </a>
                )}
                {facebookUrl && (
                  <a
                    href={facebookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Facebook"
                    className="hover:scale-105 transition-transform"
                    title="Facebook"
                  >
                    <FacebookLogo className="size-8" />
                  </a>
                )}
              </div>
            </div>

            {/* Social Media Section: LinkedIn, Twitter, GitHub */}
            <div className="pt-2 border-t border-hairline">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-label mb-2">
                Professional & Open Source
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="LinkedIn"
                  title="Codex Dynamics on LinkedIn"
                  className="size-8 rounded-full hover:scale-110 active:scale-95 transition-transform flex items-center justify-center"
                >
                  <LinkedInLogo className="size-8" />
                </a>
                <a
                  href={twitterUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Twitter / X"
                  title="Codex Dynamics on Twitter"
                  className="size-8 rounded-full hover:scale-110 active:scale-95 transition-transform flex items-center justify-center"
                >
                  <TwitterXLogo className="size-8" />
                </a>
                <a
                  href={githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="GitHub"
                  title="Codex Dynamics on GitHub"
                  className="size-8 rounded-full hover:scale-110 active:scale-95 transition-transform flex items-center justify-center"
                >
                  <GitHubLogo className="size-8" />
                </a>
              </div>
            </div>
          </div>

          {/* Navigation Links Columns */}
          <div className="lg:col-span-2">
            <h3 className="mb-4 font-medium text-label">Company</h3>
            <ul className="space-y-2.5">
              <li>
                <a
                  href="#process"
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById("process")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="hover:text-label transition-colors"
                >
                  Process
                </a>
              </li>
              <li>
                <a
                  href="#capabilities"
                  onClick={(e) => {
                    e.preventDefault();
                    (document.getElementById("capabilities") || document.getElementById("services"))?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="hover:text-label transition-colors"
                >
                  Capabilities
                </a>
              </li>
              <li>
                <a
                  href="#about"
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById("about")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="hover:text-label transition-colors"
                >
                  About
                </a>
              </li>
              <li>
                <a href="/blog" className="hover:text-label transition-colors font-medium text-blue">
                  Blog & Insights
                </a>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== "undefined") {
                      window.dispatchEvent(new CustomEvent("cdx_open_login_modal"));
                    }
                  }}
                  className="hover:text-label transition-colors font-semibold text-label flex items-center gap-1.5 cursor-pointer text-left"
                >
                  <span className="size-1.5 rounded-full bg-blue-500" />
                  <span>Client Login</span>
                </button>
              </li>
            </ul>
          </div>

          <div className="lg:col-span-2">
            <h3 className="mb-4 font-medium text-label">Work & Inquiries</h3>
            <ul className="space-y-2.5">
              <li>
                <a
                  href="#work"
                  onClick={(e) => {
                    e.preventDefault();
                    (document.getElementById("work") || document.getElementById("portfolio"))?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="hover:text-label transition-colors"
                >
                  Selected work
                </a>
              </li>
              <li>
                <a
                  href="#results"
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById("results")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="hover:text-label transition-colors"
                >
                  Results
                </a>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => openContactModal("High-Performance Website")}
                  className="hover:text-label transition-colors cursor-pointer text-left text-blue font-medium"
                >
                  Start a project
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => openContactModal("General Inquiry")}
                  className="hover:text-label transition-colors cursor-pointer text-left flex items-center gap-1"
                >
                  <MessageSquare className="size-3" />
                  <span>Contact Us</span>
                </button>
              </li>
            </ul>
          </div>

          {/* Newsletter Signup Component Column */}
          <div className="lg:col-span-4 space-y-4">
            <NewsletterSignup
              variant="footer"
              source="footer_subscription"
              placeholder="Your email address..."
            />
          </div>
        </div>

        {/* Footer Bottom Bar with Theme Toggle & Contact Us */}
        <div className="mt-12 flex flex-col justify-between items-center gap-4 border-t border-hairline pt-7 text-xs sm:flex-row">
          <p>
            {config.footer?.copyrightText
              ? config.footer.copyrightText.replace("{year}", String(year))
              : `© ${year} ${brandName}. All rights reserved.`}
          </p>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => openContactModal()}
              className="text-xs text-blue hover:text-blue-hover font-medium underline underline-offset-4 cursor-pointer"
            >
              Contact Us
            </button>
          </div>

          <p>
            {addressItem.city} · {addressItem.street}
          </p>
        </div>
      </div>
    </footer>
  );
}
