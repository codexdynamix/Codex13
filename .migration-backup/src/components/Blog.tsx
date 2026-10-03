import React, { useMemo } from "react";
import { Clock, Calendar, User, ArrowLeft, Share2, Sparkles, BookOpen, Check } from "lucide-react";
import { SEO } from "@/components/SEO";
import { ScrollProgress } from "@/components/ScrollProgress";
import { calculateReadingTime } from "@/lib/reading-time";
import { NewsletterSignup } from "@/components/NewsletterSignup";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface BlogPostData {
  id?: string | number;
  title: string;
  slug?: string;
  excerpt?: string;
  content: string;
  author?: string;
  publishedAt?: string;
  updatedAt?: string;
  category?: string;
  coverImage?: string;
  tags?: string[];
  focusKeyword?: string;
}

interface BlogProps {
  post: BlogPostData;
  onBack?: () => void;
  className?: string;
}

/**
 * Lightweight, high-performance Markdown parser that transforms headers,
 * blockquotes, code blocks, unordered/ordered lists, bold/italics, and paragraphs
 * into semantic HTML matching Codex Dynamics design typography.
 */
function renderMarkdownToHtml(markdown: string): string {
  if (!markdown) return "";

  // Split into lines for block-level parsing
  const lines = markdown.split("\n");
  const result: string[] = [];
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let inList = false;
  let listType: "ul" | "ol" = "ul";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code blocks ```
    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        result.push(
          `<pre class="my-6 overflow-x-auto rounded-2xl bg-[#0d1117] p-5 text-xs text-[#e6edf3] font-mono border border-white/10 leading-relaxed shadow-inner"><code>${escapeHtml(codeBlockContent.join("\n"))}</code></pre>`
        );
        codeBlockContent = [];
        inCodeBlock = false;
      } else {
        if (inList) {
          result.push(listType === "ul" ? "</ul>" : "</ol>");
          inList = false;
        }
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    // Close open lists if an empty line or non-list item is encountered
    const isUnorderedItem = line.trim().startsWith("- ") || line.trim().startsWith("* ");
    const isOrderedItem = /^\d+\.\s/.test(line.trim());

    if (!isUnorderedItem && !isOrderedItem && inList) {
      result.push(listType === "ul" ? "</ul>" : "</ol>");
      inList = false;
    }

    // Empty lines
    if (!line.trim()) {
      continue;
    }

    // Headers
    if (line.startsWith("### ")) {
      result.push(
        `<h3 class="mt-8 mb-3 text-xl font-bold tracking-tight text-label font-display">${parseInline(line.slice(4))}</h3>`
      );
      continue;
    }
    if (line.startsWith("## ")) {
      result.push(
        `<h2 class="mt-12 mb-4 text-2xl sm:text-3xl font-bold tracking-tight text-label font-display pb-2 border-b border-black/8">${parseInline(line.slice(3))}</h2>`
      );
      continue;
    }
    if (line.startsWith("# ")) {
      result.push(
        `<h1 class="mt-8 mb-4 text-3xl sm:text-4xl font-extrabold tracking-tight text-label font-display">${parseInline(line.slice(2))}</h1>`
      );
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      result.push(
        `<blockquote class="my-6 border-l-3 border-blue bg-blue/5 py-3 px-5 rounded-r-xl text-sm italic text-label/90 leading-relaxed">${parseInline(line.slice(2))}</blockquote>`
      );
      continue;
    }

    // List items
    if (isUnorderedItem) {
      if (!inList) {
        result.push(`<ul class="my-4 space-y-2 list-disc list-inside text-sm sm:text-base text-muted-foreground leading-relaxed pl-2">`);
        inList = true;
        listType = "ul";
      }
      const itemText = line.trim().replace(/^[-*]\s+/, "");
      result.push(`<li class="marker:text-blue">${parseInline(itemText)}</li>`);
      continue;
    }

    if (isOrderedItem) {
      if (!inList) {
        result.push(`<ol class="my-4 space-y-2 list-decimal list-inside text-sm sm:text-base text-muted-foreground leading-relaxed pl-2">`);
        inList = true;
        listType = "ol";
      }
      const itemText = line.trim().replace(/^\d+\.\s+/, "");
      result.push(`<li class="marker:text-blue marker:font-semibold">${parseInline(itemText)}</li>`);
      continue;
    }

    // Paragraph
    result.push(
      `<p class="my-4 text-sm sm:text-base text-muted-foreground leading-relaxed font-sans">${parseInline(line)}</p>`
    );
  }

  if (inList) {
    result.push(listType === "ul" ? "</ul>" : "</ol>");
  }

  return result.join("\n");
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function parseInline(text: string): string {
  let res = escapeHtml(text);

  // Inline code `code`
  res = res.replace(
    /`([^`]+)`/g,
    `<code class="rounded bg-black/6 px-1.5 py-0.5 text-xs font-mono text-blue font-medium">$1</code>`
  );

  // Bold **text**
  res = res.replace(/\*\*([^*]+)\*\*/g, `<strong class="font-semibold text-label">$1</strong>`);

  // Italic *text*
  res = res.replace(/\*([^*]+)\*/g, `<em class="italic">$1</em>`);

  // Links [text](url)
  res = res.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    `<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue hover:underline font-medium inline-flex items-center gap-0.5">$1</a>`
  );

  return res;
}

/**
 * Blog Component
 * Renders an optimized, design-system-aligned long-form blog article layout.
 * Features:
 * - Reactive viewport scroll progress indicator
 * - Dynamic SEO (React Helmet equivalent) with Open Graph & JSON-LD article schema
 * - Automated reading time calculation labeled as a subtle muted badge
 * - Executive summary callout box
 * - Clean semantic typography designed for high readability
 * - Native copy link & share functionality
 */
export function Blog({ post, onBack, className }: BlogProps) {
  const [copied, setCopied] = React.useState(false);

  // Calculate estimated reading time helper
  const readingTime = useMemo(() => {
    return calculateReadingTime(post.content);
  }, [post.content]);

  // Convert markdown to clean HTML
  const renderedHtml = useMemo(() => {
    return renderMarkdownToHtml(post.content);
  }, [post.content]);

  // Schema.org Structured Data for Rank Math BlogPosting
  const articleSchema = useMemo(() => {
    return {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: post.title,
      description: post.excerpt || post.title,
      author: {
        "@type": "Organization",
        name: post.author || "Codex Dynamics",
        url: "https://codexdynamics.com",
      },
      publisher: {
        "@type": "Organization",
        name: "Codex Dynamics",
        logo: {
          "@type": "ImageObject",
          url: "https://codexdynamics.com/hero/studio.jpg",
        },
      },
      datePublished: post.publishedAt || new Date().toISOString(),
      dateModified: post.updatedAt || post.publishedAt || new Date().toISOString(),
      mainEntityOfPage: {
        "@type": "WebPage",
        "@id": typeof window !== "undefined" ? window.location.href : "https://codexdynamics.com",
      },
      keywords: post.focusKeyword ? [post.focusKeyword] : post.tags,
      wordCount: readingTime.words,
      timeRequired: `PT${readingTime.minutes}M`,
    };
  }, [post, readingTime]);

  const handleShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (navigator.share) {
      try {
        await navigator.share({
          title: post.title,
          text: post.excerpt || post.title,
          url,
        });
        return;
      } catch {
        // Fallback to clipboard
      }
    }

    if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Article link copied to clipboard!");
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <article
      className={cn(
        "relative min-h-screen bg-background text-foreground transition-colors",
        className
      )}
    >
      {/* 1. Viewport Scroll-Progress Indicator */}
      <ScrollProgress height="h-1" color="bg-blue" />

      {/* 2. Document Head SEO & Open Graph Tags */}
      <SEO
        title={post.title}
        description={post.excerpt || post.title}
        ogType="article"
        ogImage={post.coverImage || "/hero/studio.jpg"}
        articleAuthor={post.author || "Codex Dynamics"}
        articlePublishedTime={post.publishedAt}
        articleModifiedTime={post.updatedAt}
        articleSection={post.category || "Engineering"}
        articleTags={post.tags}
        keywords={post.focusKeyword ? [post.focusKeyword, ...(post.tags || [])] : post.tags}
        schemaOrg={articleSchema}
      />

      <div className="shell max-w-4xl py-12 sm:py-20">
        {/* Navigation / Back Bar */}
        <div className="mb-8 flex items-center justify-between">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="group inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-label transition-colors cursor-pointer"
            >
              <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-1" />
              <span>Back to all insights</span>
            </button>
          ) : (
            <a
              href="/#insights"
              className="group inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-label transition-colors"
            >
              <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-1" />
              <span>Back to all insights</span>
            </a>
          )}

          <button
            type="button"
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 rounded-full border border-black/8 bg-white px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-label hover:border-black/20 shadow-xs transition-all cursor-pointer"
            title="Share or copy article link"
          >
            {copied ? <Check className="size-3 text-green-600" /> : <Share2 className="size-3" />}
            <span>{copied ? "Link copied" : "Share"}</span>
          </button>
        </div>

        {/* Header Block */}
        <header className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue/10 px-3 py-1 font-semibold text-blue">
              <BookOpen className="size-3" />
              <span>{post.category || "Engineering"}</span>
            </span>

            {/* Muted Reading Time Label beneath the category / metadata */}
            <span className="inline-flex items-center gap-1 rounded-full bg-black/4 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              <Clock className="size-3 text-subtle" />
              <span>{readingTime.text}</span>
            </span>

            {post.publishedAt && (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <Calendar className="size-3 text-subtle" />
                <time dateTime={post.publishedAt}>
                  {new Date(post.publishedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </time>
              </span>
            )}
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-label font-display leading-[1.15]">
            {post.title}
          </h1>

          {/* Small muted label specifically beneath the title */}
          <div className="flex items-center gap-3 pt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <User className="size-3.5 text-subtle" />
              <span>By {post.author || "Codex Dynamics Engineering"}</span>
            </span>
            <span className="text-black/20">•</span>
            <span className="flex items-center gap-1 font-mono text-[11px]">
              <Clock className="size-3 text-subtle" />
              <span>{readingTime.text}</span>
              <span className="text-subtle">({readingTime.words} words)</span>
            </span>
          </div>

          {post.excerpt && (
            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-blue/15 bg-blue/5 p-4 text-xs sm:text-sm text-muted-foreground">
              <Sparkles className="size-4 shrink-0 text-blue mt-0.5" />
              <div>
                <strong className="font-semibold text-label">Core Takeaway: </strong>
                <span>{post.excerpt}</span>
              </div>
            </div>
          )}
        </header>

        {/* Cover Image (if available) */}
        {post.coverImage && (
          <div className="my-8 overflow-hidden rounded-3xl border border-black/8 shadow-sm">
            <img
              src={post.coverImage}
              alt={post.title}
              className="h-64 sm:h-96 w-full object-cover"
              loading="lazy"
            />
          </div>
        )}

        {/* Article Body Rendered from Markdown */}
        <div
          className="mt-10 article-prose text-label leading-relaxed max-w-none"
          dangerouslySetInnerHTML={{ __html: renderedHtml }}
        />

        {/* Tags / Keywords Footer */}
        {(post.tags || post.focusKeyword) && (
          <div className="mt-12 pt-6 border-t border-hairline flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-label text-xs">Topics & Keywords:</span>
            {post.focusKeyword && (
              <span className="rounded-md bg-blue/10 px-2.5 py-1 font-mono text-blue font-medium">
                #{post.focusKeyword}
              </span>
            )}
            {post.tags?.map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-muted px-2.5 py-1 text-muted-foreground font-mono text-[11px]"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Newsletter Signup at end of article */}
        <div className="mt-14 pt-8 border-t border-hairline">
          <NewsletterSignup
            variant="card"
            title="Enjoyed this architectural deep dive?"
            description="Subscribe to receive our technical blueprints, web performance audits, and high-conversion design systems directly to your inbox."
            source={`blog_${post.slug || "article"}`}
          />
        </div>
      </div>
    </article>
  );
}
