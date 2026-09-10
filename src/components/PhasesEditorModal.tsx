import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { Phase } from '../types';
import { X, Plus, Trash2, GripVertical } from 'lucide-react';
import { useDialog } from '../hooks/useDialog';

interface PhasesEditorModalProps {
  phases: Phase[];
  onClose: () => void;
  onSave: (phases: Phase[]) => Promise<{ ok: boolean; error?: string }>;
}

/** Admin editor for the rollout phases and their targets (cumulative milestones). */
export const PhasesEditorModal: React.FC<PhasesEditorModalProps> = ({ phases, onClose, onSave }) => {
  const { dialogProps } = useDialog({ onClose, label: 'Edit registration phases' });
  const [rows, setRows] = useState<Phase[]>(phases.map((p) => ({ ...p })));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (i: number, patch: Partial<Phase>) => setRows((r) => r.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  const remove = (i: number) => setRows((r) => r.filter((_, idx) => idx !== i));
  const add = () => setRows((r) => [...r, { id: `phase-${Date.now()}`, name: `Phase ${r.length + 1}`, target: 1000 }]);

  const totalTarget = rows.reduce((s, p) => s + (Number(p.target) || 0), 0);

  const save = async () => {
    const clean = rows
      .map((p, i) => ({ id: p.id || `phase-${i + 1}`, name: (p.name || '').trim() || `Phase ${i + 1}`, target: Math.round(Number(p.target) || 0) }))
      .filter((p) => p.target >= 1);
    if (clean.length === 0) { setError('Add at least one phase with a target of 1 or more.'); return; }
    setBusy(true); setError(null);
    const r = await onSave(clean);
    setBusy(false);
    if (r.ok) onClose();
    else setError(r.error || 'Could not save.');
  };

  const btn = 'inline-flex items-center justify-center gap-1.5 font-bold transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl min-h-[44px] text-sm px-4';

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div {...dialogProps} onClick={(e) => e.stopPropagation()} className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92dvh]">
        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">Registration phases</h3>
            <p className="text-xs text-slate-500">Cumulative install milestones · {totalTarget.toLocaleString()} pipes total</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className={`${btn} min-w-[44px] px-0 text-slate-500 hover:bg-slate-100`}><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {rows.map((p, i) => (
            <div key={p.id} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-2.5">
              <GripVertical className="w-4 h-4 text-slate-300 shrink-0" />
              <div className="flex-1 min-w-0">
                <label className="sr-only" htmlFor={`ph-name-${i}`}>Phase name</label>
                <input
                  id={`ph-name-${i}`} value={p.name} onChange={(e) => update(i, { name: e.target.value })}
                  placeholder={`Phase ${i + 1}`}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm font-bold text-slate-900 min-h-[40px] focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none"
                />
              </div>
              <div className="w-28 shrink-0">
                <label className="sr-only" htmlFor={`ph-target-${i}`}>Target pipes</label>
                <input
                  id={`ph-target-${i}`} type="number" inputMode="numeric" min={1} value={p.target}
                  onChange={(e) => update(i, { target: e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value, 10) || 0) })}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm font-bold text-slate-900 tabular-nums min-h-[40px] focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none"
                />
              </div>
              <button
                type="button" onClick={() => remove(i)} disabled={rows.length <= 1}
                aria-label={`Remove ${p.name || 'phase'}`}
                className={`${btn} min-w-[44px] px-0 text-red-600 hover:bg-red-50 disabled:text-slate-300`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button type="button" onClick={add} className={`${btn} w-full bg-white text-slate-700 border border-dashed border-slate-300 hover:bg-slate-50`}>
            <Plus className="w-4 h-4" /> Add phase
          </button>
          <p className="text-[11px] text-slate-500">
            Phases are cumulative: total installations flow through them in order. Editing a target reshuffles which phase is “current”.
          </p>
        </div>

        <div className="px-5 pt-3 border-t border-slate-100" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}>
          {error && <p className="text-xs font-semibold text-red-700 mb-2">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className={`${btn} bg-white text-slate-800 border border-slate-200 hover:bg-slate-50 flex-1`}>Cancel</button>
            <button type="button" onClick={save} disabled={busy} className={`${btn} bg-emerald-700 hover:bg-emerald-800 text-white flex-1`}>{busy ? 'Saving…' : 'Save phases'}</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};
