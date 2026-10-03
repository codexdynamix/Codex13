import { useState, useEffect } from "react";
import { ArrowRight, X, Sparkles } from "lucide-react";
import { useSiteConfig } from "@/context/SiteConfigContext";
import { useContactModal } from "@/context/ContactModalContext";

export function AnnouncementBanner() {
  const { config } = useSiteConfig();
  const { openContactModal } = useContactModal();
  const [dismissed, setDismissed] = useState(false);

  const banner = config.banner;

  useEffect(() => {
    if (typeof window !== "undefined") {
      const isDismissed = sessionStorage.getItem("codex_banner_dismissed") === "true";
      if (isDismissed) setDismissed(true);
    }
  }, []);

  if (!banner || !banner.enabled || !banner.text || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("codex_banner_dismissed", "true");
    }
  };

  const handleCtaClick = (e: React.MouseEvent) => {
    if (banner.ctaUrl === "#contact" || banner.ctaUrl === "contact") {
      e.preventDefault();
      openContactModal();
    }
  };

  const variantClasses = {
    blue: "bg-blue text-white",
    dark: "bg-[#111113] text-[#f5f5f7] border-b border-white/10",
    gradient: "bg-gradient-to-r from-blue via-indigo-600 to-purple-600 text-white",
    amber: "bg-gradient-to-r from-amber-500 to-orange-500 text-white",
    emerald: "bg-gradient-to-r from-emerald-600 to-teal-600 text-white",
  }[banner.styleVariant || "blue"];

  return (
    <div
      role="region"
      aria-label="Announcement banner"
      className={`relative z-50 px-4 py-2.5 sm:py-2 text-xs font-medium transition-all ${variantClasses}`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <div className="flex-1 flex items-center justify-center sm:justify-center gap-2 text-center text-xs leading-tight">
          <Sparkles className="size-3.5 shrink-0 opacity-80" />
          <span>{banner.text}</span>
          {banner.ctaText && banner.ctaUrl && (
            <a
              href={banner.ctaUrl}
              onClick={handleCtaClick}
              className="inline-flex items-center gap-1 font-semibold underline underline-offset-4 hover:opacity-90 transition ml-1 cursor-pointer shrink-0"
            >
              <span>{banner.ctaText}</span>
              <ArrowRight className="size-3" />
            </a>
          )}
        </div>

        {banner.closable !== false && (
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss banner"
            className="p-1 rounded-md hover:bg-black/15 transition cursor-pointer shrink-0 opacity-80 hover:opacity-100"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
