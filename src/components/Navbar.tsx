import React, { useState, useEffect, useRef } from 'react';
import {
  BarChart3, Box, Code2, Sprout, MapPin,
  Plus, ClipboardCheck, Network, Users,
  Menu, X, ChevronDown, Home, Wifi, WifiOff, Sparkles, ChevronRight, Layers, ShieldCheck
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
}) => {
  const role = currentUser.role;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [managementDropdownOpen, setManagementDropdownOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 4);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
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
      {/* ── TOP HEADER ── */}
      <header
        className={`sticky top-0 z-40 transition-all duration-300 bg-[#060b08]/90 backdrop-blur-xl border-b ${
          scrolled
            ? 'shadow-2xl shadow-black/70 border-emerald-500/20'
            : 'border-white/[0.08]'
        }`}
      >
        {/* Ambient Top Glow Accent Line */}
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent" />

        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-[60px] sm:h-[64px] gap-3">

            {/* ── Brand Logo ── */}
            <button
              onClick={() => handleTab('home')}
              className="flex items-center gap-2.5 sm:gap-3 group shrink-0 cursor-pointer text-left focus:outline-none"
            >
              <div className="relative shrink-0">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-lime-400 p-[1.5px] shadow-lg shadow-emerald-950/60 group-hover:shadow-emerald-500/30 transition-all duration-300 group-hover:scale-105">
                  <div className="w-full h-full bg-[#09120e] rounded-[10.5px] flex items-center justify-center">
                    <Sprout className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 group-hover:text-emerald-300 transition-colors" />
                  </div>
                </div>
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 sm:w-2.5 sm:h-2.5 bg-emerald-400 rounded-full border-2 border-[#060b08] animate-pulse shadow-sm shadow-emerald-400" />
              </div>
              <div className="leading-tight shrink-0">
                <div className="font-black text-xs sm:text-base tracking-tight text-white flex items-center gap-1 sm:gap-1.5">
                  <span>AWD Pipe</span>
                  <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-200 bg-clip-text text-transparent font-extrabold">
                    Registry
                  </span>
                </div>
                <div className="hidden sm:block text-[9px] sm:text-[10px] text-emerald-400/80 font-black uppercase tracking-widest">
                  Dr. Reddy's Foundation
                </div>
              </div>
            </button>

            {/* ── Structured Desktop Navigation (No Sliding / Fixed Width) ── */}
            <nav className="hidden lg:flex items-center gap-1.5 flex-1 justify-center max-w-2xl px-2">
              <div className="flex items-center gap-1 bg-slate-950/80 border border-white/10 rounded-2xl p-1 shadow-inner shadow-black/50">
                
                {/* Primary Core Operations Tabs */}
                {primaryTabs.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  const theme = TAB_THEMES[item.color ?? 'emerald'];

                  return (
                    <button
                      key={item.id}
                      onClick={() => handleTab(item.id)}
                      className={`relative flex items-center gap-2 px-3.5 py-1.5 xl:py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer whitespace-nowrap ${
                        isActive
                          ? `${theme.text} ${theme.bg} border ${theme.border} shadow-md shadow-black/30`
                          : 'text-slate-400 hover:text-white hover:bg-white/[0.06] border border-transparent'
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
                        isActive ? `${theme.text} scale-110` : 'text-slate-400 opacity-80'
                      }`} />
                      <span>{item.label}</span>
                      {item.badge && (
                        <span className={`text-[9px] font-mono font-extrabold px-1.5 py-0.5 rounded-full ${
                          isActive
                            ? 'bg-emerald-400 text-slate-950 shadow-xs'
                            : 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                        }`}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}

                {/* Secondary Management Popover Dropdown (No sliding!) */}
                {secondaryItems.length > 0 && (
                  <div className="relative" ref={dropdownRef}>
                    <button
                      onClick={() => setManagementDropdownOpen((v) => !v)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 xl:py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer border ${
                        isSecondaryActive || managementDropdownOpen
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-md shadow-black/30'
                          : 'text-slate-300 hover:text-white hover:bg-white/[0.06] border-transparent'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Management</span>
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${managementDropdownOpen ? 'rotate-180 text-emerald-400' : 'opacity-60'}`} />
                    </button>

                    {/* Popover Card */}
                    {managementDropdownOpen && (
                      <div className="absolute top-full right-0 mt-2 w-64 bg-[#09120e] border border-emerald-500/30 rounded-2xl p-2 shadow-2xl shadow-black/90 backdrop-blur-2xl animate-fadeIn z-50">
                        <div className="text-[10px] font-black uppercase tracking-widest text-emerald-400/80 px-3 py-1.5 border-b border-white/5 flex items-center justify-between">
                          <span>Workspace Modules</span>
                          <Sparkles className="w-3 h-3 text-emerald-400" />
                        </div>

                        <div className="space-y-1 mt-1">
                          {secondaryItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = activeTab === item.id;
                            const theme = TAB_THEMES[item.color ?? 'emerald'];

                            return (
                              <button
                                key={item.id}
                                onClick={() => handleTab(item.id)}
                                className={`w-full flex items-start gap-3 p-2.5 rounded-xl transition-all cursor-pointer text-left ${
                                  isActive
                                    ? `${theme.bg} ${theme.text} border ${theme.border}`
                                    : 'hover:bg-white/[0.06] text-slate-300 hover:text-white border border-transparent'
                                }`}
                              >
                                <div className={`p-2 rounded-lg ${isActive ? 'bg-black/30' : 'bg-slate-900/80 border border-white/5'}`}>
                                  <Icon className={`w-4 h-4 ${isActive ? theme.text : 'text-slate-400'}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-bold flex items-center justify-between">
                                    <span>{item.label}</span>
                                    {isActive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                                  </div>
                                  {item.description && (
                                    <div className="text-[10px] text-slate-400 truncate mt-0.5 font-medium">
                                      {item.description}
                                    </div>
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

              </div>
            </nav>

            {/* ── Right Controls & Badges ── */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              
              {/* Online/Offline Status Indicator */}
              <button
                onClick={onOpenSyncModal}
                aria-label="View Offline Sync Queue"
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all duration-200 cursor-pointer ${
                  offlineQueueCount > 0
                    ? 'bg-amber-950/60 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-950/50 animate-pulse'
                    : isOnline
                    ? 'bg-emerald-950/50 text-emerald-400 border-emerald-500/30 hover:bg-emerald-900/40'
                    : 'bg-rose-950/50 text-rose-300 border-rose-500/30 hover:bg-rose-900/40'
                }`}
                title="View Sync Status & Offline Queue"
              >
                <div className="relative flex items-center justify-center shrink-0">
                  {isOnline ? (
                    <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <WifiOff className="w-3.5 h-3.5 text-rose-400" />
                  )}
                  <span className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-rose-400'} animate-ping`} />
                </div>

                <span className="hidden sm:inline font-semibold">
                  {isOnline ? 'Online' : 'Offline'}
                </span>

                {offlineQueueCount > 0 && (
                  <span className="bg-amber-400 text-slate-950 px-1.5 py-0.5 rounded-md font-mono text-[10px] font-black shadow-xs">
                    {offlineQueueCount}
                  </span>
                )}
              </button>


              {/* User Profile Dropdown Badge */}
              <UserProfileBadge currentUser={currentUser} onLogout={onLogout} />

              {/* Mobile Overflow Menu Toggle */}
              {mobileOverflowItems.length > 0 && (
                <button
                  className="lg:hidden p-2 rounded-xl bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] text-slate-300 transition cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center shrink-0"
                  onClick={() => setMobileMenuOpen(v => !v)}
                  aria-label="More navigation items"
                >
                  {mobileMenuOpen ? <X className="w-5 h-5 text-white" /> : <Menu className="w-5 h-5 text-slate-300" />}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Mobile Drawer for Overflow Items ── */}
        {mobileMenuOpen && mobileOverflowItems.length > 0 && (
          <div className="lg:hidden border-t border-white/10 py-3 px-4 animate-fadeIn bg-[#070e0a]/95 backdrop-blur-2xl">
            <div className="text-[10px] font-black uppercase tracking-widest text-emerald-400/80 mb-2 px-1">
              More Modules
            </div>
            <div className="space-y-1.5">
              {mobileOverflowItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                const theme = TAB_THEMES[item.color ?? 'emerald'];
                return (
                  <button
                    key={item.id}
                    onClick={() => handleTab(item.id)}
                    className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-bold transition-all cursor-pointer min-h-[48px] ${
                      isActive
                        ? `${theme.bg} ${theme.text} border ${theme.border} shadow-md`
                        : 'text-slate-300 hover:bg-white/[0.06] hover:text-white border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${isActive ? theme.text : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                      {item.badge && (
                        <span className="text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 opacity-40" />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </header>

      {/* ── MOBILE BOTTOM TAB BAR (visible only on mobile/tablet < lg) ── */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#060b08]/95 backdrop-blur-2xl border-t border-white/10 shadow-2xl shadow-black"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-stretch max-w-lg mx-auto">
          {mobileBottomItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const theme = TAB_THEMES[item.color ?? 'emerald'];

            return (
              <button
                key={item.id}
                onClick={() => handleTab(item.id)}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 transition-all cursor-pointer relative min-h-[54px] min-w-0 ${
                  isActive ? 'opacity-100' : 'opacity-70 hover:opacity-100 hover:bg-white/[0.04]'
                }`}
              >
                {isActive && (
                  <span className={`absolute top-0 inset-x-2 h-0.5 rounded-b-full bg-gradient-to-r ${theme.glow}`} />
                )}
                <div className={`relative p-1 rounded-xl transition-transform duration-200 ${
                  isActive ? `${theme.bg} ${theme.text} scale-105` : 'text-slate-400'
                }`}>
                  <Icon className="w-5 h-5" />
                  {item.badge && (
                    <span className="absolute -top-1 -right-1.5 w-3.5 h-3.5 bg-emerald-400 text-slate-950 rounded-full text-[8px] font-black flex items-center justify-center shadow-xs">
                      {item.badge.length > 3 ? '…' : item.badge}
                    </span>
                  )}
                </div>
                <span className={`text-[10px] font-extrabold tracking-tight truncate w-full text-center px-0.5 ${isActive ? theme.text : 'text-slate-400'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}

          {/* "More" button if overflow items exist */}
          {mobileOverflowItems.length > 0 && (
            <button
              onClick={() => setMobileMenuOpen(v => !v)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 transition-all cursor-pointer min-h-[54px] min-w-0 ${
                mobileMenuOpen || mobileOverflowItems.some(i => i.id === activeTab) ? 'opacity-100' : 'opacity-70 hover:opacity-100 hover:bg-white/[0.04]'
              }`}
            >
              <div className={`p-1 rounded-xl ${mobileMenuOpen ? 'bg-slate-800 text-white' : 'text-slate-400'}`}>
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </div>
              <span className="text-[10px] font-extrabold tracking-tight text-slate-400 truncate w-full text-center px-0.5">More</span>
            </button>
          )}
        </div>
      </nav>

      {/* ── Spacer for mobile bottom nav ── */}
      <div className="lg:hidden h-[60px]" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }} />
    </>
  );
};

