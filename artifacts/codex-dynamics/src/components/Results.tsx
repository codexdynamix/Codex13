import { useEffect, useRef, useState } from "react";
import { Reveal } from "@/components/Reveal";
import { useSiteConfig } from "@/context/SiteConfigContext";

const defaultStats = [
  { value: 140, suffix: "+", label: "Websites shipped" },
  { value: 4.8, suffix: "x", label: "Avg. social ROAS", decimals: 1 },
  { value: 28, suffix: " days", label: "Typical build" },
  { value: 60, suffix: "+", label: "Brands in market" },
];

function useCountUp(target: number, start: boolean, decimals = 0) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!start) return;
    const duration = 1400;
    const t0 = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Number((target * eased).toFixed(decimals)));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [start, target, decimals]);
  return n;
}

function Stat({
  value,
  suffix,
  label,
  decimals = 0,
  active,
}: {
  value: number;
  suffix: string;
  label: string;
  decimals?: number;
  active: boolean;
}) {
  const n = useCountUp(value, active, decimals);
  return (
    <div className="text-center sm:text-left">
      <div className="text-4xl font-semibold tracking-tight text-paper tabular-nums sm:text-5xl">
        {decimals ? n.toFixed(decimals) : n}
        {suffix}
      </div>
      <div className="mt-2 text-sm font-medium text-subtle">{label}</div>
    </div>
  );
}

export function Results() {
  const { config } = useSiteConfig();
  const statList = config.results?.metrics?.length
    ? config.results.metrics
    : config.results?.stats?.length
      ? config.results.stats
      : defaultStats;
  const ref = useRef<HTMLElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setActive(true);
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      id="results"
      aria-label="Results"
      className="scroll-mt-24 bg-ink py-16 sm:py-24"
    >
      <div className="shell">
        <Reveal>
          <p className="mb-3 text-[11px] font-medium tracking-[0.22em] text-subtle uppercase">
            {config.results?.badge || "Proof"}
          </p>
          <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-paper sm:text-5xl">
            {config.results?.title || "Measured the way a board measures it."}
          </h2>
          <p className="mt-4 max-w-xl text-base text-subtle sm:text-lg">
            {config.results?.subtitle || "Speed, conversion, and paid social return — not a 40-page deck."}
          </p>
        </Reveal>
        <div className="mt-12 grid grid-cols-2 gap-10 lg:grid-cols-4">
          {statList.map((s: any, idx: number) => (
            <Reveal key={s.label} delay={idx * 75} direction="up">
              <Stat {...s} active={active} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
