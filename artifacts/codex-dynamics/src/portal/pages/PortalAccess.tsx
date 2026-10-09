import React, { useEffect, useState } from 'react';
import { ExternalLink, KeyRound, Mail, Copy, Check } from 'lucide-react';
import { portalAuthHeaders, readPortalSession } from '../../services/portalAuth';
import type { PortalClient } from '../../services/portalDatabase';

interface PortalAccessProps {
  client: PortalClient;
  onNavigate: (path: string) => void;
}
interface ClientAccess {
  websiteUrl: string;
  websiteUsername: string;
  websitePassword: string;
  emailAddress: string;
  webmailUrl: string;
  emailPassword: string;
}

async function loadAccess(clientId: string) {
  const session = readPortalSession();
  if (!session?.token) throw new Error('Your session has expired. Sign in again.');
  const query = new URLSearchParams({ client_id: clientId });
  const response = await fetch(`/api/portal/access?${query}`, {
    headers: portalAuthHeaders(session.token),
    credentials: 'same-origin',
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) throw new Error(data.error || 'Could not load your access details.');
  return data.access as ClientAccess | null;
}

export function PortalAccess({ client, onNavigate }: PortalAccessProps) {
  const [access, setAccess] = useState<ClientAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState('');

  useEffect(() => {
    let active = true;
    loadAccess(client.id)
      .then((value) => active && setAccess(value))
      .catch((reason) => active && setError(reason?.message || 'Could not load your access details.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [client.id]);

  const copy = async (label: string, value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(''), 1800);
    } catch {
      setError('Clipboard access is unavailable. Select and copy the text instead.');
    }
  };

  const Credential = ({ label, value, keyName }: { label: string; value: string; keyName: string }) => (
    <div className="flex items-center gap-2 rounded-xl border border-black/[0.07] dark:border-white/[0.09] bg-black/[0.02] dark:bg-white/[0.03] px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">{label}</div>
        <div className="mt-1 break-all font-mono text-xs text-[#1D1D1F] dark:text-[#F5F5F7]">
          {value ? (visible[keyName] ? value : '••••••••••••') : 'Not provided'}
        </div>
      </div>
      {value && keyName.toLowerCase().includes('password') && (
        <button type="button" onClick={() => setVisible((current) => ({ ...current, [keyName]: !current[keyName] }))} className="text-[11px] font-semibold text-[#0071E3] hover:underline">
          {visible[keyName] ? 'Hide' : 'Show'}
        </button>
      )}
      {value && <button type="button" title={`Copy ${label}`} onClick={() => copy(label, value)} className="rounded-lg p-1.5 text-[#0071E3] hover:bg-[#0071E3]/10">
        {copied === label ? <Check size={14} /> : <Copy size={14} />}
      </button>}
    </div>
  );

  return (
    <div className="space-y-6 font-sans">
      <div className="border-b border-black/[0.06] dark:border-white/[0.08] pb-5">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[#0071E3]">Your account access</div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">Website &amp; email access</h1>
        <p className="mt-1 text-sm text-[#86868B]">Secure sign-in details shared with {client.company}.</p>
      </div>
      {loading && <div className="rounded-2xl border border-black/[0.07] dark:border-white/[0.09] bg-white dark:bg-[#1C1C1E] p-6 text-sm text-[#86868B]">Loading access details…</div>}
      {error && <div role="alert" className="rounded-2xl border border-[#FF3B30]/25 bg-[#FF3B30]/[0.06] p-4 text-sm text-[#C53030] dark:text-[#FF6961]">{error}</div>}
      {!loading && !error && !access && (
        <div className="rounded-2xl border border-dashed border-black/[0.12] dark:border-white/[0.14] bg-white dark:bg-[#1C1C1E] p-8 text-center">
          <KeyRound className="mx-auto mb-3 text-[#86868B]" size={28} />
          <h2 className="font-semibold">No access details yet</h2>
          <p className="mt-1 text-sm text-[#86868B]">Your project manager will add your website or email sign-in details here.</p>
        </div>
      )}
      {access && (
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="space-y-4 rounded-3xl border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#1C1C1E] p-6">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-[#0071E3]/10 text-[#0071E3]"><KeyRound size={19} /></div>
              <div><h2 className="font-semibold">Website back office</h2><p className="text-xs text-[#86868B]">Sign in to your site administration.</p></div>
            </div>
            <Credential label="Login email / username" value={access.websiteUsername} keyName="websiteUsername" />
            <Credential label="Password" value={access.websitePassword} keyName="websitePassword" />
            {access.websiteUrl ? <a href={access.websiteUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-[#0071E3] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0066CC]">
              Open website back office <ExternalLink size={15} />
            </a> : <p className="text-xs text-[#86868B]">The back-office link has not been added yet.</p>}
          </section>

          <section className="space-y-4 rounded-3xl border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#1C1C1E] p-6">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-[#30D158]/10 text-[#248A3D] dark:text-[#32D74B]"><Mail size={19} /></div>
              <div><h2 className="font-semibold">Email inbox</h2><p className="text-xs text-[#86868B]">Read and reply without leaving your client portal.</p></div>
            </div>
            <Credential label="Email address" value={access.emailAddress} keyName="emailAddress" />
            <Credential label="Email password" value={access.emailPassword} keyName="emailPassword" />
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={!access.emailAddress} onClick={() => onNavigate('/portal/mail')} className="inline-flex items-center gap-2 rounded-xl bg-[#0071E3] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
                Open inbox <Mail size={15} />
              </button>
              {access.webmailUrl && <a href={access.webmailUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-black/[0.08] dark:border-white/[0.1] px-4 py-3 text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                Open webmail <ExternalLink size={15} />
              </a>}
            </div>
            <p className="text-[11px] leading-relaxed text-[#86868B]">Your mailbox password is encrypted in storage and sent only to your authenticated client session when this page is opened.</p>
          </section>
        </div>
      )}
    </div>
  );
}