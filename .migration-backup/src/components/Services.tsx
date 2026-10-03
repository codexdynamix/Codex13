import { useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Code2,
  Palette,
  PhoneCall,
  Mail,
  Megaphone,
  TrendingUp,
  ShieldCheck,
  Clock,
  Sparkles,
  Zap,
  HelpCircle,
  FileCheck,
  Users2,
  Lock,
} from "lucide-react";
import { Reveal } from "@/components/Reveal";
import { scrollToId } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { useSiteConfig } from "@/context/SiteConfigContext";
import { useContactModal } from "@/context/ContactModalContext";
import type { ServiceItem } from "@/types/site-editor";

const fallbackServices: ServiceItem[] = [
  {
    id: "web-dev",
    kicker: "01  /  Websites & Web Apps",
    title: "Custom Web Development & Web Applications",
    role: "Full-Stack Web Development, Custom Web Apps & E-Commerce",
    description:
      "We design and code bespoke, ultra-fast websites and web applications tailored specifically to your business operations. Whether you need a high-converting corporate website, an e-commerce platform, a customer portal, or an internal dashboard, we write clean, scalable code that loads in under a second and drives qualified client conversions.",
    whatWeDo:
      "We handle the entire build from software architecture and database design to modern React frontends, payment checkout flows, API integrations, and turnkey cloud server deployment. You get a bulletproof, secure digital asset that you 100% own.",
    points: [
      "Custom React & TypeScript Code (No slow builders)",
      "Sub-Second Load Times (95+ PageSpeed benchmark)",
      "Bespoke Client Portals & Web Applications",
      "Secure Stripe, PayPal & Apple Pay Checkout",
      "Automated Lead Capture & Instant CRM Sync",
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
    id: "graphic-design",
    kicker: "02  /  Visual Identity & UI/UX",
    title: "Graphic Design & Brand Identity",
    role: "Conversion-Focused Interfaces, Logos & Brand Systems",
    description:
      "We design premium, conversion-optimized visual identities and graphic assets that instantly position your company as the premier leader in your industry. Every color palette, custom logo, typography system, button state, and marketing graphic is strategically crafted in Figma and Illustrator to establish high trust.",
    whatWeDo:
      "We research your market and competitors, design comprehensive logo suites and brand style guides, produce high-fidelity Figma UI/UX screens, and deliver vector marketing collateral ready for print and web.",
    points: [
      "Bespoke Logo Design & Complete Brand Identity",
      "High-Fidelity UI/UX Interface Design in Figma",
      "Marketing Collateral & Social Media Graphics",
      "Design Systems & Reusable UI Component Kits",
      "Full Vector SVG, PNG & Print Production Exports",
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
    techStack: ["Figma", "Adobe Illustrator", "Photoshop", "Tailwind Typography", "Vector Graphics"],
    timeline: "Typical Delivery: 1 to 3 Weeks",
    idealFor: "Established companies looking to rebrand, elevate their perceived value, and charge premium prices for their services.",
    offYourPlate: "No guessing whether your design looks professional or trustworthy. We deliver an elevated aesthetic that converts.",
    src: "/hero/design.mp4",
    poster: "/hero/design.jpg",
  },
  {
    id: "crm-calling",
    kicker: "03  /  Sales Infrastructure",
    title: "Custom CRMs & Calling Systems",
    role: "Tailored Customer Pipelines, VoIP Dialers & Automated Sales Desks",
    description:
      "Stop losing deals to disorganization. We build custom Customer Relationship Management (CRM) platforms paired with integrated VoIP calling systems tailored directly to your sales workflow. Manage leads, track deal pipelines, trigger automated follow-ups, and make or record client calls directly inside your browser.",
    whatWeDo:
      "We architect a dedicated CRM database matching your exact sales stages, connect browser-based VoIP telephony (click-to-call, inbound routing, call recording & transcription), and hook up instant notifications to WhatsApp and Telegram so your team can close deals faster.",
    points: [
      "Custom CRM Built Exactly for Your Workflow",
      "Browser-Based VoIP Telephony & Click-to-Call Dialer",
      "Call Recording, Audio Playback & Telemetry Logs",
      "Visual Deal Stages & Automated Pipeline Tracking",
      "Instant WhatsApp, Telegram & SMS Lead Dispatch",
    ],
    deliverables: [
      {
        title: "Bespoke CRM Dashboard & Deal Pipelines",
        desc: "Custom visual Kanban and tabular deal pipelines designed specifically around your sales stages and customer lifecycle.",
      },
      {
        title: "Integrated VoIP Calling System & Softphone",
        desc: "One-click browser dialing, inbound caller routing, hold queues, and seamless customer phone connectivity without external hardware.",
      },
      {
        title: "Call Recording & Automatic Activity Logging",
        desc: "Secure audio recording archives, call duration logs, customer history timelines, and searchable agent call notes.",
      },
      {
        title: "Automated Lead Notifications & Desk Routing",
        desc: "Real-time alerts via WhatsApp, Telegram, or email the instant a new lead requests contact or books an appointment.",
      },
      {
        title: "Role-Based Team Permissions & Management",
        desc: "Granular access controls for sales agents, managers, and administrators to track individual rep activity and team performance.",
      },
      {
        title: "REST API & Webhook Integrations",
        desc: "Seamless synchronization with your external accounting, advertising channels, and customer communication tools.",
      },
    ],
    techStack: ["WebRTC / VoIP", "Twilio Voice API", "Node.js", "WebSockets", "React", "SQLite / PostgreSQL"],
    timeline: "Typical Delivery: 2 to 4 Weeks",
    idealFor: "Sales teams, agencies, and businesses with outbound or inbound call volume that have outgrown rigid off-the-shelf CRMs.",
    offYourPlate: "No paying thousands every month in expensive per-seat CRM licenses and disconnected phone subscriptions.",
    src: "/services/crm-calling.jpg",
    poster: "/services/crm-calling.jpg",
  },
  {
    id: "email-marketing",
    kicker: "04  /  Retention & Nurturing",
    title: "Email Marketing & Automated Drip Funnels",
    role: "High-Deliverability Sequences, Newsletters & Customer Retention",
    description:
      "Turn one-time website visitors into lifelong repeat clients. We design responsive, branded email templates, set up bulletproof domain authentication (SPF, DKIM, DMARC) for flawless primary inbox deliverability, and engineer automated email funnels that nurture prospects 24/7.",
    whatWeDo:
      "We write compelling direct-response copy, configure welcome drip sequences, re-engage cold prospects, set up cart and inquiry abandonment automations, and manage regular broadcasts with clear conversion tracking.",
    points: [
      "Automated Welcome & Lead Nurturing Sequences",
      "Custom Branded Responsive Email Templates",
      "Bulletproof Deliverability (SPF, DKIM, DMARC)",
      "Smart List Segmentation & Behavioral Triggers",
      "Continuous Open & Click-Through Rate Optimization",
    ],
    deliverables: [
      {
        title: "Complete Automated Welcome & Onboarding Drip",
        desc: "A multi-step email sequence that welcomes new inquiries, builds high authority, and guides prospects to book a call or purchase.",
      },
      {
        title: "Responsive Custom Branded Email Templates",
        desc: "Modern, beautifully styled email designs tested across Apple Mail, Gmail, Outlook, and all major mobile email clients.",
      },
      {
        title: "Domain DNS & Inbox Deliverability Configuration",
        desc: "Full verification of SPF, DKIM, DMARC, and custom sending subdomains to protect your domain reputation and prevent spam folder drops.",
      },
      {
        title: "Audience Tagging & Behavioral Segmentation",
        desc: "Automated tagging based on customer interests, purchase status, and website interactions so every recipient receives relevant content.",
      },
      {
        title: "Abandoned Lead & Re-Engagement Automations",
        desc: "Automated trigger flows that win back interested leads who started a form or checkout but didn't finish.",
      },
      {
        title: "Transparent Performance & Revenue Reports",
        desc: "In-depth tracking of open rates, click-through rates, unsubscribe benchmarks, and direct revenue generated per campaign.",
      },
    ],
    techStack: ["Klaviyo / Mailchimp / SendGrid", "HTML Email Standards", "DNS SPF/DKIM/DMARC", "CRM Sync"],
    timeline: "Typical Delivery: 1 to 2 Weeks",
    idealFor: "Businesses wanting to build an owned audience asset and generate predictable sales without relying solely on paid ads.",
    offYourPlate: "No wondering why your emails are hitting the spam tab or struggling with broken email layouts on mobile devices.",
    src: "/services/acquisition-retention.jpg",
    poster: "/services/acquisition-retention.jpg",
  },
  {
    id: "social-ads",
    kicker: "05  /  Targeted Acquisition",
    title: "Social Media Marketing (Meta & Google Ads)",
    role: "Paid Ad Campaigns, Creative Production & High-ROAS Traffic",
    description:
      "A high-converting website needs consistent, high-intent traffic. We create thumb-stopping ad creatives, configure conversion tracking pixels, write direct-response copy, and actively manage your paid ad campaigns on Meta (Facebook & Instagram) and Google (Search, Display & YouTube) to deliver qualified leads.",
    whatWeDo:
      "We perform audience and competitor research, produce video reels and graphic ad variations, set up Meta Conversion API and Google Analytics 4 tracking, launch multi-variant A/B tests, and optimize bids weekly to maximize return on ad spend.",
    points: [
      "Full-Funnel Meta Ads (Instagram & Facebook)",
      "High-Intent Google Search & Display Campaigns",
      "Scroll-Stopping Graphic & Video Ad Production",
      "Pixel & Conversion API (CAPI) Tracking Setup",
      "Proactive Weekly A/B Testing & Budget Optimization",
    ],
    deliverables: [
      {
        title: "Targeted Paid Ad Campaign Setup & Management",
        desc: "Full-funnel ad campaigns structured for cold acquisition, warm retargeting, and lookalike scaling on Meta and Google.",
      },
      {
        title: "High-Converting Creative Production",
        desc: "Attention-grabbing short-form video reels, multi-slide carousels, and promotional graphic banners designed to stop the feed scroll.",
      },
      {
        title: "Strategic Copywriting & Headline Testing",
        desc: "Compelling direct-response ad copy written with emotional hooks, clear benefit statements, and high-urgency calls to action.",
      },
      {
        title: "Tracking Pixels & Server-Side Funnel Attribution",
        desc: "Installation of Meta Pixel, Google Analytics 4, Google Tag Manager, and Conversion API for complete conversion tracking.",
      },
      {
        title: "A/B Testing & Cost-Per-Acquisition Optimization",
        desc: "Continuous testing of creative variations, headlines, and target audiences to lower your cost-per-acquisition and scale winning ads.",
      },
      {
        title: "Transparent Monthly ROI & Lead Reporting",
        desc: "Clear, jargon-free monthly performance reports detailing ad spend, reach, click-through rates, qualified leads, and return on investment.",
      },
    ],
    techStack: ["Meta Ads Manager", "Google Ads", "Google Analytics 4", "Meta CAPI", "Figma", "CapCut / Premiere"],
    timeline: "Ongoing Monthly Optimization Sprints",
    idealFor: "Companies ready to aggressively scale customer acquisition with predictable, measurable paid advertising return.",
    offYourPlate: "No more burning money on boosted posts or struggling with complex, ever-changing advertising dashboards.",
    src: "/hero/social.mp4",
    poster: "/hero/social.jpg",
  },
];

const serviceIcons: Record<string, any> = {
  "web-dev": Code2,
  "graphic-design": Palette,
  "crm-calling": PhoneCall,
  "email-marketing": Mail,
  "social-ads": Megaphone,
  "web-design": Palette,
  social: TrendingUp,
};

const serviceFaqs = [
  {
    q: "Do I own the website and source code after completion?",
    a: "Yes, 100%. Once final sign-off is completed, you own all source code, design files in Figma, domain registrations, and assets with zero licensing fees or vendor lock-in.",
  },
  {
    q: "Can my team edit content without knowing how to code?",
    a: "Absolutely. We provide an intuitive administrative dashboard where you can easily modify text, upload images, add case studies, publish blog posts, and manage inquiries.",
  },
  {
    q: "How long does a complete project take from start to finish?",
    a: "Most custom web design and development projects launch within 2 to 4 weeks. Social media ad campaigns typically launch within 5 business days after strategy approval.",
  },
  {
    q: "What do I need to prepare before we get started?",
    a: "Just your business objectives, target audience details, and any existing logo or imagery you have. We handle the copywriting, structuring, design mockups, and technical coding.",
  },
  {
    q: "Do you offer post-launch support and maintenance?",
    a: "Yes. Every build includes 30 days of complimentary post-launch support and bug fixes. We also offer monthly maintenance and growth retainers to keep your systems running at peak speed.",
  },
];

export function Services() {
  const { config } = useSiteConfig();
  const { openContactModal } = useContactModal();
  const [expandedServices, setExpandedServices] = useState<Record<string, boolean>>({
    "web-dev": true,
    "graphic-design": false,
    "crm-calling": false,
    "email-marketing": false,
    "social-ads": false,
  });
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const rawItems = config.services?.items?.length ? config.services.items : fallbackServices;

  // Merge with fallbackServices to ensure rich detailed properties exist even if database only had brief fields
  const items: ServiceItem[] = rawItems.map((item) => {
    const fallback = fallbackServices.find((f) => f.id === item.id) || fallbackServices.find((f) => f.id === "web-dev");
    if (!fallback) return item;
    return {
      ...fallback,
      ...item,
      role: item.role || fallback.role,
      whatWeDo: item.whatWeDo || fallback.whatWeDo,
      deliverables: item.deliverables && item.deliverables.length > 0 ? item.deliverables : fallback.deliverables,
      techStack: item.techStack && item.techStack.length > 0 ? item.techStack : fallback.techStack,
      timeline: item.timeline || fallback.timeline,
      idealFor: item.idealFor || fallback.idealFor,
      offYourPlate: item.offYourPlate || fallback.offYourPlate,
      poster: item.poster || fallback.poster,
    };
  });

  const toggleExpand = (id: string) => {
    setExpandedServices((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <section
      id="services"
      aria-label="Services"
      className="scroll-mt-24 bg-fill-elevated py-16 sm:py-24"
    >
      <div id="capabilities" className="relative -top-24" />
      <div className="shell">
        {/* Section Header */}
        <Reveal>
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue/20 bg-blue/10 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-blue uppercase">
              <Sparkles className="size-3" />
              {config.services?.badge || "What We Do For You"}
            </div>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-label sm:text-5xl">
              {config.services?.title || "Complete Digital Services Built & Managed For You"}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
              {config.services?.subtitle ||
                "We don't just hand you templates or tell you what to do. Our team does the actual heavy lifting — custom coding your website, designing your brand, and managing your social media campaigns so you get real clients."}
            </p>
          </div>
        </Reveal>

        {/* Value Proposition Pills */}
        <Reveal delay={40}>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="flex items-center gap-2.5 rounded-lg border border-hairline bg-card p-3 sm:p-4">
              <Code2 className="size-4 shrink-0 text-blue" />
              <div>
                <p className="text-xs font-semibold text-label">100% Custom Code</p>
                <p className="text-[11px] text-muted-foreground">No slow page builders</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-lg border border-hairline bg-card p-3 sm:p-4">
              <Zap className="size-4 shrink-0 text-amber-500" />
              <div>
                <p className="text-xs font-semibold text-label">Sub-Second Speed</p>
                <p className="text-[11px] text-muted-foreground">95+ PageSpeed score</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-lg border border-hairline bg-card p-3 sm:p-4">
              <Lock className="size-4 shrink-0 text-emerald-500" />
              <div>
                <p className="text-xs font-semibold text-label">You Own 100%</p>
                <p className="text-[11px] text-muted-foreground">Full code & IP ownership</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-lg border border-hairline bg-card p-3 sm:p-4">
              <Users2 className="size-4 shrink-0 text-purple-500" />
              <div>
                <p className="text-xs font-semibold text-label">Direct Team Access</p>
                <p className="text-[11px] text-muted-foreground">No account manager telephone</p>
              </div>
            </div>
          </div>
        </Reveal>

        {/* Detailed Service Cards */}
        <div className="mt-12 space-y-8">
          {items.map((service, i) => {
            const Icon = serviceIcons[service.id] || Code2;
            const isExpanded = expandedServices[service.id] ?? false;

            return (
              <Reveal key={service.id} delay={i * 60}>
                <article
                  id={`service-${service.id}`}
                  className="surface-lift overflow-hidden rounded-2xl border border-hairline bg-card shadow-sm transition-all"
                >
                  {/* Top Header & Visual Overview */}
                  <div className="grid lg:grid-cols-12 lg:items-stretch">
                    {/* Media Column */}
                    <div
                      className={cn(
                        "media-zoom relative min-h-64 overflow-hidden bg-ink sm:min-h-80 lg:col-span-5",
                        i % 2 === 1 && "lg:order-2",
                      )}
                    >
                      {(() => {
                        const isCrm =
                          service.id === "crm-calling" ||
                          ((service.title.toLowerCase().includes("crm") ||
                            service.title.toLowerCase().includes("calling")) &&
                            !service.title.toLowerCase().includes("application"));
                        const isAcquisition =
                          service.id === "email-marketing" ||
                          service.id === "social-ads" ||
                          service.id === "social" ||
                          service.title.toLowerCase().includes("acquisition") ||
                          service.title.toLowerCase().includes("email marketing");
                        const isWebApps =
                          service.id === "web-apps" ||
                          (service.title.toLowerCase().includes("web application") &&
                            !service.title.toLowerCase().includes("website"));
                        const isDesign =
                          service.id === "graphic-design" ||
                          service.title.toLowerCase().includes("brand") ||
                          service.title.toLowerCase().includes("graphic");

                        const mediaSrc = isCrm
                          ? "/services/crm-calling.jpg"
                          : isAcquisition
                          ? "/hero/acquisition.mp4"
                          : isWebApps
                          ? "/hero/web-apps.mp4"
                          : service.src || service.poster || "/hero/web-dev.jpg";

                        const mediaPoster = isWebApps
                          ? "/hero/web-apps.jpg"
                          : isAcquisition
                          ? "/services/acquisition-retention.jpg"
                          : isCrm
                          ? "/services/crm-calling.jpg"
                          : service.poster;

                        const isVideo =
                          !isCrm &&
                          typeof mediaSrc === "string" &&
                          mediaSrc.endsWith(".mp4");

                        const tagLabel = isCrm
                          ? "Bespoke CRM · Native Browser VoIP"
                          : isAcquisition
                          ? "Meta & Google Ads · Klaviyo Drip Engine"
                          : isWebApps
                          ? "Full-Stack Portal · Real-Time WebSockets"
                          : isDesign
                          ? "Figma UI Systems · Vector Brand Master"
                          : "Sub-Second Edge Code · 99+ Core Vitals";

                        const tagPulseColor = isCrm
                          ? "bg-emerald-400"
                          : isAcquisition
                          ? "bg-blue"
                          : isWebApps
                          ? "bg-indigo-400"
                          : isDesign
                          ? "bg-amber-400"
                          : "bg-emerald-400";

                        const tagBorder = isCrm
                          ? "border-emerald-500/30"
                          : isAcquisition
                          ? "border-blue/30"
                          : isWebApps
                          ? "border-indigo-500/30"
                          : isDesign
                          ? "border-amber-500/30"
                          : "border-white/20";

                        return (
                          <>
                            {isVideo ? (
                              <video
                                src={mediaSrc}
                                poster={mediaPoster}
                                className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out hover:scale-105"
                                autoPlay
                                muted
                                loop
                                playsInline
                                preload="metadata"
                              />
                            ) : (
                              <img
                                src={mediaSrc}
                                alt={service.title}
                                className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out hover:scale-105"
                                loading="lazy"
                                referrerPolicy="no-referrer"
                              />
                            )}

                            {/* Top & Bottom Apple Vignettes */}
                            <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/20 to-transparent pointer-events-none" />
                            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-transparent pointer-events-none" />

                            {/* Top Status Pill */}
                            <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none">
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-paper/90 backdrop-blur-md border",
                                  tagBorder,
                                )}
                              >
                                <span className={cn("size-1.5 rounded-full animate-pulse", tagPulseColor)} />
                                {tagLabel}
                              </span>
                            </div>

                            {/* Bottom Floating Bar */}
                            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-paper pointer-events-none">
                              <span className="inline-flex items-center gap-1.5 rounded-md bg-black/60 px-2.5 py-1 text-xs font-medium backdrop-blur-md">
                                <Icon className="size-3.5 text-blue" />
                                {service.kicker}
                              </span>
                              {service.timeline && (
                                <span className="inline-flex items-center gap-1 text-xs text-paper/80">
                                  <Clock className="size-3" />
                                  {service.timeline}
                                </span>
                              )}
                            </div>
                          </>
                        );
                      })()}
                    </div>

                    {/* Summary & Core Offer */}
                    <div className="flex flex-col justify-between p-7 sm:p-10 lg:col-span-7">
                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold tracking-[0.2em] text-subtle uppercase">
                            {service.kicker}
                          </span>
                          {service.role && (
                            <span className="rounded-full bg-blue/10 px-2.5 py-0.5 text-xs font-medium text-blue">
                              {service.role}
                            </span>
                          )}
                        </div>

                        <h3 className="mt-3 text-2xl font-semibold tracking-tight text-label sm:text-3xl">
                          {service.title}
                        </h3>

                        <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                          {service.description}
                        </p>

                        {/* What We Actually Do For You Callout */}
                        {service.whatWeDo && (
                          <div className="mt-5 rounded-xl border border-hairline bg-fill p-4 sm:p-5">
                            <p className="text-xs font-semibold text-label">
                              What our team handles for your business:
                            </p>
                            <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                              {service.whatWeDo}
                            </p>
                          </div>
                        )}

                        {/* Quick Highlights / Bullet Tags */}
                        <div className="mt-5 flex flex-wrap gap-2">
                          {service.points.map((point) => (
                            <span
                              key={point}
                              className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-card px-3 py-1 text-xs font-medium text-label shadow-2xs"
                            >
                              <CheckCircle2 className="size-3 text-blue" />
                              {point}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Action Bar */}
                      <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-hairline pt-6">
                        <button
                          type="button"
                          onClick={() => openContactModal(service.title)}
                          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue px-5 text-sm font-semibold text-paper shadow-sm transition-all hover:bg-blue/90 cursor-pointer"
                        >
                          Book {service.title}
                          <ChevronRight className="size-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleExpand(service.id)}
                          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-hairline bg-card px-4 text-sm font-medium text-label hover:bg-fill cursor-pointer"
                        >
                          {isExpanded ? "Hide Detailed Scope" : "View Detailed Scope & Deliverables"}
                          {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Detailed Form: In-Depth Scope & Deliverables (Collapsible / Expandable) */}
                  {isExpanded && (
                    <div className="border-t border-hairline bg-fill p-7 sm:p-10">
                      <div className="grid gap-8 lg:grid-cols-12">
                        {/* Concrete Deliverables Checklist */}
                        <div className="lg:col-span-8">
                          <div className="flex items-center gap-2">
                            <FileCheck className="size-4 text-blue" />
                            <h4 className="text-sm font-semibold tracking-tight text-label uppercase">
                              Complete Scope of Deliverables Included
                            </h4>
                          </div>

                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            {service.deliverables?.map((item) => (
                              <div
                                key={item.title}
                                className="rounded-xl border border-hairline bg-card p-4 transition-colors"
                              >
                                <div className="flex items-start gap-2.5">
                                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                                  <div>
                                    <p className="text-xs font-semibold text-label sm:text-sm">
                                      {item.title}
                                    </p>
                                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                      {item.desc}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Sidebar Details: Stack, Ideal For, Off-Plate */}
                        <div className="space-y-4 lg:col-span-4">
                          {/* What We Take Off Your Plate */}
                          {service.offYourPlate && (
                            <div className="rounded-xl border border-hairline bg-card p-4">
                              <p className="text-xs font-semibold text-label">
                                What We Take Off Your Plate:
                              </p>
                              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                                {service.offYourPlate}
                              </p>
                            </div>
                          )}

                          {/* Ideal For */}
                          {service.idealFor && (
                            <div className="rounded-xl border border-hairline bg-card p-4">
                              <p className="text-xs font-semibold text-label">
                                Who This Is Ideal For:
                              </p>
                              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                {service.idealFor}
                              </p>
                            </div>
                          )}

                          {/* Tech Stack / Tools */}
                          {service.techStack && (
                            <div className="rounded-xl border border-hairline bg-card p-4">
                              <p className="text-xs font-semibold text-label">
                                Technologies & Tools Used:
                              </p>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {service.techStack.map((tech) => (
                                  <span
                                    key={tech}
                                    className="rounded bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
                                  >
                                    {tech}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Instant Action */}
                          <div className="rounded-xl border border-blue/20 bg-blue/5 p-4 text-center">
                            <p className="text-xs font-semibold text-label">
                              Ready to get this built for you?
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Let's review your requirements on a quick strategy call.
                            </p>
                            <button
                              type="button"
                              onClick={() => openContactModal(service.title)}
                              className="mt-3 inline-flex w-full min-h-10 items-center justify-center gap-1.5 rounded-lg bg-blue px-3 text-xs font-semibold text-paper hover:bg-blue/90 cursor-pointer"
                            >
                              Request Free Proposal
                              <ChevronRight className="size-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </article>
              </Reveal>
            );
          })}
        </div>

        {/* How We Deliver It For You (Done-For-You Process) */}
        <Reveal delay={100} className="mt-16 sm:mt-24">
          <div className="rounded-2xl border border-hairline bg-card p-8 sm:p-12">
            <div className="max-w-2xl">
              <span className="text-[11px] font-semibold tracking-[0.2em] text-blue uppercase">
                Our Done-For-You Delivery Model
              </span>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-label sm:text-4xl">
                How we take your project from idea to live revenue.
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
                You don't need to manage freelancers, deal with code, or guess what to do next. We follow a battle-tested 4-phase execution loop.
              </p>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-hairline bg-fill p-5">
                <span className="font-mono text-xs font-bold text-blue">01 / DISCOVERY</span>
                <h4 className="mt-2 text-base font-semibold text-label">Goals & Strategy</h4>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  We hop on a consultation to define your target customer, commercial offer, technical requirements, and deliverable milestones.
                </p>
              </div>

              <div className="rounded-xl border border-hairline bg-fill p-5">
                <span className="font-mono text-xs font-bold text-blue">02 / DESIGN</span>
                <h4 className="mt-2 text-base font-semibold text-label">Custom UI/UX in Figma</h4>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  We design responsive mockups and interactive prototypes. You review every screen and request adjustments until you love it.
                </p>
              </div>

              <div className="rounded-xl border border-hairline bg-fill p-5">
                <span className="font-mono text-xs font-bold text-blue">03 / BUILD</span>
                <h4 className="mt-2 text-base font-semibold text-label">Clean Code & Testing</h4>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  We hand-code your platform, connect payment gateways and lead capture, and test rigorously across real mobile devices.
                </p>
              </div>

              <div className="rounded-xl border border-hairline bg-fill p-5">
                <span className="font-mono text-xs font-bold text-blue">04 / LAUNCH</span>
                <h4 className="mt-2 text-base font-semibold text-label">Turnkey Handover & Ads</h4>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  We connect your custom domain, set up analytics, launch your marketing campaigns, and train your team on updating content.
                </p>
              </div>
            </div>
          </div>
        </Reveal>

        {/* Client Guarantees */}
        <Reveal delay={120} className="mt-8">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex items-start gap-3 rounded-xl border border-hairline bg-card p-6">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-500" />
              <div>
                <h4 className="text-sm font-semibold text-label">100% Intellectual Property Ownership</h4>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  You own all code, designs, and content upon completion. No recurring licensing fees or vendor lock-in.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-hairline bg-card p-6">
              <Zap className="mt-0.5 size-5 shrink-0 text-blue" />
              <div>
                <h4 className="text-sm font-semibold text-label">Fixed-Scope & Transparent Pricing</h4>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  We provide a clear scope and fixed quote before kickoff. Zero hidden fees or surprise billings.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-hairline bg-card p-6">
              <Clock className="mt-0.5 size-5 shrink-0 text-purple-500" />
              <div>
                <h4 className="text-sm font-semibold text-label">30 Days Complimentary Support</h4>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  We stand behind our work with 30 days of free bug fixes, minor tweaks, and dedicated launch support.
                </p>
              </div>
            </div>
          </div>
        </Reveal>

        {/* Services FAQ Accordion */}
        <Reveal delay={140} className="mt-16">
          <div className="rounded-2xl border border-hairline bg-card p-8 sm:p-10">
            <div className="flex items-center gap-2">
              <HelpCircle className="size-4 text-blue" />
              <h3 className="text-xl font-semibold tracking-tight text-label sm:text-2xl">
                Frequently Asked Questions About Our Services
              </h3>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Direct answers to common questions about working with our team.
            </p>

            <div className="mt-6 divide-y divide-hairline">
              {serviceFaqs.map((faq, idx) => {
                const isOpen = openFaq === idx;
                return (
                  <div key={faq.q} className="py-4">
                    <button
                      type="button"
                      onClick={() => setOpenFaq(isOpen ? null : idx)}
                      className="flex w-full items-center justify-between text-left text-sm font-semibold text-label transition-colors hover:text-blue cursor-pointer"
                    >
                      <span>{faq.q}</span>
                      {isOpen ? (
                        <ChevronUp className="size-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                      )}
                    </button>
                    {isOpen && (
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                        {faq.a}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-hairline pt-6">
              <p className="text-xs text-muted-foreground">
                Have a unique requirement or custom project? We are ready to help.
              </p>
              <button
                type="button"
                onClick={() => scrollToId("contact")}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-label px-4 text-xs font-semibold text-background hover:opacity-90 cursor-pointer"
              >
                Talk With Our Team
                <ChevronRight className="size-3.5" />
              </button>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
