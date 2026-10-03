import { useEffect, useState } from "react";
import { Star, Quote, CheckCircle2 } from "lucide-react";
import { Reveal } from "@/components/Reveal";
import type { Review } from "@/types/crm";

const fallbackReviews: Review[] = [
  {
    id: 1,
    author: "Elena Rostova, VP Product at Northline Commerce",
    rating: 5,
    comment: "Codex Dynamics built our entire custom web application and e-commerce platform in 4 weeks. Page load times dropped under 1 second and mobile conversions jumped 41%.",
    image_path: null,
    is_published: 1,
    created_at: "2026-02-14",
  },
  {
    id: 2,
    author: "David Sterling, Managing Director at Apex Sales Group",
    rating: 5,
    comment: "The custom CRM and browser calling system they engineered completely transformed our sales operations. Our reps make 65% more calls and inbound leads are routed in seconds.",
    image_path: null,
    is_published: 1,
    created_at: "2026-02-12",
  },
  {
    id: 3,
    author: "Julian Thorne, Founder at Lumina Labs",
    rating: 5,
    comment: "Flawless graphic design and brand identity work. They delivered our vector logo suite, typography hierarchy, and complete Figma UI kit. Our perceived market value skyrocketed.",
    image_path: null,
    is_published: 1,
    created_at: "2026-02-10",
  },
  {
    id: 4,
    author: "Marcus Vance, Head of Growth at Kinetic Media",
    rating: 5,
    comment: "Their Meta and Google ad campaigns produced a 4.8x return on ad spend within our first month. The video ad creatives and targeted funnel architecture are top-tier.",
    image_path: null,
    is_published: 1,
    created_at: "2026-01-28",
  },
  {
    id: 5,
    author: "Claire Chen, E-Commerce Director at Aura Goods",
    rating: 5,
    comment: "Their automated email marketing drip funnels and domain deliverability configuration unlocked $64,000 in recovered revenue. Open rates consistently exceed 48%.",
    image_path: null,
    is_published: 1,
    created_at: "2026-01-20",
  },
];

export function Reviews() {
  const [reviews] = useState<Review[]>(fallbackReviews);

  return (
    <section
      id="reviews"
      aria-label="Client Reviews"
      className="scroll-mt-24 border-t border-border/40 bg-background py-16 sm:py-24"
    >
      <div className="shell">
        <Reveal>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <p className="mb-3 text-[11px] font-medium tracking-[0.22em] text-subtle uppercase">
                Endorsements
              </p>
              <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-label sm:text-5xl">
                What leaders say after we ship.
              </h2>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-border/60 bg-muted/30 px-3.5 py-1.5 text-xs text-muted-foreground backdrop-blur-sm self-start sm:self-auto">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span>Verified Client Feedback</span>
            </div>
          </div>
        </Reveal>

        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {reviews.map((rev, idx) => (
            <Reveal key={rev.id || idx} delay={idx * 80}>
              <div className="surface-lift relative flex h-full flex-col justify-between rounded-2xl border border-border/60 bg-card/80 p-7 backdrop-blur-sm transition-all hover:border-border">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-1 text-amber-500">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 ${
                            i < rev.rating
                              ? "fill-amber-400 text-amber-400"
                              : "text-muted-foreground/30"
                          }`}
                        />
                      ))}
                    </div>
                    <Quote className="h-6 w-6 text-muted-foreground/20" />
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    &ldquo;{rev.comment}&rdquo;
                  </p>
                </div>

                <div className="mt-6 pt-5 border-t border-border/40 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-gradient-to-br from-neutral-800 to-neutral-900 border border-neutral-700 flex items-center justify-center text-xs font-semibold text-paper">
                    {rev.author.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-label truncate">
                      {rev.author}
                    </p>
                    <p className="text-xs text-subtle truncate">
                      Verified Client
                    </p>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
