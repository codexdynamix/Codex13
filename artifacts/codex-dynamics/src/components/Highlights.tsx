import { ArrowUpRight } from "lucide-react";
import { Reveal } from "@/components/Reveal";

const items = [
  {
    href: "#services",
    kicker: "Services",
    title: "Everything built for you.",
    copy: "Web development, web apps, graphic design, CRMs & calling systems, email marketing, and Meta & Google ad campaigns.",
  },
  {
    href: "#work",
    kicker: "Projects",
    title: "Proven client work.",
    copy: "Explore storefronts, custom web applications, sales calling desks, and paid ad funnels engineered for measurable ROI.",
  },
  {
    href: "#process",
    kicker: "Process",
    title: "Done-for-you delivery.",
    copy: "From discovery and Figma UI design to clean code, CRM telephony integrations, and turnkey campaign launch.",
  },
];

export function Highlights() {
  return (
    <section
      aria-label="Highlights"
      className="relative z-20 bg-background pt-7 pb-3 sm:pt-9"
    >
      <div className="shell grid gap-3 md:grid-cols-3">
        {items.map((item, i) => (
          <Reveal key={item.href} delay={i * 80}>
            <a
              href={item.href}
              className="surface-lift shine group flex h-full flex-col rounded-xl bg-card p-6 sm:p-7"
            >
              <div className="mb-5 flex items-center justify-between">
                <span className="text-[11px] font-medium tracking-[0.2em] text-subtle uppercase">
                  {item.kicker}
                </span>
                <ArrowUpRight className="size-4 text-subtle transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </div>
              <h2 className="text-2xl font-semibold tracking-tight text-label">
                {item.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {item.copy}
              </p>
            </a>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
