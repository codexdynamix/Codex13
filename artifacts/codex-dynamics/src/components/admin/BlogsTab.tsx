import React, { useState, useMemo, useEffect } from "react";
import {
  FileText,
  Plus,
  Trash2,
  Sparkles,
  ExternalLink,
  Edit3,
  Copy,
  Search,
  BookOpen,
  LayoutGrid,
  ListFilter,
  X,
  Zap,
} from "lucide-react";
import { calculateReadingTime } from "@/lib/reading-time";
import { analyzePowerWords } from "@/lib/power-words";
import { BlogEditorPage } from "./BlogEditorPage";
import type { BlogPost } from "@/types/crm";
import { getAdminBlogCategories } from "@/crm/admin-app/adminApi";

interface BlogsTabProps {
  blogs: BlogPost[];
  onSaveBlog: (data: any) => Promise<boolean>;
  onDeleteBlog: (id: number) => Promise<boolean>;
  onToggleStatus?: (id: number, status: string) => Promise<boolean>;
  onDuplicateBlog?: (id: number) => Promise<boolean>;
  onEditorStateChange?: (isEditing: boolean) => void;
}

export function BlogsTab({
  blogs,
  onSaveBlog,
  onDeleteBlog,
  onToggleStatus,
  onDuplicateBlog,
  onEditorStateChange,
}: BlogsTabProps) {
  // Page / Editor View State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingBlog, setEditingBlog] = useState<BlogPost | null>(null);

  // Search, Filters & View Mode
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<"all" | "published" | "draft" | "archived">("all");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "title" | "words">("newest");
  const [viewLayout, setViewLayout] = useState<"grid" | "table">("grid");
  const [sharedCategories, setSharedCategories] = useState<{ name: string }[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState("");

  // Keep parent notified for layout adjustment
  useEffect(() => {
    onEditorStateChange?.(isEditorOpen);
  }, [isEditorOpen, onEditorStateChange]);

  useEffect(() => {
    if (isEditorOpen) return undefined;
    let active = true;
    setCategoriesLoading(true);
    setCategoriesError("");
    getAdminBlogCategories()
      .then((categories) => {
        if (active) setSharedCategories(categories);
      })
      .catch((error) => {
        if (active) setCategoriesError(error instanceof Error ? error.message : "Shared blog categories could not be loaded.");
      })
      .finally(() => {
        if (active) setCategoriesLoading(false);
      });
    return () => { active = false; };
  }, [isEditorOpen]);

  // Read URL params on mount or change to support direct link / deep linking
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const action = params.get("action");
      const editId = params.get("edit");
      if (action === "new" || action === "create") {
        setEditingBlog(null);
        setIsEditorOpen(true);
      } else if (editId) {
        const found = blogs.find((b) => String(b.id) === editId);
        if (found) {
          setEditingBlog(found);
          setIsEditorOpen(true);
        }
      }
    } catch {
      // Browser URL reading fallback
      setIsEditorOpen(false);
    }
  }, [blogs]);

  // Listen to popstate (browser back/forward button)
  useEffect(() => {
    const handlePopState = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const action = params.get("action");
        const editId = params.get("edit");
        if (action === "new" || action === "create") {
          setEditingBlog(null);
          setIsEditorOpen(true);
        } else if (editId) {
          const found = blogs.find((b) => String(b.id) === editId);
          if (found) {
            setEditingBlog(found);
            setIsEditorOpen(true);
          }
        } else {
          setIsEditorOpen(false);
          setEditingBlog(null);
        }
      } catch {
        // Popstate fallback
        setIsEditorOpen(false);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [blogs]);

  // Use the shared database categories, while retaining categories already used by posts.
  const categoriesList = useMemo(() => {
    const stored = sharedCategories.map((category) => category.name).filter(Boolean);
    const fromBlogs = blogs.map((b) => b.category).filter(Boolean);
    return Array.from(new Set([...stored, ...fromBlogs]));
  }, [blogs, sharedCategories]);

  // Stats Calculations
  const stats = useMemo(() => {
    const total = blogs.length;
    const published = blogs.filter((b) => b.status === "published" || !b.status).length;
    const drafts = blogs.filter((b) => b.status === "draft").length;
    const totalWords = blogs.reduce((acc, b) => acc + (b.content?.split(/\s+/).filter(Boolean).length || 0), 0);
    return { total, published, drafts, totalWords };
  }, [blogs]);

  // Filtered & Sorted Blogs List
  const filteredBlogs = useMemo(() => {
    return blogs
      .filter((b) => {
        // Status filter
        if (selectedStatusFilter === "published" && b.status !== "published" && b.status) return false;
        if (selectedStatusFilter === "draft" && b.status !== "draft") return false;
        if (selectedStatusFilter === "archived" && b.status !== "archived") return false;

        // Category filter
        if (selectedCategoryFilter !== "all" && b.category !== selectedCategoryFilter) return false;

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = b.title?.toLowerCase().includes(q);
          const matchSlug = b.slug?.toLowerCase().includes(q);
          const matchExcerpt = b.excerpt?.toLowerCase().includes(q);
          const matchContent = b.content?.toLowerCase().includes(q);
          const matchKeyword = b.focus_keyword?.toLowerCase().includes(q);
          const matchCategory = b.category?.toLowerCase().includes(q);
          return matchTitle || matchSlug || matchExcerpt || matchContent || matchKeyword || matchCategory;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "newest") {
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        }
        if (sortBy === "oldest") {
          return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
        }
        if (sortBy === "title") {
          return (a.title || "").localeCompare(b.title || "");
        }
        if (sortBy === "words") {
          const wordsA = (a.content || "").split(/\s+/).filter(Boolean).length;
          const wordsB = (b.content || "").split(/\s+/).filter(Boolean).length;
          return wordsB - wordsA;
        }
        return 0;
      });
  }, [blogs, selectedStatusFilter, selectedCategoryFilter, searchQuery, sortBy]);

  // Open Editor for new article as a FULL PAGE
  const handleOpenCreate = () => {
    setEditingBlog(null);
    setIsEditorOpen(true);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("action", "new");
      url.searchParams.delete("edit");
      window.history.pushState({ blogMode: "new" }, "", url.toString());
    } catch {
      // Ignore URL history errors
    }
  };

  // Open Editor for existing article as a FULL PAGE
  const handleOpenEdit = (b: BlogPost) => {
    setEditingBlog(b);
    setIsEditorOpen(true);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("edit", String(b.id));
      url.searchParams.delete("action");
      window.history.pushState({ blogMode: "edit", id: b.id }, "", url.toString());
    } catch {
      // Ignore URL history errors
    }
  };

  // Return to articles table/grid
  const handleCloseEditor = () => {
    setIsEditorOpen(false);
    setEditingBlog(null);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("action");
      url.searchParams.delete("edit");
      window.history.pushState({}, "", url.toString());
    } catch {
      // Ignore URL history errors
    }
  };

  // Render Full-Page Blog Editor when opened
  if (isEditorOpen) {
    return (
      <BlogEditorPage
        editingId={editingBlog?.id || null}
        initialBlog={editingBlog}
        onBack={handleCloseEditor}
        onSave={async (payload, _status) => {
          const ok = await onSaveBlog(payload);
          return ok;
        }}
      />
    );
  }

  return (
    <div className="space-y-6 crm-blogs-tab text-[#EAECEF]">
      {/* 1. Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 crm-blogs-header p-5 sm:p-6 rounded-2xl bg-[#30353E] border border-[#444A55] shadow-[0_4px_20px_rgba(0,0,0,0.18)]">
        <div className="crm-blogs-heading min-w-0">
          <div className="flex items-center gap-3.5 crm-blogs-title-row">
            <span className="p-2.5 rounded-xl bg-[#0071E3]/15 text-[#0071E3] border border-[#0071E3]/30 crm-blogs-icon shrink-0">
              <BookOpen className="size-5" />
            </span>
            <div className="crm-blogs-title-copy min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold text-[#F0B90B] uppercase tracking-wider">
                  Editorial Suite
                </span>
                <span className="text-neutral-500">·</span>
                <span className="text-[11px] font-semibold text-[#848E9C]">
                  {blogs.length} Articles Recorded
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-[#EAECEF] tracking-tight">
                Blog & Architectural Teardowns
              </h2>
              <p className="text-xs text-[#848E9C] crm-blogs-description mt-0.5 max-w-2xl leading-relaxed">
                Craft, optimize with Rank Math SEO & Power Words, and publish technical insights directly to the Codex Dynamics site.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto crm-blogs-actions shrink-0">
          <button
            type="button"
            onClick={handleOpenCreate}
            className="px-4 py-2.5 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer active:scale-[0.98]"
          >
            <Plus className="size-4" />
            <span>New Blog Article</span>
          </button>
        </div>
      </div>

      {/* 2. Key Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 sm:gap-4 crm-blogs-metrics">
        <div className="rounded-xl bg-[#30353E] border border-[#444A55] p-4 sm:p-5 shadow-xs crm-blogs-metric">
          <span className="text-[11px] font-semibold text-[#848E9C] uppercase tracking-wider block">Total Articles</span>
          <span className="text-2xl font-bold text-[#EAECEF] font-mono mt-1.5 block">{stats.total}</span>
        </div>
        <div className="rounded-xl bg-[#30353E] border border-[#444A55] p-4 sm:p-5 shadow-xs crm-blogs-metric">
          <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider block">Live Published</span>
          <span className="text-2xl font-bold text-emerald-400 font-mono mt-1.5 block">{stats.published}</span>
        </div>
        <div className="rounded-xl bg-[#30353E] border border-[#444A55] p-4 sm:p-5 shadow-xs crm-blogs-metric">
          <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider block">Drafts / In Progress</span>
          <span className="text-2xl font-bold text-amber-400 font-mono mt-1.5 block">{stats.drafts}</span>
        </div>
        <div className="rounded-xl bg-[#30353E] border border-[#444A55] p-4 sm:p-5 shadow-xs crm-blogs-metric">
          <span className="text-[11px] font-semibold text-[#0071E3] uppercase tracking-wider block">Total Words Written</span>
          <span className="text-2xl font-bold text-[#EAECEF] font-mono mt-1.5 block">
            {stats.totalWords.toLocaleString()}
          </span>
        </div>
      </div>

      {/* 3. Search, Filters & View Mode Bar */}
      <div className="rounded-xl bg-[#30353E] border border-[#444A55] p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3.5 crm-blogs-filter-bar">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px] crm-blogs-search">
          <Search className="size-3.5 text-[#848E9C] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title, keyword, slug, or content..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-[#22262E] text-[#EAECEF] border border-[#444A55] rounded-xl focus:border-[#0071E3] outline-none transition-all placeholder:text-[#5E6673]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#848E9C] hover:text-[#EAECEF] cursor-pointer"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Filter Badges & View Switcher */}
        <div className="flex items-center flex-wrap gap-2.5 crm-blogs-filter-controls">
          {/* Status Filter */}
          <select
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value as any)}
            className="px-3 py-2 text-xs bg-[#22262E] border border-[#444A55] rounded-xl text-[#EAECEF] font-medium focus:border-[#0071E3] outline-none cursor-pointer"
          >
            <option value="all">All Statuses ({blogs.length})</option>
            <option value="published">Published ({stats.published})</option>
            <option value="draft">Drafts ({stats.drafts})</option>
            <option value="archived">Archived</option>
          </select>

          {/* Category Filter */}
          <select
            value={selectedCategoryFilter}
            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
            aria-busy={categoriesLoading}
            className="px-3 py-2 text-xs bg-[#22262E] border border-[#444A55] rounded-xl text-[#EAECEF] font-medium focus:border-[#0071E3] outline-none cursor-pointer"
          >
            <option value="all">All Categories</option>
            {categoriesList.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {categoriesError && (
            <span role="alert" data-testid="status-blog-categories-load-error" className="text-[10px] text-rose-300">
              Shared categories could not be loaded. Categories already used by posts are still available.
            </span>
          )}

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 text-xs bg-[#22262E] border border-[#444A55] rounded-xl text-[#EAECEF] font-medium focus:border-[#0071E3] outline-none cursor-pointer"
          >
            <option value="newest">Sort: Newest First</option>
            <option value="oldest">Sort: Oldest First</option>
            <option value="title">Sort: Title (A-Z)</option>
            <option value="words">Sort: Word Count</option>
          </select>

          {/* View Toggle */}
          <div className="flex items-center rounded-xl bg-[#22262E] p-1 border border-[#444A55] crm-blogs-view-toggle">
            <button
              type="button"
              onClick={() => setViewLayout("grid")}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewLayout === "grid" ? "bg-[#30353E] text-[#F0B90B] shadow-xs" : "text-[#848E9C] hover:text-[#EAECEF]"
              }`}
              title="Grid Cards View"
            >
              <LayoutGrid className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewLayout("table")}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewLayout === "table" ? "bg-[#30353E] text-[#F0B90B] shadow-xs" : "text-[#848E9C] hover:text-[#EAECEF]"
              }`}
              title="Detailed Table View"
            >
              <ListFilter className="size-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 4. Main Articles Content */}
      {filteredBlogs.length === 0 ? (
        <div className="rounded-2xl bg-[#30353E] border border-[#444A55] p-12 text-center space-y-4 shadow-sm crm-blogs-empty">
          <div className="size-12 rounded-2xl bg-[#0071E3]/15 text-[#0071E3] border border-[#0071E3]/30 flex items-center justify-center mx-auto">
            <FileText className="size-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-[#EAECEF]">No articles found</h3>
            <p className="text-xs text-[#848E9C] max-w-sm mx-auto">
              {searchQuery || selectedStatusFilter !== "all" || selectedCategoryFilter !== "all"
                ? "Try adjusting your search terms or filter criteria."
                : "Your publication board is clean. Create your first architectural teardown or technical insight."}
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="px-4 py-2 bg-[#0071E3] text-white rounded-xl text-xs font-semibold hover:bg-[#0077ED] shadow-xs cursor-pointer inline-flex items-center gap-1.5 transition-all"
          >
            <Plus className="size-4" />
            <span>Create Article</span>
          </button>
        </div>
      ) : viewLayout === "grid" ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 crm-blogs-grid">
          {filteredBlogs.map((b) => {
            const readingTime = calculateReadingTime(b.content || "");
            const wordCount = (b.content || "").split(/\s+/).filter(Boolean).length;
            const powerAnalysis = analyzePowerWords(b.title || "", b.content || "");
            const isPublished = b.status === "published" || !b.status;

            return (
              <div
                key={b.id}
                className="rounded-xl bg-[#30353E] border border-[#444A55] shadow-xs overflow-hidden flex flex-col hover:border-[#606978] transition-all group crm-blogs-card"
              >
                {/* Card Cover Image Header */}
                <div className="relative aspect-[16/9] bg-[#1E2228] overflow-hidden border-b border-[#444A55] crm-blogs-card-cover">
                  {b.cover_image ? (
                    <img
                      src={b.cover_image}
                      alt={b.title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#0071E3]/10 via-[#22262E] to-[#0071E3]/5">
                      <FileText className="size-8 text-[#848E9C]" />
                    </div>
                  )}

                  {/* Status Badge */}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        if (onToggleStatus) {
                          const next = isPublished ? "draft" : "published";
                          onToggleStatus(b.id, next);
                        }
                      }}
                      className={`crm-blog-status-badge px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase shadow-xs cursor-pointer transition-transform active:scale-95 ${
                        isPublished
                          ? "bg-emerald-500 text-white"
                          : b.status === "draft"
                          ? "bg-amber-500 text-white"
                          : "bg-neutral-600 text-white"
                      }`}
                      title="Click to toggle status"
                    >
                      {b.status || "published"}
                    </button>
                    {powerAnalysis.headlineHasPowerWord && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-600 text-white shadow-xs flex items-center gap-1">
                        <Zap className="size-2.5" />
                        <span>Power</span>
                      </span>
                    )}
                  </div>

                  {/* Category Pill */}
                  <div className="absolute bottom-3 left-3">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-black/80 text-white backdrop-blur-xs border border-white/10">
                      {b.category || "Engineering"}
                    </span>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-4 crm-blogs-card-body">
                  <div className="space-y-2 crm-blogs-card-content">
                    <div className="flex items-center gap-2 text-[11px] text-[#848E9C] font-mono crm-blogs-card-meta">
                      <span>{wordCount} words</span>
                      <span>•</span>
                      <span>{readingTime.text}</span>
                      <span>•</span>
                      <span>{b.created_at ? new Date(b.created_at).toLocaleDateString() : "Recent"}</span>
                    </div>

                    <h3 className="text-sm font-semibold text-[#EAECEF] group-hover:text-[#0071E3] transition-colors line-clamp-2 leading-snug">
                      {b.title}
                    </h3>

                    <p className="text-xs text-[#848E9C] line-clamp-2 leading-relaxed">
                      {b.excerpt || b.content?.slice(0, 140) || "No excerpt provided."}
                    </p>

                    {b.focus_keyword && (
                      <div className="flex items-center gap-1 text-[11px] text-[#0071E3] font-mono bg-[#0071E3]/15 border border-[#0071E3]/30 px-2 py-0.5 rounded-lg self-start inline-flex">
                        <Sparkles className="size-3" />
                        <span className="truncate">KW: {b.focus_keyword}</span>
                      </div>
                    )}
                  </div>

                  {/* Card Actions Footer */}
                  <div className="pt-3 border-t border-[#444A55] flex items-center justify-between crm-blogs-card-footer">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(b)}
                        className="px-3 py-1.5 rounded-xl bg-[#0071E3]/15 hover:bg-[#0071E3]/25 text-[#0071E3] border border-[#0071E3]/30 font-semibold text-xs transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <Edit3 className="size-3.5" />
                        <span>Edit</span>
                      </button>

                      <a
                        href={`/blog?slug=${b.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-xl text-[#848E9C] hover:text-[#EAECEF] hover:bg-[#2A2E36] transition-colors cursor-pointer border border-transparent hover:border-[#444A55]"
                        title="View Public Article"
                      >
                        <ExternalLink className="size-3.5" />
                      </a>
                    </div>

                    <div className="flex items-center gap-1">
                      {onDuplicateBlog && (
                        <button
                          type="button"
                          onClick={() => onDuplicateBlog(b.id)}
                          className="p-1.5 rounded-xl text-[#848E9C] hover:text-[#EAECEF] hover:bg-[#2A2E36] transition-colors cursor-pointer border border-transparent hover:border-[#444A55]"
                          title="Duplicate Article"
                        >
                          <Copy className="size-3.5" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Delete article "${b.title}"? This cannot be undone.`)) {
                            onDeleteBlog(b.id);
                          }
                        }}
                        className="p-1.5 rounded-xl text-[#848E9C] hover:text-[#F6465D] hover:bg-[#F6465D]/10 transition-colors cursor-pointer border border-transparent hover:border-[#F6465D]/30"
                        title="Delete Article"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="rounded-xl bg-[#30353E] border border-[#444A55] shadow-xs overflow-hidden crm-blogs-table">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#444A55] bg-[#22262E] text-[#848E9C] uppercase text-[10px] font-semibold tracking-wider font-mono">
                  <th className="py-3 px-4">Article Title & Keyword</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Length</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#444A55]">
                {filteredBlogs.map((b) => {
                  const readingTime = calculateReadingTime(b.content || "");
                  const wordCount = (b.content || "").split(/\s+/).filter(Boolean).length;
                  const power = analyzePowerWords(b.title || "", b.content || "");

                  return (
                    <tr key={b.id} className="hover:bg-[#2A2E36] transition-colors group">
                      <td className="py-3.5 px-4 max-w-xs sm:max-w-sm">
                        <div className="flex items-center gap-3">
                          {b.cover_image && (
                            <img
                              src={b.cover_image}
                              alt=""
                              className="size-9 rounded-xl object-cover border border-[#444A55] shrink-0"
                            />
                          )}
                          <div className="min-w-0">
                            <span className="font-semibold text-[#EAECEF] block truncate group-hover:text-[#0071E3] transition-colors">
                              {b.title}
                            </span>
                            <div className="flex items-center gap-2 text-[11px] text-[#848E9C] font-mono truncate">
                              <span>/blog?slug={b.slug}</span>
                              {power.headlineHasPowerWord && (
                                <span className="text-purple-400 font-semibold flex items-center gap-0.5">
                                  <Zap className="size-2.5" />
                                  <span>Power</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-[#22262E] border border-[#444A55] text-[#EAECEF]">
                          {b.category || "Engineering"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={() => {
                            if (onToggleStatus) {
                              const next = (b.status === "published" || !b.status) ? "draft" : "published";
                              onToggleStatus(b.id, next);
                            }
                          }}
                          className={`crm-blog-status-badge px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider cursor-pointer transition-transform active:scale-95 ${
                            b.status === "published" || !b.status
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                              : b.status === "draft"
                              ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                              : "bg-[#2A2E36] text-[#848E9C]"
                          }`}
                          title="Click to toggle status"
                        >
                          {b.status || "published"}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-[#848E9C]">
                        {wordCount}w • {readingTime.text}
                      </td>
                      <td className="py-3.5 px-4 text-[#848E9C] font-mono text-[11px]">
                        {b.created_at ? new Date(b.created_at).toLocaleDateString() : "Recent"}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(b)}
                            className="p-1.5 rounded-lg text-[#0071E3] hover:bg-[#0071E3]/15 transition-colors cursor-pointer"
                            title="Edit Article"
                          >
                            <Edit3 className="size-4" />
                          </button>
                          <a
                            href={`/blog?slug=${b.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 rounded-lg text-[#848E9C] hover:text-[#EAECEF] hover:bg-[#2A2E36] transition-colors cursor-pointer"
                            title="View Public Article"
                          >
                            <ExternalLink className="size-4" />
                          </a>
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Delete article "${b.title}"?`)) {
                                onDeleteBlog(b.id);
                              }
                            }}
                            className="p-1.5 rounded-lg text-[#848E9C] hover:text-[#F6465D] hover:bg-[#F6465D]/10 transition-colors cursor-pointer"
                            title="Delete Article"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
