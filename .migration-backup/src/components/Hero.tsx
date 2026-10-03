import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { cn } from "@/lib/utils";
import { useSiteConfig } from "@/context/SiteConfigContext";
import { AlternateHero } from "./AlternateHero";

export const HERO_VIDEOS = [
  {
    src: "/hero/studio.mp4",
    poster: "/hero/studio.jpg",
    label: "Codex Dynamics",
    line: "The agency. The standard.",
  },
  {
    src: "/hero/web-dev.mp4",
    poster: "/hero/web-dev.jpg",
    label: "Web Development",
    line: "Websites and web apps, assembled like a product.",
  },
  {
    src: "/hero/design.mp4",
    poster: "/hero/design.jpg",
    label: "Web Design",
    line: "Type, color, and layout as one material.",
  },
  {
    src: "/hero/social.mp4",
    poster: "/hero/social.jpg",
    label: "Social Media",
    line: "Content, campaigns, and growth — in one system.",
  },
] as const;

const CLIP_MS = 10000;
const TONE_MS = 22000;
const TONE_CLASS = [
  "hero-tone-black",
  "hero-tone-pacific",
  "hero-tone-ash",
] as const;

export function Hero() {
  const { config } = useSiteConfig();
  const layout = config.theme?.heroLayout || config.theme?.layout?.heroLayout || "streamer";
  if (layout && layout !== "streamer") {
    return <AlternateHero layout={layout} />;
  }
  return <StreamerHero />;
}

function StreamerHero() {
  const { config } = useSiteConfig();
  const clips = config.hero?.clips?.length ? config.hero.clips : HERO_VIDEOS;

  const [clip, setClip] = useState(0);
  const [tone, setTone] = useState(0);
  const [visibleSlot, setVisibleSlot] = useState<0 | 1>(0);
  const slotA = useRef<HTMLVideoElement>(null);
  const slotB = useRef<HTMLVideoElement>(null);
  const visibleSlotRef = useRef<0 | 1>(0);
  const clipRef = useRef(0);
  const theaterRef = useRef<HTMLDivElement>(null);

  visibleSlotRef.current = visibleSlot;
  clipRef.current = clip;

  const showClip = useCallback((index: number) => {
    if (index === clipRef.current) return;
    const nextSlot: 0 | 1 = visibleSlotRef.current === 0 ? 1 : 0;
    const nextEl = nextSlot === 0 ? slotA.current : slotB.current;
    if (!nextEl) return;

    nextEl.src = clips[index].src;
    nextEl.poster = clips[index].poster;
    nextEl.currentTime = 0;
    nextEl.muted = true;
    nextEl.volume = 0;

    let transitioned = false;
    const switchNow = () => {
      if (transitioned) return;
      transitioned = true;
      void nextEl.play().catch(() => {});
      visibleSlotRef.current = nextSlot;
      clipRef.current = index;
      setVisibleSlot(nextSlot);
      setClip(index);
    };

    if (nextEl.readyState >= 2) {
      switchNow();
    } else {
      nextEl.addEventListener("loadeddata", switchNow, { once: true });
      setTimeout(switchNow, 200);
    }
  }, [clips]);

  useEffect(() => {
    const a = slotA.current;
    if (!a) return;
    a.muted = true;
    a.volume = 0;
    void a.play().catch(() => {});
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const next = (clipRef.current + 1) % clips.length;
      showClip(next);
    }, CLIP_MS);
    return () => window.clearInterval(timer);
  }, [showClip, clips.length]);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const timer = window.setInterval(() => {
      setTone((n) => (n + 1) % TONE_CLASS.length);
    }, TONE_MS);
    return () => window.clearInterval(timer);
  }, []);

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const el = theaterRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--px", `${((e.clientX - r.left) / r.width) * 100}%`);
    el.style.setProperty("--py", `${((e.clientY - r.top) / r.height) * 100}%`);
  };

  const current = clips[clip] || clips[0] || HERO_VIDEOS[0];

  return (
    <section
      id="hero"
      aria-label="Hero"
      className={cn("hero-stage relative isolate pt-14 sm:pt-16", TONE_CLASS[tone])}
    >
      <div className="shell pt-2 pb-6 sm:pt-3 sm:pb-8">
        <div
          ref={theaterRef}
          onPointerMove={onPointerMove}
          className="theater relative flex h-[min(58vh,30rem)] min-h-[22rem] w-full flex-col overflow-hidden rounded-xl bg-ink xl:h-[min(62vh,34rem)]"
        >
          {/* Base poster layer ensures zero black frame/flashes while videos load or switch */}
          <div
            className="absolute inset-0 bg-cover bg-center transition-all duration-700"
            style={{ backgroundImage: `url(${current.poster})` }}
            aria-hidden="true"
          />

          <video
            ref={slotA}
            src={clips[0]?.src || HERO_VIDEOS[0].src}
            poster={clips[0]?.poster || HERO_VIDEOS[0].poster}
            className={cn(
              "absolute inset-0 h-full w-full object-cover transition-opacity duration-700",
              visibleSlot === 0 && "hero-kenburns",
            )}
            style={{ opacity: visibleSlot === 0 ? 1 : 0 }}
            muted
            loop
            playsInline
            preload="metadata"
          />
          <video
            ref={slotB}
            poster={clips[1]?.poster || HERO_VIDEOS[1].poster}
            className={cn(
              "absolute inset-0 h-full w-full object-cover transition-opacity duration-700",
              visibleSlot === 1 && "hero-kenburns",
            )}
            style={{ opacity: visibleSlot === 1 ? 1 : 0 }}
            muted
            loop
            playsInline
            preload="none"
          />

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/78 via-ink/10 to-ink/28" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-ink/30 via-transparent to-transparent" />
          <div className="theater-light pointer-events-none absolute inset-0" />

          <div className="relative z-10 flex h-full flex-col p-5 sm:p-7 lg:p-8">
            <div className="order-2 mt-auto flex flex-col gap-6 lg:order-none lg:mt-0 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
              <div className="max-w-2xl xl:max-w-3xl">
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  className="mb-3 flex items-center gap-2 text-[11px] font-medium tracking-[0.22em] text-paper/70 uppercase"
                >
                  <span className="live-dot" aria-hidden="true" />
                  {config.hero?.badge || "Codex Dynamics"}
                </motion.p>
                <motion.h1
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.55,
                    delay: 0.08,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="text-[2rem] leading-[1.05] font-semibold tracking-tight text-paper sm:text-[2.75rem] lg:text-[3.25rem] xl:text-[3.75rem]"
                >
                  {config.hero?.title || "Precision on every screen."}
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.55,
                    delay: 0.18,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="mt-3 max-w-md text-[15px] leading-relaxed text-paper/80 sm:text-base xl:max-w-lg"
                >
                  {config.hero?.subtitle || "Websites, web apps, and social campaigns — composed with the care of a product launch."}
                </motion.p>
              </div>
            </div>

            <div className="order-1 mb-3 lg:order-2 lg:mt-auto">
              <AnimatePresence mode="wait">
                <motion.div
                  key={current.label}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                >
                  <p className="text-[11px] font-medium tracking-[0.22em] text-paper/70 uppercase">
                    {current.label}
                  </p>
                  <p className="mt-1 text-sm text-paper/90 sm:text-[15px]">
                    {current.line}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="order-3 flex gap-1.5">
                {clips.map((video, i) => (
                  <button
                    key={video.label}
                    type="button"
                    onClick={() => showClip(i)}
                    className={cn(
                      "group/chip relative min-h-10 flex-1 overflow-hidden rounded-full px-1.5 text-left transition-colors duration-200 sm:px-2",
                      i === clip
                        ? "bg-paper/18"
                        : "bg-paper/8 hover:bg-paper/14",
                    )}
                    aria-label={`Play ${video.label}`}
                    aria-current={i === clip}
                  >
                    {i === clip ? (
                      <span
                        key={clip}
                        className="hero-progress absolute inset-y-0 left-0 rounded-full bg-paper/25"
                      />
                    ) : null}
                    <span
                      className={cn(
                        "relative z-10 block truncate px-1 py-2 text-center text-[10px] font-medium tracking-wide sm:px-2 sm:text-left sm:text-[11px]",
                        i === clip ? "text-paper" : "text-paper/55",
                      )}
                    >
                      {video.label}
                    </span>
                  </button>
                ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
