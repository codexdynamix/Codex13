import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  ArrowLeft,
  Plus,
  Undo2,
  Redo2,
  Settings,
  TrendingUp,
  Eye,
  Code,
  Laptop,
  Smartphone,
  ExternalLink,
  Check,
  ChevronDown,
  ChevronRight,
  Bold,
  Italic,
  Strikethrough,
  Heading2,
  Heading3,
  Quote,
  List,
  ListOrdered,
  Link as LinkIcon,
  Code2,
  Table as TableIcon,
  Image as ImageIcon,
  Zap,
  CheckCircle2,
  AlertCircle,
  X,
  Search,
  FileText,
  BookOpen,
  Sparkles,
  Save,
  Send,
  Sliders,
  Copy,
  Share2,
  Globe,
  Tag,
  FolderTree,
  Calendar,
  User,
  MessageSquare,
  HelpCircle,
  Shield,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { calculateReadingTime } from "@/lib/reading-time";
import { analyzePowerWords, POWER_WORDS_DICTIONARY } from "@/lib/power-words";
import type { BlogCategory } from "@/lib/categories";
import {
  addAdminBlogCategory,
  getAdminBlogCategories,
} from "@/crm/admin-app/adminApi";
import { ImagePickerModal, type ImageSelectionMeta } from "./ImagePickerModal";
import type { BlogPost } from "@/types/crm";

interface BlogEditorPageProps {
  editingId: number | null;
  initialBlog?: Partial<BlogPost> | null;
  onBack: () => void;
  onSave: (data: any, status: "published" | "draft" | "archived") => Promise<boolean>;
}

const PRESET_AUTHORS = [
  "Codex Dynamics Research",
  "Codex Dynamics Engineering",
  "Codex Dynamics Editorial Team",
  "Founder & Principal Architect",
  "DevOps & Infrastructure Team",
];

const POPULAR_TAGS = [
  "Engineering",
  "Architecture",
  "Performance",
  "Design Systems",
  "TypeScript",
  "React 19",
  "Core Web Vitals",
  "Next.js",
  "Micro-Frontends",
  "API Design",
  "Security",
  "Cloud",
];

export function BlogEditorPage({
  editingId,
  initialBlog,
  onBack,
  onSave,
}: BlogEditorPageProps) {
  // 1. Core Post Form States
  const [title, setTitle] = useState(initialBlog?.title || "");
  const [slug, setSlug] = useState(initialBlog?.slug || "");
  const [excerpt, setExcerpt] = useState(initialBlog?.excerpt || "");
  const [content, setContent] = useState(
    initialBlog?.content ||
      `## Executive Overview\n\nModern digital infrastructure demands sub-second latencies and uncompromised architectural resilience. In this technical deep-dive, we deconstruct the core principles required to ship zero-latency enterprise systems.\n\n### 1. Architectural Foundation\n\nBy leveraging edge computing and streaming hydration, application cold-starts can be systematically reduced by over **64%**.\n\n| Architecture Metric | Legacy Monolith | Modern Edge Blueprint |\n| :--- | :--- | :--- |\n| TTFB (Global) | 420ms | 38ms |\n| LCP Score | 2.8s | 0.72s |\n| Hydration Overhead | 450KB | 18KB |\n\n> "Simplicity is prerequisite for reliability." — Edsger W. Dijkstra\n\n### 2. Implementation Playbook\n\nTo implement these benchmarks, begin with modular route isolation and progressive bundle optimization.`
  );
  const [selectedCategory, setSelectedCategory] = useState(
    initialBlog?.category || "Engineering"
  );
  const [tags, setTags] = useState<string[]>(
    initialBlog?.tags
      ? Array.isArray(initialBlog.tags)
        ? initialBlog.tags
        : initialBlog.tags.split(",").map((t) => t.trim())
      : ["Engineering", "Architecture", "Performance"]
  );
  const [tagInput, setTagInput] = useState("");
  const [author, setAuthor] = useState(
    initialBlog?.author || "Codex Dynamics Research"
  );
  const [status, setStatus] = useState<"published" | "draft" | "archived">(
    (initialBlog?.status as any) || "published"
  );
  const [imageUrl, setImageUrl] = useState(
    initialBlog?.cover_image ||
      initialBlog?.image_url ||
      "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1200&q=80"
  );
  const [imageAlt, setImageAlt] = useState(
    initialBlog?.image_alt || "High-performance software architecture"
  );
  const [imageCaption, setImageCaption] = useState(
    initialBlog?.image_caption || "Codex Dynamics systems architecture"
  );

  // 2. SEO & Rank Math States
  const [focusKeyword, setFocusKeyword] = useState("Architectural");
  const [secondaryKeywords, setSecondaryKeywords] = useState<string[]>([
    "zero-latency",
    "edge computing",
  ]);
  const [secKeywordInput, setSecKeywordInput] = useState("");
  const [seoTitle, setSeoTitle] = useState(
    initialBlog?.title || "Architectural Teardown: High-Performance Systems"
  );
  const [seoDescription, setSeoDescription] = useState(
    initialBlog?.excerpt ||
      "Discover core principles for deploying zero-latency, edge-optimized enterprise web applications with Codex Dynamics."
  );
  const [canonicalUrl, setCanonicalUrl] = useState(
    initialBlog?.slug
      ? `https://codexdynamics.com/blog/${initialBlog.slug}`
      : ""
  );
  const [schemaType, setSchemaType] = useState<
    "Article" | "TechArticle" | "NewsArticle" | "HowTo"
  >("TechArticle");
  const [robotsMeta, setRobotsMeta] = useState({
    index: true,
    follow: true,
    noarchive: false,
    nosnippet: false,
  });
  const [allowComments, setAllowComments] = useState(true);
  const [enableToc, setEnableToc] = useState(true);

  // 3. UI Control States
  const [editorView, setEditorView] = useState<"visual" | "code" | "preview">("visual");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<"settings" | "seo">("settings");
  const [rankMathTab, setRankMathTab] = useState<
    "general" | "advanced" | "schema" | "social" | "powerwords"
  >("general");
  const [serpDevice, setSerpDevice] = useState<"desktop" | "mobile">("desktop");
  const [socialPlatform, setSocialPlatform] = useState<"facebook" | "twitter">("facebook");
  const [isImagePickerOpen, setIsImagePickerOpen] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [linkUrlInput, setLinkUrlInput] = useState("");
  const [linkTextInput, setLinkTextInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // 4. Sidebar Accordion Collapsibles
  const [accordionState, setAccordionState] = useState({
    status: true,
    image: true,
    categories: true,
    tags: true,
    discussion: false,
  });

  const toggleAccordion = (key: keyof typeof accordionState) => {
    setAccordionState((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // 5. Categories Management
  const [categoriesList, setCategoriesList] = useState<BlogCategory[]>([]);
  const [newCatName, setNewCatName] = useState("");
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categorySaving, setCategorySaving] = useState(false);

  useEffect(() => {
    let active = true;
    const loadCategories = async () => {
      setCategoriesLoading(true);
      try {
        const categories = await getAdminBlogCategories();
        if (active) setCategoriesList(categories);
      } catch (error) {
        if (active) toast.error(error instanceof Error ? error.message : "Blog categories could not be loaded.");
      } finally {
        if (active) setCategoriesLoading(false);
      }
    };
    void loadCategories();
    return () => { active = false; };
  }, []);

  const handleAddNewCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim() || categorySaving) return;
    setCategorySaving(true);
    try {
      const result = await addAdminBlogCategory(newCatName.trim());
      const categories = await getAdminBlogCategories();
      setCategoriesList(categories);
      setSelectedCategory(result.category?.name || newCatName.trim());
      setNewCatName("");
      setIsAddingCategory(false);
      toast.success(`Category "${result.category?.name || newCatName.trim()}" saved`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Category could not be saved.");
    } finally {
      setCategorySaving(false);
    }
  };

  // 6. Content Stats & Power Words
  const contentStats = useMemo(() => {
    return calculateReadingTime(content);
  }, [content]);

  const powerWordsAnalysis = useMemo(() => {
    return analyzePowerWords(title, content);
  }, [title, content]);

  // Track changes (skip initial mount to avoid premature unsaved state)
  const isMountedRef = useRef(false);
  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      return;
    }
    setHasUnsavedChanges(true);
  }, [title, slug, excerpt, content, selectedCategory, tags, author, status, imageUrl]);

  // Auto-generate slug if empty
  const handleAutoSlug = () => {
    if (!title) return;
    const generated = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    setSlug(generated);
    if (!canonicalUrl) {
      setCanonicalUrl(`https://codexdynamics.com/blog/${generated}`);
    }
  };

  // 7. Rank Math SEO Score Calculation
  const rankMathChecks = useMemo(() => {
    const kw = focusKeyword.trim().toLowerCase();
    const hasKw = Boolean(kw);
    const inTitle = hasKw && title.toLowerCase().includes(kw);
    const inDesc = hasKw && (seoDescription || excerpt).toLowerCase().includes(kw);
    const inContent = hasKw && content.toLowerCase().includes(kw);
    const inSlug = hasKw && slug.toLowerCase().includes(kw.replace(/\s+/g, "-"));
    const titleLengthOk = title.length >= 40 && title.length <= 65;
    const descLengthOk = (seoDescription || excerpt).length >= 120 && (seoDescription || excerpt).length <= 160;
    const hasHeadings = /^#{2,4}\s/m.test(content);
    const hasPowerWord = powerWordsAnalysis.headlineHasPowerWord;
    const hasNumber = /\d+/.test(title);
    const wordCountOk = contentStats.words >= 300;

    const list = [
      {
        id: "kw-title",
        label: "Focus Keyword appears in SEO title",
        passed: inTitle,
        weight: 15,
        tip: "Add your main keyword near the beginning of the title.",
      },
      {
        id: "kw-desc",
        label: "Focus Keyword appears in meta description",
        passed: inDesc,
        weight: 12,
        tip: "Include your primary keyword naturally in the snippet description.",
      },
      {
        id: "kw-url",
        label: "Focus Keyword appears in the URL slug",
        passed: inSlug,
        weight: 10,
        tip: "Keep the URL slug short and keyword-rich.",
      },
      {
        id: "kw-content",
        label: "Focus Keyword used in article body",
        passed: inContent,
        weight: 15,
        tip: "Mention the focus keyword in the introductory paragraphs.",
      },
      {
        id: "title-len",
        label: "Title is within optimal length (40–65 characters)",
        passed: titleLengthOk,
        weight: 10,
        tip: `Current title length is ${title.length} characters.`,
      },
      {
        id: "desc-len",
        label: "Meta description length is optimal (120–160 characters)",
        passed: descLengthOk,
        weight: 8,
        tip: `Current description is ${(seoDescription || excerpt).length} characters.`,
      },
      {
        id: "power-word",
        label: "Headline includes high-converting Power Word",
        passed: hasPowerWord,
        weight: 10,
        tip: "Incorporate emotional or authoritative words (e.g. Blueprint, Definitive, Zero-latency).",
      },
      {
        id: "number-title",
        label: "Title contains a specific number or metric",
        passed: hasNumber,
        weight: 6,
        tip: "Numbers in headlines boost click-through rates by up to 36%.",
      },
      {
        id: "headings",
        label: "Content organized with H2 / H3 subheadings",
        passed: hasHeadings,
        weight: 8,
        tip: "Structure content with clear modular headers for readability.",
      },
      {
        id: "word-count",
        label: "Article meets minimum depth (300+ words)",
        passed: wordCountOk,
        weight: 6,
        tip: `Current length is ${contentStats.words} words. Aim for comprehensive teardowns.`,
      },
    ];

    const score = list.reduce((acc, curr) => (curr.passed ? acc + curr.weight : acc), 0);

    return { list, score: Math.min(100, score) };
  }, [focusKeyword, title, seoDescription, excerpt, content, slug, powerWordsAnalysis, contentStats]);

  const rankMathScore = rankMathChecks.score;

  // 8. Tags Management
  const handleAddTag = (tagToAdd: string) => {
    const trimmed = tagToAdd.trim().replace(/^#/, "");
    if (!trimmed || tags.includes(trimmed)) return;
    setTags((prev) => [...prev, trimmed]);
    setTagInput("");
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags((prev) => prev.filter((t) => t !== tagToRemove));
  };

  // 9. Markdown Formatting Helper
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleInsertFormatting = (prefix: string, suffix: string = "", placeholder: string = "") => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    const replacement = selectedText
      ? `${prefix}${selectedText}${suffix}`
      : `${prefix}${placeholder}${suffix}`;

    const newContent = content.substring(0, start) + replacement + content.substring(end);
    setContent(newContent);

    setTimeout(() => {
      textarea.focus();
      const cursorTarget = start + prefix.length + (selectedText ? selectedText.length : placeholder.length);
      textarea.setSelectionRange(cursorTarget, cursorTarget);
    }, 0);
  };

  // Save handler
  const handleSavePost = async (targetStatus: "published" | "draft" | "archived" = status) => {
    if (!title.trim()) {
      toast.error("Please provide an article title before saving.");
      return;
    }

    setIsSaving(true);
    try {
      const payload: Partial<BlogPost> = {
        id: editingId || undefined,
        title: title.trim(),
        slug: slug.trim() || title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        excerpt: excerpt.trim(),
        content,
        category: selectedCategory,
        tags,
        author: author.trim(),
        status: targetStatus,
        cover_image: imageUrl,
        image_url: imageUrl,
        image_alt: imageAlt,
        image_caption: imageCaption,
      };

      const success = await onSave(payload, targetStatus);
      if (success) {
        setHasUnsavedChanges(false);
        setStatus(targetStatus);
        toast.success(
          targetStatus === "published"
            ? "Article published successfully to Codex Dynamics!"
            : "Draft saved successfully."
        );
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save article");
    } finally {
      setIsSaving(false);
    }
  };

  // Confirm link modal insertion
  const handleConfirmLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkUrlInput) return;
    const label = linkTextInput || linkUrlInput;
    handleInsertFormatting(`[${label}](`, `${linkUrlInput})`, "");
    setIsLinkModalOpen(false);
    setLinkUrlInput("");
    setLinkTextInput("");
  };

  return (
    <div className="crm-blog-editor w-full text-[#EAECEF] min-h-screen pb-16">
      {/* ========================================================================= */}
      {/* 1. TOP EDITORIAL BANNER: POLISHED, CRISP, CONSISTENT WITH CODEX CRM       */}
      {/* ========================================================================= */}
      <div className="crm-blogs-section-banner">
        {/* Top Header Row: Breadcrumbs on Left, Back to Content on TOP RIGHT */}
        <div className="flex items-center justify-between gap-4 pb-3.5 mb-4 border-b border-[#444A55]/60 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold text-[#F0B90B] uppercase tracking-wider">
              Leads / Content / Editorial
            </span>
            <span className="text-[#848E9C]">·</span>
            <span className="text-[11px] font-semibold text-[#848E9C]">
              {editingId ? "Edit Article" : "New Blog Article"}
            </span>
            {hasUnsavedChanges ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                <span className="size-1.5 rounded-full bg-amber-400 animate-pulse" />
                Unsaved Edits
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <Check size={12} strokeWidth={2.5} />
                Saved
              </span>
            )}
          </div>

          {/* Top Right Corner: Unique Color Identified Button */}
          <button
            type="button"
            onClick={() => onBack()}
            className="crm-blog-back-btn-corner group shrink-0 cursor-pointer"
            title="Return to Content & Articles list"
          >
            <ArrowLeft size={16} strokeWidth={2.5} className="transition-transform group-hover:-translate-x-1" />
            <span>Back to Content</span>
          </button>
        </div>

        {/* Lower Banner Row: Title on Left, Controls on Right */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-[#EAECEF] tracking-tight m-0">
              {editingId ? "Edit Architectural Article" : "New Architectural Teardown"}
            </h1>
            <p className="text-xs text-[#848E9C] mt-1 max-w-2xl leading-relaxed m-0">
              Craft, optimize with Rank Math SEO & Power Words, and publish technical insights directly to the Codex Dynamics site.
            </p>
          </div>

          {/* Right: Actions, Rank Math Score Pill, and Save Controls */}
          <div className="flex items-center gap-2.5 self-start lg:self-center shrink-0 flex-wrap">
            {/* View Mode Switcher */}
            <div className="crm-segmented-group inline-flex items-center bg-[#181A20] p-1.5 rounded-xl border border-[#444A55] gap-2 h-[42px] box-border shrink-0">
              <button
                type="button"
                onClick={() => setEditorView("visual")}
                className={`crm-tab-btn ${editorView === "visual" ? "active" : ""}`}
              >
                <Eye size={13} />
                <span>Visual</span>
              </button>
              <button
                type="button"
                onClick={() => setEditorView("code")}
                className={`crm-tab-btn ${editorView === "code" ? "active" : ""}`}
              >
                <Code size={13} />
                <span>Markdown</span>
              </button>
              <button
                type="button"
                onClick={() => setEditorView("preview")}
                className={`crm-tab-btn ${editorView === "preview" ? "active" : ""}`}
              >
                <FileText size={13} />
                <span>Reader</span>
              </button>
            </div>

            {/* Save Draft Button */}
            <button
              type="button"
              onClick={() => handleSavePost("draft")}
              disabled={isSaving}
              className="crm-btn-secondary"
            >
              <Save size={14} className="text-[#848E9C]" />
              <span>Save Draft</span>
            </button>

            {/* Publish Article Button */}
            <button
              type="button"
              onClick={() => handleSavePost("published")}
              disabled={isSaving}
              className="crm-btn-accent"
            >
              <Send size={14} />
              <span>{isSaving ? "Saving..." : status === "published" ? "Update Article" : "Publish Article"}</span>
            </button>

            {/* Rank Math SEO Score Capsule */}
            <button
              type="button"
              onClick={() => {
                setIsSidebarOpen(true);
                setSidebarTab("seo");
                const el = document.getElementById("rank-math-meta-box");
                el?.scrollIntoView({ behavior: "smooth" });
              }}
              className={`crm-seo-score-btn ${
                rankMathScore >= 80 ? "score-high" : rankMathScore >= 60 ? "score-med" : "score-low"
              }`}
              title="Rank Math SEO Score"
            >
              <TrendingUp size={13} />
              <span>SEO {rankMathScore}/100</span>
            </button>

            {/* Settings Sidebar Toggle */}
            <button
              type="button"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="crm-btn-icon"
              title={isSidebarOpen ? "Hide Inspector Sidebar" : "Show Inspector Sidebar"}
            >
              <Sliders size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. MAIN 2-COLUMN LAYOUT (Left: Studio + Rank Math | Right: Inspector)       */}
      {/* ========================================================================= */}
      <div className="w-full flex flex-col lg:flex-row gap-6 items-start">
        {/* ======================================================================= */}
        {/* LEFT COLUMN: WRITING STUDIO & RANK MATH SEO SUITE                       */}
        {/* ======================================================================= */}
        <div className="flex-1 min-w-0 w-full space-y-6">
          {/* CARD 1: ARTICLE METADATA (Title, Slug, Excerpt) */}
          <div className="crm-card-panel space-y-6">
            {/* Title Input */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-[#A8AEB8] mb-2 block">
                Article Title <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => {
                  if (!slug && title) handleAutoSlug();
                }}
                placeholder="e.g. Architectural Teardown: Edge Computing & Zero-Latency Runtimes"
                className="crm-blog-title-input w-full text-lg sm:text-xl font-bold"
              />
              <div className="flex items-center justify-between text-xs text-[#848E9C] mt-2 px-0.5">
                <span>Aim for 40–65 characters for optimal SERP CTR.</span>
                <span className={title.length >= 40 && title.length <= 65 ? "text-emerald-400 font-mono font-semibold" : "text-[#848E9C] font-mono"}>
                  {title.length} chars
                </span>
              </div>
            </div>

            {/* Permalink / Slug with Preview */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold uppercase tracking-wider text-[#A8AEB8] block">
                  Permalink Slug
                </label>
                <button
                  type="button"
                  onClick={handleAutoSlug}
                  className="crm-link-btn"
                >
                  Auto-generate from title
                </button>
              </div>
              <div className="flex items-center bg-[#2A2E36] border border-[#444A55] rounded-xl px-4 py-2.5 focus-within:border-[#F0B90B] focus-within:ring-2 focus-within:ring-[#F0B90B]/20">
                <span className="text-xs text-[#848E9C] font-mono select-none pr-1 shrink-0">
                  codexdynamics.com/blog/
                </span>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                  placeholder="post-slug-url"
                  className="border-none! bg-transparent! p-0! text-xs font-mono text-[#EAECEF] focus:ring-0! focus:border-none! w-full"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(`https://codexdynamics.com/blog/${slug}`);
                    toast.success("Article link copied to clipboard");
                  }}
                  className="crm-toolbar-btn shrink-0 ml-2"
                  title="Copy full public link"
                >
                  <Copy size={14} />
                </button>
              </div>
            </div>

            {/* Summary / Excerpt */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold uppercase tracking-wider text-[#A8AEB8] block">
                  Executive Excerpt
                </label>
                <span className={excerpt.length >= 120 && excerpt.length <= 160 ? "text-emerald-400 font-mono text-xs font-semibold" : "text-[#848E9C] font-mono text-xs"}>
                  {excerpt.length} / 160 chars
                </span>
              </div>
              <textarea
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                placeholder="A compelling, succinct 2-sentence synopsis displayed on article cards, search snippets, and social previews."
                rows={3}
                className="crm-blog-excerpt-textarea w-full leading-relaxed"
              />
            </div>
          </div>

          {/* CARD 2: WRITING CANVAS & RICH FORMATTING TOOLBAR */}
          <div className="crm-card-panel space-y-4">
            {/* Formatting Toolbar */}
            <div className="flex items-center justify-between gap-2 flex-wrap pb-3 border-b border-[#444A55]">
              {/* Left Button Clusters */}
              <div className="flex items-center gap-1 flex-wrap">
                {/* Cluster: Headings */}
                <button
                  type="button"
                  onClick={() => handleInsertFormatting("## ", "", "Heading 2")}
                  className="crm-toolbar-btn"
                  title="Heading 2 (##)"
                >
                  <Heading2 size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertFormatting("### ", "", "Heading 3")}
                  className="crm-toolbar-btn"
                  title="Heading 3 (###)"
                >
                  <Heading3 size={15} />
                </button>

                <div className="w-[1px] h-4 bg-[#444A55] mx-1" />

                {/* Cluster: Inline Styles */}
                <button
                  type="button"
                  onClick={() => handleInsertFormatting("**", "**", "bold text")}
                  className="crm-toolbar-btn"
                  title="Bold (Ctrl+B)"
                >
                  <Bold size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertFormatting("*", "*", "italic text")}
                  className="crm-toolbar-btn"
                  title="Italic (Ctrl+I)"
                >
                  <Italic size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertFormatting("~~", "~~", "strikethrough text")}
                  className="crm-toolbar-btn"
                  title="Strikethrough (~~)"
                >
                  <Strikethrough size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertFormatting("`", "`", "inline_code()")}
                  className="crm-toolbar-btn"
                  title="Inline Code (`)"
                >
                  <Code2 size={15} />
                </button>

                <div className="w-[1px] h-4 bg-[#444A55] mx-1" />

                {/* Cluster: Lists & Quotes */}
                <button
                  type="button"
                  onClick={() => handleInsertFormatting("- ", "", "List item")}
                  className="crm-toolbar-btn"
                  title="Bulleted List"
                >
                  <List size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertFormatting("1. ", "", "Ordered list item")}
                  className="crm-toolbar-btn"
                  title="Numbered List"
                >
                  <ListOrdered size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertFormatting("> ", "", "Notable quote or architectural excerpt")}
                  className="crm-toolbar-btn"
                  title="Blockquote"
                >
                  <Quote size={15} />
                </button>

                <div className="w-[1px] h-4 bg-[#444A55] mx-1" />

                {/* Cluster: Inserts (Link, Table, Image, Power Words) */}
                <button
                  type="button"
                  onClick={() => setIsLinkModalOpen(true)}
                  className="crm-toolbar-btn"
                  title="Insert Hyperlink"
                >
                  <LinkIcon size={15} />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleInsertFormatting(
                      "\n| Architecture Component | Latency Benchmark | Target SLA |\n| :--- | :--- | :--- |\n| Global Edge Routing | 24ms | < 50ms |\n| Distributed Cache | 4ms | < 10ms |\n\n"
                    )
                  }
                  className="crm-toolbar-btn"
                  title="Insert Comparison Table"
                >
                  <TableIcon size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsImagePickerOpen(true)}
                  className="crm-toolbar-btn"
                  title="Select / Upload Media Image"
                >
                  <ImageIcon size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById("rank-math-meta-box");
                    el?.scrollIntoView({ behavior: "smooth" });
                    setRankMathTab("powerwords");
                  }}
                  className="crm-toolbar-btn text-[#F0B90B]!"
                  title="Power Words Audit"
                >
                  <Sparkles size={15} />
                </button>
              </div>

              {/* Right Stats & Word Metrics */}
              <div className="flex items-center gap-3 text-xs text-[#848E9C]">
                <span className="font-mono">{contentStats.words} words</span>
                <span>·</span>
                <span className="font-mono">{contentStats.text}</span>
              </div>
            </div>

            {/* Writing Surface: Visual (Split Editor + Preview) vs Code (Full Canvas) vs Reader */}
            <div className="relative min-h-[520px]">
              {editorView === "code" && (
                <textarea
                  ref={textareaRef}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Draft your deep-dive in Markdown here..."
                  className="crm-blog-content-textarea w-full min-h-[520px] font-mono text-sm leading-relaxed resize-y"
                  style={{ minHeight: "520px" }}
                />
              )}

              {editorView === "visual" && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 min-h-[520px]">
                  {/* Left: Interactive Markdown Editor */}
                  <div className="flex flex-col">
                    <div className="text-xs font-bold text-[#A8AEB8] uppercase tracking-wider mb-2 flex items-center justify-between">
                      <span>Editor Workspace</span>
                      <span className="text-[11px] text-[#848E9C] font-mono">{contentStats.words} words</span>
                    </div>
                    <textarea
                      ref={textareaRef}
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="Draft your deep-dive in Markdown here..."
                      className="crm-blog-content-textarea w-full flex-1 min-h-[480px] font-mono text-sm leading-relaxed resize-y"
                    />
                  </div>

                  {/* Right: Live Formatted Preview */}
                  <div className="flex flex-col">
                    <div className="text-xs font-bold text-[#F0B90B] uppercase tracking-wider mb-2 flex items-center justify-between">
                      <span>Live Formatted Preview</span>
                      <span className="text-[11px] text-emerald-400 font-mono">Syncing</span>
                    </div>
                    <div className="w-full flex-1 min-h-[480px] bg-[#2A2E36] border border-[#444A55] rounded-xl p-6 overflow-y-auto space-y-4">
                      <div className="prose prose-invert max-w-none text-sm leading-relaxed space-y-3">
                        {content.split("\n\n").map((block, idx) => {
                          if (block.startsWith("## ")) {
                            return (
                              <h2 key={idx} className="text-xl font-bold text-[#EAECEF] border-b border-[#444A55] pb-2 mt-4">
                                {block.replace("## ", "")}
                              </h2>
                            );
                          }
                          if (block.startsWith("### ")) {
                            return (
                              <h3 key={idx} className="text-base font-bold text-[#F0B90B] mt-3">
                                {block.replace("### ", "")}
                              </h3>
                            );
                          }
                          if (block.startsWith("> ")) {
                            return (
                              <blockquote key={idx} className="border-l-4 border-[#F0B90B] pl-4 italic text-[#A8AEB8] my-3">
                                {block.replace("> ", "")}
                              </blockquote>
                            );
                          }
                          if (block.startsWith("|")) {
                            return (
                              <div key={idx} className="overflow-x-auto my-3 border border-[#444A55] rounded-lg">
                                <table className="w-full text-xs text-left">
                                  <tbody>
                                    {block
                                      .split("\n")
                                      .filter((row) => !row.includes(":---"))
                                      .map((row, rIdx) => (
                                        <tr key={rIdx} className={rIdx === 0 ? "bg-[#30353E] font-bold text-[#EAECEF]" : "border-t border-[#444A55]"}>
                                          {row
                                            .split("|")
                                            .filter((c) => c.trim().length > 0)
                                            .map((col, cIdx) => (
                                              <td key={cIdx} className="p-2.5">
                                                {col.trim()}
                                              </td>
                                            ))}
                                        </tr>
                                      ))}
                                  </tbody>
                                </table>
                              </div>
                            );
                          }
                          return (
                            <p key={idx} className="text-sm text-[#EAECEF] leading-relaxed">
                              {block}
                            </p>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {editorView === "preview" && (
                <div className="w-full min-h-[460px] bg-[#22262E] border border-[#444A55] rounded-lg p-6 sm:p-8">
                  {/* Article Hero Simulation */}
                  <div className="max-w-2xl mx-auto space-y-4">
                    <span className="inline-block px-2.5 py-1 rounded-md bg-[#0071E3]/20 text-[#0071E3] text-[11px] font-bold uppercase tracking-wider">
                      {selectedCategory}
                    </span>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-[#EAECEF] tracking-tight">
                      {title || "Untitled Article"}
                    </h1>
                    <div className="flex items-center gap-3 text-xs text-[#848E9C]">
                      <span>{author}</span>
                      <span>·</span>
                      <span>{contentStats.text}</span>
                      <span>·</span>
                      <span>Published on Codex Dynamics</span>
                    </div>

                    {imageUrl && (
                      <div className="rounded-xl overflow-hidden border border-[#444A55] my-4 max-h-[300px]">
                        <img src={imageUrl} alt={imageAlt} className="w-full h-full object-cover" />
                      </div>
                    )}

                    <div className="text-xs text-[#A8AEB8] italic border-l-2 border-[#F0B90B] pl-3 py-1">
                      {excerpt}
                    </div>

                    <div className="prose prose-invert text-xs leading-relaxed text-[#EAECEF] space-y-3 pt-4 border-t border-[#444A55]">
                      {content.split("\n\n").slice(0, 4).map((p, idx) => (
                        <p key={idx}>{p.replace(/^[#>-]\s+/, "")}</p>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* CARD 3: RANK MATH SEO & POWER WORDS SUITE */}
          <div id="rank-math-meta-box" className="crm-card-panel space-y-5">
            {/* Header with Live Rank Math Score Badge */}
            <div className="flex items-center justify-between pb-3 border-b border-[#444A55] flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <span className="p-2 rounded-lg bg-[#0071E3]/15 text-[#0071E3] border border-[#0071E3]/30">
                  <TrendingUp size={18} />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-[#EAECEF] m-0">Rank Math SEO Suite</h3>
                  <p className="text-[11px] text-[#848E9C] m-0">
                    Search engine snippet, power words, and technical indexing optimization.
                  </p>
                </div>
              </div>

              {/* Score Indicator */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#848E9C]">Score:</span>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-mono font-bold border ${
                    rankMathScore >= 80
                      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                      : rankMathScore >= 60
                      ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                      : "bg-red-500/15 text-red-400 border-red-500/30"
                  }`}
                >
                  {rankMathScore} / 100
                </span>
              </div>
            </div>

            {/* Rank Math Sub-tabs */}
            <div className="flex items-center gap-1.5 border-b border-[#444A55] pb-2 flex-wrap">
              <button
                type="button"
                onClick={() => setRankMathTab("general")}
                className={`crm-tab-btn ${rankMathTab === "general" ? "active" : ""}`}
              >
                <Search size={13} />
                <span>General (SERP & Keywords)</span>
              </button>
              <button
                type="button"
                onClick={() => setRankMathTab("social")}
                className={`crm-tab-btn ${rankMathTab === "social" ? "active" : ""}`}
              >
                <Share2 size={13} />
                <span>Social Cards</span>
              </button>
              <button
                type="button"
                onClick={() => setRankMathTab("advanced")}
                className={`crm-tab-btn ${rankMathTab === "advanced" ? "active" : ""}`}
              >
                <Globe size={13} />
                <span>Advanced (Robots & Canonical)</span>
              </button>
              <button
                type="button"
                onClick={() => setRankMathTab("powerwords")}
                className={`crm-tab-btn ${rankMathTab === "powerwords" ? "active" : ""}`}
              >
                <Sparkles size={13} />
                <span>Power Words Analysis</span>
              </button>
            </div>

            {/* TAB 1: GENERAL (SERP & Focus Keywords) */}
            {rankMathTab === "general" && (
              <div className="space-y-5 pt-2">
                {/* Focus Keyword Input */}
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[#848E9C] mb-1.5 block">
                    Focus Keyword <span className="text-red-400">*</span>
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
                    <input
                      type="text"
                      value={focusKeyword}
                      onChange={(e) => setFocusKeyword(e.target.value)}
                      placeholder="e.g. Architectural Teardown"
                      className="text-xs flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (title) {
                          const words = title.split(/\s+/).slice(0, 3).join(" ");
                          setFocusKeyword(words);
                        }
                      }}
                      className="crm-btn-secondary shrink-0 whitespace-nowrap"
                    >
                      Extract from Title
                    </button>
                  </div>
                </div>

                {/* Google SERP Snippet Preview */}
                <div className="bg-[#2A2E36] border border-[#444A55] rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-[#444A55]">
                    <span className="text-[11px] font-bold text-[#848E9C] uppercase tracking-wider">
                      Google SERP Preview
                    </span>
                    <div className="crm-segmented-group inline-flex items-center gap-2 bg-[#181A20] p-1.5 rounded-xl border border-[#444A55]">
                      <button
                        type="button"
                        onClick={() => setSerpDevice("desktop")}
                        className={`crm-tab-btn ${serpDevice === "desktop" ? "active" : ""}`}
                      >
                        <Laptop size={13} />
                        <span>Desktop</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSerpDevice("mobile")}
                        className={`crm-tab-btn ${serpDevice === "mobile" ? "active" : ""}`}
                      >
                        <Smartphone size={13} />
                        <span>Mobile</span>
                      </button>
                    </div>
                  </div>

                  {/* Simulated Google Search Result */}
                  <div className={`space-y-1.5 ${serpDevice === "mobile" ? "max-w-sm" : "max-w-2xl"}`}>
                    <div className="flex items-center gap-1.5 text-xs text-[#848E9C]">
                      <span className="font-semibold text-[#EAECEF]">Codex Dynamics</span>
                      <span>› blog › {slug || "architectural-teardown"}</span>
                    </div>
                    <h4 className="text-base sm:text-lg font-medium text-[#8AB4F8] hover:underline cursor-pointer leading-snug m-0">
                      {seoTitle || title || "Article Headline on Codex Dynamics"}
                    </h4>
                    <p className="text-xs text-[#BDC1C6] leading-relaxed m-0">
                      {seoDescription || excerpt || "Comprehensive technical teardown exploring edge performance and resilience."}
                    </p>
                  </div>
                </div>

                {/* Audit Checklist */}
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-[#848E9C] uppercase tracking-wider block">
                    Basic SEO Checklist
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {rankMathChecks.list.map((item) => (
                      <div
                        key={item.id}
                        className={`p-2.5 rounded-lg border flex items-start gap-2.5 text-xs ${
                          item.passed
                            ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-300"
                            : "bg-[#2A2E36] border-[#444A55] text-[#848E9C]"
                        }`}
                      >
                        {item.passed ? (
                          <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                        )}
                        <div className="min-w-0">
                          <span className="font-semibold block">{item.label}</span>
                          <span className="text-[11px] opacity-75">{item.tip}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: ADVANCED (Robots & Canonical) */}
            {rankMathTab === "advanced" && (
              <div className="space-y-5 pt-2">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[#848E9C] mb-2 block">
                    Robots Meta Directives
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <label className="flex items-center gap-2 p-3 rounded-lg bg-[#2A2E36] border border-[#444A55] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={robotsMeta.index}
                        onChange={(e) => setRobotsMeta((prev) => ({ ...prev, index: e.target.checked }))}
                        className="rounded accent-[#F0B90B]"
                      />
                      <span className="text-xs font-semibold">Index</span>
                    </label>
                    <label className="flex items-center gap-2 p-3 rounded-lg bg-[#2A2E36] border border-[#444A55] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={robotsMeta.follow}
                        onChange={(e) => setRobotsMeta((prev) => ({ ...prev, follow: e.target.checked }))}
                        className="rounded accent-[#F0B90B]"
                      />
                      <span className="text-xs font-semibold">Follow</span>
                    </label>
                    <label className="flex items-center gap-2 p-3 rounded-lg bg-[#2A2E36] border border-[#444A55] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={robotsMeta.noarchive}
                        onChange={(e) => setRobotsMeta((prev) => ({ ...prev, noarchive: e.target.checked }))}
                        className="rounded accent-[#F0B90B]"
                      />
                      <span className="text-xs font-semibold">No Archive</span>
                    </label>
                    <label className="flex items-center gap-2 p-3 rounded-lg bg-[#2A2E36] border border-[#444A55] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={robotsMeta.nosnippet}
                        onChange={(e) => setRobotsMeta((prev) => ({ ...prev, nosnippet: e.target.checked }))}
                        className="rounded accent-[#F0B90B]"
                      />
                      <span className="text-xs font-semibold">No Snippet</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[#848E9C] mb-1.5 block">
                    Canonical URL
                  </label>
                  <input
                    type="url"
                    value={canonicalUrl}
                    onChange={(e) => setCanonicalUrl(e.target.value)}
                    placeholder="https://codexdynamics.com/blog/article-slug"
                    className="text-xs font-mono"
                  />
                  <span className="text-[11px] text-[#848E9C] mt-1 block">
                    Points search spiders to the authoritative version of this teardown.
                  </span>
                </div>
              </div>
            )}

            {/* TAB 3: SOCIAL CARDS (OpenGraph & Twitter Card) */}
            {rankMathTab === "social" && (
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between pb-2 border-b border-[#444A55]">
                  <span className="text-[11px] font-bold text-[#848E9C] uppercase tracking-wider">
                    Social Share Card Preview
                  </span>
                  <div className="crm-segmented-group inline-flex items-center gap-2 bg-[#181A20] p-1.5 rounded-xl border border-[#444A55]">
                    <button
                      type="button"
                      onClick={() => setSocialPlatform("facebook")}
                      className={`crm-tab-btn ${socialPlatform === "facebook" ? "active" : ""}`}
                    >
                      OpenGraph (FB/LinkedIn)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSocialPlatform("twitter")}
                      className={`crm-tab-btn ${socialPlatform === "twitter" ? "active" : ""}`}
                    >
                      X / Twitter Card
                    </button>
                  </div>
                </div>

                <div className="bg-[#2A2E36] border border-[#444A55] rounded-xl overflow-hidden max-w-lg">
                  {imageUrl ? (
                    <div className="h-44 w-full overflow-hidden bg-black/40">
                      <img src={imageUrl} alt={imageAlt} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="h-44 w-full flex items-center justify-center bg-[#22262E] text-[#848E9C] text-xs">
                      No cover image selected
                    </div>
                  )}
                  <div className="p-3.5 space-y-1">
                    <span className="text-[10px] font-bold text-[#848E9C] uppercase tracking-wider block">
                      codexdynamics.com
                    </span>
                    <h5 className="text-sm font-bold text-[#EAECEF] line-clamp-1 m-0">
                      {title || "Article Headline"}
                    </h5>
                    <p className="text-xs text-[#848E9C] line-clamp-2 m-0">
                      {excerpt || "Executive summary of technical findings."}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: POWER WORDS ANALYSIS */}
            {rankMathTab === "powerwords" && (
              <div className="space-y-4 pt-2">
                <div className="p-4 rounded-xl bg-[#2A2E36] border border-[#444A55] space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-bold text-[#F0B90B] uppercase tracking-wider block">
                        Emotional Power Words Audit
                      </span>
                      <p className="text-xs text-[#848E9C] mt-0.5 m-0">
                        Power words trigger reader curiosity, credibility, and authority.
                      </p>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-[#F0B90B]/15 text-[#F0B90B] border border-[#F0B90B]/30">
                      {powerWordsAnalysis.totalPowerWordsFound} Detected
                    </span>
                  </div>

                  {powerWordsAnalysis.headlineMatches.length > 0 ? (
                    <div className="flex items-center gap-2 flex-wrap pt-2">
                      {powerWordsAnalysis.headlineMatches.map((m, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                        >
                          ★ {m.word} ({m.categoryName})
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-amber-400 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20">
                      No power words detected in the headline yet. Try adding words like <strong>Definitive</strong>, <strong>Blueprint</strong>, <strong>Zero-Latency</strong>, or <strong>Architect</strong>.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ======================================================================= */}
        {/* RIGHT COLUMN: INSPECTOR SIDEBAR                                         */}
        {/* ======================================================================= */}
        {isSidebarOpen && (
          <div className="crm-blog-inspector w-full lg:w-80 shrink-0 space-y-4">
            {/* Sidebar Tabs: Post Settings vs SEO Insights */}
            <div className="crm-sidebar-tab-group flex items-center gap-2.5 bg-[#20242C] p-1.5 rounded-xl border border-[#444A55]">
              <button
                type="button"
                onClick={() => setSidebarTab("settings")}
                className={`crm-tab-btn flex-1 justify-center ${sidebarTab === "settings" ? "active" : ""}`}
              >
                <Settings size={13} />
                <span>Post Settings</span>
              </button>
              <button
                type="button"
                onClick={() => setSidebarTab("seo")}
                className={`crm-tab-btn flex-1 justify-center ${sidebarTab === "seo" ? "active" : ""}`}
              >
                <TrendingUp size={13} />
                <span>Rank Math</span>
              </button>
            </div>

            {/* TAB CONTENT: POST SETTINGS */}
            {sidebarTab === "settings" && (
              <div className="space-y-4">
                {/* ACCORDION 1: STATUS & VISIBILITY */}
                <div className="bg-[#30353E] border border-[#444A55] rounded-xl overflow-hidden shadow-xs">
                  <button
                    type="button"
                    onClick={() => toggleAccordion("status")}
                    className="crm-accordion-trigger"
                  >
                    <span className="flex items-center gap-2">
                      <FolderTree size={14} className="text-[#F0B90B]" />
                      <span>Status & Visibility</span>
                    </span>
                    {accordionState.status ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>

                  {accordionState.status && (
                    <div className="p-4 space-y-3.5 border-t border-[#444A55]">
                      {/* Publication Status */}
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-[#848E9C] mb-1.5 block">
                          Publish Status
                        </label>
                        <select
                          value={status}
                          onChange={(e) => setStatus(e.target.value as any)}
                          className="text-xs"
                        >
                          <option value="published">Live Published</option>
                          <option value="draft">Internal Draft</option>
                          <option value="archived">Archived</option>
                        </select>
                      </div>

                      {/* Author */}
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-[#848E9C] mb-1.5 block">
                          Author Byline
                        </label>
                        <select
                          value={author}
                          onChange={(e) => setAuthor(e.target.value)}
                          className="text-xs"
                        >
                          {PRESET_AUTHORS.map((a) => (
                            <option key={a} value={a}>
                              {a}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* ACCORDION 2: FEATURED COVER IMAGE */}
                <div className="bg-[#30353E] border border-[#444A55] rounded-xl overflow-hidden shadow-xs">
                  <button
                    type="button"
                    onClick={() => toggleAccordion("image")}
                    className="crm-accordion-trigger"
                  >
                    <span className="flex items-center gap-2">
                      <ImageIcon size={14} className="text-[#F0B90B]" />
                      <span>Featured Cover Image</span>
                    </span>
                    {accordionState.image ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>

                  {accordionState.image && (
                    <div className="p-4 space-y-3 border-t border-[#444A55]">
                      {imageUrl ? (
                        <div className="relative rounded-lg overflow-hidden border border-[#444A55] max-h-36 group">
                          <img src={imageUrl} alt={imageAlt} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setImageUrl("")}
                            className="crm-tag-remove-btn absolute top-2 right-2 bg-black/60! text-white!"
                            title="Remove Cover Image"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <div className="p-6 border-2 border-dashed border-[#444A55] rounded-lg text-center text-xs text-[#848E9C]">
                          No image selected
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => setIsImagePickerOpen(true)}
                        className="crm-btn-secondary w-full justify-center"
                      >
                        <ImageIcon size={13} />
                        <span>Select from Media Library</span>
                      </button>

                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-[#848E9C] mb-1 block">
                          Alt Description
                        </label>
                        <input
                          type="text"
                          value={imageAlt}
                          onChange={(e) => setImageAlt(e.target.value)}
                          placeholder="Descriptive alt text for accessibility"
                          className="text-xs"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* ACCORDION 3: CATEGORIES */}
                <div className="bg-[#30353E] border border-[#444A55] rounded-xl overflow-hidden shadow-xs">
                  <button
                    type="button"
                    onClick={() => toggleAccordion("categories")}
                    className="crm-accordion-trigger"
                  >
                    <span className="flex items-center gap-2">
                      <Tag size={14} className="text-[#F0B90B]" />
                      <span>Categories</span>
                    </span>
                    {accordionState.categories ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>

                  {accordionState.categories && (
                    <div className="p-4 space-y-3.5 border-t border-[#444A55]">
                      <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                        {categoriesList.map((cat) => {
                          const isSelected = selectedCategory === cat.name;
                          return (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => setSelectedCategory(cat.name)}
                              className={`crm-category-card ${isSelected ? "selected" : ""}`}
                            >
                              <div className="flex items-center gap-3.5 min-w-0">
                                <span className="crm-category-circle">
                                  {isSelected && <Check size={11} strokeWidth={3} />}
                                </span>
                                <span className="text-xs truncate font-medium select-none text-[#EAECEF]">{cat.name}</span>
                              </div>
                              {isSelected && (
                                <span className="text-[10px] uppercase font-bold tracking-wider text-[#0071E3] bg-[#0071E3]/15 px-2 py-0.5 rounded border border-[#0071E3]/30 shrink-0 ml-2">
                                  Active
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Add new category button / form */}
                      {isAddingCategory ? (
                        <form onSubmit={handleAddNewCategory} className="space-y-2.5 pt-3 border-t border-[#444A55]">
                          <input
                            type="text"
                            value={newCatName}
                            onChange={(e) => setNewCatName(e.target.value)}
                            placeholder="New category name"
                            className="text-xs"
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <button type="submit" className="crm-btn-primary flex-1 justify-center">
                              Add Category
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsAddingCategory(false)}
                              className="crm-btn-secondary"
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setIsAddingCategory(true)}
                          className="crm-link-btn pt-1"
                        >
                          <Plus size={13} />
                          <span>Add New Category</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* ACCORDION 4: TAGS & TOPICS */}
                <div className="bg-[#30353E] border border-[#444A55] rounded-xl overflow-hidden shadow-xs">
                  <button
                    type="button"
                    onClick={() => toggleAccordion("tags")}
                    className="crm-accordion-trigger"
                  >
                    <span className="flex items-center gap-2">
                      <Tag size={14} className="text-[#F0B90B]" />
                      <span>Tags & Taxonomy</span>
                    </span>
                    {accordionState.tags ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>

                  {accordionState.tags && (
                    <div className="p-4 space-y-3 border-t border-[#444A55]">
                      {/* Active Tag Pills */}
                      <div className="flex flex-wrap gap-1.5 min-h-6">
                        {tags.map((t) => (
                          <span
                            key={t}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs bg-[#2A2E36] text-[#EAECEF] border border-[#444A55]"
                          >
                            <span>#{t}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveTag(t)}
                              className="crm-tag-remove-btn"
                            >
                              <X size={11} />
                            </button>
                          </span>
                        ))}
                      </div>

                      {/* Tag Input */}
                      <div className="flex gap-2 items-center">
                        <input
                          type="text"
                          value={tagInput}
                          onChange={(e) => setTagInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddTag(tagInput);
                            }
                          }}
                          placeholder="Add a tag..."
                          className="text-xs flex-1"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddTag(tagInput)}
                          className="crm-btn-secondary shrink-0"
                        >
                          Add
                        </button>
                      </div>

                      {/* Quick Popular Tags */}
                      <div className="pt-1">
                        <span className="text-[10px] font-bold text-[#848E9C] uppercase tracking-wider block mb-1.5">
                          Popular Suggestions
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {POPULAR_TAGS.slice(0, 8).map((pt) => (
                            <button
                              key={pt}
                              type="button"
                              onClick={() => handleAddTag(pt)}
                              className="crm-pill-btn"
                            >
                              +{pt}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT: SEO QUICK CHECKLIST */}
            {sidebarTab === "seo" && (
              <div className="bg-[#30353E] border border-[#444A55] rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-[#444A55]">
                  <span className="text-xs font-bold text-[#EAECEF]">SEO Health Overview</span>
                  <span className="font-mono text-xs text-[#F0B90B] font-bold">
                    {rankMathScore}/100
                  </span>
                </div>

                <div className="space-y-2">
                  {rankMathChecks.list.map((c) => (
                    <div key={c.id} className="flex items-center justify-between text-xs py-1">
                      <span className={c.passed ? "text-[#EAECEF]" : "text-[#848E9C]"}>{c.label}</span>
                      {c.passed ? (
                        <Check size={14} className="text-emerald-400 shrink-0" />
                      ) : (
                        <span className="text-[10px] text-amber-400 font-mono">+{c.weight}pts</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 3. MODALS (Media Picker & Link Insert)                                     */}
      {/* ========================================================================= */}
      {isImagePickerOpen && (
        <ImagePickerModal
          isOpen={isImagePickerOpen}
          onClose={() => setIsImagePickerOpen(false)}
          currentValue={imageUrl}
          onSelect={(url, meta) => {
            setImageUrl(url);
            if (meta?.alt) setImageAlt(meta.alt);
            if (meta?.caption) setImageCaption(meta.caption);
            setIsImagePickerOpen(false);
            toast.success("Cover image selected");
          }}
          title="Select Cover Image"
          showMetaOptions={true}
        />
      )}

      {isLinkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-[#30353E] border border-[#444A55] rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#EAECEF] m-0">Insert Hyperlink</h3>
              <button
                type="button"
                onClick={() => setIsLinkModalOpen(false)}
                className="crm-btn-icon"
              >
                <X size={15} />
              </button>
            </div>
            <form onSubmit={handleConfirmLink} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#848E9C] mb-1 block">
                  Link Text
                </label>
                <input
                  type="text"
                  value={linkTextInput}
                  onChange={(e) => setLinkTextInput(e.target.value)}
                  placeholder="e.g. Edge runtime architecture documentation"
                  className="text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#848E9C] mb-1 block">
                  Target URL <span className="text-red-400">*</span>
                </label>
                <input
                  type="url"
                  value={linkUrlInput}
                  onChange={(e) => setLinkUrlInput(e.target.value)}
                  placeholder="https://..."
                  className="text-xs font-mono"
                  required
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsLinkModalOpen(false)}
                  className="crm-btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="crm-btn-accent">
                  Insert Link
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
export default BlogEditorPage;
