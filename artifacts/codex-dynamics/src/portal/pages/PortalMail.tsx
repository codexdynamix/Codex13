import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Archive, ChevronLeft, ChevronRight, Forward, Inbox, Mail, MailOpen, Paperclip, PenLine, RefreshCw, Reply, ReplyAll, Search, Send, Star, Trash2, X } from 'lucide-react';
import type { PortalClient } from '../../services/portalDatabase';
import {
  deletePortalMailDraft, deletePortalMailMessage, downloadPortalMailAttachment, getPortalMailFolders,
  getPortalMailboxes, getPortalMailMessage, getPortalStarredMessages, listPortalMailDrafts,
  listPortalMailMessages, movePortalMessage, savePortalMailDraft, searchPortalMailMessages,
  sendPortalMail, setPortalMessageFlags, type ClientMailbox, type Draft, type Folder, type MailMessage,
} from '../hostingerMailApi';

interface PortalMailProps { client: PortalClient; onNavigate: (path: string) => void }
const PAGE_SIZE = 25;
const blockedAttachmentFilename = /\.(php|phtml|phar|exe|dll|bat|cmd|com|msi|sh|ps1|js|cjs|mjs|vbs|vbe|jse|wsf|wsh|hta|scr|jar|html|htm|mhtml|xhtml|svg|lnk|url|reg)$/i;
const addressLabel = (a?: {address:string; name:string} | null) => a ? (a.name ? `${a.name} <${a.address}>` : a.address) : 'Unknown sender';
const niceDate = (d: string) => { const date = new Date(d); return Number.isNaN(date.getTime()) ? d : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); };
const uniqueAddresses = (addresses: string[]) => [...new Map(addresses.filter(Boolean).map(address => [address.toLowerCase(), address])).values()];
const blobToBase64 = async (blob: Blob) => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
};
const escapeComposeText = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/\r?\n/g, '<br>');
const sanitizeComposeHtml = (html: string) => {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const allowed = new Set(['b', 'strong', 'i', 'em', 'u', 's', 'strike', 'p', 'div', 'br', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code']);
  const escapeText = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const serialize = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return escapeText(node.textContent || '');
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const element = node as Element;
    const tag = element.tagName.toLowerCase();
    const children = Array.from(element.childNodes, serialize).join('');
    if (!allowed.has(tag)) return children;
    if (tag === 'br') return '<br>';
    return `<${tag}>${children}</${tag}>`;
  };
  return Array.from(parsed.body.childNodes, serialize).join('');
};
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
  const [moveTarget, setMoveTarget] = useState('');
  const [compose, setCompose] = useState<Draft>({ to: [], cc: [], bcc: [], subject: '', text: '', attachments: [] });
  const [composeMailboxId, setComposeMailboxId] = useState('');
  const [composeDraftMailboxId, setComposeDraftMailboxId] = useState('');
  const [composeEditorVersion, setComposeEditorVersion] = useState(0);
  const composeEditorRef = useRef<HTMLDivElement>(null);
  const messageRequestRef = useRef(0);
  const listRequestRef = useRef(0);
  const folderRequestRef = useRef(0);
  const mailbox = mailboxes.find(m => m.providerMailboxId === resourceId);

  useEffect(() => {
    if (!composeOpen || !composeEditorRef.current) return;
    composeEditorRef.current.innerHTML = compose.html?.trim()
      ? sanitizeComposeHtml(compose.html)
      : escapeComposeText(compose.text);
  }, [composeOpen, composeEditorVersion]);

  const loadFolders = useCallback(async (id: string, prefer?: string) => {
    const requestId = ++folderRequestRef.current;
    const [nextFolders, nextDrafts] = await Promise.all([getPortalMailFolders(id), listPortalMailDrafts(id)]);
    if (requestId !== folderRequestRef.current) return '';
    setFolders(nextFolders); setDrafts(nextDrafts);
    const next = prefer && nextFolders.some(f => f.path === prefer) ? prefer : (nextFolders.find(f => f.specialUse?.toLowerCase() === '\\inbox')?.path || nextFolders[0]?.path || '');
    setFolder(next);
    return next;
  }, []);

  const loadMessages = useCallback(async (id: string, path: string, nextPage: number, text = search, starred = starredView) => {
    const requestId = ++listRequestRef.current;
    if (!id || !path && !starred) { setMessages([]); setSelected(null); setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const result = starred ? await getPortalStarredMessages(id, nextPage, PAGE_SIZE)
        : text.trim() ? await searchPortalMailMessages(id, path, text.trim(), nextPage, PAGE_SIZE)
          : await listPortalMailMessages(id, path, nextPage, PAGE_SIZE);
      if (requestId !== listRequestRef.current) return;
      const rows = result.messages || [];
      setMessages(rows); setPage(result.pagination?.page || nextPage); setTotalPages(Math.max(1, result.pagination?.totalPages || 1));
      if (!rows.some(m => m.uid === selected?.uid)) setSelected(null);
    } catch (e) { if (requestId === listRequestRef.current) setError(e instanceof Error ? e.message : 'Could not load messages.'); }
    finally { if (requestId === listRequestRef.current) setLoading(false); }
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
    const requestId = ++messageRequestRef.current;
    setSelected(item); setBody({ text: '', html: '' }); setMobilePane('reader'); setError('');
    try {
      const result = await getPortalMailMessage(resourceId, item.path || folder, item.uid);
      if (requestId !== messageRequestRef.current) return;
      const opened = result.message || item;
      setBody(result.body || { text: '', html: '' }); setSelected(opened);
      if (item.unseen) {
        await setPortalMessageFlags(resourceId, item.path || folder, item.uid, ['\\Seen'], []);
        if (requestId !== messageRequestRef.current) return;
        setSelected({ ...opened, unseen: false, flags: opened.flags.includes('\\Seen') ? opened.flags : [...opened.flags, '\\Seen'] });
        await loadMessages(resourceId, folder, page);
      }
    } catch (e) { if (requestId === messageRequestRef.current) setError(e instanceof Error ? e.message : 'Could not open this message.'); }
  };
  const refresh = async () => { try { await loadFolders(resourceId, folder); await loadMessages(resourceId, folder, page); if (selected) await openMessage(selected); } catch (e) { setError(e instanceof Error ? e.message : 'Refresh failed.'); } };
  const runSearch = (event: React.FormEvent) => { event.preventDefault(); listRequestRef.current++; setSearch(query); setPage(1); };
  const mutateSelected = async (action: 'star'|'delete'|'archive'|'read'|'move'|'spam', targetFolder?: string) => {
    if (!selected) return;
    setBusy(true); setError('');
    try {
      const sourceFolder = selected.path || folder;
      if (action === 'star') await setPortalMessageFlags(resourceId, sourceFolder, selected.uid, selected.flags.includes('\\Flagged') ? [] : ['\\Flagged'], selected.flags.includes('\\Flagged') ? ['\\Flagged'] : []);
      if (action === 'read') {
        const markUnread = selected.flags.includes('\\Seen');
        await setPortalMessageFlags(resourceId, sourceFolder, selected.uid, markUnread ? [] : ['\\Seen'], markUnread ? ['\\Seen'] : []);
        const flags = markUnread ? selected.flags.filter(flag => flag !== '\\Seen') : [...selected.flags, '\\Seen'];
        setSelected({ ...selected, flags, unseen: markUnread });
      }
      if (action === 'delete') {
        const trash = folders.find(f => f.specialUse?.toLowerCase() === '\\trash' || /trash|deleted/i.test(f.name));
        if (trash && trash.path !== sourceFolder) {
          await movePortalMessage(resourceId, sourceFolder, selected.uid, trash.path);
          setNotice('Message moved to Trash.');
        } else {
          if (!window.confirm('This mailbox has no separate Trash folder for this message. Permanently delete it?')) return;
          await deletePortalMailMessage(resourceId, sourceFolder, selected.uid);
          setNotice('Message permanently deleted.');
        }
      }
      if (action === 'archive') {
        const target = folders.find(f => f.specialUse?.toLowerCase() === '\\archive' || /archive/i.test(f.name))?.path;
        if (!target) throw new Error('No Archive folder is available for this mailbox.');
        await movePortalMessage(resourceId, sourceFolder, selected.uid, target);
        setNotice('Message archived.');
      }
      if (action === 'spam') {
        const target = folders.find(f => f.specialUse?.toLowerCase() === '\\junk' || /spam|junk/i.test(f.name))?.path;
        if (!target) throw new Error('No Spam folder is available for this mailbox.');
        await movePortalMessage(resourceId, sourceFolder, selected.uid, target);
        setNotice('Message moved to Spam.');
      }
      if (action === 'move') {
        if (!targetFolder || !folders.some(f => f.path === targetFolder)) throw new Error('Choose a folder available in this mailbox.');
        await movePortalMessage(resourceId, sourceFolder, selected.uid, targetFolder);
        setNotice(`Message moved to ${folders.find(f => f.path === targetFolder)?.name || 'the selected folder'}.`);
        setMoveTarget('');
      }
      if (action !== 'read') setSelected(null);
      await loadMessages(resourceId, folder, page);
    } catch (e) { setError(e instanceof Error ? e.message : 'The message could not be updated.'); }
    finally { setBusy(false); }
  };
  const startReply = (replyAll = false) => {
    if (!selected) return;
    const ownAddress = mailbox?.emailAddress.toLowerCase();
    const sender = selected.from?.address || '';
    const senderIsOwnMailbox = Boolean(ownAddress && sender.toLowerCase() === ownAddress);
    const replyRecipients = senderIsOwnMailbox ? selected.to.map(a => a.address) : [sender];
    const to = uniqueAddresses([...replyRecipients, ...(replyAll ? selected.to.map(a => a.address) : [])])
      .filter(address => address.toLowerCase() !== ownAddress);
    const cc = replyAll
      ? uniqueAddresses([...selected.to, ...selected.cc].map(a => a.address))
        .filter(address => address.toLowerCase() !== ownAddress && !to.some(item => item.toLowerCase() === address.toLowerCase()))
      : [];
    const subject = /^re:/i.test(selected.subject || '') ? selected.subject || '' : `Re: ${selected.subject || ''}`;
    setCompose({ to, cc, bcc: [], subject, text: '', attachments: [], inReplyTo: { folder: selected.path || folder, uid: selected.uid } });
    setComposeMailboxId(resourceId);
    setComposeDraftMailboxId(resourceId);
    setComposeEditorVersion(version => version + 1);
    setComposeOpen(true);
  };
  const startForward = async () => {
    if (!selected) return;
    setBusy(true); setError('');
    const reference = { folder: selected.path || folder, uid: selected.uid };
    const messageText = body.text.trim() || (body.html ? new DOMParser().parseFromString(body.html, 'text/html').body.textContent || '' : '');
    const details = [
      '---------- Forwarded message ----------',
      `From: ${addressLabel(selected.from)}`,
      `Date: ${niceDate(selected.date)}`,
      `Subject: ${selected.subject || '(No subject)'}`,
      `To: ${selected.to.map(addressLabel).join(', ') || '—'}`,
      selected.cc.length ? `Cc: ${selected.cc.map(addressLabel).join(', ')}` : '',
      '',
      messageText,
    ].filter((line, index) => line !== '' || index === 5 || index === 7).join('\n');
    const attachments: Draft['attachments'] = [];
    let totalBytes = 0;
    let omitted = 0;
    try {
      for (const attachment of selected.attachments || []) {
        if (blockedAttachmentFilename.test(attachment.filename || '')) {
          omitted++;
          continue;
        }
        if (attachment.sizeBytes > 10 * 1024 * 1024 || totalBytes + attachment.sizeBytes > 20 * 1024 * 1024) {
          omitted++;
          continue;
        }
        try {
          const blob = await downloadPortalMailAttachment(resourceId, reference.folder, selected.uid, attachment.id);
          if (blob.size > 10 * 1024 * 1024 || totalBytes + blob.size > 20 * 1024 * 1024) {
            omitted++;
            continue;
          }
          attachments.push({
            filename: attachment.filename || 'forwarded-attachment',
            contentType: attachment.contentType || 'application/octet-stream',
            content: await blobToBase64(blob),
            encoding: 'base64',
          });
          totalBytes += blob.size;
        } catch {
          omitted++;
        }
      }
      const subject = /^fwd?:/i.test(selected.subject || '') ? selected.subject || '' : `Fwd: ${selected.subject || ''}`;
      setCompose({ to: [], cc: [], bcc: [], subject, text: details, attachments, forwardOf: reference });
      setComposeMailboxId(resourceId);
      setComposeDraftMailboxId(resourceId);
      setComposeEditorVersion(version => version + 1);
      setComposeOpen(true);
      if (omitted) setNotice(`${omitted} original attachment${omitted === 1 ? ' was' : 's were'} omitted because it could not be included within the attachment limits.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not prepare this message for forwarding.');
    } finally {
      setBusy(false);
    }
  };
  const saveDraft = async () => {
    const targetMailboxId = composeMailboxId || resourceId;
    if (!targetMailboxId) return;
    setBusy(true);
    try {
      const sourceMailboxId = composeDraftMailboxId || targetMailboxId;
      const movingExistingDraft = Boolean(compose.id && sourceMailboxId !== targetMailboxId);
      const safeCompose = { ...compose, html: compose.html ? sanitizeComposeHtml(compose.html) : undefined };
      const saved = await savePortalMailDraft(targetMailboxId, movingExistingDraft ? { ...safeCompose, id: undefined } : safeCompose);
      setCompose(saved);
      setComposeDraftMailboxId(targetMailboxId);
      let previousCopyRemains = false;
      if (movingExistingDraft && compose.id) {
        try { await deletePortalMailDraft(sourceMailboxId, compose.id); }
        catch { previousCopyRemains = true; }
      }
      if (resourceId === targetMailboxId || resourceId === sourceMailboxId) setDrafts(await listPortalMailDrafts(resourceId));
      setNotice(previousCopyRemains
        ? 'Draft saved to the selected mailbox. The previous copy could not be removed.'
        : `Draft saved to ${mailboxes.find(m => m.providerMailboxId === targetMailboxId)?.emailAddress || 'this mailbox'}.`);
    }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save draft.'); }
    finally { setBusy(false); }
  };
  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    const sendingMailboxId = composeMailboxId || resourceId;
    if (!sendingMailboxId || !(compose.to.length || compose.cc.length || compose.bcc.length)) {
      setError('Add at least one recipient before sending.');
      return;
    }
    if (!compose.text.trim() && !compose.html?.trim()) { setError('Write a message before sending.'); return; }
    const recipients = [...compose.to, ...compose.cc, ...compose.bcc];
    if (recipients.some(address => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address))) { setError('Enter a valid email address for every recipient.'); return; }
    setBusy(true); setError('');
    try {
      await sendPortalMail(sendingMailboxId, { to: compose.to, cc: compose.cc, bcc: compose.bcc, subject: compose.subject, text: compose.text, html: compose.html ? sanitizeComposeHtml(compose.html) : undefined, attachments: compose.attachments, inReplyTo: compose.inReplyTo, forwardOf: compose.forwardOf });
      if (compose.id) await deletePortalMailDraft(composeDraftMailboxId || sendingMailboxId, compose.id);
      setComposeOpen(false);
      setCompose({ to: [], cc: [], bcc: [], subject: '', text: '', attachments: [] });
      setComposeDraftMailboxId(sendingMailboxId);
      setNotice('Message sent.');
      if (sendingMailboxId !== resourceId) {
        messageRequestRef.current++;
        listRequestRef.current++;
        folderRequestRef.current++;
        setBody({text:'',html:''});
        setFolder('');
        setResourceId(sendingMailboxId);
        setSelected(null);
        setSearch('');
        setQuery('');
        setStarredView(false);
        setPage(1);
        setMobilePane('list');
      }
      const nextFolder = await loadFolders(sendingMailboxId, sendingMailboxId === resourceId ? folder : undefined);
      setDrafts(await listPortalMailDrafts(sendingMailboxId));
      await loadMessages(sendingMailboxId, nextFolder, sendingMailboxId === resourceId ? page : 1, '', false);
    } catch (e) { setError(e instanceof Error ? e.message : 'Message could not be sent.'); }
    finally { setBusy(false); }
  };
  const chooseFiles = async (files: FileList | null) => {
    if (!files) return;
    const chosen = Array.from(files);
    if (chosen.some(f => f.size > 10 * 1024 * 1024)) { setError('Each attachment must be 10 MB or smaller.'); return; }
    if (chosen.some(f => blockedAttachmentFilename.test(f.name))) { setError('This file type cannot be attached.'); return; }
    const existingBytes = compose.attachments.reduce((total, attachment) => total + Math.floor(attachment.content.length * 3 / 4), 0);
    if (existingBytes + chosen.reduce((total, file) => total + file.size, 0) > 20 * 1024 * 1024) { setError('The combined attachment size must be 20 MB or smaller.'); return; }
    // eslint-disable-next-line no-control-regex -- reject control characters in filenames
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

  const FolderButton = ({ item }: { item: Folder }) => <button type="button" data-testid={`mail-folder-${item.path}`} onClick={() => { messageRequestRef.current++; listRequestRef.current++; setBody({text:'',html:''}); setFolder(item.path); setStarredView(false); setMobilePane('list'); setSelected(null); setSearch(''); setQuery(''); setPage(1); }} className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm ${folder === item.path && !starredView ? 'bg-[#e8eef4] text-[#1e4d73] font-semibold' : 'text-[#53616d] hover:bg-[#f1f4f6]'}`}><span className="flex items-center gap-2.5"><Inbox size={16}/>{item.name}</span><span className="text-xs tabular-nums">{item.unreadCount || ''}</span></button>;
  const paneTabs = <div className="grid grid-cols-3 border-b border-[#e4e9ed] md:hidden">{(['folders','list','reader'] as const).map(p => <button type="button" key={p} onClick={() => setMobilePane(p)} className={`py-2.5 text-xs font-semibold capitalize ${mobilePane === p ? 'border-b-2 border-[#386b91] text-[#294e6b]' : 'text-[#7a8791]'}`}>{p}</button>)}</div>;

  return <div className="space-y-4">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-black/[0.08] pb-4">
      <div><div className="text-[11px] font-semibold uppercase tracking-[.13em] text-[#667987]">Secure client email</div><h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#263641]">Mail</h1><p className="mt-1 text-sm text-[#75828b]">{mailbox?.emailAddress || `Mailbox access for ${client.company}`}</p></div>
      <div className="flex flex-wrap gap-2">
         {mailboxes.length > 1 && <select data-testid="mailbox-switcher" aria-label="Choose mailbox" value={resourceId} disabled={busy||loading} onChange={async e => { const id=e.target.value; messageRequestRef.current++; listRequestRef.current++; folderRequestRef.current++; setBody({text:'',html:''}); setFolder(''); setResourceId(id); setFolders([]); setDrafts([]); setMessages([]); setSelected(null); setSearch(''); setQuery(''); setStarredView(false); setPage(1); setLoading(true); try { await loadFolders(id); } catch(err) { setError(err instanceof Error ? err.message : 'Could not open mailbox.'); } finally { setLoading(false); } }} className="max-w-[220px] rounded-lg border border-[#d9e0e5] bg-white px-3 py-2 text-sm text-[#334550]">{mailboxes.map(m => <option key={m.id} value={m.providerMailboxId}>{m.displayName} · {m.emailAddress}</option>)}</select>}
        <button onClick={() => {setCompose({to:[],cc:[],bcc:[],subject:'',text:'',attachments:[]});setComposeMailboxId(resourceId);setComposeDraftMailboxId(resourceId);setComposeEditorVersion(version=>version+1);setComposeOpen(true);}} disabled={!mailbox} data-testid="compose-email" className="inline-flex items-center gap-2 rounded-lg bg-[#315f80] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#284f6b] disabled:opacity-50"><PenLine size={15}/>Compose</button>
        <button onClick={() => void refresh()} disabled={loading || !resourceId} aria-label="Refresh mail" className="inline-flex items-center gap-2 rounded-lg border border-[#d9e0e5] bg-white px-3 py-2 text-sm text-[#4e606d]"><RefreshCw size={15} className={loading ? 'animate-spin' : ''}/><span className="hidden sm:inline">Refresh</span></button>
        <button onClick={() => onNavigate('/portal/access')} className="inline-flex items-center gap-2 rounded-lg border border-[#d9e0e5] bg-white px-3 py-2 text-sm text-[#4e606d]"><ArrowLeft size={15}/><span className="hidden sm:inline">Access</span></button>
      </div>
    </header>
    {error && <div role="alert" className="flex items-center justify-between rounded-lg border border-[#e4b8b5] bg-[#fbf1f0] px-4 py-3 text-sm text-[#8d3732]">{error}<button onClick={() => setError('')} aria-label="Dismiss error"><X size={16}/></button></div>}
    {notice && <div role="status" className="rounded-lg border border-[#bed7c8] bg-[#eff7f1] px-4 py-2.5 text-sm text-[#3d684b]">{notice}</div>}
    {!loading && mailboxes.length === 0 ? <div className="rounded-xl border border-dashed border-[#cbd5dc] bg-white p-10 text-center"><MailOpen size={28} className="mx-auto text-[#82929e]"/><h2 className="mt-3 font-semibold text-[#344650]">{error ? 'Email service is not available' : 'No mailboxes assigned'}</h2><p className="mt-1 text-sm text-[#71808a]">{error ? 'Please contact your administrator, or try again shortly.' : 'Your administrator has not enabled email access for this account.'}</p></div> :
    <div className="overflow-hidden rounded-xl border border-[#dbe2e7] bg-white shadow-[0_2px_10px_rgba(31,53,68,.04)]">
      {paneTabs}
      <div className="grid min-h-[610px] md:grid-cols-[190px_minmax(260px,.78fr)_minmax(0,1.7fr)]">
        <aside className={`${mobilePane === 'folders' ? 'block' : 'hidden'} border-b border-[#e4e9ed] bg-[#f8fafb] p-3 md:block md:border-b-0 md:border-r`}>
          <div className="mb-3 px-2 text-[10px] font-bold uppercase tracking-[.12em] text-[#87949d]">Folders</div>
          {folders.map(f => <FolderButton key={f.path} item={f}/>)}
          <button onClick={() => {listRequestRef.current++;messageRequestRef.current++;setBody({text:'',html:''});setStarredView(true);setMobilePane('list');setSelected(null);setSearch('');}} className={`mt-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm ${starredView ? 'bg-[#e8eef4] text-[#1e4d73] font-semibold' : 'text-[#53616d] hover:bg-[#f1f4f6]'}`}><Star size={16}/>Starred</button>
          <div className="mt-5 border-t border-[#e5eaee] pt-3"><div className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[.12em] text-[#87949d]">Drafts</div>
            {drafts.length ? drafts.map((d,i)=><div key={d.id || i} className="group flex items-center gap-1 rounded-lg px-2 py-2 hover:bg-[#f1f4f6]"><button className="min-w-0 flex-1 truncate text-left text-xs text-[#53616d]" onClick={()=>{setCompose(d);setComposeMailboxId(resourceId);setComposeDraftMailboxId(resourceId);setComposeEditorVersion(version=>version+1);setComposeOpen(true);}}>{d.subject || 'Untitled draft'}<span className="block truncate text-[10px] text-[#9aa5ac]">{d.to.join(', ') || 'No recipients'}</span></button>{d.id && <button aria-label="Delete draft" onClick={async()=>{try{await deletePortalMailDraft(resourceId,d.id!);setDrafts(await listPortalMailDrafts(resourceId));}catch(e){setError(e instanceof Error?e.message:'Could not delete draft.');}}} className="p-1 text-[#8c999f] hover:text-red-700"><Trash2 size={13}/></button>}</div>) : <div className="px-2 text-xs text-[#9aa5ac]">No saved drafts</div>}
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
            <div className="border-b border-[#e6ebee] px-5 py-4"><div className="flex flex-wrap items-start justify-between gap-3"><h2 className="min-w-0 flex-1 text-lg font-semibold leading-snug text-[#2f414c]">{selected.subject || '(No subject)'}</h2><div className="flex flex-wrap items-center gap-1">{[
              {label:selected.flags.includes('\\Flagged')?'Unstar':'Star',icon:Star,fn:()=>void mutateSelected('star')},
              {label:selected.flags.includes('\\Seen')?'Mark unread':'Mark read',icon:MailOpen,fn:()=>void mutateSelected('read')},
              {label:'Archive',icon:Archive,fn:()=>void mutateSelected('archive')},
              ...(folders.some(f=>f.specialUse?.toLowerCase()==='\\junk'||/spam|junk/i.test(f.name))?[{label:'Report Spam',icon:Mail,fn:()=>void mutateSelected('spam')}]:[]),
              {label:'Delete',icon:Trash2,fn:()=>void mutateSelected('delete')}
            ].map(({label,icon:Icon,fn})=><button key={label} title={label} aria-label={label} disabled={busy} onClick={fn} className="rounded-md p-2 text-[#75838b] hover:bg-[#f0f3f5] hover:text-[#345a75] disabled:opacity-40"><Icon size={16}/></button>)}{folders.length>1&&<div className="flex items-center gap-1"><select aria-label="Move message to folder" value={moveTarget} onChange={e=>setMoveTarget(e.target.value)} disabled={busy} className="max-w-32 rounded-md border border-[#d9e0e5] bg-white px-2 py-1.5 text-xs text-[#53616d]"><option value="">Move to…</option>{folders.filter(f=>f.path!== (selected.path||folder)).map(f=><option key={f.path} value={f.path}>{f.name}</option>)}</select><button title="Move" aria-label="Move message" disabled={busy||!moveTarget} onClick={()=>void mutateSelected('move',moveTarget)} className="rounded-md px-2 py-1.5 text-xs font-semibold text-[#416d8e] hover:bg-[#f0f3f5] disabled:opacity-40">Move</button></div>}</div></div>
              <div className="mt-3 grid gap-1 text-xs text-[#78868e]"><div><b className="font-semibold text-[#4c5d68]">From</b>{'\u3000'}{addressLabel(selected.from)}</div><div><b className="font-semibold text-[#4c5d68]">To</b>{'\u3000'}{selected.to.map(addressLabel).join(', ')}</div>{selected.cc.length>0&&<div><b className="font-semibold text-[#4c5d68]">Cc</b>{'\u3000'}{selected.cc.map(addressLabel).join(', ')}</div>}{selected.bcc.length>0&&<div><b className="font-semibold text-[#4c5d68]">Bcc</b>{'\u3000'}{selected.bcc.map(addressLabel).join(', ')}</div>}<div>{niceDate(selected.date)}</div></div>
            </div>
            <div className="min-h-[220px] flex-1 overflow-y-auto px-5 py-5">
              {body.html ? <iframe title="Email message content" sandbox="" referrerPolicy="no-referrer" srcDoc={iframeDoc} className="min-h-[260px] w-full border-0" /> : <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-[#354650]">{body.text || '(This message has no readable body.)'}</pre>}
              {selected.attachments?.length>0&&<div className="mt-6 border-t border-[#e6ebee] pt-4"><div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#88959d]">Attachments</div>{selected.attachments.map(a=><button key={a.id} onClick={()=>void downloadAttachment(a)} className="mr-2 inline-flex max-w-full items-center gap-2 rounded-md border border-[#dce3e7] px-3 py-2 text-xs text-[#49677d] hover:bg-[#f6f8f9]"><Paperclip size={13}/><span className="truncate">{a.filename || 'Download file'}</span><span className="text-[#9ba6ac]">{Math.ceil(a.sizeBytes/1024)} KB</span></button>)}</div>}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e6ebee] px-5 py-3"><span className="text-[11px] text-[#8b989f]">Reply from {mailbox?.emailAddress || 'your assigned mailbox'}</span><div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={()=>startReply(false)} className="inline-flex items-center gap-2 rounded-lg bg-[#315f80] px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-40"><Reply size={15}/>Reply</button><button type="button" disabled={busy} onClick={()=>startReply(true)} className="inline-flex items-center gap-2 rounded-lg border border-[#d9e0e5] px-3 py-2 text-sm font-semibold text-[#496274] disabled:opacity-40"><ReplyAll size={15}/>Reply All</button><button type="button" disabled={busy} onClick={()=>void startForward()} className="inline-flex items-center gap-2 rounded-lg border border-[#d9e0e5] px-3 py-2 text-sm font-semibold text-[#496274] disabled:opacity-40"><Forward size={15}/>Forward</button></div></div>
          </article>}
        </section>
      </div>
    </div>}
    {composeOpen&&<div className="fixed inset-0 z-[100] flex items-end justify-center bg-[#17232b]/45 p-0 sm:items-center sm:p-5" onClick={()=>setComposeOpen(false)}><form onSubmit={send} onClick={e=>e.stopPropagation()} className="flex max-h-[94dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-[#dbe2e7] bg-white shadow-xl sm:rounded-xl">
      <div className="flex items-center justify-between border-b border-[#e5eaed] bg-[#f8fafb] px-5 py-3"><div className="min-w-0 flex-1"><div className="text-sm font-semibold text-[#374a56]">{compose.forwardOf?'Forward':compose.inReplyTo?'Reply':'New message'}</div><label className="mt-1 flex items-center gap-2 text-[11px] text-[#839099]"><span>From</span><select data-testid="compose-from-mailbox" aria-label="From mailbox" value={composeMailboxId || resourceId} onChange={e=>{const id=e.target.value;setComposeMailboxId(id);if(id!==composeDraftMailboxId)setCompose(c=>({...c,inReplyTo:undefined,forwardOf:undefined}));}} className="max-w-[260px] truncate rounded-md border border-[#d9e0e5] bg-white px-2 py-1 text-xs text-[#445965]">{mailboxes.filter(m=>m.enabled).map(m=><option key={m.id} value={m.providerMailboxId}>{m.displayName} · {m.emailAddress}</option>)}</select></label></div><button type="button" aria-label="Close compose" onClick={()=>setComposeOpen(false)} className="rounded-md p-2 text-[#74828b] hover:bg-[#edf1f3]"><X size={17}/></button></div>
      <div className="space-y-1 overflow-y-auto px-5 py-3">
        {(['to','cc','bcc'] as const).map(field=><label key={field} className="flex items-center gap-3 border-b border-[#edf0f2] py-2 text-xs text-[#78868e]"><span className="w-10 uppercase">{field}</span><input value={compose[field].join(', ')} onChange={e=>setCompose(c=>({...c,[field]:e.target.value.split(',').map(v=>v.trim()).filter(Boolean)}))} placeholder="name@example.com, separate multiple recipients with commas" className="min-w-0 flex-1 bg-transparent text-sm text-[#364954] outline-none"/></label>)}
        <input aria-label="Subject" value={compose.subject} onChange={e=>setCompose(c=>({...c,subject:e.target.value}))} placeholder="Subject" className="w-full border-b border-[#edf0f2] py-3 text-sm font-medium text-[#364954] outline-none placeholder:text-[#a1acb2]"/>
        <div className="flex items-center gap-1 border-b border-[#edf0f2] py-2" role="toolbar" aria-label="Message formatting">
          {[['bold','Bold','B'],['italic','Italic','I'],['underline','Underline','U'],['insertUnorderedList','Bulleted list','• List'],['insertOrderedList','Numbered list','1. List']].map(([command,label,text])=><button key={command} type="button" aria-label={label} title={label} onMouseDown={e=>e.preventDefault()} onClick={()=>{const editor=composeEditorRef.current;if(!editor)return;editor.focus();document.execCommand(command,false);const html=sanitizeComposeHtml(editor.innerHTML);setCompose(c=>({...c,html,text:editor.innerText||editor.textContent||''}));}} className="rounded-md px-2.5 py-1.5 text-xs font-semibold text-[#526976] hover:bg-[#edf2f5]">{text}</button>)}
        </div>
        <div ref={composeEditorRef} data-testid="email-rich-text-editor" role="textbox" aria-label="Message" aria-multiline="true" contentEditable suppressContentEditableWarning onInput={e=>{const editor=e.currentTarget;setCompose(c=>({...c,html:sanitizeComposeHtml(editor.innerHTML),text:editor.innerText||editor.textContent||''}));}} onPaste={e=>{e.preventDefault();document.execCommand('insertText',false,e.clipboardData.getData('text/plain'));}} className="min-h-[220px] w-full whitespace-pre-wrap break-words py-3 text-sm leading-relaxed text-[#364954] outline-none empty:before:content-['Write_your_message…'] empty:before:text-[#a1acb2]"/>
        <div className="flex flex-wrap gap-2">{compose.attachments.map((a,i)=><span key={`${a.filename}-${i}`} className="inline-flex items-center gap-1 rounded-md bg-[#f0f3f5] px-2 py-1 text-xs text-[#596d79]">{a.filename}<button type="button" aria-label={`Remove ${a.filename}`} onClick={()=>setCompose(c=>({...c,attachments:c.attachments.filter((_,ix)=>ix!==i)}))}><X size={12}/></button></span>)}</div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e5eaed] bg-[#fafbfc] px-5 py-3"><label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-[#607582]"><Paperclip size={15}/>Attach files<input type="file" multiple className="sr-only" onChange={e=>void chooseFiles(e.target.files)}/></label><span className="mr-auto text-[10px] text-[#98a3aa]">Files up to 10 MB each</span><button type="button" disabled={busy} onClick={()=>void saveDraft()} className="rounded-lg border border-[#d6dfe4] px-3 py-2 text-xs font-semibold text-[#5c6e78] disabled:opacity-40">Save draft</button><button type="submit" disabled={busy||!(compose.to.length||compose.cc.length||compose.bcc.length)} className="inline-flex items-center gap-2 rounded-lg bg-[#315f80] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"><Send size={14}/>{busy?'Sending…':'Send'}</button></div>
      <div className="border-t border-[#edf0f2] px-5 py-2 text-[10px] text-[#98a3aa]">The selected sender is validated against your assigned mailboxes.</div>
    </form></div>}
  </div>;
}