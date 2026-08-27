import React from 'react';
import { Sprout } from 'lucide-react';

/**
 * AppLoadingScreen — rendered while React lazy chunks are downloading.
 *
 * IMPORTANT: This component uses BOTH Tailwind className AND inline style fallbacks.
 * On slow 3G mobile, the external 179 KB CSS file may not have arrived yet when
 * this component first mounts. Inline styles guarantee correct rendering even
 * before CSS is parsed — preventing the blank white screen on low-end devices.
 */
export const AppLoadingScreen: React.FC = () => (
  <div
    className="min-h-screen bg-[#060d09] flex flex-col items-center justify-center p-6"
    style={{ minHeight: '100vh', background: '#060d09', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}
  >
    <div className="relative mb-8" style={{ position: 'relative', marginBottom: '2rem' }}>
      <div
        className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-lime-400 flex items-center justify-center shadow-xl shadow-emerald-900/50 animate-pulse"
        style={{ width: '4rem', height: '4rem', borderRadius: '1rem', background: 'linear-gradient(to top right, #059669, #0d9488, #84cc16)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <Sprout className="w-9 h-9 text-white" style={{ width: '2.25rem', height: '2.25rem', color: '#fff' }} />
      </div>
      {/* Spinner ring */}
      <span
        className="absolute -bottom-1 -right-1 w-4 h-4 border-2 border-[#060d09] border-t-emerald-400 rounded-full animate-spin"
        style={{ position: 'absolute', bottom: '-0.25rem', right: '-0.25rem', width: '1rem', height: '1rem', borderRadius: '9999px', border: '2px solid #060d09', borderTopColor: '#34d399', animation: 'spin 0.75s linear infinite' }}
      />
    </div>

    <h1
      className="text-white font-black text-xl tracking-tight mb-1"
      style={{ color: '#fff', fontWeight: 900, fontSize: '1.25rem', marginBottom: '0.25rem', letterSpacing: '-0.025em' }}
    >
      AWD Pipe Registry
    </h1>
    <p
      className="text-slate-500 text-sm mb-10"
      style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '2.5rem' }}
    >
      Loading field data…
    </p>

    {/* Skeleton placeholders */}
    <div className="w-full max-w-sm space-y-3" style={{ width: '100%', maxWidth: '24rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div
        className="skeleton h-12 rounded-2xl opacity-60"
        style={{ height: '3rem', borderRadius: '1rem', background: 'linear-gradient(90deg, #1e293b 25%, #334155 50%, #1e293b 75%)', backgroundSize: '200% 100%', opacity: 0.6 }}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div
          className="skeleton h-20 rounded-2xl opacity-50"
          style={{ height: '5rem', borderRadius: '1rem', background: 'linear-gradient(90deg, #1e293b 25%, #334155 50%, #1e293b 75%)', backgroundSize: '200% 100%', opacity: 0.5 }}
        />
        <div
          className="skeleton h-20 rounded-2xl opacity-50"
          style={{ height: '5rem', borderRadius: '1rem', background: 'linear-gradient(90deg, #1e293b 25%, #334155 50%, #1e293b 75%)', backgroundSize: '200% 100%', opacity: 0.5 }}
        />
      </div>
      <div
        className="skeleton h-32 rounded-2xl opacity-40"
        style={{ height: '8rem', borderRadius: '1rem', background: 'linear-gradient(90deg, #1e293b 25%, #334155 50%, #1e293b 75%)', backgroundSize: '200% 100%', opacity: 0.4 }}
      />
    </div>
  </div>
);

