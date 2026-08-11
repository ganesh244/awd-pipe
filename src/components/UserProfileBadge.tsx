import React from 'react';
import { User } from '../types';
import { LogOut } from 'lucide-react';

interface UserProfileBadgeProps {
  currentUser: User;
  onLogout: () => void;
}

export const UserProfileBadge: React.FC<UserProfileBadgeProps> = ({ currentUser, onLogout }) => {
  const roleColors: Record<string, string> = {
    'Admin': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    'State Manager': 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    'District Manager': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    'Area Manager': 'bg-teal-500/20 text-teal-300 border-teal-500/30',
    'CF': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    'JCF': 'bg-lime-500/20 text-lime-300 border-lime-500/30',
  };

  const badgeClass = roleColors[currentUser.role] || 'bg-slate-700 text-slate-200';

  return (
    <div className="flex items-center gap-3 bg-slate-800/90 border border-slate-700 px-3 py-1.5 rounded-2xl">
      <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white font-black text-xs shadow-sm">
        {currentUser.name.charAt(0)}
      </div>

      <div className="hidden sm:block text-left">
        <div className="flex items-center gap-2">
          <span className="text-xs font-extrabold text-white leading-none">
            {currentUser.name}
          </span>
          <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md border ${badgeClass}`}>
            {currentUser.role}
          </span>
        </div>
        <p className="text-xs text-slate-400 font-medium leading-tight mt-0.5">
          {currentUser.areaName ? `${currentUser.areaName}, ${currentUser.district}` : currentUser.district ? `${currentUser.district}, ${currentUser.state}` : currentUser.state || 'Global Admin'}
        </p>
      </div>

      <button
        onClick={onLogout}
        title="Logout / Switch User"
        aria-label="Logout"
        className="p-1.5 hover:bg-slate-700 rounded-xl text-slate-400 hover:text-red-400 transition cursor-pointer"
      >
        <LogOut className="w-4 h-4" />
      </button>
    </div>
  );
};
