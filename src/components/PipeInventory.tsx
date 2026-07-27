import React, { useState } from 'react';
import { AWDPipe, PipeStatus } from '../types';
import { Search, QrCode, Filter, Plus, Box, CheckCircle2, AlertTriangle, ExternalLink, X } from 'lucide-react';
import QRCode from 'qrcode';

interface PipeInventoryProps {
  pipes: AWDPipe[];
  onSelectPipe: (pipeId: string) => void;
  onAddPipeBatch: (batchNo: string, count: number) => void;
  onOpenGenerateModal?: () => void;
}

export const PipeInventory: React.FC<PipeInventoryProps> = ({
  pipes,
  onSelectPipe,
  onAddPipeBatch,
  onOpenGenerateModal,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [selectedQrPipe, setSelectedQrPipe] = useState<AWDPipe | null>(null);
  const [qrCanvasUrl, setQrCanvasUrl] = useState<string>('');

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
    const targetUrl = `${window.location.origin}${window.location.pathname}?id=${pipe.Pipe_ID}`;
    try {
      const url = await QRCode.toDataURL(targetUrl, { width: 250, margin: 2 });
      setQrCanvasUrl(url);
    } catch (err) {
      console.error('Failed to render QR Code', err);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#d1dbd1] pb-4">
        <div>
          <h1 className="text-2xl font-bold text-[#2d3a2d] tracking-tight flex items-center gap-2 uppercase">
            <Box className="w-7 h-7 text-[#88b04b]" />
            AWD Pipe Master Inventory (AWD_Pipes)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Unique Pipe IDs, batch tracking, installation statuses, and individual QR target links.
          </p>
        </div>

        <button
          onClick={() => {
            if (onOpenGenerateModal) {
              onOpenGenerateModal();
            } else {
              onAddPipeBatch('BATCH-2026-02', 10);
            }
          }}
          className="bg-[#2d4a2d] hover:bg-[#1a2d1a] text-white text-xs font-bold uppercase tracking-widest px-4 py-2.5 rounded-lg transition shadow-md flex items-center gap-2 self-start sm:self-auto border-b-2 border-black/20"
        >
          <Plus className="w-4 h-4 text-[#88b04b]" /> Generate New QR Batch
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          
          {/* Search Bar Input */}
          <div className="md:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by Farmer Name, Village, Pipe ID (e.g. AWD-0001), or Batch..."
              className="w-full pl-10 pr-10 py-2.5 text-xs font-medium border-2 border-slate-100 bg-slate-50 rounded-xl outline-none focus:border-emerald-500 focus:bg-white text-slate-800 transition"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Status Filter Dropdown */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full border-2 border-slate-100 bg-slate-50 rounded-xl p-2.5 text-xs font-bold text-slate-800 outline-none focus:border-emerald-500 focus:bg-white cursor-pointer transition"
            >
              <option value="All">All Statuses ({pipes.length})</option>
              <option value="Available">🟢 Available ({pipes.filter((p) => p.Status === 'Available').length})</option>
              <option value="Installed">🟢 Installed ({pipes.filter((p) => p.Status === 'Installed').length})</option>
              <option value="Damaged">🔴 Damaged ({pipes.filter((p) => p.Status === 'Damaged').length})</option>
              <option value="Removed">⚪ Removed ({pipes.filter((p) => p.Status === 'Removed').length})</option>
              <option value="Replaced">🔄 Replaced ({pipes.filter((p) => p.Status === 'Replaced').length})</option>
            </select>
          </div>

        </div>

        {/* Filter Results Summary & Quick Reset */}
        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
          <div className="text-slate-500 font-medium flex items-center gap-2">
            <span>
              Showing <strong className="text-slate-800 font-bold">{filteredPipes.length}</strong> of{' '}
              <strong className="text-slate-800 font-bold">{pipes.length}</strong> pipes
            </span>
            {(searchTerm || statusFilter !== 'All') && (
              <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-md">
                Filtered
              </span>
            )}
          </div>

          {(searchTerm || statusFilter !== 'All') && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('All');
              }}
              className="text-emerald-700 hover:text-emerald-900 font-bold text-xs flex items-center gap-1 hover:underline cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Pipes Data Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
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
                    <td className="px-4 py-3 font-mono font-bold text-emerald-800 text-sm">
                      {p.Pipe_ID}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-500">{p.Batch_No}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                          p.Status === 'Installed'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : p.Status === 'Available'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}
                      >
                        {p.Status === 'Installed' ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <AlertTriangle className="w-3 h-3" />
                        )}
                        {p.Status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-800">
                      {p.Farmer_Name || <span className="text-slate-300 italic">Unassigned</span>}
                    </td>
                    <td className="px-4 py-3">{p.Village || '--'}</td>
                    <td className="px-4 py-3">{p.Installation_Date || '--'}</td>
                    <td className="px-4 py-3 text-right space-x-1">
                      <button
                        onClick={() => onSelectPipe(p.Pipe_ID)}
                        className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2.5 py-1 rounded-lg transition"
                      >
                        Open Form
                      </button>
                      <button
                        onClick={() => handleShowQrModal(p)}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold px-2 py-1 rounded-lg transition"
                      >
                        QR Code
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* QR CODE PREVIEW MODAL */}
      {selectedQrPipe && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center border-b pb-2">
              <span className="font-mono font-black text-lg text-emerald-900">{selectedQrPipe.Pipe_ID}</span>
              <button
                onClick={() => setSelectedQrPipe(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-xl"
              >
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
              <p className="text-[11px] text-slate-400">Scanned URL: ?id={selectedQrPipe.Pipe_ID}</p>
            </div>

            <button
              onClick={() => onSelectPipe(selectedQrPipe.Pipe_ID)}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs transition"
            >
              Load in Mobile Registration View
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
