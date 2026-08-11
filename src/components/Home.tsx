import React, { useMemo } from 'react';
import { User, Installation, MonitoringRecord, AWDPipe } from '../types';
import { toAcres } from '../utils/plotUtils';
import { 
  Sprout, ClipboardCheck, MapPin, BarChart3, Users, 
  Printer, Network, Droplets, Sparkles, CheckSquare, 
  Leaf, ArrowRight, Clock, Award, ShieldCheck, Zap, CheckCircle2
} from 'lucide-react';

interface HomeProps {
  currentUser: User;
  setActiveTab: (tab: string) => void;
  setAnalyticsSubTab: (sub: 'overview' | 'reports') => void;
  setInventorySubTab: (sub: 'inventory' | 'labels') => void;
  installations: Installation[];
  monitoringList: MonitoringRecord[];
  pipes: AWDPipe[];
  onOpenGenerateModal?: () => void;
  isOnline: boolean;
  offlineQueueCount: number;
  onOpenSyncModal: () => void;
}

export const Home: React.FC<HomeProps> = ({
  currentUser,
  setActiveTab,
  setAnalyticsSubTab,
  setInventorySubTab,
  installations,
  monitoringList,
  pipes,
  onOpenGenerateModal,
  isOnline,
  offlineQueueCount,
  onOpenSyncModal,
}) => {
  // Time of day greeting
  const greeting = useMemo(() => {
    const hrs = new Date().getHours();
    if (hrs < 12) return 'Good Morning';
    if (hrs < 17) return 'Good Afternoon';
    return 'Good Evening';
  }, []);

  // Filter scope based on user role to show personal stats on home screen
  const userInstallations = useMemo(() => {
    return installations;
  }, [installations]);

  const userMonitoring = useMemo(() => {
    const pipeIds = new Set(userInstallations.map(i => i.Pipe_ID));
    return monitoringList.filter(m => pipeIds.has(m.Pipe_ID));
  }, [monitoringList, userInstallations]);

  // AWD Compliance
  const compliantVisits = userMonitoring.filter(m => m.AWD_Followed === 'Yes').length;
  const totalVisits = userMonitoring.length;
  const personalComplianceRate = totalVisits > 0 ? Math.round((compliantVisits / totalVisits) * 100) : 100;

  // Impact Calculations (AWD savings estimates)
  // Assuming 1 Acre under AWD saves ~150,000 Liters of water per wet season/cycle
  const totalAcres = userInstallations.reduce((sum, i) => sum + toAcres(Number(i.Plot_Size) || 0, i.Plot_Size_Unit), 0);
  const waterSavedLiters = Math.round(totalAcres * 150000 * (personalComplianceRate / 100));
  
  // Methane reduction: AWD reduces methane emissions by up to ~48%
  // CO2 equivalent reduction: ~0.8 tonnes per acre
  const co2ReducedTons = (totalAcres * 0.8 * (personalComplianceRate / 100)).toFixed(1);

  // Quick Action Buttons configurations
  const actions = useMemo(() => {
    const list = [
      {
        title: 'Register Pipe',
        desc: 'Scan QR and assign new farmer',
        icon: ClipboardCheck,
        color: 'from-emerald-500 to-teal-600',
        onClick: () => setActiveTab('mobile'),
        roles: ['Admin', 'State Manager', 'District Manager', 'Area Manager', 'CF', 'JCF']
      },
      {
        title: 'Interactive Map',
        desc: 'View geo-tagged plots and water status',
        icon: MapPin,
        color: 'from-blue-500 to-indigo-600',
        onClick: () => setActiveTab('map'),
        roles: ['Admin', 'State Manager', 'District Manager', 'Area Manager']
      },
      {
        title: 'Analytics Dashboard',
        desc: 'Analyze AWD adoption and indicators',
        icon: BarChart3,
        color: 'from-purple-500 to-violet-600',
        onClick: () => {
          setAnalyticsSubTab('overview');
          setActiveTab('analytics');
        },
        roles: ['Admin', 'State Manager', 'District Manager']
      },
      {
        title: 'Farmer Directory',
        desc: 'Search farmer details and profiles',
        icon: Users,
        color: 'from-indigo-500 to-blue-600',
        onClick: () => setActiveTab('farmers'),
        roles: ['Admin', 'State Manager', 'District Manager', 'Area Manager', 'CF', 'JCF']
      },
      {
        title: 'Reports & Export',
        desc: 'Download CSV and printable data dossiers',
        icon: Sprout,
        color: 'from-emerald-500 to-green-600',
        onClick: () => {
          setAnalyticsSubTab('reports');
          setActiveTab('analytics');
        },
        roles: ['Admin', 'State Manager', 'District Manager', 'Area Manager', 'CF', 'JCF']
      },
      {
        title: 'Mint QR & Print Labels',
        desc: 'Generate batches and print QR codes',
        icon: Printer,
        color: 'from-amber-500 to-orange-600',
        onClick: () => {
          setInventorySubTab('labels');
          setActiveTab('inventory');
        },
        roles: ['Admin', 'State Manager']
      },
      {
        title: 'Manage Team',
        desc: 'Add, update or delete user roles',
        icon: Network,
        color: 'from-teal-500 to-cyan-600',
        onClick: () => setActiveTab('hierarchy'),
        roles: ['Admin', 'State Manager', 'District Manager']
      }
    ];

    return list.filter(a => a.roles.includes(currentUser.role));
  }, [currentUser, setActiveTab, setAnalyticsSubTab, setInventorySubTab]);

  // Role based duties checklist
  const checklist = useMemo(() => {
    switch (currentUser.role) {
      case 'CF':
      case 'JCF':
        return [
          'Verify newly installed field pipes status is "Good"',
          'Collect water level readings every 3-4 days',
          'Maintain coordination with JCF and regional farmers',
          'Report damaged pipes to Area Manager immediately'
        ];
      case 'Area Manager':
        return [
          'Audit field installations to ensure correct geo-tagging',
          'Provide physical training on reading pipe gauges',
          'Resolve farmer questions regarding direct-seeding methods',
          'Consolidate local progress reports for District review'
        ];
      case 'District Manager':
        return [
          'Coordinate CF/JCF deployments inside active blocks',
          'Ensure high AWD compliance rates across the district',
          'Analyze weekly village-level water indicator cycles',
          'Approve user hierarchy changes within the district'
        ];
      case 'State Manager':
        return [
          'Allocate pipe batch resources to active districts',
          'Organize state-wide training sessions for field staff',
          'Review progress on sustainability water preservation metrics',
          'Authorize system database batch updates'
        ];
      case 'Admin':
      default:
        return [
          'Monitor database connections and cloud-sync states',
          'Generate high security authenticated QR code batches',
          'Maintain global user hierarchy parameters',
          'Configure Google Apps Script sync parameters'
        ];
    }
  }, [currentUser]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 page-enter">

      {/* Offline Alert Banner */}
      {(!isOnline || offlineQueueCount > 0) && (
        <div className={`p-4 rounded-3xl border flex items-center justify-between flex-wrap gap-3 ${
          offlineQueueCount > 0 
            ? 'bg-amber-50 border-amber-200 text-amber-900 animate-pulse' 
            : 'bg-rose-50 border-rose-200 text-rose-900'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
              offlineQueueCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
            }`}>
              {offlineQueueCount > 0 ? <Zap className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
            </div>
            <div>
              <div className="font-bold text-xs">
                {offlineQueueCount > 0 
                  ? `Offline Records Detected (${offlineQueueCount} pending)` 
                  : 'Field Device Operating in Offline Mode'
                }
              </div>
              <p className="text-xs opacity-80 mt-0.5">
                {offlineQueueCount > 0 
                  ? 'You registered new farmers or visits while offline. Sync them back to server once connected.' 
                  : 'You can still register farmers and log visits. They will be queued for upload later.'
                }
              </p>
            </div>
          </div>
          
          <button
            onClick={onOpenSyncModal}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold shadow-sm active:scale-95 transition-all cursor-pointer ${
              offlineQueueCount > 0 
                ? 'bg-amber-600 hover:bg-amber-700 text-white' 
                : 'bg-rose-600 hover:bg-rose-700 text-white'
            }`}
          >
            {offlineQueueCount > 0 ? 'Sync Now' : 'Sync Queue'}
          </button>
        </div>
      )}
      
      {/* ── Welcome Banner ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-800 via-emerald-900 to-[#0a180e] p-6 sm:p-8 text-white shadow-xl shadow-emerald-950/20 border border-emerald-700/20">
        <div className="absolute right-0 top-0 -mr-10 -mt-10 w-48 h-48 rounded-full bg-emerald-600/10 blur-3xl pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 -ml-10 -mb-10 w-48 h-48 rounded-full bg-lime-500/10 blur-2xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 bg-emerald-700/40 border border-emerald-500/30 rounded-full px-3 py-1 text-xs font-bold text-emerald-300">
              <Sparkles className="w-3.5 h-3.5" />
              {currentUser.role} Account
            </div>
            
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {greeting}, <span className="text-emerald-400">{currentUser.name}</span>!
            </h1>
            
            <p className="text-slate-300 text-sm max-w-xl leading-relaxed">
              Welcome back to your Alternate Wetting & Drying field workspace. 
              {currentUser.areaName ? ` Managing field operations for ${currentUser.areaName}.` : ''} 
              {currentUser.district ? ` Scoped to ${currentUser.district} District.` : ''}
            </p>
          </div>

          <div className="flex gap-3">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 text-center min-w-0 flex-1">
              <div className="text-2xl font-black text-emerald-400">{userInstallations.length}</div>
              <div className="text-xs text-slate-300 font-semibold uppercase tracking-wider mt-0.5">My Pipes</div>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 text-center min-w-0 flex-1">
              <div className="text-2xl font-black text-emerald-400">{personalComplianceRate}%</div>
              <div className="text-xs text-slate-300 font-semibold uppercase tracking-wider mt-0.5">AWD Rate</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Dashboard Columns ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Quick Actions & Checklist */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Quick Actions */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <div className="w-7 h-7 bg-emerald-50 rounded-lg flex items-center justify-center">
                <Zap className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm">Quick Actions</h3>
                <p className="text-xs text-slate-400">Shortcuts to features matching your role permission level</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {actions.map((act) => {
                const Icon = act.icon;
                return (
                  <button
                    key={act.title}
                    onClick={act.onClick}
                    className="flex items-start gap-4 p-4 rounded-2xl border border-slate-100 hover:border-emerald-200 bg-slate-50/50 hover:bg-emerald-50/20 transition-all text-left group cursor-pointer"
                  >
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${act.color} flex items-center justify-center text-white shrink-0 shadow-md`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-800 text-sm group-hover:text-emerald-700 transition-colors flex items-center gap-1.5">
                        {act.title}
                        <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-emerald-600" />
                      </div>
                      <p className="text-slate-400 text-xs mt-0.5 leading-snug">{act.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Role Duties Checklist */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <div className="w-7 h-7 bg-emerald-50 rounded-lg flex items-center justify-center">
                <CheckSquare className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm">Role Directives & Checklist</h3>
                <p className="text-xs text-slate-400">Operational tasks and guidelines for {currentUser.role}s</p>
              </div>
            </div>

            <div className="space-y-3">
              {checklist.map((item, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50/60 border border-slate-100 text-xs">
                  <span className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold shrink-0">
                    {idx + 1}
                  </span>
                  <p className="text-slate-600 leading-normal font-medium mt-0.5">{item}</p>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right Column: Sustainability Impact & Info Panel */}
        <div className="space-y-6">

          {/* Sustainability & Environmental Impact */}
          <div className="bg-gradient-to-b from-[#111e15] to-[#09100b] rounded-3xl p-6 text-white shadow-xl shadow-slate-900/10 border border-white/5 space-y-5 relative overflow-hidden">
            <div className="absolute -right-16 -bottom-16 w-36 h-36 rounded-full bg-emerald-500/5 blur-3xl pointer-events-none" />
            
            <div className="flex items-center gap-2 border-b border-white/10 pb-3">
              <div className="w-7 h-7 bg-emerald-500/10 rounded-lg flex items-center justify-center border border-emerald-500/20">
                <Leaf className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <h3 className="font-extrabold text-white text-sm">Sustainability Impact</h3>
                <p className="text-xs text-slate-400">Environmental benefits from your field operations</p>
              </div>
            </div>

            {/* Metric widgets */}
            <div className="space-y-4">
              <div className="p-3 bg-white/5 rounded-2xl border border-white/5">
                <div className="text-xs text-emerald-400 font-bold uppercase tracking-wider">Estimated Water Saved</div>
                <div className="text-2xl font-black mt-1 font-mono">{waterSavedLiters.toLocaleString('en-IN')} L</div>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Calculated based on {totalAcres.toFixed(1)} active acres managed with a {personalComplianceRate}% AWD follow-through rate.
                </p>
              </div>

              <div className="p-3 bg-white/5 rounded-2xl border border-white/5">
                <div className="text-xs text-teal-400 font-bold uppercase tracking-wider">Methane Emission Reduction</div>
                <div className="text-2xl font-black mt-1 font-mono">~48%</div>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  AWD practice significantly reduces carbon equivalent methane output of paddy wetlands.
                </p>
              </div>

              <div className="p-3 bg-white/5 rounded-2xl border border-white/5">
                <div className="text-xs text-lime-400 font-bold uppercase tracking-wider">CO₂ Equivalent Offset</div>
                <div className="text-2xl font-black mt-1 font-mono">{co2ReducedTons} Tons</div>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Net greenhouse gas mitigation equivalent to planting approx. {Math.round(Number(co2ReducedTons) * 16 || 0)} mature trees!
                </p>
              </div>
            </div>
          </div>

          {/* Quick System Info / Announcement */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <div className="w-7 h-7 bg-emerald-50 rounded-lg flex items-center justify-center">
                <Clock className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm">System Guidelines</h3>
                <p className="text-xs text-slate-400">Current release rules & specs</p>
              </div>
            </div>

            <div className="text-xs text-slate-500 space-y-3 leading-relaxed">
              <div className="flex gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <p>Ensure your mobile GPS is enabled before starting pipe registrations.</p>
              </div>
              <div className="flex gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <p>If camera output remains blank on desktop browsers, verify camera permission settings for localhost/Render domain name.</p>
              </div>
              <div className="flex gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <p>Weekly summaries are exported automatically to Google Sheets at midnight.</p>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
