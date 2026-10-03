export interface ShowcaseProject {
  id: string | number;
  title: string;
  client: string;
  tag: string;
  category: string;
  shortDescription: string;
  detailedDescription: string;
  challenge: string;
  solution: string;
  impact: string;
  techStack: string[];
  metrics: { label: string; value: string; detail?: string }[];
  features: string[];
  image: string;
  video?: string;
  site_url?: string;
  featured?: boolean;
  completionDate?: string;
  lighthouse: {
    performance: number;
    accessibility: number;
    bestPractices: number;
    seo: number;
  };
}

export const DEMO_SHOWCASE_PROJECT_IDS = new Set([
  "proj-apex-ecommerce",
  "proj-omni-crm",
  "proj-lumina-branding",
  "proj-kinetic-ads",
  "proj-flow-email",
  "proj-nexus-devportal",
]);