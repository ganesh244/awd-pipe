import React, { useState } from 'react';
import { User, UserRole } from '../../types';
import { Sprout, Eye, EyeOff, AlertCircle, ShieldCheck, MapPin, Building2, Map, Users, ArrowRight, Lock, AtSign, Droplets, BarChart3, Smartphone } from 'lucide-react';

interface LoginScreenProps {
  users: User[];
  onLogin: (user: User) => void;
}

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
    await new Promise(r => setTimeout(r, 400));
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

  return (
    <div className="min-h-screen flex flex-col bg-[#060d09] relative overflow-hidden">

      {/* Animated background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-emerald-600/10 blur-3xl animate-pulse" />
        <div className="absolute top-1/3 right-0 w-80 h-80 rounded-full bg-teal-500/8 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 w-72 h-72 rounded-full bg-lime-500/6 blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }} />
      </div>

      <div className="relative z-10 flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">

          {/* Brand */}
          <div className="mb-10 text-center animate-fadeIn">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-lime-400 flex items-center justify-center shadow-xl shadow-emerald-900/50 animate-float">
                <Sprout className="w-8 h-8 text-white" />
              </div>
            </div>
            <div className="text-white font-black text-2xl tracking-tight">AWD Pipe Registry</div>
            <div className="text-slate-400 text-sm mt-2 leading-relaxed">
              Alternate Wetting &amp; Drying — Field Operations Platform
            </div>

            {/* Feature pills */}
            <div className="flex flex-wrap justify-center gap-2 mt-4">
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
                    placeholder="Enter your username"
                    required
                    autoComplete="username"
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
                    autoComplete="current-password"
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
      </div>

      {/* Footer */}
      <div className="relative z-10 border-t border-white/[0.05] py-4 px-8 flex items-center justify-between text-[10px] text-slate-700">
        <span>© 2025 AWD Pipe Registry</span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
          System Online
        </span>
      </div>
    </div>
  );
};
