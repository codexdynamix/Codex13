/**
 * Categories persistence and management module for Codex Dynamics Blog CMS
 */

export interface BlogCategory {
  id: string;
  name: string;
  slug: string;
  parent?: string;
  count?: number;
}

export const DEFAULT_CATEGORIES: BlogCategory[] = [
  { id: "engineering", name: "Engineering", slug: "engineering" },
  { id: "design-systems", name: "Design Systems", slug: "design-systems" },
  { id: "performance", name: "Performance", slug: "performance" },
  { id: "architecture", name: "Architecture", slug: "architecture" },
  { id: "case-study", name: "Case Study", slug: "case-study" },
  { id: "strategy", name: "Strategy", slug: "strategy" },
  { id: "product-updates", name: "Product Updates", slug: "product-updates" },
];

const STORAGE_KEY = "codex_blog_custom_categories";

export function getStoredCategories(): BlogCategory[] {
  if (typeof window === "undefined") return DEFAULT_CATEGORIES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CATEGORIES;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Merge with default categories to prevent losing defaults
      const existingNames = new Set(parsed.map((c: BlogCategory) => c.name.toLowerCase()));
      const missingDefaults = DEFAULT_CATEGORIES.filter(
        (d) => !existingNames.has(d.name.toLowerCase())
      );
      return [...parsed, ...missingDefaults];
    }
    return DEFAULT_CATEGORIES;
  } catch {
    return DEFAULT_CATEGORIES;
  }
}

export function saveStoredCategories(categories: BlogCategory[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(categories));
  } catch {
    // Ignore storage errors
  }
}

export function addCategory(name: string, parent?: string): BlogCategory {
  const trimmed = name.trim();
  const slug = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const current = getStoredCategories();
  const existing = current.find(
    (c) => c.name.toLowerCase() === trimmed.toLowerCase() || c.slug === slug
  );

  if (existing) {
    return existing;
  }

  const newCat: BlogCategory = {
    id: slug || `cat-${Date.now()}`,
    name: trimmed,
    slug: slug || `cat-${Date.now()}`,
    parent: parent || undefined,
  };

  const updated = [newCat, ...current];
  saveStoredCategories(updated);
  return newCat;
}
