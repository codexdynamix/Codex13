import { useState } from "react";
import { cn } from "@/lib/utils";
import { useSiteConfig } from "@/context/SiteConfigContext";

const FALLBACK = [
  { src: "/hero/studio.mp4", poster: "/hero/studio.jpg", label: "Codex Dynamics", line: "The agency. The standard." },
  { src: "/hero/web-dev.mp4", poster: "/hero/web-dev.jpg", label: "Web Development", line: "Websites and web apps, assembled like a product." },
  { src: "/hero/design.mp4", poster: "/hero/design.jpg", label: "Web Design", line: "Type, color, and layout as one material." },
  { src: "/hero/social.mp4", poster: "/hero/social.jpg", label: "Social Media", line: "Content, campaigns, and growth — in one system." },
];

type HeroLayout = "split" | "centered" | "editorial" | "bento";

export function AlternateHero({ layout }: { layout: HeroLayout }) {
  const { config } = useSiteConfig();
  const clips = config.hero?.clips?.length ? config.hero.clips : FALLBACK;
  const [clip, setClip] = useState(0);
  const current = clips[clip] || clips[0];
  const badge = config.hero?.badge || "Codex Dynamics";
  const title = config.hero?.title || "Precision on every screen.";
  const subtitle =
    config.hero?.subtitle ||
    "Websites, web apps, and social campaigns — composed with the care of a product launch.";

  if (layout === "split") {
    return (
      <section id="hero" aria-label="Hero" className="hero-stage relative isolate pt-20 sm:pt-24">
        <div className="shell grid items-center gap-8 pb-10 lg:grid-cols-2 lg:gap-12">
          <div className="max-w-xl">
            <p className="mb-3 text-[11px] font-medium tracking-[0.22em] text-subtle uppercase">{badge}</p>
            <h1 className="text-[2.1rem] leading-[1.05] font-semibold tracking-tight text-label sm:text-[3rem] lg:text-[3.4rem]">
              {title}
            </h1>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-muted-foreground sm:text-base">{subtitle}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {clips.map((video, i) => (
                <button
                  key={video.label || i}
                  type="button"
                  onClick={() => setClip(i)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors",
                    i === clip ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground",
                  )}
                >
                  {video.label}
                </button>
              ))}
            </div>
          </div>
          <div className="relative overflow-hidden rounded-xl bg-ink aspect-[16/11] shadow-border">
            <img src={current.poster} alt="" className="absolute inset-0 h-full w-full object-cover" />
            {current.src ? (
              <video
                key={current.src}
                src={current.src}
                poster={current.poster}
                className="absolute inset-0 h-full w-full object-cover"
                muted
                loop
                playsInline
                autoPlay
              />
            ) : null}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/50 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4 text-paper">
              <p className="text-[11px] tracking-[0.2em] uppercase text-paper/70">{current.label}</p>
              <p className="mt-1 text-sm text-paper/90">{current.line}</p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (layout === "centered") {
    return (
      <section id="hero" aria-label="Hero" className="hero-stage relative isolate pt-24 sm:pt-28">
        <div className="shell pb-10 text-center">
          <p className="mb-4 text-[11px] font-medium tracking-[0.24em] text-subtle uppercase">{badge}</p>
          <h1 className="mx-auto max-w-4xl text-[2.35rem] leading-[1.05] font-semibold tracking-tight text-label sm:text-[3.4rem] lg:text-[4rem]">
            {title}
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-muted-foreground sm:text-base">{subtitle}</p>
          <div className="mx-auto mt-10 overflow-hidden rounded-xl bg-ink aspect-[21/9] max-w-5xl shadow-border">
            <img src={current.poster} alt="" className="h-full w-full object-cover" />
          </div>
          <div className="mx-auto mt-5 flex max-w-3xl flex-wrap justify-center gap-1.5">
            {clips.map((video, i) => (
              <button
                key={video.label || i}
                type="button"
                onClick={() => setClip(i)}
                className={cn(
                  "min-h-10 rounded-full px-4 text-[12px] font-medium",
                  i === clip ? "bg-label text-paper" : "bg-card text-muted-foreground",
                )}
              >
                {video.label}
              </button>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (layout === "editorial") {
    return (
      <section id="hero" aria-label="Hero" className="hero-stage relative isolate pt-28 sm:pt-32">
        <div className="shell pb-12">
          <p className="text-[12px] font-medium tracking-[0.28em] text-subtle uppercase">{badge}</p>
          <h1 className="mt-5 max-w-5xl font-display text-[2.8rem] leading-[0.98] font-semibold tracking-tight text-label sm:text-[4.4rem] lg:text-[5.2rem]">
            {title}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">{subtitle}</p>
          <div className="mt-10 overflow-hidden rounded-lg bg-ink aspect-[2.2/1] shadow-border">
            <img src={current.poster} alt="" className="h-full w-full object-cover" />
          </div>
          <div className="mt-4 flex flex-wrap gap-6 text-[13px] text-muted-foreground">
            {clips.map((video, i) => (
              <span key={video.label || i} className="tracking-wide">
                {video.label}
              </span>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="hero" aria-label="Hero" className="hero-stage relative isolate pt-20 sm:pt-24">
      <div className="shell grid gap-3 pb-10 md:grid-cols-6 md:grid-rows-2 md:h-[min(72vh,38rem)]">
        <div className="surface-lift rounded-xl bg-card p-6 md:col-span-3 md:row-span-2 md:p-8 flex flex-col justify-between">
          <div>
            <p className="text-[11px] font-medium tracking-[0.22em] text-subtle uppercase">{badge}</p>
            <h1 className="mt-4 text-[2rem] leading-[1.05] font-semibold tracking-tight text-label sm:text-[2.8rem]">
              {title}
            </h1>
          </div>
          <p className="mt-6 max-w-md text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
        </div>
        {clips.slice(0, 3).map((video, i) => (
          <button
            key={video.label || i}
            type="button"
            onClick={() => setClip(i)}
            className={cn(
              "relative overflow-hidden rounded-xl bg-ink text-left md:col-span-3 min-h-[9rem]",
              i === 0 ? "md:col-span-3" : "md:col-span-3",
            )}
          >
            <img src={video.poster} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/70 to-transparent" />
            <span className="absolute bottom-3 left-3 text-sm font-medium text-paper">{video.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
