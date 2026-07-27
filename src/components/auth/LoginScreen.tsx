import React, { useState } from 'react';
import { User, UserRole } from '../../types';
import { Sprout, Eye, EyeOff, AlertCircle, ShieldCheck, MapPin, Building2, Map, Users } from 'lucide-react';

interface LoginScreenProps {
  users: User[];
  onLogin: (user: User) => void;
}

const ROLE_STYLE: Record<UserRole, { border: string; badge: string; icon: React.FC<any>; glow: string }> = {
  'Admin':            { border: 'border-purple-500',  badge: 'bg-purple-600',  icon: ShieldCheck, glow: 'shadow-purple-500/30' },
  'State Manager':    { border: 'border-amber-500',   badge: 'bg-amber-600',   icon: MapPin,      glow: 'shadow-amber-500/30' },
  'District Manager': { border: 'border-blue-500',    badge: 'bg-blue-600',    icon: Building2,   glow: 'shadow-blue-500/30' },
  'Area Manager':     { border: 'border-teal-500',    badge: 'bg-teal-600',    icon: Map,         glow: 'shadow-teal-500/30' },
  'CF':               { border: 'border-emerald-500', badge: 'bg-emerald-600', icon: Users,       glow: 'shadow-emerald-500/30' },
  'JCF':              { border: 'border-lime-500',    badge: 'bg-lime-600',    icon: Users,       glow: 'shadow-lime-500/30' },
};

export const LoginScreen: React.FC<LoginScreenProps> = ({ users, onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const found = users.find(
      (u) => u.username === username.trim() && u.password === password && u.isActive
    );
    if (found) {
      onLogin(found);
    } else {
      setError('Invalid credentials or account inactive. Check username & password.');
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  };

  const quickLogin = (user: User) => {
    onLogin(user);
  };

  // Sample credentials panel — show only a subset for demo clarity
  const demoUsers = users.filter(u =>
    ['usr-admin', 'usr-sm-1', 'usr-dm-1', 'usr-am-1', 'usr-cf-1', 'usr-jcf-1'].includes(u.id)
  );

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">

      {/* Background blobs */}
      <div className="absolute -top-48 -left-48 w-96 h-96 rounded-full bg-emerald-600/15 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-48 -right-48 w-96 h-96 rounded-full bg-purple-600/15 blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-teal-600/5 blur-3xl pointer-events-none" />

      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-start relative z-10">

        {/* LEFT: Branding + Login Form */}
        <div className="space-y-6">

          {/* Brand */}
          <div className="space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-700 via-teal-500 to-lime-400 flex items-center justify-center shadow-xl shadow-emerald-900/50">
              <Sprout className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tight uppercase">AWD Pipe Registry</h1>
              <p className="text-slate-400 text-sm mt-1">
                Multi-State Field Operations Platform — Secure Role Login
              </p>
            </div>
          </div>

          {/* Login Card */}
          <div
            className={`bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 transition-all duration-200 ${
              shake ? 'translate-x-2' : ''
            }`}
          >
            <h2 className="text-white font-extrabold text-lg">Sign In to Your Account</h2>

            {error && (
              <div className="bg-red-900/30 border border-red-700/50 text-red-300 rounded-xl p-3 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                  Username / ID
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); setError(null); }}
                  placeholder="e.g. cf_rajesh"
                  required
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder-slate-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(null); }}
                    placeholder="Enter your password"
                    required
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 pr-12 text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder-slate-500 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition p-1"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold py-3.5 rounded-xl text-sm transition shadow-lg shadow-emerald-900/40 active:scale-[0.98] mt-2"
              >
                Login to AWD Portal
              </button>
            </form>

            <p className="text-xs text-slate-500 text-center">
              Credentials are assigned by your District Manager or Admin.
              <br />Contact your supervisor if you need access.
            </p>
          </div>
        </div>

        {/* RIGHT: Quick Demo Login Cards */}
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-1">
              Demo Quick Access
            </h3>
            <p className="text-xs text-slate-500">
              Click any card to instantly login as that role and explore scoped data views.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {demoUsers.map((user) => {
              const style = ROLE_STYLE[user.role];
              const Icon = style.icon;
              return (
                <button
                  key={user.id}
                  onClick={() => quickLogin(user)}
                  className={`text-left p-4 rounded-2xl border-2 bg-slate-900/70 hover:bg-slate-800 transition-all cursor-pointer group shadow-lg hover:shadow-xl ${style.border} ${style.glow} hover:scale-[1.02] active:scale-[0.98]`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg text-white ${style.badge}`}>
                      {user.role}
                    </span>
                    <Icon className="w-4 h-4 text-slate-400 group-hover:text-slate-200 transition" />
                  </div>
                  <div className="font-extrabold text-white text-sm leading-tight">{user.name}</div>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">@{user.username}</div>
                  <div className="text-[10px] text-slate-500 mt-2 space-y-0.5">
                    {user.state && <div>📍 {user.state}</div>}
                    {user.district && <div>🏛️ {user.district}</div>}
                    {user.areaName && <div>🗺️ {user.areaName}</div>}
                    {user.role === 'Admin' && <div>🌐 Global Access</div>}
                  </div>
                  <div className="mt-2 text-[10px] font-mono text-slate-600 bg-slate-800/80 rounded-lg px-2 py-1">
                    Pass: {user.password}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

      </div>

    </div>
  );
};
