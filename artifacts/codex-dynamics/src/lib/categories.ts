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
