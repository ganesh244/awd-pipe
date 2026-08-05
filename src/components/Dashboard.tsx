import React, { useMemo, useState } from 'react';
import { AWDPipe, Installation, MonitoringRecord } from '../types';
import {
  Sprout, Users, Map, Activity, ShieldAlert, CheckCircle2,
  PieChart, Layers, Droplets, TrendingUp, AlertTriangle,
  BarChart3, Calendar, Wheat, Pipette, Target, Flame,
  ArrowUpRight, ArrowDownRight, Minus, ClipboardList, MapPin,
  Zap, Filter
} from 'lucide-react';

interface DashboardProps {
  pipes: AWDPipe[];
  installations: Installation[];
  monitoringList: MonitoringRecord[];
}

// ── Tiny bar helpers ────────────────────────────────────────────────────────
const BAR_COLORS = [
  'bg-emerald-500','bg-teal-500','bg-blue-500','bg-violet-500',
  'bg-amber-500','bg-rose-500','bg-indigo-500','bg-lime-500',
];
const ProgressBar: React.FC<{ pct: number; color?: string; thin?: boolean }> = ({
  pct, color = 'bg-emerald-500', thin
}) => (
  <div className={`w-full ${thin ? 'h-1.5' : 'h-2.5'} bg-slate-100 rounded-full overflow-hidden`}>
    <div
      className={`h-full rounded-full transition-all duration-700 ${color}`}
      style={{ width: `${Math.min(100, pct)}%` }}
    />
  </div>
);

// ── KPI Card ─────────────────────────────────────────────────────────────────
const KPICard: React.FC<{
  icon: React.FC<any>;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  trend?: 'up' | 'down' | 'flat';
  trendLabel?: string;
}> = ({ icon: Icon, label, value, sub, color, trend, trendLabel }) => (
  <div className={`bg-white rounded-2xl p-4 border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all`}>
    <div className={`w-9 h-9 rounded-xl ${color} flex items-center justify-center mb-3`}>
      <Icon className="w-4.5 h-4.5 text-white w-5 h-5" />
    </div>
    <div className="text-2xl font-black text-slate-800 tabular-nums">{value}</div>
    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">{label}</div>
    {sub && <div className="text-[10px] text-slate-400 mt-0.5">{sub}</div>}
    {trend && (
      <div className={`flex items-center gap-1 mt-1.5 text-[10px] font-bold ${
        trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-red-500' : 'text-slate-400'
      }`}>
        {trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : trend === 'down' ? <ArrowDownRight className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
        {trendLabel}
      </div>
    )}
  </div>
);

// ── Section Title ─────────────────────────────────────────────────────────────
const SectionTitle: React.FC<{ icon: React.FC<any>; title: string; sub?: string }> = ({ icon: Icon, title, sub }) => (
  <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
    <div className="w-7 h-7 bg-emerald-50 rounded-lg flex items-center justify-center">
      <Icon className="w-4 h-4 text-emerald-600" />
    </div>
    <div>
      <div className="font-extrabold text-slate-800 text-sm">{title}</div>
      {sub && <div className="text-[10px] text-slate-400">{sub}</div>}
    </div>
  </div>
);

export const Dashboard: React.FC<DashboardProps> = ({ pipes, installations, monitoringList }) => {
  const [districtFilter, setDistrictFilter] = useState<string>('All');

  // ── Core metrics ────────────────────────────────────────────────────────
  const totalPipes       = pipes.length;
  const totalInstalled   = installations.length;
  const totalAvailable   = pipes.filter(p => p.Status === 'Available').length;
  const totalDamaged     = pipes.filter(p => p.Status === 'Damaged').length;
  const totalFarmers     = new Set(installations.map(i => i.Farmer_Name)).size;
  const totalAcres       = installations.reduce((s, i) => s + (Number(i.Plot_Size) || 0), 0);
  const totalVisits      = monitoringList.length;
  const awdYes           = monitoringList.filter(m => m.AWD_Followed === 'Yes').length;
  const awdPartial       = monitoringList.filter(m => m.AWD_Followed === 'Partially').length;
  const awdNo            = monitoringList.filter(m => m.AWD_Followed === 'No').length;
  const adoptionRate     = totalVisits > 0 ? Math.round((awdYes / totalVisits) * 100) : 0;
  const goodPipes        = monitoringList.filter(m => m.Pipe_Condition === 'Good').length;
  const damagedPipes     = monitoringList.filter(m => m.Pipe_Condition === 'Damaged').length;
  const avgWaterLevel    = monitoringList.length > 0
    ? (monitoringList.reduce((s, m) => {
        // Support both numeric ("5", "-5") and descriptive ("+5 cm above...", "-10 cm below...")
        const parsed = parseFloat(String(m.Water_Level ?? ''));
        return s + (isNaN(parsed) ? 0 : parsed);
      }, 0) / monitoringList.length).toFixed(1)
    : '—';

  // ── Method breakdown ─────────────────────────────────────────────────────
  const methodStats = useMemo(() =>
    installations.reduce((acc, i) => {
      acc[i.Establishment_Method] = (acc[i.Establishment_Method] || 0) + 1;
      return acc;
    }, {} as Record<string, number>), [installations]);

  const methodAcres = useMemo(() =>
    installations.reduce((acc, i) => {
      acc[i.Establishment_Method] = (acc[i.Establishment_Method] || 0) + (Number(i.Plot_Size) || 0);
      return acc;
    }, {} as Record<string, number>), [installations]);

  // ── District breakdown ───────────────────────────────────────────────────
  const districtStats = useMemo(() => {
    const m: Record<string, { pipes: number; acres: number; farmers: Set<string>; visits: number }> = {};
    installations.forEach(i => {
      const d = i.District || 'Unspecified';
      if (!m[d]) m[d] = { pipes: 0, acres: 0, farmers: new Set(), visits: 0 };
      m[d].pipes++;
      m[d].acres += Number(i.Plot_Size) || 0;
      m[d].farmers.add(i.Farmer_Name);
    });
    monitoringList.forEach(v => {
      const inst = installations.find(i => i.Pipe_ID === v.Pipe_ID);
      if (inst) {
        const d = inst.District || 'Unspecified';
        if (m[d]) m[d].visits++;
      }
    });
    return Object.entries(m)
      .map(([name, s]) => ({ name, pipes: s.pipes, acres: s.acres, farmers: s.farmers.size, visits: s.visits }))
      .sort((a, b) => b.pipes - a.pipes);
  }, [installations, monitoringList]);

  const districts = ['All', ...districtStats.map(d => d.name)];

  // ── Village breakdown ────────────────────────────────────────────────────
  const villageStats = useMemo(() => {
    const m: Record<string, number> = {};
    installations
      .filter(i => districtFilter === 'All' || i.District === districtFilter)
      .forEach(i => { m[i.Village] = (m[i.Village] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [installations, districtFilter]);

  // ── Irrigation source breakdown ──────────────────────────────────────────
  const irrigationStats = useMemo(() =>
    installations.reduce((acc, i) => {
      const src = i.Irrigation_Source || 'Unknown';
      acc[src] = (acc[src] || 0) + 1;
      return acc;
    }, {} as Record<string, number>), [installations]);

  // ── Crop stage distribution (from monitoring) ────────────────────────────
  const cropStageStats = useMemo(() =>
    monitoringList.reduce((acc, m) => {
      const stage = m.Crop_Stage || 'Unknown';
      acc[stage] = (acc[stage] || 0) + 1;
      return acc;
    }, {} as Record<string, number>), [monitoringList]);

  // ── Variety distribution ─────────────────────────────────────────────────
  const varietyStats = useMemo(() => {
    const m: Record<string, number> = {};
    installations.forEach(i => { const v = i.Variety || 'Local'; m[v] = (m[v] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [installations]);

  // ── Pipe installation timeline (by month) ───────────────────────────────
  const installTimeline = useMemo(() => {
    const m: Record<string, number> = {};
    installations.forEach(i => {
      if (!i.Installation_Date) return;
      const d = new Date(i.Installation_Date);
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      m[key] = (m[key] || 0) + 1;
    });
    return Object.entries(m).sort(([a], [b]) => a.localeCompare(b)).slice(-6);
  }, [installations]);

  // ── Recent monitoring visits ─────────────────────────────────────────────
  const recentVisits = useMemo(() =>
    [...monitoringList]
      .sort((a, b) => new Date(b.Visit_Date || 0).getTime() - new Date(a.Visit_Date || 0).getTime())
      .slice(0, 6), [monitoringList]);

  // ── Water level buckets ──────────────────────────────────────────────────
  const waterBuckets = useMemo(() => {
    const buckets = { 'Below 5cm': 0, '5–15cm': 0, '15–25cm': 0, 'Above 25cm': 0 };
    monitoringList.forEach(m => {
      const wl = parseFloat(String(m.Water_Level ?? '')) || 0;
      if (wl < 5) buckets['Below 5cm']++;
      else if (wl < 15) buckets['5–15cm']++;
      else if (wl < 25) buckets['15–25cm']++;
      else buckets['Above 25cm']++;
    });
    return buckets;
  }, [monitoringList]);

  const fmtDate = (d?: string) => {
    if (!d) return '—';
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  };

  const maxVillage = Math.max(...villageStats.map(([, c]) => c), 1);
  const maxTimeline = Math.max(...installTimeline.map(([, c]) => c), 1);

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-violet-600" />
              AWD Field Analytics Dashboard
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Real-time aggregated paddy water management data across all fields
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border ${
              adoptionRate >= 70 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
              adoptionRate >= 40 ? 'bg-amber-50 text-amber-700 border-amber-200' :
              'bg-red-50 text-red-700 border-red-200'
            }`}>
              <Zap className="w-3 h-3" />
              AWD Adoption: {adoptionRate}%
            </span>
            <span className="inline-flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-full text-[11px] font-semibold text-slate-600">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              Live Data
            </span>
          </div>
        </div>

        {/* ── KPI Row ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {[
            { icon: Layers,       label: 'Total Pipes',     value: totalPipes,             sub: 'Master inventory',        color: 'bg-slate-600' },
            { icon: CheckCircle2, label: 'Installed',       value: totalInstalled,         sub: 'Active in fields',        color: 'bg-emerald-600', trend: 'up' as const, trendLabel: 'Field deployed' },
            { icon: Users,        label: 'Farmers',         value: totalFarmers,           sub: 'Paddy cultivators',       color: 'bg-blue-600' },
            { icon: Map,          label: 'Acres',           value: totalAcres.toFixed(1),  sub: 'Total covered',           color: 'bg-indigo-600' },
            { icon: Activity,     label: 'Visits',          value: totalVisits,            sub: 'Monitoring logs',         color: 'bg-violet-600' },
            { icon: Target,       label: 'AWD Compliant',   value: `${awdYes}/${totalVisits}`,  sub: `${adoptionRate}% rate`, color: 'bg-teal-600' },
            { icon: Pipette,      label: 'Avg Water Lvl',   value: `${avgWaterLevel}cm`,   sub: 'Across all visits',       color: 'bg-cyan-600' },
            { icon: ShieldAlert,  label: 'Pipe Alerts',     value: damagedPipes,           sub: `${totalAvailable} avail / ${totalDamaged} dmg`, color: 'bg-amber-600', trend: damagedPipes > 0 ? 'down' as const : undefined, trendLabel: 'Needs attention' },
          ].map((k) => (
            <KPICard key={k.label} {...k} />
          ))}
        </div>

        {/* ── Row 1: AWD Compliance + Method + Water Level ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* AWD Compliance Gauge */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
            <SectionTitle icon={Target} title="AWD Compliance Breakdown" sub="All monitoring visits" />
            <div className="flex items-center justify-center my-4">
              <div className="relative w-36 h-36">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#f1f5f9" strokeWidth="12" />
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#10b981" strokeWidth="12"
                    strokeDasharray={`${adoptionRate * 2.51} 251`} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-black text-slate-800">{adoptionRate}%</span>
                  <span className="text-[10px] font-bold text-emerald-600 uppercase">AWD Rate</span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              {[
                { label: 'AWD Followed', count: awdYes,     color: 'bg-emerald-500', text: 'text-emerald-700' },
                { label: 'Partially',    count: awdPartial,  color: 'bg-amber-400',   text: 'text-amber-700'   },
                { label: 'Not Followed', count: awdNo,       color: 'bg-red-400',     text: 'text-red-700'     },
              ].map(({ label, count, color, text }) => (
                <div key={label} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
                    <span className="text-slate-600 font-medium">{label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ProgressBar pct={totalVisits > 0 ? (count / totalVisits) * 100 : 0} color={color} thin />
                    <span className={`font-bold w-8 text-right ${text}`}>{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Establishment Method */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
            <SectionTitle icon={PieChart} title="Establishment Methods" sub="By pipe count and acreage" />
            <div className="space-y-4">
              {['Dry DSR', 'Wet DSR', 'TPR'].map((method, idx) => {
                const count = methodStats[method] || 0;
                const acres = methodAcres[method] || 0;
                const pct = totalInstalled > 0 ? Math.round((count / totalInstalled) * 100) : 0;
                const colors = ['bg-emerald-500', 'bg-teal-500', 'bg-blue-500'];
                return (
                  <div key={method} className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs font-semibold text-slate-700">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${colors[idx]}`} />
                        {method}
                      </div>
                      <span className="text-slate-500">{count} pipes · {acres.toFixed(1)} Ac · <span className="font-bold text-slate-800">{pct}%</span></span>
                    </div>
                    <ProgressBar pct={pct} color={colors[idx]} />
                  </div>
                );
              })}
              <div className="mt-3 bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-[10px] text-emerald-800 leading-relaxed">
                💡 <strong>DSR methods</strong> reduce water usage by up to 30% vs traditional TPR transplanting.
              </div>
            </div>
          </div>

          {/* Water Level Distribution */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
            <SectionTitle icon={Droplets} title="Water Level Distribution" sub="Field readings across all visits" />
            <div className="space-y-3 mt-2">
              {Object.entries(waterBuckets).map(([label, count], idx) => {
                const total = totalVisits || 1;
                const pct = Math.round((Number(count) / total) * 100);
                const colors = ['bg-blue-400', 'bg-emerald-500', 'bg-amber-400', 'bg-red-400'];
                const bgs = ['bg-blue-50', 'bg-emerald-50', 'bg-amber-50', 'bg-red-50'];
                const txts = ['text-blue-700', 'text-emerald-700', 'text-amber-700', 'text-red-700'];
                return (
                  <div key={label} className={`flex items-center gap-3 p-2.5 rounded-xl ${bgs[idx]}`}>
                    <Droplets className={`w-4 h-4 shrink-0 ${txts[idx]}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                        <span>{label}</span>
                        <span className={`font-bold ${txts[idx]}`}>{count} ({pct}%)</span>
                      </div>
                      <ProgressBar pct={pct} color={colors[idx]} thin />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 text-[10px] text-slate-400 text-center">Avg water level: <strong className="text-slate-600">{avgWaterLevel} cm</strong> across {totalVisits} readings</div>
          </div>
        </div>

        {/* ── Row 2: District Stats + Village Bars + Irrigation ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* District-wise table */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm lg:col-span-1">
            <SectionTitle icon={MapPin} title="District Performance" sub="Installations, acres & visits" />
            <div className="space-y-2 text-xs">
              {districtStats.length === 0 ? (
                <div className="text-center py-6 text-slate-400">No district data</div>
              ) : districtStats.map(({ name, pipes, acres, farmers, visits }, idx) => (
                <div key={name} className="rounded-xl border border-slate-100 p-3 hover:border-emerald-200 hover:bg-emerald-50/30 transition-all">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 font-bold text-slate-800">
                      <span className={`w-5 h-5 rounded-md ${BAR_COLORS[idx % BAR_COLORS.length]} flex items-center justify-center text-white text-[9px] font-black`}>
                        {idx + 1}
                      </span>
                      {name}
                    </div>
                    <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-mono text-[10px]">{pipes} pipes</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-[10px] text-slate-500">
                    <span>👨‍🌾 {farmers} farmers</span>
                    <span>📐 {acres.toFixed(1)} Ac</span>
                    <span>📋 {visits} visits</span>
                  </div>
                  <ProgressBar pct={totalInstalled > 0 ? (pipes / totalInstalled) * 100 : 0} color={BAR_COLORS[idx % BAR_COLORS.length]} thin />
                </div>
              ))}
            </div>
          </div>

          {/* Village breakdown with filter */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-emerald-50 rounded-lg flex items-center justify-center">
                  <Flame className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <div className="font-extrabold text-slate-800 text-sm">Top Villages</div>
                  <div className="text-[10px] text-slate-400">By pipe installations</div>
                </div>
              </div>
              <select
                value={districtFilter}
                onChange={e => setDistrictFilter(e.target.value)}
                className="text-[10px] border border-slate-200 rounded-lg px-2 py-1 text-slate-600 font-semibold focus:ring-1 focus:ring-emerald-400 bg-white"
              >
                {districts.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              {villageStats.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">No data for this filter</div>
              ) : villageStats.map(([village, count], idx) => (
                <div key={village} className="flex items-center gap-3">
                  <span className="text-[10px] font-bold text-slate-400 w-4 text-right">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-semibold text-slate-700 truncate">{village}</span>
                      <span className="font-bold text-slate-800 shrink-0 ml-2">{count}</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${BAR_COLORS[idx % BAR_COLORS.length]}`}
                        style={{ width: `${(count / maxVillage) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Irrigation Source + Crop Variety */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
              <SectionTitle icon={Droplets} title="Irrigation Sources" />
              <div className="space-y-2">
                {Object.entries(irrigationStats).sort((a, b) => Number(b[1]) - Number(a[1])).map(([src, count], idx) => {
                  const numCount = Number(count);
                  const pct = totalInstalled > 0 ? Math.round((numCount / totalInstalled) * 100) : 0;
                  return (
                    <div key={src} className="flex items-center gap-2 text-xs">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${BAR_COLORS[idx % BAR_COLORS.length]}`} />
                      <span className="flex-1 text-slate-600 font-medium truncate">{src}</span>
                      <span className="font-bold text-slate-800">{numCount}</span>
                      <div className="w-20">
                        <ProgressBar pct={pct} color={BAR_COLORS[idx % BAR_COLORS.length]} thin />
                      </div>
                      <span className="text-slate-400 w-8 text-right">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
              <SectionTitle icon={Wheat} title="Paddy Varieties" />
              <div className="space-y-1.5">
                {varietyStats.slice(0, 5).map(([variety, count], idx) => {
                  const pct = totalInstalled > 0 ? Math.round((count / totalInstalled) * 100) : 0;
                  return (
                    <div key={variety} className="flex items-center gap-2 text-xs">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${BAR_COLORS[idx % BAR_COLORS.length]}`} />
                      <span className="flex-1 text-slate-600 font-medium truncate">{variety}</span>
                      <span className="font-bold text-slate-800 w-8 text-right">{count}</span>
                      <span className="text-slate-400 w-8 text-right">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ── Row 3: Installation Timeline + Crop Stages + Recent Visits ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Installation timeline */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
            <SectionTitle icon={Calendar} title="Installation Timeline" sub="Pipes deployed per month" />
            {installTimeline.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">No timeline data available</div>
            ) : (
              <div className="flex items-end gap-2 h-32 mt-2">
                {installTimeline.map(([month, count], idx) => {
                  const heightPct = (count / maxTimeline) * 100;
                  const [yr, mo] = month.split('-');
                  const label = new Date(Number(yr), Number(mo) - 1).toLocaleDateString('en-IN', { month: 'short' });
                  return (
                    <div key={month} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[10px] font-bold text-slate-600">{count}</span>
                      <div className="w-full flex items-end" style={{ height: '80px' }}>
                        <div
                          className={`w-full rounded-t-lg ${BAR_COLORS[idx % BAR_COLORS.length]} opacity-80 hover:opacity-100 transition-all`}
                          style={{ height: `${Math.max(4, heightPct)}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-slate-400 font-medium">{label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Crop stage from monitoring */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
            <SectionTitle icon={Sprout} title="Crop Stage Distribution" sub="From monitoring visits" />
            <div className="space-y-2">
              {Object.entries(cropStageStats).sort((a, b) => Number(b[1]) - Number(a[1])).slice(0, 6).map(([stage, count], idx) => {
                const numCount2 = Number(count);
                const pct = totalVisits > 0 ? Math.round((numCount2 / totalVisits) * 100) : 0;
                return (
                  <div key={stage} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold text-slate-700">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${BAR_COLORS[idx % BAR_COLORS.length]}`} />
                        {stage}
                      </div>
                      <span className="text-slate-500">{numCount2} visits · {pct}%</span>
                    </div>
                    <ProgressBar pct={pct} color={BAR_COLORS[idx % BAR_COLORS.length]} thin />
                  </div>
                );
              })}
              {Object.keys(cropStageStats).length === 0 && (
                <div className="text-center py-6 text-slate-400 text-xs">No monitoring data yet</div>
              )}
            </div>
          </div>

          {/* Recent activity feed */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
            <SectionTitle icon={ClipboardList} title="Recent Field Visits" sub="Latest monitoring entries" />
            <div className="space-y-2">
              {recentVisits.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">No monitoring visits recorded</div>
              ) : recentVisits.map((v, i) => {
                const inst = installations.find(inst => inst.Pipe_ID === v.Pipe_ID);
                return (
                  <div key={i} className="flex items-start gap-3 p-2.5 bg-slate-50 rounded-xl border border-slate-100 hover:border-emerald-200 transition-all">
                    <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                      v.AWD_Followed === 'Yes' ? 'bg-emerald-500' :
                      v.AWD_Followed === 'Partially' ? 'bg-amber-400' : 'bg-red-400'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-1">
                        <span className="font-bold text-slate-800 text-xs truncate">{inst?.Farmer_Name ?? v.Pipe_ID}</span>
                        <span className="text-[10px] text-slate-400 shrink-0">{fmtDate(v.Visit_Date)}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5 flex flex-wrap gap-x-2">
                        <span>💧 {v.Water_Level}cm</span>
                        <span>🌾 {v.Crop_Stage}</span>
                        <span className={`font-semibold ${v.AWD_Followed === 'Yes' ? 'text-emerald-600' : v.AWD_Followed === 'Partially' ? 'text-amber-600' : 'text-red-500'}`}>
                          AWD: {v.AWD_Followed}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Summary Banner ── */}
        <div className="bg-gradient-to-r from-emerald-700 to-teal-700 rounded-2xl p-5 text-white">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="font-black text-lg">AWD Programme Summary</div>
              <div className="text-emerald-100 text-xs mt-1">
                {totalInstalled} pipes installed across {new Set(installations.map(i => i.District)).size} districts,
                covering {totalAcres.toFixed(1)} acres for {totalFarmers} farmers.
                Avg {totalInstalled > 0 ? (totalVisits / totalInstalled).toFixed(1) : 0} monitoring visits per pipe.
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 shrink-0">
              {[
                { label: 'Adoption', value: `${adoptionRate}%` },
                { label: 'Avg Acres/Farmer', value: totalFarmers > 0 ? (totalAcres / totalFarmers).toFixed(1) : '—' },
                { label: 'Visits/Pipe', value: totalInstalled > 0 ? (totalVisits / totalInstalled).toFixed(1) : '—' },
              ].map(({ label, value }) => (
                <div key={label} className="text-center bg-white/10 rounded-xl p-2.5 border border-white/20">
                  <div className="text-xl font-black">{value}</div>
                  <div className="text-[10px] text-emerald-200 font-semibold">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
