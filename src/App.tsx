import React, { useState, useEffect } from 'react';
import { BarChart3, FileDown, Box, Printer } from 'lucide-react';
import { AWDPipe, Installation, MonitoringRecord, User, StateNode, DistrictNode, AreaNode, OfflineQueueItem } from './types';
import { INITIAL_PIPES, INITIAL_INSTALLATIONS, INITIAL_MONITORING } from './data/initialData';
import { INITIAL_STATES, INITIAL_DISTRICTS, INITIAL_AREAS, INITIAL_USERS } from './data/hierarchyData';
import { Navbar } from './components/Navbar';
import { MobileRegistrationApp } from './components/MobileRegistrationApp';
import { InteractiveFieldMap } from './components/InteractiveFieldMap';
import { Dashboard } from './components/Dashboard';
import { PipeInventory } from './components/PipeInventory';
import { PrintQRLabels } from './components/PrintQRLabels';
import { AppsScriptCodeViewer } from './components/AppsScriptCodeViewer';
import { GenerateBatchModal } from './components/GenerateBatchModal';
import { HierarchyManager } from './components/HierarchyManager';
import { LoginScreen } from './components/auth/LoginScreen';
import { ReportsExport } from './components/ReportsExport';
import { FarmerProfiles } from './components/FarmerProfiles';
import { Home } from './components/Home';
import { SyncQueueManager } from './components/SyncQueueManager';
import { AppLoadingScreen } from './components/AppLoadingScreen';
import { AdminDevToolsModal } from './components/AdminDevToolsModal';

const apiFetch = (url: RequestInfo | URL, options?: RequestInit) => {
  const token = localStorage.getItem("awd_auth_token");
  const headers = new Headers(options?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...options, headers });
};


const HIERARCHY_STORAGE_KEY = 'awd_hierarchy_snapshot';
const SESSION_STORAGE_KEY = 'awd_current_user';
const HIERARCHY_DIRTY_KEY = 'awd_hierarchy_dirty';

type PersistedHierarchySnapshot = {
  users: User[];
  states: StateNode[];
  districts: DistrictNode[];
  areas: AreaNode[];
};

const loadPersistedHierarchy = (): PersistedHierarchySnapshot | null => {
  try {
    const raw = localStorage.getItem(HIERARCHY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const loadPersistedCurrentUser = (): User | null => {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const syncHierarchyManagers = (users: User[], states: StateNode[], districts: DistrictNode[], areas: AreaNode[]) => {
  const findLatestManager = (predicate: (user: User) => boolean) =>
    [...users].reverse().find(predicate);

  const nextStates = states.map((state) => {
    const manager = findLatestManager((user) => user.role === 'State Manager' && user.state === state.name);
    return {
      ...state,
      managerId: manager?.id || '',
      managerName: manager?.name || ''
    };
  });

  const nextDistricts = districts.map((district) => {
    const manager = findLatestManager((user) => user.role === 'District Manager' && user.district === district.name);
    return {
      ...district,
      stateName: states.find((state) => state.id === district.stateId)?.name || district.stateName,
      managerId: manager?.id || '',
      managerName: manager?.name || ''
    };
  });

  const nextAreas = areas.map((area) => {
    const parentDistrict = districts.find((district) => district.id === area.districtId);
    const manager = findLatestManager((user) => user.role === 'Area Manager' && user.areaName === area.name);
    return {
      ...area,
      districtName: parentDistrict?.name || area.districtName,
      stateName: parentDistrict?.stateName || area.stateName,
      managerId: manager?.id || '',
      managerName: manager?.name || ''
    };
  });

  return { nextStates, nextDistricts, nextAreas };
};

const buildScopedUser = (
  draft: User,
  allUsers: User[],
  states: StateNode[],
  districts: DistrictNode[],
  areas: AreaNode[]
): User => {
  const scopedUser: User = { ...draft };

  if (scopedUser.role === 'Admin') {
    scopedUser.state = undefined;
    scopedUser.district = undefined;
    scopedUser.areaName = undefined;
    scopedUser.reportsToId = undefined;
    return scopedUser;
  }

  if (scopedUser.role === 'State Manager') {
    scopedUser.district = undefined;
    scopedUser.areaName = undefined;
    scopedUser.reportsToId = undefined;
    return scopedUser;
  }

  const norm = (s?: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const matchLoc = (a?: string, b?: string) => {
    if (!a || !b) return true;
    const na = norm(a);
    const nb = norm(b);
    return !na || !nb || na.includes(nb) || nb.includes(na);
  };

  if (scopedUser.role === 'District Manager') {
    const district = districts.find((item) => matchLoc(item.name, scopedUser.district)) || districts.find((item) => matchLoc(item.stateName, scopedUser.state));
    scopedUser.district = district?.name || scopedUser.district;
    scopedUser.state = district?.stateName || scopedUser.state;
    scopedUser.areaName = undefined;
    scopedUser.reportsToId = scopedUser.reportsToId || allUsers.find((user) => user.role === 'State Manager' && matchLoc(user.state, scopedUser.state))?.id;
    return scopedUser;
  }

  const area = areas.find((item) => matchLoc(item.name, scopedUser.areaName)) || areas.find((item) => matchLoc(item.districtName, scopedUser.district));
  if (area) {
    scopedUser.areaName = area.name;
    scopedUser.district = area.districtName;
    scopedUser.state = area.stateName;
  }

  if (scopedUser.role === 'Area Manager') {
    scopedUser.reportsToId = scopedUser.reportsToId || allUsers.find((user) => user.role === 'District Manager' && (matchLoc(user.district, scopedUser.district) || matchLoc(user.state, scopedUser.state)))?.id || allUsers.find((user) => user.role === 'State Manager' && matchLoc(user.state, scopedUser.state))?.id;
    return scopedUser;
  }

  // CF / JCF
  scopedUser.reportsToId = scopedUser.reportsToId || allUsers.find((user) => user.role === 'Area Manager' && (matchLoc(user.areaName, scopedUser.areaName) || matchLoc(user.district, scopedUser.district)))?.id || allUsers.find((user) => user.role === 'District Manager' && matchLoc(user.district, scopedUser.district))?.id;
  return scopedUser;
};

export default function App() {
  const persistedHierarchy = loadPersistedHierarchy();
  const [pipes, setPipes] = useState<AWDPipe[]>(INITIAL_PIPES);
  const [installations, setInstallations] = useState<Installation[]>(INITIAL_INSTALLATIONS);
  const [monitoringList, setMonitoringList] = useState<MonitoringRecord[]>(INITIAL_MONITORING);

  // Hierarchy Data States
  const [states, setStates] = useState<StateNode[]>(persistedHierarchy?.states || INITIAL_STATES);
  const [districts, setDistricts] = useState<DistrictNode[]>(persistedHierarchy?.districts || INITIAL_DISTRICTS);
  const [areas, setAreas] = useState<AreaNode[]>(persistedHierarchy?.areas || INITIAL_AREAS);
  const [users, setUsers] = useState<User[]>(persistedHierarchy?.users || INITIAL_USERS);

  // Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(loadPersistedCurrentUser()); // null = show login screen

  // Database Connection Status State
  const [dbStatus, setDbStatus] = useState<'cloud' | 'local' | 'loading'>('loading');
  const [isAppReady, setIsAppReady] = useState(false);

  // Toast notifications for save failures
  const [toast, setToast] = useState<{ id: number; message: string; type: 'error' | 'warning' | 'success' } | null>(null);
  const showToast = React.useCallback((message: string, type: 'error' | 'warning' | 'success' = 'error') => {
    const id = Date.now();
    setToast({ id, message, type });
    setTimeout(() => setToast((t) => t?.id === id ? null : t), 5000);
  }, []);

  // Last-synced timestamp
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  const [activeTab, setActiveTab] = useState<string>('home');
  const [analyticsSubTab, setAnalyticsSubTab] = useState<'overview' | 'reports'>('overview');
  const [inventorySubTab, setInventorySubTab] = useState<'inventory' | 'labels'>('inventory');
  const [activePipeId, setActivePipeId] = useState<string>('AWD-0004'); // Defaults to an available unregistered pipe
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState<boolean>(false);

  // Offline Data Sync States
  // IMPORTANT: isOnline is sourced from navigator.onLine (real browser network state)
  // NOT from localStorage — stale localStorage values caused browsers to get permanently
  // stuck in offline mode even after logout/login/refresh.
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    // Clear any stale persisted offline toggle from old sessions
    localStorage.removeItem('awd_online_status');
    return navigator.onLine;
  });
  const [offlineQueue, setOfflineQueue] = useState<OfflineQueueItem[]>(() => {
    // Fix #4: JSON.parse can throw if localStorage has corrupted data (browser crash,
    // partial write). Wrap in try/catch to prevent a blank white-screen crash on startup.
    try {
      const saved = localStorage.getItem('awd_offline_queue');
      return saved ? JSON.parse(saved) : [];
    } catch {
      localStorage.removeItem('awd_offline_queue'); // discard corrupt entry
      return [];
    }
  });
  const [isSyncModalOpen, setIsSyncModalOpen] = useState<boolean>(false);
  const [isAdminDevToolsOpen, setIsAdminDevToolsOpen] = useState<boolean>(false);

  // Listen to real browser network events to keep isOnline accurate
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('awd_offline_queue', JSON.stringify(offlineQueue));
  }, [offlineQueue]);

  useEffect(() => {
    localStorage.setItem(HIERARCHY_STORAGE_KEY, JSON.stringify({ users, states, districts, areas }));
  }, [users, states, districts, areas]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(currentUser));
    } else {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }, [currentUser]);


  useEffect(() => {
    if (!currentUser) return;
    const freshCurrentUser = users.find((user) => user.id === currentUser.id);
    if (!freshCurrentUser) {
      setCurrentUser(null);
      return;
    }
    if (JSON.stringify(freshCurrentUser) !== JSON.stringify(currentUser)) {
      setCurrentUser(freshCurrentUser);
    }
  }, [users, currentUser]);

  const applyHierarchySnapshot = (snapshot: PersistedHierarchySnapshot) => {
    setUsers(snapshot.users);
    setStates(snapshot.states);
    setDistricts(snapshot.districts);
    setAreas(snapshot.areas);
  };

  const refreshHierarchyFromServer = async () => {
    const res = await apiFetch('/api/init');
    if (res.status === 401) {
      // Session expired — this is NOT a database issue, don't show the Mongo-offline banner for it.
      localStorage.removeItem('awd_auth_token');
      localStorage.removeItem(SESSION_STORAGE_KEY);
      throw new Error('SESSION_EXPIRED');
    }
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || `HTTP ${res.status}`);
    }

    const norm = (s?: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const matchLoc = (a?: string, b?: string) => {
      if (!a || !b) return false;
      const na = norm(a); const nb = norm(b);
      return na.length >= 2 && nb.length >= 2 && (na.includes(nb) || nb.includes(na));
    };

    // Auto-repair: ensure every user has the correct reportsToId by traversing role hierarchy
    const repairedUsers: User[] = (data.users || []).map((u: User) => {
      if (u.reportsToId) return u; // already linked — don't overwrite
      if (u.role === 'Admin') return u;
      const allU: User[] = data.users || [];
      if (u.role === 'State Manager') return u; // SM reports to Admin — no auto-link needed
      if (u.role === 'District Manager') {
        const sm = allU.find((m: User) => m.role === 'State Manager' && matchLoc(m.state, u.state));
        return sm ? { ...u, reportsToId: sm.id } : u;
      }
      if (u.role === 'Area Manager') {
        const dm = allU.find((m: User) => m.role === 'District Manager' && (matchLoc(m.district, u.district) || matchLoc(m.state, u.state)));
        if (dm) return { ...u, reportsToId: dm.id };
        const sm = allU.find((m: User) => m.role === 'State Manager' && matchLoc(m.state, u.state));
        return sm ? { ...u, reportsToId: sm.id } : u;
      }
      if (u.role === 'CF' || u.role === 'JCF') {
        const am = allU.find((m: User) => m.role === 'Area Manager' && matchLoc(m.areaName, u.areaName));
        if (am) return { ...u, reportsToId: am.id };
        const dm = allU.find((m: User) => m.role === 'District Manager' && matchLoc(m.district, u.district));
        return dm ? { ...u, reportsToId: dm.id } : u;
      }
      return u;
    });

    applyHierarchySnapshot({
      users: repairedUsers,
      states: data.states || [],
      districts: data.districts || [],
      areas: data.areas || [],
    });

    if (Array.isArray(data.pipes)) setPipes(data.pipes);
    if (Array.isArray(data.installations)) setInstallations(data.installations);
    if (Array.isArray(data.monitoringList)) setMonitoringList(data.monitoringList);

    setDbStatus(data.dbStatus || 'local');
    return data;
  };

  const syncHierarchyMutation = async (request: () => Promise<Response>) => {
    try {
      const res = await request();
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        if (res.status === 403) {
          showToast('Permission denied — you cannot make this change.', 'warning');
        } else if (res.status === 401) {
          showToast('Session expired — please log in again.', 'error');
        } else {
          showToast(`Couldn't save — ${data?.error || `server error (${res.status})`}`, 'error');
        }
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      if (data?.dbStatus) {
        setDbStatus(data.dbStatus);
      }
      await refreshHierarchyFromServer();
      setLastSynced(new Date());
      return true;
    } catch (err) {
      console.error('Hierarchy sync failed:', err);
      return false;
    }
  };


  // Silently renew the auth token every 30 min so a long-open tab never
  // hits a hard 4h expiry. This does not extend an already-expired/invalid
  // token — the server rejects those the same as before.
  useEffect(() => {
    if (!currentUser) return;
    const renew = () => {
      apiFetch('/api/refresh-token', { method: 'POST' })
        .then((res) => res.ok ? res.json() : null)
        .then((data) => {
          if (data?.token) localStorage.setItem('awd_auth_token', data.token);
        })
        .catch(() => { }); // best-effort; a failed renewal just means it'll expire normally
    };
    const interval = setInterval(renew, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // Fetch initial data from Backend API / MongoDB on mount.
  // If the server reports 'local' (a cold-starting backend can genuinely be
  // mid-reconnect to MongoDB, not actually down), retry quietly a few times
  // in the background instead of accepting the first answer as final —
  // this is what used to require a manual logout/login to recover from.
  useEffect(() => {
    let cancelled = false;
    let attempt = 0;

    const attemptRefresh = () => {
      refreshHierarchyFromServer()
        .then((data) => {
          if (cancelled) return;
          if (data?.dbStatus === 'local' && attempt < 5) {
            attempt += 1;
            setTimeout(attemptRefresh, attempt * 3000); // 3s, 6s, 9s, 12s, 15s
          }
        })
        .catch((err) => {
          if (cancelled) return;
          if (err?.message === 'SESSION_EXPIRED') {
            console.warn('Session expired, redirecting to login.');
            setCurrentUser(null);
            return;
          }
          console.warn('Backend API not reachable, using local draft if present:', err);
          if (persistedHierarchy) {
            applyHierarchySnapshot(persistedHierarchy);
          }
          setDbStatus('local');
          if (attempt < 5) {
            attempt += 1;
            setTimeout(attemptRefresh, attempt * 3000);
          } else {
            // Fix #5: all retries exhausted — warn the user that they're seeing
            // cached data which may be out of date (e.g. newly added users won't appear)
            if (persistedHierarchy) {
              showToast('Showing offline snapshot — some data may not be up to date.', 'warning');
            }
          }
        })
        .finally(() => setIsAppReady(true));
    };

    attemptRefresh();
    return () => { cancelled = true; };
  }, []);


  // URL Parameter Detection: Check if ?id=AWD-XXXX exists in current URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const scannedId = params.get('id');
    if (scannedId) {
      // Security Guard: If not logged in as authorized staff, redirect public mobile scan to Dr. Reddy's Foundation website
      const savedUser = localStorage.getItem(SESSION_STORAGE_KEY);
      if (!currentUser && !savedUser) {
        window.location.href = 'https://drreddysfoundation.org/';
        return;
      }

      // Find or add if valid for logged-in authorized field user
      const existing = pipes.find((p) => p.Pipe_ID.toUpperCase() === scannedId.toUpperCase());
      if (existing) {
        setActivePipeId(existing.Pipe_ID);
      } else if (scannedId.toUpperCase().startsWith('AWD-')) {
        // Create pipe entry if user scanned new ID
        const newPipe: AWDPipe = {
          Pipe_ID: scannedId.toUpperCase(),
          Batch_No: 'BATCH-2026-01',
          QR_URL: `?id=${scannedId.toUpperCase()}`,
          Status: 'Available',
        };
        setPipes((prev) => [newPipe, ...prev]);
        setActivePipeId(newPipe.Pipe_ID);
      }
      setActiveTab('mobile');
    }
  }, [currentUser]);

  const pushHierarchyChanges = (
    oldStates: StateNode[], newStates: StateNode[],
    oldDistricts: DistrictNode[], newDistricts: DistrictNode[],
    oldAreas: AreaNode[], newAreas: AreaNode[]
  ) => {
    if (!isOnline) return;
    newStates.forEach(s => {
      const oldS = oldStates.find(x => x.id === s.id);
      if (!oldS || oldS.managerId !== s.managerId || oldS.managerName !== s.managerName) {
        void apiFetch('/api/hierarchy/state', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) });
      }
    });
    newDistricts.forEach(d => {
      const oldD = oldDistricts.find(x => x.id === d.id);
      if (!oldD || oldD.managerId !== d.managerId || oldD.managerName !== d.managerName) {
        void apiFetch('/api/hierarchy/district', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) });
      }
    });
    newAreas.forEach(a => {
      const oldA = oldAreas.find(x => x.id === a.id);
      if (!oldA || oldA.managerId !== a.managerId || oldA.managerName !== a.managerName) {
        void apiFetch('/api/hierarchy/area', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(a) });
      }
    });
  };

  // Handler: Add User to Hierarchy
  const handleAddUser = (newUser: User) => {
    const scopedNewUser = buildScopedUser(newUser, users, states, districts, areas);

    // Auto-create AreaNode if user has an areaName that doesn't exist in areas array yet
    let updatedAreas = [...areas];
    let newAreaPayload: AreaNode | undefined;

    if (scopedNewUser.areaName && scopedNewUser.district) {
      const existingArea = updatedAreas.find(
        (a) => a.name.trim().toLowerCase() === scopedNewUser.areaName!.trim().toLowerCase() &&
          a.districtName.trim().toLowerCase() === scopedNewUser.district!.trim().toLowerCase()
      );
      if (!existingArea) {
        const distObj = districts.find(
          (d) => d.name.trim().toLowerCase() === scopedNewUser.district!.trim().toLowerCase()
        );
        newAreaPayload = {
          id: `area-${Date.now()}`,
          districtId: distObj?.id || `dist-${Date.now()}`,
          districtName: scopedNewUser.district,
          stateName: scopedNewUser.state || distObj?.stateName || 'Telangana',
          name: scopedNewUser.areaName.trim(),
          managerId: scopedNewUser.role === 'Area Manager' ? scopedNewUser.id : '',
          managerName: scopedNewUser.role === 'Area Manager' ? scopedNewUser.name : '',
        };
        updatedAreas.push(newAreaPayload);
      }
    }

    const nextUsers = [...users, scopedNewUser];
    const { nextStates, nextDistricts, nextAreas } = syncHierarchyManagers(nextUsers, states, districts, updatedAreas);
    setUsers(nextUsers);
    setStates(nextStates);
    setDistricts(nextDistricts);
    setAreas(nextAreas);
    pushHierarchyChanges(states, nextStates, districts, nextDistricts, areas, nextAreas);

    // Pass newArea in the same POST so backend atomically upserts area + user in one request,
    // eliminating any race condition between fire-and-forget area PUT and the user save.
    void syncHierarchyMutation(() =>
      apiFetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newUser: scopedNewUser, ...(newAreaPayload ? { newArea: newAreaPayload } : {}) }),
      })
    );
  };


  // Handler: Update User in Hierarchy
  const handleUpdateUser = (updatedUser: User) => {
    const peerUsers = users.filter((user) => user.id !== updatedUser.id);
    const scopedUpdatedUser = buildScopedUser(updatedUser, peerUsers, states, districts, areas);
    const nextUsers = users.map((user) => (user.id === scopedUpdatedUser.id ? scopedUpdatedUser : user));
    const { nextStates, nextDistricts, nextAreas } = syncHierarchyManagers(nextUsers, states, districts, areas);
    setUsers(nextUsers);
    setStates(nextStates);
    setDistricts(nextDistricts);
    setAreas(nextAreas);
    pushHierarchyChanges(states, nextStates, districts, nextDistricts, areas, nextAreas);
    if (currentUser && currentUser.id === updatedUser.id) {
      setCurrentUser(scopedUpdatedUser);
    }
    void syncHierarchyMutation(() =>
      apiFetch(`/api/users/${updatedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updatedUser: scopedUpdatedUser }),
      })
    );
  };

  // Handler: Delete User from Hierarchy
  const handleDeleteUser = (userId: string) => {
    const nextUsers = users.filter((u) => u.id !== userId);
    const { nextStates, nextDistricts, nextAreas } = syncHierarchyManagers(nextUsers, states, districts, areas);
    setUsers(nextUsers);
    setStates(nextStates);
    setDistricts(nextDistricts);
    setAreas(nextAreas);
    pushHierarchyChanges(states, nextStates, districts, nextDistricts, areas, nextAreas);
    if (currentUser && currentUser.id === userId) {
      setCurrentUser(null);
    }
    void syncHierarchyMutation(() =>
      apiFetch(`/api/users/${userId}`, {
        method: 'DELETE',
      })
    );
  };

  // Helper to push items to offline storage queue
  const queueOfflineItem = (type: 'registration' | 'monitoring', payload: any) => {
    const newItem: OfflineQueueItem = {
      id: Math.random().toString(36).substring(2, 11),
      timestamp: new Date().toISOString(),
      type,
      status: 'pending',
      payload
    };
    setOfflineQueue((prev) => [...prev, newItem]);
  };

  // Handler: Successful Farmer & Pipe Registration
  const handleRegisterSuccess = (newInstallation: Installation, updatedPipe: AWDPipe) => {
    setInstallations((prev) => [newInstallation, ...prev]);
    setPipes((prev) =>
      prev.map((p) => (p.Pipe_ID === updatedPipe.Pipe_ID ? updatedPipe : p))
    );

    if (isOnline) {
      apiFetch('/api/installations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ installation: newInstallation, updatedPipe }),
      }).then((res) => {
        if (res.ok) {
          setLastSynced(new Date());
        } else {
          showToast("Couldn't save registration — queued for retry when back online.", 'warning');
          queueOfflineItem('registration', { installation: newInstallation, updatedPipe });
        }
      }).catch((err) => {
        console.error('Failed to save registration to MongoDB, queuing offline:', err);
        showToast("Couldn't save registration — queued for retry when back online.", 'warning');
        queueOfflineItem('registration', { installation: newInstallation, updatedPipe });
      });
    } else {
      queueOfflineItem('registration', { installation: newInstallation, updatedPipe });
    }
  };

  // Handler: Update Farmer Installation Details
  const handleUpdateInstallation = (updated: Installation) => {
    setInstallations((prev) =>
      prev.map((i) => (i.Pipe_ID === updated.Pipe_ID ? updated : i))
    );
    setPipes((prev) =>
      prev.map((p) =>
        p.Pipe_ID === updated.Pipe_ID
          ? {
            ...p,
            Farmer_Name: updated.Farmer_Name,
            Village: updated.Village,
            District: updated.District,
            State: updated.State,
            Installation_Date: updated.Installation_Date,
          }
          : p
      )
    );

    if (isOnline) {
      // Fix #2: show toast on failure so the user knows the edit wasn't saved
      apiFetch(`/api/installations/${encodeURIComponent(updated.Pipe_ID)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      }).then((res) => {
        if (!res.ok) showToast("Couldn't save edit — please try again.", 'warning');
      }).catch(() => showToast("Couldn't save edit — check your connection.", 'warning'));
    } else {
      showToast("You're offline — edit saved locally but not yet synced.", 'warning');
    }
  };

  // Handler: Delete Farmer Installation Record
  const handleDeleteInstallation = (pipeId: string) => {
    setInstallations((prev) => prev.filter((i) => i.Pipe_ID !== pipeId));
    setMonitoringList((prev) => prev.filter((m) => m.Pipe_ID !== pipeId));
    setPipes((prev) =>
      prev.map((p) =>
        p.Pipe_ID === pipeId
          ? {
            ...p,
            Status: 'Unregistered',
            Farmer_Name: '',
            Village: '',
            District: '',
            State: '',
            Installation_Date: '',
          }
          : p
      )
    );

    if (isOnline) {
      // Fix #2: show toast on failure so the user knows the delete wasn't persisted
      apiFetch(`/api/installations/${encodeURIComponent(pipeId)}`, {
        method: 'DELETE',
      }).then((res) => {
        if (!res.ok) showToast("Couldn't delete record — please try again.", 'warning');
      }).catch(() => showToast("Couldn't delete record — check your connection.", 'warning'));
    } else {
      showToast("You're offline — deletion will sync when reconnected.", 'warning');
    }
  };

  // Handler: Record Monitoring Visit
  const handleAddMonitoring = (record: MonitoringRecord) => {
    setMonitoringList((prev) => [record, ...prev]);
    if (record.Pipe_Condition && record.Pipe_Condition !== 'Good') {
      setPipes((prev) =>
        prev.map((p) =>
          p.Pipe_ID === record.Pipe_ID ? { ...p, Status: record.Pipe_Condition as any } : p
        )
      );
    }

    if (isOnline) {
      apiFetch('/api/monitoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ record }),
      }).then((res) => {
        if (res.ok) {
          setLastSynced(new Date());
        } else {
          showToast("Couldn't save monitoring visit — queued for retry.", 'warning');
          queueOfflineItem('monitoring', record);
        }
      }).catch((err) => {
        console.error('Failed to save monitoring log to MongoDB, queuing offline:', err);
        showToast("Couldn't save monitoring visit — queued for retry.", 'warning');
        queueOfflineItem('monitoring', record);
      });
    } else {
      queueOfflineItem('monitoring', record);
    }
  };

  // Synchronize all offline items sequentially
  const handleSyncAll = async (): Promise<{ synced: number; failed: number }> => {
    if (!isOnline || offlineQueue.length === 0) return { synced: 0, failed: 0 };

    const pending = [...offlineQueue];
    const failedIds = new Set<string>();

    for (const item of pending) {
      try {
        if (item.type === 'registration') {
          const res = await apiFetch('/api/installations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item.payload),
          });
          if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
        } else {
          const res = await apiFetch('/api/monitoring', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ record: item.payload }),
          });
          if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
        }
      } catch (err: any) {
        console.error('Failed to sync item:', item.id, err);
        item.status = 'failed';
        item.error = err.message || 'Sync network request failed';
        failedIds.add(item.id);
      }
    }

    setOfflineQueue((prev) => prev.filter(item => failedIds.has(item.id)));
    return { synced: pending.length - failedIds.size, failed: failedIds.size };
  };

  const handleDeleteQueueItem = (id: string) => {
    setOfflineQueue((prev) => prev.filter(item => item.id !== id));
  };


  // Handler: Add New Batch of AWD Pipes
  const handleAddPipeBatch = (batchNo: string, count: number) => {
    // Fix #6: derive next pipe number from the highest existing Pipe_ID numeric suffix,
    // NOT from pipes.length. pipes is scope-filtered for non-Admin users so length
    // would collide with IDs already in MongoDB that the current user can't see.
    const maxExistingNum = pipes.reduce((max, p) => {
      const match = p.Pipe_ID.match(/AWD-0*(\d+)$/i);
      if (!match) return max;
      const n = parseInt(match[1], 10);
      return n > max ? n : max;
    }, 0);
    const startNum = maxExistingNum + 1;
    const newPipes: AWDPipe[] = [];
    for (let i = startNum; i < startNum + count; i++) {
      const numStr = ('0000' + i).slice(-4);
      const pipeId = `AWD-${numStr}`;
      newPipes.push({
        Pipe_ID: pipeId,
        Batch_No: batchNo,
        QR_URL: `?id=${pipeId}`,
        Status: 'Available',
      });
    }
    setPipes((prev) => [...prev, ...newPipes]);
    apiFetch('/api/pipes/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPipes }),
    }).catch(() => showToast("Couldn't save new pipe batch — check your connection.", 'warning'));
  };

  // Handler: Update an existing Pipe
  const handleUpdatePipe = (pipeId: string, updates: Partial<AWDPipe>) => {
    setPipes((prev) =>
      prev.map((p) => (p.Pipe_ID === pipeId ? { ...p, ...updates } : p))
    );

    if (isOnline) {
      apiFetch(`/api/pipes/${pipeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      }).catch((err) => {
        console.error('Failed to update pipe in MongoDB, queuing offline:', err);
        // Note: Real offline sync might need a separate queue type for pipe updates
        // For now we just log it.
      });
    }
  };

  // Handler: Rename a Batch
  const handleRenameBatch = (oldBatchNo: string, newBatchNo: string) => {
    setPipes((prev) =>
      prev.map((p) => (p.Batch_No === oldBatchNo ? { ...p, Batch_No: newBatchNo } : p))
    );
    if (isOnline) {
      apiFetch('/api/pipes/batch/rename', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldBatchNo, newBatchNo }),
      }).catch((err) => console.error('Failed to rename batch:', err));
    }
  };

  // Handler: Delete a Batch
  const handleDeleteBatch = (batchNo: string) => {
    setPipes((prev) => prev.filter((p) => p.Batch_No !== batchNo));
    if (isOnline) {
      apiFetch(`/api/pipes/batch/${batchNo}`, {
        method: 'DELETE',
      }).catch((err) => console.error('Failed to delete batch:', err));
    }
  };

  // Handler: Generated Custom QR Batch
  const handleCustomBatchGenerated = (newPipes: AWDPipe[]) => {
    setPipes((prev) => [...newPipes, ...prev]);
    apiFetch('/api/pipes/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPipes }),
    }).catch((err) => console.error('Failed to sync pipe batch to MongoDB:', err));
  };

  const handleAddState = (newState: StateNode) => {
    setStates((prev) => [...prev, newState]);
    if (isOnline) {
      void syncHierarchyMutation(() =>
        apiFetch('/api/hierarchy/states', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newState),
        })
      );
    }
  };

  const handleAddDistrict = (newDistrict: DistrictNode) => {
    const districtWithState = {
      ...newDistrict,
      stateName: newDistrict.stateName || states.find((state) => state.id === newDistrict.stateId)?.name || ''
    };
    setDistricts((prev) => [...prev, districtWithState]);
    if (isOnline) {
      void syncHierarchyMutation(() =>
        apiFetch('/api/hierarchy/districts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(districtWithState),
        })
      );
    }
  };

  const handleAddArea = (newArea: AreaNode) => {
    const parentDistrict = districts.find((district) => district.id === newArea.districtId);
    const areaWithParents = {
      ...newArea,
      districtName: newArea.districtName || parentDistrict?.name || '',
      stateName: newArea.stateName || parentDistrict?.stateName || ''
    };
    setAreas((prev) => [...prev, areaWithParents]);
    if (isOnline) {
      void syncHierarchyMutation(() =>
        apiFetch('/api/hierarchy/areas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(areaWithParents),
        })
      );
    }
  };

  const handleDeleteState = (stateId: string) => {
    const stateToDelete = states.find((state) => state.id === stateId);
    const districtIdsToDelete = new Set(districts.filter((district) => district.stateId === stateId).map((district) => district.id));
    const districtNamesToDelete = new Set(districts.filter((district) => district.stateId === stateId).map((district) => district.name));
    const areaNamesToDelete = new Set(areas.filter((area) => districtIdsToDelete.has(area.districtId)).map((area) => area.name));

    setStates((prev) => prev.filter((state) => state.id !== stateId));
    setDistricts((prev) => prev.filter((district) => !districtIdsToDelete.has(district.id)));
    setAreas((prev) => prev.filter((area) => !districtIdsToDelete.has(area.districtId)));
    setUsers((prev) => prev.filter((user) =>
      user.state !== stateToDelete?.name &&
      !districtNamesToDelete.has(user.district || '') &&
      !areaNamesToDelete.has(user.areaName || '')
    ));
    if (currentUser?.state === stateToDelete?.name) {
      setCurrentUser(null);
    }

    if (isOnline) {
      void syncHierarchyMutation(() =>
        apiFetch(`/api/hierarchy/states/${stateId}`, { method: 'DELETE' })
      );
    }
  };

  const handleDeleteDistrict = (districtId: string) => {
    const districtToDelete = districts.find((district) => district.id === districtId);
    const areaNamesToDelete = new Set(areas.filter((area) => area.districtId === districtId).map((area) => area.name));

    setDistricts((prev) => prev.filter((district) => district.id !== districtId));
    setAreas((prev) => prev.filter((area) => area.districtId !== districtId));
    setUsers((prev) => prev.filter((user) =>
      user.district !== districtToDelete?.name &&
      !areaNamesToDelete.has(user.areaName || '')
    ));
    if (currentUser?.district === districtToDelete?.name) {
      setCurrentUser(null);
    }

    if (isOnline) {
      void syncHierarchyMutation(() =>
        apiFetch(`/api/hierarchy/districts/${districtId}`, { method: 'DELETE' })
      );
    }
  };

  const handleDeleteArea = (areaId: string) => {
    const areaToDelete = areas.find((area) => area.id === areaId);

    setAreas((prev) => prev.filter((area) => area.id !== areaId));
    setUsers((prev) => prev.filter((user) => user.areaName !== areaToDelete?.name));
    if (currentUser?.areaName === areaToDelete?.name) {
      setCurrentUser(null);
    }

    if (isOnline) {
      void syncHierarchyMutation(() =>
        apiFetch(`/api/hierarchy/areas/${areaId}`, { method: 'DELETE' })
      );
    }
  };
  // Handler: Update State Hierarchy
  const handleUpdateState = (updated: StateNode) => {
    const previousState = states.find((state) => state.id === updated.id);
    const nextStates = states.map((state) => (state.id === updated.id ? updated : state));
    const nextDistricts = districts.map((district) =>
      previousState && district.stateId === updated.id
        ? { ...district, stateName: updated.name }
        : district
    );
    const nextAreas = areas.map((area) =>
      previousState && area.stateName === previousState.name
        ? { ...area, stateName: updated.name }
        : area
    );
    const nextUsers = users.map((user) =>
      previousState && user.state === previousState.name
        ? buildScopedUser({ ...user, state: updated.name }, users, nextStates, nextDistricts, nextAreas)
        : user
    );
    const synced = syncHierarchyManagers(nextUsers, nextStates, nextDistricts, nextAreas);
    setStates(synced.nextStates);
    setDistricts(synced.nextDistricts);
    setAreas(synced.nextAreas);
    setUsers(nextUsers);
    if (isOnline) {
      void syncHierarchyMutation(() =>
        apiFetch('/api/hierarchy/state', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updated),
        })
      );
    }
  };

  // Handler: Update District Hierarchy
  const handleUpdateDistrict = (updated: DistrictNode) => {
    const previousDistrict = districts.find((district) => district.id === updated.id);
    const nextDistricts = districts.map((district) => (district.id === updated.id ? updated : district));
    const nextAreas = areas.map((area) =>
      previousDistrict && area.districtId === updated.id
        ? { ...area, districtName: updated.name, stateName: updated.stateName }
        : area
    );
    const nextUsers = users.map((user) => {
      if (!previousDistrict) return user;
      if (user.district === previousDistrict.name) {
        const nextAreaName = user.areaName
          ? nextAreas.find((area) => area.name === user.areaName)?.name || user.areaName
          : user.areaName;
        return buildScopedUser({ ...user, district: updated.name, state: updated.stateName, areaName: nextAreaName }, users, states, nextDistricts, nextAreas);
      }
      return user;
    });
    const synced = syncHierarchyManagers(nextUsers, states, nextDistricts, nextAreas);
    setDistricts(synced.nextDistricts);
    setAreas(synced.nextAreas);
    setStates(synced.nextStates);
    setUsers(nextUsers);
    if (isOnline) {
      void syncHierarchyMutation(() =>
        apiFetch('/api/hierarchy/district', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updated),
        })
      );
    }
  };

  // Handler: Update Area Hierarchy
  const handleUpdateArea = (updated: AreaNode) => {
    const previousArea = areas.find((area) => area.id === updated.id);
    const nextAreas = areas.map((area) => (area.id === updated.id ? updated : area));
    const nextUsers = users.map((user) =>
      previousArea && user.areaName === previousArea.name
        ? buildScopedUser({ ...user, areaName: updated.name, district: updated.districtName, state: updated.stateName }, users, states, districts, nextAreas)
        : user
    );
    const synced = syncHierarchyManagers(nextUsers, states, districts, nextAreas);
    setAreas(synced.nextAreas);
    setStates(synced.nextStates);
    setDistricts(synced.nextDistricts);
    setUsers(nextUsers);
    if (isOnline) {
      void syncHierarchyMutation(() =>
        apiFetch('/api/hierarchy/area', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updated),
        })
      );
    }
  };

  // Build the full upward chain of manager IDs for a given user.
  // E.g. Sai Teja → [Kumar, Lahari, Rajinikanth, Admin]
  const getManagerChain = React.useCallback((userId: string, allUsers: User[]): Set<string> => {
    const result = new Set<string>();
    const user = allUsers.find((u) => u.id === userId);
    if (!user) return result;

    const visited = new Set<string>([userId]);
    // Walk up reportsToId chain
    let cur = user;
    while (cur.reportsToId && !visited.has(cur.reportsToId)) {
      visited.add(cur.reportsToId);
      result.add(cur.reportsToId);
      cur = allUsers.find((u) => u.id === cur.reportsToId) || cur;
      if (!cur.reportsToId) break;
    }
    // Walk up createdById chain as fallback
    cur = user;
    while (cur.createdById && !visited.has(cur.createdById)) {
      visited.add(cur.createdById);
      result.add(cur.createdById);
      cur = allUsers.find((u) => u.id === cur.createdById) || cur;
      if (!cur.createdById) break;
    }
    // Also add managers from the area chain via reportsToId of the user's reportsTo
    // (handles case where Sai Teja → Kumar, but Kumar has no reportsToId to Lahari,
    //  so we also trace through territory: any DM/SM whose district/state matches)
    const norm = (s?: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const matchLoc = (a?: string, b?: string) => {
      if (!a || !b) return false;
      const na = norm(a); const nb = norm(b);
      return na.length >= 2 && nb.length >= 2 && (na.includes(nb) || nb.includes(na));
    };

    for (const m of allUsers) {
      if (result.has(m.id) || m.id === userId) continue;
      if (m.role === 'Admin') { result.add(m.id); continue; }

      // Walk upward from known managers in result set to find territory-level managers
      for (const knownMgrId of Array.from(result)) {
        const knownMgr = allUsers.find((u) => u.id === knownMgrId);
        if (!knownMgr) continue;
        if (m.role === 'District Manager' && (matchLoc(m.district, knownMgr.district) || matchLoc(m.state, knownMgr.state))) {
          result.add(m.id); break;
        }
        if (m.role === 'State Manager' && matchLoc(m.state, knownMgr.state)) {
          result.add(m.id); break;
        }
        if (m.role === 'Area Manager' && (matchLoc(m.areaName, knownMgr.areaName) || matchLoc(m.district, knownMgr.district))) {
          result.add(m.id); break;
        }
      }
    }
    return result;
  }, []);

  // Transitive subordinate tree helper: returns all user IDs below a manager (direct reports + territory)
  const getSubordinateUserIds = React.useCallback((managerId: string, allUsers: User[]): Set<string> => {
    const result = new Set<string>([managerId]);
    let added = true;
    while (added) {
      added = false;
      for (const u of allUsers) {
        if (result.has(u.id)) continue;
        // Direct or created-by report to anyone already in the set
        const directReport = u.reportsToId && result.has(u.reportsToId);
        const createdReport = u.createdById && result.has(u.createdById);
        if (directReport || createdReport) {
          result.add(u.id);
          added = true;
        }
      }
    }
    return result;
  }, []);

  // Data Scoping logic: Filter installations and monitoring records based on currentUser role and hierarchy
  const scopedInstallations = React.useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'Admin') return installations;

    const norm = (s?: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    // Get all user IDs in this manager's subordinate tree (direct chain only)
    const subUserIds = getSubordinateUserIds(currentUser.id, users);
    const subNamesList = users.filter((u) => subUserIds.has(u.id)).map((u) => norm(u.name)).filter(Boolean);

    // For each installation, check if it was registered by anyone whose upward manager chain includes currentUser
    const isMyInstallation = (inst: Installation): boolean => {
      // Direct subordinate by user ID
      if (inst.Registered_By_User_ID && subUserIds.has(inst.Registered_By_User_ID)) return true;
      // Direct subordinate by name match
      if (inst.Installed_By) {
        const iNorm = norm(inst.Installed_By);
        if (subNamesList.some((sName) => sName.length >= 2 && (iNorm.includes(sName) || sName.includes(iNorm)))) return true;
      }
      // Upward chain: trace from the registrar's manager chain to see if currentUser is in it
      if (inst.Registered_By_User_ID) {
        const chain = getManagerChain(inst.Registered_By_User_ID, users);
        if (chain.has(currentUser.id)) return true;
      }
      return false;
    };

    if (currentUser.role === 'State Manager') {
      const uState = norm(currentUser.state);
      return installations.filter((inst) => {
        const iState = norm(inst.State);
        const stateMatch = !uState || !iState || iState.includes(uState) || uState.includes(iState);
        return isMyInstallation(inst) || stateMatch;
      });
    }

    if (currentUser.role === 'District Manager') {
      const uDist = norm(currentUser.district);
      const uState = norm(currentUser.state);
      return installations.filter((inst) => {
        const iDist = norm(inst.District);
        const iState = norm(inst.State);
        const distMatch = !uDist || !iDist || iDist.includes(uDist) || uDist.includes(iDist);
        const stateMatch = !uState || !iState || iState.includes(uState) || uState.includes(iState);
        return isMyInstallation(inst) || (distMatch && stateMatch);
      });
    }

    if (currentUser.role === 'Area Manager') {
      const uArea = norm(currentUser.areaName);
      const uDist = norm(currentUser.district);
      return installations.filter((inst) => {
        const iAreaMgr = inst.Area_Manager_User_ID === currentUser.id;
        const iDist = norm(inst.District);
        const iMandal = norm(inst.Mandal);
        const iVillage = norm(inst.Village);
        const areaMatch = uArea && (iMandal.includes(uArea) || uArea.includes(iMandal) || iVillage.includes(uArea));
        const distMatch = !uDist || !iDist || iDist.includes(uDist) || uDist.includes(iDist);
        return isMyInstallation(inst) || iAreaMgr || areaMatch || (!inst.Registered_By_User_ID && distMatch);
      });
    }

    if (currentUser.role === 'CF' || currentUser.role === 'JCF') {
      const uDist = norm(currentUser.district);
      const myNameNorm = norm(currentUser.name);
      return installations.filter((inst) => {
        const isMyId = inst.Registered_By_User_ID === currentUser.id;
        const isMyName = inst.Installed_By ? norm(inst.Installed_By).includes(myNameNorm) : false;
        const distMatch = !inst.Registered_By_User_ID && (!uDist || norm(inst.District).includes(uDist) || uDist.includes(norm(inst.District)));
        return isMyId || isMyName || distMatch;
      });
    }
    return installations;
  }, [installations, currentUser, users, getSubordinateUserIds, getManagerChain]);

  const scopedMonitoringList = React.useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'Admin') return monitoringList;
    const allowedPipeIds = new Set(scopedInstallations.map((i) => i.Pipe_ID));
    const subordinateIds = getSubordinateUserIds(currentUser.id, users);

    return monitoringList.filter(
      (m) =>
        allowedPipeIds.has(m.Pipe_ID) ||
        (m.Visited_By_User_ID && subordinateIds.has(m.Visited_By_User_ID))
    );
  }, [monitoringList, scopedInstallations, currentUser, users, getSubordinateUserIds]);

  const scopedPipes = React.useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'Admin') return pipes;
    const installedPipeIds = new Set(scopedInstallations.map((i) => i.Pipe_ID));
    if (currentUser.role === 'CF' || currentUser.role === 'JCF' || currentUser.role === 'Area Manager' || currentUser.role === 'District Manager' || currentUser.role === 'State Manager') {
      return pipes.filter((p) => p.Status === 'Available' || installedPipeIds.has(p.Pipe_ID));
    }
    return pipes;
  }, [pipes, scopedInstallations, currentUser]);



  if (!isAppReady) {
    return <AppLoadingScreen />;
  }

  // Render Login Gate if no user is active
  if (!currentUser) {
    return <LoginScreen users={users} onLogin={(user) => {
      setCurrentUser(user);
      refreshHierarchyFromServer().catch(err => console.error("Failed to load initial data after login", err));
    }} />;
  }

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-800 flex flex-col font-sans">

      {/* Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activePipeId={activePipeId}
        currentUser={currentUser}
        onLogout={() => {
          setCurrentUser(null);
          localStorage.removeItem('awd_auth_token');
          localStorage.removeItem(HIERARCHY_STORAGE_KEY);
          localStorage.removeItem('awd_offline_queue');
        }}
        onOpenGenerateModal={() => setIsGenerateModalOpen(true)}
        isOnline={isOnline}
        onToggleOnline={() => setIsOnline(!isOnline)}
        offlineQueueCount={offlineQueue.length}
        onOpenSyncModal={() => setIsSyncModalOpen(true)}
      />

      {/* Main Tab Views — bottom padding on mobile clears the fixed bottom nav
          (56px min-height) PLUS the iOS safe-area home-indicator inset, so
          content never sits behind it. */}
      <main className="flex-1 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] lg:pb-4">
        {activeTab === 'home' && (
          <Home
            currentUser={currentUser}
            setActiveTab={setActiveTab}
            setAnalyticsSubTab={setAnalyticsSubTab}
            setInventorySubTab={setInventorySubTab}
            installations={scopedInstallations}
            monitoringList={scopedMonitoringList}
            pipes={scopedPipes}
            onOpenGenerateModal={() => setIsGenerateModalOpen(true)}
            isOnline={isOnline}
            offlineQueueCount={offlineQueue.length}
            onOpenSyncModal={() => setIsSyncModalOpen(true)}
          />
        )}

        {activeTab === 'mobile' && (
          <MobileRegistrationApp
            pipes={scopedPipes}
            installations={scopedInstallations}
            monitoringList={scopedMonitoringList}
            activePipeId={activePipeId}
            currentUser={currentUser}
            setActivePipeId={setActivePipeId}
            onRegisterSuccess={handleRegisterSuccess}
            onAddMonitoring={handleAddMonitoring}
          />
        )}

        {activeTab === 'map' && (
          <InteractiveFieldMap
            pipes={scopedPipes}
            installations={scopedInstallations}
            monitoringList={scopedMonitoringList}
            onSelectPipeForMobile={(pipeId) => {
              setActivePipeId(pipeId);
              setActiveTab('mobile');
            }}
          />
        )}

        {/* ── ANALYTICS & REPORTS (merged tab) ── */}
        {activeTab === 'analytics' && (() => {
          const hasDashboard = currentUser.role === 'District Manager' || currentUser.role === 'State Manager' || currentUser.role === 'Admin';
          const subTab = hasDashboard ? analyticsSubTab : 'reports';
          return (
            <div className="page-enter">
              {/* Sub-tab bar */}
              <div className="bg-white/80 backdrop-blur-sm border-b border-slate-200/80 sticky top-[56px] sm:top-[60px] z-30 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 py-2.5">
                  <div className="sub-tab-bar w-fit">
                    {hasDashboard && (
                      <button
                        onClick={() => setAnalyticsSubTab('overview')}
                        className={`sub-tab-btn ${subTab === 'overview' ? 'active' : ''}`}
                      >
                        <BarChart3 className="w-3.5 h-3.5" /> Dashboard Overview
                      </button>
                    )}
                    <button
                      onClick={() => setAnalyticsSubTab('reports')}
                      className={`sub-tab-btn ${subTab === 'reports' ? 'active' : ''}`}
                    >
                      <FileDown className="w-3.5 h-3.5" /> Reports & Export
                    </button>
                  </div>
                </div>
              </div>
              {/* Sub-tab content */}
              <div className="page-enter">
                {subTab === 'overview' && (
                  <Dashboard
                    pipes={scopedPipes}
                    installations={scopedInstallations}
                    monitoringList={scopedMonitoringList}
                    currentUser={currentUser}
                  />
                )}
                {subTab === 'reports' && (
                  <ReportsExport
                    currentUser={currentUser}
                    users={users}
                    installations={scopedInstallations}
                    monitoringList={scopedMonitoringList}
                  />
                )}
              </div>
            </div>
          );
        })()}

        {/* ── INVENTORY & QR (merged tab) ── */}
        {activeTab === 'inventory' && (
          <div className="page-enter">
            {/* Sub-tab bar */}
            <div className="bg-white/80 backdrop-blur-sm border-b border-slate-200/80 sticky top-[56px] sm:top-[60px] z-30 shadow-sm">
              <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
                <div className="sub-tab-bar w-fit">
                  <button
                    onClick={() => setInventorySubTab('inventory')}
                    className={`sub-tab-btn ${inventorySubTab === 'inventory' ? 'active' : ''}`}
                  >
                    <Box className="w-3.5 h-3.5" /> Pipe Inventory
                  </button>
                  <button
                    onClick={() => setInventorySubTab('labels')}
                    className={`sub-tab-btn ${inventorySubTab === 'labels' ? 'active' : ''}`}
                  >
                    <Printer className="w-3.5 h-3.5" /> Print QR Labels
                  </button>
                </div>
              </div>
            </div>
            {/* Sub-tab content */}
            <div className="page-enter">
              {inventorySubTab === 'inventory' && (
                <PipeInventory
                  pipes={scopedPipes}
                  onSelectPipe={(pipeId) => {
                    setActivePipeId(pipeId);
                    setActiveTab('mobile');
                  }}
                  onAddPipeBatch={handleAddPipeBatch}
                  onUpdatePipe={handleUpdatePipe}
                  onRenameBatch={handleRenameBatch}
                  onDeleteBatch={handleDeleteBatch}
                  onOpenGenerateModal={() => setIsGenerateModalOpen(true)}
                />
              )}
              {inventorySubTab === 'labels' && (
                <PrintQRLabels
                  pipes={scopedPipes}
                  onOpenGenerateModal={() => setIsGenerateModalOpen(true)}
                />
              )}
            </div>
          </div>
        )}

        {activeTab === 'hierarchy' && (
          <HierarchyManager
            states={states}
            districts={districts}
            areas={areas}
            users={users}
            onAddUser={handleAddUser}
            onUpdateUser={handleUpdateUser}
            onDeleteUser={handleDeleteUser}
            onUpdateState={handleUpdateState}
            onUpdateDistrict={handleUpdateDistrict}
            onUpdateArea={handleUpdateArea}
            onAddState={handleAddState}
            onAddDistrict={handleAddDistrict}
            onAddArea={handleAddArea}
            onDeleteState={handleDeleteState}
            onDeleteDistrict={handleDeleteDistrict}
            onDeleteArea={handleDeleteArea}

            dbStatus={dbStatus}
            currentUser={currentUser}
            onOpenDevTools={() => setIsAdminDevToolsOpen(true)}
          />
        )}

        {activeTab === 'farmers' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 animate-fadeIn">
            <FarmerProfiles
              currentUser={currentUser}
              installations={scopedInstallations}
              monitoringList={scopedMonitoringList}
              pipes={pipes}
              onUpdateInstallation={handleUpdateInstallation}
              onDeleteInstallation={handleDeleteInstallation}
            />
          </div>
        )}

        {activeTab === 'code' && <AppsScriptCodeViewer />}
      </main>

      {/* Generate Authenticated QR Batch Modal */}
      <GenerateBatchModal
        isOpen={isGenerateModalOpen}
        onClose={() => setIsGenerateModalOpen(false)}
        existingPipeCount={pipes.length}
        onBatchGenerated={(newPipes) => handleCustomBatchGenerated(newPipes)}
        onNavigateToLabels={() => { setActiveTab('inventory'); setInventorySubTab('labels'); }}
      />

      {/* Offline Sync Manager Modal */}
      <SyncQueueManager
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        isOnline={isOnline}
        onToggleOnline={() => setIsOnline(!isOnline)}
        queue={offlineQueue}
        onSyncAll={handleSyncAll}
        onDeleteItem={handleDeleteQueueItem}
      />

      {/* Admin Dev Tools & DB Storage Modal */}
      <AdminDevToolsModal
        isOpen={isAdminDevToolsOpen}
        onClose={() => setIsAdminDevToolsOpen(false)}
      />


      {/* Toast notification for silent save failures */}
      {toast && (
        <div
          className={`fixed left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-2xl text-xs font-bold max-w-sm w-full animate-fadeIn border ${toast.type === 'error'
            ? 'bg-rose-950 text-rose-200 border-rose-800'
            : toast.type === 'warning'
              ? 'bg-amber-950 text-amber-200 border-amber-800'
              : 'bg-emerald-950 text-emerald-200 border-emerald-800'
            }`}
          style={{ bottom: 'calc(5.5rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <span className={`w-2 h-2 rounded-full shrink-0 ${toast.type === 'error' ? 'bg-rose-400' : toast.type === 'warning' ? 'bg-amber-400' : 'bg-emerald-400'
            }`} />
          <span className="flex-1">{toast.message}</span>
          <button onClick={() => setToast(null)} className="opacity-60 hover:opacity-100 transition text-base leading-none">&times;</button>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-[#0a0f0d] text-slate-600 text-[11px] py-3.5 border-t border-white/[0.05]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-3 flex-wrap justify-center sm:justify-start">
            <span className="flex items-center gap-1.5 text-slate-500 font-medium">
              <span className="text-emerald-600">🌱</span>
              <strong className="text-slate-400">AWD Pipe Registry</strong>
              <span className="text-slate-700">·</span>
              Alternate Wetting &amp; Drying
            </span>

            {/* Database status badge — clickable for Admin to view Dev Tools */}
            <button
              type="button"
              onClick={() => currentUser?.role === 'Admin' && setIsAdminDevToolsOpen(true)}
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-semibold text-[10px] border transition ${currentUser?.role === 'Admin' ? 'cursor-pointer hover:border-purple-400/80' : 'cursor-default'
                } ${dbStatus === 'cloud'
                  ? 'bg-emerald-950/60 text-emerald-400 border-emerald-900'
                  : 'bg-amber-950/60 text-amber-400 border-amber-900'
                }`}
              title={currentUser?.role === 'Admin' ? 'Click to open Admin Dev Tools & DB Storage Metrics' : undefined}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${dbStatus === 'cloud' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              {dbStatus === 'cloud' ? 'MongoDB Atlas · Connected' : 'Local Demo Mode'}
              {currentUser?.role === 'Admin' && <span className="text-[9px] text-purple-400 font-mono font-bold">🛠️</span>}
            </button>

            {/* Last-synced / pending badge */}
            {offlineQueue.length > 0 ? (
              <button
                onClick={() => setIsSyncModalOpen(true)}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold text-[10px] border bg-amber-950/60 text-amber-400 border-amber-800 hover:border-amber-500 transition cursor-pointer"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                {offlineQueue.length} pending sync
              </button>
            ) : lastSynced ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold text-[10px] border bg-slate-900 text-slate-500 border-slate-800">
                ✓ Synced {lastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            ) : null}
          </div>
          <span className="text-slate-600 font-medium tabular-nums">
            {currentUser.name} · <span className="text-slate-500">{currentUser.role}</span>
          </span>
        </div>
      </footer>

    </div>
  );
}