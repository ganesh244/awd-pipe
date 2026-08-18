import React, { useMemo, useState } from 'react';
import { AWDPipe, Installation, MonitoringRecord, User } from '../types';
import { toAcres } from '../utils/plotUtils';
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import {
  Sprout, Users, Map, Activity, ShieldAlert, CheckCircle2,
  PieChart, Layers, Droplets, TrendingUp, AlertTriangle,
  BarChart3, Calendar, Wheat, Pipette, Target, Flame,
  ArrowUpRight, ArrowDownRight, Minus, ClipboardList, MapPin,
  Zap, Filter, Clock, X, Trophy, Lightbulb
} from 'lucide-react';

const REGISTRATION_TARGET = 1000; // TODO: Make configurable

interface DashboardProps {
  pipes: AWDPipe[];
  installations: Installation[];
  monitoringList: MonitoringRecord[];
  currentUser?: User;
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
    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-0.5">{label}</div>
    {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
    {trend && (
      <div className={`flex items-center gap-1 mt-1.5 text-xs font-bold ${
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
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
    </div>
  </div>
);

export const Dashboard: React.FC<DashboardProps> = ({ pipes, installations, monitoringList, currentUser }) => {
  const [districtFilter, setDistrictFilter] = useState<string>('All');

  const scopeLabel = useMemo(() => {
    if (!currentUser) return 'All Regions';
    if (currentUser.role === 'Admin') return 'All Regions';
    if (currentUser.role === 'State Manager') return `State: ${currentUser.state || 'Unknown'}`;
    if (currentUser.role === 'District Manager') return `District: ${currentUser.district || 'Unknown'}`;
    if (currentUser.role === 'Area Manager') return `Area: ${currentUser.areaName || 'Unknown'}`;
    return 'Your Assigned Area';
  }, [currentUser]);

  const filteredInstallations = useMemo(() => 
    districtFilter === 'All' ? installations : installations.filter(i => i.District === districtFilter)
  , [installations, districtFilter]);

  const filteredMonitoring = useMemo(() => {
    if (districtFilter === 'All') return monitoringList;
    const validPipeIds = new Set(filteredInstallations.map(i => i.Pipe_ID));
    return monitoringList.filter(m => validPipeIds.has(m.Pipe_ID));
  }, [monitoringList, filteredInstallations, districtFilter]);

  // ── Core metrics ────────────────────────────────────────────────────────
  const totalPipes       = pipes.length;
  const totalInstalled   = filteredInstallations.length;
  const totalAvailable   = pipes.filter(p => p.Status === 'Available').length;
  const totalDamaged     = pipes.filter(p => p.Status === 'Damaged').length;
  const totalFarmers     = new Set(filteredInstallations.map(i => i.Farmer_Name)).size;
  const totalAcres       = filteredInstallations.reduce((s, i) => s + toAcres(Number(i.Plot_Size) || 0, i.Plot_Size_Unit), 0);
  const totalVisits      = filteredMonitoring.length;
  const awdYes           = filteredMonitoring.filter(m => m.AWD_Followed === 'Yes').length;
  const awdPartial       = filteredMonitoring.filter(m => m.AWD_Followed === 'Partially').length;
  const awdNo            = filteredMonitoring.filter(m => m.AWD_Followed === 'No').length;
  const adoptionRate     = totalVisits > 0 ? Math.round((awdYes / totalVisits) * 100) : 0;
  const goodPipes        = filteredMonitoring.filter(m => m.Pipe_Condition === 'Good').length;
  const damagedPipes     = filteredMonitoring.filter(m => m.Pipe_Condition === 'Damaged').length;
  const avgWaterLevel    = filteredMonitoring.length > 0
    ? (filteredMonitoring.reduce((s, m) => {
        // Support both numeric ("5", "-5") and descriptive ("+5 cm above...", "-10 cm below...")
        const parsed = parseFloat(String(m.Water_Level ?? ''));
        return s + (isNaN(parsed) ? 0 : parsed);
      }, 0) / filteredMonitoring.length).toFixed(1)
    : '—';

  // ── Method breakdown ─────────────────────────────────────────────────────
  const methodStats = useMemo(() =>
    filteredInstallations.reduce((acc, i) => {
      acc[i.Establishment_Method] = (acc[i.Establishment_Method] || 0) + 1;
      return acc;
    }, {} as Record<string, number>), [filteredInstallations]);

  const methodAcres = useMemo(() =>
    filteredInstallations.reduce((acc, i) => {
      acc[i.Establishment_Method] = (acc[i.Establishment_Method] || 0) + toAcres(Number(i.Plot_Size) || 0, i.Plot_Size_Unit);
      return acc;
    }, {} as Record<string, number>), [filteredInstallations]);

  // ── District breakdown ───────────────────────────────────────────────────
  // Note: We use the UNFILTERED arrays here so the district list stays populated!
  const districtStats = useMemo(() => {
    const m: Record<string, { pipes: number; acres: number; farmers: Set<string>; visits: number }> = {};
    installations.forEach(i => {
      const d = i.District || 'Unspecified';
      if (!m[d]) m[d] = { pipes: 0, acres: 0, farmers: new Set(), visits: 0 };
      m[d].pipes++;
      m[d].acres += toAcres(Number(i.Plot_Size) || 0, i.Plot_Size_Unit);
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
    filteredInstallations.forEach(i => { m[i.Village] = (m[i.Village] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [filteredInstallations]);

  // ── Irrigation source breakdown ──────────────────────────────────────────
  const irrigationStats = useMemo(() =>
    filteredInstallations.reduce((acc, i) => {
      const src = i.Irrigation_Source || 'Unknown';
      acc[src] = (acc[src] || 0) + 1;
      return acc;
    }, {} as Record<string, number>), [filteredInstallations]);

  // ── Crop stage distribution (from monitoring) ────────────────────────────
  const cropStageStats = useMemo(() =>
    filteredMonitoring.reduce((acc, m) => {
      const stage = m.Crop_Stage || 'Unknown';
      acc[stage] = (acc[stage] || 0) + 1;
      return acc;
    }, {} as Record<string, number>), [filteredMonitoring]);

  // ── Variety distribution ─────────────────────────────────────────────────
  const varietyStats = useMemo(() => {
    const m: Record<string, number> = {};
    filteredInstallations.forEach(i => { const v = i.Variety || 'Local'; m[v] = (m[v] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [filteredInstallations]);

  // ── Pipe installation timeline (by month) ───────────────────────────────
  const installTimeline = useMemo(() => {
    const m: Record<string, number> = {};
    filteredInstallations.forEach(i => {
      if (!i.Installation_Date) return;
      const d = new Date(i.Installation_Date);
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      m[key] = (m[key] || 0) + 1;
    });
    return Object.entries(m).sort(([a], [b]) => a.localeCompare(b)).slice(-6);
  }, [filteredInstallations]);

  // ── Recent monitoring visits ─────────────────────────────────────────────
  const recentVisits = useMemo(() =>
    [...filteredMonitoring]
      .sort((a, b) => new Date(b.Visit_Date || 0).getTime() - new Date(a.Visit_Date || 0).getTime())
      .slice(0, 6), [filteredMonitoring]);

  // ── Water level buckets ──────────────────────────────────────────────────
  const waterBuckets = useMemo(() => {
    const buckets = { 'Below 5cm': 0, '5–15cm': 0, '15–25cm': 0, 'Above 25cm': 0 };
    filteredMonitoring.forEach(m => {
      const wl = parseFloat(String(m.Water_Level ?? '')) || 0;
      if (wl < 5) buckets['Below 5cm']++;
      else if (wl < 15) buckets['5–15cm']++;
      else if (wl < 25) buckets['15–25cm']++;
      else buckets['Above 25cm']++;
    });
    return buckets;
  }, [filteredMonitoring]);

  // ── Trend Data ───────────────────────────────────────────────────────────
  // Parse a YYYY-MM-DD string as LOCAL date (avoids UTC-midnight shifting dates by 1 day in IST)
  const parseLocalDate = (dStr: string): Date | null => {
    if (!dStr) return null;
    // Handle both "YYYY-MM-DD" and "YYYY-MM-DD HH:mm:ss" (Timestamp format)
    const datePart = dStr.split(' ')[0].split('T')[0];
    const parts = datePart.split('-');
    if (parts.length !== 3) return null;
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return isNaN(d.getTime()) ? null : d;
  };

  const trendData = useMemo(() => {
    // Collect all unique date strings from installations and monitoring
    const allDates: Date[] = [
      ...filteredInstallations.map(i => parseLocalDate(i.Installation_Date)),
      ...filteredMonitoring.map(m => parseLocalDate(m.Visit_Date)),
    ].filter((d): d is Date => d !== null);

    if (allDates.length === 0) return [];

    const minTime = Math.min(...allDates.map(d => d.getTime()));
    const maxTime = Math.max(...allDates.map(d => d.getTime()));
    const spanDays = (maxTime - minTime) / (1000 * 60 * 60 * 24);

    // Use DAILY grouping when data spans ≤ 30 days, WEEKLY otherwise
    const getGroupKey = (dStr: string): string | null => {
      const d = parseLocalDate(dStr);
      if (!d) return null;
      if (spanDays <= 30) {
        // Group by exact day: YYYY-MM-DD
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      } else {
        // Group by week start (Monday)
        const day = d.getDay(); // 0=Sun
        const diff = day === 0 ? -6 : 1 - day; // shift to Monday
        const monday = new Date(d);
        monday.setDate(d.getDate() + diff);
        return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
      }
    };

    const buckets: Record<string, { regs: number; visits: number; awdYes: number }> = {};

    filteredInstallations.forEach(i => {
      const key = getGroupKey(i.Installation_Date);
      if (!key) return;
      if (!buckets[key]) buckets[key] = { regs: 0, visits: 0, awdYes: 0 };
      buckets[key].regs++;
    });

    filteredMonitoring.forEach(m => {
      const key = getGroupKey(m.Visit_Date);
      if (!key) return;
      if (!buckets[key]) buckets[key] = { regs: 0, visits: 0, awdYes: 0 };
      buckets[key].visits++;
      if (m.AWD_Followed === 'Yes') buckets[key].awdYes++;
    });

    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, data]) => {
        const d = parseLocalDate(key)!;
        const label = spanDays <= 30
          ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })   // "17 Aug"
          : `Wk ${d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`; // "Wk 11 Aug"
        return {
          week: label,
          rawDate: key,
          Registrations: data.regs,
          AWD_Compliance: data.visits > 0 ? Math.round((data.awdYes / data.visits) * 100) : 0,
        };
      });
  }, [filteredInstallations, filteredMonitoring]);



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
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-violet-600" />
                AWD Field Analytics
              </h1>
              {districtFilter !== 'All' && (
                <button 
                  onClick={() => setDistrictFilter('All')}
                  className="flex items-center gap-1 text-xs font-bold bg-emerald-100 text-emerald-800 px-2 py-1 rounded-full hover:bg-emerald-200 transition"
                >
                  <Filter className="w-3 h-3" />
                  {districtFilter}
                  <X className="w-3 h-3 ml-0.5" />
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-2">
              <span>Real-time aggregated paddy water management data</span>
              <span className="hidden sm:inline-block w-1 h-1 rounded-full bg-slate-300" />
              <span className="font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 shadow-sm">
                Showing data for: {scopeLabel}
              </span>
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${
                adoptionRate >= 70 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                adoptionRate >= 40 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                'bg-red-50 text-red-700 border-red-200'
              }`}>
                <Zap className="w-3 h-3" />
                AWD Adoption: {adoptionRate}%
              </span>
              <span className="inline-flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-full text-xs font-semibold text-slate-600">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                Live Data
              </span>
            </div>
          </div>
        </div>

        {/* ── Target Progress Bar ── */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col md:flex-row items-center gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
              <Target className="w-5 h-5 text-slate-500" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Phase Registration Target</div>
              <div className="text-lg font-black text-slate-800">{totalInstalled} <span className="text-sm font-bold text-slate-400">/ {REGISTRATION_TARGET} pipes</span></div>
            </div>
          </div>
          <div className="flex-1 w-full">
            <div className="flex justify-between text-xs font-bold mb-1.5">
              <span className="text-slate-500">Progress</span>
              <span className="text-emerald-600">{Math.round((totalInstalled / REGISTRATION_TARGET) * 100)}% Complete</span>
            </div>
            <ProgressBar pct={(totalInstalled / REGISTRATION_TARGET) * 100} color="bg-emerald-500" />
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

        {/* ── Trend Over Time ── */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <SectionTitle icon={TrendingUp} title="Registrations & Compliance Trends" sub="Daily activity across selected region" />
          {trendData.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">No trend data available</div>
          ) : (
            <div className="h-64 w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} dy={10} />
                  <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    labelStyle={{ fontWeight: 'bold', color: '#1e293b', marginBottom: '4px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', fontWeight: '600' }} />
                  <Bar yAxisId="left" dataKey="Registrations" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Line yAxisId="right" type="monotone" dataKey="AWD_Compliance" name="AWD Compliance %" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
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
                  <span className="text-xs font-bold text-emerald-600 uppercase">AWD Rate</span>
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
              <div className="mt-3 bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-xs text-emerald-800 leading-relaxed">
                <Lightbulb className="w-4 h-4 text-emerald-500 inline mr-1 -mt-0.5" /> <strong>DSR methods</strong> reduce water usage by up to 30% vs traditional TPR transplanting.
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
            <div className="mt-3 text-xs text-slate-400 text-center">Avg water level: <strong className="text-slate-600">{avgWaterLevel} cm</strong> across {totalVisits} readings</div>
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
                <button 
                  key={name} 
                  onClick={() => setDistrictFilter(name)}
                  className={`w-full text-left rounded-xl border p-3 transition-all ${
                    districtFilter === name 
                      ? 'border-emerald-400 bg-emerald-50 shadow-sm ring-1 ring-emerald-400/20' 
                      : 'border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/30'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 font-bold text-slate-800">
                      <span className={`w-5 h-5 rounded-md ${BAR_COLORS[idx % BAR_COLORS.length]} flex items-center justify-center text-white text-[9px] font-black`}>
                        {idx + 1}
                      </span>
                      {name}
                    </div>
                    <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-mono text-xs">{pipes} pipes</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-xs text-slate-500">
                    <span>👨‍🌾 {farmers} farmers</span>
                    <span>📐 {acres.toFixed(1)} Ac</span>
                    <span>📋 {visits} visits</span>
                  </div>
                  <ProgressBar pct={totalInstalled > 0 ? (pipes / totalInstalled) * 100 : 0} color={BAR_COLORS[idx % BAR_COLORS.length]} thin />
                </button>
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
                  <div className="text-xs text-slate-400">By pipe installations</div>
                </div>
              </div>
              <select
                value={districtFilter}
                onChange={e => setDistrictFilter(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2 py-1 text-slate-600 font-semibold focus:ring-1 focus:ring-emerald-400 bg-white"
              >
                {districts.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              {villageStats.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">No data for this filter</div>
              ) : villageStats.map(([village, count], idx) => (
                <div key={village} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-400 w-4 text-right">{idx + 1}</span>
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
                      <span className="text-xs font-bold text-slate-600">{count}</span>
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
                        <span className="text-xs text-slate-400 shrink-0">{fmtDate(v.Visit_Date)}</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap gap-x-2">
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
                  <div className="text-xs text-emerald-200 font-semibold">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>


      </div>
    </div>
  );
};
