import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { AWDPipe } from '../types';
import { Search, Filter, Plus, Box, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import QRCode from 'qrcode';
import { StatusBadge } from './ui/StatusBadge';
import { Button } from './ui/Button';

interface PipeInventoryProps {
  pipes: AWDPipe[];
  onSelectPipe: (pipeId: string) => void;
  onAddPipeBatch: (batchNo: string, count: number) => void;
  onUpdatePipe?: (pipeId: string, updates: Partial<AWDPipe>) => void;
  onRenameBatch?: (oldBatchNo: string, newBatchNo: string) => void;
  onDeleteBatch?: (batchNo: string) => void;
  onOpenGenerateModal?: () => void;
}

export const PipeInventory: React.FC<PipeInventoryProps> = ({
  pipes,
  onSelectPipe,
  onAddPipeBatch,
  onUpdatePipe,
  onRenameBatch,
  onDeleteBatch,
  onOpenGenerateModal,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [selectedQrPipe, setSelectedQrPipe] = useState<AWDPipe | null>(null);
  const [qrCanvasUrl, setQrCanvasUrl] = useState<string>('');
  const [editingPipe, setEditingPipe] = useState<AWDPipe | null>(null);
  const [editBatchNo, setEditBatchNo] = useState('');

  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [editingBatchNo, setEditingBatchNo] = useState<string | null>(null);
  const [batchToDelete, setBatchToDelete] = useState<string | null>(null);
  const [newBatchName, setNewBatchName] = useState('');

  // Lock body scroll when any modal is open
  useEffect(() => {
    const anyModalOpen = isBatchModalOpen || !!selectedQrPipe || !!editingPipe;
    document.body.style.overflow = anyModalOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isBatchModalOpen, selectedQrPipe, editingPipe]);

  const uniqueBatches = Array.from(new Set(pipes.map((p) => p.Batch_No).filter(Boolean))) as string[];

  const filteredPipes = pipes.filter((p) => {
    const matchesSearch =
      p.Pipe_ID.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.Farmer_Name && p.Farmer_Name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.Village && p.Village.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.Batch_No && p.Batch_No.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'All' || p.Status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleShowQrModal = async (pipe: AWDPipe) => {
    setSelectedQrPipe(pipe);
    const rawOrigin = window.location.origin;
    const origin = rawOrigin.includes('localhost') || rawOrigin.includes('127.0.0.1')
      ? 'https://awd-pipe-system.onrender.com'
      : rawOrigin;
    const targetUrl = `${origin}/?id=${pipe.Pipe_ID}`;
    try {
      const url = await QRCode.toDataURL(targetUrl, { width: 250, margin: 2 });
      setQrCanvasUrl(url);
    } catch (err) {
      console.error('Failed to render QR Code', err);
    }
  };

  // ── Shared backdrop overlay rendered via Portal ────────────────────────────
  const modalOverlay = (content: React.ReactNode) =>
    ReactDOM.createPortal(
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
        {content}
      </div>,
      document.body
    );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

      {/* Top Header */}
      <div className="border-b border-[#d1dbd1] pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2 uppercase">
              <Box className="w-6 h-6 text-emerald-600" />
              AWD Pipe Master Inventory
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Unique Pipe IDs, batch tracking, installation statuses, and QR target links.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => setIsBatchModalOpen(true)}>
              Manage Batches
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (onOpenGenerateModal) onOpenGenerateModal();
                else onAddPipeBatch('BATCH-2026-02', 10);
              }}
            >
              <Plus className="w-4 h-4" /> Generate New QR Batch
            </Button>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by Farmer Name, Village, Pipe ID, or Batch..."
              className="w-full pl-10 pr-10 py-2.5 text-xs font-medium border-2 border-slate-100 bg-slate-50 rounded-xl outline-none focus:border-emerald-500 focus:bg-white text-slate-800 transition"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                aria-label="Clear search"
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full border-2 border-slate-100 bg-slate-50 rounded-xl p-2.5 text-xs font-bold text-slate-800 outline-none focus:border-emerald-500 focus:bg-white cursor-pointer transition"
            >
              <option value="All">All Statuses ({pipes.length})</option>
              <option value="Available">Available ({pipes.filter((p) => p.Status === 'Available').length})</option>
              <option value="Installed">Installed ({pipes.filter((p) => p.Status === 'Installed').length})</option>
              <option value="Damaged">Damaged ({pipes.filter((p) => p.Status === 'Damaged').length})</option>
              <option value="Removed">Removed ({pipes.filter((p) => p.Status === 'Removed').length})</option>
              <option value="Replaced">Replaced ({pipes.filter((p) => p.Status === 'Replaced').length})</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
          <div className="text-slate-500 font-medium flex items-center gap-2">
            <span>
              Showing <strong className="text-slate-800 font-bold">{filteredPipes.length}</strong> of{' '}
              <strong className="text-slate-800 font-bold">{pipes.length}</strong> pipes
            </span>
            {(searchTerm || statusFilter !== 'All') && (
              <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold px-2 py-0.5 rounded-md">
                Filtered
              </span>
            )}
          </div>
          {(searchTerm || statusFilter !== 'All') && (
            <button
              type="button"
              onClick={() => { setSearchTerm(''); setStatusFilter('All'); }}
              className="text-emerald-700 hover:text-emerald-900 font-bold text-xs flex items-center gap-1 hover:underline cursor-pointer"
            >
              <X className="w-3.5 h-3.5" /> Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Pipes Data Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-xs tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Pipe ID</th>
                <th className="px-4 py-3">Batch No</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Assigned Farmer</th>
                <th className="px-4 py-3">Village</th>
                <th className="px-4 py-3">Installation Date</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredPipes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    No AWD pipes matched your search parameters.
                  </td>
                </tr>
              ) : (
                filteredPipes.map((p) => (
                  <tr key={p.Pipe_ID} className="hover:bg-slate-50/80 transition">
                    <td className="px-4 py-3 font-mono font-bold text-emerald-800 text-sm">{p.Pipe_ID}</td>
                    <td className="px-4 py-3 font-mono text-slate-500">{p.Batch_No}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={p.Status} />
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-800">
                      {p.Farmer_Name || <span className="text-slate-300 italic">Unassigned</span>}
                    </td>
                    <td className="px-4 py-3">{p.Village || '--'}</td>
                    <td className="px-4 py-3">{p.Installation_Date || '--'}</td>
                    <td className="px-4 py-3 text-right space-x-1">
                      <Button
                        variant="secondary"
                        onClick={() => onSelectPipe(p.Pipe_ID)}
                        className="!text-xs !py-1 !px-2.5 !min-h-[32px]"
                      >
                        Open Form
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => { setEditingPipe(p); setEditBatchNo(p.Batch_No || ''); }}
                        className="!text-xs !py-1 !px-2.5 !min-h-[32px]"
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => handleShowQrModal(p)}
                        className="!text-xs !py-1 !px-2.5 !min-h-[32px]"
                      >
                        QR Code
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── PORTALED MODALS (bypass transform parents) ── */}

      {/* QR CODE PREVIEW MODAL */}
      {selectedQrPipe && modalOverlay(
        <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl border border-slate-200">
          <div className="flex justify-between items-center border-b pb-2">
            <div className="text-left">
              <div className="text-xs font-black text-emerald-700 uppercase tracking-widest">DR. REDDY'S FOUNDATION</div>
              <span className="font-mono font-black text-base text-slate-900">{selectedQrPipe.Pipe_ID}</span>
            </div>
            <button onClick={() => setSelectedQrPipe(null)} aria-label="Close QR Modal" className="text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 inline-block shadow-inner">
            {qrCanvasUrl ? (
              <img src={qrCanvasUrl} alt={`QR Code for ${selectedQrPipe.Pipe_ID}`} className="w-48 h-48 mx-auto" />
            ) : (
              <div className="w-48 h-48 bg-slate-100 flex items-center justify-center text-slate-400 text-xs">
                Generating QR...
              </div>
            )}
          </div>
          <div className="text-xs text-slate-600 space-y-1">
            <div className="font-mono font-extrabold text-sm text-slate-800">{selectedQrPipe.Pipe_ID}</div>
            <p className="text-xs font-semibold text-emerald-600">AWD PIPE SYSTEM</p>
          </div>
          <Button
            variant="primary"
            fullWidth
            onClick={() => onSelectPipe(selectedQrPipe.Pipe_ID)}
          >
            Load in Mobile Registration View
          </Button>
        </div>
      )}

      {/* EDIT PIPE MODAL */}
      {editingPipe && modalOverlay(
        <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl border border-slate-200 text-left">
          <div className="flex justify-between items-center border-b pb-2">
            <h3 className="font-bold text-lg text-emerald-900">Edit Pipe</h3>
            <button onClick={() => setEditingPipe(null)} aria-label="Close Edit Modal" className="text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Pipe ID</label>
              <div className="w-full bg-slate-100 p-2.5 rounded-xl border-2 border-slate-200 text-sm font-mono text-slate-500 cursor-not-allowed">
                {editingPipe.Pipe_ID}
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Batch Number</label>
              <input
                type="text"
                value={editBatchNo}
                onChange={(e) => setEditBatchNo(e.target.value)}
                placeholder="e.g. BATCH-TS-2026-KRM"
                className="w-full border-2 border-slate-200 bg-white rounded-xl p-2.5 text-sm font-medium outline-none focus:border-emerald-500 transition"
              />
            </div>
          </div>
          <div className="pt-2 flex gap-2 justify-end">
            <button
              onClick={() => setEditingPipe(null)}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-bold transition"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (onUpdatePipe) onUpdatePipe(editingPipe.Pipe_ID, { Batch_No: editBatchNo });
                setEditingPipe(null);
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold transition shadow-sm"
            >
              Save Changes
            </button>
          </div>
        </div>
      )}

      {/* MANAGE BATCHES MODAL */}
      {isBatchModalOpen && modalOverlay(
        <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 text-left overflow-hidden flex flex-col max-h-[80vh]">
          <div className="flex justify-between items-center border-b px-6 py-4 bg-white">
            <h3 className="font-bold text-lg text-emerald-900">Manage Batches</h3>
            <button
              onClick={() => { setIsBatchModalOpen(false); setEditingBatchNo(null); setBatchToDelete(null); }}
              aria-label="Close Manage Batches Modal"
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-3 p-6 overflow-y-auto">
            {uniqueBatches.length === 0 ? (
              <div className="text-center text-slate-500 py-4 text-sm">No batches found.</div>
            ) : (
              uniqueBatches.map((batch) => (
                <div key={batch} className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200 gap-2">
                  {editingBatchNo === batch ? (
                    <div className="flex-1 flex gap-2 w-full">
                      <input
                        type="text"
                        value={newBatchName}
                        onChange={(e) => setNewBatchName(e.target.value)}
                        className="w-full border-2 border-emerald-500 bg-white rounded-lg p-1.5 text-sm font-medium outline-none"
                      />
                      <button
                        onClick={() => {
                          if (newBatchName.trim() && newBatchName !== batch && onRenameBatch) {
                            onRenameBatch(batch, newBatchName.trim());
                          }
                          setEditingBatchNo(null);
                        }}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition whitespace-nowrap"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingBatchNo(null)}
                        className="px-3 py-1.5 text-slate-500 hover:bg-slate-200 rounded-lg text-xs font-bold transition whitespace-nowrap"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : batchToDelete === batch ? (
                    <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-2 w-full justify-between">
                      <div className="text-xs text-red-600 font-bold">Delete ALL {pipes.filter(p => p.Batch_No === batch).length} pipes in "{batch}"?</div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => { if (onDeleteBatch) onDeleteBatch(batch); setBatchToDelete(null); setIsBatchModalOpen(false); }}
                          className="text-white text-xs font-bold px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg transition whitespace-nowrap"
                        >
                          Yes, Delete
                        </button>
                        <button
                          onClick={() => setBatchToDelete(null)}
                          className="text-slate-600 text-xs font-bold px-3 py-1.5 bg-slate-200 hover:bg-slate-300 rounded-lg transition whitespace-nowrap"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="font-mono text-sm font-bold text-slate-700 flex-1 break-all">
                        {batch} <span className="text-xs text-slate-400 font-sans ml-1">({pipes.filter(p => p.Batch_No === batch).length} pipes)</span>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => { setEditingBatchNo(batch); setNewBatchName(batch); setBatchToDelete(null); }}
                          className="text-blue-600 hover:text-blue-800 text-xs font-bold px-3 py-1.5 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
                        >
                          Rename
                        </button>
                        <button
                          onClick={() => { setBatchToDelete(batch); setEditingBatchNo(null); }}
                          className="text-red-600 hover:text-red-800 text-xs font-bold px-3 py-1.5 bg-red-50 hover:bg-red-100 rounded-lg transition"
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
