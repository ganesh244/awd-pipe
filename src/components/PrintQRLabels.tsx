import React, { useState, useEffect } from 'react';
import { AWDPipe } from '../types';
import { Printer, QrCode, Sliders, CheckCircle2, Plus } from 'lucide-react';
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

  const batches = Array.from(new Set(pipes.map((p) => p.Batch_No)));

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
            width: 180,
            margin: 1,
            color: { dark: '#042f2e', light: '#ffffff' },
          });
          generated.push({
            pipeId: pipe.Pipe_ID,
            batchNo: pipe.Batch_No,
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
    window.print();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Control Bar (Hidden during print) */}
      <div className="print:hidden bg-white p-5 rounded-lg border border-[#d1dbd1] shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#2d3a2d] tracking-tight flex items-center gap-2 uppercase">
            <Printer className="w-6 h-6 text-[#88b04b]" />
            Field QR Label Printing Center
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Print weather-resistant QR stickers for AWD pipes. Includes human-readable Pipe ID text below each code.
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
                  Batch: {b}
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
            className="bg-[#2d4a2d] hover:bg-[#1a2d1a] text-white font-bold text-xs px-4 py-2.5 rounded-lg transition shadow-md flex items-center gap-2 uppercase tracking-wider"
          >
            <Printer className="w-4 h-4 text-[#88b04b]" /> Print Label Sheet
          </button>
        </div>
      </div>

      {/* Generating Indicator */}
      {isGenerating && (
        <div className="text-center py-12 text-slate-500 text-xs flex items-center justify-center gap-2">
          <div className="animate-spin h-5 w-5 border-2 border-emerald-600 border-t-transparent rounded-full" />
          Rendering printable QR labels for {filteredPipes.length} AWD Pipes...
        </div>
      )}

      {/* PRINTABLE QR LABELS GRID */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 print:grid-cols-3 print:gap-2">
        {labels.map((item) => (
          <div
            key={item.pipeId}
            className="bg-white border-2 border-slate-900 rounded-xl p-3 text-center space-y-2 shadow-sm break-inside-avoid print:shadow-none"
          >
            {/* Header Badge */}
            <div className="text-[10px] font-bold tracking-wider text-slate-500 uppercase flex items-center justify-between border-b pb-1">
              <span>AWD PIPE</span>
              <span className="text-emerald-700 font-mono text-[9px]">{item.batchNo}</span>
            </div>

            {/* QR Image */}
            <div className="p-1 bg-white inline-block">
              <img src={item.dataUrl} alt={`QR Code ${item.pipeId}`} className="w-28 h-28 mx-auto" />
            </div>

            {/* Human-Readable Pipe ID Below QR Code */}
            <div className="bg-slate-900 text-white rounded-lg py-1.5 px-2">
              <span className="font-mono font-black text-sm tracking-wider block">
                {item.pipeId}
              </span>
              <span className="text-[8px] text-emerald-300 tracking-tight block">
                SCAN TO REGISTER / INSPECT
              </span>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
};
