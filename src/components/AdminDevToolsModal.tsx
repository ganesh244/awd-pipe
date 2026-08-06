import React, { useEffect, useState } from 'react';
import { Database, HardDrive, Cpu, RefreshCw, X, Server, Layers, Zap, CheckCircle2, AlertTriangle, ShieldCheck, Activity, MemoryStick, Clock } from 'lucide-react';

const apiFetch = (url: RequestInfo | URL, options?: RequestInit) => {
  const token = localStorage.getItem("awd_auth_token");
  const headers = new Headers(options?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...options, headers });
};

interface CollectionStat {
  name: string;
  count: number;
  size: number;
  storageSize: number;
  totalIndexSize: number;
  avgObjSize: number;
}

interface DBStatsResponse {
  dbStatus: 'cloud' | 'local';
  dbName: string;
  dataSize: number;
  storageSize: number;
  indexSize: number;
  objectsCount: number;
  collectionsCount: number;
  avgDocSize: number;
  collections: CollectionStat[];
  system: {
    nodeVersion: string;
    mongooseVersion: string;
    uptimeSeconds: number;
    heapUsed: number;
    heapTotal: number;
    rss: number;
  };
}

interface AdminDevToolsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminDevToolsModal: React.FC<AdminDevToolsModalProps> = ({ isOpen, onClose }) => {
  const [stats, setStats] = useState<DBStatsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/admin/db-stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      } else {
        const errData = await res.json().catch(() => null);
        setError(errData?.error || `HTTP ${res.status} Error`);
      }
    } catch (err: any) {
      setError(err?.message || 'Network request failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStats();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  // 512 MB Free Tier Atlas Limit estimation
  const ATLAS_FREE_TIER_BYTES = 512 * 1024 * 1024;
  const storageUsedBytes = stats?.storageSize || 0;
  const storagePercent = Math.min(100, Math.max(0.1, (storageUsedBytes / ATLAS_FREE_TIER_BYTES) * 100));

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-slate-900 text-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-slate-800 shadow-2xl flex flex-col">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shadow-inner">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-black text-white text-base tracking-wide uppercase">Admin Dev Tools & Storage Diagnostics</h2>
                <span className="bg-purple-500/20 text-purple-300 text-[10px] font-extrabold px-2 py-0.5 rounded-md border border-purple-500/30">
                  DEV DASHBOARD
                </span>
              </div>
              <p className="text-xs text-slate-400">Live MongoDB database metrics, memory usage, and collection storage details</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchStats}
              disabled={loading}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer disabled:opacity-50"
              title="Refresh Stats"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
              title="Close Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 thin-scroll">
          {error && (
            <div className="bg-rose-950/60 border border-rose-800/80 rounded-2xl p-4 flex items-center gap-3 text-xs text-rose-200">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading && !stats && (
            <div className="text-center py-16 space-y-3">
              <div className="animate-spin h-8 w-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto" />
              <p className="text-xs text-slate-400">Querying MongoDB cluster storage engine & memory metrics...</p>
            </div>
          )}

          {stats && (
            <>
              {/* TOP CARDS: Connection & Storage Gauge */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* Card 1: Database Status */}
                <div className="bg-slate-800/60 border border-slate-800 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1.5 font-bold">
                      <Server className="w-4 h-4 text-emerald-400" /> Database Cluster
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                      stats.dbStatus === 'cloud'
                        ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                        : 'bg-amber-950 text-amber-400 border-amber-800'
                    }`}>
                      {stats.dbStatus === 'cloud' ? 'MongoDB Atlas' : 'In-Memory Draft'}
                    </span>
                  </div>
                  <div className="text-lg font-black text-white font-mono">{stats.dbName}</div>
                  <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800/80">
                    <span>Collections: <strong className="text-white">{stats.collectionsCount}</strong></span>
                    <span>Total Objects: <strong className="text-white">{stats.objectsCount}</strong></span>
                  </div>
                </div>

                {/* Card 2: Total Storage Allocated */}
                <div className="bg-slate-800/60 border border-slate-800 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1.5 font-bold">
                      <HardDrive className="w-4 h-4 text-purple-400" /> Storage Allocated
                    </span>
                    <span className="text-[11px] font-mono text-purple-300 font-bold">{formatBytes(stats.storageSize)}</span>
                  </div>

                  {/* Storage Bar */}
                  <div className="space-y-1 pt-1">
                    <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-700/50">
                      <div
                        className="bg-gradient-to-r from-purple-500 to-emerald-400 h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(3, storagePercent)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>Data: {formatBytes(stats.dataSize)}</span>
                      <span>Indexes: {formatBytes(stats.indexSize)}</span>
                    </div>
                  </div>
                </div>

                {/* Card 3: Server & Memory Uptime */}
                <div className="bg-slate-800/60 border border-slate-800 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1.5 font-bold">
                      <Cpu className="w-4 h-4 text-sky-400" /> Node & Engine Runtime
                    </span>
                    <span className="text-[10px] font-mono text-sky-300 font-bold">{stats.system.nodeVersion}</span>
                  </div>
                  <div className="text-sm font-bold text-white flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Uptime: {formatUptime(stats.system.uptimeSeconds)}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800/80 font-mono">
                    <span>Heap: {formatBytes(stats.system.heapUsed)} / {formatBytes(stats.system.heapTotal)}</span>
                    <span>RSS: {formatBytes(stats.system.rss)}</span>
                  </div>
                </div>

              </div>

              {/* COLLECTION BREAKDOWN TABLE */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-purple-400" />
                    Collection Storage Breakdown ({stats.collections.length} Collections)
                  </h3>
                  <span className="text-[10px] text-slate-400">Avg Doc Size: {formatBytes(stats.avgDocSize)}</span>
                </div>

                <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/50 shadow-inner">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-800/70 text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-800 font-bold">
                      <tr>
                        <th className="p-3">Collection Name</th>
                        <th className="p-3 text-right">Document Count</th>
                        <th className="p-3 text-right">Data Size</th>
                        <th className="p-3 text-right">Storage Size</th>
                        <th className="p-3 text-right">Index Size</th>
                        <th className="p-3 text-right">Avg Doc Size</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                      {stats.collections.map((coll) => (
                        <tr key={coll.name} className="hover:bg-slate-800/40 transition">
                          <td className="p-3 font-extrabold text-white flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-purple-400" />
                            {coll.name}
                          </td>
                          <td className="p-3 text-right font-bold text-slate-200">{coll.count.toLocaleString()}</td>
                          <td className="p-3 text-right text-emerald-400 font-bold">{formatBytes(coll.size)}</td>
                          <td className="p-3 text-right text-purple-300">{formatBytes(coll.storageSize)}</td>
                          <td className="p-3 text-right text-slate-400">{formatBytes(coll.totalIndexSize)}</td>
                          <td className="p-3 text-right text-slate-400">{formatBytes(coll.avgObjSize)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* FOOTER TIPS */}
              <div className="bg-purple-950/30 border border-purple-800/40 rounded-2xl p-4 flex items-start gap-3 text-xs text-purple-200">
                <ShieldCheck className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <strong className="text-white block font-bold">Database Storage Optimization Note:</strong>
                  <p className="text-[11px] leading-relaxed text-purple-200/90">
                    MongoDB Atlas automatically compresses data using the WiredTiger storage engine. Indices improve search performance across field parameters (Farmer ID, Village, Pipe ID, User Scope).
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="text-[11px] text-slate-500">
            AWD Pipe Registry · Systems Health Diagnostics
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition cursor-pointer"
          >
            Close Dev Tools
          </button>
        </div>

      </div>
    </div>
  );
};
