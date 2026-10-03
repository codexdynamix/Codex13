export interface VisitorPageClick {
  url: string;
  title?: string;
  timestamp: string;
  durationSeconds?: number;
}

export interface VisitorCookies {
  session_id?: string;
  visitor_uuid?: string;
  first_visit?: string;
  visit_count?: number;
  duration_seconds?: number;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  cookie_consent?: string;
  user_email?: string;
  user_name?: string;
  user_phone?: string;
  theme?: string;
  screen?: string;
  language?: string;
  [key: string]: unknown;
}

export interface Visitor {
  id: number;
  session_id: string;
  ip_address: string;
  country: string;
  country_code?: string;
  flag: string;
  city?: string;
  region?: string;
  postal_code?: string;
  street?: string;
  browser: string;
  device: string;
  user_agent: string;
  page_url: string;
  referrer?: string;
  duration_seconds?: number;
  visit_count?: number;
  is_returning?: number;
  pages_viewed?: string; // JSON array of VisitorPageClick
  cookies_data?: string; // JSON of VisitorCookies
  email?: string;
  name?: string;
  phone?: string;
  is_lead?: number;
  created_at: string;
}

export interface Lead {
  id: number;
  visitor_id?: number;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  message?: string;
  source: string; // 'website_contact' | 'blog_reader' | 'visitor_telemetry' | 'newsletter' | 'manual'
  status: string; // 'new' | 'contacted' | 'qualified' | 'proposal' | 'won' | 'lost'
  score?: number;
  notes?: string;
  country?: string;
  flag?: string;
  city?: string;
  postal_code?: string;
  street?: string;
  ip_address?: string;
  pages_viewed_count?: number;
  duration_seconds?: number;
  value?: number;
  created_at: string;
  updated_at?: string;
}

export type ActivityType = "call" | "meeting" | "email" | "note" | "status_change";

export interface LeadActivity {
  id: number;
  lead_id: number;
  activity_type: ActivityType;
  title: string;
  description: string;
  created_at: string;
}

export interface LeadTask {
  id: number;
  lead_id: number;
  title: string;
  due_date: string;
  due_time?: string;
  priority: "low" | "medium" | "high";
  status: "pending" | "completed";
  completed_at?: string;
  created_at: string;
}

export interface CrmSettings {
  webhookUrl?: string;
}

export interface Enquiry {
  id: number;
  name: string;
  email: string;
  phone: string;
  company: string;
  message: string;
  source: string;
  status: string;
  created_at: string;
}

export interface Backlink {
  id: number;
  name: string;
  url: string;
  notes: string;
  created_at: string;
}

export interface BlogPost {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  meta_title?: string;
  meta_description?: string;
  focus_keyword?: string;
  cover_image?: string;
  image_url?: string;
  image_alt?: string;
  image_caption?: string;
  author?: string;
  category?: string;
  tags?: string[] | string;
  status: "published" | "draft" | "archived" | string;
  views?: number;
  created_at: string;
  updated_at?: string;
}

export interface Review {
  id: number;
  author: string;
  rating: number;
  comment: string;
  image_path: string | null;
  is_published: number;
  created_at: string;
}

export interface Project {
  id: number;
  title: string;
  site_name: string;
  site_url: string;
  description: string;
  category: string;
  image_url?: string;
  is_published: number;
  created_at: string;
}

export interface ChatMessage {
  id: number;
  thread_id: string;
  sender: "visitor" | "operator" | "system" | "bot";
  sender_name: string;
  message: string;
  created_at: string;
  is_read: number;
}

export interface CrmStats {
  totalVisitors: number;
  todayVisitors: number;
  totalLeads?: number;
  newLeads?: number;
  totalEnquiries: number;
  totalBacklinks: number;
  totalBlogs: number;
  totalReviews: number;
  totalProjects: number;
  unreadChatCount?: number;
  activeChatThreads?: number;
}

export interface RegionStat {
  country: string;
  flag: string;
  count: number;
}

export interface BrowserStat {
  browser: string;
  count: number;
}

export interface DeviceStat {
  device: string;
  count: number;
}
