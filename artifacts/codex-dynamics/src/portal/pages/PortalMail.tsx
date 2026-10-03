import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Inbox, Mail, RefreshCw, Reply, Send } from 'lucide-react';
import { readPortalSession } from '../../services/portalAuth';
import type { PortalClient } from '../../services/portalDatabase';

interface PortalMailProps {
  client: PortalClient;
  onNavigate: (path: string) => void;
}
interface MailRow {
  uid: number;
  from: string;
  subject: string;
  date: string;
  seen: boolean;
}
interface MailMessage extends MailRow {
  to: string;
  messageId: string;
  body: string;
}

async function requestMailbox(path: string, body?: unknown) {
  const session = readPortalSession();
  if (!session?.token) throw new Error('Your session has expired. Sign in again.');
  const response = await fetch(path, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${session.token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) throw new Error(result.error || `Email request failed (${response.status}).`);
  return result;
}

export function PortalMail({ client, onNavigate }: PortalMailProps) {
  const [messages, setMessages] = useState<MailRow[]>([]);
  const [selected, setSelected] = useState<MailMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [reply, setReply] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadInbox = useCallback(async (keepUid?: number) => {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({ client_id: client.id });
      const result = await requestMailbox(`/api/portal/mail?${query}`);
      setMessages(result.messages || []);
      if (keepUid) await loadMessage(keepUid);
      else if (result.messages?.[0]) await loadMessage(result.messages[0].uid);
      else setSelected(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not open the inbox.');
    } finally {
      setLoading(false);
    }
  }, [client.id]);

  const loadMessage = async (uid: number) => {
    const query = new URLSearchParams({ client_id: client.id, uid: String(uid) });
    const result = await requestMailbox(`/api/portal/mail?${query}`);
    setSelected(result.email);
    setReply('');
  };

  useEffect(() => { void loadInbox(); }, [loadInbox]);

  const sendReply = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || !reply.trim()) return;
    setSending(true);
    setError('');
    setNotice('');
    try {
      const query = new URLSearchParams({ client_id: client.id });
      await requestMailbox(`/api/portal/mail/reply?${query}`, { uid: selected.uid, body: reply.trim() });
      setReply('');
      setNotice('Your reply was sent.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not send your reply.');
    } finally {
      setSending(false);
    }
  };

  const prettyDate = (date: string) => {
    const value = new Date(date);
    return Number.isNaN(value.getTime()) ? date : value.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  };

  return (
    <div className="space-y-5 font-sans">
      <div className="flex flex-col justify-between gap-3 border-b border-black/[0.06] dark:border-white/[0.08] pb-5 sm:flex-row sm:items-center">
        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[#0071E3]">Client email</div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">Inbox</h1>
          <p className="mt-1 text-sm text-[#86868B]">Read and reply to your mailbox from {client.company}.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => onNavigate('/portal/access')} className="inline-flex items-center gap-1.5 rounded-xl border border-black/[0.08] dark:border-white/[0.1] px-3 py-2 text-xs font-semibold">
            <ArrowLeft size={14} /> Access details
          </button>
          <button type="button" onClick={() => void loadInbox(selected?.uid)} disabled={loading} className="inline-flex items-center gap-1.5 rounded-xl bg-[#0071E3] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {error && <div role="alert" className="rounded-xl border border-[#FF3B30]/25 bg-[#FF3B30]/[0.06] p-3 text-sm text-[#C53030] dark:text-[#FF6961]">{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-[#30D158]/25 bg-[#30D158]/[0.07] p-3 text-sm text-[#248A3D] dark:text-[#32D74B]">{notice}</div>}

      <div className="grid min-h-[540px] overflow-hidden rounded-3xl border border-black/[0.07] dark:border-white/[0.09] bg-white dark:bg-[#1C1C1E] lg:grid-cols-[minmax(250px,0.8fr)_minmax(0,1.6fr)]">
        <aside className="border-b border-black/[0.07] dark:border-white/[0.09] lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-2 border-b border-black/[0.06] dark:border-white/[0.08] px-4 py-3 text-xs font-semibold text-[#86868B]">
            <Inbox size={15} /> Latest 40 messages
          </div>
          <div className="max-h-[610px] overflow-y-auto">
            {loading && messages.length === 0 && <p className="p-5 text-sm text-[#86868B]">Connecting to your mailbox…</p>}
            {!loading && messages.length === 0 && !error && <p className="p-5 text-sm text-[#86868B]">This inbox has no messages yet.</p>}
            {messages.map((item) => (
              <button type="button" key={item.uid} onClick={() => void loadMessage(item.uid).catch((reason) => setError(reason.message))} className={`block w-full border-b border-black/[0.05] dark:border-white/[0.06] px-4 py-3 text-left transition-colors ${selected?.uid === item.uid ? 'bg-[#0071E3]/[0.07]' : 'hover:bg-black/[0.025] dark:hover:bg-white/[0.03]'}`}>
                <span className="flex items-center gap-2">
                  <span className={`size-1.5 shrink-0 rounded-full ${item.seen ? 'bg-transparent' : 'bg-[#0071E3]'}`} />
                  <span className={`min-w-0 flex-1 truncate text-xs ${item.seen ? 'font-medium' : 'font-bold'}`}>{item.from || '(Unknown sender)'}</span>
                </span>
                <span className="mt-1 block truncate pl-3.5 text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">{item.subject || '(No subject)'}</span>
                <span className="mt-1 block pl-3.5 text-[10px] text-[#86868B]">{prettyDate(item.date)}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="min-w-0">
          {!selected ? (
            <div className="flex h-full min-h-[320px] flex-col items-center justify-center p-8 text-center text-[#86868B]">
              <Mail size={30} className="mb-3" />
              <p className="text-sm font-medium">{loading ? 'Loading your inbox…' : 'Select a message to read it'}</p>
            </div>
          ) : (
            <div className="flex h-full flex-col">
              <header className="border-b border-black/[0.06] dark:border-white/[0.08] px-5 py-4">
                <h2 className="text-base font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">{selected.subject || '(No subject)'}</h2>
                <div className="mt-2 space-y-1 text-xs text-[#86868B]">
                  <div><strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">From:</strong> {selected.from}</div>
                  <div><strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">To:</strong> {selected.to}</div>
                  <div>{prettyDate(selected.date)}</div>
                </div>
              </header>
              <pre className="min-h-[180px] flex-1 whitespace-pre-wrap break-words px-5 py-5 font-sans text-sm leading-relaxed text-[#1D1D1F] dark:text-[#F5F5F7]">{selected.body || '(This message has no readable plain-text body.)'}</pre>
              <form onSubmit={sendReply} className="border-t border-black/[0.06] dark:border-white/[0.08] p-4">
                <label htmlFor="portal-email-reply" className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-[#86868B]"><Reply size={14} /> Reply</label>
                <textarea id="portal-email-reply" required maxLength={40000} rows={4} value={reply} onChange={(event) => setReply(event.target.value)} placeholder={`Reply to ${selected.from || 'this email'}…`} className="w-full resize-y rounded-xl border border-black/[0.08] dark:border-white/[0.1] bg-[#FAFAFB] dark:bg-[#111113] p-3 text-sm text-[#1D1D1F] dark:text-[#F5F5F7] outline-none focus:border-[#0071E3]" />
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="text-[10px] text-[#86868B]">Replies are sent through the configured secure SMTP server.</span>
                  <button type="submit" disabled={sending || !reply.trim()} className="inline-flex items-center gap-1.5 rounded-xl bg-[#0071E3] px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
                    <Send size={13} /> {sending ? 'Sending…' : 'Send reply'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}