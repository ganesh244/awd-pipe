import React from 'react';
import { BarChart3, Box, Printer, Code2, Sprout, MapPin, Plus, ClipboardCheck, Network, FileDown, Users } from 'lucide-react';
import { User } from '../types';
import { UserProfileBadge } from './UserProfileBadge';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activePipeId: string;
  currentUser: User;
  onLogout: () => void;
  onOpenGenerateModal?: () => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.FC<any>;
  badge?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  activePipeId,
  currentUser,
  onLogout,
  onOpenGenerateModal,
}) => {
  const role = currentUser.role;

  // Registration tab is available to everyone
  const regTab: NavItem = {
    id: 'mobile',
    label: 'Registration & Field Ops',
    icon: ClipboardCheck,
    badge: activePipeId || undefined,
  };

  // Map tab — CF/JCF and above
  const mapTab: NavItem = { id: 'map', label: 'Field Map View', icon: MapPin };

  // Analytics (Dashboard + Reports) — District Manager and above; CF/JCF/AM only get reports sub-tab
  const analyticsTab: NavItem = { id: 'analytics', label: 'Analytics & Reports', icon: BarChart3 };

  // Inventory & QR (Pipe Inventory + Print QR Labels) — State Manager and Admin
  const inventoryQRTab: NavItem = { id: 'inventory', label: 'Inventory & QR', icon: Box };

  // Hierarchy — District Manager and above
  const hierarchyTab: NavItem = { id: 'hierarchy', label: 'Team & Hierarchy', icon: Network };

  // Farmer Profiles — all roles
  const farmerProfilesTab: NavItem = { id: 'farmers', label: 'Farmer Profiles', icon: Users };

  // Code — Admin only
  const codeTab: NavItem = { id: 'code', label: 'Apps Script', icon: Code2 };

  let navItems: NavItem[] = [];

  if (role === 'CF' || role === 'JCF') {
    navItems = [regTab, farmerProfilesTab, analyticsTab];
  } else if (role === 'Area Manager') {
    navItems = [regTab, mapTab, farmerProfilesTab, analyticsTab];
  } else if (role === 'District Manager') {
    navItems = [regTab, mapTab, analyticsTab, hierarchyTab, farmerProfilesTab];
  } else if (role === 'State Manager') {
    navItems = [regTab, mapTab, analyticsTab, inventoryQRTab, hierarchyTab, farmerProfilesTab];
  } else {
    // Admin — full access
    navItems = [regTab, mapTab, analyticsTab, inventoryQRTab, hierarchyTab, codeTab, farmerProfilesTab];
  }

  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* BRAND TOP ROW */}
        <div className="flex items-center justify-between h-16 border-b border-slate-800/80 gap-3">

          {/* Logo & Title */}
          <div
            onClick={() => setActiveTab('mobile')}
            className="flex items-center gap-3 cursor-pointer group shrink-0"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#2d4a2d] via-emerald-600 to-[#88b04b] flex items-center justify-center text-white shadow-md shadow-emerald-950/50 group-hover:scale-105 transition-transform">
              <Sprout className="w-6 h-6 text-white" />
            </div>
            <div className="hidden sm:block">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight text-white uppercase">
                  AWD Pipe Registry
                </span>
                <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold px-2 py-0.5 rounded-md border border-emerald-500/20 hidden md:inline">
                  Field Ops
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                Alternate Wetting & Drying Management
              </p>
            </div>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-3">
            {onOpenGenerateModal && (role === 'Admin' || role === 'State Manager') && (
              <button
                onClick={onOpenGenerateModal}
                className="hidden sm:flex bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl transition shadow-md shadow-emerald-950/30 items-center gap-1.5 uppercase tracking-wider border border-emerald-400/40 cursor-pointer"
              >
                <Plus className="w-4 h-4 text-emerald-200" />
                <span>Mint QR Batch</span>
              </button>
            )}
            <UserProfileBadge currentUser={currentUser} onLogout={onLogout} />
          </div>
        </div>

        {/* SEGMENTED TAB CONTROLLER BAR */}
        <div className="py-2.5 overflow-x-auto no-scrollbar">
          <nav className="flex items-center gap-1.5 min-w-max p-1 bg-slate-950/80 rounded-2xl border border-slate-800/90 shadow-inner">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-900/50 border border-emerald-400/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-200' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span
                      className={`text-[10px] font-mono font-extrabold px-1.5 py-0.5 rounded-md border ${
                        isActive
                          ? 'bg-slate-950/60 text-emerald-200 border-emerald-400/40'
                          : 'bg-emerald-950 text-emerald-400 border-emerald-800'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

      </div>
    </header>
  );
};
