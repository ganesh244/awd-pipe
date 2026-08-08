import React, { useState, useEffect, useMemo } from 'react';
import { AWDPipe } from '../types';
import { Printer, Sliders, Plus, Filter, Hash, CheckSquare, Square, RefreshCw, CheckCircle2 } from 'lucide-react';
import QRCode from 'qrcode';

interface PrintQRLabelsProps {
  pipes: AWDPipe[];
  onOpenGenerateModal?: () => void;
}

interface QRLabelData {
  pipeId: string;
  batchNo: string;
  dataUrl: string;
  targetUrl: string;
}

export const PrintQRLabels: React.FC<PrintQRLabelsProps> = ({ pipes, onOpenGenerateModal }) => {
  const [selectedBatch, setSelectedBatch] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unregistered' | 'registered'>('all');
  const [rangeMode, setRangeMode] = useState<'all' | 'index' | 'id'>('all');
  
  const [startIndex, setStartIndex] = useState<number>(1);
  const [endIndex, setEndIndex] = useState<number>(50);
  
  const [startPipeId, setStartPipeId] = useState<string>('');
  const [endPipeId, setEndPipeId] = useState<string>('');

  const [deselectedPipeIds, setDeselectedPipeIds] = useState<Set<string>>(new Set());

  const [labels, setLabels] = useState<QRLabelData[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // List of distinct batch numbers
  const batches = useMemo(() => {
    return Array.from(new Set(pipes.map((p) => p.Batch_No).filter(Boolean))) as string[];
  }, [pipes]);

  // Base list of pipes filtered by Batch & Status
  const baseFilteredPipes = useMemo(() => {
    return pipes.filter((p) => {
      const matchBatch = selectedBatch === 'All' || p.Batch_No === selectedBatch;
      const isRegistered = p.Status === 'Registered';
      const matchStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'unregistered'
          ? !isRegistered
          : isRegistered;
      return matchBatch && matchStatus;
    });
  }, [pipes, selectedBatch, statusFilter]);

  // Reset range defaults when base pipes change
  useEffect(() => {
    setStartIndex(1);
    setEndIndex(Math.min(baseFilteredPipes.length, 50) || 1);
    if (baseFilteredPipes.length > 0) {
      setStartPipeId(baseFilteredPipes[0].Pipe_ID);
      setEndPipeId(baseFilteredPipes[baseFilteredPipes.length - 1].Pipe_ID);
    } else {
      setStartPipeId('');
      setEndPipeId('');
    }
    setDeselectedPipeIds(new Set());
  }, [baseFilteredPipes]);

  // Final list of pipes based on Range Mode selection
  const rangeFilteredPipes = useMemo(() => {
    if (baseFilteredPipes.length === 0) return [];

    let result = [...baseFilteredPipes];

    if (rangeMode === 'index') {
      const start = Math.max(1, startIndex) - 1;
      const end = Math.min(baseFilteredPipes.length, Math.max(start + 1, endIndex));
      result = result.slice(start, end);
    } else if (rangeMode === 'id') {
      const startIdxInBase = baseFilteredPipes.findIndex((p) => p.Pipe_ID === startPipeId);
      const endIdxInBase = baseFilteredPipes.findIndex((p) => p.Pipe_ID === endPipeId);

      if (startIdxInBase !== -1 && endIdxInBase !== -1) {
        const min = Math.min(startIdxInBase, endIdxInBase);
        const max = Math.max(startIdxInBase, endIdxInBase);
        result = result.slice(min, max + 1);
      }
    }

    // Apply individual checkbox exclusions
    return result.filter((p) => !deselectedPipeIds.has(p.Pipe_ID));
  }, [baseFilteredPipes, rangeMode, startIndex, endIndex, startPipeId, endPipeId, deselectedPipeIds]);

  // Generate QR codes for the current range filtered pipes
  useEffect(() => {
    let isMounted = true;
    setIsGenerating(true);

    const generateBatchQR = async () => {
      const generated: QRLabelData[] = [];
      const rawOrigin = window.location.origin;
      const origin = rawOrigin.includes('localhost') || rawOrigin.includes('127.0.0.1')
        ? 'https://awd-pipe-system.onrender.com'
        : rawOrigin;

      // Pre-load the logo image once
      const logoImg = new Image();
      logoImg.crossOrigin = 'Anonymous';
      logoImg.src = '/logo.png';
      await new Promise<void>((resolve) => {
        logoImg.onload = () => resolve();
        logoImg.onerror = () => resolve();
      });
      const isLogoLoaded = logoImg.complete && logoImg.naturalHeight !== 0;

      // Process in chunks to maintain UI responsiveness while parallelizing
      const CHUNK_SIZE = 25;
      for (let i = 0; i < rangeFilteredPipes.length; i += CHUNK_SIZE) {
        const chunk = rangeFilteredPipes.slice(i, i + CHUNK_SIZE);
        const chunkPromises = chunk.map(async (pipe) => {
          const targetUrl = `${origin}/?id=${pipe.Pipe_ID}`;
          try {
            const canvas = document.createElement('canvas');
            await QRCode.toCanvas(canvas, targetUrl, {
              width: 200,
              margin: 1,
              color: { dark: '#042f2e', light: '#ffffff' },
              errorCorrectionLevel: 'H',
            });

            const ctx = canvas.getContext('2d');
            if (ctx && isLogoLoaded) {
              const logoSize = canvas.width * 0.25;
              const x = (canvas.width - logoSize) / 2;
              const y = (canvas.height - logoSize) / 2;
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(x - 4, y - 4, logoSize + 8, logoSize + 8);
              ctx.drawImage(logoImg, x, y, logoSize, logoSize);
            }

            return {
              pipeId: pipe.Pipe_ID,
              batchNo: pipe.Batch_No || '',
              dataUrl: canvas.toDataURL('image/png'),
              targetUrl,
            };
          } catch (err) {
            console.error('Error rendering label QR', err);
            return null;
          }
        });
        
        const results = await Promise.all(chunkPromises);
        for (const res of results) {
          if (res) generated.push(res);
        }
      }

      if (isMounted) {
        setLabels(generated);
        setIsGenerating(false);
      }
    };

    generateBatchQR();

    return () => {
      isMounted = false;
    };
  }, [rangeFilteredPipes]);

  const togglePipeSelection = (pipeId: string) => {
    setDeselectedPipeIds((prev) => {
      const next = new Set(prev);
      if (next.has(pipeId)) {
        next.delete(pipeId);
      } else {
        next.add(pipeId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setDeselectedPipeIds(new Set());
  };

  const handleDeselectAll = () => {
    const allIds = new Set(baseFilteredPipes.map((p) => p.Pipe_ID));
    setDeselectedPipeIds(allIds);
  };

  const applyPresetRange = (count: number) => {
    setRangeMode('index');
    setStartIndex(1);
    setEndIndex(Math.min(baseFilteredPipes.length, count));
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      alert('Please allow popups for this site to print QR labels.');
      return;
    }

    const batchLabel = selectedBatch === 'All' ? 'All Batches' : selectedBatch;

    const labelsHtml = labels
      .map(
        (item) => `
        <div class="label">
          <div class="brand-org">DR. REDDY'S FOUNDATION</div>
          <div class="label-header">
            <span>AWD PADDY WATER MANAGEMENT</span>
            <span class="batch">${item.batchNo}</span>
          </div>
          <div class="qr-wrap">
            <img src="${item.dataUrl}" alt="${item.pipeId}" />
          </div>
          <div class="pipe-id">
            <span class="pipe-id-text">${item.pipeId}</span>
            <span class="scan-hint">SCAN TO REGISTER / INSPECT</span>
          </div>
        </div>
      `
      )
      .join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <title>AWD QR Labels — ${batchLabel}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: 'Courier New', monospace;
            background: #fff;
            padding: 16px;
          }
          h1 {
            font-size: 14px;
            font-weight: bold;
            text-align: center;
            margin-bottom: 12px;
            color: #1e3a1e;
            letter-spacing: 0.05em;
            text-transform: uppercase;
          }
          .grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
          }
          .label {
            border: 2px solid #1e293b;
            border-radius: 10px;
            padding: 10px;
            text-align: center;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .label-header {
            font-size: 7px;
            font-weight: bold;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            display: flex;
            justify-content: space-between;
            padding-bottom: 4px;
            border-bottom: 1px solid #e2e8f0;
            color: #475569;
            margin-bottom: 5px;
          }
          .brand-org {
            font-size: 9px;
            font-weight: 900;
            color: #14532d;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            text-align: center;
            padding-bottom: 2px;
          }
          .label-header .batch { color: #15803d; }
          .qr-wrap img {
            width: 110px;
            height: 110px;
            display: block;
            margin: 0 auto 6px;
          }
          .pipe-id {
            background: #1e293b;
            color: #fff;
            border-radius: 6px;
            padding: 4px 8px;
          }
          .pipe-id-text {
            font-size: 11px;
            font-weight: bold;
            display: block;
            letter-spacing: 0.05em;
          }
          .scan-hint {
            font-size: 7px;
            color: #6ee7b7;
            display: block;
            letter-spacing: 0.03em;
          }
          @media print {
            body { padding: 8px; }
            .grid { grid-template-columns: repeat(3, 1fr); gap: 8px; }
          }
        </style>
      </head>
      <body>
        <h1>AWD QR Labels — ${batchLabel} (${labels.length} pipes)</h1>
        <div class="grid">${labelsHtml}</div>
        <script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() { window.close(); };
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2.5 uppercase">
            <Printer className="w-6 h-6 text-emerald-600" />
            Field QR Label Printing Center
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Filter, specify printing ranges, and print production-ready QR codes for AWD field installation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {onOpenGenerateModal && (
            <button
              onClick={onOpenGenerateModal}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl transition shadow-md shadow-emerald-900/10 flex items-center gap-2 uppercase tracking-wider cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Generate New Batch
            </button>
          )}

          <button
            onClick={handlePrint}
            disabled={isGenerating || labels.length === 0}
            className="bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-black text-xs px-5 py-2.5 rounded-xl transition shadow-md flex items-center gap-2 uppercase tracking-wider cursor-pointer disabled:cursor-not-allowed"
          >
            <Printer className="w-4 h-4 text-emerald-400" /> Print {labels.length} Label{labels.length !== 1 ? 's' : ''}
          </button>
        </div>
      </div>

      {/* FILTER & RANGE SELECTION CONTROL PANEL */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-emerald-600" />
            <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider">Print Range & Filter Settings</h2>
          </div>
          <div className="text-xs font-bold text-slate-500">
            Selected for print: <span className="text-emerald-700 font-extrabold">{labels.length}</span> of {baseFilteredPipes.length} available
          </div>
        </div>

        {/* Row 1: Batch & Status Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">
              1. Select Batch
            </label>
            <select
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value)}
              className="w-full border border-slate-300 bg-slate-50 rounded-xl p-2.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="All">All Batches ({pipes.length} Total Pipes)</option>
              {batches.map((b) => (
                <option key={b} value={b}>
                  {b} ({pipes.filter((p) => p.Batch_No === b).length} pipes)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">
              2. Status Filter
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full border border-slate-300 bg-slate-50 rounded-xl p-2.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">All Pipe Statuses</option>
              <option value="unregistered">Unregistered / Available Only</option>
              <option value="registered">Registered / Installed Only</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">
              3. Range Selection Mode
            </label>
            <select
              value={rangeMode}
              onChange={(e) => setRangeMode(e.target.value as any)}
              className="w-full border border-slate-300 bg-slate-50 rounded-xl p-2.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">Print All ({baseFilteredPipes.length} pipes)</option>
              <option value="index">Index Range (e.g., Pipe #1 to #25)</option>
              <option value="id">Pipe ID Range (e.g., AWD-0001 to AWD-0020)</option>
            </select>
          </div>
        </div>

        {/* Row 2: Range Inputs based on mode */}
        {rangeMode !== 'all' && (
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 animate-fadeIn">
            {rangeMode === 'index' && (
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="flex-1 min-w-[140px]">
                  <label className="block text-[10px] font-extrabold text-slate-600 uppercase mb-1">
                    Start Pipe Index (#)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={baseFilteredPipes.length}
                    value={startIndex}
                    onChange={(e) => setStartIndex(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex-1 min-w-[140px]">
                  <label className="block text-[10px] font-extrabold text-slate-600 uppercase mb-1">
                    End Pipe Index (#)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={baseFilteredPipes.length}
                    value={endIndex}
                    onChange={(e) => setEndIndex(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-1.5 self-end pt-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Presets:</span>
                  <button
                    type="button"
                    onClick={() => applyPresetRange(10)}
                    className="px-2.5 py-1.5 bg-white border border-slate-300 hover:bg-emerald-50 hover:border-emerald-300 text-slate-700 text-[10px] font-bold rounded-lg transition cursor-pointer"
                  >
                    First 10
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPresetRange(25)}
                    className="px-2.5 py-1.5 bg-white border border-slate-300 hover:bg-emerald-50 hover:border-emerald-300 text-slate-700 text-[10px] font-bold rounded-lg transition cursor-pointer"
                  >
                    First 25
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPresetRange(50)}
                    className="px-2.5 py-1.5 bg-white border border-slate-300 hover:bg-emerald-50 hover:border-emerald-300 text-slate-700 text-[10px] font-bold rounded-lg transition cursor-pointer"
                  >
                    First 50
                  </button>
                </div>
              </div>
            )}

            {rangeMode === 'id' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-600 uppercase mb-1">
                    Start Pipe ID
                  </label>
                  <select
                    value={startPipeId}
                    onChange={(e) => setStartPipeId(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-bold font-mono text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {baseFilteredPipes.map((p, idx) => (
                      <option key={p.Pipe_ID} value={p.Pipe_ID}>
                        #{idx + 1} — {p.Pipe_ID} ({p.Status})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-slate-600 uppercase mb-1">
                    End Pipe ID
                  </label>
                  <select
                    value={endPipeId}
                    onChange={(e) => setEndPipeId(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-bold font-mono text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {baseFilteredPipes.map((p, idx) => (
                      <option key={p.Pipe_ID} value={p.Pipe_ID}>
                        #{idx + 1} — {p.Pipe_ID} ({p.Status})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Generating Indicator */}
      {isGenerating && (
        <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-500 text-xs flex items-center justify-center gap-3 shadow-xs">
          <div className="animate-spin h-5 w-5 border-2 border-emerald-600 border-t-transparent rounded-full" />
          <span>Rendering {rangeFilteredPipes.length} QR code labels for print sheet…</span>
        </div>
      )}

      {/* PREVIEW & GRANULAR ITEM TOGGLING GRID */}
      {!isGenerating && labels.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2 px-1">
            <div className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Print Preview — {labels.length} Label{labels.length !== 1 ? 's' : ''} Selected</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer"
              >
                <CheckSquare className="w-3.5 h-3.5 text-emerald-600" /> Select All
              </button>
              <button
                type="button"
                onClick={handleDeselectAll}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer"
              >
                <Square className="w-3.5 h-3.5 text-slate-400" /> Deselect All
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {baseFilteredPipes.map((p) => {
              const isIncludedInRange = rangeFilteredPipes.some((rp) => rp.Pipe_ID === p.Pipe_ID);
              const labelItem = labels.find((l) => l.pipeId === p.Pipe_ID);

              if (!isIncludedInRange) return null;

              const isChecked = !deselectedPipeIds.has(p.Pipe_ID);

              return (
                <div
                  key={p.Pipe_ID}
                  onClick={() => togglePipeSelection(p.Pipe_ID)}
                  className={`relative border-2 rounded-2xl p-3 text-center space-y-2 transition cursor-pointer select-none ${
                    isChecked
                      ? 'bg-white border-slate-900 shadow-md ring-1 ring-emerald-500/20'
                      : 'bg-slate-50 border-slate-200 opacity-40 hover:opacity-75'
                  }`}
                >
                  {/* Selection Checkbox Badge */}
                  <div className="absolute top-2 right-2 z-10">
                    {isChecked ? (
                      <CheckSquare className="w-4 h-4 text-emerald-600 bg-white rounded" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400 bg-white rounded" />
                    )}
                  </div>

                  <div className="border-b border-slate-100 pb-1">
                    <div className="text-[9px] font-black text-emerald-800 uppercase tracking-widest truncate pr-4">
                      DR. REDDY'S FOUNDATION
                    </div>
                    <div className="text-[8px] font-bold text-slate-400 flex items-center justify-between mt-0.5">
                      <span>AWD PIPE</span>
                      <span className="text-emerald-700 font-mono text-[8px]">{p.Batch_No}</span>
                    </div>
                  </div>

                  <div className="p-1 bg-white inline-block">
                    {labelItem?.dataUrl ? (
                      <img src={labelItem.dataUrl} alt={`QR Code ${p.Pipe_ID}`} className="w-24 h-24 mx-auto" />
                    ) : (
                      <div className="w-24 h-24 bg-slate-100 rounded-lg animate-pulse mx-auto" />
                    )}
                  </div>

                  <div className="bg-slate-900 text-white rounded-xl py-1.5 px-2">
                    <span className="font-mono font-black text-xs tracking-wider block">{p.Pipe_ID}</span>
                    <span className="text-[7px] font-extrabold text-emerald-300 tracking-tight block uppercase">
                      {p.Status === 'Registered' ? `Installed: ${p.Farmer_Name || 'Assigned'}` : 'SCAN TO REGISTER / INSPECT'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!isGenerating && rangeFilteredPipes.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 text-xs">
          No pipes match the selected range and filter options. Try adjusting the batch or range parameters above.
        </div>
      )}
    </div>
  );
};

