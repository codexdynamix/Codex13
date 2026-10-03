import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Globe,
  Briefcase,
  Receipt,
  Server,
  Compass,
  FolderOpen,
  Headphones,
  Bell,
  UserRound,
  LogOut,
  ExternalLink,
  Menu,
  X,
  Layers,
} from 'lucide-react';
import { readPortalSession, clearPortalSession, setPortalSession } from '../services/portalAuth';
import { portalDb, type PortalClient } from '../services/portalDatabase';
import { ThemeToggle } from '../components/ThemeToggle';

interface PortalShellProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  children: React.ReactNode;
}

export function PortalShell({ currentPath, onNavigate, children }: PortalShellProps) {
  const session = readPortalSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [client, setClient] = useState<PortalClient | null>(session?.client || null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [allClients, setAllClients] = useState<PortalClient[]>([]);

  useEffect(() => {
    const updateState = () => {
      const sess = readPortalSession();
      if (!sess) {
        onNavigate('/portal/login');
        return;
      }
      setClient(sess.client);
      const notifs = portalDb.getNotifications(sess.client.id);
      setUnreadCount(notifs.filter((n) => !n.read).length);
      setAllClients(portalDb.adminGetAllClients());
    };

    updateState();

    const handleDataChange = () => updateState();
    window.addEventListener('cdx_portal_database_updated', handleDataChange);
    window.addEventListener('cdx_portal_auth_changed', handleDataChange);
    return () => {
      window.removeEventListener('cdx_portal_database_updated', handleDataChange);
      window.removeEventListener('cdx_portal_auth_changed', handleDataChange);
    };
  }, [onNavigate]);

  if (!client) {
    return null;
  }

  const navItems = [
    { path: '/portal/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/portal/websites', label: 'Websites & Back Offices', icon: Globe },
    { path: '/portal/projects', label: 'Projects & Milestones', icon: Briefcase },
    { path: '/portal/billing', label: 'Billing & Invoices', icon: Receipt },
    { path: '/portal/hosting', label: 'Hosting & Servers', icon: Server },
    { path: '/portal/domains', label: 'Domains & DNS', icon: Compass },
    { path: '/portal/files', label: 'Files & Assets', icon: FolderOpen },
    { path: '/portal/support', label: 'Support & Tickets', icon: Headphones },
    { path: '/portal/notifications', label: 'Notifications', icon: Bell, badge: unreadCount },
    { path: '/portal/profile', label: 'Settings', icon: UserRound },
  ];

  const handleLogout = () => {
    clearPortalSession();
    onNavigate('/portal/login');
  };

  const handleSwitchClient = (newClientId: string) => {
    const target = portalDb.getClientById(newClientId);
    if (target && target.portalEnabled) {
      setPortalSession(target);
      setClient(target);
      onNavigate('/portal/dashboard');
    }
  };

  const notifications = portalDb.getNotifications(client.id);

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#F5F5F7] dark:bg-[#000000] text-[#1D1D1F] dark:text-[#F5F5F7] flex flex-col font-sans transition-colors duration-200">
      {typeof window !== 'undefined' && sessionStorage.getItem('codex_impersonating_admin') === 'true' && (
        <div className="bg-[#0071E3] text-white px-4 py-2 text-xs flex items-center justify-between font-medium shadow-sm z-50 shrink-0">
          <div className="flex items-center gap-2">
            <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Admin Control</span>
            <span>Viewing Client Portal as <strong>{client.name}</strong> ({client.company}) — Password Bypassed</span>
          </div>
          <button
            type="button"
            onClick={() => {
              sessionStorage.removeItem('codex_impersonating_admin');
              const target = '/admin';
              if (typeof window !== 'undefined' && typeof (window as any).cdxNavigate === 'function') {
                (window as any).cdxNavigate(target);
              } else {
                window.history.pushState(null, '', target);
                window.dispatchEvent(new PopStateEvent('popstate'));
              }
            }}
            className="bg-white text-[#0071E3] hover:bg-white/90 px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-xs"
          >
            Return to Admin Panel ➔
          </button>
        </div>
      )}
      {/* 
        UNIFIED TOP HEADER ACROSS ENTIRE PAGE:
        The single continuous bottom border (border-b) guarantees that the sidebar header 
        and the main header bottom borders are 100% aligned with zero subpixel offset.
      */}
      <header className="h-16 shrink-0 flex items-center border-b border-black/[0.08] dark:border-white/[0.08] bg-white/80 dark:bg-[#121214]/80 backdrop-blur-xl z-30 select-none">
        {/* Desktop Sidebar Top Section (exactly w-64 matching sidebar width below) */}
        <div className="hidden lg:flex w-64 h-full px-5 border-r border-black/[0.08] dark:border-white/[0.08] items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-xl bg-gradient-to-br from-[#0071E3] to-[#0A84FF] text-white flex items-center justify-center font-bold text-xs tracking-tight shadow-sm ring-1 ring-white/20">
              CD
            </div>
            <div>
              <div className="text-[13px] font-semibold text-[#1D1D1F] dark:text-white tracking-tight leading-none">
                Codex Dynamics
              </div>
              <div className="text-[10px] text-[#86868B] mt-1 flex items-center gap-1.5 font-medium">
                <span className="inline-block size-1.5 rounded-full bg-[#30D158]" />
                <span>Client Portal</span>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Header Left Section */}
        <div className="lg:hidden flex items-center gap-2.5 px-4">
          <div className="size-8 rounded-xl bg-[#0071E3] text-white flex items-center justify-center font-bold text-xs">
            CD
          </div>
          <div>
            <div className="text-xs font-semibold text-[#1D1D1F] dark:text-white leading-none">
              Codex Dynamics
            </div>
            <div className="text-[10px] text-[#86868B] mt-0.5">{client.company}</div>
          </div>
        </div>

        {/* Desktop Main Header Section */}
        <div className="flex-1 h-full px-4 sm:px-6 flex items-center justify-between min-w-0">
          {/* Breadcrumb Path */}
          <div className="hidden sm:flex items-center gap-2 text-xs">
            <span className="text-[#86868B]">Workspace</span>
            <span className="text-[#86868B]/40">/</span>
            <span className="font-semibold text-[#1D1D1F] dark:text-white capitalize">
              {currentPath.replace('/portal/', '').replace('-', ' ') || 'Dashboard'}
            </span>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2.5 ml-auto">
            {/* Theme Toggle */}
            <ThemeToggle variant="icon" />

            {/* Notifications Menu Toggle */}
            <div className="relative">
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="p-2 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] text-[#1D1D1F] dark:text-white hover:bg-black/[0.08] dark:hover:bg-white/[0.1] relative transition-colors"
                aria-label="Notifications"
              >
                <Bell size={16} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 size-4 bg-[#FF3B30] text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/[0.1] rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.12)] p-3 z-50">
                  <div className="flex items-center justify-between pb-2 border-b border-black/[0.06] dark:border-white/[0.08] mb-2 px-1">
                    <span className="text-xs font-semibold text-[#1D1D1F] dark:text-white">Notifications</span>
                    <button
                      onClick={() => {
                        portalDb.markAllNotificationsRead(client.id);
                        setUnreadCount(0);
                      }}
                      className="text-[11px] text-[#0071E3] hover:underline font-medium"
                    >
                      Mark all read
                    </button>
                  </div>
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="text-xs text-[#86868B] text-center py-6">No notifications</div>
                    ) : (
                      notifications.slice(0, 5).map((n) => (
                        <div
                          key={n.id}
                          onClick={() => {
                            portalDb.markNotificationRead(client.id, n.id);
                            setNotificationsOpen(false);
                            onNavigate(n.link || '/portal/notifications');
                          }}
                          className={`p-2.5 rounded-xl text-xs cursor-pointer transition-colors ${
                            n.read
                              ? 'bg-transparent text-[#86868B]'
                              : 'bg-[#0071E3]/5 text-[#1D1D1F] dark:text-white font-medium'
                          }`}
                        >
                          <div className="font-semibold">{n.title}</div>
                          <div className="text-[11px] text-[#86868B] mt-0.5 line-clamp-2">{n.description}</div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="pt-2 border-t border-black/[0.06] dark:border-white/[0.08] mt-2 text-center">
                    <button
                      onClick={() => {
                        setNotificationsOpen(false);
                        onNavigate('/portal/notifications');
                      }}
                      className="text-xs text-[#0071E3] font-medium hover:underline"
                    >
                      View All
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Support Button */}
            <button
              onClick={() => onNavigate('/portal/support')}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.07] dark:hover:bg-white/[0.12] text-xs font-medium text-[#1D1D1F] dark:text-white transition-all"
            >
              <Headphones size={13} className="text-[#30D158]" />
              <span>Support</span>
            </button>

            {/* User Profile Pill */}
            <div
              onClick={() => onNavigate('/portal/profile')}
              className="flex items-center gap-2 cursor-pointer pl-1.5 sm:pl-2.5 sm:border-l border-black/[0.06] dark:border-white/[0.08] group"
            >
              <div className="size-8 rounded-full bg-[#0071E3] text-white flex items-center justify-center font-bold text-xs ring-1 ring-white/20">
                {client.name.charAt(0)}
              </div>
              <div className="hidden md:block text-left">
                <div className="text-xs font-semibold text-[#1D1D1F] dark:text-white group-hover:text-[#0071E3] transition-colors leading-tight">
                  {client.name}
                </div>
                <div className="text-[10px] text-[#86868B] truncate max-w-[120px]">
                  {client.company}
                </div>
              </div>
            </div>

            {/* Mobile Menu Toggle Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl bg-black/[0.04] dark:bg-white/[0.08] text-[#1D1D1F] dark:text-white"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X size={19} /> : <Menu size={19} />}
            </button>
          </div>
        </div>
      </header>

      {/* 
        BODY WORKSPACE:
        - Sidebar: menu is ONLY scrollable part, footer is fixed at bottom
        - Main viewport: independently scrollable
      */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex w-64 h-full flex-col bg-[#FBFBFC]/95 dark:bg-[#121214]/90 backdrop-blur-2xl border-r border-black/[0.08] dark:border-white/[0.08] shrink-0 select-none">
          {/* Active Client Account Card - Fixed at top of sidebar */}
          <div className="shrink-0 px-3.5 pt-3.5 pb-2.5">
            <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] shadow-[0_1px_3px_rgba(0,0,0,0.03)] transition-all">
              <div className="flex items-center justify-between gap-1.5 mb-2">
                <span className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider">
                  Account
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#0071E3]/10 text-[#0071E3] dark:text-[#389BF2] text-[10px] font-semibold tracking-tight whitespace-nowrap">
                  {client.tier}
                </span>
              </div>
              <div className="text-[13px] font-semibold text-[#1D1D1F] dark:text-white truncate leading-snug">
                {client.company}
              </div>
              <div className="text-[11px] text-[#86868B] truncate mt-0.5 font-normal">
                {client.name}
              </div>

              {/* Demo Switcher */}
              <div className="mt-2.5 pt-2.5 border-t border-black/[0.05] dark:border-white/[0.07] flex items-center justify-between gap-2">
                <span className="text-[10px] text-[#86868B] font-medium shrink-0">Switch:</span>
                <select
                  value={client.id}
                  onChange={(e) => handleSwitchClient(e.target.value)}
                  className="bg-black/[0.03] dark:bg-white/[0.06] hover:bg-black/[0.05] dark:hover:bg-white/[0.1] border border-black/[0.08] dark:border-white/[0.1] rounded-lg px-2 py-0.5 text-[10px] text-[#1D1D1F] dark:text-white font-medium focus:outline-none transition-colors cursor-pointer max-w-[125px] truncate"
                >
                  {allClients.map((c) => (
                    <option key={c.id} value={c.id} className="bg-white dark:bg-[#1C1C1E] text-[#1D1D1F] dark:text-white">
                      {c.company.split(' ')[0]} ({c.name.split(' ')[0]})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 
            SIDEBAR MENU:
            ONLY THIS PART IS SCROLLABLE!
          */}
          <nav className="flex-1 overflow-y-auto min-h-0 px-3 py-1 space-y-0.5">
            {navItems.map((item) => {
              const active = currentPath === item.path || (item.path !== '/portal/dashboard' && currentPath.startsWith(item.path));
              const Icon = item.icon;
              return (
                <button
                  key={item.path}
                  onClick={() => onNavigate(item.path)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-[13px] font-medium transition-all ${
                    active
                      ? 'bg-[#0071E3] text-white shadow-xs'
                      : 'text-[#6E6E73] dark:text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.05]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon size={16} className={active ? 'text-white' : 'text-[#86868B]'} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && item.badge > 0 ? (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        active ? 'bg-white text-[#0071E3]' : 'bg-[#FF3B30] text-white'
                      }`}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>

          {/* 
            FOOTER CONTROLS:
            FIXED AT THE BOTTOM!
          */}
          <div className="shrink-0 p-3 border-t border-black/[0.06] dark:border-white/[0.08] space-y-2 mt-auto">
            <div className="flex items-center justify-between px-1 text-[11px]">
              <a
                href="/portal/connector-demo"
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate('/portal/connector-demo');
                }}
                className="text-[#0071E3] hover:underline flex items-center gap-1 font-medium"
              >
                <Layers size={12} />
                <span>SSO Demo</span>
              </a>
              <a
                href="/"
                className="text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-white flex items-center gap-1 font-medium transition-colors"
              >
                <span>Site</span>
                <ExternalLink size={11} />
              </a>
            </div>

            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-black/[0.06] dark:border-white/[0.08] text-[#86868B] hover:text-[#FF3B30] hover:border-[#FF3B30]/30 hover:bg-[#FF3B30]/5 text-xs font-semibold transition-all"
            >
              <LogOut size={13} />
              <span>Sign out</span>
            </button>
          </div>
        </aside>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div
              className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="relative w-72 max-w-[85vw] bg-white dark:bg-[#1C1C1E] h-full flex flex-col z-50 border-r border-black/[0.06] dark:border-white/[0.08] p-4 shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-black/[0.06] dark:border-white/[0.08]">
                <div className="flex items-center gap-2.5">
                  <div className="size-8 rounded-xl bg-[#0071E3] text-white flex items-center justify-center font-bold text-xs">
                    CD
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#1D1D1F] dark:text-white">Client Portal</div>
                    <div className="text-[10px] text-[#86868B]">{client.company}</div>
                  </div>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-white"
                  aria-label="Close menu"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Mobile Menu List (Scrollable) */}
              <nav className="flex-1 overflow-y-auto py-3 space-y-1">
                {navItems.map((item) => {
                  const active = currentPath === item.path || (item.path !== '/portal/dashboard' && currentPath.startsWith(item.path));
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.path}
                      onClick={() => {
                        onNavigate(item.path);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium ${
                        active
                          ? 'bg-[#0071E3] text-white'
                          : 'text-[#6E6E73] dark:text-[#A1A1A6] hover:bg-black/[0.04] dark:hover:bg-white/[0.05]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon size={16} />
                        <span>{item.label}</span>
                      </div>
                      {item.badge !== undefined && item.badge > 0 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-[#FF3B30] text-white">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>

              <div className="pt-3 border-t border-black/[0.06] dark:border-white/[0.08] space-y-2">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-black/[0.06] dark:border-white/[0.08] text-[#86868B] text-xs font-semibold"
                >
                  <LogOut size={14} />
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 
          MAIN VIEWPORT CONTENT:
          Independently scrollable with clean Apple padding and max width
        */}
        <main className="flex-1 h-full overflow-y-auto min-w-0 bg-[#F5F5F7] dark:bg-[#000000]">
          <div className="p-5 sm:p-7 lg:p-9 max-w-7xl w-full mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
