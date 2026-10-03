import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useSiteConfig } from "@/context/SiteConfigContext";
import { buildThemeStyle, isDarkHex } from "@/lib/theme-engine";

function CustomCodeContainer({
  html,
  containerId,
}: {
  html?: string;
  containerId: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!html || !html.trim()) {
      container.innerHTML = "";
      return;
    }

    container.innerHTML = "";

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const nodes = Array.from(doc.head.childNodes).concat(Array.from(doc.body.childNodes));

      nodes.forEach((node) => {
        if (node.nodeName.toLowerCase() === "script") {
          const oldScript = node as HTMLScriptElement;
          const newScript = document.createElement("script");
          Array.from(oldScript.attributes).forEach((attr) => {
            newScript.setAttribute(attr.name, attr.value);
          });
          newScript.text = oldScript.text || oldScript.textContent || "";
          newScript.async = false;
          container.appendChild(newScript);
        } else {
          container.appendChild(node.cloneNode(true));
        }
      });
    } catch {
      container.innerHTML = html;
    }

    return () => {
      if (container) {
        container.innerHTML = "";
      }
    };
  }, [html]);

  if (!html) return null;

  return <div id={containerId} ref={containerRef} className="custom-code-injection" />;
}

export function SiteCanvas({
  children,
  preview = false,
  className,
}: {
  children: ReactNode;
  preview?: boolean;
  className?: string;
}) {
  const { config } = useSiteConfig();
  const theme = config.theme;
  const themeId = theme?.activeTheme || "codex-pro";
  const header = theme?.headerStyle || "floating";
  const hero = theme?.heroLayout || theme?.layout?.heroLayout || "streamer";
  const cards = theme?.cardStyle || theme?.layout?.cardStyle || "glass";
  const scale = theme?.fontSizeScale || theme?.layout?.fontSizeScale || "normal";
  const isDark = isDarkHex(config.colors?.background);

  return (
    <div
      className={cn(
        "site-canvas min-h-screen bg-background text-foreground",
        className,
      )}
      data-site-theme={themeId}
      data-header-style={header}
      data-hero-layout={hero}
      data-card-style={cards}
      data-type-scale={scale}
      data-preview={preview ? "true" : undefined}
      data-theme={isDark ? "dark" : "light"}
      style={buildThemeStyle(config)}
    >
      {theme?.customCss ? <style data-theme-css>{theme.customCss}</style> : null}
      <CustomCodeContainer
        html={config.codeInjection?.headerCode}
        containerId="custom-head-code-injection"
      />
      {children}
      <CustomCodeContainer
        html={config.codeInjection?.footerCode}
        containerId="custom-footer-code-injection"
      />
    </div>
  );
}

