import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Lock,
  Layers,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  Terminal,
  Globe,
  User,
  ArrowRight,
} from 'lucide-react';
import { verifyCodexPortalToken, CODEX_PORTAL_CONNECTOR_DOCUMENTATION, type ConnectorVerificationResult } from '../../services/portalConnector';
import { portalDb } from '../../services/portalDatabase';

interface PortalConnectorDemoProps {
  onNavigate: (path: string) => void;
}

export function PortalConnectorDemo({ onNavigate }: PortalConnectorDemoProps) {
  const [tokenInput, setTokenInput] = useState('');
  const [websiteIdInput, setWebsiteIdInput] = useState('');
  const [result, setResult] = useState<ConnectorVerificationResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [simulatedSession, setSimulatedSession] = useState<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');
      const webId = urlParams.get('websiteId');

      if (token && webId) {
        setTokenInput(token);
        setWebsiteIdInput(webId);
        const res = verifyCodexPortalToken(token, webId);
        setResult(res);
        if (res.success) {
          setSimulatedSession(res.authenticatedUser);
        }
      }
    }
  }, []);

  const handleVerify = () => {
    if (!tokenInput.trim() || !websiteIdInput.trim()) return;
    const res = verifyCodexPortalToken(tokenInput.trim(), websiteIdInput.trim());
    setResult(res);
    if (res.success) {
      setSimulatedSession(res.authenticatedUser);
    } else {
      setSimulatedSession(null);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(CODEX_PORTAL_CONNECTOR_DOCUMENTATION);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8 font-sans">
      {/* Header */}
      <div className="pb-6 border-b border-black/[0.06] dark:border-white/[0.08]">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-[#0071E3] mb-1">
          Standardized Protocol
        </div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight flex items-center gap-2.5">
          <Layers size={26} className="text-[#0071E3]" />
          <span>Codex Dynamics Portal Connector</span>
        </h1>
        <p className="text-sm text-[#86868B] mt-1 max-w-3xl leading-relaxed">
          The standardized, configuration-driven authentication bridge between the Codex Dynamics Client Portal and any client website back office.
          Enables seamless one-click single sign-on (SSO) with zero hardcoded code changes for future websites.
        </p>
      </div>

      {/* Simulator Test Bench */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Input & Handshake Console */}
        <div className="p-7 rounded-3xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] shadow-[0_2px_8px_rgba(0,0,0,0.03)] space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[#1D1D1F] dark:text-white flex items-center gap-2">
              <Terminal size={18} className="text-[#0071E3]" />
              <span>Connector Verification Receiver</span>
            </h2>
            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#30D158]/10 text-[#248A3D] dark:text-[#32D74B] border border-[#30D158]/20 flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-[#30D158] animate-pulse" />
              <span>Active Endpoint</span>
            </span>
          </div>
          <p className="text-xs text-[#86868B] leading-relaxed">
            When a client clicks <strong className="text-[#1D1D1F] dark:text-white font-medium">&ldquo;Open Back Office&rdquo;</strong>, Codex Dynamics generates a
            cryptographic single-use token and redirects to the target website connector. Test the receiver below:
          </p>

          <div className="space-y-4 pt-1">
            <div>
              <label className="block text-xs font-semibold text-[#1D1D1F] dark:text-white mb-1.5">Website ID / Connector Slug</label>
              <input
                type="text"
                value={websiteIdInput}
                onChange={(e) => setWebsiteIdInput(e.target.value)}
                placeholder="e.g. site_vance_01"
                className="w-full px-4 py-2.5 bg-[#F5F5F7] dark:bg-[#2C2C2E] border border-black/[0.06] dark:border-white/[0.08] rounded-xl text-xs sm:text-sm text-[#1D1D1F] dark:text-white font-mono focus:outline-none focus:ring-1 focus:ring-[#0071E3]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1D1D1F] dark:text-white mb-1.5">Cryptographic SSO Handoff Token</label>
              <textarea
                rows={3}
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Paste the short-lived 60-second handoff token here..."
                className="w-full px-4 py-2.5 bg-[#F5F5F7] dark:bg-[#2C2C2E] border border-black/[0.06] dark:border-white/[0.08] rounded-xl text-xs font-mono text-[#1D1D1F] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#0071E3]"
              />
            </div>

            <button
              onClick={handleVerify}
              disabled={!tokenInput.trim() || !websiteIdInput.trim()}
              className="w-full py-2.5 rounded-2xl bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold transition-all disabled:opacity-40 flex items-center justify-center gap-1.5 shadow-xs"
            >
              <span>Verify Token &amp; Authenticate Session</span>
              <ArrowRight size={13} />
            </button>
          </div>

          {result && (
            <div
              className={`p-4 rounded-2xl border text-xs space-y-2.5 transition-all ${
                result.success
                  ? 'bg-[#30D158]/10 border-[#30D158]/30 text-[#248A3D] dark:text-[#32D74B]'
                  : 'bg-[#FF3B30]/10 border-[#FF3B30]/30 text-[#FF3B30]'
              }`}
            >
              <div className="flex items-center gap-2 font-semibold">
                {result.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                <span>{result.message}</span>
              </div>
              {result.authenticatedUser && (
                <div className="p-3 bg-white dark:bg-[#1C1C1E] rounded-xl border border-black/[0.05] dark:border-white/[0.08] text-[#1D1D1F] dark:text-[#F5F5F7] space-y-1 font-mono text-[11px]">
                  <div>User: {result.authenticatedUser.name} ({result.authenticatedUser.email})</div>
                  <div>Company: {result.authenticatedUser.company}</div>
                  <div>Role: {result.authenticatedUser.role}</div>
                  <div>Target Website: {result.website?.name} ({result.website?.domain})</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Simulated Authenticated Back Office */}
        <div className="p-7 rounded-3xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] shadow-[0_2px_8px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.06] dark:border-white/[0.08] mb-4">
              <h2 className="text-base font-semibold text-[#1D1D1F] dark:text-white flex items-center gap-2">
                <Globe size={18} className="text-[#30D158]" />
                <span>Simulated Target Back Office</span>
              </h2>
              <span className="text-[11px] text-[#86868B]">End-to-End Test</span>
            </div>

            {simulatedSession ? (
              <div className="space-y-4 p-5 rounded-2xl bg-[#30D158]/[0.05] border border-[#30D158]/20 animate-in fade-in">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-2xl bg-[#30D158]/20 text-[#30D158] flex items-center justify-center font-bold">
                    ✓
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#1D1D1F] dark:text-white">Authenticated via Codex SSO</h3>
                    <p className="text-xs text-[#86868B]">{simulatedSession.email}</p>
                  </div>
                </div>

                <div className="text-xs text-[#86868B] space-y-1 pt-2 border-t border-[#30D158]/20">
                  <div><strong>Access Level:</strong> Full Administrator</div>
                  <div><strong>Back Office:</strong> {result?.website?.name} Admin Panel</div>
                  <div><strong>Session Type:</strong> Token Validated (No Password Required)</div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => onNavigate('/portal/websites')}
                    className="px-4 py-2 rounded-xl bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.07] text-[#1D1D1F] dark:text-white text-xs font-semibold transition-colors"
                  >
                    &larr; Back to My Websites
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center border border-dashed border-black/[0.08] dark:border-white/[0.1] rounded-2xl text-xs text-[#86868B]">
                <Lock size={32} className="mx-auto mb-2 text-[#86868B]/40" />
                <p className="font-semibold text-[#1D1D1F] dark:text-white">Awaiting Authentication Token</p>
                <p className="mt-1 max-w-xs mx-auto">
                  Click &ldquo;Open Back Office&rdquo; on any website card or paste a token in the verification receiver.
                </p>
              </div>
            )}
          </div>

          <div className="pt-5 border-t border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between text-xs text-[#86868B]">
            <span>Documentation Specification:</span>
            <button
              onClick={handleCopyCode}
              className="text-[#0071E3] hover:underline font-semibold flex items-center gap-1"
            >
              {copied ? <Check size={12} className="text-[#30D158]" /> : <Copy size={12} />}
              <span>{copied ? 'Copied Markdown' : 'Copy Integration Docs'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
