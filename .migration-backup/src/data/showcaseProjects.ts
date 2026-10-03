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

export const RECENT_WEB_PROJECTS: ShowcaseProject[] = [
  {
    id: "proj-apex-ecommerce",
    title: "ApexStore: High-Speed Web Application & Storefront",
    client: "Northline Global Commerce",
    tag: "Web Development · E-Commerce",
    category: "Websites & Web Apps",
    shortDescription:
      "A headless, sub-second e-commerce web application replacing a legacy monolith. Real-time global inventory sync, instantaneous search, and optimized one-click checkout.",
    detailedDescription:
      "Engineered from the ground up to eliminate checkout bottlenecks for an international retailer. We migrated their unoptimized legacy stack to an edge-rendered composable architecture with sub-50ms search response, distributed inventory synchronization, and zero-layout-shift micro-interactions.",
    challenge:
      "A sluggish legacy storefront with 6.2s Time-to-Interactive, frequent checkout cart timeouts, and a 42% mobile bounce rate during peak flash sales.",
    solution:
      "Built a high-performance React 19 storefront running on edge runtime with optimistic UI cart updates, automated webp/avif image transformations, and multi-region CDN caching.",
    impact:
      "+41% conversion rate increase in the first 30 days, 98/100 Google Lighthouse score, and 2.1s sub-second checkout completion.",
    techStack: ["React 19", "TypeScript", "Next.js", "Tailwind CSS", "Redis Edge", "Stripe API"],
    metrics: [
      { label: "Conversion Lift", value: "+41%", detail: "In first 30 days" },
      { label: "Lighthouse Score", value: "98/100", detail: "Mobile & Desktop" },
      { label: "TTI Load Time", value: "1.1s", detail: "Down from 6.2s" },
      { label: "Cart Dropoff", value: "-28%", detail: "Streamlined checkout" },
    ],
    features: [
      "Sub-50ms instant search & filter",
      "Optimistic multi-currency cart & checkout",
      "Dynamic inventory reservation workers",
      "Zero layout shift (CLS < 0.01) responsive layout",
    ],
    image: "/work/northline-logistics.jpg",
    video: "/work/storefront.mp4",
    site_url: "https://northline.example.com",
    featured: true,
    completionDate: "Q3 2026",
    lighthouse: {
      performance: 98,
      accessibility: 100,
      bestPractices: 100,
      seo: 100,
    },
  },
  {
    id: "proj-omni-crm",
    title: "Apex Telephony Desk: High-Volume Outbound Dialer & CRM",
    client: "Apex Sales Group",
    tag: "Custom CRM · VoIP Telephony",
    category: "CRMs & Calling Systems",
    shortDescription:
      "Bespoke sales CRM platform featuring an integrated browser-based VoIP dialer, real-time call recording, lead pipeline stages, and instant WhatsApp dispatching.",
    detailedDescription:
      "Designed and coded specifically for a high-velocity sales team that outgrew off-the-shelf CRM limitations. Combines a visual drag-and-drop deal pipeline, one-click click-to-call browser softphone, encrypted call audio archiving, and automated lead alerts.",
    challenge:
      "Sales reps were juggling 3 separate apps, external softphone hardware, and spreadsheets, causing lost lead follow-ups and unmonitored call quality.",
    solution:
      "Built a unified, custom CRM web application with native browser VoIP telephony, automatic call recording, agent activity dashboards, and automated lead notifications.",
    impact:
      "Increased daily sales rep call capacity by 65%, eliminated $3,200/mo in SaaS licensing fees, and shortened average lead response time from 3 hours to 4 minutes.",
    techStack: ["React 19", "TypeScript", "Node.js", "WebRTC / Twilio Voice", "WebSockets", "SQLite"],
    metrics: [
      { label: "Call Output", value: "+65%", detail: "Reps make more calls" },
      { label: "Lead Response", value: "4 min", detail: "Down from 3 hours" },
      { label: "SaaS Savings", value: "$38k/yr", detail: "No per-seat fees" },
      { label: "Call Quality", value: "99.9%", detail: "High-fidelity VoIP" },
    ],
    features: [
      "Browser click-to-call with zero hardware or extensions needed",
      "Automatic audio recording, playback & transcription notes",
      "Interactive visual Kanban sales pipeline with stage triggers",
      "Instant WhatsApp & Telegram lead routing notifications",
    ],
    image: "/work/apex-sales.jpg",
    site_url: "https://omnicall.example.com",
    featured: true,
    completionDate: "Q2 2026",
    lighthouse: {
      performance: 99,
      accessibility: 98,
      bestPractices: 100,
      seo: 98,
    },
  },
  {
    id: "proj-lumina-branding",
    title: "Lumina Design: Complete Graphic Design & Brand Identity",
    client: "Lumina Architecture & Interiors",
    tag: "Graphic Design · Brand Identity · Figma UI",
    category: "Graphic Design & Branding",
    shortDescription:
      "Comprehensive visual identity system, custom typography scales, vector logo suite, marketing collateral, and high-fidelity Figma UI/UX design systems.",
    detailedDescription:
      "Crafted an elevated, timeless visual identity for an architectural design firm. Developed complete brand guidelines, vector logo variations for dark and light modes, bespoke iconography sets, business stationery, and pixel-perfect UI design systems.",
    challenge:
      "The client had an outdated, pixelated logo and inconsistent social graphics that failed to reflect the multimillion-dollar caliber of their physical design projects.",
    solution:
      "Designed a cohesive aesthetic identity in Figma and Illustrator, complete with minimalist typography, luxury neutral color palettes, vector asset exports, and digital marketing templates.",
    impact:
      "Transformed brand perception, helped the firm secure 3 high-value commercial architectural bids, and streamlined marketing output with reusable templates.",
    techStack: ["Figma", "Adobe Illustrator", "Photoshop", "Vector Graphics", "Design Systems"],
    metrics: [
      { label: "Brand Value Lift", value: "High", detail: "Elevated market positioning" },
      { label: "Bid Win Rate", value: "+45%", detail: "Secured luxury contracts" },
      { label: "Asset Library", value: "120+", detail: "Vector SVGs & UI components" },
      { label: "Turnaround", value: "14 Days", detail: "From concept to final kit" },
    ],
    features: [
      "Custom responsive vector logo suite in light and dark formats",
      "Complete typography rules & accessible color token swatches",
      "Figma UI design system with 80+ reusable component variants",
      "Print-ready stationary, pitch decks, and social media templates",
    ],
    image: "/work/brand-identity.jpg",
    video: "/hero/design.mp4",
    site_url: "https://lumina-design.example.com",
    completionDate: "Q2 2026",
    lighthouse: {
      performance: 100,
      accessibility: 100,
      bestPractices: 100,
      seo: 100,
    },
  },
  {
    id: "proj-kinetic-ads",
    title: "Kinetic Media: Meta & Google Ad Campaign Growth Engine",
    client: "Kinetic Fitness Tech",
    tag: "Paid Acquisition · Meta & Google Ads",
    category: "Meta & Google Ads",
    shortDescription:
      "Multi-channel paid acquisition engine generating 4.8x return on ad spend across Meta Ads (Instagram/Facebook) and high-intent Google Search campaigns.",
    detailedDescription:
      "Engineered a full-funnel advertising strategy combining thumb-stopping short-form video reels, high-converting carousel ads, Google Search intent keyword bidding, and server-side Meta Conversion API attribution.",
    challenge:
      "Client was bleeding ad budget on poorly targeted Facebook boosted posts with inconsistent tracking and no clear ROAS attribution.",
    solution:
      "Rebuilt the campaign structure from scratch with dedicated cold acquisition audiences, retargeting funnels, direct-response ad copy, and Google Ads search capture.",
    impact:
      "Achieved a 4.8x blended return on ad spend (ROAS), reduced cost-per-lead by 42%, and delivered 320+ qualified booked calls per month.",
    techStack: ["Meta Ads Manager", "Google Ads", "GA4", "Meta CAPI", "Figma", "CapCut"],
    metrics: [
      { label: "Blended ROAS", value: "4.8x", detail: "Meta & Google campaigns" },
      { label: "Cost-Per-Lead", value: "-42%", detail: "Down to $18.40/lead" },
      { label: "Monthly Leads", value: "320+", detail: "High-intent inquiries" },
      { label: "A/B Tests Run", value: "36", detail: "Creative and copy variants" },
    ],
    features: [
      "Full-funnel Meta ad structure (TOF cold, MOF nurture, BOF retarget)",
      "High-intent Google Search campaigns capturing active buyer search",
      "Server-side Meta Conversion API (CAPI) for 100% accurate tracking",
      "Dynamic creative iterations and weekly performance optimization",
    ],
    image: "/work/kinetic-fitness.jpg",
    video: "/hero/social.mp4",
    site_url: "https://kinetic-media.example.com",
    completionDate: "Q3 2026",
    lighthouse: {
      performance: 98,
      accessibility: 96,
      bestPractices: 100,
      seo: 100,
    },
  },
  {
    id: "proj-flow-email",
    title: "FlowRetain: Automated Email Marketing & Drip Funnel",
    client: "Aura Premium Goods",
    tag: "Email Marketing · Drip Automations",
    category: "Email Marketing",
    shortDescription:
      "End-to-end automated email marketing system featuring custom branded HTML templates, inbox deliverability hardening (SPF/DKIM/DMARC), and high-converting nurture sequences.",
    detailedDescription:
      "Designed and deployed a high-converting automated email lifecycle strategy. Includes a 6-part welcome drip sequence, abandoned inquiry re-engagement flows, VIP customer rewards, and monthly promotional broadcasts.",
    challenge:
      "Client had thousands of uncontacted leads in their database and low 14% email open rates due to poor sender domain reputation and generic plain-text emails.",
    solution:
      "Hardened DNS records for 100% primary inbox deliverability, designed responsive custom email templates, and wrote persuasive direct-response email copy.",
    impact:
      "Elevated email open rates from 14% to 48.2%, reactivated $64,000 in dormant pipeline revenue, and established an automated 24/7 client nurture engine.",
    techStack: ["Klaviyo", "HTML Email", "DNS SPF/DKIM/DMARC", "Figma", "CRM Sync"],
    metrics: [
      { label: "Avg Open Rate", value: "48.2%", detail: "Above industry avg" },
      { label: "Reactivated Rev", value: "$64k", detail: "From dormant leads" },
      { label: "Click Rate", value: "8.6%", detail: "High-intent clicks" },
      { label: "Inbox Placement", value: "99.4%", detail: "Primary tab delivery" },
    ],
    features: [
      "Automated multi-step welcome, nurturing, and booking sequences",
      "Custom responsive HTML email templates tested on all mobile clients",
      "Bulletproof SPF, DKIM, and DMARC sender reputation configuration",
      "Behavioral segmentation and automated lead re-activation triggers",
    ],
    image: "/work/flow-retain-email.jpg",
    video: "/work/storefront.mp4",
    site_url: "https://flow-retain.example.com",
    completionDate: "Q3 2026",
    lighthouse: {
      performance: 100,
      accessibility: 100,
      bestPractices: 100,
      seo: 100,
    },
  },
  {
    id: "proj-nexus-devportal",
    title: "Nexus Portal: Custom Web Application & Interactive Platform",
    client: "Nexus Systems Infrastructure",
    tag: "Web Application · Custom Portal",
    category: "Websites & Web Apps",
    shortDescription:
      "High-speed custom web application featuring live interactive tool sandboxes, instant full-text search, and automated API data synchronization.",
    detailedDescription:
      "Engineered for a technology company needing a fast customer portal. Combines an interactive request builder, dynamic copyable code snippets, responsive dashboards, and offline capabilities.",
    challenge:
      "The client's previous portal was fragmented, slow to navigate, and lacking interactive user features.",
    solution:
      "Constructed a lightweight, edge-cached web application with instantaneous search, interactive widgets, and seamless mobile responsiveness.",
    impact:
      "Reduced customer support tickets by 53% and accelerated onboarding time for new users from 4 days to 45 minutes.",
    techStack: ["React 19", "TypeScript", "Tailwind CSS", "Node.js", "Edge Cache"],
    metrics: [
      { label: "Support Tickets", value: "-53%", detail: "Self-serve resolution" },
      { label: "Onboarding Time", value: "45 min", detail: "Down from 4 days" },
      { label: "Search Latency", value: "<15ms", detail: "Instant UI search" },
      { label: "Lighthouse", value: "100/100", detail: "All categories" },
    ],
    features: [
      "In-browser interactive workspace and tools",
      "Sub-15ms fuzzy search across thousands of records",
      "Granular team permissions and authentication",
      "Instant copyable snippets and exportable reports",
    ],
    image: "/work/developer-portal.jpg",
    video: "/hero/web-dev.mp4",
    site_url: "https://nexus-docs.example.com",
    completionDate: "Q1 2026",
    lighthouse: {
      performance: 100,
      accessibility: 100,
      bestPractices: 100,
      seo: 100,
    },
  },
];
