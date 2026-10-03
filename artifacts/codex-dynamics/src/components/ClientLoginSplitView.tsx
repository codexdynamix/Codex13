import React, { useState, useEffect, useRef } from 'react';
import { X, Lock, AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { portalLogin } from '@/services/portalAuth';
import { smoothNavigate } from '@/lib/nav';

export interface ClientLoginSplitViewProps {
  onClose?: () => void;
  onSuccess?: () => void;
}

export function ClientLoginSplitView({
  onClose,
  onSuccess,
}: ClientLoginSplitViewProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);

  // Reliable autoplay on all platforms
  useEffect(() => {
    const el = videoRef.current;
    if (el) {
      el.muted = true;
      el.volume = 0;
      void el.play().catch(() => {});
    }
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Please enter both your email address and password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await portalLogin(email.trim(), password.trim());
      if (onSuccess) {
        onSuccess();
      } else {
        smoothNavigate('/portal/dashboard');
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleReturnToSite = () => {
    if (onClose) {
      onClose();
    } else {
      smoothNavigate('/');
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#0a0b0e] text-white font-sans antialiased overflow-hidden selection:bg-[#0071e3] selection:text-white">
      {/* ========================================================================= */}
      {/* LEFT COLUMN: Hero Section Animating Visual & Codex Dynamics Identity      */}
      {/* ========================================================================= */}
      <div className="w-full lg:w-1/2 xl:w-[52%] relative flex flex-col justify-between p-8 sm:p-14 lg:p-18 xl:p-20 overflow-hidden min-h-[440px] lg:min-h-screen bg-black select-none border-b lg:border-b-0 lg:border-r border-white/[0.08]">
        {/* Base poster layer ensures no flash while video initializes */}
        <div
          className="absolute inset-0 bg-cover bg-center transition-all duration-700"
          style={{ backgroundImage: "url('/hero/studio.jpg')" }}
          aria-hidden="true"
        />

        {/* Hero Section Animating Video */}
        <video
          ref={videoRef}
          src="/hero/studio.mp4"
          poster="/hero/studio.jpg"
          className="absolute inset-0 h-full w-full object-cover scale-[1.02]"
          muted
          loop
          playsInline
          autoPlay
          preload="auto"
        />

        {/* Natural cinematic vignette gradients */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/40" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-black/20" />

        {/* Top: Brand identifier */}
        <div className="relative z-10 flex items-center justify-between">
          <button
            type="button"
            onClick={handleReturnToSite}
            className="inline-flex items-center gap-2.5 group cursor-pointer text-left"
          >
            <span className="size-7 rounded-lg bg-white text-black font-mono text-xs font-bold flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
              C
            </span>
            <span className="font-semibold text-sm tracking-wide text-white font-display">
              Codex Dynamics
            </span>
          </button>
        </div>

        {/* Center: Clean typography */}
        <div className="relative z-10 my-auto py-12 lg:py-0 max-w-lg space-y-2">
          <p className="text-[11px] font-medium tracking-[0.24em] text-white/70 uppercase">
            The agency · The standard
          </p>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white font-display leading-[1.08]">
            Codex Dynamics
          </h1>
        </div>

        {/* Bottom: Clean understated footer */}
        <div className="relative z-10 text-xs text-white/45 pt-4 border-t border-white/15">
          <span>&copy; {new Date().getFullYear()} Codex Dynamics</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* RIGHT COLUMN: Refined Apple-Style Sign-In Interface                       */}
      {/* ========================================================================= */}
      <div className="w-full lg:w-1/2 xl:w-[48%] bg-[#0a0b0e] p-8 sm:p-14 lg:p-18 xl:p-20 flex flex-col justify-between min-h-[520px] lg:min-h-screen relative">
        {/* Top Header: Discreet Close Icon (Apple Style) */}
        <div className="flex items-center justify-end w-full">
          <button
            type="button"
            onClick={handleReturnToSite}
            className="size-8 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
            aria-label="Back to website"
            title="Back to website"
          >
            <X size={18} />
          </button>
        </div>

        {/* Main Sign-In Form Container */}
        <div className="max-w-sm w-full mx-auto my-auto py-6">
          <div className="mb-8">
            <span className="text-[11px] font-medium tracking-[0.2em] text-[#0071e3] uppercase">
              Codex Dynamics
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-display mt-1.5">
              Sign In
            </h2>
            <p className="text-xs sm:text-sm text-white/50 mt-2">
              Enter your email and password to access your account.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-200 text-xs flex items-start gap-2.5">
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-400" />
              <div className="leading-relaxed font-medium">{error}</div>
            </div>
          )}

          {/* Forgot Password Confirmation */}
          {forgotSent && (
            <div className="mb-5 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-start gap-2.5">
              <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-400" />
              <div className="leading-relaxed font-medium">
                Password recovery instructions have been sent to your email.
              </div>
            </div>
          )}

          {/* Sign In Form */}
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-white/80">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full px-4 py-3 bg-white/[0.04] hover:bg-white/[0.06] border border-white/[0.1] focus:border-[#0071e3] rounded-xl text-sm text-white placeholder-white/25 focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-white/80">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-4 pr-11 py-3 bg-white/[0.04] hover:bg-white/[0.06] border border-white/[0.1] focus:border-[#0071e3] rounded-xl text-sm text-white placeholder-white/25 focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-3 py-3.5 px-5 bg-[#0071e3] hover:bg-[#0077ed] text-white font-medium text-sm rounded-xl transition-all shadow-sm active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <span className="inline-block size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Lock size={14} />
                  <span>Sign In</span>
                </>
              )}
            </button>
          </form>

          {/* Assistance Link & Back to Website Link */}
          <div className="mt-6 flex flex-col items-center gap-3 text-xs text-white/45">
            <button
              type="button"
              onClick={() => setForgotSent(true)}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Forgot password?
            </button>

            <button
              type="button"
              onClick={handleReturnToSite}
              className="text-white/35 hover:text-white transition-colors cursor-pointer pt-1"
            >
              ← Back to website
            </button>
          </div>
        </div>

        {/* Quiet assurance note */}
        <div className="text-center text-xs text-white/30 pt-4">
          Authorized account access only
        </div>
      </div>
    </div>
  );
}
