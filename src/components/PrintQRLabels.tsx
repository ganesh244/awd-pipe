import React, { useState, useEffect } from 'react';
import { AWDPipe } from '../types';
import { Printer, Sliders, Plus } from 'lucide-react';
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
  const [labels, setLabels] = useState<QRLabelData[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const batches = Array.from(new Set(pipes.map((p) => p.Batch_No).filter(Boolean))) as string[];

  const filteredPipes = pipes.filter(
    (p) => selectedBatch === 'All' || p.Batch_No === selectedBatch
  );

  useEffect(() => {
    let isMounted = true;
    setIsGenerating(true);

    const generateBatchQR = async () => {
      const generated: QRLabelData[] = [];
      const origin = window.location.origin;

      for (const pipe of filteredPipes) {
        const targetUrl = `${origin}?id=${pipe.Pipe_ID}`;
        try {
          const dataUrl = await QRCode.toDataURL(targetUrl, {
            width: 200,
            margin: 1,
            color: { dark: '#042f2e', light: '#ffffff' },
          });
          generated.push({
            pipeId: pipe.Pipe_ID,
            batchNo: pipe.Batch_No || '',
            dataUrl,
            targetUrl,
          });
        } catch (err) {
          console.error('Error rendering label QR', err);
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
  }, [selectedBatch, pipes]);

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
            <span class="scan-hint">DR. REDDY'S FOUNDATION • SCAN TO INSPECT</span>
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

      {/* Control Bar */}
      <div className="bg-white p-5 rounded-xl border border-[#d1dbd1] shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#2d3a2d] tracking-tight flex items-center gap-2 uppercase">
            <Printer className="w-6 h-6 text-[#88b04b]" />
            Field QR Label Printing Center
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Select a batch and print isolated QR labels — no navbar or UI included in the printout.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-slate-400" />
            <select
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value)}
              className="border-2 border-gray-100 bg-gray-50 rounded-lg p-2 text-xs font-bold text-[#2d3a2d] outline-none focus:border-[#88b04b]"
            >
              <option value="All">All Batches ({pipes.length} Pipes)</option>
              {batches.map((b) => (
                <option key={b} value={b}>
                  {b} ({pipes.filter(p => p.Batch_No === b).length} pipes)
                </option>
              ))}
            </select>
          </div>

          {onOpenGenerateModal && (
            <button
              onClick={onOpenGenerateModal}
              className="bg-[#88b04b] hover:bg-[#779942] text-slate-950 font-bold text-xs px-3.5 py-2.5 rounded-lg transition shadow-sm flex items-center gap-1.5 uppercase tracking-wider"
            >
              <Plus className="w-4 h-4" /> Generate New QR Batch
            </button>
          )}

          <button
            onClick={handlePrint}
            disabled={isGenerating || labels.length === 0}
            className="bg-[#2d4a2d] hover:bg-[#1a2d1a] disabled:opacity-50 text-white font-bold text-xs px-4 py-2.5 rounded-lg transition shadow-md flex items-center gap-2 uppercase tracking-wider"
          >
            <Printer className="w-4 h-4 text-[#88b04b]" /> Print Label Sheet
          </button>
        </div>
      </div>

      {/* Generating Indicator */}
      {isGenerating && (
        <div className="text-center py-12 text-slate-500 text-xs flex items-center justify-center gap-2">
          <div className="animate-spin h-5 w-5 border-2 border-emerald-600 border-t-transparent rounded-full" />
          Rendering {filteredPipes.length} QR labels…
        </div>
      )}

      {/* PREVIEW GRID */}
      {!isGenerating && labels.length > 0 && (
        <>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Preview — {labels.length} label{labels.length !== 1 ? 's' : ''} ready to print
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {labels.map((item) => (
              <div
                key={item.pipeId}
                className="bg-white border-2 border-slate-900 rounded-xl p-3 text-center space-y-2 shadow-sm"
              >
                <div className="border-b pb-1">
                  <div className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">
                    DR. REDDY'S FOUNDATION
                  </div>
                  <div className="text-[9px] font-bold text-slate-500 flex items-center justify-between mt-0.5">
                    <span>AWD WATER MGMT</span>
                    <span className="text-emerald-700 font-mono text-[9px]">{item.batchNo}</span>
                  </div>
                </div>
                <div className="p-1 bg-white inline-block">
                  <img src={item.dataUrl} alt={`QR Code ${item.pipeId}`} className="w-28 h-28 mx-auto" />
                </div>
                <div className="bg-slate-900 text-white rounded-lg py-1.5 px-2">
                  <span className="font-mono font-black text-sm tracking-wider block">{item.pipeId}</span>
                  <span className="text-[7.5px] font-extrabold text-emerald-300 tracking-tight block uppercase">
                    DR. REDDY'S FOUNDATION • SCAN TO INSPECT
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {!isGenerating && labels.length === 0 && (
        <div className="text-center py-16 text-slate-400 text-sm">No pipes found for this batch.</div>
      )}

    </div>
  );
};
