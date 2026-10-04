import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Archive, ChevronLeft, ChevronRight, Inbox, Mail, MailOpen, Paperclip, PenLine, RefreshCw, Reply, Search, Send, Star, Trash2, X } from 'lucide-react';
import type { PortalClient } from '../../services/portalDatabase';
import {
  deletePortalMailDraft, deletePortalMailMessage, downloadPortalMailAttachment, getPortalMailFolders,
  getPortalMailboxes, getPortalMailMessage, getPortalStarredMessages, listPortalMailDrafts,
  listPortalMailMessages, movePortalMessage, savePortalMailDraft, searchPortalMailMessages,
  sendPortalMail, setPortalMessageFlags, type ClientMailbox, type Draft, type Folder, type MailMessage,
} from '../hostingerMailApi';

interface PortalMailProps { client: PortalClient; onNavigate: (path: string) => void }
const PAGE_SIZE = 25;
const addressLabel = (a?: {address:string; name:string} | null) => a ? (a.name ? `${a.name} <${a.address}>` : a.address) : 'Unknown sender';
const niceDate = (d: string) => { const date = new Date(d); return Number.isNaN(date.getTime()) ? d : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); };
const safeMailHtml = (html: string) => {
  // Render untrusted markup in an isolated document: no scripts, frames, forms, external requests or plugins.
  const clean = html.replace(/<\s*(script|iframe|frame|object|embed|form|meta|link|base)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|iframe|frame|object|embed|form|meta|link|base)\b[^>]*\/?>/gi, '')
    .replace(/\s(on[a-z]+|src|srcset|action|formaction)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, (_m, attr) => attr.toLowerCase() === 'src' ? '' : '')
    .replace(/url\s*\([^)]*\)/gi, 'none').replace(/javascript:/gi, '');
  return `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'none'; style-src 'unsafe-inline'; font-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{font:14px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#29333d;margin:0;padding:8px;overflow-wrap:anywhere}a{color:#2367a6;text-decoration:underline}</style></head><body>${clean}</body></html>`;
};

export function PortalMail({ client, onNavigate }: PortalMailProps) {
  const [mailboxes, setMailboxes] = useState<ClientMailbox[]>([]);
  const [resourceId, setResourceId] = useState('');
  const [folders, setFolders] = useState<Folder[]>([]);
  const [folder, setFolder] = useState('');
  const [messages, setMessages] = useState<MailMessage[]>([]);
  const [selected, setSelected] = useState<MailMessage | null>(null);
  const [body, setBody] = useState({ text: '', html: '' });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [starredView, setStarredView] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [composeOpen, setComposeOpen] = useState(false);
  const [mobilePane, setMobilePane] = useState<'folders'|'list'|'reader'>('list');
  const [compose, setCompose] = useState<Draft>({ to: [], cc: [], bcc: [], subject: '', text: '', attachments: [] });
  const mailbox = mailboxes.find(m => m.providerMailboxId === resourceId);

  const loadFolders = useCallback(async (id: string, prefer?: string) => {
    const [nextFolders, nextDrafts] = await Promise.all([getPortalMailFolders(id), listPortalMailDrafts(id)]);
    setFolders(nextFolders); setDrafts(nextDrafts);
    const next = prefer && nextFolders.some(f => f.path === prefer) ? prefer : (nextFolders.find(f => f.specialUse?.toLowerCase() === '\\inbox')?.path || nextFolders[0]?.path || '');
    setFolder(next);
    return next;
  }, []);

  const loadMessages = useCallback(async (id: string, path: string, nextPage: number, text = search, starred = starredView) => {
    if (!id || !path && !starred) { setMessages([]); setSelected(null); return; }
    setLoading(true); setError('');
    try {
      const result = starred ? await getPortalStarredMessages(id, nextPage, PAGE_SIZE)
        : text.trim() ? await searchPortalMailMessages(id, path, text.trim(), nextPage, PAGE_SIZE)
          : await listPortalMailMessages(id, path, nextPage, PAGE_SIZE);
      const rows = result.messages || [];
      setMessages(rows); setPage(result.pagination?.page || nextPage); setTotalPages(Math.max(1, result.pagination?.totalPages || 1));
      if (!rows.some(m => m.uid === selected?.uid)) setSelected(null);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load messages.'); }
    finally { setLoading(false); }
  }, [search, starredView, selected?.uid]);

  useEffect(() => {
    let active = true;
    getPortalMailboxes().then(async list => {
      if (!active) return;
      const enabled = list.filter(m => m.enabled);
      setMailboxes(enabled);
      if (enabled[0]) { setResourceId(enabled[0].providerMailboxId); await loadFolders(enabled[0].providerMailboxId); }
    }).catch(e => setError(e instanceof Error ? e.message : 'Could not load assigned mailboxes.'))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [loadFolders]);

  useEffect(() => { if (resourceId && folder) void loadMessages(resourceId, folder, 1, search, starredView); }, [resourceId, folder, search, starredView, loadMessages]);
  const openMessage = async (item: MailMessage) => {
    setSelected(item); setMobilePane('reader'); setError('');
    try {
      const result = await getPortalMailMessage(resourceId, item.path || folder, item.uid);
      setBody(result.body || { text: '', html: '' }); setSelected(result.message || item);
      if (item.unseen) { await setPortalMessageFlags(resourceId, item.path || folder, item.uid, ['\\Seen'], []); await loadMessages(resourceId, folder, page); }
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not open this message.'); }
  };
  const refresh = async () => { try { await loadFolders(resourceId, folder); await loadMessages(resourceId, folder, page); if (selected) await openMessage(selected); } catch (e) { setError(e instanceof Error ? e.message : 'Refresh failed.'); } };
  const runSearch = (event: React.FormEvent) => { event.preventDefault(); setSearch(query); setPage(1); };
  const mutateSelected = async (action: 'star'|'delete'|'archive') => {
    if (!selected) return;
    setBusy(true); setError('');
    try {
      const sourceFolder = selected.path || folder;
      if (action === 'star') await setPortalMessageFlags(resourceId, sourceFolder, selected.uid, selected.flags.includes('\\Flagged') ? [] : ['\\Flagged'], selected.flags.includes('\\Flagged') ? ['\\Flagged'] : []);
      if (action === 'delete') await deletePortalMailMessage(resourceId, sourceFolder, selected.uid);
      if (action === 'archive') {
        const target = folders.find(f => /archive/i.test(f.name))?.path;
        if (!target) throw new Error('No Archive folder is available for this mailbox.');
        await movePortalMessage(resourceId, sourceFolder, selected.uid, target);
      }
      setSelected(null); await loadMessages(resourceId, folder, page);
    } catch (e) { setError(e instanceof Error ? e.message : 'The message could not be updated.'); }
    finally { setBusy(false); }
  };
  const startReply = () => {
    const address = selected?.from?.address;
    setCompose({ to: address ? [address] : [], cc: [], bcc: [], subject: selected?.subject?.startsWith('Re:') ? selected.subject : `Re: ${selected?.subject || ''}`, text: '', attachments: [], inReplyTo: selected ? { folder, uid: selected.uid } : undefined });
    setComposeOpen(true);
  };
  const saveDraft = async () => {
    if (!resourceId) return;
    setBusy(true);
    try { const saved = await savePortalMailDraft(resourceId, compose); setDrafts(await listPortalMailDrafts(resourceId)); if (saved?.id) setCompose(saved); setNotice('Draft saved to this mailbox.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save draft.'); }
    finally { setBusy(false); }
  };
  const send = async (event: React.FormEvent) => {
    event.preventDefault(); if (!resourceId || !compose.to.length) return;
    const recipients = [...compose.to, ...compose.cc, ...compose.bcc];
    if (recipients.some(address => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address))) { setError('Enter a valid email address for every recipient.'); return; }
    setBusy(true); setError('');
    try {
      await sendPortalMail(resourceId, { to: compose.to, cc: compose.cc, bcc: compose.bcc, subject: compose.subject, text: compose.text, html: compose.html, attachments: compose.attachments, inReplyTo: compose.inReplyTo, forwardOf: compose.forwardOf });
      if (compose.id) await deletePortalMailDraft(resourceId, compose.id);
      setDrafts(await listPortalMailDrafts(resourceId)); setComposeOpen(false); setCompose({ to: [], cc: [], bcc: [], subject: '', text: '', attachments: [] }); setNotice('Message sent.'); await loadMessages(resourceId, folder, page);
    } catch (e) { setError(e instanceof Error ? e.message : 'Message could not be sent.'); }
    finally { setBusy(false); }
  };
  const chooseFiles = async (files: FileList | null) => {
    if (!files) return;
    const chosen = Array.from(files);
    if (chosen.some(f => f.size > 10 * 1024 * 1024)) { setError('Each attachment must be 10 MB or smaller.'); return; }
    if (chosen.some(f => /[\\/\u0000-\u001f\u007f]/.test(f.name) || !f.name.trim())) { setError('One or more attachment filenames are invalid.'); return; }
    const encoded = await Promise.all(chosen.map(file => new Promise<Draft['attachments'][number]>((resolve, reject) => {
      const reader = new FileReader(); reader.onerror = () => reject(new Error('Could not read attachment.'));
      reader.onload = () => resolve({ filename: file.name, contentType: file.type || 'application/octet-stream', content: String(reader.result).split(',')[1] || '', encoding: 'base64' });
      reader.readAsDataURL(file);
    })));
    setCompose(c => ({ ...c, attachments: [...c.attachments, ...encoded] }));
  };
  const downloadAttachment = async (attachment: NonNullable<MailMessage['attachments']>[number]) => {
    if (!selected) return;
    try { const blob = await downloadPortalMailAttachment(resourceId, selected.path || folder, selected.uid, attachment.id); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = attachment.filename || 'attachment'; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
    catch (e) { setError(e instanceof Error ? e.message : 'Attachment download failed.'); }
  };
  const iframeDoc = useMemo(() => safeMailHtml(body.html), [body.html]);

  const FolderButton = ({ item }: { item: Folder }) => <button type="button" data-testid={`mail-folder-${item.path}`} onClick={() => { setFolder(item.path); setStarredView(false); setMobilePane('list'); setSelected(null); setSearch(''); setQuery(''); setPage(1); }} className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm ${folder === item.path && !starredView ? 'bg-[#e8eef4] text-[#1e4d73] font-semibold' : 'text-[#53616d] hover:bg-[#f1f4f6]'}`}><span className="flex items-center gap-2.5"><Inbox size={16}/>{item.name}</span><span className="text-xs tabular-nums">{item.unreadCount || ''}</span></button>;
  const paneTabs = <div className="grid grid-cols-3 border-b border-[#e4e9ed] md:hidden">{(['folders','list','reader'] as const).map(p => <button type="button" key={p} onClick={() => setMobilePane(p)} className={`py-2.5 text-xs font-semibold capitalize ${mobilePane === p ? 'border-b-2 border-[#386b91] text-[#294e6b]' : 'text-[#7a8791]'}`}>{p}</button>)}</div>;

  return <div className="space-y-4">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-black/[0.08] pb-4">
      <div><div className="text-[11px] font-semibold uppercase tracking-[.13em] text-[#667987]">Secure client email</div><h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#263641]">Mail</h1><p className="mt-1 text-sm text-[#75828b]">{mailbox?.emailAddress || `Mailbox access for ${client.company}`}</p></div>
      <div className="flex flex-wrap gap-2">
        {mailboxes.length > 1 && <select aria-label="Choose mailbox" value={resourceId} onChange={async e => { const id=e.target.value; setResourceId(id); setSelected(null); setSearch(''); setStarredView(false); setPage(1); try { await loadFolders(id); } catch(err) { setError(err instanceof Error ? err.message : 'Could not open mailbox.'); } }} className="max-w-[220px] rounded-lg border border-[#d9e0e5] bg-white px-3 py-2 text-sm text-[#334550]">{mailboxes.map(m => <option key={m.id} value={m.providerMailboxId}>{m.displayName} · {m.emailAddress}</option>)}</select>}
        <button onClick={() => {setCompose({to:[],cc:[],bcc:[],subject:'',text:'',attachments:[]});setComposeOpen(true);}} disabled={!mailbox} className="inline-flex items-center gap-2 rounded-lg bg-[#315f80] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#284f6b] disabled:opacity-50"><PenLine size={15}/>Compose</button>
        <button onClick={() => void refresh()} disabled={loading || !resourceId} aria-label="Refresh mail" className="inline-flex items-center gap-2 rounded-lg border border-[#d9e0e5] bg-white px-3 py-2 text-sm text-[#4e606d]"><RefreshCw size={15} className={loading ? 'animate-spin' : ''}/><span className="hidden sm:inline">Refresh</span></button>
        <button onClick={() => onNavigate('/portal/access')} className="inline-flex items-center gap-2 rounded-lg border border-[#d9e0e5] bg-white px-3 py-2 text-sm text-[#4e606d]"><ArrowLeft size={15}/><span className="hidden sm:inline">Access</span></button>
      </div>
    </header>
    {error && <div role="alert" className="flex items-center justify-between rounded-lg border border-[#e4b8b5] bg-[#fbf1f0] px-4 py-3 text-sm text-[#8d3732]">{error}<button onClick={() => setError('')} aria-label="Dismiss error"><X size={16}/></button></div>}
    {notice && <div role="status" className="rounded-lg border border-[#bed7c8] bg-[#eff7f1] px-4 py-2.5 text-sm text-[#3d684b]">{notice}</div>}
    {!loading && mailboxes.length === 0 ? <div className="rounded-xl border border-dashed border-[#cbd5dc] bg-white p-10 text-center"><MailOpen size={28} className="mx-auto text-[#82929e]"/><h2 className="mt-3 font-semibold text-[#344650]">No mailboxes assigned</h2><p className="mt-1 text-sm text-[#71808a]">Your administrator has not enabled email access for this account.</p></div> :
    <div className="overflow-hidden rounded-xl border border-[#dbe2e7] bg-white shadow-[0_2px_10px_rgba(31,53,68,.04)]">
      {paneTabs}
      <div className="grid min-h-[610px] md:grid-cols-[190px_minmax(260px,.78fr)_minmax(0,1.7fr)]">
        <aside className={`${mobilePane === 'folders' ? 'block' : 'hidden'} border-b border-[#e4e9ed] bg-[#f8fafb] p-3 md:block md:border-b-0 md:border-r`}>
          <div className="mb-3 px-2 text-[10px] font-bold uppercase tracking-[.12em] text-[#87949d]">Folders</div>
          {folders.map(f => <FolderButton key={f.path} item={f}/>)}
          <button onClick={() => {setStarredView(true);setMobilePane('list');setSelected(null);setSearch('');}} className={`mt-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm ${starredView ? 'bg-[#e8eef4] text-[#1e4d73] font-semibold' : 'text-[#53616d] hover:bg-[#f1f4f6]'}`}><Star size={16}/>Starred</button>
          <div className="mt-5 border-t border-[#e5eaee] pt-3"><div className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[.12em] text-[#87949d]">Drafts</div>
            {drafts.length ? drafts.map((d,i)=><div key={d.id || i} className="group flex items-center gap-1 rounded-lg px-2 py-2 hover:bg-[#f1f4f6]"><button className="min-w-0 flex-1 truncate text-left text-xs text-[#53616d]" onClick={()=>{setCompose(d);setComposeOpen(true);}}>{d.subject || 'Untitled draft'}<span className="block truncate text-[10px] text-[#9aa5ac]">{d.to.join(', ') || 'No recipients'}</span></button>{d.id && <button aria-label="Delete draft" onClick={async()=>{try{await deletePortalMailDraft(resourceId,d.id!);setDrafts(await listPortalMailDrafts(resourceId));}catch(e){setError(e instanceof Error?e.message:'Could not delete draft.');}}} className="p-1 text-[#8c999f] hover:text-red-700"><Trash2 size={13}/></button>}</div>) : <div className="px-2 text-xs text-[#9aa5ac]">No saved drafts</div>}
          </div>
        </aside>
        <section className={`${mobilePane === 'list' ? 'flex' : 'hidden'} min-w-0 flex-col border-b border-[#e4e9ed] md:flex md:border-b-0 md:border-r`}>
          <form onSubmit={runSearch} className="flex items-center gap-2 border-b border-[#e7ecef] p-3"><Search size={15} className="shrink-0 text-[#8a979f]"/><input aria-label="Search this folder" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search this folder" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#a4afb5]"/><button type="submit" className="text-xs font-semibold text-[#416d8e]">Search</button>{search && <button type="button" aria-label="Clear search" onClick={()=>{setQuery('');setSearch('');}}><X size={14}/></button>}</form>
          <div className="flex items-center justify-between border-b border-[#e7ecef] px-4 py-2 text-[11px] text-[#83909a]"><span>{starredView ? 'Starred messages' : folders.find(f=>f.path===folder)?.name || 'Messages'}</span><span>{page} / {totalPages}</span></div>
          <div className="flex-1 overflow-y-auto">
            {loading && !messages.length && <div className="space-y-3 p-4"><div className="h-12 animate-pulse rounded bg-[#f1f4f6]"/><div className="h-12 animate-pulse rounded bg-[#f1f4f6]"/><div className="h-12 animate-pulse rounded bg-[#f1f4f6]"/></div>}
            {!loading && !messages.length && <div className="px-5 py-12 text-center"><Mail size={24} className="mx-auto text-[#a1adb4]"/><p className="mt-3 text-sm font-medium text-[#596b77]">{search ? 'No matching messages' : 'This folder is empty'}</p><p className="mt-1 text-xs text-[#929da4]">{search ? 'Try a different search term.' : 'Messages will appear here when received.'}</p></div>}
            {messages.map(item=><button key={`${item.path}-${item.uid}`} onClick={()=>void openMessage(item)} className={`block w-full border-b border-[#edf0f2] px-4 py-3 text-left hover:bg-[#f8fafb] ${selected?.uid===item.uid?'bg-[#eef4f8]':''}`}><div className="flex items-center gap-2"><span className={`size-1.5 rounded-full ${item.unseen?'bg-[#386b91]':'bg-transparent'}`}/><span className={`min-w-0 flex-1 truncate text-xs ${item.unseen?'font-bold text-[#354955]':'font-medium text-[#64727c]'}`}>{addressLabel(item.from)}</span>{item.flags.includes('\\Flagged')&&<Star size={12} className="fill-[#b58c44] text-[#b58c44]"/>}</div><div className="mt-1 truncate pl-3.5 text-xs font-semibold text-[#354650]">{item.subject || '(No subject)'}</div><div className="mt-1 flex items-center justify-between pl-3.5 text-[10px] text-[#98a3aa]"><span>{niceDate(item.date)}</span>{item.attachments?.length>0&&<Paperclip size={12}/>}</div></button>)}
          </div>
          <div className="flex items-center justify-between border-t border-[#e7ecef] p-2"><button disabled={page<=1||loading} onClick={()=>void loadMessages(resourceId,folder,page-1)} className="rounded-md p-2 text-[#60727e] hover:bg-[#f1f4f6] disabled:opacity-40"><ChevronLeft size={17}/></button><span className="text-[11px] text-[#89959c]">Page {page} of {totalPages}</span><button disabled={page>=totalPages||loading} onClick={()=>void loadMessages(resourceId,folder,page+1)} className="rounded-md p-2 text-[#60727e] hover:bg-[#f1f4f6] disabled:opacity-40"><ChevronRight size={17}/></button></div>
        </section>
        <section className={`${mobilePane === 'reader' ? 'block' : 'hidden'} min-w-0 md:block`}>
          {!selected ? <div className="flex min-h-[400px] flex-col items-center justify-center p-8 text-center text-[#8b989f]"><MailOpen size={30}/><p className="mt-3 text-sm">{loading?'Loading messages…':'Choose a message to read'}</p></div> :
          <article className="flex h-full min-h-[610px] flex-col">
            <div className="border-b border-[#e6ebee] px-5 py-4"><div className="flex items-start justify-between gap-3"><h2 className="text-lg font-semibold leading-snug text-[#2f414c]">{selected.subject || '(No subject)'}</h2><div className="flex shrink-0 gap-1">{[
              {label:'Star',icon:Star,fn:()=>void mutateSelected('star')},{label:'Archive',icon:Archive,fn:()=>void mutateSelected('archive')},{label:'Delete',icon:Trash2,fn:()=>void mutateSelected('delete')}
            ].map(({label,icon:Icon,fn})=><button key={label} title={label} aria-label={label} disabled={busy} onClick={fn} className="rounded-md p-2 text-[#75838b] hover:bg-[#f0f3f5] hover:text-[#345a75] disabled:opacity-40"><Icon size={16}/></button>)}</div></div>
              <div className="mt-3 grid gap-1 text-xs text-[#78868e]"><div><b className="font-semibold text-[#4c5d68]">From</b>　{addressLabel(selected.from)}</div><div><b className="font-semibold text-[#4c5d68]">To</b>　{selected.to.map(addressLabel).join(', ')}</div>{selected.cc.length>0&&<div><b className="font-semibold text-[#4c5d68]">Cc</b>　{selected.cc.map(addressLabel).join(', ')}</div>}<div>{niceDate(selected.date)}</div></div>
            </div>
            <div className="min-h-[220px] flex-1 overflow-y-auto px-5 py-5">
              {body.html ? <iframe title="Email message content" sandbox="" referrerPolicy="no-referrer" srcDoc={iframeDoc} className="min-h-[260px] w-full border-0" /> : <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-[#354650]">{body.text || '(This message has no readable body.)'}</pre>}
              {selected.attachments?.length>0&&<div className="mt-6 border-t border-[#e6ebee] pt-4"><div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#88959d]">Attachments</div>{selected.attachments.map(a=><button key={a.id} onClick={()=>void downloadAttachment(a)} className="mr-2 inline-flex max-w-full items-center gap-2 rounded-md border border-[#dce3e7] px-3 py-2 text-xs text-[#49677d] hover:bg-[#f6f8f9]"><Paperclip size={13}/><span className="truncate">{a.filename || 'Download file'}</span><span className="text-[#9ba6ac]">{Math.ceil(a.sizeBytes/1024)} KB</span></button>)}</div>}
            </div>
            <div className="flex items-center justify-between border-t border-[#e6ebee] px-5 py-3"><span className="text-[11px] text-[#8b989f]">Sent from {mailbox?.emailAddress || 'your assigned mailbox'}</span><button onClick={startReply} className="inline-flex items-center gap-2 rounded-lg bg-[#315f80] px-3.5 py-2 text-sm font-semibold text-white"><Reply size={15}/>Reply</button></div>
          </article>}
        </section>
      </div>
    </div>}
    {composeOpen&&<div className="fixed inset-0 z-[100] flex items-end justify-center bg-[#17232b]/45 p-0 sm:items-center sm:p-5" onClick={()=>setComposeOpen(false)}><form onSubmit={send} onClick={e=>e.stopPropagation()} className="flex max-h-[94dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-[#dbe2e7] bg-white shadow-xl sm:rounded-xl">
      <div className="flex items-center justify-between border-b border-[#e5eaed] bg-[#f8fafb] px-5 py-3"><div><div className="text-sm font-semibold text-[#374a56]">{compose.inReplyTo?'Reply':'New message'}</div><div className="mt-0.5 text-[11px] text-[#839099]">From {mailbox?.emailAddress || ''}</div></div><button type="button" aria-label="Close compose" onClick={()=>setComposeOpen(false)} className="rounded-md p-2 text-[#74828b] hover:bg-[#edf1f3]"><X size={17}/></button></div>
      <div className="space-y-1 overflow-y-auto px-5 py-3">
        {(['to','cc','bcc'] as const).map(field=><label key={field} className="flex items-center gap-3 border-b border-[#edf0f2] py-2 text-xs text-[#78868e]"><span className="w-10 uppercase">{field}</span><input required={field==='to'} value={compose[field].join(', ')} onChange={e=>setCompose(c=>({...c,[field]:e.target.value.split(',').map(v=>v.trim()).filter(Boolean)}))} placeholder="name@example.com, separate multiple recipients with commas" className="min-w-0 flex-1 bg-transparent text-sm text-[#364954] outline-none"/></label>)}
        <input aria-label="Subject" value={compose.subject} onChange={e=>setCompose(c=>({...c,subject:e.target.value}))} placeholder="Subject" className="w-full border-b border-[#edf0f2] py-3 text-sm font-medium text-[#364954] outline-none placeholder:text-[#a1acb2]"/>
        <textarea aria-label="Message" required value={compose.text} onChange={e=>setCompose(c=>({...c,text:e.target.value}))} placeholder="Write your message…" rows={9} className="w-full resize-y py-3 text-sm leading-relaxed text-[#364954] outline-none placeholder:text-[#a1acb2]"/>
        <div className="flex flex-wrap gap-2">{compose.attachments.map((a,i)=><span key={`${a.filename}-${i}`} className="inline-flex items-center gap-1 rounded-md bg-[#f0f3f5] px-2 py-1 text-xs text-[#596d79]">{a.filename}<button type="button" aria-label={`Remove ${a.filename}`} onClick={()=>setCompose(c=>({...c,attachments:c.attachments.filter((_,ix)=>ix!==i)}))}><X size={12}/></button></span>)}</div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e5eaed] bg-[#fafbfc] px-5 py-3"><label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-[#607582]"><Paperclip size={15}/>Attach files<input type="file" multiple className="sr-only" onChange={e=>void chooseFiles(e.target.files)}/></label><span className="mr-auto text-[10px] text-[#98a3aa]">Files up to 10 MB each</span><button type="button" disabled={busy} onClick={()=>void saveDraft()} className="rounded-lg border border-[#d6dfe4] px-3 py-2 text-xs font-semibold text-[#5c6e78] disabled:opacity-40">Save draft</button><button type="submit" disabled={busy||!compose.to.length} className="inline-flex items-center gap-2 rounded-lg bg-[#315f80] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"><Send size={14}/>{busy?'Sending…':'Send'}</button></div>
      <div className="border-t border-[#edf0f2] px-5 py-2 text-[10px] text-[#98a3aa]">The sender address is fixed to this assigned mailbox.</div>
    </form></div>}
  </div>;
}