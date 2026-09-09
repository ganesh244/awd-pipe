import React, { useMemo } from 'react';
import { User, Installation, MonitoringRecord, AWDPipe, PipeStatus } from '../types';
import { toAcres } from '../utils/plotUtils';
import {
  ScanLine, ClipboardCheck, MapPin, Users, Printer, Network,
  RefreshCw, ArrowRight, ChevronRight, Boxes, Download,
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

// Real Status values only — the design prototype's mock "Verified/Unverified"
// concept doesn't exist in this app's data model, so stats below are built
// from the actual PipeStatus values instead of inventing a field.
const STATUS_TAG: Record<PipeStatus, string> = {
  Installed: 'awd-tag-accent',
  Available: 'awd-tag-neutral',
  Damaged: 'awd-tag-danger',
  Removed: 'awd-tag-danger',
  Replaced: 'awd-tag-warning',
};

function groupCount<T>(items: T[], key: (item: T) => string | undefined): Array<{ name: string; count: number }> {
  const map = new Map<string, number>();
  for (const item of items) {
    const k = key(item) || 'Unassigned';
    map.set(k, (map.get(k) || 0) + 1);
  }
  return Array.from(map.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
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
  const role = currentUser.role;
  const isJcf = role === 'JCF' || role === 'CF';
  const isArea = role === 'Area Manager';
  const isMgr = role === 'District Manager' || role === 'State Manager';
  const isAdmin = role === 'Admin';

  const villageCount = useMemo(
    () => new Set(installations.map(i => i.Village).filter(Boolean)).size,
    [installations]
  );

  const weekCount = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return installations.filter(i => i.Installation_Date && new Date(i.Installation_Date).getTime() >= weekAgo).length;
  }, [installations]);

  const totalAcres = useMemo(
    () => installations.reduce((sum, i) => sum + toAcres(Number(i.Plot_Size) || 0, i.Plot_Size_Unit), 0),
    [installations]
  );

  const farmerCount = useMemo(
    () => new Set(installations.map(i => i.Farmer_Name).filter(Boolean)).size,
    [installations]
  );

  const availableCount = useMemo(() => pipes.filter(p => p.Status === 'Available').length, [pipes]);
  const installedCount = useMemo(() => pipes.filter(p => p.Status === 'Installed').length, [pipes]);
  const damagedCount = useMemo(() => pipes.filter(p => p.Status === 'Damaged').length, [pipes]);

  const recentInstalls = useMemo(() => {
    return [...installations]
      .sort((a, b) => new Date(b.Installation_Date || b.Timestamp).getTime() - new Date(a.Installation_Date || a.Timestamp).getTime())
      .slice(0, 8);
  }, [installations]);

  const byDistrict = useMemo(() => groupCount<AWDPipe>(pipes, p => p.District), [pipes]);
  const byVillage = useMemo(() => groupCount<Installation>(installations, i => i.Village), [installations]);
  const stateCount = useMemo(() => new Set(pipes.map(p => p.State).filter(Boolean)).size, [pipes]);
  const districtCount = useMemo(() => new Set(pipes.map(p => p.District).filter(Boolean)).size, [pipes]);

  const openDirectory = () => setActiveTab('farmers');
  const openMap = () => setActiveTab('map');
  const openHierarchy = () => setActiveTab('hierarchy');
  const openReports = () => { setAnalyticsSubTab('reports'); setActiveTab('analytics'); };
  const openInventory = () => { setInventorySubTab('inventory'); setActiveTab('inventory'); };
  const openLabels = () => { setInventorySubTab('labels'); setActiveTab('inventory'); };
  const openRegister = () => setActiveTab('mobile');

  return (
    <div className="pb-6">
      {/* Offline / sync queue banner */}
      {(!isOnline || offlineQueueCount > 0) && (
        <div className="flex items-center gap-3 px-4 py-3 border-b-2" style={{ borderColor: 'var(--color-border-light)', background: 'var(--color-accent-100)' }}>
          <RefreshCw className="w-4 h-4 shrink-0" style={{ color: 'var(--color-accent-700)' }} />
          <div className="flex-1 min-w-0 text-xs" style={{ color: 'var(--color-accent-800)' }}>
            {offlineQueueCount > 0
              ? `${offlineQueueCount} registration${offlineQueueCount === 1 ? '' : 's'} saved on this device, waiting to sync.`
              : 'You are offline. New records will be queued until you reconnect.'}
          </div>
          {offlineQueueCount > 0 && (
            <button onClick={onOpenSyncModal} className="awd-btn-primary shrink-0" style={{ padding: '6px 12px' }}>
              Sync
            </button>
          )}
        </div>
      )}

      {/* ══════════════════ JCF / CF ══════════════════ */}
      {isJcf && (
        <div>
          <div className="px-4 pt-5 pb-6 text-white" style={{ background: 'var(--color-accent-500)' }}>
            <div className="awd-kicker" style={{ color: 'rgba(255,255,255,0.85)' }}>Pipes I have installed</div>
            <div className="flex items-end gap-3 mt-1">
              <span className="awd-mono font-black leading-none" style={{ fontSize: 56 }}>{installations.length}</span>
              <span className="text-xs leading-snug pb-1.5 max-w-[190px] opacity-90">
                across {villageCount} village{villageCount === 1 ? '' : 's'}. {weekCount} registered this week.
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 awd-card" style={{ borderTop: 0 }}>
            <button onClick={openRegister} className="awd-btn-secondary" style={{ border: 0, borderRight: '2px solid var(--color-border-light)' }}>
              <ScanLine className="w-5 h-5 shrink-0" />Scan a QR
            </button>
            <button onClick={openRegister} className="awd-btn-secondary" style={{ border: 0 }}>
              <ClipboardCheck className="w-5 h-5 shrink-0" />Register pipe
            </button>
          </div>

          <div className="grid grid-cols-2 awd-card" style={{ borderTop: 0 }}>
            <div className="px-3.5 py-3" style={{ borderRight: '1px solid var(--color-border-light)' }}>
              <div className="awd-mono font-black" style={{ fontSize: 22 }}>{totalAcres.toFixed(1)}</div>
              <div className="text-[9.5px] uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>Acres</div>
            </div>
            <div className="px-3.5 py-3">
              <div className="awd-mono font-black" style={{ fontSize: 22 }}>{farmerCount}</div>
              <div className="text-[9.5px] uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>Farmers</div>
            </div>
          </div>

          <div className="flex items-baseline justify-between px-4 pt-4 pb-1.5">
            <h3 className="font-extrabold text-sm">Recent installations</h3>
            <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Newest first</span>
          </div>
          <div className="awd-card" style={{ borderLeft: 0, borderRight: 0 }}>
            {recentInstalls.length === 0 && (
              <div className="px-4 py-6 text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>No installations yet.</div>
            )}
            {recentInstalls.map(p => (
              <div
                key={p.Pipe_ID}
                className="awd-row"
                onClick={() => setActiveTab('farmers')}
              >
                <div className="flex-none w-11 h-11 grid place-items-center" style={{ background: 'var(--color-accent-100)', color: 'var(--color-accent-700)' }}>
                  <ClipboardCheck className="w-[18px] h-[18px]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="awd-mono font-extrabold" style={{ fontSize: 12.5 }}>{p.Pipe_ID}</div>
                  <div className="text-xs truncate" style={{ color: 'var(--color-text-secondary)' }}>
                    {p.Farmer_Name} · {p.Village} · {p.Plot_Size}{p.Plot_Size_Unit}
                  </div>
                </div>
                <span className="awd-tag awd-tag-accent">Installed</span>
              </div>
            ))}
          </div>

          <div className="px-4 pt-4 flex flex-col gap-2">
            <button onClick={openDirectory} className="awd-btn-secondary justify-start w-full">
              All installations ({installations.length})<ChevronRight className="w-4 h-4 ml-auto opacity-50" />
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════ Area Manager ══════════════════ */}
      {isArea && (
        <div>
          <div className="px-4 py-4" style={{ borderBottom: '2px solid var(--color-border-light)' }}>
            <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              {currentUser.areaName || 'Your area'} · {villageCount} village{villageCount === 1 ? '' : 's'}
            </div>
            <div className="flex items-end gap-2 mt-1.5">
              <span className="awd-mono font-black leading-none" style={{ fontSize: 44 }}>{installedCount}</span>
              <span className="text-[11px] leading-snug pb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                pipes installed<br />of {pipes.length} allotted
              </span>
            </div>
            <div className="h-3 mt-2.5 flex" style={{ background: 'var(--color-surface-alt)' }}>
              <div style={{ width: `${pipes.length ? Math.round((installedCount / pipes.length) * 100) : 0}%`, background: 'var(--color-accent-500)' }} />
            </div>
          </div>

          <div className="grid grid-cols-2 awd-card" style={{ borderTop: 0 }}>
            <div className="px-3.5 py-3" style={{ borderRight: '1px solid var(--color-border-light)' }}>
              <div className="awd-mono font-black" style={{ fontSize: 22 }}>{availableCount}</div>
              <div className="text-[9.5px] uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>Available</div>
            </div>
            <div className="px-3.5 py-3">
              <div className="awd-mono font-black" style={{ fontSize: 22, color: damagedCount ? 'var(--color-warning)' : undefined }}>{damagedCount}</div>
              <div className="text-[9.5px] uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>Damaged</div>
            </div>
          </div>

          <div className="px-4 pt-4 pb-1.5">
            <h3 className="font-extrabold text-sm">By village</h3>
          </div>
          <div className="awd-card" style={{ borderLeft: 0, borderRight: 0 }}>
            {byVillage.slice(0, 8).map(v => (
              <div key={v.name} className="awd-row" style={{ cursor: 'default' }}>
                <div className="flex-1 min-w-0 text-xs font-semibold">{v.name}</div>
                <span className="awd-mono text-xs font-bold" style={{ color: 'var(--color-text-secondary)' }}>{v.count}</span>
              </div>
            ))}
          </div>

          <div className="px-4 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button onClick={openMap} className="awd-btn-secondary"><MapPin className="w-4 h-4" />Open field map</button>
            <button onClick={openDirectory} className="awd-btn-secondary"><Users className="w-4 h-4" />All installations ({installations.length})</button>
            <button onClick={openReports} className="awd-btn-secondary sm:col-span-2"><Download className="w-4 h-4" />Export installation data</button>
          </div>
        </div>
      )}

      {/* ══════════════════ District / State Manager ══════════════════ */}
      {isMgr && (
        <div>
          <div className="px-4 py-4" style={{ borderBottom: '2px solid var(--color-border-light)' }}>
            <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              {role === 'State Manager' ? (currentUser.state || 'Your state') : (currentUser.district || 'Your district')}
            </div>
            <div className="flex items-end gap-2 mt-1.5">
              <span className="awd-mono font-black leading-none" style={{ fontSize: 44 }}>{installedCount}</span>
              <span className="text-[11px] leading-snug pb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                pipes installed<br />of {pipes.length} allotted
              </span>
            </div>
            <div className="h-3 mt-2.5 flex" style={{ background: 'var(--color-surface-alt)' }}>
              <div style={{ width: `${pipes.length ? Math.round((installedCount / pipes.length) * 100) : 0}%`, background: 'var(--color-accent-500)' }} />
            </div>
          </div>

          <div className="grid grid-cols-2 awd-card" style={{ borderTop: 0 }}>
            <div className="px-3.5 py-3" style={{ borderRight: '1px solid var(--color-border-light)' }}>
              <div className="awd-mono font-black" style={{ fontSize: 22 }}>{availableCount}</div>
              <div className="text-[9.5px] uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>Available</div>
            </div>
            <div className="px-3.5 py-3">
              <div className="awd-mono font-black" style={{ fontSize: 22, color: damagedCount ? 'var(--color-warning)' : undefined }}>{damagedCount}</div>
              <div className="text-[9.5px] uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>Damaged</div>
            </div>
          </div>

          <div className="px-4 pt-4 pb-1.5">
            <h3 className="font-extrabold text-sm">{role === 'State Manager' ? 'By district' : 'By village'}</h3>
          </div>
          <div className="awd-card" style={{ borderLeft: 0, borderRight: 0 }}>
            {(role === 'State Manager' ? byDistrict : byVillage).slice(0, 8).map(v => (
              <div key={v.name} className="awd-row" style={{ cursor: 'default' }}>
                <div className="flex-1 min-w-0 text-xs font-semibold">{v.name}</div>
                <span className="awd-mono text-xs font-bold" style={{ color: 'var(--color-text-secondary)' }}>{v.count}</span>
              </div>
            ))}
          </div>

          <div className="px-4 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {role === 'State Manager' && onOpenGenerateModal && (
              <button onClick={onOpenGenerateModal} className="awd-btn-primary sm:col-span-2"><Boxes className="w-4 h-4" />Allot a new QR batch</button>
            )}
            <button onClick={openMap} className="awd-btn-secondary"><MapPin className="w-4 h-4" />Open field map</button>
            <button onClick={openHierarchy} className="awd-btn-secondary"><Network className="w-4 h-4" />Hierarchy &amp; users</button>
            <button onClick={openReports} className="awd-btn-secondary sm:col-span-2"><Download className="w-4 h-4" />Export installation data</button>
          </div>
        </div>
      )}

      {/* ══════════════════ Admin ══════════════════ */}
      {isAdmin && (
        <div>
          <div className="px-4 py-5 text-white" style={{ background: 'var(--color-shell)' }}>
            <div className="awd-kicker" style={{ color: 'var(--color-accent-400)' }}>Pipes registered</div>
            <div className="awd-mono font-black leading-none mt-1" style={{ fontSize: 44 }}>{installedCount}</div>
            <div className="text-[11px] mt-1 opacity-70">
              of {pipes.length} minted · {stateCount} state{stateCount === 1 ? '' : 's'} · {districtCount} district{districtCount === 1 ? '' : 's'}
            </div>
          </div>

          <div className="grid grid-cols-3 awd-card" style={{ borderTop: 0 }}>
            <div className="px-3 py-3" style={{ borderRight: '1px solid var(--color-border-light)' }}>
              <div className="awd-mono font-black" style={{ fontSize: 22 }}>{availableCount}</div>
              <div className="text-[9.5px] uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>Available</div>
            </div>
            <div className="px-3 py-3" style={{ borderRight: '1px solid var(--color-border-light)' }}>
              <div className="awd-mono font-black" style={{ fontSize: 22, color: 'var(--color-accent-600)' }}>{installedCount}</div>
              <div className="text-[9.5px] uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>Installed</div>
            </div>
            <div className="px-3 py-3">
              <div className="awd-mono font-black" style={{ fontSize: 22, color: damagedCount ? 'var(--color-warning)' : undefined }}>{damagedCount}</div>
              <div className="text-[9.5px] uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>Damaged</div>
            </div>
          </div>

          <div className="px-4 pt-4 pb-1.5">
            <h3 className="font-extrabold text-sm">By district</h3>
          </div>
          <div className="awd-card" style={{ borderLeft: 0, borderRight: 0 }}>
            {byDistrict.slice(0, 8).map(d => (
              <div key={d.name} className="awd-row" style={{ cursor: 'default' }}>
                <div className="flex-1 min-w-0 text-xs font-semibold">{d.name}</div>
                <span className="awd-mono text-xs font-bold" style={{ color: 'var(--color-text-secondary)' }}>{d.count} pipes</span>
              </div>
            ))}
          </div>

          <div className="px-4 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button onClick={openInventory} className="awd-btn-secondary"><Boxes className="w-4 h-4" />Pipe inventory &amp; batches</button>
            <button onClick={openLabels} className="awd-btn-secondary"><Printer className="w-4 h-4" />Print QR labels</button>
            <button onClick={openHierarchy} className="awd-btn-secondary"><Network className="w-4 h-4" />Hierarchy &amp; users</button>
            <button onClick={openReports} className="awd-btn-secondary"><Download className="w-4 h-4" />Export installation data</button>
          </div>
        </div>
      )}
    </div>
  );
};
