import React, { useState } from 'react';
import { AWDPipe } from '../types';
import { QrCode, ShieldCheck, CheckCircle2, Sparkles, X, Plus, Printer, MapPin, Building2, Calendar } from 'lucide-react';

interface GenerateBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBatchGenerated: (newPipes: AWDPipe[], batchNo: string) => void;
  onNavigateToLabels?: () => void;
  existingPipeCount: number;
}

const INDIAN_STATES = [
  { code: 'TS', name: 'Telangana (TS)' },
  { code: 'AP', name: 'Andhra Pradesh (AP)' },
  { code: 'KA', name: 'Karnataka (KA)' },
  { code: 'MH', name: 'Maharashtra (MH)' },
  { code: 'TN', name: 'Tamil Nadu (TN)' },
  { code: 'OD', name: 'Odisha (OD)' },
  { code: 'PB', name: 'Punjab (PB)' },
  { code: 'UP', name: 'Uttar Pradesh (UP)' },
];

const POPULAR_DISTRICTS: Record<string, { code: string; name: string }[]> = {
  TS: [
    { code: 'KRM', name: 'Karimnagar (KRM)' },
    { code: 'NGD', name: 'Nalgonda (NGD)' },
    { code: 'KMN', name: 'Khammam (KMN)' },
    { code: 'MDK', name: 'Medak (MDK)' },
    { code: 'PED', name: 'Peddapalli (PED)' },
  ],
  AP: [
    { code: 'GNT', name: 'Guntur (GNT)' },
    { code: 'VSP', name: 'Visakhapatnam (VSP)' },
    { code: 'EG', name: 'East Godavari (EG)' },
    { code: 'WG', name: 'West Godavari (WG)' },
  ],
  KA: [
    { code: 'RAI', name: 'Raichur (RAI)' },
    { code: 'SHI', name: 'Shivamogga (SHI)' },
    { code: 'BELL', name: 'Ballari (BELL)' },
  ],
};

const PIPE_SPECS = [
  '150mm (6") Perforated PVC Pipe (Standard)',
  '100mm (4") Perforated PVC Pipe (Smallholder)',
  '150mm Eco-Bamboo Fabricated Perforated Pipe',
  'Custom Certified Heavy-Duty AWD Pipe',
];

const PROGRAM_SPONSORS = [
  { code: 'GOVT-AGRI', name: 'State Dept of Agriculture' },
  { code: 'IRRI-AWD', name: 'IRRI Climate Resilient Rice Program' },
  { code: 'NABARD', name: 'NABARD Sustainable Paddy Initiative' },
  { code: 'CARBON-CO', name: 'Verra / Gold Standard Carbon Project' },
];

export const GenerateBatchModal: React.FC<GenerateBatchModalProps> = ({
  isOpen,
  onClose,
  onBatchGenerated,
  onNavigateToLabels,
  existingPipeCount,
}) => {
  const [stateCode, setStateCode] = useState('TS');
  const [year, setYear] = useState('2026');
  const [districtCode, setDistrictCode] = useState('KRM');
  const [customDistrict, setCustomDistrict] = useState('');
  const [programCode, setProgramCode] = useState('GOVT-AGRI');
  const [specification, setSpecification] = useState('150mm (6") Perforated PVC Pipe (Standard)');
  const [count, setCount] = useState(10);
  const [startSequence, setStartSequence] = useState(existingPipeCount + 1);

  const [generatedResult, setGeneratedResult] = useState<{
    batchNo: string;
    pipes: AWDPipe[];
  } | null>(null);

  if (!isOpen) return null;

  const effectiveDistrict = districtCode === 'CUSTOM' ? (customDistrict.trim().toUpperCase() || 'DIST') : districtCode;
  const batchNo = `BATCH-${stateCode}-${year}-${effectiveDistrict}-${programCode}`;

  // Generate sample format preview
  const samplePipesPreview = Array.from({ length: Math.min(3, count) }).map((_, idx) => {
    const seq = startSequence + idx;
    const seqStr = ('0000' + seq).slice(-4);
    return `AWD-${stateCode}-${year}-${effectiveDistrict}-${seqStr}`;
  });

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();

    const newPipes: AWDPipe[] = [];
    for (let i = 0; i < count; i++) {
      const seqNum = startSequence + i;
      const seqStr = ('0000' + seqNum).slice(-4);
      const pipeId = `AWD-${stateCode}-${year}-${effectiveDistrict}-${seqStr}`;
      
      // Anti-counterfeiting authenticity hash (simulated SHA256 snippet)
      const secHash = Math.random().toString(36).substring(2, 8).toUpperCase();

      newPipes.push({
        Pipe_ID: pipeId,
        Batch_No: batchNo,
        QR_URL: `?id=${pipeId}&sec=${secHash}`,
        Status: 'Available',
        State: stateCode,
        District: effectiveDistrict,
        Year: year,
        Specification: specification,
        Security_Hash: secHash,
      });
    }

    onBatchGenerated(newPipes, batchNo);
    setGeneratedResult({ batchNo, pipes: newPipes });
  };

  const handleReset = () => {
    setGeneratedResult(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-[#d1dbd1] overflow-hidden my-8 animate-scaleIn">
        
        {/* Modal Header */}
        <div className="bg-[#2d4a2d] text-white p-5 flex items-center justify-between border-b border-[#3d5d3d]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#88b04b] flex items-center justify-center text-white font-bold shadow">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold uppercase tracking-wider text-white">
                Generate Authenticated QR Batch
              </h2>
              <p className="text-[11px] text-[#d1dbd1]">
                Answer batch security questions to mint unique traceability QR codes
              </p>
            </div>
          </div>
          <button
            onClick={handleReset}
            className="text-slate-300 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        {generatedResult ? (
          /* SUCCESS STATE */
          <div className="p-6 space-y-5 text-center">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto border-2 border-emerald-300 shadow-inner">
              <CheckCircle2 className="w-8 h-8 text-[#88b04b]" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-[#2d3a2d] uppercase tracking-wide">
                Successfully Generated {generatedResult.pipes.length} QR Codes!
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Batch Tag: <span className="font-mono font-bold text-[#2d4a2d] bg-slate-100 px-2 py-0.5 rounded">{generatedResult.batchNo}</span>
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left space-y-2">
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#88b04b]" /> Authentic Pipe ID Samples:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                {generatedResult.pipes.slice(0, 4).map((p) => (
                  <div key={p.Pipe_ID} className="bg-white p-2 rounded border border-slate-200 text-[#2d3a2d] font-bold">
                    {p.Pipe_ID} <span className="text-[10px] text-emerald-600">✓ Sec:{p.Security_Hash}</span>
                  </div>
                ))}
              </div>
              {generatedResult.pipes.length > 4 && (
                <p className="text-[10px] text-slate-400 italic">
                  + {generatedResult.pipes.length - 4} more unique QR codes added to inventory.
                </p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleReset}
                className="w-full sm:w-auto bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold px-5 py-2.5 rounded-lg transition uppercase tracking-wider"
              >
                Done
              </button>
              {onNavigateToLabels && (
                <button
                  type="button"
                  onClick={() => {
                    handleReset();
                    onNavigateToLabels();
                  }}
                  className="w-full sm:w-auto bg-[#2d4a2d] hover:bg-[#1a2d1a] text-white text-xs font-bold px-5 py-2.5 rounded-lg transition shadow flex items-center justify-center gap-2 uppercase tracking-wider border-b-2 border-black/20"
                >
                  <Printer className="w-4 h-4 text-[#88b04b]" /> Print QR Label Sheet Now
                </button>
              )}
            </div>
          </div>
        ) : (
          /* FORM QUESTIONS STATE */
          <form onSubmit={handleGenerate} className="p-6 space-y-4">
            
            <div className="bg-[#f4f7f2] border border-[#d1dbd1] p-3 rounded-lg text-xs text-[#2d3a2d] flex items-start gap-2">
              <ShieldCheck className="w-5 h-5 text-[#88b04b] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold uppercase tracking-wide">Authenticity & Traceability Guarantee:</span>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Answering region, state, and batch questions generates a standardized <code className="bg-white px-1 py-0.5 rounded font-bold">AWD-[STATE]-[YEAR]-[DIST]-[SEQ]</code> code preventing counterfeit field registrations in Apps Script and carbon credit databases.
                </p>
              </div>
            </div>

            {/* QUESTION 1 & 2: State & Year */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#2d3a2d] uppercase tracking-wider mb-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-[#88b04b]" /> 1. State Code
                </label>
                <select
                  value={stateCode}
                  onChange={(e) => {
                    setStateCode(e.target.value);
                    const defaultDist = POPULAR_DISTRICTS[e.target.value]?.[0]?.code || 'KRM';
                    setDistrictCode(defaultDist);
                  }}
                  className="w-full border-2 border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 bg-white outline-none focus:border-[#88b04b]"
                >
                  {INDIAN_STATES.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#2d3a2d] uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-[#88b04b]" /> 2. Batch Year
                </label>
                <select
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="w-full border-2 border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 bg-white outline-none focus:border-[#88b04b]"
                >
                  <option value="2026">2026 Season</option>
                  <option value="2025">2025 Season</option>
                  <option value="2027">2027 Season</option>
                </select>
              </div>
            </div>

            {/* QUESTION 3: District Code */}
            <div>
              <label className="block text-xs font-bold text-[#2d3a2d] uppercase tracking-wider mb-1 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-[#88b04b]" /> 3. District / Agriculture Zone Code
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <select
                  value={districtCode}
                  onChange={(e) => setDistrictCode(e.target.value)}
                  className="border-2 border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 bg-white outline-none focus:border-[#88b04b]"
                >
                  {(POPULAR_DISTRICTS[stateCode] || []).map((d) => (
                    <option key={d.code} value={d.code}>
                      {d.name}
                    </option>
                  ))}
                  <option value="CUSTOM">+ Custom 3-Letter District Code</option>
                </select>

                {districtCode === 'CUSTOM' && (
                  <input
                    type="text"
                    maxLength={4}
                    value={customDistrict}
                    onChange={(e) => setCustomDistrict(e.target.value.toUpperCase())}
                    placeholder="E.g. HYD, MBN"
                    className="border-2 border-slate-200 rounded-lg p-2 text-xs font-bold uppercase text-slate-800 outline-none focus:border-[#88b04b]"
                  />
                )}
              </div>
            </div>

            {/* QUESTION 4: Quantity of Codes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#2d3a2d] uppercase tracking-wider mb-1">
                  4. Number of QRs to Mint
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={count}
                    onChange={(e) => setCount(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full border-2 border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 outline-none focus:border-[#88b04b]"
                  />
                  <div className="flex gap-1">
                    {[10, 25, 50].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setCount(num)}
                        className={`text-[10px] font-bold px-2 py-1.5 rounded border ${
                          count === num ? 'bg-[#2d4a2d] text-white border-[#2d4a2d]' : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        +{num}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#2d3a2d] uppercase tracking-wider mb-1">
                  Starting Sequence No.
                </label>
                <input
                  type="number"
                  min={1}
                  value={startSequence}
                  onChange={(e) => setStartSequence(parseInt(e.target.value) || 1)}
                  className="w-full border-2 border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-800 outline-none focus:border-[#88b04b]"
                />
              </div>
            </div>

            {/* REALTIME FORMAT PREVIEW BOX */}
            <div className="bg-[#2d3a2d]/5 border-2 border-dashed border-[#88b04b] rounded-xl p-3 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-[#2d3a2d] uppercase tracking-wider">
                <span>Generated QR Format Preview:</span>
                <span className="text-emerald-700 font-mono text-[10px]">{batchNo}</span>
              </div>
              <div className="flex flex-wrap gap-1.5 font-mono text-xs">
                {samplePipesPreview.map((id) => (
                  <span key={id} className="bg-white border border-[#88b04b] text-[#2d4a2d] font-bold px-2 py-0.5 rounded shadow-xs">
                    {id}
                  </span>
                ))}
                {count > 3 && <span className="text-slate-400 text-[10px] self-center">... ({count} total)</span>}
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 transition uppercase tracking-wider"
              >
                Cancel
              </button>

              <button
                type="submit"
                className="bg-[#2d4a2d] hover:bg-[#1a2d1a] text-white font-bold text-xs px-5 py-2.5 rounded-lg transition shadow-md flex items-center gap-2 uppercase tracking-wider border-b-2 border-black/20"
              >
                <Sparkles className="w-4 h-4 text-[#88b04b]" />
                Generate {count} Authenticated QRs
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
};
