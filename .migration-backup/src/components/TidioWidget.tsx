import { useEffect, useState, useRef } from "react";
import { MessageSquare, X, Send, User, Sparkles, CheckCheck } from "lucide-react";
import { useSiteConfig } from "@/context/SiteConfigContext";
import type { ChatMessage } from "@/types/crm";

declare global {
  interface Window {
    tidioChatApi?: {
      open: () => void;
      close: () => void;
      show: () => void;
      hide: () => void;
      on: (event: string, callback: () => void) => void;
      setColorPallete?: (color: string) => void;
    };
  }
}

export function TidioWidget() {
  const { config } = useSiteConfig();
  const tidio = config.tidio;

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [threadId, setThreadId] = useState<string>("");
  const [hasUnread, setHasUnread] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const isAdminRoute = typeof window !== "undefined" && window.location.pathname.startsWith("/admin");
  const isExternalTidio = Boolean(tidio?.enabled && tidio?.publicKey?.trim());
  const isEnabled = tidio?.enabled !== false;
  const isLeft = tidio?.position === "bottom-left";
  const hideMobile = Boolean(tidio?.hideOnMobile);

  // Initialize or load visitor thread ID from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    let storedId = localStorage.getItem("cdx_visitor_chat_thread");
    if (!storedId) {
      storedId = `thread_vis_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      localStorage.setItem("cdx_visitor_chat_thread", storedId);
    }
    setThreadId(storedId);
  }, []);

  // Load visitor chat messages from localStorage
  useEffect(() => {
    if (!threadId || isExternalTidio || !isEnabled || typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem(`cdx_chat_msgs_${threadId}`);
      if (saved) {
        setMessages(JSON.parse(saved));
      }
    } catch {
      // ignore
    }
  }, [threadId, isExternalTidio, isEnabled]);

  // Scroll to bottom when messages update
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      setHasUnread(false);
    }
  }, [messages, isOpen]);

  // Handle WhatsApp dock notification events when opening/closing internal widget
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    if (isOpen) {
      document.body.classList.add("tidio-chat-is-open");
      document.documentElement.classList.add("tidio-chat-is-open");
      window.dispatchEvent(new CustomEvent("tidio-chat-open"));
      window.dispatchEvent(new CustomEvent("tidio-chat-status", { detail: { isOpen: true } }));
    } else {
      document.body.classList.remove("tidio-chat-is-open");
      document.documentElement.classList.remove("tidio-chat-is-open");
      window.dispatchEvent(new CustomEvent("tidio-chat-close"));
      window.dispatchEvent(new CustomEvent("tidio-chat-status", { detail: { isOpen: false } }));
    }
  }, [isOpen]);

  // External Tidio script injection handler & open/close tracking
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    if (isAdminRoute && tidio?.disableOnAdmin) {
      if (window.tidioChatApi?.hide) {
        window.tidioChatApi.hide();
      }
      return;
    }

    if (!isExternalTidio) {
      // Clean up script if switching away from external Tidio
      const existingScript = document.getElementById("tidio-chat-script");
      if (existingScript) existingScript.remove();
      const tidioIframe = document.getElementById("tidio-chat-iframe");
      if (tidioIframe) tidioIframe.remove();
      const styleEl = document.getElementById("tidio-custom-styles");
      if (styleEl) styleEl.remove();
      return;
    }

    let key = (tidio?.publicKey || "").trim();
    if (key.includes("code.tidio.co/")) {
      const match = key.match(/code\.tidio\.co\/([a-zA-Z0-9_-]+)(?:\.js)?/);
      if (match) key = match[1];
    } else if (key.includes("<script")) {
      const match = key.match(/src=["'](?:https?:)?\/\/code\.tidio\.co\/([a-zA-Z0-9_-]+)(?:\.js)?["']/);
      if (match) key = match[1];
    }
    key = key.replace(/\.js$/, "");
    if (!key) return;

    let styleEl = document.getElementById("tidio-custom-styles") as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "tidio-custom-styles";
      document.head.appendChild(styleEl);
    }

    // Reset open classes on init
    document.body.classList.remove("tidio-chat-is-open");
    document.documentElement.classList.remove("tidio-chat-is-open");

    const updateStyles = () => {
      if (!styleEl) return;
      styleEl.textContent = `
        #tidio-chat {
          z-index: 2147483647 !important;
        }
        #tidio-chat-iframe, #tidio-chat iframe {
          ${isLeft ? "left: env(safe-area-inset-left, 0px) !important; right: auto !important;" : "right: env(safe-area-inset-right, 0px) !important; left: auto !important;"}
          bottom: env(safe-area-inset-bottom, 0px) !important;
          z-index: 2147483647 !important;
        }
        ${hideMobile ? "@media (max-width: 640px) { #tidio-chat-iframe, #tidio-chat { display: none !important; } }" : ""}
      `;
    };
    updateStyles();

    // Track whether the visitor has deliberately clicked or opened Tidio
    let userHasInteracted = false;

    const onUserInteraction = () => {
      userHasInteracted = true;
    };
    window.addEventListener("pointerdown", (e) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest?.("#tidio-chat, #tidio-chat-iframe")) {
        userHasInteracted = true;
      }
    }, true);
    window.addEventListener("click", (e) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest?.("#tidio-chat, #tidio-chat-iframe")) {
        userHasInteracted = true;
      }
    }, true);

    // Synchronize open/closed state of external Tidio
    let lastKnownOpen = false;
    const syncOpenState = (nowOpen: boolean) => {
      if (lastKnownOpen === nowOpen) return;
      lastKnownOpen = nowOpen;
      if (nowOpen) {
        document.body.classList.add("tidio-chat-is-open");
        document.documentElement.classList.add("tidio-chat-is-open");
        window.dispatchEvent(new CustomEvent("tidio-chat-open"));
        window.dispatchEvent(new CustomEvent("tidio-chat-status", { detail: { isOpen: true } }));
      } else {
        document.body.classList.remove("tidio-chat-is-open");
        document.documentElement.classList.remove("tidio-chat-is-open");
        window.dispatchEvent(new CustomEvent("tidio-chat-close"));
        window.dispatchEvent(new CustomEvent("tidio-chat-status", { detail: { isOpen: false } }));
      }
    };

    // Detection across Tidio v4 (Shadow DOM) and v3 (iframe)
    // Only treats FULL expanded conversation chat window as active; excludes small "chat with us" badges and welcome popups
    const evaluateTidioActivity = () => {
      const tidioHost = document.getElementById("tidio-chat");
      if (tidioHost) {
        // 1. Check if Tidio is using Shadow DOM
        const shadow = tidioHost.shadowRoot;
        if (shadow) {
          // If .chat-closed is present, chat is explicitly closed
          if (shadow.querySelector(".chat-closed")) {
            syncOpenState(false);
            return;
          }

          // Check for .chat-open on button or container
          if (shadow.querySelector(".chat-open")) {
            syncOpenState(true);
            return;
          }

          // Check for full active chat window view with message input or conversation container
          const chatWindow = shadow.querySelector(
            ".chat-view, [class*='chatWindow'], [class*='conversationContainer'], [role='dialog'], textarea, [contenteditable='true']"
          );
          if (chatWindow) {
            const r = chatWindow.getBoundingClientRect();
            // A full chat conversation dialog is large (>250px height, >220px width)
            if (r.height > 250 && r.width > 220) {
              syncOpenState(true);
              return;
            }
          }
        }

        // 2. Check direct host element attributes or classes
        if (tidioHost.classList.contains("chat-open") || tidioHost.getAttribute("data-state") === "open") {
          syncOpenState(true);
          return;
        }

        // 3. Attach click / pointer listeners to host container to register deliberate user interaction
        if (!tidioHost.dataset.listenerAttached) {
          tidioHost.dataset.listenerAttached = "true";
          const markInteraction = () => {
            userHasInteracted = true;
            setTimeout(evaluateTidioActivity, 50);
            setTimeout(evaluateTidioActivity, 200);
            setTimeout(evaluateTidioActivity, 500);
          };
          tidioHost.addEventListener("click", markInteraction);
          tidioHost.addEventListener("pointerdown", markInteraction);
          if (shadow) {
            shadow.addEventListener("click", markInteraction);
            shadow.addEventListener("pointerdown", markInteraction);
          }
        }
      }

      // 4. Check for iframe (Tidio v3 or iframe fallback)
      const iframe = (document.getElementById("tidio-chat-iframe") ||
        document.querySelector("#tidio-chat iframe") ||
        document.querySelector("iframe[src*='tidio']")) as HTMLIFrameElement | null;
      if (iframe && iframe.id !== "tidio-chat-code") {
        const rect = iframe.getBoundingClientRect();
        // A full chat window iframe is >380px height & >280px width
        // A minimized launcher iframe with greeting popup is smaller
        if (rect.height > 380 && rect.width > 280) {
          syncOpenState(true);
          return;
        }
      }

      syncOpenState(false);
    };

    // Attach to official Tidio window.tidioChatApi if present
    const attachTidioApiEvents = () => {
      if (window.tidioChatApi) {
        try {
          window.tidioChatApi.on("open", () => {
            // If Tidio fired open automatically on initial visit without any user interaction,
            // close it so it does not auto-expand over the page or suppress WhatsApp
            if (!userHasInteracted) {
              try {
                window.tidioChatApi?.close();
              } catch {
                // ignore
              }
              syncOpenState(false);
              return;
            }
            syncOpenState(true);
          });
          window.tidioChatApi.on("close", () => {
            syncOpenState(false);
          });
          window.tidioChatApi.on("ready", () => {
            // On initial ready, ensure chat starts closed unless user interacted
            if (!userHasInteracted) {
              try {
                window.tidioChatApi?.close();
              } catch {
                // ignore
              }
            }
            evaluateTidioActivity();
          });
          window.tidioChatApi.on("display", () => {
            evaluateTidioActivity();
          });
        } catch {
          // Ignore registration failures if API is still booting
        }
      }
    };
    attachTidioApiEvents();

    // Listen for incoming postMessages from Tidio (only explicit open/close actions)
    const onWindowMessage = (e: MessageEvent) => {
      try {
        const data = e.data;
        if (typeof data === "string") {
          if (data === "tidioChat-open" || data === "tidio_chat_open") {
            if (userHasInteracted) syncOpenState(true);
          } else if (data === "tidioChat-close" || data === "tidio_chat_close") {
            syncOpenState(false);
          }
        } else if (data && typeof data === "object") {
          const action = (data.action || data.event || data.type || "") as string;
          if (typeof action === "string") {
            const actLower = action.toLowerCase();
            if (actLower === "open" || actLower === "chat_open" || actLower === "chatopen" || actLower === "window_open") {
              if (userHasInteracted) syncOpenState(true);
            } else if (actLower === "close" || actLower === "chat_close" || actLower === "chatclose" || actLower === "window_close") {
              syncOpenState(false);
            }
          }
        }
      } catch {
        // ignore
      }
    };
    window.addEventListener("message", onWindowMessage);

    const onTidioDocOpen = () => {
      if (userHasInteracted) {
        syncOpenState(true);
      } else {
        try {
          window.tidioChatApi?.close();
        } catch {
          // ignore
        }
        syncOpenState(false);
      }
    };
    const onTidioDocClose = () => syncOpenState(false);
    document.addEventListener("tidioChat-open", onTidioDocOpen);
    document.addEventListener("tidioChat-close", onTidioDocClose);

    // Periodic evaluation of Tidio state
    const pollTimer = setInterval(() => {
      evaluateTidioActivity();
      attachTidioApiEvents();
    }, 250);

    // Mutation observer to detect when Tidio renders its DOM or changes state
    const observer = new MutationObserver(() => {
      evaluateTidioActivity();
      attachTidioApiEvents();
    });
    observer.observe(document.body, { attributes: true, childList: true, subtree: true });

    const scriptId = "tidio-chat-script";
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.src = `//code.tidio.co/${encodeURIComponent(key)}.js`;
      script.async = true;
      document.body.appendChild(script);
    } else if (!script.src.includes(key)) {
      script.src = `//code.tidio.co/${encodeURIComponent(key)}.js`;
    }

    if (window.tidioChatApi?.show) {
      window.tidioChatApi.show();
    }

    return () => {
      clearInterval(pollTimer);
      observer.disconnect();
      window.removeEventListener("pointerdown", onUserInteraction, true);
      window.removeEventListener("click", onUserInteraction, true);
      window.removeEventListener("message", onWindowMessage);
      document.removeEventListener("tidioChat-open", onTidioDocOpen);
      document.removeEventListener("tidioChat-close", onTidioDocClose);
      document.body.classList.remove("tidio-chat-is-open");
      document.documentElement.classList.remove("tidio-chat-is-open");
    };
  }, [isExternalTidio, tidio?.publicKey, tidio?.disableOnAdmin, isLeft, hideMobile, isAdminRoute]);

  // Don't render internal widget if disabled or on admin route with disableOnAdmin
  if (isAdminRoute && tidio?.disableOnAdmin) return null;
  if (!isEnabled) return null;

  // If using external Tidio key, that script will handle DOM rendering
  if (isExternalTidio) return null;

  const handleSendMessage = async (textToSend?: string) => {
    const content = (textToSend || inputText).trim();
    if (!content || isSending || !threadId) return;

    setIsSending(true);
    if (!textToSend) setInputText("");

    // Optimistic message
    const tempMsg: ChatMessage = {
      id: Date.now(),
      thread_id: threadId,
      sender: "visitor",
      sender_name: "You",
      message: content,
      created_at: new Date().toISOString(),
      is_read: 0,
    };
    setMessages((prev) => [...prev, tempMsg]);

    try {
      const isFirst = messages.length === 0;
      const nextList: ChatMessage[] = [...messages, tempMsg];
      if (isFirst) {
        nextList.push({
          id: Date.now() + 1,
          thread_id: threadId,
          sender: "operator",
          sender_name: tidio?.agentName || "Codex Support",
          message: "Thanks for reaching out! A member of our team will follow up shortly.",
          created_at: new Date().toISOString(),
          is_read: 1,
        });
      }
      setMessages(nextList);
      if (typeof window !== "undefined") {
        localStorage.setItem(`cdx_chat_msgs_${threadId}`, JSON.stringify(nextList));
      }
    } catch {
      // ignore
    } finally {
      setIsSending(false);
    }
  };

  const welcomeGreeting =
    tidio?.welcomeMessage ||
    "Hello! 👋 Welcome to Codex Dynamics. How can our engineering and design team help with your project today?";

  return (
    <div
      className={`fixed z-[2147483647] transition-all duration-200 select-none ${
        isLeft ? "left-5" : "right-5"
      } bottom-5 ${hideMobile ? "sm:block hidden" : "block"}`}
    >
      {/* Floating Chat Window */}
      {isOpen && (
        <div
          className={`absolute bottom-16 ${
            isLeft ? "left-0" : "right-0"
          } w-[360px] max-w-[calc(100vw-32px)] h-[510px] max-h-[82vh] bg-white rounded-2xl shadow-2xl border border-black/10 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-3 duration-200`}
        >
          {/* Header */}
          <div className="bg-[#0066FF] text-white px-4 py-3.5 flex items-center justify-between shrink-0 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="size-9 rounded-full bg-white/20 flex items-center justify-center font-bold text-sm text-white">
                  <User className="size-5" />
                </div>
                <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-emerald-400 ring-2 ring-[#0066FF]" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-white leading-tight">
                  Codex Dynamics Support
                </h4>
                <p className="text-[11px] text-white/80 flex items-center gap-1 mt-0.5">
                  <span className="size-1.5 rounded-full bg-emerald-300 animate-pulse" />
                  Online &middot; Typically replies in minutes
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/15 transition-colors"
              title="Close chat"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Messages Container */}
          <div className="flex-1 p-3.5 overflow-y-auto space-y-3 bg-[#f8f9fc] text-xs">
            {/* System welcome greeting */}
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl rounded-bl-xs px-3.5 py-2.5 bg-white text-slate-800 border border-black/8 shadow-xs leading-relaxed">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[#0066FF] mb-1">
                  <Sparkles className="size-3" />
                  Codex Concierge
                </p>
                <p>{welcomeGreeting}</p>
                <span className="text-[9px] text-slate-400 block mt-1">Just now</span>
              </div>
            </div>

            {/* Conversation Messages */}
            {messages.map((msg) => {
              const isVisitor = msg.sender === "visitor";
              const isBot = msg.sender === "bot";
              return (
                <div
                  key={msg.id}
                  className={`flex ${isVisitor ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 leading-relaxed shadow-xs ${
                      isVisitor
                        ? "bg-[#0066FF] text-white rounded-br-xs"
                        : isBot
                        ? "bg-[#0066FF]/8 text-slate-800 border border-[#0066FF]/20 rounded-bl-xs"
                        : "bg-white text-slate-800 border border-black/8 rounded-bl-xs"
                    }`}
                  >
                    {!isVisitor && (
                      <p className="text-[10px] font-semibold text-[#0066FF] mb-0.5">
                        {isBot ? "🤖 Automated Assistant" : "👤 Support Specialist"}
                      </p>
                    )}
                    <p className="whitespace-pre-wrap">{msg.message}</p>
                    <div
                      className={`text-[9px] mt-1 flex items-center justify-end gap-1 ${
                        isVisitor ? "text-white/70" : "text-slate-400"
                      }`}
                    >
                      <span>
                        {new Date(msg.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {isVisitor && <CheckCheck className="size-3 text-white/80" />}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Action Chips */}
          <div className="px-3 py-2 bg-white border-t border-black/6 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
            <button
              type="button"
              onClick={() => handleSendMessage("I need a quote for a new web project")}
              className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#0066FF]/8 text-[#0066FF] hover:bg-[#0066FF]/15 transition-colors whitespace-nowrap shrink-0"
            >
              💼 Project Quote
            </button>
            <button
              type="button"
              onClick={() => handleSendMessage("Can we schedule a 15-min discovery call?")}
              className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#0066FF]/8 text-[#0066FF] hover:bg-[#0066FF]/15 transition-colors whitespace-nowrap shrink-0"
            >
              📅 Discovery Call
            </button>
            <button
              type="button"
              onClick={() => handleSendMessage("Tell me about your tech stack & SLAs")}
              className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#0066FF]/8 text-[#0066FF] hover:bg-[#0066FF]/15 transition-colors whitespace-nowrap shrink-0"
            >
              ⚡ Tech Stack
            </button>
          </div>

          {/* Chat Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSendMessage();
            }}
            className="p-3 bg-white border-t border-black/6 flex items-center gap-2 shrink-0"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Write a message..."
              className="flex-1 px-3 py-2 text-xs rounded-xl border border-black/10 bg-slate-50 text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#0066FF] focus:bg-white"
            />
            <button
              type="submit"
              disabled={isSending || !inputText.trim()}
              className="size-8 rounded-xl bg-[#0066FF] text-white flex items-center justify-center hover:bg-[#0052cc] transition-colors disabled:opacity-40 shrink-0"
            >
              <Send className="size-3.5" />
            </button>
          </form>
        </div>
      )}

      {/* Launcher Bubble */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="size-14 rounded-full bg-[#0066FF] hover:bg-[#0052cc] text-white shadow-lg hover:shadow-xl flex items-center justify-center transition-all duration-200 active:scale-95 relative group cursor-pointer"
        aria-label="Toggle live chat"
      >
        {isOpen ? (
          <X className="size-6 transition-transform group-hover:rotate-90 duration-200" />
        ) : (
          <MessageSquare className="size-6 transition-transform group-hover:scale-110 duration-200" />
        )}

        {/* Online pulse dot */}
        <span className="absolute top-0 right-0 size-3.5 rounded-full bg-emerald-400 ring-2 ring-white flex items-center justify-center">
          <span className="size-2 rounded-full bg-white animate-ping opacity-75" />
        </span>

        {/* Unread message indicator */}
        {hasUnread && !isOpen && (
          <span className="absolute -top-1 -left-1 px-1.5 py-0.5 rounded-full bg-red-600 text-[10px] font-bold text-white shadow-xs">
            1
          </span>
        )}
      </button>
    </div>
  );
}
