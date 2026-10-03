import type { ReactNode } from "react";
import { Nav } from "@/components/Nav";
import { Hero } from "@/components/Hero";
import { Highlights } from "@/components/Highlights";
import { Portfolio } from "@/components/Portfolio";
import { Results } from "@/components/Results";
import { Reviews } from "@/components/Reviews";
import { About } from "@/components/About";
import { Services } from "@/components/Services";
import { BlogSection } from "@/components/BlogSection";
import { Contact } from "@/components/Contact";
import { Footer } from "@/components/Footer";
import { WhatsAppDock } from "@/components/WhatsAppDock";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";
import { MaintenanceScreen } from "@/components/MaintenanceScreen";
import { ClientLoginSplitView } from "@/components/ClientLoginSplitView";
import { useSiteConfig } from "@/context/SiteConfigContext";
import { usePreviewMode } from "@/context/PreviewModeContext";
import { useLoginView } from "@/context/LoginViewContext";
import {
  isComponentEnabled,
  resolveSectionVisibility,
  resolveSectionsOrder,
  type PreviewPage,
} from "@/lib/theme-engine";

const SECTION_MAP: Record<string, () => ReactNode> = {
  hero: () => <Hero />,
  highlights: () => <Highlights />,
  portfolio: () => <Portfolio />,
  results: () => <Results />,
  reviews: () => <Reviews />,
  about: () => <About />,
  services: () => <Services />,
  blog: () => <BlogSection />,
  contact: () => <Contact />,
};

const PAGE_SECTIONS: Record<PreviewPage, string[]> = {
  home: [],
  work: ["portfolio", "results"],
  services: ["services"],
  studio: ["about"],
  blog: ["blog"],
  contact: ["contact"],
};

function OrderedHome() {
  const { config } = useSiteConfig();
  const order = resolveSectionsOrder(config.theme);
  const visibility = resolveSectionVisibility(config.theme);
  const componentGate: Record<string, string> = {
    hero: "hero-clip",
    highlights: "bento-highlights",
    portfolio: "portfolio-showcase",
    results: "results-counter",
    reviews: "reviews-slider",
    services: "services-carousel",
    blog: "gutenberg-blocks",
  };

  return (
    <>
      {order.map((id) => {
        if (visibility[id] === false) return null;
        const gate = componentGate[id];
        if (gate && !isComponentEnabled(config, gate)) return null;
        const render = SECTION_MAP[id];
        return render ? (
          <div key={id} id={id} data-section-id={id} className="transition-all duration-300">
            {render()}
          </div>
        ) : null;
      })}
    </>
  );
}

export function SitePageBody({ page = "home" }: { page?: PreviewPage }) {
  if (page !== "home") {
    const ids = PAGE_SECTIONS[page] || [];
    return (
      <>
        {ids.map((id) => {
          const render = SECTION_MAP[id];
          return render ? (
            <div key={id} id={id} data-section-id={id} className="transition-all duration-300">
              {render()}
            </div>
          ) : null;
        })}
      </>
    );
  }

  return <OrderedHome />;
}

export function SiteChrome({ page = "home" }: { page?: PreviewPage }) {
  const { config } = useSiteConfig();
  const preview = usePreviewMode();
  const { isLoginActive, closeLogin } = useLoginView();

  // If maintenance mode is active and not in preview editor iframe, show maintenance screen
  if (config.emergency?.maintenanceMode && !preview.isPreview) {
    return <MaintenanceScreen />;
  }

  // When login is active, the landing page ITSELF changes into the split login screen
  // (Site info & blue branding on the left, login form on the right - NOT a modal on top)
  if (isLoginActive) {
    return <ClientLoginSplitView onClose={closeLogin} />;
  }

  const showHeader = isComponentEnabled(config, "header-builder");
  const showFooter = isComponentEnabled(config, "footer-widgets");
  const showDock = isComponentEnabled(config, "sticky-contact-dock") && !preview.isPreview;

  return (
    <>
      <AnnouncementBanner />
      {showHeader ? <Nav /> : null}
      <main>
        <SitePageBody page={page} />
      </main>
      {showFooter ? <Footer /> : null}
      {showDock ? <WhatsAppDock /> : null}
    </>
  );
}
