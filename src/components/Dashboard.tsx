import React from 'react';
import { AWDPipe, Installation, MonitoringRecord } from '../types';
import { Sprout, Users, Map, Activity, ShieldAlert, CheckCircle2, Award, PieChart, Layers, Droplets } from 'lucide-react';

interface DashboardProps {
  pipes: AWDPipe[];
  installations: Installation[];
  monitoringList: MonitoringRecord[];
}

export const Dashboard: React.FC<DashboardProps> = ({ pipes, installations, monitoringList }) => {
  // Key Metrics
  const totalPipes = pipes.length;
  const totalInstalled = installations.length;
  const totalAvailable = pipes.filter((p) => p.Status === 'Available').length;
  const totalDamaged = pipes.filter((p) => p.Status === 'Damaged' || p.Status === 'Removed').length;

  const totalFarmers = new Set(installations.map((i) => i.Farmer_Name)).size;
  const totalAcres = installations.reduce((sum, i) => sum + (Number(i.Plot_Size) || 0), 0);

  // Method Breakdown
  const methodStats = installations.reduce(
    (acc, i) => {
      const method = i.Establishment_Method;
      acc[method] = (acc[method] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const methodAcres = installations.reduce(
    (acc, i) => {
      const method = i.Establishment_Method;
      acc[method] = (acc[method] || 0) + (Number(i.Plot_Size) || 0);
      return acc;
    },
    {} as Record<string, number>
  );

  // District Breakdown
  const districtStats = installations.reduce(
    (acc, i) => {
      const dist = i.District || 'Unspecified';
      acc[dist] = (acc[dist] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  // Variety Distribution
  const varietyStats = installations.reduce(
    (acc, i) => {
      const varName = i.Variety || 'Local Variety';
      acc[varName] = (acc[varName] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  // AWD Compliance Rate
  const compliantVisits = monitoringList.filter((m) => m.AWD_Followed === 'Yes').length;
  const totalVisits = monitoringList.length;
  const adoptionRate = totalVisits > 0 ? Math.round((compliantVisits / totalVisits) * 100) : 100;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Header Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#d1dbd1] pb-4">
        <div>
          <h1 className="text-2xl font-bold text-[#2d3a2d] tracking-tight flex items-center gap-2 uppercase">
            <Sprout className="w-7 h-7 text-[#88b04b]" />
            AWD Field Impact & Monitoring Analytics
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time paddy water management data aggregated from Google Sheets (Installations, Monitoring, AWD_Pipes)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="bg-[#2d4a2d] text-white text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded border border-[#3d5d3d]">
            AWD Adoption Rate: {adoptionRate}%
          </span>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        
        <div className="bg-white rounded-lg p-4 shadow-sm border border-[#d1dbd1]">
          <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold uppercase mb-1">
            <Layers className="w-3.5 h-3.5 text-[#88b04b]" /> Total Pipes
          </div>
          <div className="text-2xl font-bold text-[#2d3a2d]">{totalPipes}</div>
          <span className="text-[10px] text-slate-400">Master Inventory</span>
        </div>

        <div className="bg-white rounded-lg p-4 shadow-sm border border-[#d1dbd1]">
          <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold uppercase mb-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#88b04b]" /> Installed
          </div>
          <div className="text-2xl font-bold text-[#2d3a2d]">{totalInstalled}</div>
          <span className="text-[10px] text-[#88b04b] font-bold">Active in Fields</span>
        </div>

        <div className="bg-white rounded-lg p-4 shadow-sm border border-[#d1dbd1]">
          <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold uppercase mb-1">
            <Users className="w-3.5 h-3.5 text-[#88b04b]" /> Farmers
          </div>
          <div className="text-2xl font-bold text-[#2d3a2d]">{totalFarmers}</div>
          <span className="text-[10px] text-slate-400">Paddy Cultivators</span>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase mb-1">
            <Map className="w-4 h-4 text-emerald-600" /> Acres Covered
          </div>
          <div className="text-2xl font-black text-slate-800">{totalAcres.toFixed(1)}</div>
          <span className="text-[10px] text-slate-400">Total Paddy Land</span>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase mb-1">
            <Activity className="w-4 h-4 text-emerald-600" /> Field Visits
          </div>
          <div className="text-2xl font-black text-slate-800">{totalVisits}</div>
          <span className="text-[10px] text-slate-400">Monitoring Logs</span>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase mb-1">
            <ShieldAlert className="w-4 h-4 text-amber-600" /> Damaged/Unused
          </div>
          <div className="text-2xl font-black text-slate-700">{totalAvailable + totalDamaged}</div>
          <span className="text-[10px] text-amber-600">{totalAvailable} Avail / {totalDamaged} Damaged</span>
        </div>

      </div>

      {/* Main Charts & Breakdown Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Establishment Method Breakdown */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-4">
          <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2 border-b pb-3">
            <PieChart className="w-5 h-5 text-emerald-600" />
            Establishment Method Distribution
          </h3>
          <div className="space-y-3 text-xs">
            {['Dry DSR', 'Wet DSR', 'TPR'].map((method) => {
              const count = methodStats[method] || 0;
              const acres = methodAcres[method] || 0;
              const pct = totalInstalled > 0 ? Math.round((count / totalInstalled) * 100) : 0;
              return (
                <div key={method} className="space-y-1">
                  <div className="flex justify-between font-semibold text-slate-700">
                    <span>{method}</span>
                    <span>{count} farmers ({acres.toFixed(1)} Acres) - {pct}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        method === 'Dry DSR'
                          ? 'bg-emerald-600'
                          : method === 'Wet DSR'
                          ? 'bg-teal-500'
                          : 'bg-emerald-400'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-xs text-emerald-900">
            💡 <strong>Direct Seeded Rice (DSR)</strong> reduces water consumption by up to 30% compared to traditional TPR!
          </div>
        </div>

        {/* District-wise Installations */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-4">
          <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2 border-b pb-3">
            <Map className="w-5 h-5 text-emerald-600" />
            District-wise Installations
          </h3>
          <div className="space-y-2 text-xs">
            {Object.entries(districtStats).map(([district, count]) => {
              const numCount = Number(count);
              const pct = totalInstalled > 0 ? Math.round((numCount / totalInstalled) * 100) : 0;
              return (
                <div key={district} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="font-bold text-slate-800">{district}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-slate-600">{numCount} pipes</span>
                    <span className="bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded text-[10px]">
                      {pct}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Variety Distribution & AWD Compliance */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-4">
          <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2 border-b pb-3">
            <Droplets className="w-5 h-5 text-emerald-600" />
            Paddy Variety & Compliance
          </h3>
          <div className="space-y-2 text-xs">
            <div className="font-semibold text-slate-500 mb-1">Top Varieties Cultivated:</div>
            {Object.entries(varietyStats).map(([varName, count]) => (
              <div key={varName} className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-700 font-medium">{varName}</span>
                <span className="font-bold text-slate-900">{count} plots</span>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Monitoring Water Compliance:</span>
              <span className="font-extrabold text-emerald-700">{compliantVisits} / {totalVisits} compliant</span>
            </div>
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${adoptionRate}%` }} />
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
