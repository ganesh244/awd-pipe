import React, { useState } from 'react';
import { User, UserRole } from '../../types';
import { Sprout, Eye, EyeOff, AlertCircle, ShieldCheck, MapPin, Building2, Map, Users, ArrowRight, Lock, AtSign, Droplets, BarChart3, Smartphone } from 'lucide-react';

interface LoginScreenProps {
  users: User[];
  onLogin: (user: User) => void;
}

const ROLE_CONFIG: Record<UserRole, { gradient: string; badge: string; glow: string; icon: React.FC<any> }> = {
  'Admin':            { gradient: 'from-purple-600 to-violet-700',  badge: 'bg-purple-600',  glow: 'shadow-purple-500/25',  icon: ShieldCheck },
  'State Manager':    { gradient: 'from-amber-500 to-orange-600',   badge: 'bg-amber-600',   glow: 'shadow-amber-500/25',   icon: MapPin },
  'District Manager': { gradient: 'from-blue-500 to-blue-700',      badge: 'bg-blue-600',    glow: 'shadow-blue-500/25',    icon: Building2 },
  'Area Manager':     { gradient: 'from-teal-500 to-emerald-600',   badge: 'bg-teal-600',    glow: 'shadow-teal-500/25',    icon: Map },
  'CF':               { gradient: 'from-emerald-500 to-green-600',  badge: 'bg-emerald-600', glow: 'shadow-emerald-500/25', icon: Users },
  'JCF':              { gradient: 'from-lime-500 to-green-500',     badge: 'bg-lime-600',    glow: 'shadow-lime-500/25',    icon: Users },
};

export const LoginScreen: React.FC<LoginScreenProps> = ({ users, onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await new Promise(r => setTimeout(r, 400)); // brief feedback delay
    const found = users.find(u => u.username === username.trim() && u.password === password && u.isActive);
    if (found) {
      onLogin(found);
    } else {
      setError('Invalid credentials or account inactive.');
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setLoading(false);
    }
  };

  const demoUsers = users.filter(u =>
    ['usr-admin', 'usr-sm-1', 'usr-dm-1', 'usr-am-1', 'usr-cf-1', 'usr-jcf-1'].includes(u.id)
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#060d09] relative overflow-hidden">

      {/* Animated background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-emerald-600/10 blur-3xl animate-pulse" />
        <div className="absolute top-1/3 right-0 w-80 h-80 rounded-full bg-teal-500/8 blur-3xl" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-0 left-1/3 w-72 h-72 rounded-full bg-lime-500/6 blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }} />
      </div>

      <div className="relative z-10 flex-1 flex flex-col lg:flex-row">

        {/* ── LEFT PANEL: Hero + Login ── */}
        <div className="flex-1 flex flex-col justify-center p-8 lg:p-16 max-w-xl mx-auto w-full lg:max-w-none lg:mx-0">

          {/* Brand */}
          <div className="mb-10 animate-fadeIn">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-lime-400 flex items-center justify-center shadow-xl shadow-emerald-900/50 animate-float">
                <Sprout className="w-7 h-7 text-white" />
              </div>
              <div>
                <div className="text-xs font-bold text-emerald-500 uppercase tracking-widest">Govt. of Telangana</div>
                <div className="text-white font-black text-xl tracking-tight">AWD Pipe Registry</div>
              </div>
            </div>
            <h1 className="text-4xl font-black text-white leading-tight">
              Field Operations<br />
              <span className="gradient-text">Management System</span>
            </h1>
            <p className="text-slate-400 text-sm mt-3 leading-relaxed">
              Alternate Wetting & Drying — Multi-state paddy water management platform for sustainable agriculture.
            </p>

            {/* Feature pills */}
            <div className="flex flex-wrap gap-2 mt-5">
              {[
                { icon: Droplets, text: 'AWD Monitoring' },
                { icon: Smartphone, text: 'Mobile Field Ops' },
                { icon: BarChart3, text: 'Live Analytics' },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-full px-3 py-1.5 text-xs text-slate-300 font-medium">
                  <Icon className="w-3 h-3 text-emerald-400" />
                  {text}
                </div>
              ))}
            </div>
          </div>

          {/* Login Card */}
          <div
            className={`bg-white/[0.05] border border-white/[0.09] rounded-3xl p-7 backdrop-blur-sm shadow-2xl transition-all duration-200 animate-slideUp ${
              shake ? 'translate-x-2' : ''
            }`}
          >
            <div className="flex items-center gap-2 mb-6">
              <Lock className="w-4 h-4 text-emerald-400" />
              <h2 className="text-white font-extrabold text-lg">Secure Sign In</h2>
            </div>

            {error && (
              <div className="flex items-center gap-2.5 bg-red-500/10 border border-red-500/20 text-red-300 rounded-xl px-4 py-3 text-xs font-medium mb-5">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                  Username
                </label>
                <div className="relative">
                  <AtSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => { setUsername(e.target.value); setError(null); }}
                    placeholder="e.g. cf_rajesh"
                    required
                    className="w-full bg-white/[0.06] border border-white/[0.12] text-white rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 placeholder-slate-600 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(null); }}
                    placeholder="Enter your password"
                    required
                    className="w-full bg-white/[0.06] border border-white/[0.12] text-white rounded-xl pl-10 pr-12 py-3 text-sm focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 placeholder-slate-600 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition p-1"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full relative bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-60 text-white font-extrabold py-3.5 rounded-xl text-sm transition-all shadow-lg shadow-emerald-900/40 active:scale-[0.98] flex items-center justify-center gap-2 mt-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign In to AWD Portal
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <p className="text-[11px] text-slate-600 text-center mt-5 leading-relaxed">
              Credentials assigned by your District Manager or Admin.<br />
              Contact your supervisor if you need access.
            </p>
          </div>
        </div>

        {/* ── RIGHT PANEL: Demo Quick Access ── */}
        <div className="flex-1 flex flex-col justify-center p-8 lg:p-12 lg:border-l lg:border-white/[0.05] lg:max-w-lg">
          <div className="mb-6 animate-fadeIn">
            <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1.5 mb-3">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-emerald-400 text-[11px] font-bold uppercase tracking-wider">Demo Mode</span>
            </div>
            <h3 className="text-white font-black text-xl">Quick Role Access</h3>
            <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">
              Click any card below to instantly sign in as that role and explore role-scoped data views.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-slideUp">
            {demoUsers.map((user, i) => {
              const cfg = ROLE_CONFIG[user.role];
              const Icon = cfg.icon;
              return (
                <button
                  key={user.id}
                  onClick={() => onLogin(user)}
                  className={`group text-left p-4 rounded-2xl border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] hover:shadow-xl ${cfg.glow} hover:border-white/[0.15]`}
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${cfg.gradient} flex items-center justify-center shadow-md`}>
                      <Icon className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg text-white ${cfg.badge}`}>
                      {user.role}
                    </span>
                  </div>
                  <div className="font-extrabold text-white text-sm leading-tight">{user.name}</div>
                  <div className="text-[11px] text-slate-500 font-mono mt-0.5">@{user.username}</div>
                  <div className="text-[10px] text-slate-600 mt-2 space-y-0.5">
                    {user.state && <div className="flex items-center gap-1"><MapPin className="w-2.5 h-2.5" />{user.state}</div>}
                    {user.district && <div>{user.district}</div>}
                    {user.role === 'Admin' && <div className="text-emerald-600">🌐 Global Access</div>}
                  </div>
                  <div className="mt-2.5 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-600 bg-white/[0.05] rounded-md px-2 py-0.5 border border-white/[0.05]">
                      🔑 {user.password}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </button>
              );
            })}
          </div>

          <p className="text-[10px] text-slate-700 text-center mt-6">
            This is a demonstration environment. Data resets periodically.
          </p>
        </div>

      </div>

      {/* Footer */}
      <div className="relative z-10 border-t border-white/[0.05] py-4 px-8 flex items-center justify-between text-[10px] text-slate-700">
        <span>© 2025 AWD Pipe Registry · Govt. of Telangana</span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
          System Online
        </span>
      </div>
    </div>
  );
};
