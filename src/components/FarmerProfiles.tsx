import React, { useState, useMemo } from 'react';
import {
  Search, User, Phone, MapPin, Sprout, Droplet, ClipboardList,
  CheckCircle2, AlertTriangle, ChevronDown, ChevronUp, Eye,
  BarChart3, Layers, Calendar, Ruler, Camera, X, Printer, ArrowRight,
  ArrowDownToLine, FileText
} from 'lucide-react';
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

// ── Pipe Detail Card ──────────────────────────────────────────────────────────
const PipeDetailCard: React.FC<{
  inst: Installation;
  visits: MonitoringRecord[];
  pipe?: AWDPipe;
  defaultOpen?: boolean;
}> = ({ inst, visits, pipe, defaultOpen = false }) => {
  const [expanded, setExpanded] = useState(defaultOpen);
  const latestVisit = visits[0];

  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
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

          {/* GPS & Photo row */}
          <div className="flex flex-wrap gap-3">
            <a
              href={inst.Location_Link}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg transition"
            >
              <MapPin className="w-3.5 h-3.5" /> View on Google Maps
            </a>
            <span className="text-xs text-slate-400 flex items-center gap-1">
              GPS: {inst.Latitude}, {inst.Longitude} (±{inst.GPS_Accuracy}m)
            </span>
          </div>

          {/* Field photo */}
          {inst.Photo_URL && (
            <div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Camera className="w-3.5 h-3.5" /> Field Photo
              </div>
              <img
                src={inst.Photo_URL}
                alt="Field"
                className="w-full max-h-48 object-cover rounded-xl border border-slate-200"
              />
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
                  <div key={i} className="flex gap-3 items-start bg-slate-50 border border-slate-100 rounded-xl p-3">
                    <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-[10px] font-extrabold flex items-center justify-center shrink-0">
                      {i + 1}
                    </div>
                    <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs">
                      <div><span className="text-slate-400">Date:</span> <span className="font-bold">{formatDate(v.Visit_Date)}</span></div>
                      <div><span className="text-slate-400">Water Level:</span> <span className="font-bold">{v.Water_Level} cm</span></div>
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
}> = ({ farmerName, installations, monitoringList, pipes, onBack }) => {
  const farmerInsts = installations.filter((i) => i.Farmer_Name === farmerName);
  const allPipeIds = new Set(farmerInsts.map((i) => i.Pipe_ID));
  const farmerVisits = monitoringList.filter((m) => allPipeIds.has(m.Pipe_ID));

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
            <div className="flex flex-wrap gap-3 mt-2 text-sm text-emerald-100">
              <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{rep.Mobile}</span>
              <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{rep.Village}, {rep.Mandal}, {rep.District}</span>
              {rep.Farmer_ID && <span className="flex items-center gap-1">ID: {rep.Farmer_ID}</span>}
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
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFarmer, setSelectedFarmer] = useState<string | null>(null);

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
      const allPipeIds = new Set(insts.map((i) => i.Pipe_ID));
      const totalVisits = monitoringList.filter((m) => allPipeIds.has(m.Pipe_ID)).length;
      const lastVisit = monitoringList.find((m) => allPipeIds.has(m.Pipe_ID));
      const rep = insts[0];
      return { name, insts, totalAcres, totalVisits, lastVisit, rep };
    });
  }, [farmerMap, monitoringList]);

  // Filtered by search
  const filteredFarmers = useMemo(() => {
    if (!searchQuery.trim()) return farmerList;
    const term = searchQuery.toLowerCase();
    const numTerm = searchQuery.replace(/\D/g, '');
    return farmerList.filter(
      (f) =>
        f.name.toLowerCase().includes(term) ||
        (f.rep.Mobile && numTerm && f.rep.Mobile.includes(numTerm)) ||
        f.rep.Village.toLowerCase().includes(term) ||
        f.rep.Mandal.toLowerCase().includes(term) ||
        (f.rep.Farmer_ID && f.rep.Farmer_ID.toLowerCase().includes(term))
    );
  }, [farmerList, searchQuery]);

  // If a farmer is selected, show their full profile
  if (selectedFarmer) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6">
        <FarmerFullProfile
          farmerName={selectedFarmer}
          installations={installations.filter((i) => i.Farmer_Name === selectedFarmer)}
          monitoringList={monitoringList}
          pipes={pipes}
          onBack={() => setSelectedFarmer(null)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-6 px-4">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 flex items-center gap-2">
            <User className="w-7 h-7 text-emerald-600" />
            Farmer Profiles
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Search any farmer to view all their pipes, plots, acreage and full monitoring history.
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by farmer name, mobile number, Farmer ID, village or mandal..."
            className="w-full pl-12 pr-12 py-3.5 text-sm border border-slate-300 rounded-2xl bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            autoFocus
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-3 p-1 rounded-full hover:bg-slate-100 transition"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          )}
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap gap-3 text-xs text-slate-500">
          <span className="bg-white border border-slate-200 px-3 py-1.5 rounded-full font-semibold">
            👨‍🌾 {farmerList.length} total farmers
          </span>
          <span className="bg-white border border-slate-200 px-3 py-1.5 rounded-full font-semibold">
            📡 {installations.length} AWD pipes registered
          </span>
          <span className="bg-white border border-slate-200 px-3 py-1.5 rounded-full font-semibold">
            📋 {monitoringList.length} monitoring visits
          </span>
          {searchQuery && (
            <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1.5 rounded-full font-semibold">
              🔍 {filteredFarmers.length} result{filteredFarmers.length !== 1 ? 's' : ''} for "{searchQuery}"
            </span>
          )}
        </div>

        {/* Farmer List */}
        {filteredFarmers.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-semibold text-slate-500">No farmers found</p>
            <p className="text-xs mt-1">Try a different name, mobile number, or village.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredFarmers.map(({ name, insts, totalAcres, totalVisits, lastVisit, rep }) => (
              <button
                key={name}
                type="button"
                onClick={() => setSelectedFarmer(name)}
                className="w-full text-left bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:border-emerald-400 hover:shadow-md hover:-translate-y-0.5 transition-all group"
              >
                <div className="flex items-center justify-between gap-4">
                  {/* Left: farmer info */}
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center text-2xl shrink-0 group-hover:bg-emerald-200 transition">
                      🧑‍🌾
                    </div>
                    <div className="min-w-0">
                      <div className="font-extrabold text-slate-800 text-sm truncate">{name}</div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500 mt-0.5">
                        <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{rep.Mobile}</span>
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{rep.Village}, {rep.Mandal}</span>
                        {rep.Farmer_ID && <span className="text-slate-400">ID: {rep.Farmer_ID}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Right: stats chips */}
                  <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                    <div className="text-center px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <div className="text-xs font-extrabold text-emerald-700">{insts.length}</div>
                      <div className="text-[9px] text-emerald-600 font-semibold">PIPES</div>
                    </div>
                    <div className="text-center px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-xl">
                      <div className="text-xs font-extrabold text-blue-700">{totalAcres.toFixed(1)} Ac</div>
                      <div className="text-[9px] text-blue-600 font-semibold">AREA</div>
                    </div>
                    <div className="text-center px-3 py-1.5 bg-violet-50 border border-violet-200 rounded-xl">
                      <div className="text-xs font-extrabold text-violet-700">{totalVisits}</div>
                      <div className="text-[9px] text-violet-600 font-semibold">VISITS</div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-500 transition ml-1 hidden sm:block" />
                  </div>
                </div>

                {/* Last visit info */}
                {lastVisit && (
                  <div className="mt-3 flex flex-wrap gap-2 pl-16">
                    <span className="text-[10px] text-slate-400">Last visit: <strong className="text-slate-600">{formatDate(lastVisit.Visit_Date)}</strong></span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${AWD_COLOR(lastVisit.AWD_Followed)}`}>
                      AWD: {lastVisit.AWD_Followed}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${COND_COLOR(lastVisit.Pipe_Condition)}`}>
                      {lastVisit.Pipe_Condition}
                    </span>
                  </div>
                )}
                {!lastVisit && (
                  <div className="mt-2 pl-16 text-[10px] text-amber-500 font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> No monitoring visits yet
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
