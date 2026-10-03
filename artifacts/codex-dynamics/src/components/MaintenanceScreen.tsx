import { useState, useEffect } from "react";
import { Shield, Mail, CheckCircle2, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useSiteConfig } from "@/context/SiteConfigContext";
import { toast } from "sonner";

export function MaintenanceScreen() {
  const { config } = useSiteConfig();
  const emergency = config.emergency;
  const [notifyEmail, setNotifyEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number } | null>(null);

  const launchTarget = emergency?.estimatedLaunch || emergency?.estimatedReturn;

  useEffect(() => {
    if (!launchTarget) return;

    const target = new Date(launchTarget).getTime();
    if (isNaN(target)) return;

    const updateTimer = () => {
      const now = Date.now();
      const diff = Math.max(0, target - now);

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, minutes, seconds });
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [launchTarget]);

  const handleNotify = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = notifyEmail.trim();
    if (!email) return;
    setSubmitted(true);
    toast.success("Thank you! We'll notify you as soon as our platform is back live.");

    try {
      await fetch("/api/crm/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_lead",
          name: "Maintenance Subscriber",
          email,
          source: "maintenance_screen",
          score: 65,
          notes: "Subscribed for relaunch notification during maintenance mode.",
        }),
      });
    } catch {
      // Background capture
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] flex flex-col justify-between p-6 sm:p-10 font-sans selection:bg-blue/20">
      {/* Top Bar */}
      <div className="flex items-center justify-between max-w-4xl mx-auto w-full">
        <div className="flex items-center gap-2.5">
          <span className="relative flex size-8 items-center justify-center rounded-[10px] bg-blue text-white font-bold text-sm shadow-sm">
            C
          </span>
          <span className="font-display font-semibold text-sm tracking-tight">
            {config.siteName || "Codex Dynamics"}
          </span>
        </div>

        <Link
          to="/admin"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-muted-foreground hover:text-label hover:bg-black/5 transition border border-black/5"
        >
          <Shield className="size-3.5 text-blue" />
          <span>Admin Portal</span>
        </Link>
      </div>

      {/* Main Card */}
      <div className="max-w-xl mx-auto w-full text-center my-auto py-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-700 border border-amber-500/20 text-xs font-semibold uppercase tracking-wider mb-6">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
          </span>
          <span>Maintenance Mode Active</span>
        </div>

        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-label font-display mb-4">
          {emergency?.headline || "Scheduled Platform Upgrades in Progress"}
        </h1>

        <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-md mx-auto mb-8">
          {emergency?.subtext ||
            emergency?.message ||
            "We are fine-tuning our high-performance digital agency platform. We will be back shortly with enhanced speed, security, and capabilities."}
        </p>

        {/* Countdown timer */}
        {timeLeft && (
          <div className="grid grid-cols-4 gap-2 sm:gap-4 max-w-xs sm:max-w-sm mx-auto mb-8">
            <div className="p-3 sm:p-4 rounded-2xl bg-white border border-black/8 shadow-xs">
              <span className="block text-2xl sm:text-3xl font-bold text-label font-mono">
                {String(timeLeft.days).padStart(2, "0")}
              </span>
              <span className="text-[10px] sm:text-xs text-subtle font-medium uppercase">Days</span>
            </div>
            <div className="p-3 sm:p-4 rounded-2xl bg-white border border-black/8 shadow-xs">
              <span className="block text-2xl sm:text-3xl font-bold text-label font-mono">
                {String(timeLeft.hours).padStart(2, "0")}
              </span>
              <span className="text-[10px] sm:text-xs text-subtle font-medium uppercase">Hours</span>
            </div>
            <div className="p-3 sm:p-4 rounded-2xl bg-white border border-black/8 shadow-xs">
              <span className="block text-2xl sm:text-3xl font-bold text-label font-mono">
                {String(timeLeft.minutes).padStart(2, "0")}
              </span>
              <span className="text-[10px] sm:text-xs text-subtle font-medium uppercase">Mins</span>
            </div>
            <div className="p-3 sm:p-4 rounded-2xl bg-white border border-black/8 shadow-xs">
              <span className="block text-2xl sm:text-3xl font-bold text-label font-mono">
                {String(timeLeft.seconds).padStart(2, "0")}
              </span>
              <span className="text-[10px] sm:text-xs text-subtle font-medium uppercase">Secs</span>
            </div>
          </div>
        )}

        {/* Lead notify input */}
        {submitted ? (
          <div className="inline-flex items-center gap-2 p-3.5 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-medium">
            <CheckCircle2 className="size-4 shrink-0" />
            <span>You're on the priority notification list. See you soon!</span>
          </div>
        ) : (
          <form onSubmit={handleNotify} className="flex max-w-md mx-auto gap-2">
            <div className="relative flex-1">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-subtle" />
              <input
                type="email"
                required
                value={notifyEmail}
                onChange={(e) => setNotifyEmail(e.target.value)}
                placeholder="Enter email to get notified at relaunch"
                className="w-full text-xs rounded-xl border border-black/10 bg-white pl-10 pr-3.5 py-3 text-label placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-blue/20 focus:border-blue transition shadow-xs"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-xl bg-label text-white px-4 py-3 text-xs font-semibold hover:bg-label/90 transition shadow-xs cursor-pointer shrink-0"
            >
              <span>Notify Me</span>
              <ArrowRight className="size-3.5" />
            </button>
          </form>
        )}
      </div>

      {/* Footer info */}
      <div className="text-center text-xs text-subtle max-w-4xl mx-auto w-full pt-6 border-t border-black/5">
        <span>© {new Date().getFullYear()} {config.siteName || "Codex Dynamics"}. High-Performance Digital Agency.</span>
      </div>
    </div>
  );
}
