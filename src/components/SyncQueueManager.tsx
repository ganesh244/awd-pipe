import React, { useState } from 'react';
import { OfflineQueueItem } from '../types';
import { Wifi, WifiOff, Trash2, RefreshCw, CheckCircle2, AlertCircle, X, ChevronRight, Database, UserCheck, Activity } from 'lucide-react';

interface SyncQueueManagerProps {
  isOpen: boolean;
  onClose: () => void;
  isOnline: boolean;
  onToggleOnline: () => void;
  queue: OfflineQueueItem[];
  onSyncAll: () => Promise<{ synced: number; failed: number }>;
  onDeleteItem: (id: string) => void;
}

export const SyncQueueManager: React.FC<SyncQueueManagerProps> = ({
  isOpen,
  onClose,
  isOnline,
  onToggleOnline,
  queue,
  onSyncAll,
  onDeleteItem
}) => {
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error' | 'partial'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleSync = async () => {
    if (!isOnline || queue.length === 0) return;
    setSyncing(true);
    setSyncMessage(null);
    try {
      const { synced, failed } = await onSyncAll();
      if (failed === 0 && synced > 0) {
        setSyncMessage({ type: 'success', text: `All ${synced} item${synced === 1 ? '' : 's'} synchronized successfully!` });
      } else if (synced > 0 && failed > 0) {
        setSyncMessage({ type: 'partial', text: `${synced} synced, ${failed} failed — review errors below and retry.` });
      } else if (failed > 0) {
        setSyncMessage({ type: 'error', text: `Sync failed for ${failed} item${failed === 1 ? '' : 's'}. Check network and retry.` });
      }
      setTimeout(() => setSyncMessage(null), 5000);
    } catch (err) {
      console.error(err);
      setSyncMessage({ type: 'error', text: 'Unexpected sync error. Please try again.' });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden border border-slate-100 shadow-2xl flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-600">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-slate-800 text-base">Offline Sync Manager</h2>
              <p className="text-[10px] text-slate-400">Queue local data uploads during field network drops</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            aria-label="Close sync manager"
            className="p-1.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Connectivity Control Bar */}
        <div className="px-6 py-4 bg-emerald-950/5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">Simulate Field Connection:</span>
            <button
              onClick={onToggleOnline}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95 cursor-pointer ${
                isOnline 
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                  : 'bg-rose-100 text-rose-800 border border-rose-200'
              }`}
            >
              {isOnline ? (
                <>
                  <Wifi className="w-3.5 h-3.5 animate-pulse" />
                  Online (Atlas Active)
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5" />
                  Offline Mode
                </>
              )}
            </button>
          </div>

          <div className="text-xs text-slate-500 font-medium">
            Queued: <span className="font-bold text-slate-800">{queue.length} items</span>
          </div>
        </div>

        {/* Content body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 thin-scroll">
          {syncMessage && (
            <div className={`rounded-xl p-3 text-xs flex items-center gap-2 animate-scaleIn ${
              syncMessage.type === 'success'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                : syncMessage.type === 'partial'
                ? 'bg-amber-50 border border-amber-200 text-amber-900'
                : 'bg-rose-50 border border-rose-200 text-rose-800'
            }`}>
              {syncMessage.type === 'error' ? (
                <AlertCircle className="w-4 h-4 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              )}
              {syncMessage.text}
            </div>
          )}

          {queue.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto text-emerald-600">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-700 text-sm">Sync Queue Empty</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  All installations and monitoring visits are fully synced with the database servers. Go to "Register" or "Map" to add new entries.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {queue.map((item) => {
                const isReg = item.type === 'registration';
                const p = item.payload;
                
                return (
                  <div 
                    key={item.id}
                    className="border border-slate-100 rounded-2xl p-4 hover:border-slate-200 transition-all flex items-start justify-between gap-4 bg-slate-50/30"
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                        isReg ? 'bg-indigo-50 text-indigo-600' : 'bg-cyan-50 text-cyan-600'
                      }`}>
                        {isReg ? <UserCheck className="w-4.5 h-4.5" /> : <Activity className="w-4.5 h-4.5" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                            isReg ? 'bg-indigo-100 text-indigo-800' : 'bg-cyan-100 text-cyan-800'
                          }`}>
                            {isReg ? 'Registration' : 'Visit log'}
                          </span>
                          <span className="text-[10px] font-semibold text-slate-400 font-mono">
                            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {item.status === 'failed' && (
                            <span className="bg-rose-100 text-rose-800 text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                              <AlertCircle className="w-2.5 h-2.5" /> Failed
                            </span>
                          )}
                        </div>

                        <div className="font-bold text-slate-800 text-sm mt-1">
                          {isReg ? p.Farmer_Name : `AWD Pipe: ${p.Pipe_ID}`}
                        </div>

                        <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                          {isReg 
                            ? `Pipe: ${p.Pipe_ID} · Phone: ${p.Mobile} · Plot: ${p.Plot_Size} ${p.Plot_Size_Unit} in ${p.Village}` 
                            : `Water Level: ${p.Water_Level}cm · Crop Stage: ${p.Crop_Stage} · AWD: ${p.AWD_Followed}`
                          }
                        </p>

                        {item.error && (
                          <div className="text-[10px] text-rose-600 font-medium mt-1">
                            Error: {item.error}
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => onDeleteItem(item.id)}
                      className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition shrink-0"
                      title="Discard entry"
                    >
                      <Trash2 className="w-4.5 h-4.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-6 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-semibold text-slate-600 transition"
          >
            Cancel
          </button>

          <button
            onClick={handleSync}
            disabled={queue.length === 0 || !isOnline || syncing}
            className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl transition shadow-lg shadow-emerald-950/20 active:scale-95 cursor-pointer disabled:cursor-not-allowed"
          >
            {syncing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Syncing Queue...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Sync All ({queue.length})
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
