import React from 'react';
import { Smartphone, BarChart3, Box, Printer, Code2, Sprout, MapPin, Plus, Sparkles, ClipboardCheck } from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activePipeId: string;
  onOpenGenerateModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, activePipeId, onOpenGenerateModal }) => {
  const navItems = [
    { id: 'mobile', label: 'Registration & Operations', icon: ClipboardCheck, badge: activePipeId ? activePipeId : undefined },
    { id: 'map', label: 'Interactive Map View', icon: MapPin },
    { id: 'dashboard', label: 'Analytics Dashboard', icon: BarChart3 },
    { id: 'inventory', label: 'Pipe Inventory', icon: Box },
    { id: 'labels', label: 'Print QR Labels', icon: Printer },
    { id: 'code', label: 'Google Apps Script', icon: Code2 },
  ];

  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* BRAND TOP ROW */}
        <div className="flex items-center justify-between h-16 border-b border-slate-800/80">
          
          {/* Logo & Title */}
          <div
            onClick={() => setActiveTab('mobile')}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#2d4a2d] via-emerald-600 to-[#88b04b] flex items-center justify-center text-white shadow-md shadow-emerald-950/50 group-hover:scale-105 transition-transform">
              <Sprout className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight text-white uppercase">
                  AWD Pipe Registry
                </span>
                <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold px-2 py-0.5 rounded-md border border-emerald-500/20">
                  Field Operations
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                Alternate Wetting & Drying Water Tracking Platform
              </p>
            </div>
          </div>

          {/* Top Right Action Button */}
          {onOpenGenerateModal && (
            <button
              onClick={onOpenGenerateModal}
              className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl transition shadow-md shadow-emerald-950/30 flex items-center gap-1.5 uppercase tracking-wider border border-emerald-400/40 cursor-pointer"
            >
              <Plus className="w-4 h-4 text-emerald-200" />
              <span>Mint QR Batch</span>
            </button>
          )}

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

