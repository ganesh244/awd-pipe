import React, { useState, useEffect, useRef } from 'react';
import {
  BarChart3, Box, Code2, Sprout, MapPin,
  Plus, ClipboardCheck, Network, Users,
  Menu, X, ChevronDown, Home, Wifi, WifiOff, Sparkles, ChevronRight, Layers, ShieldCheck, RefreshCw
} from 'lucide-react';
import { User } from '../types';
import { UserProfileBadge } from './UserProfileBadge';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activePipeId: string;
  currentUser: User;
  onLogout: () => void;
  onOpenGenerateModal?: () => void;
  isOnline: boolean;
  onToggleOnline: () => void;
  offlineQueueCount: number;
  onOpenSyncModal: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

interface NavItem {
  id: string;
  label: string;
  description?: string;
  icon: React.FC<any>;
  badge?: string;
  color?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  activePipeId,
  currentUser,
  onLogout,
  onOpenGenerateModal,
  isOnline,
  offlineQueueCount,
  onOpenSyncModal,
  onRefresh,
  isRefreshing,
}) => {
  const role = currentUser.role;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [managementDropdownOpen, setManagementDropdownOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // IntersectionObserver sentinel — no setState on every scroll frame (Vercel perf rule)
  useEffect(() => {
    const sentinel = document.createElement('div');
    sentinel.style.cssText = 'position:absolute;top:1px;left:0;width:1px;height:1px;pointer-events:none;';
    document.body.prepend(sentinel);
    const obs = new IntersectionObserver(
      ([entry]) => setScrolled(!entry.isIntersecting),
      { threshold: 0 }
    );
    obs.observe(sentinel);
    return () => { obs.disconnect(); sentinel.remove(); };
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setManagementDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close menus on tab change
  useEffect(() => {
    setMobileMenuOpen(false);
    setManagementDropdownOpen(false);
  }, [activeTab]);

  // ── Core Navigation Definitions ──
  const homeTab: NavItem        = { id: 'home',      label: 'Home',       description: 'Dashboard overview & quick metrics', icon: Home,           color: 'emerald' };
  const regTab: NavItem         = { id: 'mobile',    label: 'Register',   description: 'QR scan & field pipe installation', icon: ClipboardCheck, badge: activePipeId || undefined, color: 'sky' };
  const mapTab: NavItem         = { id: 'map',       label: 'Field Map',  description: 'GIS spatial mapping & field pins', icon: MapPin,         color: 'blue' };
  const analyticsTab: NavItem   = { id: 'analytics', label: 'Analytics',  description: 'AWD adoption & water savings KPIs', icon: BarChart3,      color: 'violet' };

  // Secondary Management items (grouped into clean dropdown to prevent horizontal scroll/sliding)
  const farmerTab: NavItem      = { id: 'farmers',   label: 'Farmers',    description: 'Farmer profiles & plot directories', icon: Users,          color: 'indigo' };
  const inventoryQRTab: NavItem = { id: 'inventory', label: 'Inventory',  description: 'Pipe stock & batch QR printing', icon: Box,            color: 'amber' };
  const hierarchyTab: NavItem   = { id: 'hierarchy', label: 'Team',       description: 'Org hierarchy & territory tree', icon: Network,        color: 'teal' };
  const codeTab: NavItem        = { id: 'code',      label: 'Dev Tools',  description: 'Apps Script & system config', icon: Code2,          color: 'slate' };

  // Determine Primary Tabs (max 4 on top bar) & Secondary Management Items based on role
  let primaryTabs: NavItem[] = [homeTab, regTab];
  let secondaryItems: NavItem[] = [];

  if (role === 'CF' || role === 'JCF') {
    primaryTabs = [homeTab, regTab, farmerTab, analyticsTab];
    secondaryItems = [];
  } else if (role === 'Area Manager') {
    primaryTabs = [homeTab, regTab, mapTab, analyticsTab];
    secondaryItems = [farmerTab];
  } else if (role === 'District Manager') {
    primaryTabs = [homeTab, regTab, mapTab, analyticsTab];
    secondaryItems = [farmerTab, hierarchyTab];
  } else if (role === 'State Manager') {
    primaryTabs = [homeTab, regTab, mapTab, analyticsTab];
    secondaryItems = [farmerTab, inventoryQRTab, hierarchyTab];
  } else {
    // Admin / Global Admin
    primaryTabs = [homeTab, regTab, mapTab, analyticsTab];
    secondaryItems = [farmerTab, inventoryQRTab, hierarchyTab, codeTab];
  }

  // Combined list for mobile bottom bar / mobile drawer
  const allNavItems = [...primaryTabs, ...secondaryItems];
  const mobileBottomItems = allNavItems.slice(0, 4);
  const mobileOverflowItems = allNavItems.slice(4);

  const isSecondaryActive = secondaryItems.some((item) => item.id === activeTab);

  const TAB_THEMES: Record<string, { text: string; bg: string; border: string; glow: string }> = {
    emerald: { text: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', glow: 'from-emerald-500/20 to-teal-500/10' },
    sky:     { text: 'text-sky-400',     bg: 'bg-sky-500/15',     border: 'border-sky-500/30',     glow: 'from-sky-500/20 to-blue-500/10' },
    blue:    { text: 'text-blue-400',    bg: 'bg-blue-500/15',    border: 'border-blue-500/30',    glow: 'from-blue-500/20 to-cyan-500/10' },
    violet:  { text: 'text-violet-400',  bg: 'bg-violet-500/15',  border: 'border-violet-500/30',  glow: 'from-violet-500/20 to-purple-500/10' },
    amber:   { text: 'text-amber-400',   bg: 'bg-amber-500/15',   border: 'border-amber-500/30',   glow: 'from-amber-500/20 to-orange-500/10' },
    teal:    { text: 'text-teal-400',    bg: 'bg-teal-500/15',    border: 'border-teal-500/30',    glow: 'from-teal-500/20 to-emerald-500/10' },
    indigo:  { text: 'text-indigo-400',  bg: 'bg-indigo-500/15',  border: 'border-indigo-500/30',  glow: 'from-indigo-500/20 to-blue-500/10' },
    slate:   { text: 'text-slate-300',   bg: 'bg-slate-500/15',   border: 'border-slate-500/30',   glow: 'from-slate-500/20 to-slate-600/10' },
  };

  const handleTab = (id: string) => {
    setActiveTab(id);
    setMobileMenuOpen(false);
    setManagementDropdownOpen(false);
  };

  return (
    <>
      {/* ── TOP HEADER — flat, matches the design prototype's chrome ── */}
      <header
        className="sticky top-0 z-40"
        style={{
          background: 'var(--color-shell)',
          borderBottom: `2px solid ${scrolled ? 'var(--color-accent-500)' : 'rgba(255,255,255,0.12)'}`,
          transition: 'border-color 0.2s',
          paddingTop: 'env(safe-area-inset-top, 0px)',
        }}
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-[56px] sm:h-[60px] gap-3">

            {/* ── Brand ── */}
            <button
              onClick={() => handleTab('home')}
              className="flex items-center gap-2.5 shrink-0 cursor-pointer text-left focus:outline-none"
            >
              <div className="w-8 h-8 flex items-center justify-center shrink-0" style={{ background: 'var(--color-accent-500)' }}>
                <Sprout className="w-4 h-4 text-white" />
              </div>
              <div className="leading-tight shrink-0">
                <div className="font-black text-xs sm:text-sm tracking-tight text-white">
                  AWD Pipe <span style={{ color: 'var(--color-accent-400)' }}>Registry</span>
                </div>
                <div className="hidden sm:block text-[9px] uppercase tracking-widest text-white/50 font-bold">
                  Dr. Reddy's Foundation
                </div>
              </div>
            </button>

            {/* ── Desktop Navigation — flat bordered buttons, filled when active ── */}
            <nav className="hidden lg:flex items-center gap-1.5 flex-1 justify-center max-w-2xl px-2">
              {primaryTabs.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => handleTab(item.id)}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold cursor-pointer whitespace-nowrap"
                    style={{
                      background: isActive ? 'var(--color-accent-500)' : 'transparent',
                      color: isActive ? '#fff' : 'rgba(255,255,255,0.65)',
                      border: `1px solid ${isActive ? 'var(--color-accent-500)' : 'rgba(255,255,255,0.18)'}`,
                    }}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="min-w-0 truncate">{item.label}</span>
                    {item.badge && (
                      <span className="awd-mono text-[9px] font-extrabold px-1.5" style={{ background: isActive ? 'rgba(0,0,0,0.2)' : 'var(--color-accent-500)', color: '#fff' }}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}

              {/* Secondary "Management" dropdown */}
              {secondaryItems.length > 0 && (
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setManagementDropdownOpen((v) => !v)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold cursor-pointer"
                    style={{
                      background: isSecondaryActive || managementDropdownOpen ? 'var(--color-accent-500)' : 'transparent',
                      color: isSecondaryActive || managementDropdownOpen ? '#fff' : 'rgba(255,255,255,0.65)',
                      border: `1px solid ${isSecondaryActive || managementDropdownOpen ? 'var(--color-accent-500)' : 'rgba(255,255,255,0.18)'}`,
                    }}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Management</span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${managementDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {managementDropdownOpen && (
                    <div className="absolute top-full right-0 mt-1 w-64 z-50" style={{ background: 'var(--color-shell-alt)', border: '1px solid rgba(255,255,255,0.15)' }}>
                      <div className="text-[10px] font-black uppercase tracking-widest text-white/50 px-3 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        Workspace modules
                      </div>
                      <div>
                        {secondaryItems.map((item) => {
                          const Icon = item.icon;
                          const isActive = activeTab === item.id;

                          return (
                            <button
                              key={item.id}
                              onClick={() => handleTab(item.id)}
                              className="w-full flex items-start gap-3 p-2.5 cursor-pointer text-left"
                              style={{ background: isActive ? 'rgba(255,255,255,0.06)' : 'transparent' }}
                            >
                              <Icon className="w-4 h-4 mt-0.5" style={{ color: isActive ? 'var(--color-accent-400)' : 'rgba(255,255,255,0.5)' }} />
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold text-white">{item.label}</div>
                                {item.description && (
                                  <div className="text-[10px] text-white/45 truncate mt-0.5">{item.description}</div>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </nav>

            {/* ── Right controls ── */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">

              <button
                onClick={onRefresh}
                disabled={isRefreshing}
                aria-label="Refresh data"
                title="Refresh data from server"
                className="flex items-center justify-center w-8 h-8 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 shrink-0"
                style={{ border: '1px solid rgba(255,255,255,0.18)', color: 'rgba(255,255,255,0.7)' }}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} style={isRefreshing ? { color: 'var(--color-accent-400)' } : undefined} />
              </button>

              <button
                onClick={onOpenSyncModal}
                aria-label="View Offline Sync Queue"
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold cursor-pointer"
                style={{
                  border: `1px solid ${offlineQueueCount > 0 ? '#B45309' : isOnline ? 'var(--color-accent-500)' : 'var(--color-danger)'}`,
                  color: offlineQueueCount > 0 ? '#FCD34D' : isOnline ? 'var(--color-accent-400)' : '#FCA5A5',
                }}
                title="View Sync Status & Offline Queue"
              >
                {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline font-semibold">{isOnline ? 'Online' : 'Offline'}</span>
                {offlineQueueCount > 0 && (
                  <span className="awd-mono px-1.5" style={{ background: 'var(--color-warning)', color: '#fff', fontSize: 10 }}>
                    {offlineQueueCount}
                  </span>
                )}
              </button>

              <UserProfileBadge currentUser={currentUser} onLogout={onLogout} />

              {mobileOverflowItems.length > 0 && (
                <button
                  className="lg:hidden w-9 h-9 flex items-center justify-center cursor-pointer shrink-0"
                  style={{ border: '1px solid rgba(255,255,255,0.18)' }}
                  onClick={() => setMobileMenuOpen(v => !v)}
                  aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open more navigation items'}
                  aria-expanded={mobileMenuOpen}
                >
                  {mobileMenuOpen ? <X className="w-5 h-5 text-white" aria-hidden="true" /> : <Menu className="w-5 h-5 text-white/70" aria-hidden="true" />}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Mobile Drawer for Overflow Items ── */}
        {mobileMenuOpen && mobileOverflowItems.length > 0 && (
          <div className="lg:hidden px-4 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.12)', background: 'var(--color-shell-border)' }}>
            <div className="text-[10px] font-black uppercase tracking-widest text-white/45 mb-2 px-1">
              More modules
            </div>
            <div>
              {mobileOverflowItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleTab(item.id)}
                    className="w-full flex items-center justify-between px-3 py-3 text-sm font-bold cursor-pointer min-h-[48px]"
                    style={{ background: isActive ? 'var(--color-accent-500)' : 'transparent', color: isActive ? '#fff' : 'rgba(255,255,255,0.75)', borderTop: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                      {item.badge && (
                        <span className="awd-mono text-xs font-bold px-2" style={{ background: 'rgba(0,0,0,0.25)' }}>
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 opacity-50" />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </header>

      {/* ── MOBILE BOTTOM TAB BAR (visible only on mobile/tablet < lg) ──
          Flush, solid-fill-when-active pattern from the AWD Field design
          prototype: no gradients/glow, just a filled chip on the active tab. */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[color:var(--color-shell)]/95 backdrop-blur-2xl border-t border-white/10 shadow-2xl shadow-black"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-stretch max-w-lg mx-auto">
          {mobileBottomItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleTab(item.id)}
                className="flex-1 flex flex-col items-center justify-center gap-1 py-2 transition-colors cursor-pointer relative min-h-[54px] min-w-0"
              >
                <div className={`relative flex items-center justify-center w-9 h-9 rounded-lg transition-colors duration-150 ${
                  isActive ? 'bg-accent-500 text-white' : 'text-white/55'
                }`}>
                  <Icon className="w-[18px] h-[18px]" />
                  {item.badge && (
                    <span className="absolute -top-1 -right-1.5 w-3.5 h-3.5 bg-accent-400 text-[#0a1206] rounded-full text-[8px] font-black flex items-center justify-center">
                      {item.badge.length > 3 ? '…' : item.badge}
                    </span>
                  )}
                </div>
                <span className={`text-[10px] font-bold tracking-tight truncate w-full text-center px-0.5 ${isActive ? 'text-white' : 'text-white/55'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}

          {/* "More" button if overflow items exist */}
          {mobileOverflowItems.length > 0 && (
            <button
              onClick={() => setMobileMenuOpen(v => !v)}
              aria-label={mobileMenuOpen ? 'Close more navigation' : 'Show more navigation'}
              aria-expanded={mobileMenuOpen}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-2 transition-colors cursor-pointer min-h-[54px] min-w-0 focus-visible:outline-2 focus-visible:outline-accent-500"
            >
              <div className={`flex items-center justify-center w-9 h-9 rounded-lg transition-colors duration-150 ${
                mobileMenuOpen || mobileOverflowItems.some(i => i.id === activeTab) ? 'bg-accent-500 text-white' : 'text-white/55'
              }`}>
                {mobileMenuOpen ? <X className="w-[18px] h-[18px]" aria-hidden="true" /> : <Menu className="w-[18px] h-[18px]" aria-hidden="true" />}
              </div>
              <span className={`text-[10px] font-bold tracking-tight truncate w-full text-center px-0.5 ${
                mobileMenuOpen || mobileOverflowItems.some(i => i.id === activeTab) ? 'text-white' : 'text-white/55'
              }`} aria-hidden="true">More</span>
            </button>
          )}
        </div>
      </nav>

    </>
  );
};

