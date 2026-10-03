import React, { useState, useEffect } from "react";
import {
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  Pause,
  Play,
  Activity,
  CheckCircle2,
  Sparkles,
  Zap,
  Grid,
  Headphones,
  ShieldCheck,
  Building2,
} from "lucide-react";

interface VoipCallingAnimationProps {
  poster?: string;
  className?: string;
  compact?: boolean;
  kicker?: string;
  timeline?: string;
}

type CallPhase = "ringing" | "connected" | "logged";
type TabView = "call" | "crm" | "keypad";

export const VoipCallingAnimation: React.FC<VoipCallingAnimationProps> = ({
  poster = "/services/crm-calling.jpg",
  className = "",
  compact: _compact = false,
  kicker = "04  /  Sales Automation",
  timeline = "Typical Delivery: 2 to 4 Weeks",
}) => {
  const [phase, setPhase] = useState<CallPhase>("connected");
  const [activeTab, setActiveTab] = useState<TabView>("call");
  const [callDuration, setCallDuration] = useState(24);
  const [isMuted, setIsMuted] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const [audioDevice, setAudioDevice] = useState<"airpods" | "speaker">("airpods");
  const [dialedDigits, setDialedDigits] = useState("");
  const [waveformHeights, setWaveformHeights] = useState<number[]>([
    28, 48, 72, 88, 45, 96, 78, 58, 42, 84, 98, 65, 45, 75, 52, 35, 68, 82, 54, 38
  ]);

  // Phase cycle: Ringing (3.5s) -> Connected (14s) -> Logged (4s) -> repeat
  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (phase === "ringing") {
      timer = setTimeout(() => {
        setPhase("connected");
        setCallDuration(1);
      }, 3500);
    } else if (phase === "connected") {
      timer = setTimeout(() => {
        setPhase("logged");
      }, 14000);
    } else if (phase === "logged") {
      timer = setTimeout(() => {
        setPhase("ringing");
      }, 4500);
    }

    return () => clearTimeout(timer);
  }, [phase]);

  // Duration tick
  useEffect(() => {
    if (phase !== "connected" || isOnHold) return;

    const interval = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [phase, isOnHold]);

  // Siri / Voice Memos style fluid soundwave simulation
  useEffect(() => {
    if (phase !== "connected" || isOnHold) return;

    const interval = setInterval(() => {
      setWaveformHeights((prev) =>
        prev.map(() => Math.floor(Math.random() * 80) + 18)
      );
    }, 120);

    return () => clearInterval(interval);
  }, [phase, isOnHold]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const secs = (seconds % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  };

  const keypadButtons = [
    { num: "1", sub: "" },
    { num: "2", sub: "ABC" },
    { num: "3", sub: "DEF" },
    { num: "4", sub: "GHI" },
    { num: "5", sub: "JKL" },
    { num: "6", sub: "MNO" },
    { num: "7", sub: "PQRS" },
    { num: "8", sub: "TUV" },
    { num: "9", sub: "WXYZ" },
    { num: "*", sub: "" },
    { num: "0", sub: "+" },
    { num: "#", sub: "" },
  ];

  return (
    <div
      className={`relative h-full w-full select-none overflow-hidden bg-zinc-950 font-sans text-white ${className}`}
    >
      {/* Background with Apple iOS frosted image texture */}
      <img
        src={poster}
        alt="Bespoke CRM & VoIP Softphone Interface"
        className="absolute inset-0 h-full w-full object-cover opacity-25 transition-transform duration-700 hover:scale-105"
        referrerPolicy="no-referrer"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/85 to-zinc-900/75 backdrop-blur-[3px]" />

      {/* Main Glassmorphic Panel Container */}
      <div className="relative z-10 flex h-full flex-col justify-between p-4 sm:p-5">
        {/* Apple iOS Dynamic Island Status Pill */}
        <div className="mx-auto flex w-full max-w-sm items-center justify-between rounded-full border border-white/20 bg-black/80 px-3.5 py-1.5 shadow-2xl backdrop-blur-2xl ring-1 ring-white/10">
          <div className="flex items-center gap-2">
            <div className="flex size-4 items-center justify-center rounded-full bg-emerald-500">
              <Phone className="size-2.5 text-black" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-xs text-white">
                Nordic Goods
              </span>
              <span className="size-1 rounded-full bg-emerald-400 animate-ping" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Live Audio Activity Waves */}
            <div className="flex items-center gap-0.5">
              <span className="h-2.5 w-0.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="h-4 w-0.5 rounded-full bg-emerald-400 animate-pulse delay-75" />
              <span className="h-1.5 w-0.5 rounded-full bg-emerald-400 animate-pulse delay-150" />
            </div>
            <span className="font-mono text-xs font-bold text-emerald-400 tabular-nums">
              {formatTimer(callDuration)}
            </span>
          </div>
        </div>

        {/* Apple iOS View Segmented Control */}
        <div className="my-2.5 flex rounded-xl border border-white/10 bg-black/40 p-1 backdrop-blur-xl">
          <button
            type="button"
            onClick={() => setActiveTab("call")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-all ${
              activeTab === "call"
                ? "bg-white/20 text-white shadow-sm ring-1 ring-white/20"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <PhoneCall className="size-3 text-emerald-400" />
            <span>Active Desk</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("crm")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-all ${
              activeTab === "crm"
                ? "bg-white/20 text-white shadow-sm ring-1 ring-white/20"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Building2 className="size-3 text-blue-400" />
            <span>CRM Deal Board</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("keypad")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-all ${
              activeTab === "keypad"
                ? "bg-white/20 text-white shadow-sm ring-1 ring-white/20"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Grid className="size-3 text-purple-400" />
            <span>iOS Dialer</span>
          </button>
        </div>

        {/* Center Stage: Switchable Modes */}
        <div className="my-auto py-1">
          {activeTab === "call" && (
            <>
              {phase === "ringing" && (
                <div className="space-y-3 text-center">
                  <div className="relative mx-auto flex size-16 items-center justify-center">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500/25" />
                    <span className="absolute inline-flex size-20 rounded-full border border-emerald-400/40" />
                    <div className="relative flex size-16 items-center justify-center rounded-full bg-gradient-to-tr from-emerald-600 via-teal-500 to-emerald-400 shadow-xl shadow-emerald-500/30">
                      <PhoneIncoming className="size-7 animate-bounce text-white" />
                    </div>
                  </div>

                  <div>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-0.5 text-[11px] font-semibold text-emerald-300 backdrop-blur-md">
                      <Sparkles className="size-3" />
                      Inbound Commercial Call
                    </span>
                    <h4 className="mt-2 text-lg font-bold tracking-tight text-white sm:text-xl">
                      Marcus Vance
                    </h4>
                    <p className="text-xs text-zinc-300">
                      Nordic Goods Co. · Dropshipping Scale Account
                    </p>
                    <p className="mt-1 font-mono text-[10px] text-zinc-400">
                      +1 (415) 890-2341 · Route: Desk #1
                    </p>
                  </div>

                  <div className="flex items-center justify-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setPhase("connected");
                        setCallDuration(1);
                      }}
                      className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-6 py-2 text-xs font-bold text-black shadow-lg shadow-emerald-500/30 transition-transform hover:scale-105 active:scale-95"
                    >
                      <PhoneCall className="size-4" />
                      Answer Call
                    </button>
                  </div>
                </div>
              )}

              {phase === "connected" && (
                <div className="space-y-2.5">
                  {/* Apple iOS Caller Card */}
                  <div className="flex items-center justify-between rounded-2xl border border-white/15 bg-white/[0.08] p-3 shadow-xl backdrop-blur-2xl">
                    <div className="flex items-center gap-3">
                      <div className="relative flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 text-sm font-bold shadow-lg">
                        MV
                        <span className="absolute -bottom-1 -right-1 flex size-4 items-center justify-center rounded-full border-2 border-zinc-950 bg-emerald-400">
                          <CheckCircle2 className="size-2.5 text-black" />
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-sm font-bold text-white">
                            Marcus Vance
                          </h4>
                          <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[9px] font-semibold text-blue-300">
                            Verified Lead
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-300">
                          Nordic Goods Co. · Dropshipping & Retail
                        </p>
                        <p className="font-mono text-[10px] text-zinc-400">
                          Opus HD · 12ms Latency · Encrypted
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-mono text-sm font-bold text-emerald-400">
                        {formatTimer(callDuration)}
                      </div>
                      <div className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-[9px] font-bold text-red-400">
                        <span className="size-1.5 rounded-full bg-red-500 animate-pulse" />
                        REC ACTIVE
                      </div>
                    </div>
                  </div>

                  {/* Siri / Apple Voice Memos Glowing Dynamic Soundwave */}
                  <div className="rounded-2xl border border-white/10 bg-black/40 p-2.5 backdrop-blur-xl">
                    <div className="mb-1 flex items-center justify-between text-[10px] text-zinc-400">
                      <span className="flex items-center gap-1.5 font-medium text-emerald-400">
                        <Activity className="size-3" />
                        Live HD Audio Stream (Browser WebRTC)
                      </span>
                      <span className="font-mono text-zinc-400">
                        {audioDevice === "airpods" ? "AirPods Pro Max" : "MacBook Audio"}
                      </span>
                    </div>

                    <div className="flex h-9 items-end justify-between gap-1 px-1">
                      {waveformHeights.map((h, idx) => (
                        <span
                          key={idx}
                          style={{ height: `${isOnHold ? 6 : h}%` }}
                          className={`w-full rounded-full transition-all duration-100 ${
                            isOnHold
                              ? "bg-zinc-600"
                              : idx % 3 === 0
                                ? "bg-gradient-to-t from-emerald-500 to-teal-300"
                                : idx % 2 === 0
                                  ? "bg-gradient-to-t from-cyan-500 to-blue-400"
                                  : "bg-gradient-to-t from-indigo-500 to-purple-400"
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Apple Intelligence Live Speech-To-Text Transcription */}
                  <div className="relative overflow-hidden rounded-xl border border-white/15 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 p-2.5 text-[11px] leading-snug backdrop-blur-xl">
                    <div className="flex items-center gap-1.5 pb-1 font-semibold text-blue-300 text-[10px]">
                      <Sparkles className="size-3 text-amber-300" />
                      <span>Apple Intelligence Live Transcript</span>
                    </div>
                    <p className="text-zinc-200 italic">
                      "We want to route all our TikTok Shop & Shopify orders directly into your custom softphone so our sales reps call buyers within 60 seconds."
                    </p>
                  </div>

                  {/* Apple iOS Frosted In-Call Round Control Dock */}
                  <div className="flex items-center justify-center gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsMuted(!isMuted)}
                      title={isMuted ? "Unmute" : "Mute"}
                      className={`flex size-10 items-center justify-center rounded-full border transition-all ${
                        isMuted
                          ? "border-red-500/50 bg-red-500/30 text-red-300 shadow-md shadow-red-500/20"
                          : "border-white/15 bg-white/10 text-white hover:bg-white/20"
                      }`}
                    >
                      {isMuted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setAudioDevice(audioDevice === "airpods" ? "speaker" : "airpods")
                      }
                      title="Toggle Output"
                      className="flex size-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white hover:bg-white/20 transition-all"
                    >
                      {audioDevice === "airpods" ? (
                        <Headphones className="size-4 text-emerald-400" />
                      ) : (
                        <Volume2 className="size-4 text-blue-400" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsOnHold(!isOnHold)}
                      title={isOnHold ? "Resume" : "Hold"}
                      className={`flex size-10 items-center justify-center rounded-full border transition-all ${
                        isOnHold
                          ? "border-amber-500/50 bg-amber-500/30 text-amber-300"
                          : "border-white/15 bg-white/10 text-white hover:bg-white/20"
                      }`}
                    >
                      {isOnHold ? <Play className="size-4" /> : <Pause className="size-4" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab("keypad")}
                      title="Keypad"
                      className="flex size-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white hover:bg-white/20 transition-all"
                    >
                      <Grid className="size-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setPhase("logged")}
                      title="End Call"
                      className="flex size-10 items-center justify-center rounded-full bg-red-600 text-white shadow-lg shadow-red-600/40 hover:bg-red-500 active:scale-95 transition-all"
                    >
                      <PhoneOff className="size-4" />
                    </button>
                  </div>
                </div>
              )}

              {phase === "logged" && (
                <div className="space-y-3 rounded-2xl border border-emerald-500/40 bg-emerald-950/40 p-3.5 text-center backdrop-blur-2xl shadow-xl">
                  <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 ring-2 ring-emerald-500/30">
                    <CheckCircle2 className="size-6" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white">
                      Call Recorded & Synced to CRM
                    </h4>
                    <p className="text-xs text-emerald-300">
                      Duration: 02:44 · Audio Logged · Telegram Alert Dispatched
                    </p>
                  </div>

                  <div className="space-y-1.5 rounded-xl bg-black/50 p-2.5 text-left text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400">Deal Pipeline:</span>
                      <span className="font-bold text-emerald-400">
                        Nordic E-Com ($34,500/yr)
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400">Next Action:</span>
                      <span className="text-zinc-200">
                        Wholesale API Contract Dispatched
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-emerald-400 text-[11px] pt-1 border-t border-white/10">
                      <Zap className="size-3.5 shrink-0" />
                      <span>Instant Telegram dispatch sent to Sales Director</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === "crm" && (
            <div className="space-y-2 rounded-2xl border border-white/15 bg-white/[0.06] p-3 backdrop-blur-2xl shadow-xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <div>
                  <span className="text-xs font-bold text-white">
                    Nordic Goods Co. · Dropshipping & Retail
                  </span>
                  <p className="text-[10px] text-zinc-400">
                    Owner: Marcus Vance · Shopify Plus & TikTok Shop
                  </p>
                </div>
                <span className="rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                  Stage: Verbal Close
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-black/40 p-2">
                  <span className="text-[10px] text-zinc-400">Contract Value</span>
                  <span className="block font-mono text-sm font-bold text-emerald-400">
                    $34,500
                  </span>
                </div>
                <div className="rounded-lg bg-black/40 p-2">
                  <span className="text-[10px] text-zinc-400">Lead Source</span>
                  <span className="block font-semibold text-blue-300">
                    Meta Ad #204
                  </span>
                </div>
              </div>

              <div className="rounded-lg bg-black/40 p-2 text-[11px] text-zinc-300">
                <span className="font-semibold text-white">Automated Actions:</span>
                <p className="mt-0.5 text-[10px] text-zinc-400">
                  ✓ Click-to-call softphone logged 4 calls with zero external hardware
                  <br />
                  ✓ Order webhook sync triggered to sales desk Telegram queue
                </p>
              </div>

              <button
                type="button"
                onClick={() => setActiveTab("call")}
                className="w-full rounded-xl bg-blue-600 py-1.5 text-xs font-semibold text-white shadow-md hover:bg-blue-500 transition-all"
              >
                Return to Active Call
              </button>
            </div>
          )}

          {activeTab === "keypad" && (
            <div className="mx-auto w-full max-w-xs space-y-2 rounded-2xl border border-white/15 bg-white/[0.06] p-3 backdrop-blur-2xl shadow-xl">
              <div className="h-6 text-center font-mono text-base font-bold text-emerald-400">
                {dialedDigits || "Dial Number"}
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {keypadButtons.map((b) => (
                  <button
                    key={b.num}
                    type="button"
                    onClick={() => setDialedDigits((prev) => prev + b.num)}
                    className="flex flex-col items-center justify-center rounded-xl border border-white/10 bg-white/10 py-1.5 transition-all hover:bg-white/20 active:scale-95"
                  >
                    <span className="text-sm font-bold text-white">{b.num}</span>
                    {b.sub && (
                      <span className="text-[8px] font-semibold tracking-wider text-zinc-400">
                        {b.sub}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setDialedDigits("")}
                  className="flex-1 rounded-lg bg-zinc-800 py-1 text-[10px] font-medium text-zinc-300 hover:bg-zinc-700"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("call")}
                  className="flex-1 rounded-lg bg-emerald-600 py-1 text-[10px] font-semibold text-white hover:bg-emerald-500"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Apple-Styled Telemetry Footer */}
        <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2 text-[10px] text-zinc-400">
          <div className="flex items-center gap-1.5 font-medium text-white">
            <span className="inline-flex items-center gap-1 rounded bg-blue-500/20 px-2 py-0.5 text-[10px] font-semibold text-blue-400">
              <PhoneCall className="size-2.5" />
              {kicker}
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-zinc-400 font-mono">
              <ShieldCheck className="size-3 text-emerald-400" />
              WebRTC Softphone
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
