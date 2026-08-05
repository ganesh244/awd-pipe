import React from 'react';
import { Sprout } from 'lucide-react';

export const AppLoadingScreen: React.FC = () => (
  <div className="min-h-screen bg-[#060d09] flex flex-col items-center justify-center p-6">
    <div className="relative mb-8">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-lime-400 flex items-center justify-center shadow-xl shadow-emerald-900/50 animate-pulse">
        <Sprout className="w-9 h-9 text-white" />
      </div>
      <span className="absolute -bottom-1 -right-1 w-4 h-4 border-2 border-[#060d09] border-t-emerald-400 rounded-full animate-spin" />
    </div>

    <h1 className="text-white font-black text-xl tracking-tight mb-1">AWD Pipe Registry</h1>
    <p className="text-slate-500 text-sm mb-10">Loading field data…</p>

    <div className="w-full max-w-sm space-y-3">
      <div className="skeleton h-12 rounded-2xl opacity-60" />
      <div className="grid grid-cols-2 gap-3">
        <div className="skeleton h-20 rounded-2xl opacity-50" />
        <div className="skeleton h-20 rounded-2xl opacity-50" />
      </div>
      <div className="skeleton h-32 rounded-2xl opacity-40" />
    </div>
  </div>
);
