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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 4);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const homeTab: NavItem       = { id: 'home',      label: 'Home',            icon: Home,           color: 'emerald' };
  const regTab: NavItem       = { id: 'mobile',    label: 'Register',        icon: ClipboardCheck, badge: activePipeId || undefined, color: 'sky' };
  const mapTab: NavItem       = { id: 'map',        label: 'Field Map',       icon: MapPin,         color: 'blue' };
  const analyticsTab: NavItem = { id: 'analytics',  label: 'Analytics',       icon: BarChart3,      color: 'violet' };
  const inventoryQRTab: NavItem={ id: 'inventory',  label: 'Inventory',       icon: Box,            color: 'amber' };
  const hierarchyTab: NavItem = { id: 'hierarchy',  label: 'Team Admin',      icon: Network,        color: 'teal' };
  const farmerTab: NavItem    = { id: 'farmers',    label: 'Farmers',         icon: Users,          color: 'indigo' };
  const codeTab: NavItem      = { id: 'code',       label: 'Dev Tools',       icon: Code2,          color: 'slate' };

  let navItems: NavItem[] = [];
  if (role === 'CF' || role === 'JCF')           navItems = [homeTab, regTab, farmerTab, analyticsTab];
  else if (role === 'Area Manager')              navItems = [homeTab, regTab, mapTab, farmerTab, analyticsTab];
  else if (role === 'District Manager')          navItems = [homeTab, regTab, mapTab, analyticsTab, hierarchyTab, farmerTab];
  else if (role === 'State Manager')             navItems = [homeTab, regTab, mapTab, analyticsTab, inventoryQRTab, hierarchyTab, farmerTab];
  else navItems = [homeTab, regTab, mapTab, analyticsTab, inventoryQRTab, hierarchyTab, codeTab, farmerTab];

  const activeItem = navItems.find(i => i.id === activeTab);

  const TAB_COLORS: Record<string, string> = {
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
    setMobileOpen(false);
  };

  return (
    <header
      className={`bg-[#0a0f0d] text-white sticky top-0 z-40 transition-all duration-300 ${
        scrolled ? 'shadow-2xl shadow-black/40 border-b border-white/5' : 'border-b border-white/[0.06]'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* ── TOP ROW: Brand + Controls ── */}
        <div className="flex items-center justify-between h-[60px] gap-4">

          {/* Logo */}
          <button
            onClick={() => handleTab('home')}
            className="flex items-center gap-3 group shrink-0 cursor-pointer"
          >
            <div className="relative">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-lime-400 flex items-center justify-center shadow-lg shadow-emerald-900/50 group-hover:shadow-emerald-600/40 transition-all duration-300 group-hover:scale-105">
                <Sprout className="w-5 h-5 text-white" />
              </div>
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-[#0a0f0d] animate-pulse" />
            </div>
            <div className="hidden sm:block leading-tight">
              <div className="font-black text-[13px] tracking-tight text-white flex items-center gap-1.5">
                <span>AWD Pipe</span> <span className="text-emerald-400">Registry</span>
              </div>
              <div className="text-[9.5px] text-emerald-400/90 font-extrabold uppercase tracking-wider">
                Dr. Reddy's Foundation
              </div>
            </div>
          </button>

          {/* Desktop nav — center */}
          <nav className="hidden lg:flex items-center flex-1 justify-center min-w-0 overflow-hidden">
            <div className="flex items-center gap-0.5 bg-white/[0.04] border border-white/[0.06] rounded-2xl p-1 overflow-x-auto no-scrollbar max-w-full">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                const grad = TAB_COLORS[item.color ?? 'emerald'];
                return (
                  <button
                    key={item.id}
                    onClick={() => handleTab(item.id)}
                    className={`relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap shrink-0 ${
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
          <div className="flex items-center gap-2 shrink-0">
            {/* Connectivity Status Indicator */}
            <button
              onClick={onOpenSyncModal}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-bold border transition-all cursor-pointer ${
                offlineQueueCount > 0
                  ? 'bg-amber-950/40 text-amber-400 border-amber-500/30 animate-pulse'
                  : isOnline
                  ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/20'
                  : 'bg-rose-950/40 text-rose-400 border-rose-500/20'
              }`}
              title="View Offline Sync Queue"
            >
              {isOnline ? (
                <Wifi className="w-3.5 h-3.5" />
              ) : (
                <WifiOff className="w-3.5 h-3.5" />
              )}
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
                className="hidden sm:flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-[11px] px-3 py-1.5 rounded-xl transition-all shadow-lg shadow-emerald-900/30 active:scale-95 border border-emerald-400/20 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Mint QR</span>
              </button>
            )}
            <UserProfileBadge currentUser={currentUser} onLogout={onLogout} />
            {/* Mobile hamburger */}
            <button
              className="lg:hidden p-2 rounded-xl hover:bg-white/10 transition"
              onClick={() => setMobileOpen(v => !v)}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* ── Mobile Nav Drawer ── */}
        {mobileOpen && (
          <div className="lg:hidden border-t border-white/[0.06] py-3 animate-fadeIn">
            <div className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                const grad = TAB_COLORS[item.color ?? 'emerald'];
                return (
                  <button
                    key={item.id}
                    onClick={() => handleTab(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-3 rounded-xl text-sm font-semibold transition cursor-pointer ${
                      isActive
                        ? `bg-gradient-to-r ${grad} text-white shadow-md`
                        : 'text-slate-400 hover:bg-white/[0.06] hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                      {item.badge && (
                        <span className="text-[10px] font-mono bg-black/20 px-1.5 py-0.5 rounded-md">{item.badge}</span>
                      )}
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 opacity-40" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Mobile current tab pill (visible on tablet, hidden on lg) ── */}
        {!mobileOpen && (
          <div className="lg:hidden overflow-x-auto no-scrollbar pb-2">
            <div className="flex items-center gap-1 min-w-max">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                const grad = TAB_COLORS[item.color ?? 'emerald'];
                return (
                  <button
                    key={item.id}
                    onClick={() => handleTab(item.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition cursor-pointer ${
                      isActive
                        ? `bg-gradient-to-r ${grad} text-white shadow-md`
                        : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {item.label}
                    {item.badge && (
                      <span className="text-[9px] font-mono bg-black/20 px-1 rounded">{item.badge}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </header>
  );
};
