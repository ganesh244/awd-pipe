import React, { useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import { AWDPipe, Installation } from '../types';
import { X, Search, AlertTriangle, ArrowRight, ShieldAlert, PackageX, Check } from 'lucide-react';
import { useDialog } from '../hooks/useDialog';

interface ReplacePipeModalProps {
  oldPipe: AWDPipe;
  installation: Installation;
  availablePipes: AWDPipe[];
  onClose: () => void;
  onReplace: (oldPipeId: string, newPipeId: string, reason: 'Damaged' | 'Stolen') => Promise<{ ok: boolean; error?: string }>;
}

/**
 * Swap a farmer's damaged or stolen pipe for a fresh one from inventory.
 * The farmer's data is carried onto the new pipe by the server; the old pipe
 * moves to the Damaged/Removed section and stays as history.
 */
export const ReplacePipeModal: React.FC<ReplacePipeModalProps> = ({ oldPipe, installation, availablePipes, onClose, onReplace }) => {
  const { dialogProps } = useDialog({ onClose, label: 'Replace pipe' });
  const [reason, setReason] = useState<'Damaged' | 'Stolen'>('Damaged');
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = availablePipes.filter((p) => p.Pipe_ID !== oldPipe.Pipe_ID);
    return (q ? list.filter((p) => p.Pipe_ID.toLowerCase().includes(q)) : list).slice(0, 40);
  }, [availablePipes, query, oldPipe.Pipe_ID]);

  const submit = async () => {
    if (!chosen) { setError('Choose a replacement pipe from inventory.'); return; }
    setBusy(true); setError(null);
    const r = await onReplace(oldPipe.Pipe_ID, chosen, reason);
    setBusy(false);
    if (r.ok) onClose();
    else setError(r.error || 'Replacement failed.');
  };

  const btn = 'inline-flex items-center justify-center gap-1.5 font-bold transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl min-h-[44px] text-sm px-4';

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        {...dialogProps}
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92dvh]"
      >
        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">Replace pipe</h3>
            <p className="text-xs text-slate-500">Keep the farmer, swap the pipe</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className={`${btn} min-w-[44px] px-0 text-slate-500 hover:bg-slate-100`}><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Farmer + old pipe context */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-semibold">Farmer</span>
              <strong className="text-slate-900">{installation.Farmer_Name}</strong>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-slate-500 font-semibold">Old pipe</span>
              <code className="font-mono font-bold text-slate-900">{oldPipe.Pipe_ID}</code>
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Why is it being replaced?</label>
            <div className="grid grid-cols-2 gap-2">
              {([['Damaged', ShieldAlert], ['Stolen', PackageX]] as const).map(([r, Icon]) => (
                <button
                  key={r} type="button" onClick={() => setReason(r)}
                  className={`flex items-center gap-2 rounded-2xl border px-3 min-h-[52px] text-left transition active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 ${reason === r ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                >
                  <Icon className={`w-4 h-4 ${reason === r ? 'text-emerald-700' : 'text-slate-400'}`} />
                  <span className="text-sm font-bold text-slate-900">{r === 'Stolen' ? 'Stolen / Missing' : 'Damaged'}</span>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">
              The old pipe moves to the <strong>{reason === 'Stolen' ? 'Removed' : 'Damaged'}</strong> section and is kept as history.
            </p>
          </div>

          {/* New pipe picker */}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">New pipe from inventory ({availablePipes.length} available)</label>
            {availablePipes.length === 0 ? (
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0" /> No available pipes in inventory. Generate or free up a pipe first.
              </div>
            ) : (
              <>
                <div className="relative mb-2">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text" value={query} onChange={(e) => setQuery(e.target.value.toUpperCase())}
                    placeholder="Search Pipe ID (e.g. AWD-…)" autoCapitalize="characters" autoCorrect="off" spellCheck={false}
                    className="w-full border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-sm bg-white text-slate-900 min-h-[44px] focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
                  {matches.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-4">No pipes match “{query}”.</p>
                  ) : matches.map((p) => (
                    <button
                      key={p.Pipe_ID} type="button" onClick={() => setChosen(p.Pipe_ID)}
                      className={`w-full flex items-center justify-between gap-2 px-3 min-h-[48px] text-left transition ${chosen === p.Pipe_ID ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}
                    >
                      <code className="font-mono text-sm font-bold text-slate-900">{p.Pipe_ID}</code>
                      {chosen === p.Pipe_ID
                        ? <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                        : <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5">Available</span>}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {chosen && (
            <div className="flex items-center justify-center gap-2 text-sm font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl py-2.5">
              <code className="font-mono text-slate-500">{oldPipe.Pipe_ID}</code>
              <ArrowRight className="w-4 h-4 text-emerald-600" />
              <code className="font-mono text-emerald-800">{chosen}</code>
            </div>
          )}
        </div>

        <div className="px-5 pt-3 border-t border-slate-100" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}>
          {error && <p className="text-xs font-semibold text-red-700 mb-2">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className={`${btn} bg-white text-slate-800 border border-slate-200 hover:bg-slate-50 flex-1`}>Cancel</button>
            <button type="button" disabled={!chosen || busy} onClick={submit} className={`${btn} bg-emerald-700 hover:bg-emerald-800 text-white flex-1`}>
              {busy ? 'Replacing…' : 'Replace pipe'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};
