import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  MessageSquare,
  Send,
  Search,
  Clock,
  User,
  Globe,
  Monitor,
  ExternalLink,
  Trash2,
  CheckCheck,
  Bot,
  Radio,
  FileText,
  X,
  ArrowRight,
  Maximize2,
  Minimize2,
  Archive,
  ArchiveRestore,
  Eraser,
  CornerDownLeft,
} from 'lucide-react';
import {
  clearAdminChat,
  deleteAdminMessage,
  getAdminChatThreads,
  getAdminMessages,
  getStoredAdminProfile,
  markAdminMessagesRead,
  sendAdminMessage,
  saveAdminChatThreadMeta,
} from '../adminApi';



export default function LiveChatWorkspace({ showNotification = () => {} }) {
  const [threads, setThreads] = useState([]);
  const [selectedThreadId, setSelectedThreadId] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [agentInput, setAgentInput] = useState('');
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [showArchivedView, setShowArchivedView] = useState(false);
  const [isLoadingThreads, setIsLoadingThreads] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [chatError, setChatError] = useState('');
  const [currentAdmin, setCurrentAdmin] = useState(() => getStoredAdminProfile());

  const messagesEndRef = useRef(null);

  const normalizeThread = (thread) => ({
    ...thread,
    id: thread.client_id || thread.id,
    visitor_name: thread.visitor_name || 'Client',
    visitor_email: thread.visitor_email || '',
    location: thread.company || '',
    status: thread.is_archived ? 'archived' : thread.status,
    is_archived: Boolean(thread.is_archived),
    unread_count: Number(thread.unread_count || 0),
    assigned_agent: thread.assigned_agent || 'Unassigned',
    notes: thread.notes || '',
    messages: [],
  });

  const reloadThreads = async ({ quiet = false } = {}) => {
    if (!quiet) setIsLoadingThreads(true);
    try {
      const profile = getStoredAdminProfile();
      setCurrentAdmin(profile);
      const result = await getAdminChatThreads({ includeArchived: true });
      setThreads((previous) => {
        const previousById = new Map(previous.map((thread) => [thread.id, thread]));
        return result.map((rawThread) => {
          const thread = normalizeThread(rawThread);
          return { ...thread, messages: previousById.get(thread.id)?.messages || [] };
        });
      });
      setSelectedThreadId((current) => result.some((thread) => (thread.client_id || thread.id) === current)
        ? current
        : ((result.find((thread) => !thread.is_archived)?.client_id
          || result.find((thread) => !thread.is_archived)?.id
          || result[0]?.client_id
          || result[0]?.id
          || null)));
    } catch (error) {
      setChatError(error.message || 'Conversations could not be loaded.');
    } finally {
      if (!quiet) setIsLoadingThreads(false);
    }
  };

  useEffect(() => {
    let active = true;
    const refresh = () => {
      if (active) void reloadThreads({ quiet: isLoadingThreads });
    };
    void reloadThreads();
    const timer = window.setInterval(refresh, 15000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  // Read Tidio config from site settings if present
  const tidioInfo = useMemo(() => {
    try {
      const live = localStorage.getItem('codex_site_config');
      const config = live ? JSON.parse(live) : {};
      const tidio = config.tidio || {};
      return {
        enabled: Boolean(tidio.enabled),
        publicKey: tidio.publicKey || '',
        position: tidio.position || 'bottom-right',
      };
    } catch {
      return { enabled: false, publicKey: '', position: 'bottom-right' };
    }
  }, []);

  const activeThread = useMemo(() => {
    return threads.find((t) => t.id === selectedThreadId) || threads[0] || null;
  }, [threads, selectedThreadId]);

  const reloadMessages = async (clientId, { markRead = false } = {}) => {
    if (!clientId) return;
    const result = await getAdminMessages(clientId, { limit: 100 });
    const messages = result.messages.map((message) => ({
      id: message.id,
      sender: message.sender === 'agent' ? 'agent' : message.sender === 'system' ? 'system' : 'visitor',
      sender_name: message.senderName || message.sender_name || '',
      text: message.body || message.text || '',
      created_at: message.timestamp || message.createdAt || message.created_at,
    }));
    setThreads((prev) => prev.map((thread) => thread.id === clientId
      ? { ...thread, messages, unread_count: markRead ? 0 : result.unreadCount }
      : thread));
    if (markRead && result.unreadCount > 0) await markAdminMessagesRead(clientId);
  };

  useEffect(() => {
    if (!activeThread?.id) return undefined;
    let active = true;
    const load = async () => {
      try {
        await reloadMessages(activeThread.id, { markRead: true });
        if (active) setChatError('');
      } catch (error) {
        if (active) setChatError(error.message || 'Messages could not be loaded.');
      }
    };
    void load();
    const timer = window.setInterval(load, 7000);
    return () => { active = false; window.clearInterval(timer); };
  }, [activeThread?.id]);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeThread?.messages]);

  // Filtered threads list based on search and archive filter
  const filteredThreads = useMemo(() => {
    return threads.filter((t) => {
      if (showArchivedView ? !t.is_archived : t.is_archived) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const matchName = t.visitor_name?.toLowerCase().includes(q);
      const matchEmail = t.visitor_email?.toLowerCase().includes(q);
      const matchLocation = t.location?.toLowerCase().includes(q);
      const matchMessages = t.messages?.some((m) => m.text?.toLowerCase().includes(q));
      return matchName || matchEmail || matchLocation || matchMessages;
    });
  }, [threads, searchQuery, showArchivedView]);

  // Stats summary
  const stats = useMemo(() => {
    const total = threads.filter((t) => !t.is_archived).length;
    const active = threads.filter((t) => !t.is_archived && t.status === 'active').length;
    const waiting = threads.filter((t) => !t.is_archived && t.status === 'waiting').length;
    const archived = threads.filter((t) => t.is_archived).length;
    return { total, active, waiting, archived };
  }, [threads]);

  // Handle agent sending a reply
  const handleSendAgentMessage = async () => {
    const text = agentInput.trim();
    if (!text || !activeThread || isSending) return;
    setIsSending(true);
    setChatError('');
    try {
      await sendAdminMessage(activeThread.id, text);
      setAgentInput('');
      await Promise.all([reloadMessages(activeThread.id), reloadThreads({ quiet: true })]);
      showNotification('Reply sent to Client.');
    } catch (error) {
      setChatError(error.message || 'The reply could not be sent.');
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteMessage = async (messageId) => {
    if (!activeThread || !window.confirm('Delete this message for everyone?')) return;
    try {
      await deleteAdminMessage(messageId);
      await reloadMessages(activeThread.id);
      showNotification('Message deleted.');
    } catch (error) {
      setChatError(error.message || 'The message could not be deleted.');
    }
  };

  const handleClearHistory = async () => {
    if (!activeThread || !window.confirm('Permanently delete every message in this conversation? This cannot be undone.')) return;
    try {
      await clearAdminChat(activeThread.id);
      await reloadMessages(activeThread.id);
      await reloadThreads({ quiet: true });
      showNotification('Conversation history deleted.');
    } catch (error) {
      setChatError(error.message || 'The conversation history could not be deleted.');
    }
  };

  const handleToggleArchive = async (threadId = activeThread?.id) => {
    if (!threadId) return;
    const target = threads.find((thread) => thread.id === threadId);
    const willArchive = !target?.is_archived;
    try {
      await saveAdminChatThreadMeta(threadId, {
        status: target?.status === 'waiting' ? 'waiting' : 'active',
        is_archived: willArchive,
        notes: target?.notes || '',
      });
      await reloadThreads({ quiet: true });
      showNotification(willArchive ? 'Conversation archived.' : 'Conversation restored.');
    } catch (error) {
      setChatError(error.message || 'The conversation could not be updated.');
    }
  };

  const handleDeletePerson = (threadId = activeThread?.id) => {
    if (!threadId) return;
    void handleToggleArchive(threadId);
  };

  const handleSaveThreadNotes = async (threadId, notes) => {
    if (!threadId) return;
    try {
      await saveAdminChatThreadMeta(threadId, {
        status: activeThread?.status === 'waiting' ? 'waiting' : 'active',
        is_archived: Boolean(activeThread?.is_archived),
        notes,
      });
    } catch (error) {
      setChatError(error.message || 'Internal notes could not be saved.');
    }
  };

  const summaryCards = [
    ['Conversations', stats.total, `${stats.active} in progress`, MessageSquare],
    ['Waiting Reply', stats.waiting, 'Awaiting agent response', Clock],
    ['Archived', stats.archived, 'Archived conversations', Archive],
    ['Tidio Gateway', tidioInfo.enabled ? 'Online' : 'Active', tidioInfo.enabled ? 'Live widget linked' : 'Internal CRM gateway', Bot],
  ];

  return (
    <section className="crm-content-hub crm-chat-suite">
      {/* 1. Header Matching Content Studio */}
      <header className="crm-content-hub-header">
        <div className="crm-content-hub-header-copy">
          <div className="crm-content-hub-title-row">
            <span className="crm-content-hub-header-mark">
              <MessageSquare size={18} />
            </span>
            <div>
              <span className="crm-content-hub-kicker">Leads / Chat</span>
              <h2>Live Visitor Chat & Tidio Center</h2>
            </div>
          </div>
          <p>
            Monitor real-time visitor threads, converse directly as an agent, and coordinate live client communication from your central workspace.
          </p>
        </div>

        <div className="crm-content-hub-header-workflow">
          <div className="crm-content-hub-workflow-label">
            <Radio size={13} className="text-emerald-400" />
            <strong>Live Interaction Sync</strong>
          </div>
          <div className="crm-content-hub-workflow-steps">
            <span>Visitor</span>
            <ArrowRight size={12} />
            <span>Tidio Gateway</span>
            <ArrowRight size={12} />
            <span>Agent Reply</span>
          </div>
        </div>
      </header>

      {/* 2. Standard 4-Tile Metrics Bar */}
      <div className="crm-content-hub-summary" aria-label="Live Chat Summary">
        {summaryCards.map(([label, value, detail, Icon]) => (
          <div className="crm-content-hub-summary-card" key={label}>
            <span className="crm-content-hub-summary-icon">
              <Icon size={18} strokeWidth={2.2} />
            </span>
            <div className="crm-content-hub-summary-body">
              <div className="crm-content-hub-summary-val-row">
                <strong>{value}</strong>
                <span>{label}</span>
              </div>
              <small>{detail}</small>
            </div>
          </div>
        ))}
      </div>

      {/* 3. Main Chat Workspace Layout: Joined Console + Standalone Visitor Context Card */}
      <div className="crm-chat-workspace-layout">
        {/* JOINED CHAT ENCLOSURE (Sidebar + Active Conversation) */}
        <div className="crm-chat-console">
          {/* LEFT COLUMN: Joined Sidebar */}
          <aside className="crm-chat-sidebar">
            {/* Top Search Bar: Small Archive toggle on the left, Search field in center, Enter button on the right */}
            <div className="crm-chat-sidebar-head">
              <div className="crm-chat-search-bar">
                {/* Archive View Toggle (Small, on the left of search field) */}
                <button
                  type="button"
                  onClick={() => setShowArchivedView((p) => !p)}
                  className={`crm-chat-archive-toggle-btn ${showArchivedView ? 'active' : ''}`}
                  title={showArchivedView ? 'Show active conversations' : 'Show archived conversations'}
                  aria-label="Archive toggle"
                >
                  <Archive size={14} />
                </button>

                {/* Search Input Field (Magnifying glass correctly positioned on left inside input) */}
                <div className="crm-chat-search-field">
                  <Search size={14} className="crm-chat-search-lens" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        showNotification(searchQuery.trim() ? `Filtered by "${searchQuery.trim()}"` : 'Showing all threads');
                      }
                    }}
                    placeholder="Search conversations..."
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="crm-chat-search-clear-btn"
                      title="Clear search"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* Enter Button for Search (On the right) */}
                <button
                  type="button"
                  onClick={() => {
                    showNotification(searchQuery.trim() ? `Filtered by "${searchQuery.trim()}"` : 'Showing all threads');
                  }}
                  className="crm-chat-search-enter-btn"
                  title="Search conversations"
                >
                  <span>Enter</span>
                  <CornerDownLeft size={11} />
                </button>
              </div>
            </div>

            {/* Scrollable Threads List */}
            <div className="crm-chat-threads-list">
              {filteredThreads.length === 0 ? (
                <div style={{ padding: '40px 16px', textAlign: 'center', color: 'rgba(255, 255, 255, 0.4)', fontSize: 12 }}>
                  <MessageSquare size={28} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
                  {showArchivedView ? 'No archived conversations.' : 'No conversations found.'}
                </div>
              ) : (
                filteredThreads.map((thread) => {
                  const isSelected = thread.id === activeThread?.id;
                  const lastMsg = thread.messages?.[thread.messages.length - 1];
                  return (
                    <button
                      key={thread.id}
                      type="button"
                      onClick={() => {
                        setSelectedThreadId(thread.id);
                        setThreads((prev) =>
                          prev.map((t) => (t.id === thread.id ? { ...t, unread_count: 0 } : t))
                        );
                      }}
                      className={`crm-chat-thread-card ${isSelected ? 'active' : ''}`}
                    >
                      <div className="crm-chat-avatar">
                        {thread.visitor_name.slice(0, 2).toUpperCase()}
                        <span className={`crm-chat-status-dot ${thread.status}`} />
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
                          <strong style={{ fontSize: 13, color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600 }}>
                            {thread.visitor_name}
                          </strong>
                          <span style={{ fontSize: 10, color: 'rgba(255, 255, 255, 0.4)', fontFamily: 'monospace' }}>
                            {lastMsg
                              ? new Date(lastMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              : ''}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                          <p style={{ margin: 0, fontSize: 12, color: 'rgba(255, 255, 255, 0.55)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                            {lastMsg ? (
                              <>
                                {lastMsg.sender === 'agent' && <span style={{ color: '#0A84FF', fontWeight: 600 }}>You: </span>}
                                {lastMsg.text}
                              </>
                            ) : (
                              'No messages'
                            )}
                          </p>

                          {thread.unread_count > 0 && (
                            <span style={{ background: '#0A84FF', color: '#FFFFFF', borderRadius: 999, fontSize: 10, fontWeight: 700, padding: '1px 6px', flexShrink: 0 }}>
                              {thread.unread_count}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          {/* RIGHT COLUMN: Joined Active Conversation Stream */}
          <main className="crm-chat-main">
            {activeThread ? (
              <>
                {/* Header Bar (64px height, perfectly continuous with left sidebar header) */}
                <div className="crm-chat-main-head">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <div className="crm-chat-avatar" style={{ width: 38, height: 38, background: '#0A84FF' }}>
                      {activeThread.visitor_name.slice(0, 2).toUpperCase()}
                      <span className={`crm-chat-status-dot ${activeThread.status}`} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 600, color: '#FFFFFF', letterSpacing: '-0.01em' }}>
                          {activeThread.visitor_name}
                        </h3>
                        {activeThread.is_archived && (
                          <span style={{ fontSize: 9.5, fontWeight: 600, background: 'rgba(255, 255, 255, 0.1)', color: 'rgba(255, 255, 255, 0.7)', padding: '1px 6px', borderRadius: 4 }}>
                            Archived
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'rgba(255, 255, 255, 0.45)', marginTop: 2 }}>
                        <span>{activeThread.location}</span>
                      </div>
                    </div>
                  </div>

                  {/* Maximize / Downsize Control: Just the arrows only (No button frame) */}
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => setShowRightPanel((p) => !p)}
                      className="crm-chat-arrows-only-btn"
                      title={showRightPanel ? 'Downsize details' : 'Maximize details'}
                      aria-label={showRightPanel ? 'Downsize details' : 'Maximize details'}
                    >
                      {showRightPanel ? (
                        <Minimize2 size={16} />
                      ) : (
                        <Maximize2 size={16} />
                      )}
                    </button>
                  </div>
                </div>

                {/* Messages Body */}
                <div className="crm-chat-messages-body">
                  {activeThread.messages?.map((msg) => {
                    if (msg.sender === 'system') {
                      return (
                        <div key={msg.id} className="crm-chat-bubble-system">
                          {msg.text}
                        </div>
                      );
                    }

                    const isAgent = msg.sender === 'agent';
                    return (
                      <div
                        key={msg.id}
                        className="crm-chat-message-row"
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: isAgent ? 'flex-end' : 'flex-start',
                          gap: 3,
                          position: 'relative',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexDirection: isAgent ? 'row-reverse' : 'row' }}>
                          <div className={isAgent ? 'crm-chat-bubble-agent' : 'crm-chat-bubble-visitor'}>
                            {msg.text}
                          </div>

                          {/* Delete Individual Message Button (Compact, small) */}
                          <button
                            type="button"
                            onClick={() => handleDeleteMessage(msg.id)}
                            className="crm-chat-msg-delete-btn"
                            title="Delete this message"
                            style={{
                              width: 18,
                              height: 18,
                              minWidth: 18,
                              maxWidth: 18,
                              minHeight: 18,
                              maxHeight: 18,
                              padding: 0,
                              margin: 0,
                            }}
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'rgba(255, 255, 255, 0.4)', padding: '0 4px' }}>
                          <span>
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {isAgent && (
                            <CheckCheck size={11} style={{ color: '#0A84FF' }} />
                          )}
                        </div>
                      </div>
                    );
                  })}

                  <div ref={messagesEndRef} />
                </div>

                {/* Bottom Composer with Normal Send Button (Not Oval) */}
                <div className="crm-chat-composer">
                  <div
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: 10,
                      padding: '4px 14px',
                    }}
                  >
                    <input
                      type="text"
                      value={agentInput}
                      onChange={(e) => setAgentInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSendAgentMessage();
                        }
                      }}
                      placeholder={`Message ${activeThread.visitor_name}...`}
                      style={{
                        flex: 1,
                        background: 'transparent',
                        border: 'none',
                        color: '#FFFFFF',
                        fontSize: 13.5,
                        outline: 'none',
                        padding: '7px 0',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  {/* Normal rectangular send button with Send icon (Not Oval) */}
                  <button
                    type="button"
                    onClick={handleSendAgentMessage}
                    disabled={!agentInput.trim()}
                    className="crm-chat-send-btn"
                    title="Send message"
                  >
                    <Send size={16} />
                  </button>
                </div>
              </>
            ) : (
              <div style={{ margin: 'auto', textAlign: 'center', padding: 32, color: 'rgba(255, 255, 255, 0.4)' }}>
                <MessageSquare size={36} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                <h4>No conversation selected</h4>
                <p style={{ fontSize: 12 }}>Pick a thread on the left to start replying.</p>
              </div>
            )}
          </main>
        </div>

        {/* STANDALONE SEPARATE VISITOR CONTEXT CARD */}
        {showRightPanel && activeThread && (
          <aside className="crm-chat-meta-standalone">
            {/* Visitor Context */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255, 255, 255, 0.7)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <User size={13} />
                  <span>Visitor Context</span>
                </span>
                <span style={{ fontSize: 11.5, color: '#34C759', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 6.5, height: 6.5, borderRadius: '50%', background: '#34C759', display: 'inline-block', boxShadow: '0 0 6px rgba(52, 199, 89, 0.7)' }} />
                  Online
                </span>
              </div>

              <div style={{ display: 'grid', gap: 11, fontSize: 12 }}>
                <div>
                  <span style={{ fontSize: 10.5, color: 'rgba(255, 255, 255, 0.45)', display: 'block', marginBottom: 2 }}>Visitor Name</span>
                  <strong style={{ color: '#FFFFFF', fontSize: 13 }}>{activeThread.visitor_name}</strong>
                </div>

                {activeThread.visitor_email && (
                  <div>
                    <span style={{ fontSize: 10.5, color: 'rgba(255, 255, 255, 0.45)', display: 'block', marginBottom: 2 }}>Contact Email</span>
                    <a href={`mailto:${activeThread.visitor_email}`} style={{ color: '#0A84FF', textDecoration: 'none', fontFamily: 'monospace' }}>
                      {activeThread.visitor_email}
                    </a>
                  </div>
                )}

                <div>
                  <span style={{ fontSize: 10.5, color: 'rgba(255, 255, 255, 0.45)', display: 'block', marginBottom: 2 }}>Location</span>
                  <span style={{ color: 'var(--crm-text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Globe size={12} style={{ color: 'rgba(255, 255, 255, 0.45)' }} />
                    {activeThread.location}
                  </span>
                </div>

                <div>
                  <span style={{ fontSize: 10.5, color: 'rgba(255, 255, 255, 0.45)', display: 'block', marginBottom: 2 }}>Device & OS</span>
                  <span style={{ color: 'var(--crm-text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Monitor size={12} style={{ color: 'rgba(255, 255, 255, 0.45)' }} />
                    {activeThread.browser}
                  </span>
                </div>

                <div>
                  <span style={{ fontSize: 10.5, color: 'rgba(255, 255, 255, 0.45)', display: 'block', marginBottom: 2 }}>IP Address</span>
                  <span style={{ color: 'rgba(255, 255, 255, 0.55)', fontFamily: 'monospace', fontSize: 11 }}>
                    {activeThread.ip_address}
                  </span>
                </div>
              </div>
            </div>

            {/* Conversation actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                type="button"
                onClick={() => handleToggleArchive(activeThread.id)}
                className="crm-chat-panel-action-btn"
                title={activeThread.is_archived ? 'Unarchive conversation' : 'Archive conversation'}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                {activeThread.is_archived ? <ArchiveRestore size={13} /> : <Archive size={13} />}
                <span>{activeThread.is_archived ? 'Unarchive' : 'Archive'}</span>
              </button>

              {/* Deleting chat history option in visitor context / profile */}
              <button
                type="button"
                onClick={handleClearHistory}
                className="crm-chat-panel-action-btn warning"
                style={{ width: '100%', justifyContent: 'center' }}
                title="Delete entire chat history for this visitor"
              >
                <Eraser size={13} />
                <span>Delete Chat History</span>
              </button>
            </div>

            {/* Tidio Two-Way Sync Status */}
            <div style={{ padding: 12, borderRadius: 10, background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255, 255, 255, 0.7)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Bot size={13} />
                  <span>Tidio Two-Way Sync</span>
                </span>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34C759' }} />
              </div>

              <p style={{ margin: '0 0 10px', fontSize: 11, color: 'rgba(255, 255, 255, 0.45)', lineHeight: 1.4 }}>
                Synchronizes visitor conversations between the public Tidio chat bubble and this CRM console.
              </p>

              <div style={{ display: 'grid', gap: 6, fontSize: 11, borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: 8, marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'rgba(255, 255, 255, 0.45)' }}>Integration:</span>
                  <strong style={{ color: '#34C759' }}>{tidioInfo.enabled ? 'Live Connected' : 'Ready / Active'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'rgba(255, 255, 255, 0.45)' }}>Widget Key:</span>
                  <span style={{ color: '#FFFFFF', fontFamily: 'monospace' }}>
                    {tidioInfo.publicKey ? `${tidioInfo.publicKey.slice(0, 10)}...` : 'Default'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'rgba(255, 255, 255, 0.45)' }}>Webhook:</span>
                  <span style={{ color: '#0A84FF', fontFamily: 'monospace' }}>/api/tidio/webhook</span>
                </div>
              </div>

              <a
                href="https://www.tidio.com/panel/"
                target="_blank"
                rel="noreferrer"
                className="crm-chat-control-icon-btn"
                style={{ width: '100%', height: 32, justifyContent: 'center', borderRadius: 8, display: 'flex', gap: 6, textDecoration: 'none' }}
              >
                <span>Open Tidio Inbox</span>
                <ExternalLink size={12} />
              </a>
            </div>

            {/* Agent Lead Notes */}
            <div>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255, 255, 255, 0.5)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <FileText size={13} />
                <span>Private Client Notes</span>
              </span>
              <textarea
                rows={3}
                value={activeThread.notes || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setThreads((prev) =>
                    prev.map((t) => (t.id === activeThread.id ? { ...t, notes: val } : t))
                  );
                }}
                onBlur={(e) => { void handleSaveThreadNotes(activeThread.id, e.currentTarget.value); }}
                placeholder="Private agent notes..."
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: '#FFFFFF',
                  fontSize: 12,
                  resize: 'none',
                  lineHeight: 1.45,
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
            </div>
          </aside>
        )}
      </div>
    </section>
  );
}
