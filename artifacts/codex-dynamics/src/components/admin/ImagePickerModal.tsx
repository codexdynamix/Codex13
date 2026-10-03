import React, { useState, useRef } from "react";
import { X, Upload, Check, Image as ImageIcon, Sparkles, Globe, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";

export interface ImageSelectionMeta {
  alt?: string;
  caption?: string;
  alignment?: "center" | "left" | "right" | "full";
}

interface ImagePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentValue: string;
  onSelect: (url: string, meta?: ImageSelectionMeta) => void;
  title?: string;
  showMetaOptions?: boolean;
}

const LOCAL_PRESETS = [
  { url: "/hero/studio.jpg", label: "Agency Aerial", group: "Hero" },
  { url: "/hero/web-apps.jpg", label: "Web Applications (Apple)", group: "Hero" },
  { url: "/hero/web-dev.jpg", label: "Web Development", group: "Hero" },
  { url: "/hero/design.jpg", label: "Design Workspace", group: "Hero" },
  { url: "/hero/social.jpg", label: "Social Media Campaign", group: "Hero" },
  { url: "/studio/interior.jpg", label: "Office Loft Interior", group: "Workplace" },
  { url: "/studio/headquarters.jpg", label: "Architecture Exterior", group: "Workplace" },
  { url: "/studio/code.jpg", label: "Code Terminal", group: "Workplace" },
  { url: "/studio/design.jpg", label: "Interface Design Desk", group: "Workplace" },
  { url: "/studio/wireframes.jpg", label: "Product Wireframes", group: "Workplace" },
  { url: "/studio/social.jpg", label: "Social Feed Mockup", group: "Workplace" },
  { url: "/studio/analytics.jpg", label: "Telemetry & Analytics", group: "Workplace" },
  { url: "/work/ecommerce-storefront.jpg", label: "Luxury E-Commerce Storefront", group: "Portfolio" },
  { url: "/work/nordic-goods.jpg", label: "Nordic Goods Storefront", group: "Portfolio" },
  { url: "/work/krypton-horology.jpg", label: "Krypton Horology Watches", group: "Portfolio" },
  { url: "/work/northline-logistics.jpg", label: "Northline Global Logistics", group: "Portfolio" },
  { url: "/work/crm-telephony.jpg", label: "Custom CRM & VoIP Dialer", group: "Portfolio" },
  { url: "/work/omnicall-sales.jpg", label: "OmniCall Sales Desk", group: "Portfolio" },
  { url: "/work/apex-sales.jpg", label: "Apex Sales Floor", group: "Portfolio" },
  { url: "/work/brand-identity.jpg", label: "Brand Identity & Design System", group: "Portfolio" },
  { url: "/work/ads-growth.jpg", label: "Paid Ad Analytics & Funnel", group: "Portfolio" },
  { url: "/work/aura-growth.jpg", label: "Aura Growth Engine", group: "Portfolio" },
  { url: "/work/kinetic-fitness.jpg", label: "Kinetic Fitness Ads", group: "Portfolio" },
  { url: "/work/email-funnel.jpg", label: "Email Marketing Flow", group: "Portfolio" },
  { url: "/work/flow-retain-email.jpg", label: "Aura Premium Email Sequences", group: "Portfolio" },
  { url: "/work/developer-portal.jpg", label: "iOS-Style Client Portal", group: "Portfolio" },
  { url: "/services/web-apps.jpg", label: "Custom Web Applications", group: "Services" },
  { url: "/services/acquisition-retention.jpg", label: "Ads & Email Retention", group: "Services" },
  { url: "/services/crm-calling.jpg", label: "CRM Calling System", group: "Services" },
  { url: "/work/storefront.jpg", label: "Storefront Mockup", group: "Portfolio" },
  { url: "/work/social.jpg", label: "Social Ad Campaign", group: "Portfolio" },
  { url: "/work/system.jpg", label: "Design System", group: "Portfolio" },
];

const CURATED_TECH_PRESETS = [
  {
    url: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1200&q=80",
    label: "Server Hardware & Cloud Infrastructure",
    alt: "Data center server racks with blue illumination",
    group: "Infrastructure",
  },
  {
    url: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1200&q=80",
    label: "Clean Code & Software Architecture",
    alt: "Dual display workstation showing clean code syntax",
    group: "Engineering",
  },
  {
    url: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=1200&q=80",
    label: "Minimalist Engineering Workstation",
    alt: "Minimalist workspace with laptop and mechanical keyboard",
    group: "Workplace",
  },
  {
    url: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80",
    label: "Conversion Analytics & Telemetry",
    alt: "High-level performance and conversion rate charts",
    group: "Analytics",
  },
  {
    url: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80",
    label: "Silicon Microprocessor & Low Latency",
    alt: "Macro photography of high-performance integrated circuit chip",
    group: "Hardware",
  },
  {
    url: "https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?auto=format&fit=crop&w=1200&q=80",
    label: "Design Systems & Prototyping",
    alt: "Interface wireframe components laid out systematically",
    group: "Design",
  },
  {
    url: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80",
    label: "System Metrics & Live Observability",
    alt: "Dashboard monitoring uptime, memory throughput, and TTFB",
    group: "Observability",
  },
  {
    url: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80",
    label: "Cybersecurity & Cryptographic Architecture",
    alt: "Cryptographic cipher matrix on terminal display",
    group: "Security",
  },
];

export function ImagePickerModal({
  isOpen,
  onClose,
  currentValue,
  onSelect,
  title = "Select or Upload Picture",
  showMetaOptions = true,
}: ImagePickerModalProps) {
  const [selectedUrl, setSelectedUrl] = useState(currentValue);
  const [customInput, setCustomInput] = useState(currentValue);
  const [altText, setAltText] = useState("");
  const [caption, setCaption] = useState("");
  const [alignment, setAlignment] = useState<"center" | "left" | "right" | "full">("center");
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<"curated" | "library" | "upload" | "url">("curated");
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleApply = () => {
    const finalUrl = (selectedUrl || customInput).trim();
    if (!finalUrl) {
      toast.error("Please select or enter an image URL");
      return;
    }

    onSelect(finalUrl, {
      alt: altText.trim() || undefined,
      caption: caption.trim() || undefined,
      alignment,
    });
    toast.success("Picture selected successfully");
    onClose();
  };

  const handleFileUpload = async (file: File) => {
    try {
      setIsUploading(true);
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result as string;
        const res = await fetch("/api/crm/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "upload_image",
            name: file.name,
            data: base64Data,
            payload: {
              name: file.name,
              data: base64Data,
            },
          }),
        });
        const data = await res.json();
        if (data.ok && data.url) {
          setSelectedUrl(data.url);
          setCustomInput(data.url);
          if (!altText) setAltText(file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "));
          toast.success("Image uploaded to server!");
        } else {
          toast.error(data.error || "Failed to upload image");
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      toast.error("Upload failed: " + String(err));
    } finally {
      setIsUploading(false);
    }
  };

  const currentActiveUrl = selectedUrl || customInput;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-3xl rounded-2xl sm:rounded-3xl shadow-2xl border border-black/10 overflow-hidden flex flex-col max-h-[92dvh] animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-black/8 flex items-center justify-between bg-zinc-50/80 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="size-8 rounded-xl bg-blue/10 text-blue flex items-center justify-center shrink-0">
              <ImageIcon className="size-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-label truncate font-display">{title}</h3>
              <p className="text-[11px] text-muted-foreground truncate hidden sm:block">
                Curated engineering stock, local media assets, direct uploads, or web URLs
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-subtle hover:text-label hover:bg-black/5 transition-colors cursor-pointer shrink-0 ml-2"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-black/8 px-4 sm:px-6 bg-white gap-2 sm:gap-4 overflow-x-auto no-scrollbar shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("curated")}
            className={`py-2.5 px-2 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === "curated"
                ? "border-blue text-blue"
                : "border-transparent text-muted-foreground hover:text-label"
            }`}
          >
            <Sparkles className="size-3.5" />
            <span>Tech & Architecture Stock</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("library")}
            className={`py-2.5 px-2 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === "library"
                ? "border-blue text-blue"
                : "border-transparent text-muted-foreground hover:text-label"
            }`}
          >
            Local Media Library
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("upload")}
            className={`py-2.5 px-2 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === "upload"
                ? "border-blue text-blue"
                : "border-transparent text-muted-foreground hover:text-label"
            }`}
          >
            <Upload className="size-3.5" />
            <span>Upload File</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("url")}
            className={`py-2.5 px-2 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === "url"
                ? "border-blue text-blue"
                : "border-transparent text-muted-foreground hover:text-label"
            }`}
          >
            <Globe className="size-3.5" />
            <span>External URL</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Curated Tech Stock Tab */}
          {activeTab === "curated" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground pb-1">
                <span>Royalty-free high-resolution imagery for engineering teardowns:</span>
                <span className="font-mono text-[10px] bg-black/5 px-2 py-0.5 rounded">Unsplash High-Res</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3">
                {CURATED_TECH_PRESETS.map((item) => {
                  const isChosen = selectedUrl === item.url;
                  return (
                    <button
                      key={item.url}
                      type="button"
                      onClick={() => {
                        setSelectedUrl(item.url);
                        setCustomInput(item.url);
                        if (!altText) setAltText(item.alt);
                      }}
                      className={`group relative flex flex-col rounded-xl overflow-hidden border text-left transition-all cursor-pointer ${
                        isChosen
                          ? "ring-2 ring-blue border-transparent shadow-md"
                          : "border-black/10 hover:border-blue/50"
                      }`}
                    >
                      <div className="aspect-[16/10] bg-zinc-100 relative overflow-hidden">
                        <img
                          src={item.url}
                          alt={item.label}
                          className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                          loading="lazy"
                        />
                        {isChosen && (
                          <div className="absolute top-1.5 right-1.5 size-5 rounded-full bg-blue text-white flex items-center justify-center shadow-xs">
                            <Check className="size-3 stroke-[3]" />
                          </div>
                        )}
                        <span className="absolute bottom-1 left-1.5 px-1.5 py-0.5 rounded text-[9px] font-medium bg-black/60 text-white backdrop-blur-xs">
                          {item.group}
                        </span>
                      </div>
                      <div className="p-2 bg-white flex-1 flex flex-col justify-between">
                        <span className="text-[11px] font-semibold text-label block line-clamp-1">
                          {item.label}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Local Media Presets */}
          {activeTab === "library" && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground pb-1">
                Assets stored in the Codex Dynamics project public directory:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3">
                {LOCAL_PRESETS.map((item) => {
                  const isChosen = selectedUrl === item.url;
                  return (
                    <button
                      key={item.url}
                      type="button"
                      onClick={() => {
                        setSelectedUrl(item.url);
                        setCustomInput(item.url);
                        if (!altText) setAltText(item.label);
                      }}
                      className={`group relative flex flex-col rounded-xl overflow-hidden border text-left transition-all cursor-pointer ${
                        isChosen
                          ? "ring-2 ring-blue border-transparent shadow-md"
                          : "border-black/10 hover:border-blue/50"
                      }`}
                    >
                      <div className="aspect-[4/3] bg-zinc-100 relative overflow-hidden">
                        <img
                          src={item.url}
                          alt={item.label}
                          className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                        {isChosen && (
                          <div className="absolute top-1.5 right-1.5 size-5 rounded-full bg-blue text-white flex items-center justify-center shadow-xs">
                            <Check className="size-3 stroke-[3]" />
                          </div>
                        )}
                        <span className="absolute bottom-1 left-1.5 px-1.5 py-0.5 rounded text-[9px] font-medium bg-black/60 text-white backdrop-blur-xs">
                          {item.group}
                        </span>
                      </div>
                      <div className="p-2 bg-white">
                        <span className="text-[11px] font-medium text-label block truncate">
                          {item.label}
                        </span>
                        <span className="text-[9px] text-muted-foreground block truncate font-mono">
                          {item.url}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Upload File */}
          {activeTab === "upload" && (
            <div className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-black/15 rounded-2xl p-6 sm:p-10 flex flex-col items-center justify-center text-center hover:border-blue/50 hover:bg-blue/[0.01] transition-all cursor-pointer"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                />
                <div className="size-12 rounded-xl bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center mb-3">
                  <Upload className="size-5" />
                </div>
                <p className="text-sm font-semibold text-neutral-900">
                  {isUploading ? "Uploading picture to server..." : "Click or drag picture here to upload"}
                </p>
                <p className="text-xs text-neutral-500 mt-1 max-w-sm">
                  Supports WebP, JPG, PNG, and SVG. Persisted permanently in SQLite and served through the public uploads API.
                </p>
              </div>

              {selectedUrl && (
                <div className="p-3 bg-neutral-50 rounded-xl border border-black/[0.08] flex items-center gap-3">
                  <img
                    src={selectedUrl}
                    alt="Uploaded preview"
                    className="size-14 rounded-lg object-cover border border-black/[0.08] shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-semibold text-neutral-900 block truncate">Selected Upload</span>
                    <span className="text-[11px] text-neutral-500 font-mono block truncate">{selectedUrl}</span>
                  </div>
                  <span className="text-xs text-emerald-700 font-semibold px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200/60 shrink-0">
                    Ready
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Direct URL */}
          {activeTab === "url" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-label mb-1.5">
                  Direct Web URL or Asset Path
                </label>
                <input
                  type="text"
                  value={customInput}
                  onChange={(e) => {
                    setCustomInput(e.target.value);
                    setSelectedUrl(e.target.value);
                  }}
                  placeholder="e.g. https://images.unsplash.com/... or /hero/web-dev.jpg"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-black/15 focus:outline-none focus:border-blue font-mono"
                />
              </div>

              {customInput && (
                <div className="border border-black/10 rounded-xl p-3 bg-zinc-50 space-y-2">
                  <span className="text-xs font-semibold text-label block">Live URL Preview</span>
                  <div className="max-h-40 overflow-hidden rounded-lg bg-white border border-black/6 flex items-center justify-center">
                    <img
                      src={customInput}
                      alt="URL preview"
                      className="max-h-40 w-auto object-contain"
                      onError={(e) => {
                        (e.target as HTMLElement).parentElement!.innerHTML =
                          "<div class='p-4 text-xs text-red-500'>Unable to load image from this URL</div>";
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SEO Alt Text & Caption Settings for Selected Image */}
          {showMetaOptions && currentActiveUrl && (
            <div className="p-3.5 rounded-2xl bg-zinc-50 border border-black/8 space-y-3 mt-4">
              <div className="flex items-center gap-2 text-xs font-bold text-label">
                <SlidersHorizontal className="size-3.5 text-blue" />
                <span>Picture Formatting & SEO Alt Attributes</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-subtle block mb-1">
                    Image Alt Description (Rank Math SEO) *
                  </label>
                  <input
                    type="text"
                    value={altText}
                    onChange={(e) => setAltText(e.target.value)}
                    placeholder="Descriptive alt text for accessibility & SEO"
                    className="w-full px-3 py-1.5 text-xs bg-white border border-black/10 rounded-lg focus:border-blue outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-subtle block mb-1">
                    Visible Caption / Credit (Optional)
                  </label>
                  <input
                    type="text"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Figure 1: Architectural benchmark comparison"
                    className="w-full px-3 py-1.5 text-xs bg-white border border-black/10 rounded-lg focus:border-blue outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <span className="text-[11px] font-semibold text-subtle">Alignment:</span>
                {(["center", "left", "right", "full"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setAlignment(mode)}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-md capitalize cursor-pointer transition-colors ${
                      alignment === mode
                        ? "bg-blue text-white shadow-xs"
                        : "bg-white border border-black/10 text-muted-foreground hover:text-label"
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 border-t border-black/8 bg-zinc-50/80 flex items-center justify-between shrink-0">
          <div className="min-w-0 pr-2">
            <span className="text-xs text-muted-foreground truncate block font-mono">
              Selected: <strong className="text-label">{currentActiveUrl || "None"}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-xl border border-black/10 text-muted-foreground hover:text-label hover:bg-black/5 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-4 py-1.5 text-xs font-semibold rounded-xl bg-blue text-white hover:bg-blue-hover shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Check className="size-3.5" />
              <span>Use Picture</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
