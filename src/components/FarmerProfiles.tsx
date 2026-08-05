import React, { useState, useMemo } from 'react';
import ReactDOM from 'react-dom';
import {
  Search, User, Phone, MapPin, Sprout, Droplet, ClipboardList,
  CheckCircle2, AlertTriangle, ChevronDown, ChevronUp, Eye,
  BarChart3, Layers, Calendar, Ruler, Camera, X, Printer, ArrowRight,
  ArrowDownToLine, FileText, ZoomIn, Edit2, Trash2, UserCheck
} from 'lucide-react';
import { PhotoLightbox } from './PhotoLightbox';
import { Installation, MonitoringRecord, User as UserType, AWDPipe } from '../types';

// ── Download Helpers ──────────────────────────────────────────────────────────

const downloadCSV = (filename: string, rows: string[][], headers: string[]) => {
  const escape = (v: any) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const BOM = '\uFEFF';
  const content = BOM + [headers, ...rows].map((r) => r.map(escape).join(',')).join('\r\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const downloadFarmerCSV = (
  farmerName: string,
  installations: Installation[],
  monitoringList: MonitoringRecord[]
) => {
  // Sheet 1 — Installations (one row per pipe)
  const instHeaders = [
    'Pipe ID', 'Farmer Name', 'Mobile', 'Farmer ID', 'Village', 'Mandal', 'District', 'State',
    'Survey No', 'Plot Size', 'Plot Unit', 'Crop', 'Variety', 'Establishment Method',
    'Sowing Date', 'Irrigation Source', 'Installation Date', 'Installed By',
    'GPS Lat', 'GPS Lng', 'GPS Accuracy (m)', 'Map Link', 'Remarks',
  ];
  const instRows = installations.map((i) => [
    i.Pipe_ID, i.Farmer_Name, i.Mobile, i.Farmer_ID ?? '',
    i.Village, i.Mandal, i.District, i.State ?? '',
    i.Survey_No ?? '', i.Plot_Size, i.Plot_Size_Unit,
    i.Crop, i.Variety ?? '', i.Establishment_Method,
    i.Sowing_Transplantation_Date, i.Irrigation_Source,
    i.Installation_Date, i.Installed_By,
    i.Latitude, i.Longitude, i.GPS_Accuracy, i.Location_Link,
    String(i.Remarks ?? ''),
  ] as string[]);

  // Sheet 2 — Monitoring visits (one row per visit)
  const allPipeIds = new Set(installations.map((i) => i.Pipe_ID));
  const visits = monitoringList.filter((m) => allPipeIds.has(m.Pipe_ID));
  const visitHeaders = [
    'Pipe ID', 'Farmer Name', 'Visit Date', 'Water Level (cm)', 'Crop Stage',
    'AWD Followed', 'Pipe Condition', 'Visited By', 'GPS Lat', 'GPS Lng', 'Remarks',
  ];
  const visitRows = visits.map((v) => [
    v.Pipe_ID, farmerName, v.Visit_Date, v.Water_Level, v.Crop_Stage,
    v.AWD_Followed, v.Pipe_Condition, v.Visited_By,
    String(v.Latitude), String(v.Longitude), v.Remarks ?? '',
  ] as string[]);

  // Combine both into one CSV with separator
  const separator = [[''], ['=== MONITORING VISITS ==='], ['']];
  downloadCSV(
    `Farmer_Report_${farmerName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`,
    [...instRows, ...separator, visitHeaders.map((_) => ''), ...visitRows],
    instHeaders
  );
};

const printFarmerFullReport = (
  farmerName: string,
  installations: Installation[],
  monitoringList: MonitoringRecord[],
  totalAcres: number,
  awdPct: number | null
) => {
  const allPipeIds = new Set(installations.map((i) => i.Pipe_ID));
  const allVisits = monitoringList.filter((m) => allPipeIds.has(m.Pipe_ID));
  const rep = installations[0];
  const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-IN') : '—';

  const pipeSections = installations.map((inst, idx) => {
    const visits = monitoringList.filter((m) => m.Pipe_ID === inst.Pipe_ID);
    return `
      <div class="pipe-card">
        <div class="pipe-header">
          <span class="pipe-id">${inst.Pipe_ID}</span>
          <span class="tag">${inst.Crop} • ${inst.Plot_Size} ${inst.Plot_Size_Unit}</span>
          <span class="tag">${inst.Village}, ${inst.Mandal}</span>
        </div>
        <div class="kv-grid">
          <div class="kv"><span class="k">Survey No.</span><span class="v">${inst.Survey_No ?? '—'}</span></div>
          <div class="kv"><span class="k">Method</span><span class="v">${inst.Establishment_Method}</span></div>
          <div class="kv"><span class="k">Irrigation</span><span class="v">${inst.Irrigation_Source}</span></div>
          <div class="kv"><span class="k">Sowing Date</span><span class="v">${fmtDate(inst.Sowing_Transplantation_Date)}</span></div>
          <div class="kv"><span class="k">Install Date</span><span class="v">${fmtDate(inst.Installation_Date)}</span></div>
          <div class="kv"><span class="k">Installed By</span><span class="v">${inst.Installed_By}</span></div>
          <div class="kv"><span class="k">GPS</span><span class="v"><a href="${inst.Location_Link}" target="_blank">${inst.Latitude}, ${inst.Longitude}</a></span></div>
          <div class="kv"><span class="k">Variety</span><span class="v">${inst.Variety ?? '—'}</span></div>
        </div>
        ${inst.Photo_URL ? `<div class="photo-row"><img src="${inst.Photo_URL}" class="field-photo" alt="Field Photo"/></div>` : ''}
        <div class="visit-section">
          <div class="visit-title">📋 Monitoring Visits (${visits.length})</div>
          ${
            visits.length === 0
              ? '<p class="no-visits">No monitoring visits recorded yet.</p>'
              : `<table class="visit-table">
                  <thead><tr>
                    <th>Visit Date</th><th>Water Level</th><th>Crop Stage</th>
                    <th>AWD Followed</th><th>Pipe Condition</th><th>Visited By</th><th>Remarks</th>
                  </tr></thead>
                  <tbody>
                    ${visits.map((v) => `
                      <tr>
                        <td>${fmtDate(v.Visit_Date)}</td>
                        <td>${v.Water_Level} cm</td>
                        <td>${v.Crop_Stage}</td>
                        <td class="${v.AWD_Followed === 'Yes' ? 'good' : 'warn'}">${v.AWD_Followed}</td>
                        <td class="${v.Pipe_Condition === 'Good' ? 'good' : 'bad'}">${v.Pipe_Condition}</td>
                        <td>${v.Visited_By}</td>
                        <td>${v.Remarks ?? '—'}</td>
                      </tr>`).join('')}
                  </tbody>
                </table>`
          }
        </div>
      </div>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Farmer Complete Report — ${farmerName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #1e293b; background: #fff; padding: 24px; }
    .header { display: flex; align-items: center; gap: 16px; border-bottom: 3px solid #16a34a; padding-bottom: 12px; margin-bottom: 20px; }
    .logo { width: 48px; height: 48px; background: linear-gradient(135deg, #14532d, #16a34a, #84cc16); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; font-size: 22px; }
    .header-text h1 { font-size: 17px; font-weight: 800; color: #14532d; }
    .farmer-hero { background: linear-gradient(135deg, #14532d, #166534); color: white; border-radius: 12px; padding: 20px 24px; margin-bottom: 16px; }
    .farmer-hero h2 { font-size: 22px; font-weight: 900; }
    .farmer-hero p { font-size: 12px; opacity: 0.85; margin-top: 6px; }
    .stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
    .stat-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; text-align: center; }
    .stat-num { font-size: 20px; font-weight: 900; color: #0f172a; }
    .stat-lbl { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }
    .pipe-card { border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 14px; overflow: hidden; page-break-inside: avoid; }
    .pipe-header { background: #f8fafc; padding: 8px 12px; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid #e2e8f0; }
    .pipe-id { font-family: monospace; font-weight: 800; font-size: 13px; color: #14532d; }
    .tag { background: #e2e8f0; color: #475569; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 20px; }
    .kv-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; }
    .kv { padding: 6px 10px; border-bottom: 1px solid #f1f5f9; border-right: 1px solid #f1f5f9; }
    .k { font-size: 10px; color: #64748b; display: block; }
    .v { font-weight: 700; font-size: 11px; color: #0f172a; }
    .v a { color: #2563eb; text-decoration: none; font-size: 10px; }
    .photo-row { padding: 10px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
    .field-photo { width: 100%; max-height: 160px; object-fit: cover; border-radius: 6px; }
    .visit-section { padding: 10px 12px; }
    .visit-title { font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 8px; }
    .no-visits { color: #94a3b8; font-size: 11px; padding: 8px; }
    .visit-table { width: 100%; border-collapse: collapse; }
    .visit-table th { background: #f1f5f9; padding: 5px 8px; text-align: left; font-size: 10px; color: #475569; text-transform: uppercase; border-bottom: 2px solid #e2e8f0; }
    .visit-table td { padding: 5px 8px; border-bottom: 1px solid #f1f5f9; font-size: 11px; }
    .good { color: #15803d; font-weight: 700; }
    .warn { color: #b45309; font-weight: 700; }
    .bad { color: #dc2626; font-weight: 700; }
    .footer { margin-top: 16px; padding-top: 8px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">🌱</div>
    <div class="header-text">
      <h1>AWD Pipe — Complete Farmer Field Report</h1>
      <p>Alternate Wetting &amp; Drying Paddy Water Management System</p>
    </div>
  </div>

  <div class="farmer-hero">
    <h2>🧑‍🌾 ${farmerName}</h2>
    <p>📞 ${rep.Mobile} &nbsp;|&nbsp; 📍 ${rep.Village}, ${rep.Mandal}, ${rep.District}, ${rep.State ?? ''} &nbsp;|&nbsp; Farmer ID: ${rep.Farmer_ID ?? '—'}</p>
  </div>

  <div class="stats-row">
    <div class="stat-card"><div class="stat-num">${installations.length}</div><div class="stat-lbl">AWD Pipes</div></div>
    <div class="stat-card"><div class="stat-num">${totalAcres.toFixed(2)} Ac</div><div class="stat-lbl">Total Area</div></div>
    <div class="stat-card"><div class="stat-num">${allVisits.length}</div><div class="stat-lbl">Monitoring Visits</div></div>
    <div class="stat-card"><div class="stat-num">${awdPct !== null ? awdPct + '%' : '—'}</div><div class="stat-lbl">AWD Compliance</div></div>
  </div>

  ${pipeSections}

  <div class="footer">
    <span>Generated: ${new Date().toLocaleString('en-IN')} | AWD Pipe System</span>
    <span>Confidential Farmer Field Report</span>
  </div>
  <script>window.onload = () => window.print();</script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (win) { win.document.write(html); win.document.close(); }
};

interface FarmerProfilesProps {
  currentUser: UserType;
  installations: Installation[];      // pre-scoped
  monitoringList: MonitoringRecord[]; // pre-scoped
  pipes: AWDPipe[];
  onUpdateInstallation?: (updated: Installation) => void;
  onDeleteInstallation?: (pipeId: string) => void;
}

const formatDate = (d?: string) => {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const AWD_COLOR = (v: string) =>
  v === 'Yes' ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
  : v === 'Partially' ? 'bg-amber-100 text-amber-700 border-amber-300'
  : 'bg-red-100 text-red-700 border-red-300';

const COND_COLOR = (v: string) =>
  v === 'Good' ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
  : v === 'Damaged' ? 'bg-red-100 text-red-700 border-red-300'
  : 'bg-amber-100 text-amber-700 border-amber-300';

// ── Edit Farmer Modal ──────────────────────────────────────────────────────────
const EditFarmerModal: React.FC<{
  inst: Installation;
  onSave: (updated: Installation) => void;
  onClose: () => void;
}> = ({ inst, onSave, onClose }) => {
  const [form, setForm] = useState<Installation>({ ...inst });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
    onClose();
  };

  return ReactDOM.createPortal(
    <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-md z-[9999] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl border border-slate-200 my-8">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <Edit2 className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base font-extrabold text-slate-900">
              Edit Farmer & Field Registration ({inst.Pipe_ID})
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          {/* Section 1: Farmer Personal Details */}
          <div>
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Farmer Information</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Farmer Name *</label>
                <input
                  type="text"
                  required
                  value={form.Farmer_Name}
                  onChange={(e) => setForm({ ...form, Farmer_Name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mobile Number *</label>
                <input
                  type="text"
                  required
                  value={form.Mobile}
                  onChange={(e) => setForm({ ...form, Mobile: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Farmer ID</label>
                <input
                  type="text"
                  value={form.Farmer_ID || ''}
                  onChange={(e) => setForm({ ...form, Farmer_ID: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-semibold"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Location */}
          <div>
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Location Details</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Village *</label>
                <input
                  type="text"
                  required
                  value={form.Village}
                  onChange={(e) => setForm({ ...form, Village: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mandal *</label>
                <input
                  type="text"
                  required
                  value={form.Mandal}
                  onChange={(e) => setForm({ ...form, Mandal: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">District *</label>
                <input
                  type="text"
                  required
                  value={form.District}
                  onChange={(e) => setForm({ ...form, District: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">State</label>
                <input
                  type="text"
                  value={form.State || ''}
                  onChange={(e) => setForm({ ...form, State: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-semibold"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Field & Crop Details */}
          <div>
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Field & Crop Specifications</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Survey No.</label>
                <input
                  type="text"
                  value={form.Survey_No || ''}
                  onChange={(e) => setForm({ ...form, Survey_No: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Plot Size *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={form.Plot_Size}
                  onChange={(e) => setForm({ ...form, Plot_Size: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Unit</label>
                <select
                  value={form.Plot_Size_Unit}
                  onChange={(e) => setForm({ ...form, Plot_Size_Unit: e.target.value as any })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-semibold"
                >
                  <option value="Acres">Acres</option>
                  <option value="Hectares">Hectares</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Crop</label>
                <input
                  type="text"
                  value={form.Crop}
                  onChange={(e) => setForm({ ...form, Crop: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Variety</label>
                <input
                  type="text"
                  value={form.Variety || ''}
                  onChange={(e) => setForm({ ...form, Variety: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Establishment Method</label>
                <input
                  type="text"
                  value={form.Establishment_Method}
                  onChange={(e) => setForm({ ...form, Establishment_Method: e.target.value as any })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-semibold"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Installation Info */}
          <div>
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Installation Meta</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Installed By</label>
                <input
                  type="text"
                  value={form.Installed_By}
                  onChange={(e) => setForm({ ...form, Installed_By: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Installation Date</label>
                <input
                  type="date"
                  value={form.Installation_Date}
                  onChange={(e) => setForm({ ...form, Installation_Date: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-semibold"
                />
              </div>
            </div>
          </div>

          <div className="pt-3 flex items-center justify-end gap-3 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-xs font-extrabold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-900/30 transition cursor-pointer"
            >
              Save Farmer Details
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

// ── Pipe Detail Card ──────────────────────────────────────────────────────────
const PipeDetailCard: React.FC<{
  inst: Installation;
  visits: MonitoringRecord[];
  pipe?: AWDPipe;
  defaultOpen?: boolean;
  onEdit?: (inst: Installation) => void;
  onDelete?: (pipeId: string, farmerName: string) => void;
}> = ({ inst, visits, pipe, defaultOpen = false, onEdit, onDelete }) => {
  const [expanded, setExpanded] = useState(defaultOpen);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxCaption, setLightboxCaption] = useState<string>('');
  const latestVisit = visits[0];

  const openLightbox = (url: string, caption: string) => {
    setLightboxUrl(url);
    setLightboxCaption(caption);
  };

  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
      {/* Photo Lightbox */}
      {lightboxUrl && (
        <PhotoLightbox
          url={lightboxUrl}
          caption={lightboxCaption}
          onClose={() => setLightboxUrl(null)}
        />
      )}
      {/* Card Header — always visible */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 bg-gradient-to-r from-slate-50 to-white hover:from-emerald-50 transition text-left"
      >
        <div className="flex items-start gap-4">
          {/* Pipe status dot */}
          <div className={`mt-0.5 w-3 h-3 rounded-full shrink-0 ${pipe?.Status === 'Installed' ? 'bg-emerald-500' : pipe?.Status === 'Damaged' ? 'bg-red-400' : 'bg-slate-300'}`} />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-extrabold text-slate-800 text-sm">{inst.Pipe_ID}</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold border bg-slate-100 text-slate-600 border-slate-200">
                {inst.Crop} • {inst.Plot_Size} {inst.Plot_Size_Unit}
              </span>
              {latestVisit && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${AWD_COLOR(latestVisit.AWD_Followed)}`}>
                  AWD: {latestVisit.AWD_Followed}
                </span>
              )}
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
              <MapPin className="w-3 h-3" />
              {inst.Village}, {inst.Mandal}, {inst.District}
              {inst.Survey_No && <span className="text-slate-400">• Survey #{inst.Survey_No}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-2">
          <div className="text-right text-xs text-slate-400 hidden sm:block">
            <div>Installed {formatDate(inst.Installation_Date)}</div>
            <div>{visits.length} visit{visits.length !== 1 ? 's' : ''}</div>
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="px-5 pb-5 pt-2 space-y-4 border-t border-slate-100">
          {/* Two-column detail grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              ['Pipe ID', inst.Pipe_ID],
              ['Mobile', inst.Mobile],
              ['Farmer ID', inst.Farmer_ID ?? '—'],
              ['Survey No.', inst.Survey_No ?? '—'],
              ['Plot Size', `${inst.Plot_Size} ${inst.Plot_Size_Unit}`],
              ['Crop', inst.Crop],
              ['Variety', inst.Variety ?? '—'],
              ['Method', inst.Establishment_Method],
              ['Sowing Date', formatDate(inst.Sowing_Transplantation_Date)],
              ['Irrigation', inst.Irrigation_Source],
              ['Installed By', inst.Installed_By],
              ['Install Date', formatDate(inst.Installation_Date)],
            ].map(([k, v]) => (
              <div key={k} className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{k}</div>
                <div className="text-xs font-bold text-slate-700 mt-0.5 break-words">{v}</div>
              </div>
            ))}
          </div>

          {/* Actions & GPS row */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-100">
            <div className="flex items-center gap-2 flex-wrap">
              {onEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(inst)}
                  className="flex items-center gap-1.5 text-xs font-extrabold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-xl transition cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" /> Edit Farmer Details
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(inst.Pipe_ID, inst.Farmer_Name)}
                  className="flex items-center gap-1.5 text-xs font-extrabold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-xl transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Remove Installation
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 flex-wrap ml-auto">
              <a
                href={inst.Location_Link}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-blue-600 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl transition"
              >
                <MapPin className="w-3.5 h-3.5 text-red-500" /> View on Maps
              </a>
              <span className="text-[11px] font-mono text-slate-400">
                GPS: {inst.Latitude}, {inst.Longitude} (±{inst.GPS_Accuracy}m)
              </span>
            </div>
          </div>

          {/* Field photo (Full Uncropped View) */}
          {inst.Photo_URL && (
            <div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Camera className="w-3.5 h-3.5 text-emerald-600" /> Installation Photo
                </span>
                <span className="text-[10px] text-emerald-600 font-extrabold flex items-center gap-0.5 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                  <ZoomIn className="w-3 h-3" /> Click for HD Fullscreen
                </span>
              </div>
              <button
                type="button"
                onClick={() => openLightbox(inst.Photo_URL!, `Installation Photo — ${inst.Pipe_ID}`)}
                className="w-full group relative overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 p-2 shadow-inner hover:border-emerald-500 transition-all cursor-pointer"
              >
                <div className="w-full flex items-center justify-center min-h-[160px] max-h-72 overflow-hidden">
                  <img
                    src={inst.Photo_URL}
                    alt="Field Installation"
                    className="max-h-64 max-w-full w-auto object-contain rounded-xl group-hover:scale-[1.02] transition-transform duration-300 shadow-xl"
                  />
                </div>
                <div className="absolute inset-0 bg-slate-950/0 group-hover:bg-slate-950/40 transition-all flex items-center justify-center">
                  <span className="opacity-0 group-hover:opacity-100 transition-all bg-emerald-600 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl shadow-2xl flex items-center gap-1.5 transform translate-y-2 group-hover:translate-y-0">
                    <ZoomIn className="w-4 h-4" /> Expand Uncropped Image
                  </span>
                </div>
              </button>
            </div>
          )}

          {/* Monitoring visits */}
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
              <ClipboardList className="w-3.5 h-3.5" /> Monitoring Visits ({visits.length})
            </div>
            {visits.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl text-slate-400 text-xs">
                <AlertTriangle className="w-5 h-5 mx-auto mb-1 opacity-40" />
                No monitoring visits recorded for this pipe yet.
              </div>
            ) : (
              <div className="space-y-2">
                {visits.map((v, i) => (
                  <div key={i} className="bg-slate-50 border border-slate-100 rounded-xl p-3 space-y-2">
                    <div className="flex gap-3 items-start">
                      <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-[10px] font-extrabold flex items-center justify-center shrink-0">
                        {i + 1}
                      </div>
                      <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs">
                        <div><span className="text-slate-400">Date:</span> <span className="font-bold">{formatDate(v.Visit_Date)}</span></div>
                        <div><span className="text-slate-400">Water Level:</span> <span className="font-bold">{v.Water_Level}</span></div>
                        <div><span className="text-slate-400">Crop Stage:</span> <span className="font-bold">{v.Crop_Stage}</span></div>
                        <div>
                          <span className="text-slate-400">AWD Followed:</span>{' '}
                          <span className={`font-bold px-1.5 py-0.5 rounded border text-[10px] ${AWD_COLOR(v.AWD_Followed)}`}>{v.AWD_Followed}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Pipe Condition:</span>{' '}
                          <span className={`font-bold px-1.5 py-0.5 rounded border text-[10px] ${COND_COLOR(v.Pipe_Condition)}`}>{v.Pipe_Condition}</span>
                        </div>
                        <div><span className="text-slate-400">Visited By:</span> <span className="font-bold">{v.Visited_By}</span></div>
                        {v.Remarks && (
                          <div className="col-span-2 sm:col-span-3">
                            <span className="text-slate-400">Remarks:</span> <span className="font-semibold">{v.Remarks}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Visit Photo (Full Uncropped View) */}
                    {v.Photo_URL && (
                      <button
                        type="button"
                        onClick={() => openLightbox(v.Photo_URL!, `Visit Photo — ${formatDate(v.Visit_Date)} · ${inst.Pipe_ID}`)}
                        className="w-full group relative overflow-hidden rounded-xl border border-slate-700 bg-slate-950 p-1.5 shadow-inner hover:border-blue-400 transition-all ml-10 mt-1 cursor-pointer"
                        style={{ maxWidth: 'calc(100% - 2.5rem)' }}
                      >
                        <div className="flex items-center justify-between text-[10px] text-slate-300 font-bold uppercase tracking-wider px-2 pt-1 pb-1">
                          <span className="flex items-center gap-1"><Camera className="w-3 h-3 text-blue-400" /> Visit Photo</span>
                          <span className="text-blue-400 font-extrabold flex items-center gap-0.5"><ZoomIn className="w-3 h-3" /> Uncropped HD</span>
                        </div>
                        <div className="w-full flex items-center justify-center min-h-[120px] max-h-52 overflow-hidden bg-slate-900 rounded-lg p-1">
                          <img
                            src={v.Photo_URL}
                            alt="Visit"
                            className="max-h-48 max-w-full w-auto object-contain rounded group-hover:scale-[1.02] transition-transform duration-300"
                          />
                        </div>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Farmer Profile Full View ──────────────────────────────────────────────────
const FarmerFullProfile: React.FC<{
  farmerName: string;
  installations: Installation[];
  monitoringList: MonitoringRecord[];
  pipes: AWDPipe[];
  onBack: () => void;
  onEditInst?: (inst: Installation) => void;
  onDeleteInst?: (pipeId: string, farmerName: string) => void;
}> = ({ farmerName, installations, monitoringList, pipes, onBack, onEditInst, onDeleteInst }) => {
  const farmerInsts = installations.filter((i) => i.Farmer_Name === farmerName);
  const allPipeIds = new Set(farmerInsts.map((i) => i.Pipe_ID));
  const farmerVisits = monitoringList.filter((m) => allPipeIds.has(m.Pipe_ID));

  if (farmerInsts.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center space-y-4 shadow-sm animate-fadeIn">
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto text-2xl font-bold shadow-inner">
          🗑️
        </div>
        <div>
          <h3 className="text-lg font-extrabold text-slate-900">
            Farmer Field Record Deleted
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 font-semibold">
            All registered pipe installations for <strong className="text-slate-800">{farmerName}</strong> have been deleted from the system.
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-900/30 transition cursor-pointer"
        >
          ← Back to Farmers Search
        </button>
      </div>
    );
  }

  // Stats
  const totalAcres = farmerInsts.reduce((sum, i) => {
    const val = i.Plot_Size_Unit === 'Hectares' ? i.Plot_Size * 2.47105 : i.Plot_Size;
    return sum + val;
  }, 0);
  const goodPipes = farmerInsts.filter((i) => {
    const visits = monitoringList.filter((m) => m.Pipe_ID === i.Pipe_ID);
    return visits.length === 0 || visits[0]?.Pipe_Condition === 'Good';
  }).length;
  const awdYes = farmerVisits.filter((v) => v.AWD_Followed === 'Yes').length;
  const awdPct = farmerVisits.length > 0 ? Math.round((awdYes / farmerVisits.length) * 100) : null;

  // Representative info (from latest installation)
  const rep = farmerInsts[farmerInsts.length - 1];

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Back button + Download buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800 transition"
        >
          ← Back to search
        </button>
        <div className="flex gap-2 sm:ml-auto flex-wrap">
          <button
            onClick={() => downloadFarmerCSV(farmerName, farmerInsts, monitoringList)}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow transition"
          >
            <ArrowDownToLine className="w-3.5 h-3.5" />
            Download CSV Report
          </button>
          <button
            onClick={() => printFarmerFullReport(farmerName, farmerInsts, monitoringList, totalAcres, awdPct)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow transition"
          >
            <Printer className="w-3.5 h-3.5" />
            Print / Save PDF
          </button>
        </div>
      </div>

      {/* Profile Header Card */}
      <div className="bg-gradient-to-br from-emerald-700 to-emerald-900 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4" />
        <div className="absolute left-0 bottom-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-3xl shrink-0">
            🧑‍🌾
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-extrabold tracking-tight">{farmerName}</h2>
            <div className="flex flex-wrap gap-2 sm:gap-3 mt-2 text-sm text-emerald-100 items-center">
              <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{rep.Mobile}</span>
              <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{rep.Village}, {rep.Mandal}, {rep.District}</span>
              {rep.Farmer_ID && <span className="flex items-center gap-1">ID: {rep.Farmer_ID}</span>}
              <span className="flex items-center gap-1 bg-emerald-800/80 px-2.5 py-0.5 rounded-lg text-xs font-bold text-white border border-emerald-400/40">
                <UserCheck className="w-3.5 h-3.5 text-emerald-300" />
                Installed By: {rep.Installed_By || 'CF Officer'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: Layers, label: 'AWD Pipes', value: farmerInsts.length, sub: 'registered', color: 'emerald' },
          { icon: Ruler, label: 'Total Area', value: `${totalAcres.toFixed(2)} Ac`, sub: 'across all plots', color: 'blue' },
          { icon: ClipboardList, label: 'Field Visits', value: farmerVisits.length, sub: 'total monitoring', color: 'violet' },
          { icon: Droplet, label: 'AWD Compliance', value: awdPct !== null ? `${awdPct}%` : '—', sub: 'visits followed AWD', color: 'teal' },
        ].map(({ icon: Icon, label, value, sub, color }) => (
          <div key={label} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className={`w-8 h-8 rounded-lg bg-${color}-100 flex items-center justify-center mb-2`}>
              <Icon className={`w-4 h-4 text-${color}-600`} />
            </div>
            <div className="text-xl font-extrabold text-slate-800">{value}</div>
            <div className="text-xs font-semibold text-slate-600 mt-0.5">{label}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">{sub}</div>
          </div>
        ))}
      </div>

      {/* All pipes section */}
      <div>
        <h3 className="text-sm font-extrabold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Sprout className="w-4 h-4 text-emerald-600" />
          All Registered Plots & Pipes ({farmerInsts.length})
          <span className="text-xs font-normal text-slate-400 normal-case">Click any row to expand</span>
        </h3>
        <div className="space-y-3">
          {farmerInsts.map((inst, idx) => {
            const visits = monitoringList.filter((m) => m.Pipe_ID === inst.Pipe_ID);
            const pipe = pipes.find((p) => p.Pipe_ID === inst.Pipe_ID);
            return (
              <PipeDetailCard
                key={inst.Pipe_ID}
                inst={inst}
                visits={visits}
                pipe={pipe}
                defaultOpen={idx === 0}
                onEdit={onEditInst}
                onDelete={onDeleteInst}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
export const FarmerProfiles: React.FC<FarmerProfilesProps> = ({
  currentUser,
  installations,
  monitoringList,
  pipes,
  onUpdateInstallation,
  onDeleteInstallation,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFarmer, setSelectedFarmer] = useState<string | null>(null);
  const [editingInst, setEditingInst] = useState<Installation | null>(null);
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{ pipeId: string; farmerName: string } | null>(null);

  // Build unique farmer list
  const farmerMap = useMemo(() => {
    const map = new Map<string, Installation[]>();
    installations.forEach((inst) => {
      if (!map.has(inst.Farmer_Name)) map.set(inst.Farmer_Name, []);
      map.get(inst.Farmer_Name)!.push(inst);
    });
    return map;
  }, [installations]);

  const farmerList = useMemo(() => {
    return Array.from(farmerMap.entries()).map(([name, insts]) => {
      const totalAcres = insts.reduce((sum, i) => {
        const val = i.Plot_Size_Unit === 'Hectares' ? i.Plot_Size * 2.47105 : i.Plot_Size;
        return sum + val;
      }, 0);

      const latestDate = insts.reduce((max, i) => {
        return i.Installation_Date > max ? i.Installation_Date : max;
      }, '');

      const rep = insts[0];
      return {
        name,
        insts,
        totalAcres,
        latestDate,
        rep,
      };
    });
  }, [farmerMap]);

  // Filtered farmers based on search
  const filteredFarmers = useMemo(() => {
    if (!searchQuery.trim()) return farmerList;
    const q = searchQuery.toLowerCase();
    return farmerList.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.rep.Mobile.includes(q) ||
        f.rep.Village.toLowerCase().includes(q) ||
        f.rep.Mandal.toLowerCase().includes(q) ||
        (f.rep.Farmer_ID && f.rep.Farmer_ID.toLowerCase().includes(q))
    );
  }, [farmerList, searchQuery]);

  const selectedFarmerInsts = selectedFarmer ? farmerMap.get(selectedFarmer) : null;

  return (
    <div className="space-y-6">
      {/* Edit Farmer Modal */}
      {editingInst && (
        <EditFarmerModal
          inst={editingInst}
          onSave={(updated) => {
            onUpdateInstallation?.(updated);
            setEditingInst(null);
          }}
          onClose={() => setEditingInst(null)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmTarget && ReactDOM.createPortal(
        <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-md z-[10000] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-100 text-red-600 rounded-2xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Delete Farmer Installation
                </h3>
                <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">
                  Permanent Action
                </p>
              </div>
            </div>

            <p className="text-xs font-semibold text-slate-700 leading-relaxed bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
              Are you sure you want to permanently delete the field registration for farmer <strong className="text-slate-900">{deleteConfirmTarget.farmerName}</strong> (Pipe ID: <strong className="font-mono text-emerald-600">{deleteConfirmTarget.pipeId}</strong>)? All related monitoring logs will also be removed.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmTarget(null)}
                className="px-5 py-2.5 rounded-xl text-xs font-extrabold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (deleteConfirmTarget) {
                    const pipeId = deleteConfirmTarget.pipeId;
                    const fName = deleteConfirmTarget.farmerName;
                    onDeleteInstallation?.(pipeId);
                    const remainingPipes = installations.filter(
                      (i) => i.Pipe_ID !== pipeId && i.Farmer_Name === fName
                    );
                    if (remainingPipes.length === 0) {
                      setSelectedFarmer(null);
                    }
                  }
                  setDeleteConfirmTarget(null);
                }}
                className="px-5 py-2.5 rounded-xl text-xs font-extrabold bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-900/20 transition cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Yes, Delete Record
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {selectedFarmer ? (
        <FarmerFullProfile
          farmerName={selectedFarmer}
          installations={installations.filter((i) => i.Farmer_Name === selectedFarmer)}
          monitoringList={monitoringList}
          pipes={pipes}
          onBack={() => setSelectedFarmer(null)}
          onEditInst={(inst) => setEditingInst(inst)}
          onDeleteInst={(pipeId, farmerName) => setDeleteConfirmTarget({ pipeId, farmerName })}
        />
      ) : (
        <>
          {/* Header + Search bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <User className="w-5 h-5 text-emerald-600" />
                Farmer Database &amp; Field Profiles
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Registered farmers under {currentUser.role === 'Admin' ? 'all territories' : currentUser.areaName || currentUser.district || currentUser.state} • {farmerList.length} Farmers registered
              </p>
            </div>

            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by farmer, mobile, village..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-bold text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Farmer Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredFarmers.map((f) => (
              <div
                key={f.name}
                onClick={() => setSelectedFarmer(f.name)}
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 font-extrabold flex items-center justify-center text-lg shrink-0 group-hover:scale-105 transition-transform">
                        🧑‍🌾
                      </div>
                      <div>
                        <h3 className="font-extrabold text-slate-900 text-sm group-hover:text-emerald-700 transition">
                          {f.name}
                        </h3>
                        <div className="text-xs font-semibold text-slate-500 flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {f.rep.Mobile}
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] font-extrabold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
                      {f.insts.length} Pipe{f.insts.length > 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-medium">Location:</span>
                      <span className="font-bold text-slate-800">{f.rep.Village}, {f.rep.Mandal}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-medium">Installed By (CF):</span>
                      <span className="font-extrabold text-blue-800 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200 text-[11px]">
                        {f.rep.Installed_By || 'CF Officer'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-medium">Total Plot Area:</span>
                      <span className="font-extrabold text-emerald-700">{f.totalAcres.toFixed(2)} Acres</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span>Installed {formatDate(f.latestDate)}</span>
                  <span className="text-emerald-600 font-bold group-hover:translate-x-1 transition-transform flex items-center gap-1">
                    View Profile →
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
