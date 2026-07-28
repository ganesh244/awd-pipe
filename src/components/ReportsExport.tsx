import React, { useState, useMemo } from 'react';
import {
  FileDown, FileText, Printer, Users, Layers, Filter, ChevronDown,
  CheckCircle2, AlertTriangle, BarChart3, MapPin, Phone, Droplet,
  ClipboardList, ArrowDownToLine, Eye, X
} from 'lucide-react';
import { User, Installation, MonitoringRecord } from '../types';

interface ReportsExportProps {
  currentUser: User;
  users: User[];
  installations: Installation[];       // pre-scoped from App.tsx
  monitoringList: MonitoringRecord[];  // pre-scoped from App.tsx
}

// ── Helpers ──────────────────────────────────────────────────────────────────

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

const formatDate = (d?: string) => (d ? new Date(d).toLocaleDateString('en-IN') : '—');
const getStatusColor = (status: string) => {
  if (status === 'Installed') return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (status === 'Damaged') return 'text-red-700 bg-red-50 border-red-200';
  if (status === 'Available') return 'text-blue-700 bg-blue-50 border-blue-200';
  return 'text-slate-600 bg-slate-50 border-slate-200';
};

// ── Dossier Print Window ──────────────────────────────────────────────────────

const printFarmerDossier = (
  installation: Installation,
  monitoring: MonitoringRecord[],
  agentName: string
) => {
  const visits = monitoring.filter((m) => m.Pipe_ID === installation.Pipe_ID);
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Farmer Dossier — ${installation.Farmer_Name}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #1e293b; background: #fff; padding: 24px; }
    .header { display: flex; align-items: center; gap: 16px; border-bottom: 3px solid #16a34a; padding-bottom: 12px; margin-bottom: 20px; }
    .logo { width: 48px; height: 48px; background: linear-gradient(135deg, #14532d, #16a34a, #84cc16); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; font-size: 22px; }
    .header-text h1 { font-size: 18px; font-weight: 800; color: #14532d; letter-spacing: -0.5px; }
    .header-text p { font-size: 11px; color: #64748b; }
    .badge { background: #dcfce7; color: #15803d; font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 20px; border: 1px solid #86efac; display: inline-block; margin-top: 4px; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
    .section { border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
    .section-head { background: #f8fafc; padding: 8px 12px; font-weight: 700; font-size: 12px; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; }
    .kv { padding: 6px 12px; display: flex; justify-content: space-between; border-bottom: 1px solid #f1f5f9; }
    .kv:last-child { border-bottom: none; }
    .k { color: #64748b; font-size: 11px; }
    .v { font-weight: 600; color: #0f172a; font-size: 12px; text-align: right; max-width: 60%; }
    .status-badge { padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 700; }
    .good { background: #dcfce7; color: #15803d; }
    .damaged { background: #fee2e2; color: #dc2626; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f1f5f9; padding: 7px 10px; text-align: left; font-size: 11px; color: #475569; text-transform: uppercase; letter-spacing: 0.4px; border-bottom: 2px solid #e2e8f0; }
    td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; font-size: 12px; }
    tr:last-child td { border-bottom: none; }
    .map-link { color: #2563eb; text-decoration: none; font-size: 11px; }
    .photo { width: 100%; max-height: 180px; object-fit: cover; border-radius: 6px; margin-top: 8px; }
    .footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">🌱</div>
    <div class="header-text">
      <h1>AWD Pipe — Farmer Field Dossier</h1>
      <p>Alternate Wetting &amp; Drying Paddy Water Management System</p>
      <span class="badge">Pipe ID: ${installation.Pipe_ID}</span>
    </div>
  </div>

  <div class="grid2">
    <div class="section">
      <div class="section-head">👨‍🌾 Farmer Details</div>
      <div class="kv"><span class="k">Name</span><span class="v">${installation.Farmer_Name}</span></div>
      <div class="kv"><span class="k">Mobile</span><span class="v">${installation.Mobile || '—'}</span></div>
      <div class="kv"><span class="k">Farmer ID</span><span class="v">${installation.Farmer_ID || '—'}</span></div>
      <div class="kv"><span class="k">Village</span><span class="v">${installation.Village}</span></div>
      <div class="kv"><span class="k">Mandal</span><span class="v">${installation.Mandal}</span></div>
      <div class="kv"><span class="k">District</span><span class="v">${installation.District}</span></div>
      <div class="kv"><span class="k">State</span><span class="v">${installation.State || '—'}</span></div>
    </div>
    <div class="section">
      <div class="section-head">🌾 Field Details</div>
      <div class="kv"><span class="k">Survey No.</span><span class="v">${installation.Survey_No || '—'}</span></div>
      <div class="kv"><span class="k">Plot Size</span><span class="v">${installation.Plot_Size} ${installation.Plot_Size_Unit}</span></div>
      <div class="kv"><span class="k">Crop</span><span class="v">${installation.Crop}</span></div>
      <div class="kv"><span class="k">Variety</span><span class="v">${installation.Variety || '—'}</span></div>
      <div class="kv"><span class="k">Method</span><span class="v">${installation.Establishment_Method}</span></div>
      <div class="kv"><span class="k">Sowing Date</span><span class="v">${formatDate(installation.Sowing_Transplantation_Date)}</span></div>
      <div class="kv"><span class="k">Irrigation</span><span class="v">${installation.Irrigation_Source}</span></div>
    </div>
  </div>

  <div class="grid2">
    <div class="section">
      <div class="section-head">📡 AWD Pipe Installation</div>
      <div class="kv"><span class="k">Installation Date</span><span class="v">${formatDate(installation.Installation_Date)}</span></div>
      <div class="kv"><span class="k">Installed By</span><span class="v">${installation.Installed_By}</span></div>
      <div class="kv"><span class="k">GPS Accuracy</span><span class="v">${installation.GPS_Accuracy}m</span></div>
      <div class="kv"><span class="k">GPS Location</span><span class="v"><a class="map-link" href="${installation.Location_Link}" target="_blank">View on Map 🗺️</a></span></div>
      <div class="kv"><span class="k">Latitude</span><span class="v">${installation.Latitude}</span></div>
      <div class="kv"><span class="k">Longitude</span><span class="v">${installation.Longitude}</span></div>
    </div>
    <div class="section">
      <div class="section-head">📸 Field Photo</div>
      ${installation.Photo_URL
        ? `<img src="${installation.Photo_URL}" class="photo" alt="Field Photo"/>`
        : '<div style="padding:20px;text-align:center;color:#94a3b8;font-size:12px;">No photo attached</div>'
      }
    </div>
  </div>

  <div class="section" style="margin-bottom:16px;">
    <div class="section-head">📋 Monitoring Visit History (${visits.length} visits)</div>
    ${visits.length === 0
      ? '<div style="padding:16px;text-align:center;color:#94a3b8;">No monitoring visits recorded yet.</div>'
      : `<table>
          <thead><tr>
            <th>Visit Date</th><th>Water Level</th><th>Crop Stage</th>
            <th>AWD Followed</th><th>Pipe Condition</th><th>Visited By</th><th>Remarks</th>
          </tr></thead>
          <tbody>
            ${visits.map((v) => `<tr>
              <td>${formatDate(v.Visit_Date)}</td>
              <td>${v.Water_Level}</td>
              <td>${v.Crop_Stage}</td>
              <td><span class="status-badge ${v.AWD_Followed === 'Yes' ? 'good' : 'damaged'}">${v.AWD_Followed}</span></td>
              <td><span class="status-badge ${v.Pipe_Condition === 'Good' ? 'good' : 'damaged'}">${v.Pipe_Condition}</span></td>
              <td>${v.Visited_By}</td>
              <td>${v.Remarks || '—'}</td>
            </tr>`).join('')}
          </tbody>
        </table>`
    }
  </div>

  <div class="footer">
    <span>Generated by AWD Pipe System • ${agentName} • ${new Date().toLocaleString('en-IN')}</span>
    <span>Pipe ID: ${installation.Pipe_ID} • Confidential Field Report</span>
  </div>
  <script>window.onload = () => window.print();</script>
</body>
</html>`;
  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
};

// ── Main Component ────────────────────────────────────────────────────────────

export const ReportsExport: React.FC<ReportsExportProps> = ({
  currentUser,
  users,
  installations,
  monitoringList,
}) => {
  const role = currentUser.role;

  // Filter states
  const [filterState, setFilterState] = useState<string>('');
  const [filterDistrict, setFilterDistrict] = useState<string>('');
  const [filterAreaManager, setFilterAreaManager] = useState<string>('');
  const [filterAgent, setFilterAgent] = useState<string>('');   // CF/JCF user ID
  const [filterFarmer, setFilterFarmer] = useState<string>(''); // Pipe_ID or ''
  const [showDossierModal, setShowDossierModal] = useState<Installation | null>(null);

  // Build dropdown options from scoped data
  const stateOptions = useMemo(() =>
    Array.from(new Set(installations.map((i) => i.State).filter(Boolean))) as string[],
    [installations]);

  const districtOptions = useMemo(() => {
    const base = installations.filter((i) => !filterState || i.State === filterState);
    return Array.from(new Set(base.map((i) => i.District).filter(Boolean))) as string[];
  }, [installations, filterState]);

  const areaManagerOptions = useMemo(() => {
    if (role === 'Admin' || role === 'State Manager' || role === 'District Manager') {
      const relevantUserIds = new Set(installations.map((i) => i.Area_Manager_User_ID).filter(Boolean));
      return users.filter((u) => u.role === 'Area Manager' && relevantUserIds.has(u.id));
    }
    return [];
  }, [installations, users, role]);

  const agentOptions = useMemo(() => {
    if (role === 'CF' || role === 'JCF') return [];
    const subordinates = users.filter((u) =>
      (u.role === 'CF' || u.role === 'JCF') &&
      (role === 'Area Manager'
        ? u.reportsToId === currentUser.id
        : role === 'District Manager'
        ? u.district === currentUser.district
        : role === 'State Manager'
        ? u.state === currentUser.state
        : true)
    );
    return filterAreaManager
      ? subordinates.filter((u) => u.reportsToId === filterAreaManager)
      : subordinates;
  }, [users, role, currentUser, filterAreaManager]);

  // Apply all filters
  const filtered = useMemo(() => {
    return installations.filter((inst) => {
      if (filterState && inst.State !== filterState) return false;
      if (filterDistrict && inst.District !== filterDistrict) return false;
      if (filterAreaManager && inst.Area_Manager_User_ID !== filterAreaManager) return false;
      if (filterAgent && inst.Registered_By_User_ID !== filterAgent) return false;
      if (filterFarmer && inst.Pipe_ID !== filterFarmer) return false;
      return true;
    });
  }, [installations, filterState, filterDistrict, filterAreaManager, filterAgent, filterFarmer]);

  const filteredMonitoring = useMemo(() => {
    const pipeIds = new Set(filtered.map((i) => i.Pipe_ID));
    return monitoringList.filter((m) => pipeIds.has(m.Pipe_ID));
  }, [filtered, monitoringList]);

  // Summary metrics
  const totalInstalled = filtered.length;
  const goodCondition = filteredMonitoring.filter((m) => m.Pipe_Condition === 'Good').length;
  const awdYes = filteredMonitoring.filter((m) => m.AWD_Followed === 'Yes').length;
  const totalVisits = filteredMonitoring.length;

  // CSV exports
  const exportInstallationsCSV = () => {
    const headers = [
      'Pipe ID', 'Farmer Name', 'Mobile', 'Farmer ID', 'Village', 'Mandal', 'District',
      'State', 'Survey No', 'Plot Size', 'Plot Unit', 'Crop', 'Variety', 'Establishment Method',
      'Sowing Date', 'Irrigation Source', 'Installation Date', 'Installed By',
      'Registered By User ID', 'Area Manager User ID', 'Latitude', 'Longitude',
      'GPS Accuracy (m)', 'Map Link', 'Remarks',
    ];
    const rows = filtered.map((i) => [
      i.Pipe_ID, i.Farmer_Name, i.Mobile, i.Farmer_ID ?? '', i.Village, i.Mandal,
      i.District, i.State ?? '', i.Survey_No ?? '', i.Plot_Size, i.Plot_Size_Unit,
      i.Crop, i.Variety ?? '', i.Establishment_Method, i.Sowing_Transplantation_Date,
      i.Irrigation_Source, i.Installation_Date, i.Installed_By,
      i.Registered_By_User_ID ?? '', i.Area_Manager_User_ID ?? '',
      i.Latitude, i.Longitude, i.GPS_Accuracy, i.Location_Link, i.Remarks ?? '',
    ]);
    const tag = filterFarmer || filterAgent || filterAreaManager || filterDistrict || filterState || 'All';
    downloadCSV(`AWD_Installations_${tag}_${new Date().toISOString().slice(0, 10)}.csv`, rows, headers);
  };

  const exportMonitoringCSV = () => {
    const headers = [
      'Pipe ID', 'Visit Date', 'Water Level (cm)', 'Crop Stage', 'AWD Followed',
      'Pipe Condition', 'Visited By', 'Visited By User ID', 'Latitude', 'Longitude', 'Remarks',
    ];
    const rows = filteredMonitoring.map((m) => [
      m.Pipe_ID, m.Visit_Date, m.Water_Level, m.Crop_Stage, m.AWD_Followed,
      m.Pipe_Condition, m.Visited_By, m.Visited_By_User_ID ?? '',
      m.Latitude, m.Longitude, m.Remarks ?? '',
    ]);
    const tag = filterFarmer || filterAgent || filterAreaManager || filterDistrict || filterState || 'All';
    downloadCSV(`AWD_Monitoring_${tag}_${new Date().toISOString().slice(0, 10)}.csv`, rows, headers);
  };

  const clearFilters = () => {
    setFilterState('');
    setFilterDistrict('');
    setFilterAreaManager('');
    setFilterAgent('');
    setFilterFarmer('');
  };

  const hasFilters = filterState || filterDistrict || filterAreaManager || filterAgent || filterFarmer;

  const SelectField = ({ label, value, onChange, options, placeholder }: {
    label: string; value: string; onChange: (v: string) => void;
    options: { value: string; label: string }[]; placeholder: string;
  }) => (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none bg-white border border-slate-200 rounded-lg px-3 py-2 pr-8 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer"
        >
          <option value="">{placeholder}</option>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 py-6 px-4">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800 flex items-center gap-2">
              <FileDown className="w-7 h-7 text-emerald-600" />
              Reports & Export
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Viewing as <strong className="text-emerald-700">{currentUser.role}</strong>
              {currentUser.district && ` — ${currentUser.district}`}
              {currentUser.state && ` (${currentUser.state})`}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={exportInstallationsCSV}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2 rounded-lg shadow transition"
            >
              <ArrowDownToLine className="w-4 h-4" />
              Export Installations CSV
            </button>
            <button
              onClick={exportMonitoringCSV}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg shadow transition"
            >
              <ArrowDownToLine className="w-4 h-4" />
              Export Monitoring CSV
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Farmers', value: totalInstalled, icon: Users, color: 'emerald' },
            { label: 'Monitoring Visits', value: totalVisits, icon: ClipboardList, color: 'blue' },
            { label: 'Good Pipe Condition', value: totalVisits > 0 ? `${Math.round((goodCondition / totalVisits) * 100)}%` : '—', icon: CheckCircle2, color: 'green' },
            { label: 'AWD Compliance', value: totalVisits > 0 ? `${Math.round((awdYes / totalVisits) * 100)}%` : '—', icon: Droplet, color: 'teal' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className={`w-8 h-8 rounded-lg bg-${color}-100 flex items-center justify-center mb-2`}>
                <Icon className={`w-4 h-4 text-${color}-600`} />
              </div>
              <div className="text-2xl font-extrabold text-slate-800">{value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* Filters Panel */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
              <Filter className="w-4 h-4 text-emerald-600" />
              Filter Reports
              {hasFilters && (
                <span className="bg-emerald-100 text-emerald-700 text-xs font-semibold px-2 py-0.5 rounded-full">Active</span>
              )}
            </div>
            {hasFilters && (
              <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-500 transition">
                <X className="w-3 h-3" /> Clear All
              </button>
            )}
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {/* State — Admin only */}
              {role === 'Admin' && (
                <SelectField
                  label="State"
                  value={filterState}
                  onChange={(v) => { setFilterState(v); setFilterDistrict(''); setFilterAreaManager(''); setFilterAgent(''); setFilterFarmer(''); }}
                  options={stateOptions.map((s) => ({ value: s, label: s }))}
                  placeholder="All States"
                />
              )}
              {/* District — Admin, State Manager */}
              {(role === 'Admin' || role === 'State Manager') && (
                <SelectField
                  label="District"
                  value={filterDistrict}
                  onChange={(v) => { setFilterDistrict(v); setFilterAreaManager(''); setFilterAgent(''); setFilterFarmer(''); }}
                  options={districtOptions.map((d) => ({ value: d, label: d }))}
                  placeholder="All Districts"
                />
              )}
              {/* Area Manager — Admin, State Manager, District Manager */}
              {(role === 'Admin' || role === 'State Manager' || role === 'District Manager') && areaManagerOptions.length > 0 && (
                <SelectField
                  label="Area Manager"
                  value={filterAreaManager}
                  onChange={(v) => { setFilterAreaManager(v); setFilterAgent(''); setFilterFarmer(''); }}
                  options={areaManagerOptions.map((u) => ({ value: u.id, label: u.name }))}
                  placeholder="All Area Managers"
                />
              )}
              {/* CF/JCF Agent — Area Manager and above */}
              {role !== 'CF' && role !== 'JCF' && agentOptions.length > 0 && (
                <SelectField
                  label="CF / JCF Agent"
                  value={filterAgent}
                  onChange={(v) => { setFilterAgent(v); setFilterFarmer(''); }}
                  options={agentOptions.map((u) => ({ value: u.id, label: `${u.name} (${u.role})` }))}
                  placeholder="All Agents"
                />
              )}
              {/* Specific Farmer — all roles */}
              <SelectField
                label="Specific Farmer"
                value={filterFarmer}
                onChange={setFilterFarmer}
                options={filtered.map((i) => ({ value: i.Pipe_ID, label: `${i.Farmer_Name} (${i.Pipe_ID})` }))}
                placeholder="All Farmers"
              />
            </div>
          </div>
        </div>

        {/* Results Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50">
            <div className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-500" />
              Filtered Results
              <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded-full">{filtered.length} farmers</span>
            </div>
            <span className="text-xs text-slate-400">Select a farmer to view dossier</span>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Layers className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-semibold">No records match your filters</p>
              <p className="text-xs mt-1">Try adjusting or clearing the filters above</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {['Pipe ID', 'Farmer Name', 'Mobile', 'Village', 'District', 'Crop', 'Installed By', 'Install Date', 'Last Visit', 'AWD Status', 'Actions'].map((h) => (
                      <th key={h} className="text-left text-xs font-bold text-slate-500 uppercase tracking-wider px-4 py-2.5 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((inst) => {
                    const visits = monitoringList.filter((m) => m.Pipe_ID === inst.Pipe_ID);
                    const lastVisit = visits[0];
                    return (
                      <tr key={inst.Pipe_ID} className="hover:bg-slate-50 transition">
                        <td className="px-4 py-2.5 font-mono text-xs font-bold text-slate-700 whitespace-nowrap">{inst.Pipe_ID}</td>
                        <td className="px-4 py-2.5 font-semibold text-slate-800 whitespace-nowrap">{inst.Farmer_Name}</td>
                        <td className="px-4 py-2.5 text-slate-600">
                          <a href={`tel:${inst.Mobile}`} className="flex items-center gap-1 hover:text-emerald-600">
                            <Phone className="w-3 h-3" />{inst.Mobile}
                          </a>
                        </td>
                        <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{inst.Village}</td>
                        <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{inst.District}</td>
                        <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{inst.Crop}</td>
                        <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap text-xs">{inst.Installed_By}</td>
                        <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap text-xs">{formatDate(inst.Installation_Date)}</td>
                        <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap text-xs">{lastVisit ? formatDate(lastVisit.Visit_Date) : <span className="text-amber-500">No visits</span>}</td>
                        <td className="px-4 py-2.5">
                          {lastVisit ? (
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${lastVisit.AWD_Followed === 'Yes' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : lastVisit.AWD_Followed === 'Partially' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                              AWD: {lastVisit.AWD_Followed}
                            </span>
                          ) : <span className="text-xs text-slate-400">—</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setShowDossierModal(inst)}
                              title="View & Print Dossier"
                              className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => printFarmerDossier(inst, monitoringList, currentUser.name)}
                              title="Print Dossier"
                              className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 transition"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                            <a
                              href={inst.Location_Link}
                              target="_blank"
                              rel="noreferrer"
                              title="View on Map"
                              className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 transition"
                            >
                              <MapPin className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Dossier Modal Preview */}
        {showDossierModal && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowDossierModal(null)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
                <div>
                  <h2 className="font-extrabold text-slate-800 text-lg">{showDossierModal.Farmer_Name}</h2>
                  <p className="text-sm text-slate-500">{showDossierModal.Pipe_ID} • {showDossierModal.Village}, {showDossierModal.District}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => printFarmerDossier(showDossierModal, monitoringList, currentUser.name)}
                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-3 py-1.5 rounded-lg transition"
                  >
                    <Printer className="w-4 h-4" /> Print / PDF
                  </button>
                  <button onClick={() => setShowDossierModal(null)} className="p-2 rounded-lg hover:bg-slate-100 transition">
                    <X className="w-5 h-5 text-slate-500" />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-4 text-sm">
                {/* Farm & Field Info Grid */}
                <div className="grid grid-cols-2 gap-4">
                  {[
                    ['Pipe ID', showDossierModal.Pipe_ID],
                    ['Mobile', showDossierModal.Mobile],
                    ['Farmer ID', showDossierModal.Farmer_ID ?? '—'],
                    ['Village', showDossierModal.Village],
                    ['Mandal', showDossierModal.Mandal],
                    ['District', showDossierModal.District],
                    ['State', showDossierModal.State ?? '—'],
                    ['Survey No', showDossierModal.Survey_No ?? '—'],
                    ['Plot Size', `${showDossierModal.Plot_Size} ${showDossierModal.Plot_Size_Unit}`],
                    ['Crop', showDossierModal.Crop],
                    ['Method', showDossierModal.Establishment_Method],
                    ['Irrigation', showDossierModal.Irrigation_Source],
                    ['Install Date', formatDate(showDossierModal.Installation_Date)],
                    ['Installed By', showDossierModal.Installed_By],
                  ].map(([k, v]) => (
                    <div key={k} className="flex flex-col">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{k}</span>
                      <span className="font-semibold text-slate-700 mt-0.5">{v}</span>
                    </div>
                  ))}
                </div>

                {/* Photo */}
                {showDossierModal.Photo_URL && (
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Field Photo</p>
                    <img src={showDossierModal.Photo_URL} alt="Field" className="w-full rounded-lg object-cover max-h-48 border border-slate-200" />
                  </div>
                )}

                {/* Monitoring History */}
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Monitoring Visits ({monitoringList.filter((m) => m.Pipe_ID === showDossierModal.Pipe_ID).length})
                  </p>
                  {monitoringList.filter((m) => m.Pipe_ID === showDossierModal.Pipe_ID).length === 0 ? (
                    <div className="text-center py-6 text-slate-400 border border-dashed border-slate-200 rounded-xl">
                      <AlertTriangle className="w-6 h-6 mx-auto mb-1 opacity-40" />
                      No monitoring visits recorded yet
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {monitoringList.filter((m) => m.Pipe_ID === showDossierModal.Pipe_ID).map((v, i) => (
                        <div key={i} className="flex items-start gap-3 bg-slate-50 rounded-lg p-3 border border-slate-100">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs shrink-0">{i + 1}</div>
                          <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                            <div><span className="text-slate-400">Date:</span> <span className="font-semibold">{formatDate(v.Visit_Date)}</span></div>
                            <div><span className="text-slate-400">Water Level:</span> <span className="font-semibold">{v.Water_Level}</span></div>
                            <div><span className="text-slate-400">Crop Stage:</span> <span className="font-semibold">{v.Crop_Stage}</span></div>
                            <div><span className="text-slate-400">AWD:</span> <span className={`font-bold ${v.AWD_Followed === 'Yes' ? 'text-emerald-600' : 'text-amber-600'}`}>{v.AWD_Followed}</span></div>
                            <div><span className="text-slate-400">Pipe Condition:</span> <span className={`font-bold ${v.Pipe_Condition === 'Good' ? 'text-emerald-600' : 'text-red-600'}`}>{v.Pipe_Condition}</span></div>
                            <div><span className="text-slate-400">Visited By:</span> <span className="font-semibold">{v.Visited_By}</span></div>
                            {v.Remarks && <div className="col-span-2"><span className="text-slate-400">Remarks:</span> <span className="font-semibold">{v.Remarks}</span></div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
