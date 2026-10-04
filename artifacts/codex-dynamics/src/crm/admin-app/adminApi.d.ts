import type { BlogCategory } from '@/lib/categories';

export function getAdminBlogCategories(): Promise<BlogCategory[]>;
export function addAdminBlogCategory(name: string): Promise<{ ok?: boolean; category?: BlogCategory; categories?: BlogCategory[] }>;
