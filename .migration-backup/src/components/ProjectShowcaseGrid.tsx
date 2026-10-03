import { useEffect, useState, useMemo } from "react";
import {
  ExternalLink,
  Sparkles,
  ArrowUpRight,
  Layers,
  Search,
  CheckCircle2,
  X,
  Gauge,
  SlidersHorizontal,
  ChevronRight,
  Code2,
  Laptop,
} from "lucide-react";
import { ImageWithFallback } from "@/components/ImageWithFallback";
import { Reveal } from "@/components/Reveal";
import { useContactModal } from "@/context/ContactModalContext";
import type { Project as CrmProject } from "@/types/crm";
import { cn } from "@/lib/utils";
import {
  RECENT_WEB_PROJECTS,
  type ShowcaseProject,
} from "@/data/showcaseProjects";

const DEFAULT_CATEGORIES = [
  "All",
  "Websites & Web Apps",
  "CRMs & Calling Systems",
  "Graphic Design & Branding",
  "Meta & Google Ads",
  "Email Marketing",
];

export function ProjectShowcaseGrid() {
  const [projects, setProjects] = useState<ShowcaseProject[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("codex_custom_projects");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Only show published projects on the public site
            return parsed.filter((p: any) => p.published !== false);
          }
        }
      } catch (err) {
        console.warn("Failed to read custom projects from storage", err);
      }
    }
    return RECENT_WEB_PROJECTS;
  });

  // Listen for real-time project updates from the CRM
  useEffect(() => {
    const handleProjectsSync = () => {
      try {
        const stored = localStorage.getItem("codex_custom_projects");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setProjects(parsed.filter((p: any) => p.published !== false));
          }
        }
      } catch (err) {
        console.warn("Failed to sync updated projects", err);
      }
    };

    window.addEventListener("storage", handleProjectsSync);
    window.addEventListener("codex_projects_updated", handleProjectsSync);

    const handleWindowMessage = (event: MessageEvent) => {
      if (event.data?.type === "CODEX_PROJECTS_UPDATE" && Array.isArray(event.data.projects)) {
        setProjects(event.data.projects.filter((p: any) => p.published !== false));
      }
    };
    window.addEventListener("message", handleWindowMessage);

    return () => {
      window.removeEventListener("storage", handleProjectsSync);
      window.removeEventListener("codex_projects_updated", handleProjectsSync);
      window.removeEventListener("message", handleWindowMessage);
    };
  }, []);

  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedProject, setSelectedProject] = useState<ShowcaseProject | null>(null);
  const [layoutMode, setLayoutMode] = useState<"bento" | "grid">("bento");

  const { openContactModal } = useContactModal();

  const categories = useMemo(() => {
    const set = new Set<string>();
    set.add("All");
    for (const c of DEFAULT_CATEGORIES.slice(1)) {
      set.add(c);
    }
    for (const p of projects) {
      if (p.category && p.category.trim() && p.category.trim() !== "All") {
        set.add(p.category.trim());
      }
    }
    return Array.from(set);
  }, [projects]);

  // Filtered & Searched Projects
  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      const pCat = (project.category || "").toLowerCase();
      const pTag = (project.tag || "").toLowerCase();
      const aCat = activeCategory.toLowerCase();

      const matchesCategory =
        activeCategory === "All" ||
        pCat === aCat ||
        pTag === aCat ||
        pCat.includes(aCat) ||
        aCat.includes(pCat) ||
        pTag.includes(aCat);

      const query = searchQuery.trim().toLowerCase();
      if (!query) return matchesCategory;

      const matchesQuery =
        project.title.toLowerCase().includes(query) ||
        project.client.toLowerCase().includes(query) ||
        project.shortDescription.toLowerCase().includes(query) ||
        pCat.includes(query) ||
        pTag.includes(query) ||
        project.techStack.some((tech) => tech.toLowerCase().includes(query));

      return matchesCategory && matchesQuery;
    });
  }, [projects, activeCategory, searchQuery]);

  const featured = filteredProjects[0];
  const gridItems = layoutMode === "bento" ? filteredProjects.slice(1) : filteredProjects;

  return (
    <section
      id="work"
      aria-label="Project Showcase"
      className="scroll-mt-24 bg-background py-16 sm:py-24"
    >
      <div id="projects" className="relative -top-24" />
      <div className="shell">
        {/* Section Header with Reveal Animation */}
        <Reveal direction="up" threshold={0.1}>
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-hairline bg-muted/60 px-3 py-1 text-[11px] font-medium tracking-[0.2em] text-subtle uppercase">
                <Sparkles className="size-3 text-blue" />
                <span>Client Portfolio & Case Studies</span>
              </div>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-label sm:text-5xl">
                Projects we have done for our clients.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
                Explore our portfolio of delivered client work: custom websites and web applications, bespoke CRMs and calling systems, graphic design and brand systems, high-ROAS Meta & Google ad campaigns, and automated email marketing.
              </p>
            </div>

            {/* View Mode & Live Projects Count Badge */}
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-1 rounded-lg border border-hairline bg-card p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setLayoutMode("bento")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium transition-colors",
                    layoutMode === "bento"
                      ? "bg-foreground text-background shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  title="Bento Highlight View"
                >
                  <Layers className="size-3.5" />
                  <span>Bento</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLayoutMode("grid")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium transition-colors",
                    layoutMode === "grid"
                      ? "bg-foreground text-background shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  title="Equal Grid View"
                >
                  <SlidersHorizontal className="size-3.5" />
                  <span>Grid</span>
                </button>
              </div>

              <div className="flex items-center gap-2 rounded-full border border-hairline bg-card px-3 py-1.5 text-xs font-mono text-muted-foreground">
                <span className="live-dot" />
                <span>{filteredProjects.length} Projects Live</span>
              </div>
            </div>
          </div>
        </Reveal>

        {/* Filter Bar & Search Input with Reveal Animation */}
        <Reveal direction="up" delay={80} threshold={0.1} className="mt-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-y border-hairline py-4">
            {/* Category Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-200 cursor-pointer",
                    activeCategory === cat
                      ? "bg-foreground text-background shadow-xs scale-[1.02]"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Keyword / Tech Stack Search Box */}
            <div className="relative min-w-[220px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-subtle" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by tech stack or keyword..."
                className="w-full rounded-full border border-hairline bg-card pl-9 pr-8 py-1.5 text-xs text-foreground placeholder:text-subtle focus:border-blue focus:outline-hidden focus:ring-1 focus:ring-blue/30"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-subtle hover:text-foreground"
                  title="Clear search"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </div>
        </Reveal>

        {/* Empty state if search has no results */}
        {filteredProjects.length === 0 && (
          <div className="my-16 text-center py-12 rounded-2xl border border-dashed border-hairline bg-card/50">
            <Layers className="size-10 text-subtle mx-auto mb-3 opacity-60" />
            <h3 className="text-lg font-medium text-label">No projects found</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Try adjusting your search query or filter category.
            </p>
            <button
              type="button"
              onClick={() => {
                setActiveCategory("All");
                setSearchQuery("");
              }}
              className="mt-4 rounded-full bg-foreground px-4 py-1.5 text-xs font-medium text-background hover:opacity-90"
            >
              Reset Filters
            </button>
          </div>
        )}

        {/* Bento Featured Card (when in bento mode and has results) */}
        {layoutMode === "bento" && featured && (
          <Reveal direction="scale" delay={120} threshold={0.1} className="mt-8">
            <article
              onClick={() => setSelectedProject(featured)}
              className="group relative cursor-pointer overflow-hidden rounded-2xl border border-hairline bg-card shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-blue/50 hover:shadow-xl"
            >
              <div className="grid lg:grid-cols-12 gap-0">
                {/* Media Presentation */}
                <div className="relative aspect-[16/10] lg:aspect-auto lg:col-span-7 overflow-hidden bg-ink">
                  {featured.video ? (
                    <video
                      src={featured.video}
                      poster={featured.image}
                      className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                      autoPlay
                      muted
                      loop
                      playsInline
                      preload="metadata"
                    />
                  ) : (
                    <ImageWithFallback
                      src={featured.image}
                      alt={featured.title}
                      className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                    />
                  )}

                  {/* Gradient Overlay for legibility & polish */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />

                  {/* Top Floating Badges */}
                  <div className="absolute top-4 left-4 right-4 flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/15 px-3 py-1 text-xs font-medium text-white shadow-xs">
                      <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>{featured.category}</span>
                    </span>

                    <div className="flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/15 px-3 py-1 text-xs font-mono font-medium text-white">
                      <Gauge className="size-3.5 text-emerald-400" />
                      <span>{featured.lighthouse.performance} Lighthouse</span>
                    </div>
                  </div>

                  {/* Quick Action Overlay on Hover */}
                  <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white text-black font-semibold text-xs px-3.5 py-1.5 shadow-lg">
                      <span>Inspect Case Study</span>
                      <ArrowUpRight className="size-3.5" />
                    </span>
                  </div>
                </div>

                {/* Content Side */}
                <div className="flex flex-col justify-between p-7 sm:p-10 lg:col-span-5 bg-card">
                  <div>
                    <div className="flex items-center justify-between gap-3 text-xs text-subtle mb-3">
                      <span className="font-mono uppercase tracking-wider">{featured.client}</span>
                      <span>{featured.completionDate}</span>
                    </div>

                    <h3 className="text-2xl sm:text-3xl font-semibold tracking-tight text-label group-hover:text-blue transition-colors">
                      {featured.title}
                    </h3>

                    <p className="mt-3 text-sm sm:text-base leading-relaxed text-muted-foreground">
                      {featured.shortDescription}
                    </p>

                    {/* Tech Stack Pills */}
                    <div className="mt-5 flex flex-wrap gap-1.5">
                      {featured.techStack.map((tech) => (
                        <span
                          key={tech}
                          className="rounded-md border border-hairline bg-muted/50 px-2.5 py-1 font-mono text-[11px] text-muted-foreground group-hover:border-blue/20 transition-colors"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Metrics Bar */}
                  <div className="mt-8 pt-6 border-t border-hairline">
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                      {featured.metrics.map((m) => (
                        <div key={m.label}>
                          <dt className="text-[10px] font-medium tracking-wider text-subtle uppercase">
                            {m.label}
                          </dt>
                          <dd className="mt-0.5 text-base sm:text-lg font-semibold text-label">
                            {m.value}
                          </dd>
                          {m.detail && (
                            <p className="text-[10px] text-subtle leading-tight mt-0.5">
                              {m.detail}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="mt-6 flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedProject(featured);
                        }}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue hover:text-blue-hover"
                      >
                        <span>Detailed Case Study</span>
                        <ChevronRight className="size-3.5" />
                      </button>

                      {featured.site_url && (
                        <a
                          href={featured.site_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <span>Live Site</span>
                          <ExternalLink className="size-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </article>
          </Reveal>
        )}

        {/* Project Grid Items */}
        <div
          className={cn(
            "mt-8 grid gap-6",
            layoutMode === "bento" ? "md:grid-cols-2 lg:grid-cols-2" : "md:grid-cols-2 lg:grid-cols-3"
          )}
        >
          {gridItems.map((project, idx) => (
            <Reveal
              key={project.id}
              direction="up"
              delay={idx * 75}
              threshold={0.08}
              className="h-full"
            >
              <article
                onClick={() => setSelectedProject(project)}
                className="group relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-hairline bg-card shadow-xs transition-all duration-300 hover:-translate-y-1.5 hover:border-blue/50 hover:shadow-xl cursor-pointer"
              >
                <div>
                  {/* Card Media with Zoom and Hover Action */}
                  <div className="relative aspect-[16/10] overflow-hidden bg-muted">
                    <ImageWithFallback
                      src={project.image}
                      alt={project.title}
                      className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                    />

                    {/* Subtle Gradient Veil */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent pointer-events-none" />

                    {/* Top Badges */}
                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
                      <span className="rounded-full bg-black/60 backdrop-blur-md border border-white/15 px-2.5 py-0.5 text-[11px] font-medium text-white shadow-xs">
                        {project.category}
                      </span>

                      <span className="flex items-center gap-1 rounded-full bg-black/60 backdrop-blur-md border border-white/15 px-2 py-0.5 text-[10px] font-mono text-emerald-300">
                        <Gauge className="size-3" />
                        <span>{project.lighthouse.performance}</span>
                      </span>
                    </div>

                    {/* Hover Action Badge */}
                    <div className="absolute bottom-3 right-3 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                      <span className="inline-flex items-center gap-1 rounded-full bg-white text-black text-[11px] font-semibold px-3 py-1 shadow-md">
                        <span>View Specs</span>
                        <ArrowUpRight className="size-3" />
                      </span>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-6">
                    <div className="flex items-center justify-between gap-2 text-xs text-subtle mb-2.5">
                      <span className="font-mono text-[11px] tracking-wider uppercase">
                        {project.client}
                      </span>
                      {project.completionDate && (
                        <span className="text-[11px]">{project.completionDate}</span>
                      )}
                    </div>

                    <h3 className="text-xl font-semibold tracking-tight text-label group-hover:text-blue transition-colors">
                      {project.title}
                    </h3>

                    <p className="mt-2.5 text-xs sm:text-sm leading-relaxed text-muted-foreground line-clamp-3">
                      {project.shortDescription}
                    </p>

                    {/* Tech Stack Chips */}
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {project.techStack.slice(0, 4).map((tech) => (
                        <span
                          key={tech}
                          className="rounded-md border border-hairline bg-muted/40 px-2 py-0.5 font-mono text-[10px] text-muted-foreground group-hover:border-blue/20 transition-colors"
                        >
                          {tech}
                        </span>
                      ))}
                      {project.techStack.length > 4 && (
                        <span className="rounded-md border border-hairline bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] text-subtle">
                          +{project.techStack.length - 4}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Footer with Metrics & Links */}
                <div className="border-t border-hairline bg-muted/20 px-6 py-4">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-4">
                      {project.metrics.slice(0, 2).map((m) => (
                        <div key={m.label}>
                          <span className="text-[10px] text-subtle block uppercase">{m.label}</span>
                          <span className="font-semibold text-label">{m.value}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedProject(project);
                        }}
                        className="font-medium text-blue hover:text-blue-hover text-xs flex items-center gap-1"
                      >
                        <span>Details</span>
                        <ChevronRight className="size-3" />
                      </button>

                      {project.site_url && (
                        <a
                          href={project.site_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-subtle hover:text-label p-1 rounded-sm transition-colors"
                          title="Visit live site"
                        >
                          <ExternalLink className="size-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>

      {/* Detailed Project Specs & Case Study Dialog Modal */}
      {selectedProject && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setSelectedProject(null)}
        >
          <div
            className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-hairline bg-card shadow-2xl p-6 sm:p-8 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header Bar */}
            <div className="flex items-start justify-between gap-4 border-b border-hairline pb-5">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="rounded-full bg-blue/10 px-2.5 py-0.5 text-xs font-semibold text-blue">
                    {selectedProject.category}
                  </span>
                  <span className="text-xs font-mono text-subtle">
                    {selectedProject.client} · {selectedProject.completionDate}
                  </span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-semibold tracking-tight text-label">
                  {selectedProject.title}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setSelectedProject(null)}
                className="rounded-full border border-hairline p-2 text-subtle hover:bg-muted hover:text-label transition-colors"
                title="Close modal"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="mt-6 space-y-6">
              {/* Media Preview */}
              <div className="relative aspect-[16/9] overflow-hidden rounded-xl bg-ink border border-hairline">
                <ImageWithFallback
                  src={selectedProject.image}
                  alt={selectedProject.title}
                  className="h-full w-full object-cover"
                />
              </div>

              {/* Lighthouse Scorecard */}
              <div className="rounded-xl border border-hairline bg-muted/30 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-label flex items-center gap-1.5">
                    <Gauge className="size-4 text-emerald-500" />
                    <span>Lighthouse Core Web Vitals Benchmark</span>
                  </span>
                  <span className="text-[11px] font-mono text-subtle">Audit Passed</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="rounded-lg bg-card p-3 border border-hairline">
                    <div className="text-2xl font-bold text-emerald-500 font-mono">
                      {selectedProject.lighthouse.performance}
                    </div>
                    <div className="text-[11px] text-subtle mt-0.5">Performance</div>
                  </div>
                  <div className="rounded-lg bg-card p-3 border border-hairline">
                    <div className="text-2xl font-bold text-emerald-500 font-mono">
                      {selectedProject.lighthouse.accessibility}
                    </div>
                    <div className="text-[11px] text-subtle mt-0.5">Accessibility</div>
                  </div>
                  <div className="rounded-lg bg-card p-3 border border-hairline">
                    <div className="text-2xl font-bold text-emerald-500 font-mono">
                      {selectedProject.lighthouse.bestPractices}
                    </div>
                    <div className="text-[11px] text-subtle mt-0.5">Best Practices</div>
                  </div>
                  <div className="rounded-lg bg-card p-3 border border-hairline">
                    <div className="text-2xl font-bold text-emerald-500 font-mono">
                      {selectedProject.lighthouse.seo}
                    </div>
                    <div className="text-[11px] text-subtle mt-0.5">Rank Math SEO</div>
                  </div>
                </div>
              </div>

              {/* Overview & Case Study Narrative */}
              <div>
                <h4 className="text-sm font-semibold uppercase tracking-wider text-label mb-2">
                  Project Overview & Scope
                </h4>
                <p className="text-sm sm:text-base leading-relaxed text-muted-foreground">
                  {selectedProject.detailedDescription}
                </p>
              </div>

              {/* The Challenge & The Solution */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-hairline bg-card p-4">
                  <h5 className="text-xs font-semibold text-rose-500 dark:text-rose-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <span>The Challenge</span>
                  </h5>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    {selectedProject.challenge}
                  </p>
                </div>
                <div className="rounded-xl border border-hairline bg-card p-4">
                  <h5 className="text-xs font-semibold text-emerald-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <span>Our Solution</span>
                  </h5>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    {selectedProject.solution}
                  </p>
                </div>
              </div>

              {/* Impact & Metrics */}
              <div className="rounded-xl border border-hairline bg-muted/20 p-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-label mb-3">
                  Measurable Commercial Impact
                </h4>
                <p className="text-sm font-medium text-foreground mb-4">
                  {selectedProject.impact}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {selectedProject.metrics.map((m) => (
                    <div key={m.label} className="border-l-2 border-blue pl-3">
                      <div className="text-[11px] text-subtle uppercase">{m.label}</div>
                      <div className="text-lg font-bold text-label">{m.value}</div>
                      {m.detail && <div className="text-[10px] text-subtle">{m.detail}</div>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Key Architecture Features */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-label mb-2.5">
                  Key Technical Features & Deliverables
                </h4>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {selectedProject.features.map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm text-muted-foreground">
                      <CheckCircle2 className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Tech Stack */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-label mb-2 flex items-center gap-1.5">
                  <Code2 className="size-3.5 text-blue" />
                  <span>Production Tech Stack</span>
                </h4>
                <div className="flex flex-wrap gap-2">
                  {selectedProject.techStack.map((tech) => (
                    <span
                      key={tech}
                      className="rounded-lg border border-hairline bg-muted/50 px-3 py-1 font-mono text-xs text-foreground"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>

              {/* Modal Action CTA */}
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-hairline">
                <div className="text-xs text-subtle">
                  Interested in an architecture like this for your brand?
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  {selectedProject.site_url && (
                    <a
                      href={selectedProject.site_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-full border border-hairline bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
                    >
                      <Laptop className="size-3.5" />
                      <span>Visit Live Demo</span>
                      <ExternalLink className="size-3" />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedProject(null);
                      openContactModal(`Inquiry about ${selectedProject.title}`);
                    }}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-full bg-foreground px-5 py-2 text-xs font-semibold text-background hover:opacity-90 transition-opacity"
                  >
                    <span>Start a Project</span>
                    <ArrowUpRight className="size-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
