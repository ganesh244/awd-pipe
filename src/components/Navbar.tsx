import React, { useState, useEffect } from 'react';
import {
  BarChart3, Box, Printer, Code2, Sprout, MapPin,
  Plus, ClipboardCheck, Network, FileDown, Users,
  Menu, X, ChevronRight, Home, Wifi, WifiOff
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
  onToggleOnline,
  offlineQueueCount,
  onOpenSyncModal,
}) => {
  const role = currentUser.role;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 4);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  // Close mobile menu on tab change
  useEffect(() => { setMobileMenuOpen(false); }, [activeTab]);

  const homeTab: NavItem       = { id: 'home',      label: 'Home',       icon: Home,           color: 'emerald' };
  const regTab: NavItem        = { id: 'mobile',    label: 'Register',   icon: ClipboardCheck, badge: activePipeId || undefined, color: 'sky' };
  const mapTab: NavItem        = { id: 'map',        label: 'Map',        icon: MapPin,         color: 'blue' };
  const analyticsTab: NavItem  = { id: 'analytics',  label: 'Analytics',  icon: BarChart3,      color: 'violet' };
  const inventoryQRTab: NavItem= { id: 'inventory',  label: 'Inventory',  icon: Box,            color: 'amber' };
  const hierarchyTab: NavItem  = { id: 'hierarchy',  label: 'Team',       icon: Network,        color: 'teal' };
  const farmerTab: NavItem     = { id: 'farmers',    label: 'Farmers',    icon: Users,          color: 'indigo' };
  const codeTab: NavItem       = { id: 'code',       label: 'Dev',        icon: Code2,          color: 'slate' };

  let navItems: NavItem[] = [];
  if (role === 'CF' || role === 'JCF')           navItems = [homeTab, regTab, farmerTab, analyticsTab];
  else if (role === 'Area Manager')              navItems = [homeTab, regTab, mapTab, farmerTab, analyticsTab];
  else if (role === 'District Manager')          navItems = [homeTab, regTab, mapTab, analyticsTab, hierarchyTab, farmerTab];
  else if (role === 'State Manager')             navItems = [homeTab, regTab, mapTab, analyticsTab, inventoryQRTab, hierarchyTab, farmerTab];
  else navItems = [homeTab, regTab, mapTab, analyticsTab, inventoryQRTab, hierarchyTab, codeTab, farmerTab];

  // On mobile show at most 5 items in bottom bar; rest go to hamburger
  const BOTTOM_MAX = 5;
  const bottomItems = navItems.slice(0, BOTTOM_MAX);
  const overflowItems = navItems.slice(BOTTOM_MAX);

  const TAB_COLORS: Record<string, { text: string; bg: string; grad: string }> = {
    emerald: { text: 'text-emerald-500', bg: 'bg-emerald-50',   grad: 'from-emerald-500 to-teal-500' },
    sky:     { text: 'text-sky-500',     bg: 'bg-sky-50',       grad: 'from-sky-500 to-blue-500' },
    blue:    { text: 'text-blue-500',    bg: 'bg-blue-50',      grad: 'from-blue-500 to-cyan-500' },
    violet:  { text: 'text-violet-500',  bg: 'bg-violet-50',    grad: 'from-violet-500 to-purple-500' },
    amber:   { text: 'text-amber-500',   bg: 'bg-amber-50',     grad: 'from-amber-500 to-orange-500' },
    teal:    { text: 'text-teal-500',    bg: 'bg-teal-50',      grad: 'from-teal-500 to-emerald-500' },
    indigo:  { text: 'text-indigo-500',  bg: 'bg-indigo-50',    grad: 'from-indigo-500 to-blue-500' },
    slate:   { text: 'text-slate-500',   bg: 'bg-slate-100',    grad: 'from-slate-500 to-slate-600' },
  };

  const DESKTOP_GRAD: Record<string, string> = {
    emerald: 'from-emerald-500 to-teal-500',
    sky:     'from-sky-500 to-blue-500',
    blue:    'from-blue-500 to-cyan-500',
    violet:  'from-violet-500 to-purple-500',
    amber:   'from-amber-500 to-orange-500',
    teal:    'from-teal-500 to-emerald-500',
    indigo:  'from-indigo-500 to-blue-500',
    slate:   'from-slate-500 to-slate-600',
  };

  const handleTab = (id: string) => {
    setActiveTab(id);
    setMobileMenuOpen(false);
  };

  return (
    <>
      {/* ── TOP HEADER ── */}
      <header
        className={`bg-[#0a0f0d] text-white sticky top-0 z-40 transition-all duration-300 ${
          scrolled ? 'shadow-2xl shadow-black/40 border-b border-white/5' : 'border-b border-white/[0.06]'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* ── TOP ROW: Brand + Controls ── */}
          <div className="flex items-center justify-between h-[56px] sm:h-[60px] gap-3">

            {/* Logo */}
            <button
              onClick={() => handleTab('home')}
              className="flex items-center gap-2.5 group shrink-0 cursor-pointer"
            >
              <div className="relative">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-lime-400 flex items-center justify-center shadow-lg shadow-emerald-900/50 group-hover:shadow-emerald-600/40 transition-all duration-300 group-hover:scale-105">
                  <Sprout className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full border-2 border-[#0a0f0d] animate-pulse" />
              </div>
              <div className="leading-tight">
                <div className="font-black text-[12px] sm:text-sm tracking-tight text-white flex items-center gap-1">
                  <span>AWD Pipe</span> <span className="text-emerald-400">Registry</span>
                </div>
                <div className="hidden sm:block text-xs text-emerald-400/90 font-extrabold uppercase tracking-wider">
                  Dr. Reddy's Foundation
                </div>
              </div>
            </button>

            {/* Desktop nav — center (hidden on mobile) */}
            <nav className="hidden lg:flex items-center flex-1 justify-center min-w-0 overflow-hidden">
              <div className="flex items-center gap-0.5 bg-white/[0.04] border border-white/[0.06] rounded-2xl p-1 overflow-x-auto no-scrollbar max-w-full">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  const grad = DESKTOP_GRAD[item.color ?? 'emerald'];
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleTab(item.id)}
                      className={`relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap shrink-0 ${
                        isActive
                          ? 'text-white'
                          : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
                      }`}
                    >
                      {isActive && (
                        <span className={`absolute inset-0 rounded-xl bg-gradient-to-r ${grad} opacity-90`} />
                      )}
                      <Icon className={`relative w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                      <span className="relative">{item.label}</span>
                      {item.badge && (
                        <span className={`relative text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md ${
                          isActive ? 'bg-black/20 text-white/90' : 'bg-emerald-950 text-emerald-400'
                        }`}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </nav>

            {/* Right controls */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* Online/Offline indicator */}
              <button
                onClick={onOpenSyncModal}
                aria-label="View Offline Sync Queue"
                className={`flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  offlineQueueCount > 0
                    ? 'bg-amber-950/40 text-amber-400 border-amber-500/30 animate-pulse'
                    : isOnline
                    ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/20'
                    : 'bg-rose-950/40 text-rose-400 border-rose-500/20'
                }`}
                title="View Offline Sync Queue"
              >
                {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">
                  {isOnline ? 'Online' : 'Offline'}
                </span>
                {offlineQueueCount > 0 && (
                  <span className="bg-amber-500 text-amber-950 px-1 rounded font-mono text-[9px] font-extrabold ml-0.5 animate-pulse">
                    {offlineQueueCount}
                  </span>
                )}
              </button>

              {onOpenGenerateModal && (role === 'Admin' || role === 'State Manager') && (
                <button
                  onClick={onOpenGenerateModal}
                  className="hidden sm:flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs px-3 py-1.5 rounded-xl transition-all shadow-lg shadow-emerald-900/30 active:scale-95 border border-emerald-400/20 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Mint QR</span>
                </button>
              )}

              <UserProfileBadge currentUser={currentUser} onLogout={onLogout} />

              {/* Mobile hamburger — only shows "more" items that overflow bottom bar */}
              {overflowItems.length > 0 && (
                <button
                  className="lg:hidden p-2 rounded-xl hover:bg-white/10 transition min-w-[36px] min-h-[36px] flex items-center justify-center"
                  onClick={() => setMobileMenuOpen(v => !v)}
                  aria-label="More navigation items"
                >
                  {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Mobile Overflow Drawer ── */}
        {mobileMenuOpen && overflowItems.length > 0 && (
          <div className="lg:hidden border-t border-white/[0.06] py-2 px-4 animate-fadeIn bg-[#0d1411]">
            <div className="space-y-1">
              {overflowItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                const grad = DESKTOP_GRAD[item.color ?? 'emerald'];
                return (
                  <button
                    key={item.id}
                    onClick={() => handleTab(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-3 rounded-xl text-sm font-semibold transition cursor-pointer min-h-[48px] ${
                      isActive
                        ? `bg-gradient-to-r ${grad} text-white shadow-md`
                        : 'text-slate-400 hover:bg-white/[0.06] hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                      {item.badge && (
                        <span className="text-xs font-mono bg-black/20 px-1.5 py-0.5 rounded-md">{item.badge}</span>
                      )}
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 opacity-40" />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </header>

      {/* ── MOBILE BOTTOM TAB BAR (visible only on mobile/tablet < lg) ── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0a0f0d] border-t border-white/10 shadow-2xl shadow-black/50"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-stretch">
          {bottomItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const colors = TAB_COLORS[item.color ?? 'emerald'];
            return (
              <button
                key={item.id}
                onClick={() => handleTab(item.id)}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 transition-all cursor-pointer relative min-h-[56px] ${
                  isActive ? 'opacity-100' : 'hover:bg-white/[0.04]'
                }`}
              >
                {isActive && (
                  <span className={`absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r ${colors.grad} rounded-b-full`} />
                )}
                <div className={`relative p-1.5 rounded-xl transition-all ${isActive ? `${colors.bg} ${colors.text}` : 'text-slate-400'}`}>
                  <Icon className="w-5 h-5" />
                  {item.badge && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 text-white rounded-full text-[8px] font-extrabold flex items-center justify-center">
                      {item.badge.length > 3 ? '…' : item.badge}
                    </span>
                  )}
                </div>
                <span className={`text-xs font-bold tracking-wide ${isActive ? colors.text : 'text-slate-400'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}

          {/* "More" button if overflow exists */}
          {overflowItems.length > 0 && (
            <button
              onClick={() => setMobileMenuOpen(v => !v)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 transition-all cursor-pointer min-h-[56px] ${
                mobileMenuOpen || overflowItems.some(i => i.id === activeTab) ? 'opacity-100' : 'hover:bg-white/[0.04]'
              }`}
            >
              <div className={`p-1.5 rounded-xl ${mobileMenuOpen ? 'bg-slate-800 text-white' : 'text-slate-400'}`}>
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </div>
              <span className="text-xs font-bold tracking-wide text-slate-400">More</span>
            </button>
          )}
        </div>
      </nav>

      {/* ── Spacer so content doesn't hide behind bottom nav on mobile ── */}
      <div className="lg:hidden h-[60px]" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }} />
    </>
  );
};
