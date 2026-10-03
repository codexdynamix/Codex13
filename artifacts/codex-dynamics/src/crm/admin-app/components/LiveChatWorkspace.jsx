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

const CHAT_STORAGE_KEY = 'codex_crm_chat_threads_v3';

const LEGACY_DEMO_THREADS = [
  {
    id: 'th_101',
    visitor_name: 'Marcus Sterling',
    visitor_email: 'm.sterling@enterprise-tech.io',
    location: 'London, United Kingdom',
    browser: 'Chrome 122 · macOS Sonoma',
    ip_address: '82.165.197.12',
    channel: 'Tidio Live Chat',
    status: 'active',
    is_archived: false,
    unread_count: 1,
    assigned_agent: 'Alex Morgan',
    notes: 'Interested in a React/Node enterprise architecture migration with bespoke CRM integration.',
    created_at: new Date(Date.now() - 3600_000 * 2).toISOString(),
    messages: [
      {
        id: 'm_1',
        sender: 'system',
        text: 'Marcus Sterling started conversation via Tidio live chat',
        created_at: new Date(Date.now() - 3600_000 * 2).toISOString(),
      },
      {
        id: 'm_2',
        sender: 'visitor',
        sender_name: 'Marcus Sterling',
        text: 'Hi there, we are looking to overhaul our internal CRM and web portal. Do you support bespoke integration with existing SQL databases?',
        created_at: new Date(Date.now() - 3600_000 * 1.8).toISOString(),
      },
      {
        id: 'm_3',
        sender: 'agent',
        sender_name: 'Alex Morgan',
        text: 'Hello Marcus! Yes, absolutely. We architect custom React frontends with high-throughput backend services and direct integrations to legacy or cloud SQL databases.',
        created_at: new Date(Date.now() - 3600_000 * 1.5).toISOString(),
      },
      {
        id: 'm_4',
        sender: 'visitor',
        sender_name: 'Marcus Sterling',
        text: 'Brilliant. What would be the typical timeline for an initial architectural review and prototype?',
        created_at: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
      },
      {
        id: 'm_5',
        sender: 'agent',
        sender_name: 'Alex Morgan',
        text: 'Typically we deliver the foundational blueprint, schema mapping, and interactive prototype within 10 to 14 business days.',
        created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      },
    ],
  },
  {
    id: 'th_102',
    visitor_name: 'Elena Rostova',
    visitor_email: 'elena@novadesign.studio',
    location: 'Berlin, Germany',
    browser: 'Safari 17 · iOS 17.4',
    ip_address: '178.62.204.45',
    channel: 'Tidio Live Chat',
    status: 'waiting',
    is_archived: false,
    unread_count: 2,
    assigned_agent: 'Unassigned',
    notes: 'Asking about fixed-price packages vs monthly engineering retainer.',
    created_at: new Date(Date.now() - 3600_000 * 5).toISOString(),
    messages: [
      {
        id: 'm_201',
        sender: 'system',
        text: 'Elena Rostova initiated conversation',
        created_at: new Date(Date.now() - 3600_000 * 5).toISOString(),
      },
      {
        id: 'm_202',
        sender: 'visitor',
        sender_name: 'Elena Rostova',
        text: 'Hi Codex team! Are your retainer hours rollover-friendly if we have slower development sprints?',
        created_at: new Date(Date.now() - 3600_000 * 4.9).toISOString(),
      },
      {
        id: 'm_203',
        sender: 'visitor',
        sender_name: 'Elena Rostova',
        text: 'Also curious if you provide dedicated technical lead support throughout the retainer.',
        created_at: new Date(Date.now() - 3600_000 * 4.8).toISOString(),
      },
    ],
  },
  {
    id: 'th_103',
    visitor_name: 'Visitor #4829',
    visitor_email: 'visitor4829@network.ca',
    location: 'Toronto, Canada',
    browser: 'Firefox 124 · Windows 11',
    ip_address: '142.250.190.78',
    channel: 'Website Visitor',
    status: 'active',
    is_archived: false,
    unread_count: 0,
    assigned_agent: 'Alex Morgan',
    notes: 'Inquired about technical article samples and code repository access.',
    created_at: new Date(Date.now() - 86400_000 * 2).toISOString(),
    messages: [
      {
        id: 'm_301',
        sender: 'visitor',
        sender_name: 'Visitor #4829',
        text: 'Great article on high-throughput React architecture! Is the example GitHub repo public?',
        created_at: new Date(Date.now() - 86400_000 * 2).toISOString(),
      },
      {
        id: 'm_302',
        sender: 'agent',
        sender_name: 'Alex Morgan',
        text: 'Glad you enjoyed it! Yes, you can check our public GitHub showcases under CodexDynamics/architecture-samples.',
        created_at: new Date(Date.now() - 86400_000 * 1.9).toISOString(),
      },
      {
        id: 'm_303',
        sender: 'visitor',
        sender_name: 'Visitor #4829',
        text: 'Found it, thank you!',
        created_at: new Date(Date.now() - 86400_000 * 1.8).toISOString(),
      },
    ],
  },
  {
    id: 'th_104',
    visitor_name: 'David Chen',
    visitor_email: 'd.chen@apex-analytics.com',
    location: 'San Francisco, CA, USA',
    browser: 'Chrome 123 · macOS Sonoma',
    ip_address: '192.0.2.89',
    channel: 'Tidio Live Chat',
    status: 'waiting',
    is_archived: false,
    unread_count: 1,
    assigned_agent: 'Alex Morgan',
    notes: 'Needs multi-tenant database partitioning and custom dashboards.',
    created_at: new Date(Date.now() - 3600_000 * 8).toISOString(),
    messages: [
      {
        id: 'm_401',
        sender: 'visitor',
        sender_name: 'David Chen',
        text: 'Do you have capacity to begin onboarding a new high-security SaaS project next month?',
        created_at: new Date(Date.now() - 3600_000 * 8).toISOString(),
      },
    ],
  },
  {
    id: 'th_105',
    visitor_name: 'Sarah Jenkins',
    visitor_email: 'sarah.j@fintechlabs.co.uk',
    location: 'Edinburgh, UK',
    browser: 'Edge 122 · Windows 11',
    ip_address: '198.51.100.44',
    channel: 'Tidio Live Chat',
    status: 'active',
    is_archived: false,
    unread_count: 0,
    assigned_agent: 'Alex Morgan',
    notes: 'Fintech compliance and SOC2 requirements.',
    created_at: new Date(Date.now() - 86400_000 * 1.2).toISOString(),
    messages: [
      {
        id: 'm_501',
        sender: 'visitor',
        sender_name: 'Sarah Jenkins',
        text: 'Hello Alex, following up on the security checklist you provided. All looks aligned with our compliance team.',
        created_at: new Date(Date.now() - 3600_000 * 12).toISOString(),
      },
      {
        id: 'm_502',
        sender: 'agent',
        sender_name: 'Alex Morgan',
        text: 'Fantastic to hear, Sarah. I will prepare the formal Master Services Agreement for your review.',
        created_at: new Date(Date.now() - 3600_000 * 11).toISOString(),
      },
    ],
  },
  {
    id: 'th_106',
    visitor_name: 'Liam O’Connor',
    visitor_email: 'liam@dublin-ventures.ie',
    location: 'Dublin, Ireland',
    browser: 'Safari 17 · macOS Ventura',
    ip_address: '203.0.113.19',
    channel: 'Tidio Live Chat',
    status: 'active',
    is_archived: false,
    unread_count: 0,
    assigned_agent: 'Alex Morgan',
    notes: 'API integration audit completed.',
    created_at: new Date(Date.now() - 86400_000 * 4).toISOString(),
    messages: [
      {
        id: 'm_601',
        sender: 'visitor',
        sender_name: 'Liam O’Connor',
        text: 'Thanks for the quick audit report, Alex. The recommendations solved our webhook latency.',
        created_at: new Date(Date.now() - 86400_000 * 4).toISOString(),
      },
    ],
  },
];

const INITIAL_THREADS = [];
const DEMO_THREAD_IDS = new Set(LEGACY_DEMO_THREADS.map((thread) => thread.id));

export default function LiveChatWorkspace({ showNotification = () => {} }) {
  const [threads, setThreads] = useState(() => {
    try {
      const stored = localStorage.getItem(CHAT_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter((thread) => !DEMO_THREAD_IDS.has(thread.id));
          if (cleaned.length !== parsed.length) {
            localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(cleaned));
          }
          return cleaned;
        }
      }
    } catch {
      // Start empty if the browser cache cannot be read.
    }
    return INITIAL_THREADS;
  });

  const [selectedThreadId, setSelectedThreadId] = useState(() => {
    return INITIAL_THREADS[0]?.id || null;
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [agentInput, setAgentInput] = useState('');
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [showArchivedView, setShowArchivedView] = useState(false);

  const messagesEndRef = useRef(null);

  // Sync to local storage
  useEffect(() => {
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(threads));
    } catch {
      // Ignore
    }
  }, [threads]);

  // Read Tidio config from site settings if present
  const tidioInfo = useMemo(() => {
    try {
      const draft = localStorage.getItem('site_editor_draft_config');
      const live = localStorage.getItem('codex_site_config');
      const config = draft ? JSON.parse(draft) : live ? JSON.parse(live) : {};
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
  const handleSendAgentMessage = () => {
    const text = agentInput.trim();
    if (!text || !activeThread) return;

    const newMessage = {
      id: `m_${Date.now()}`,
      sender: 'agent',
      sender_name: 'Alex Morgan (Agent)',
      text,
      created_at: new Date().toISOString(),
    };

    setThreads((prev) =>
      prev.map((t) => {
        if (t.id === activeThread.id) {
          return {
            ...t,
            status: 'active',
            unread_count: 0,
            messages: [...t.messages, newMessage],
          };
        }
        return t;
      })
    );

    setAgentInput('');
    showNotification('Reply sent to visitor.');
  };

  // Delete individual message from the active thread
  const handleDeleteMessage = (messageId) => {
    if (!activeThread) return;
    setThreads((prev) =>
      prev.map((t) => {
        if (t.id === activeThread.id) {
          return {
            ...t,
            messages: t.messages.filter((m) => m.id !== messageId),
          };
        }
        return t;
      })
    );
    showNotification('Message deleted.');
  };

  // Clear entire conversation history for the active thread
  const handleClearHistory = () => {
    if (!activeThread) return;
    setThreads((prev) =>
      prev.map((t) => {
        if (t.id === activeThread.id) {
          return {
            ...t,
            messages: [
              {
                id: `sys_clear_${Date.now()}`,
                sender: 'system',
                text: 'Chat history cleared by agent',
                created_at: new Date().toISOString(),
              },
            ],
          };
        }
        return t;
      })
    );
    showNotification('Chat history cleared.');
  };

  // Archive or restore active thread/person
  const handleToggleArchive = (threadId = activeThread?.id) => {
    if (!threadId) return;
    setThreads((prev) =>
      prev.map((t) => {
        if (t.id === threadId) {
          const willArchive = !t.is_archived;
          return { ...t, is_archived: willArchive };
        }
        return t;
      })
    );
    const target = threads.find((t) => t.id === threadId);
    showNotification(target?.is_archived ? 'Conversation unarchived.' : 'Conversation archived.');
  };

  // Permanently delete a person/thread from chat
  const handleDeletePerson = (threadId = activeThread?.id) => {
    if (!threadId) return;
    setThreads((prev) => prev.filter((t) => t.id !== threadId));
    if (selectedThreadId === threadId) {
      const remaining = threads.filter((t) => t.id !== threadId);
      setSelectedThreadId(remaining[0]?.id || null);
    }
    showNotification('Person removed from chat.');
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

            {/* Quick Actions Card with Archive, Delete Person, and Delete Chat History */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => handleToggleArchive(activeThread.id)}
                  className="crm-chat-panel-action-btn"
                  title={activeThread.is_archived ? 'Unarchive conversation' : 'Archive conversation'}
                >
                  {activeThread.is_archived ? <ArchiveRestore size={13} /> : <Archive size={13} />}
                  <span>{activeThread.is_archived ? 'Unarchive' : 'Archive'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDeletePerson(activeThread.id)}
                  className="crm-chat-panel-action-btn danger"
                  title="Delete person from chat"
                >
                  <Trash2 size={13} />
                  <span>Delete Person</span>
                </button>
              </div>

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
                <span>Internal Notes</span>
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
