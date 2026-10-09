import type { BlogCategory } from '@/lib/categories';

export function getAdminBlogCategories(): Promise<BlogCategory[]>;
export function addAdminBlogCategory(name: string): Promise<{ ok?: boolean; category?: BlogCategory; categories?: BlogCategory[] }>;
export function importLegacyAdminBlogCategories(
  categories: Array<Pick<BlogCategory, 'name'> & Partial<BlogCategory>>,
): Promise<{ ok?: boolean; categories?: BlogCategory[] }>;
