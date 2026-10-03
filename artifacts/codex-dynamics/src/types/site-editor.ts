export interface SocialContact {
  id: string;
  type: "whatsapp" | "telegram" | "viber" | "phone" | "email" | "instagram" | "facebook" | "linkedin" | "twitter" | "github" | "custom";
  label: string;
  value: string;
  href?: string;
  isPrimary?: boolean;
  platform?: string;
  isVisible?: boolean;
  extraValues?: string[];
}

export interface AddressItem {
  id: string;
  label: string;
  street: string;
  city: string;
  fullAddress: string;
  lat: number;
  lng: number;
  isPrimary?: boolean;
}

export interface SiteColors {
  primary: string;
  background: string;
  cardBg: string;
  textMain: string;
  textMuted: string;
  accent: string;
  secondary?: string;
  border?: string;
  surface?: string;
  inverse?: string;
  highlight?: string;
  ring?: string;
}

export interface HeroClipItem {
  id: string;
  label: string;
  line: string;
  src: string;
  poster: string;
  title?: string;
  videoUrl?: string;
}

export interface ProcessStepItem {
  number: string;
  title: string;
  description: string;
}

export interface StudioImageItem {
  id: string;
  src: string;
  alt: string;
  label?: string;
  className?: string;
}

export interface PrincipleItem {
  title: string;
  copy: string;
}

export interface ServiceItem {
  id: string;
  kicker: string;
  title: string;
  description: string;
  points: string[];
  src: string;
  poster: string;
  role?: string;
  whatWeDo?: string;
  deliverables?: { title: string; desc: string }[];
  techStack?: string[];
  timeline?: string;
  idealFor?: string;
  offYourPlate?: string;
}

export interface HighlightItem {
  href: string;
  kicker: string;
  title: string;
  copy: string;
}

export interface ResultMetric {
  id?: string;
  value: number;
  suffix: string;
  label: string;
  decimals?: number;
}

export interface HeaderSocialItem {
  enabled: boolean;
  url: string;
  label?: string;
}

export interface HeaderSocialsConfig {
  linkedin: HeaderSocialItem;
  x: HeaderSocialItem;
  github: HeaderSocialItem;
  instagram: HeaderSocialItem;
  facebook: HeaderSocialItem;
  [key: string]: HeaderSocialItem | undefined;
}

export interface SiteConfig {
  siteName: string;
  siteTagline?: string;
  badgeText?: string;
  copyrightYear: string;
  formSubmitEmail: string;
  colors: SiteColors;
  socialContacts: SocialContact[];
  addresses: AddressItem[];
  hero: {
    badge: string;
    title: string;
    subtitle: string;
    clips: HeroClipItem[];
    [key: string]: any;
  };
  highlights: {
    items: HighlightItem[];
    [key: string]: any;
  };
  services: {
    badge: string;
    title: string;
    subtitle: string;
    items: ServiceItem[];
    [key: string]: any;
  };
  about: {
    badge: string;
    title: string;
    subtitle: string;
    steps: ProcessStepItem[];
    gallery: StudioImageItem[];
    [key: string]: any;
  };
  studio: {
    badge: string;
    title: string;
    subtitle: string;
    heroImage: string;
    heroImageAlt: string;
    studioCityTag: string;
    studioLocationTag: string;
    principles: PrincipleItem[];
    [key: string]: any;
  };
  results: {
    badge: string;
    title: string;
    subtitle: string;
    metrics: ResultMetric[];
    [key: string]: any;
  };
  contact: {
    badge: string;
    title: string;
    subtitle: string;
    responseTimeText: string;
    phoneCardTitle: string;
    phoneCardSubtitle: string;
    emailCardTitle: string;
    emailCardSubtitle: string;
    locationCardTitle: string;
    locationCardSubtitle: string;
    [key: string]: any;
  };
  footer: {
    tagline: string;
    copyrightText: string;
    [key: string]: any;
  };
  headerSocials?: HeaderSocialsConfig;
  theme?: ThemeSettings;
  tidio?: TidioSettings;
  branding?: BrandingSettings;
  banner?: BannerSettings;
  whatsapp?: WhatsAppSettings;
  contactForm?: ContactFormSettings;
  seo?: SeoSettings;
  emergency?: EmergencySettings;
  codeInjection?: CodeInjectionSettings;
  snapshots?: SnapshotItem[];
  [key: string]: any;
}

export interface BrandingSettings {
  accentPreset?: string;
  logoDark?: string;
  logoLight?: string;
  favicon?: string;
}

export interface BannerSettings {
  enabled: boolean;
  text: string;
  ctaText?: string;
  ctaUrl?: string;
  styleVariant?: "blue" | "dark" | "gradient" | "amber" | "emerald";
  variant?: string;
  closable?: boolean;
  dismissible?: boolean;
}

export interface WhatsAppSettings {
  enabled: boolean;
  number: string;
  phone?: string;
  defaultMessage: string;
  position: "bottom-right" | "bottom-left";
  showExtraChannels?: boolean;
}

export interface ContactFormSettings {
  showBudget?: boolean;
  showTimeline?: boolean;
  showCompany?: boolean;
  showServiceSelect?: boolean;
  customSuccessMessage?: string;
}

export interface SeoSettings {
  metaTitle: string;
  metaDescription: string;
  canonicalUrl?: string;
  ogImage?: string;
  gaId?: string;
  gscVerification?: string;
  pixelId?: string;
  metaPixelId?: string;
}

export interface EmergencySettings {
  maintenanceMode: boolean;
  headline?: string;
  subtext?: string;
  message?: string;
  estimatedLaunch?: string;
  estimatedReturn?: string;
  notifyEmail?: string;
  emergencyContact?: string;
}

export interface CodeInjectionSettings {
  headerCode?: string;
  footerCode?: string;
}

export interface SnapshotItem {
  id: string;
  name: string;
  timestamp: string;
  createdAt?: string;
  config: Partial<SiteConfig>;
}

export type ConfigSnapshot = SnapshotItem;

export interface ThemeSettings {
  activeTheme: string;
  preset?: string;
  fontFamily: "system" | "inter" | "playfair" | "syne" | string;
  containerWidth: "1200px" | "1280px" | "1440px" | "full";
  borderRadius: "sharp" | "clean" | "modern" | "pill";
  headerStyle: "floating" | "sticky" | "classic" | "minimal";
  heroLayout?: "streamer" | "split" | "centered" | "editorial" | "bento";
  fontSizeScale?: "compact" | "normal" | "standard" | "spacious" | "editorial" | "large";
  lineHeight?: number;
  scaleRatio?: number;
  cardStyle?: "flat" | "elevated" | "bordered" | "glass";
  sectionsOrder?: string[];
  activeComponents?: string[] | {
    headerBuilder?: boolean;
    gutenbergBlocks?: boolean;
    footerWidgets?: boolean;
    megaMenu?: boolean;
    stickyContactDock?: boolean;
    mobileDrawer?: boolean;
    videoHero?: boolean;
    highlightsBento?: boolean;
    portfolioShowcase?: boolean;
    resultsCounter?: boolean;
    reviewsSlider?: boolean;
    tidioChat?: boolean;
    [key: string]: boolean | undefined;
  };
  layout?: {
    heroLayout?: "streamer" | "split" | "centered" | "editorial" | "bento";
    sectionsOrder?: string[];
    sectionVisibility?: Record<string, boolean>;
    cardStyle?: "flat" | "elevated" | "bordered" | "glass";
    fontSizeScale?: "compact" | "normal" | "spacious" | "editorial";
    [key: string]: any;
  };
  customCss?: string;
  [key: string]: any;
}

export interface TidioSettings {
  enabled: boolean;
  publicKey: string;
  disableOnAdmin: boolean;
  hideOnMobile: boolean;
  position: "bottom-right" | "bottom-left";
  welcomeMessage?: string;
  agentName?: string;
}

export const DEFAULT_SITE_CONFIG: SiteConfig = {
  siteName: "Codex Dynamics",
  copyrightYear: "2026",
  formSubmitEmail: "codexdynamix@gmail.com",

  colors: {
    primary: "#0071e3",
    background: "#f5f5f7",
    cardBg: "#ffffff",
    textMain: "#1d1d1f",
    textMuted: "#6e6e73",
    accent: "#0071e3",
  },

  socialContacts: [
    {
      id: "wa-1",
      type: "whatsapp",
      label: "Main WhatsApp",
      value: "+380636406783",
      href: "https://wa.me/380636406783",
      isPrimary: true,
    },
    {
      id: "wa-2",
      type: "whatsapp",
      label: "Support Desk WhatsApp",
      value: "+380636406783",
      href: "https://wa.me/380636406783",
      isPrimary: false,
    },
    {
      id: "ph-1",
      type: "phone",
      label: "Direct Call / Desk",
      value: "+380 63 640 6783",
      href: "tel:+380636406783",
      isPrimary: true,
    },
    {
      id: "ph-2",
      type: "phone",
      label: "Kyiv HQ Landline",
      value: "+380 44 233 4567",
      href: "tel:+380442334567",
      isPrimary: false,
    },
    {
      id: "tg-1",
      type: "telegram",
      label: "Official Telegram",
      value: "+380636406783",
      href: "https://t.me/+380636406783",
      isPrimary: true,
    },
    {
      id: "tg-2",
      type: "telegram",
      label: "Client Success Desk",
      value: "@codex_desk",
      href: "https://t.me/codex_desk",
      isPrimary: false,
    },
    {
      id: "vb-1",
      type: "viber",
      label: "Direct Viber",
      value: "+380636406783",
      href: "viber://chat?number=%2B380636406783",
      isPrimary: true,
    },
    {
      id: "vb-2",
      type: "viber",
      label: "Support Line Viber",
      value: "+380 50 123 4567",
      href: "viber://chat?number=%2B380501234567",
      isPrimary: false,
    },
    {
      id: "em-1",
      type: "email",
      label: "Primary Email",
      value: "codexdynamix@gmail.com",
      href: "mailto:codexdynamix@gmail.com",
      isPrimary: true,
    },
    {
      id: "em-2",
      type: "email",
      label: "Direct Agency Desk",
      value: "hello@codexdynamics.com",
      href: "mailto:hello@codexdynamics.com",
      isPrimary: false,
    },
    {
      id: "ig-1",
      type: "instagram",
      label: "Instagram Profile",
      value: "@codex_dynamics",
      href: "https://www.instagram.com/codex_dynamics/",
      isPrimary: true,
    },
    {
      id: "fb-1",
      type: "facebook",
      label: "Facebook Page",
      value: "Codex Dynamics",
      href: "https://www.facebook.com/profile.php?id=61571219783449",
      isPrimary: true,
    },
  ],

  addresses: [
    {
      id: "addr-1",
      label: "Kyiv Office (HQ)",
      street: "Sportyvna, 1A",
      city: "Kyiv, 012023, Ukraine",
      fullAddress: "Sportyvna, 1A, Kyiv, 012023, Ukraine",
      lat: 50.438743,
      lng: 30.523177,
      isPrimary: true,
    },
    {
      id: "addr-2",
      label: "Gulliver Tower Desk",
      street: "Ploshcha Sportyvna, 1A",
      city: "Kyiv, Ukraine",
      fullAddress: "Ploshcha Sportyvna 1A, Gulliver Tower A, Kyiv",
      lat: 50.438743,
      lng: 30.523177,
      isPrimary: false,
    },
  ],

  hero: {
    badge: "Codex Dynamics",
    title: "Precision on every screen.",
    subtitle:
      "Websites, web apps, and social campaigns — composed with the care of a product launch.",
    clips: [
      {
        id: "clip-1",
        label: "Codex Dynamics",
        line: "The agency. The standard.",
        src: "/hero/studio.mp4",
        poster: "/hero/studio.jpg",
      },
      {
        id: "clip-2",
        label: "Web Development",
        line: "Websites and web apps, assembled like a product.",
        src: "/hero/web-dev.mp4",
        poster: "/hero/web-dev.jpg",
      },
      {
        id: "clip-3",
        label: "Web Design",
        line: "Type, color, and layout as one material.",
        src: "/hero/design.mp4",
        poster: "/hero/design.jpg",
      },
      {
        id: "clip-4",
        label: "Social Media",
        line: "Content, campaigns, and growth — in one system.",
        src: "/hero/social.mp4",
        poster: "/hero/social.jpg",
      },
    ],
  },

  highlights: {
    items: [
      {
        href: "#work",
        kicker: "Work",
        title: "Sites that convert.",
        copy: "Storefronts, web apps, and campaigns built as one product.",
      },
      {
        href: "#process",
        kicker: "Process",
        title: "Brief to live campaigns.",
        copy: "Design, development, and social media in a single loop.",
      },
      {
        href: "#studio",
        kicker: "About",
        title: "One standard.",
        copy: "The same care on the page, in the brand, and in the feed.",
      },
    ],
  },

  services: {
    badge: "What We Do For You",
    title: "Complete Digital Services Built & Managed For You",
    subtitle:
      "We don't just hand you templates or tell you what to do. Our team does the actual heavy lifting — custom coding your website, designing your brand, and managing your social media campaigns so you get real clients.",
    items: [
      {
        id: "web-dev",
        kicker: "01  /  Engineering",
        title: "Custom Web Development",
        role: "Full-Stack Development, Fast Web Apps & Storefronts",
        description:
          "We build and code custom, lightning-fast websites and web applications tailored specifically to your business operations. Whether you need a high-converting corporate website, an e-commerce store, or an interactive web app, we write clean, scalable code that loads in under a second and drives qualified sales.",
        whatWeDo:
          "We take your project from architecture and database design to full frontend implementation, payment integrations, and turnkey server deployment. You get a bulletproof, secure digital asset you 100% own.",
        points: [
          "Custom React & TypeScript Code",
          "Sub-Second Load Times (95+ PageSpeed)",
          "E-Commerce & Stripe Checkout",
          "Automated Lead & CRM Sync",
          "No Bloated Plugins or Builders",
        ],
        deliverables: [
          {
            title: "Custom Responsive Web Application",
            desc: "Bespoke frontend built with React, TypeScript, and Tailwind CSS that renders seamlessly on iPhones, Androids, tablets, laptops, and 4K displays.",
          },
          {
            title: "Client-Friendly Content Management (CMS)",
            desc: "An intuitive administration panel so you and your team can effortlessly update copy, team members, blog posts, and projects with zero coding.",
          },
          {
            title: "Secure Payment & Checkout Integrations",
            desc: "Turnkey Stripe, PayPal, or Apple Pay processing with automatic customer receipts, invoicing, and webhook fulfillment.",
          },
          {
            title: "Instant Lead & Inquiry Routing",
            desc: "Contact forms that instantly ping your WhatsApp, Telegram, or CRM the second an inquiry arrives so you never miss a deal.",
          },
          {
            title: "Core Web Vitals & Speed Optimization",
            desc: "Image compression pipelines (WebP/AVIF), code-splitting, and caching headers configured to achieve 95+ Google PageSpeed benchmarks.",
          },
          {
            title: "Production Deployment & Security",
            desc: "Domain DNS routing, SSL certificate setup, automated database backups, and DDoS protection so your site stays online 24/7.",
          },
        ],
        techStack: ["React 19", "TypeScript", "Tailwind CSS", "Node.js", "SQLite / Postgres", "Stripe API", "Vite", "Cloudflare"],
        timeline: "Typical Delivery: 2 to 4 Weeks",
        idealFor: "Businesses, startups, and founders needing high-performing sites that scale without monthly builder subscription lock-ins.",
        offYourPlate: "No wrestling with broken WordPress plugins, outdated PHP versions, or unreliable offshore developers.",
        src: "/hero/web-dev.mp4",
        poster: "/hero/web-dev.jpg",
      },
      {
        id: "web-design",
        kicker: "02  /  Visual Identity",
        title: "Web Design & UI/UX",
        role: "Conversion-Focused Interfaces & Complete Brand Systems",
        description:
          "We design premium, conversion-optimized interfaces that instantly position your company as the premier leader in your industry. Every color, font, button state, and layout is strategically crafted in Figma to guide visitors toward booking calls and purchasing your offers.",
        whatWeDo:
          "We research your target audience, analyze your top competitors, and build comprehensive wireframes and high-fidelity mockups. You get to review interactive prototypes and request adjustments before any coding begins.",
        points: [
          "Bespoke High-Fidelity Figma UI",
          "User Experience & Frictionless Journeys",
          "Design Systems & Brand Guidelines",
          "Mobile-First Interaction Patterns",
          "Conversion Rate Optimization (CRO)",
        ],
        deliverables: [
          {
            title: "Strategic Wireframing & Site Architecture",
            desc: "Information hierarchy that leads visitors naturally from problem identification to solution, social proof, and compelling call-to-action.",
          },
          {
            title: "Pixel-Perfect Mobile & Desktop Screens",
            desc: "Custom high-fidelity mockups for all viewports, crafted with precision typography, generous negative space, and polished visual contrast.",
          },
          {
            title: "Cohesive Brand Identity & UI Kit",
            desc: "Brand color palettes, accessible font hierarchies, button states, form inputs, badges, and icon libraries ready for development.",
          },
          {
            title: "Clickable Figma Prototype",
            desc: "An interactive prototype allowing you to click through and experience the entire user journey on your phone and desktop before development.",
          },
          {
            title: "Conversion Elements & Social Proof Layouts",
            desc: "High-trust testimonial sliders, statistical counter ribbons, trust badges, and comparison matrices designed to overcome objections.",
          },
          {
            title: "Production Asset Suite",
            desc: "Full vector SVG exports, favicon suites, high-resolution social share preview cards (OpenGraph), and marketing assets.",
          },
        ],
        techStack: ["Figma", "Adobe Creative Suite", "Illustrator", "Tailwind Typography", "Framer Motion"],
        timeline: "Typical Delivery: 1 to 3 Weeks",
        idealFor: "Established companies looking to rebrand, elevate their perceived value, and charge premium prices for their services.",
        offYourPlate: "No guessing whether your website looks professional or trustworthy. We deliver an elevated aesthetic that converts.",
        src: "/hero/design.mp4",
        poster: "/hero/design.jpg",
      },
      {
        id: "social",
        kicker: "03  /  Acquisition",
        title: "Social Media Marketing",
        role: "Paid Ad Campaigns & Organic Content Growth",
        description:
          "A great website only produces revenue when high-intent prospects see it. We create your content, run your paid ad campaigns on Meta and Google, and drive qualified leads directly into your sales pipeline with measurable return on ad spend.",
        whatWeDo:
          "We plan monthly content strategies, produce scroll-stopping video and graphic creatives, set up tracking pixels, write conversion copy, and actively manage your paid ad budgets to generate predictable client inquiries.",
        points: [
          "Full-Funnel Meta & Google Ads",
          "Scroll-Stopping Video & Graphic Creatives",
          "Monthly Content Calendar & Copywriting",
          "Pixel & Conversion API Tracking",
          "Weekly A/B Split Testing & Scaling",
        ],
        deliverables: [
          {
            title: "Targeted Paid Ad Campaign Management",
            desc: "Complete ad setup, custom audience segmentation, retargeting funnels, and daily optimization on Meta (Instagram & Facebook) and Google Ads.",
          },
          {
            title: "High-Converting Creative Production",
            desc: "Attention-grabbing short-form video reels, multi-slide carousels, and promotional graphic banners designed to stop the feed scroll.",
          },
          {
            title: "Strategic Copywriting & Content Scheduling",
            desc: "Captions, headlines, and call-to-actions written using proven direct-response frameworks, scheduled across your primary channels.",
          },
          {
            title: "Tracking Pixels & Funnel Attribution",
            desc: "Installation of Meta Pixel, Google Analytics 4, and Conversion API so you see exactly which campaigns produce leads and sales.",
          },
          {
            title: "A/B Testing & Cost-Per-Lead Optimization",
            desc: "Continuous testing of creative variations, headlines, and target audiences to lower your cost-per-acquisition and scale winning ads.",
          },
          {
            title: "Transparent Monthly ROI Reporting",
            desc: "Clear, jargon-free monthly performance reports detailing ad spend, reach, click-through rates, qualified leads, and return on investment.",
          },
        ],
        techStack: ["Meta Ads Manager", "Google Ads", "Google Analytics 4", "CapCut / Premiere", "Canva Pro", "Buffer"],
        timeline: "Ongoing Monthly Sprints",
        idealFor: "Business owners who want a consistent pipeline of inbound inquiries without having to spend hours every day posting on social media.",
        offYourPlate: "No more wondering what to post, wasting money on unoptimized boosted posts, or struggling with confusing ad managers.",
        src: "/hero/social.mp4",
        poster: "/hero/social.jpg",
      },
    ],
  },

  about: {
    badge: "How we work",
    title: "From brief to live campaigns.",
    subtitle:
      "Design, development, and social media in one loop — not a handoff graveyard. Typical engagement: four to six weeks.",
    steps: [
      {
        number: "01",
        title: "Brief",
        description: "Goals, audience, offer, and the social data we already have.",
      },
      {
        number: "02",
        title: "Web Design",
        description: "Wireframes, brand system, and high-fidelity pages that convert.",
      },
      {
        number: "03",
        title: "Web Development",
        description: "Production websites and web apps — fast, accessible, built to last.",
      },
      {
        number: "04",
        title: "Launch",
        description: "QA, analytics, pixels, and a cutover that does not break ads.",
      },
      {
        number: "05",
        title: "Social Growth",
        description: "Creative tests, audiences, and landing-page loops after ship.",
      },
    ],
    gallery: [
      {
        id: "gal-1",
        src: "/studio/interior.jpg",
        alt: "The Codex Dynamics office overlooking the city",
        label: "Office Interior",
      },
      {
        id: "gal-2",
        src: "/studio/code.jpg",
        alt: "Engineer writing production code",
        label: "Production Engineering",
      },
      {
        id: "gal-3",
        src: "/studio/design.jpg",
        alt: "Designer reviewing a web interface",
        label: "Design Review",
      },
      {
        id: "gal-4",
        src: "/studio/wireframes.jpg",
        alt: "Website wireframes on a desk",
        label: "Wireframes & System",
      },
      {
        id: "gal-5",
        src: "/studio/social.jpg",
        alt: "Social media creative on a phone",
        label: "Social Media Feed",
      },
      {
        id: "gal-6",
        src: "/studio/analytics.jpg",
        alt: "Performance dashboard and analytics",
        label: "Analytics & Telemetry",
      },
    ],
  },

  studio: {
    badge: "About Us",
    title: "Direct Access. Proven Results.",
    subtitle:
      "Codex Dynamics is an agile agency. Senior developers, designers, and growth specialists handle your project directly — and stay on the work until it performs.",
    heroImage: "/hero/studio.jpg",
    heroImageAlt: "Codex Dynamics office, Sportyvna 1A, Kyiv",
    studioCityTag: "Kyiv",
    studioLocationTag: "Gulliver · Open in Maps",
    principles: [
      {
        title: "Clarity over noise",
        copy: "If it does not serve the offer, it does not ship. Hierarchy, type, and motion are decided — never decorated.",
      },
      {
        title: "One system",
        copy: "The website, the brand, and the social account share a language. No three-vendor tax. No stale PDFs.",
      },
      {
        title: "Built to be measured",
        copy: "Pixels, events, and pages that a board can read. We optimize for conversion, not applause.",
      },
    ],
  },

  results: {
    badge: "Proof",
    title: "Measured the way a board measures it.",
    subtitle: "Speed, conversion, and paid social return — not a 40-page deck.",
    metrics: [
      { value: 140, suffix: "+", label: "Websites shipped", decimals: 0 },
      { value: 4.8, suffix: "x", label: "Avg. social ROAS", decimals: 1 },
      { value: 28, suffix: " days", label: "Typical build", decimals: 0 },
      { value: 60, suffix: "+", label: "Brands in market", decimals: 0 },
    ],
  },

  contact: {
    badge: "Start a project",
    title: "Tell us what you want to build.",
    subtitle: "Drop a brief, a loom, or a note. A partner replies within one business day.",
    responseTimeText: "Typically responds within 2 hours during business hours.",
    phoneCardTitle: "Call the desk",
    phoneCardSubtitle: "Mon–Fri · 9:00–19:00 EET",
    emailCardTitle: "Email us",
    emailCardSubtitle: "Briefs, RFPs, decks",
    locationCardTitle: "Kyiv Office",
    locationCardSubtitle: "Visits by appointment",
  },

  footer: {
    tagline:
      "Web development, web design, and social media marketing. We build the site, then we grow it.",
    copyrightText: "Codex Dynamics. All rights reserved.",
  },

  theme: {
    activeTheme: "codex-pro",
    preset: "default",
    fontFamily: "system",
    containerWidth: "1280px",
    borderRadius: "modern",
    headerStyle: "floating",
    heroLayout: "streamer",
    fontSizeScale: "normal",
    cardStyle: "glass",
    activeComponents: [
      "header-builder",
      "hero-clip",
      "bento-highlights",
      "portfolio-showcase",
      "results-counter",
      "reviews-slider",
      "services-carousel",
      "gutenberg-blocks",
      "footer-widgets",
      "sticky-contact-dock",
    ],
  },

  tidio: {
    enabled: true,
    publicKey: "tmteup6i0hhn7fxdh0yqmww0rhe8dg7l",
    disableOnAdmin: true,
    hideOnMobile: false,
    position: "bottom-right",
    welcomeMessage: "Hi! How can we help you today? Leave us a message and our team will get right back to you.",
  },

  headerSocials: {
    linkedin: {
      enabled: true,
      url: "https://linkedin.com/company/codexdynamics",
      label: "LinkedIn",
    },
    x: {
      enabled: true,
      url: "https://x.com/codexdynamics",
      label: "X (Twitter)",
    },
    github: {
      enabled: true,
      url: "https://github.com/codexdynamics",
      label: "GitHub",
    },
    instagram: {
      enabled: true,
      url: "https://www.instagram.com/codex_dynamics/",
      label: "Instagram",
    },
    facebook: {
      enabled: true,
      url: "https://www.facebook.com/profile.php?id=61571219783449",
      label: "Facebook",
    },
  },

  branding: {
    accentPreset: "blue",
    logoDark: "",
    logoLight: "",
    favicon: "/favicon.svg",
  },

  banner: {
    enabled: false,
    text: "✨ Exclusive Q4 Digital Strategy: Accelerate your business with bespoke web development.",
    ctaText: "Book Discovery",
    ctaUrl: "#contact",
    styleVariant: "blue",
    closable: true,
  },

  whatsapp: {
    enabled: true,
    number: "+380636406783",
    defaultMessage: "Hello Codex Dynamics, I'm interested in building a high-performance web project.",
    position: "bottom-right",
    showExtraChannels: true,
  },

  contactForm: {
    showBudget: true,
    showTimeline: true,
    showCompany: true,
    showServiceSelect: true,
  },

  seo: {
    metaTitle: "Codex Dynamics — High-Performance Websites & Digital Agency",
    metaDescription: "High-performance websites, web design, web development, and digital marketing agency. Precision engineering on every screen.",
    canonicalUrl: "https://codexdynamics.com",
    ogImage: "/hero/studio.jpg",
    gaId: "",
    gscVerification: "",
    pixelId: "",
  },

  emergency: {
    maintenanceMode: false,
    headline: "System Maintenance & Upgrades in Progress",
    subtext: "We are fine-tuning our high-performance digital agency platform. We will be back shortly with enhanced capabilities.",
    estimatedLaunch: "2026-10-01T12:00",
    notifyEmail: "codexdynamix@gmail.com",
  },

  codeInjection: {
    headerCode: "",
    footerCode: "",
  },

  snapshots: [],
};
