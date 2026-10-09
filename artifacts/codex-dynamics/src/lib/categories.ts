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

export function getLegacyStoredCategories(): BlogCategory[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("The saved blog-category backup is invalid.");
  }
  if (!Array.isArray(parsed)) throw new Error("The saved blog-category backup is not a category list.");
  return parsed.filter((category): category is BlogCategory =>
    Boolean(category && typeof category === "object" && typeof category.name === "string" && category.name.trim())
  );
}
