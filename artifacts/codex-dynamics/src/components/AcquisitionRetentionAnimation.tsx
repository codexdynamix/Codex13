import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  Mail,
  Megaphone,
  CheckCircle2,
  ShieldCheck,
  Layers,
  Flame,
} from "lucide-react";

interface AcquisitionRetentionAnimationProps {
  poster?: string;
  className?: string;
  kicker?: string;
  timeline?: string;
}

type Mode = "ads" | "email" | "funnel";

export const AcquisitionRetentionAnimation: React.FC<AcquisitionRetentionAnimationProps> = ({
  poster = "/services/email-marketing.jpg",
  className = "",
  kicker = "05 / Acquisition & Retention",
  timeline = "Ongoing Growth Engine",
}) => {
  const [activeMode, setActiveMode] = useState<Mode>("ads");
  const [metricCounter, setMetricCounter] = useState(48920);
  const [adVariant, setAdVariant] = useState(0);
  const [emailStep, setEmailStep] = useState(1);

  // Rotate simulated live conversions
  useEffect(() => {
    const interval = setInterval(() => {
      setMetricCounter((prev) => prev + Math.floor(Math.random() * 85) + 35);
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  // Auto-cycle modes periodically if user hasn't clicked
  useEffect(() => {
    const timer = setInterval(() => {
      setEmailStep((prev) => (prev % 3) + 1);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  const adCampaigns = [
    {
      channel: "Meta Ads · IG Reels",
      name: "Scale Campaign · High ROAS",
      roas: "5.8x",
      spend: "$8,430",
      revenue: `$${metricCounter.toLocaleString()}`,
      ctr: "4.4%",
      badge: "Scaling Fast",
      badgeColor: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30",
      hook: "Bespoke high-converting video reels & multi-card carousels driving instant impulse checkout.",
    },
    {
      channel: "Google Ads · High-Intent",
      name: "PMax & Search Intent",
      roas: "6.2x",
      spend: "$5,120",
      revenue: "$31,744",
      ctr: "5.9%",
      badge: "High Intent",
      badgeColor: "text-blue-400 bg-blue-500/15 border-blue-500/30",
      hook: "Targeting in-market buyers searching for premium e-commerce solutions with zero wasted ad spend.",
    },
  ];

  const currentAd = adCampaigns[adVariant];

  const emailDrips = [
    {
      step: 1,
      name: "01. High-Urgency Cart Recovery",
      timing: "15 min after dropoff",
      openRate: "68.2%",
      clickRate: "24.6%",
      subject: "Your cart items are reserved for 2 hours",
      preview: "We've saved your custom configuration with complimentary priority shipping...",
      status: "Delivered · Apple Mail",
    },
    {
      step: 2,
      name: "02. Founder Trust & Social Proof",
      timing: "24 hours after dropoff",
      openRate: "54.7%",
      clickRate: "18.3%",
      subject: "Why 240+ e-commerce brands chose this exact build",
      preview: "Here is what our clients experienced within 30 days of cutover...",
      status: "99.8% Inbox Placement",
    },
    {
      step: 3,
      name: "03. VIP Conversion & Direct Desk",
      timing: "48 hours after dropoff",
      openRate: "47.1%",
      clickRate: "29.4%",
      subject: "Direct invitation from our senior development desk",
      preview: "Schedule your 15-minute technical walkthrough before calendar closes...",
      status: "Deal Closed in CRM",
    },
  ];

  return (
    <div
      className={`relative h-full w-full select-none overflow-hidden bg-zinc-950 font-sans text-white ${className}`}
    >
      {/* Background with Apple iOS frosted image backdrop */}
      <img
        src={poster}
        alt="Acquisition & Retention Ad Engine & Drip Sequence"
        className="absolute inset-0 h-full w-full object-cover opacity-25 transition-transform duration-700 hover:scale-105"
        referrerPolicy="no-referrer"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/85 to-zinc-900/75 backdrop-blur-[4px]" />

      {/* Foreground Container with iOS Glassmorphism */}
      <div className="relative z-10 flex h-full flex-col justify-between p-4 sm:p-5">
        {/* Apple iOS Dynamic Island Header Pill */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 shadow-md shadow-blue-500/20">
              <Megaphone className="size-3.5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[10px] font-bold tracking-wider text-blue-400 uppercase">
                  Growth Engine
                </span>
                <span className="size-1 rounded-full bg-zinc-500" />
                <span className="text-[10px] text-zinc-400">Omnichannel</span>
              </div>
              <p className="text-xs font-semibold text-white">
                Paid Ads & Automated Drips
              </p>
            </div>
          </div>

          {/* Apple Live Activity Status Pill */}
          <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-medium text-emerald-400 backdrop-blur-md">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            <span className="font-mono font-bold">5.8x Blended ROAS</span>
          </div>
        </div>

        {/* Apple iOS Segmented Control Switcher */}
        <div className="my-2.5 flex rounded-xl border border-white/10 bg-black/50 p-1 backdrop-blur-xl">
          <button
            type="button"
            onClick={() => setActiveMode("ads")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-all ${
              activeMode === "ads"
                ? "bg-white/20 text-white shadow-md shadow-black/40 ring-1 ring-white/20"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <TrendingUp className="size-3.5 text-blue-400" />
            <span>Meta & Google Ads</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMode("email")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-all ${
              activeMode === "email"
                ? "bg-white/20 text-white shadow-md shadow-black/40 ring-1 ring-white/20"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Mail className="size-3.5 text-purple-400" />
            <span>Automated Drips</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMode("funnel")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-all ${
              activeMode === "funnel"
                ? "bg-white/20 text-white shadow-md shadow-black/40 ring-1 ring-white/20"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Layers className="size-3.5 text-emerald-400" />
            <span>Full Funnel</span>
          </button>
        </div>

        {/* Dynamic Interactive Stage */}
        <div className="flex-1 overflow-hidden py-1">
          {activeMode === "ads" && (
            <div className="space-y-2.5">
              {/* Campaign Selector / Toggle */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-zinc-400">
                  Active Live Paid Campaigns:
                </span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setAdVariant(0)}
                    className={`rounded-md px-2 py-0.5 text-[10px] font-medium transition-all ${
                      adVariant === 0
                        ? "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                        : "bg-white/5 text-zinc-400 border border-white/5"
                    }`}
                  >
                    Meta (IG Reels)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdVariant(1)}
                    className={`rounded-md px-2 py-0.5 text-[10px] font-medium transition-all ${
                      adVariant === 1
                        ? "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                        : "bg-white/5 text-zinc-400 border border-white/5"
                    }`}
                  >
                    Google PMax
                  </button>
                </div>
              </div>

              {/* iOS High-Performance Telemetry Card */}
              <div className="rounded-2xl border border-white/15 bg-white/[0.06] p-3.5 shadow-xl backdrop-blur-2xl">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">
                        {currentAd.name}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold ${currentAd.badgeColor}`}
                      >
                        {currentAd.badge}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[10px] text-zinc-400">
                      {currentAd.channel} · Conversion API (CAPI) Verified
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-lg font-bold tracking-tight text-emerald-400">
                      {currentAd.roas}
                    </span>
                    <span className="block text-[9px] text-zinc-400 uppercase">
                      Return on Spend
                    </span>
                  </div>
                </div>

                {/* Metrics 3-Grid */}
                <div className="mt-3 grid grid-cols-3 gap-2 border-t border-white/10 pt-2.5 text-center">
                  <div className="rounded-lg bg-black/40 p-1.5">
                    <span className="text-[9px] text-zinc-400">Total Spend</span>
                    <span className="block font-mono text-xs font-bold text-white">
                      {currentAd.spend}
                    </span>
                  </div>
                  <div className="rounded-lg bg-black/40 p-1.5">
                    <span className="text-[9px] text-zinc-400">Attributed Rev</span>
                    <span className="block font-mono text-xs font-bold text-emerald-400">
                      {currentAd.revenue}
                    </span>
                  </div>
                  <div className="rounded-lg bg-black/40 p-1.5">
                    <span className="text-[9px] text-zinc-400">Click-Through</span>
                    <span className="block font-mono text-xs font-bold text-blue-400">
                      {currentAd.ctr}
                    </span>
                  </div>
                </div>

                <div className="mt-2.5 flex items-center justify-between rounded-lg bg-white/5 px-2.5 py-1.5 text-[10px] text-zinc-300">
                  <span className="flex items-center gap-1.5 text-zinc-400">
                    <Flame className="size-3 text-amber-400" />
                    Real-time ROAS optimization:
                  </span>
                  <span className="font-semibold text-emerald-400">
                    +34% conversions vs benchmark
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeMode === "email" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] text-zinc-400">
                <span>Automated Drip Sequence Engine:</span>
                <span className="font-mono text-[10px] text-purple-400">
                  Step {emailStep} of 3
                </span>
              </div>

              {/* iOS Apple Mail Notification Preview */}
              <div className="space-y-2">
                {emailDrips.map((item) => (
                  <div
                    key={item.step}
                    onClick={() => setEmailStep(item.step)}
                    className={`cursor-pointer rounded-xl border p-2.5 transition-all ${
                      emailStep === item.step
                        ? "border-purple-500/50 bg-purple-950/30 shadow-lg ring-1 ring-purple-500/20"
                        : "border-white/10 bg-white/[0.04] opacity-75 hover:opacity-100"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div
                          className={`flex size-5 items-center justify-center rounded-full text-[10px] font-bold ${
                            emailStep === item.step
                              ? "bg-purple-500 text-white"
                              : "bg-zinc-800 text-zinc-400"
                          }`}
                        >
                          {item.step}
                        </div>
                        <span className="font-semibold text-white">
                          {item.name}
                        </span>
                      </div>
                      <span className="font-mono text-[10px] text-purple-300">
                        {item.timing}
                      </span>
                    </div>

                    <div className="mt-1 text-[11px] text-zinc-300">
                      <span className="font-medium text-white">Subject: </span>
                      <span className="italic text-zinc-300">"{item.subject}"</span>
                    </div>

                    <div className="mt-2 flex items-center justify-between border-t border-white/5 pt-1.5 text-[10px] text-zinc-400">
                      <div className="flex items-center gap-3">
                        <span>
                          Open:{" "}
                          <strong className="text-emerald-400 font-mono">
                            {item.openRate}
                          </strong>
                        </span>
                        <span>
                          Click:{" "}
                          <strong className="text-blue-400 font-mono">
                            {item.clickRate}
                          </strong>
                        </span>
                      </div>
                      <span className="flex items-center gap-1 text-[9px] text-emerald-400 font-mono">
                        <CheckCircle2 className="size-2.5" />
                        {item.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeMode === "funnel" && (
            <div className="space-y-2">
              <span className="text-[11px] font-medium text-zinc-400">
                Connected Omnichannel Pipeline:
              </span>

              <div className="rounded-xl border border-white/10 bg-black/40 p-3 backdrop-blur-xl">
                <div className="relative space-y-2.5">
                  {/* Step A */}
                  <div className="flex items-center gap-3 rounded-lg border border-blue-500/30 bg-blue-950/30 p-2 text-xs">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-blue-400">
                      <Megaphone className="size-3.5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white">
                          1. Meta & Google Paid Ads
                        </span>
                        <span className="font-mono text-[10px] text-blue-400">
                          ROAS 5.8x
                        </span>
                      </div>
                      <p className="text-[10px] text-zinc-400">
                        Targeted traffic captured & attributed via CAPI
                      </p>
                    </div>
                  </div>

                  {/* Step B */}
                  <div className="flex items-center gap-3 rounded-lg border border-purple-500/30 bg-purple-950/30 p-2 text-xs">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-purple-500/20 text-purple-400">
                      <Mail className="size-3.5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white">
                          2. Automated Drip Nurture
                        </span>
                        <span className="font-mono text-[10px] text-purple-400">
                          68% Open Rate
                        </span>
                      </div>
                      <p className="text-[10px] text-zinc-400">
                        Timed cart recovery & executive proof sequences
                      </p>
                    </div>
                  </div>

                  {/* Step C */}
                  <div className="flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-950/30 p-2 text-xs">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                      <CheckCircle2 className="size-3.5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white">
                          3. CRM Sync & Softphone Desk
                        </span>
                        <span className="font-mono text-[10px] text-emerald-400">
                          Closed Won
                        </span>
                      </div>
                      <p className="text-[10px] text-zinc-400">
                        Lead lands in sales queue with instant Telegram alert
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Apple-Styled Telemetry Footer */}
        <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2 text-[10px] text-zinc-400">
          <div className="flex items-center gap-1.5 font-medium text-white">
            <span className="inline-flex items-center gap-1 rounded bg-purple-500/20 px-2 py-0.5 text-[10px] font-semibold text-purple-300">
              <Megaphone className="size-2.5" />
              {kicker}
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 font-mono text-zinc-400">
              <ShieldCheck className="size-3 text-emerald-400" />
              Verified ROAS
            </span>
          </div>
          <span className="font-mono text-zinc-300">
            {timeline}
          </span>
        </div>
      </div>
    </div>
  );
};
