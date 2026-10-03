import { useEffect } from "react";
import { useSiteConfig } from "@/context/SiteConfigContext";

export interface SEOProps {
  title?: string;
  description?: string;
  canonical?: string;
  ogType?: "website" | "article";
  ogImage?: string;
  articleAuthor?: string;
  articlePublishedTime?: string;
  articleModifiedTime?: string;
  articleSection?: string;
  articleTags?: string[];
  twitterCard?: "summary" | "summary_large_image";
  keywords?: string[];
  schemaOrg?: Record<string, unknown>;
  noIndex?: boolean;
}

const DEFAULT_SITE_NAME = "Codex Dynamics";
const DEFAULT_TITLE = "Codex Dynamics — High-Performance Websites & Digital Agency";
const DEFAULT_DESCRIPTION =
  "High-performance websites, web design, web development, and digital marketing agency. Precision engineering on every screen.";
const DEFAULT_OG_IMAGE = "/hero/studio.jpg";

/**
 * SEO component managing document head tags including title, meta descriptions,
 * Open Graph, Twitter Cards, canonical links, and Schema.org JSON-LD.
 * Acts as a reactive lightweight Head manager (pure React 19 + DOM reconciliation).
 */
export function SEO({
  title,
  description,
  canonical,
  ogType = "website",
  ogImage,
  articleAuthor = DEFAULT_SITE_NAME,
  articlePublishedTime,
  articleModifiedTime,
  articleSection,
  articleTags,
  twitterCard = "summary_large_image",
  keywords,
  schemaOrg,
  noIndex = false,
}: SEOProps) {
  const { config } = useSiteConfig();

  const siteName = config.siteName || DEFAULT_SITE_NAME;
  const configTitle = config.seo?.metaTitle || DEFAULT_TITLE;
  const configDesc = config.seo?.metaDescription || DEFAULT_DESCRIPTION;
  const configOgImage = config.seo?.ogImage || DEFAULT_OG_IMAGE;
  const configCanonical = config.seo?.canonicalUrl;

  const finalTitle = title ? `${title} — ${siteName}` : configTitle;
  const finalDescription = description || configDesc;
  const finalOgImage = ogImage || configOgImage;
  const finalCanonical = canonical || configCanonical;

  useEffect(() => {
    if (typeof document === "undefined") return;

    // 1. Title
    document.title = finalTitle;

    // Helper to safely set or create a <meta> tag
    const setMeta = (selector: string, attributeName: string, attributeValue: string, content: string) => {
      let el = document.head.querySelector<HTMLMetaElement>(selector);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attributeName, attributeValue);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };

    // Helper to set or create a <link> tag
    const setLink = (rel: string, href: string) => {
      let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
      if (!el) {
        el = document.createElement("link");
        el.setAttribute(rel, rel);
        document.head.appendChild(el);
      }
      el.setAttribute("href", href);
    };

    // Helper to remove meta tags by selector
    const removeMeta = (selector: string) => {
      const el = document.head.querySelector(selector);
      if (el) el.remove();
    };

    // Favicon update
    if (config.branding?.favicon) {
      setLink("icon", config.branding.favicon);
    }

    // Google Search Console Verification
    if (config.seo?.gscVerification) {
      setMeta('meta[name="google-site-verification"]', "name", "google-site-verification", config.seo.gscVerification);
    }

    // Google Analytics 4 Injection if gaId provided
    if (config.seo?.gaId && !document.getElementById("ga4-script")) {
      const gaScript = document.createElement("script");
      gaScript.id = "ga4-script";
      gaScript.async = true;
      gaScript.src = `https://www.googletagmanager.com/gtag/js?id=${config.seo.gaId}`;
      document.head.appendChild(gaScript);

      const gaInit = document.createElement("script");
      gaInit.id = "ga4-init";
      gaInit.textContent = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${config.seo.gaId}');`;
      document.head.appendChild(gaInit);
    }

    // Meta Pixel injection if metaPixelId or pixelId provided
    const pixelId = config.seo?.metaPixelId || config.seo?.pixelId;
    if (pixelId && !document.getElementById("meta-pixel-script")) {
      const fbScript = document.createElement("script");
      fbScript.id = "meta-pixel-script";
      fbScript.textContent = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixelId}');fbq('track','PageView');`;
      document.head.appendChild(fbScript);

      const noScript = document.createElement("noscript");
      noScript.id = "meta-pixel-noscript";
      const img = document.createElement("img");
      img.height = 1;
      img.width = 1;
      img.style.display = "none";
      img.src = `https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`;
      noScript.appendChild(img);
      document.head.appendChild(noScript);
    }

    // 2. Standard Meta Tags
    setMeta('meta[name="description"]', "name", "description", finalDescription);
    if (keywords && keywords.length > 0) {
      setMeta('meta[name="keywords"]', "name", "keywords", keywords.join(", "));
    } else {
      removeMeta('meta[name="keywords"]');
    }

    if (noIndex) {
      setMeta('meta[name="robots"]', "name", "robots", "noindex, nofollow");
    } else {
      setMeta('meta[name="robots"]', "name", "robots", "index, follow, max-image-preview:large");
    }

    // 3. Canonical Link
    const currentUrl = finalCanonical || (typeof window !== "undefined" ? window.location.href : "");
    if (currentUrl) {
      setLink("canonical", currentUrl);
    }

    // 4. Open Graph Tags
    setMeta('meta[property="og:site_name"]', "property", "og:site_name", siteName);
    setMeta('meta[property="og:title"]', "property", "og:title", title || configTitle);
    setMeta('meta[property="og:description"]', "property", "og:description", finalDescription);
    setMeta('meta[property="og:type"]', "property", "og:type", ogType);
    if (currentUrl) {
      setMeta('meta[property="og:url"]', "property", "og:url", currentUrl);
    }
    if (finalOgImage) {
      const absoluteImage = finalOgImage.startsWith("http")
        ? finalOgImage
        : `${window.location.origin}${finalOgImage.startsWith("/") ? "" : "/"}${finalOgImage}`;
      setMeta('meta[property="og:image"]', "property", "og:image", absoluteImage);
    }

    // Article Specific Tags
    if (ogType === "article") {
      setMeta('meta[property="article:author"]', "property", "article:author", articleAuthor);
      if (articlePublishedTime) {
        setMeta('meta[property="article:published_time"]', "property", "article:published_time", articlePublishedTime);
      }
      if (articleModifiedTime) {
        setMeta('meta[property="article:modified_time"]', "property", "article:modified_time", articleModifiedTime);
      }
      if (articleSection) {
        setMeta('meta[property="article:section"]', "property", "article:section", articleSection);
      }
      if (articleTags && articleTags.length > 0) {
        setMeta('meta[property="article:tag"]', "property", "article:tag", articleTags.join(", "));
      }
    } else {
      removeMeta('meta[property="article:author"]');
      removeMeta('meta[property="article:published_time"]');
      removeMeta('meta[property="article:modified_time"]');
      removeMeta('meta[property="article:section"]');
      removeMeta('meta[property="article:tag"]');
    }

    // 5. Twitter Card Tags
    setMeta('meta[name="twitter:card"]', "name", "twitter:card", twitterCard);
    setMeta('meta[name="twitter:title"]', "name", "twitter:title", title || configTitle);
    setMeta('meta[name="twitter:description"]', "name", "twitter:description", finalDescription);
    if (finalOgImage) {
      const absoluteImage = finalOgImage.startsWith("http")
        ? finalOgImage
        : `${window.location.origin}${finalOgImage.startsWith("/") ? "" : "/"}${finalOgImage}`;
      setMeta('meta[name="twitter:image"]', "name", "twitter:image", absoluteImage);
    }

    // 6. Schema.org Structured Data (JSON-LD)
    const scriptId = "seo-schema-jsonld";
    let scriptEl = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (schemaOrg) {
      if (!scriptEl) {
        scriptEl = document.createElement("script");
        scriptEl.id = scriptId;
        scriptEl.type = "application/ld+json";
        document.head.appendChild(scriptEl);
      }
      scriptEl.textContent = JSON.stringify(schemaOrg);
    } else if (scriptEl) {
      scriptEl.remove();
    }

    return () => {
      document.title = DEFAULT_TITLE;
    };
  }, [
    finalTitle,
    title,
    finalDescription,
    finalCanonical,
    ogType,
    finalOgImage,
    siteName,
    configTitle,
    config.branding?.favicon,
    config.seo?.gscVerification,
    config.seo?.gaId,
    config.seo?.metaPixelId,
    config.seo?.pixelId,
    articleAuthor,
    articlePublishedTime,
    articleModifiedTime,
    articleSection,
    articleTags,
    twitterCard,
    keywords,
    schemaOrg,
    noIndex,
  ]);

  return null;
}
