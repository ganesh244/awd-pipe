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


export default function App() {
  const [pipes, setPipes] = useState<AWDPipe[]>(INITIAL_PIPES);
  const [installations, setInstallations] = useState<Installation[]>(INITIAL_INSTALLATIONS);
  const [monitoringList, setMonitoringList] = useState<MonitoringRecord[]>(INITIAL_MONITORING);

  // Hierarchy Data States
  const [states, setStates] = useState<StateNode[]>(INITIAL_STATES);
  const [districts, setDistricts] = useState<DistrictNode[]>(INITIAL_DISTRICTS);
  const [areas, setAreas] = useState<AreaNode[]>(INITIAL_AREAS);
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  
  // Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(INITIAL_USERS[0]); // Default logged in as Super Admin
  
  // Database Connection Status State
  const [dbStatus, setDbStatus] = useState<'cloud' | 'local' | 'loading'>('loading');

  const [activeTab, setActiveTab] = useState<string>('home');
  const [analyticsSubTab, setAnalyticsSubTab] = useState<'overview' | 'reports'>('overview');
  const [inventorySubTab, setInventorySubTab] = useState<'inventory' | 'labels'>('inventory');
  const [activePipeId, setActivePipeId] = useState<string>('AWD-0004'); // Defaults to an available unregistered pipe
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState<boolean>(false);

  // Offline Data Sync States
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    const saved = localStorage.getItem('awd_online_status');
    return saved !== null ? saved === 'true' : true;
  });
  const [offlineQueue, setOfflineQueue] = useState<OfflineQueueItem[]>(() => {
    const saved = localStorage.getItem('awd_offline_queue');
    return saved ? JSON.parse(saved) : [];
  });
  const [isSyncModalOpen, setIsSyncModalOpen] = useState<boolean>(false);

  // Sync state changes back to localStorage
  useEffect(() => {
    localStorage.setItem('awd_online_status', String(isOnline));
  }, [isOnline]);

  useEffect(() => {
    localStorage.setItem('awd_offline_queue', JSON.stringify(offlineQueue));
  }, [offlineQueue]);


  // Fetch initial data from Backend API / MongoDB on mount
  useEffect(() => {
    fetch('/api/init')
      .then((res) => res.json())
      .then((data) => {
        if (data.users && data.users.length > 0) setUsers(data.users);
        if (data.pipes && data.pipes.length > 0) setPipes(data.pipes);
        if (data.installations && data.installations.length > 0) setInstallations(data.installations);
        if (data.monitoringList && data.monitoringList.length > 0) setMonitoringList(data.monitoringList);
        if (data.states && data.states.length > 0) setStates(data.states);
        if (data.districts && data.districts.length > 0) setDistricts(data.districts);
        if (data.areas && data.areas.length > 0) setAreas(data.areas);
        setDbStatus(data.dbStatus || 'local');
      })
      .catch((err) => {
        console.warn('Backend API not reachable, running in offline demo mode:', err);
        setDbStatus('local');
      });
  }, []);

  // URL Parameter Detection: Check if ?id=AWD-XXXX exists in current URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const scannedId = params.get('id');
    if (scannedId) {
      // Find or add if valid
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
  }, []);

  // Handler: Add User to Hierarchy
  const handleAddUser = (newUser: User) => {
    setUsers((prev) => [...prev, newUser]);
    fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newUser }),
    }).catch((err) => console.error('Failed to sync user to MongoDB:', err));
  };

  // Handler: Update User in Hierarchy
  const handleUpdateUser = (updatedUser: User) => {
    setUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
    if (currentUser && currentUser.id === updatedUser.id) {
      setCurrentUser(updatedUser);
    }
    fetch(`/api/users/${updatedUser.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updatedUser }),
    }).catch((err) => console.error('Failed to sync user update to MongoDB:', err));
  };

  // Handler: Delete User from Hierarchy
  const handleDeleteUser = (userId: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== userId));
    if (currentUser && currentUser.id === userId) {
      setCurrentUser(null);
    }
    fetch(`/api/users/${userId}`, {
      method: 'DELETE',
    }).catch((err) => console.error('Failed to delete user from MongoDB:', err));
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
      fetch('/api/installations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ installation: newInstallation, updatedPipe }),
      }).catch((err) => {
        console.error('Failed to save registration to MongoDB, queuing offline:', err);
        queueOfflineItem('registration', { installation: newInstallation, updatedPipe });
      });
    } else {
      queueOfflineItem('registration', { installation: newInstallation, updatedPipe });
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
      fetch('/api/monitoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ record }),
      }).catch((err) => {
        console.error('Failed to save monitoring log to MongoDB, queuing offline:', err);
        queueOfflineItem('monitoring', record);
      });
    } else {
      queueOfflineItem('monitoring', record);
    }
  };

  // Synchronize all offline items sequentially
  const handleSyncAll = async () => {
    if (!isOnline || offlineQueue.length === 0) return;
    
    const pending = [...offlineQueue];
    const failedIds = new Set<string>();
    
    for (const item of pending) {
      try {
        if (item.type === 'registration') {
          const res = await fetch('/api/installations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item.payload),
          });
          if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
        } else {
          const res = await fetch('/api/monitoring', {
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
    
    // Filter out successfully synced items
    setOfflineQueue((prev) => prev.filter(item => failedIds.has(item.id)));
  };

  const handleDeleteQueueItem = (id: string) => {
    setOfflineQueue((prev) => prev.filter(item => item.id !== id));
  };


  // Handler: Add New Batch of AWD Pipes
  const handleAddPipeBatch = (batchNo: string, count: number) => {
    const startNum = pipes.length + 1;
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
    fetch('/api/pipes/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPipes }),
    }).catch((err) => console.error('Failed to sync pipe batch to MongoDB:', err));
  };

  // Handler: Generated Custom QR Batch
  const handleCustomBatchGenerated = (newPipes: AWDPipe[]) => {
    setPipes((prev) => [...newPipes, ...prev]);
    fetch('/api/pipes/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPipes }),
    }).catch((err) => console.error('Failed to sync pipe batch to MongoDB:', err));
  };

  // Data Scoping logic: Filter installations and monitoring records based on currentUser role and hierarchy
  const scopedInstallations = React.useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'Admin') return installations;
    if (currentUser.role === 'State Manager') {
      return installations.filter((inst) => !inst.State || inst.State === currentUser.state);
    }
    if (currentUser.role === 'District Manager') {
      return installations.filter((inst) => !inst.District || inst.District === currentUser.district);
    }
    if (currentUser.role === 'Area Manager') {
      const subordinateIds = users
        .filter((u) => u.reportsToId === currentUser.id || u.id === currentUser.id)
        .map((u) => u.id);
      return installations.filter(
        (inst) =>
          (inst.Area_Manager_User_ID && inst.Area_Manager_User_ID === currentUser.id) ||
          (inst.Registered_By_User_ID && subordinateIds.includes(inst.Registered_By_User_ID)) ||
          (!inst.Area_Manager_User_ID && !inst.Registered_By_User_ID && inst.District === currentUser.district)
      );
    }
    if (currentUser.role === 'CF' || currentUser.role === 'JCF') {
      return installations.filter(
        (inst) =>
          inst.Registered_By_User_ID === currentUser.id ||
          (!inst.Registered_By_User_ID && inst.District === currentUser.district)
      );
    }
    return installations;
  }, [installations, currentUser, users]);

  const scopedMonitoringList = React.useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'Admin') return monitoringList;
    if (currentUser.role === 'State Manager' || currentUser.role === 'District Manager') {
      const allowedPipeIds = new Set(scopedInstallations.map((i) => i.Pipe_ID));
      return monitoringList.filter((m) => allowedPipeIds.has(m.Pipe_ID));
    }
    if (currentUser.role === 'Area Manager') {
      const allowedPipeIds = new Set(scopedInstallations.map((i) => i.Pipe_ID));
      const subordinateIds = users
        .filter((u) => u.reportsToId === currentUser.id || u.id === currentUser.id)
        .map((u) => u.id);
      return monitoringList.filter(
        (m) =>
          allowedPipeIds.has(m.Pipe_ID) ||
          (m.Visited_By_User_ID && subordinateIds.includes(m.Visited_By_User_ID))
      );
    }
    if (currentUser.role === 'CF' || currentUser.role === 'JCF') {
      const allowedPipeIds = new Set(scopedInstallations.map((i) => i.Pipe_ID));
      return monitoringList.filter(
        (m) =>
          allowedPipeIds.has(m.Pipe_ID) ||
          m.Visited_By_User_ID === currentUser.id
      );
    }
    return monitoringList;
  }, [monitoringList, scopedInstallations, currentUser, users]);

  const scopedPipes = React.useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'Admin') return pipes;
    const installedPipeIds = new Set(scopedInstallations.map((i) => i.Pipe_ID));
    if (currentUser.role === 'CF' || currentUser.role === 'JCF' || currentUser.role === 'Area Manager' || currentUser.role === 'District Manager' || currentUser.role === 'State Manager') {
      return pipes.filter((p) => p.Status === 'Available' || installedPipeIds.has(p.Pipe_ID));
    }
    return pipes;
  }, [pipes, scopedInstallations, currentUser]);

  // Render Login Gate if no user is active
  if (!currentUser) {
    return <LoginScreen users={users} onLogin={(user) => setCurrentUser(user)} />;
  }

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-800 flex flex-col font-sans">
      
      {/* Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activePipeId={activePipeId}
        currentUser={currentUser}
        onLogout={() => setCurrentUser(null)}
        onOpenGenerateModal={() => setIsGenerateModalOpen(true)}
        isOnline={isOnline}
        onToggleOnline={() => setIsOnline(!isOnline)}
        offlineQueueCount={offlineQueue.length}
        onOpenSyncModal={() => setIsSyncModalOpen(true)}
      />

      {/* Main Tab Views */}
      <main className="flex-1 pb-12">
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
              <div className="bg-white/80 backdrop-blur-sm border-b border-slate-200/80 sticky top-[60px] z-30 shadow-sm">
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
            <div className="bg-white/80 backdrop-blur-sm border-b border-slate-200/80 sticky top-[60px] z-30 shadow-sm">
              <div className="max-w-7xl mx-auto px-4 py-2.5">
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
            currentUser={currentUser}
          />
        )}

        {activeTab === 'farmers' && (
          <FarmerProfiles
            currentUser={currentUser}
            installations={scopedInstallations}
            monitoringList={scopedMonitoringList}
            pipes={pipes}
          />
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


      {/* Footer */}
      <footer className="bg-[#0a0f0d] text-slate-600 text-[11px] py-3.5 border-t border-white/[0.05]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-3 flex-wrap justify-center sm:justify-start">
            <span className="flex items-center gap-1.5 text-slate-500 font-medium">
              <span className="text-emerald-600">🌱</span>
              <strong className="text-slate-400">AWD Pipe Registry</strong>
              <span className="text-slate-700">·</span>
              Alternate Wetting & Drying
            </span>
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-semibold text-[10px] border ${
              dbStatus === 'cloud'
                ? 'bg-emerald-950/60 text-emerald-400 border-emerald-900'
                : 'bg-amber-950/60 text-amber-400 border-amber-900'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${dbStatus === 'cloud' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              {dbStatus === 'cloud' ? 'MongoDB Atlas · Connected' : 'Local Demo Mode'}
            </span>
          </div>
          <span className="text-slate-600 font-medium tabular-nums">
            {currentUser.name} · <span className="text-slate-500">{currentUser.role}</span>
          </span>
        </div>
      </footer>

    </div>
  );
}

