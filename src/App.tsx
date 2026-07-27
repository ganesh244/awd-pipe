import React, { useState, useEffect } from 'react';
import { AWDPipe, Installation, MonitoringRecord } from './types';
import { INITIAL_PIPES, INITIAL_INSTALLATIONS, INITIAL_MONITORING } from './data/initialData';
import { Navbar } from './components/Navbar';
import { MobileRegistrationApp } from './components/MobileRegistrationApp';
import { InteractiveFieldMap } from './components/InteractiveFieldMap';
import { Dashboard } from './components/Dashboard';
import { PipeInventory } from './components/PipeInventory';
import { PrintQRLabels } from './components/PrintQRLabels';
import { AppsScriptCodeViewer } from './components/AppsScriptCodeViewer';
import { GenerateBatchModal } from './components/GenerateBatchModal';

export default function App() {
  const [pipes, setPipes] = useState<AWDPipe[]>(INITIAL_PIPES);
  const [installations, setInstallations] = useState<Installation[]>(INITIAL_INSTALLATIONS);
  const [monitoringList, setMonitoringList] = useState<MonitoringRecord[]>(INITIAL_MONITORING);
  
  const [activeTab, setActiveTab] = useState<string>('mobile');
  const [activePipeId, setActivePipeId] = useState<string>('AWD-0004'); // Defaults to an available unregistered pipe
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState<boolean>(false);

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

  // Handler: Successful Farmer & Pipe Registration
  const handleRegisterSuccess = (newInstallation: Installation, updatedPipe: AWDPipe) => {
    setInstallations((prev) => [newInstallation, ...prev]);
    setPipes((prev) =>
      prev.map((p) => (p.Pipe_ID === updatedPipe.Pipe_ID ? updatedPipe : p))
    );
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
  };

  // Handler: Generated Custom QR Batch
  const handleCustomBatchGenerated = (newPipes: AWDPipe[]) => {
    setPipes((prev) => [...newPipes, ...prev]);
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-800 flex flex-col font-sans">
      
      {/* Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activePipeId={activePipeId}
        onOpenGenerateModal={() => setIsGenerateModalOpen(true)}
      />

      {/* Main Tab Views */}
      <main className="flex-1 pb-12">
        {activeTab === 'mobile' && (
          <MobileRegistrationApp
            pipes={pipes}
            installations={installations}
            monitoringList={monitoringList}
            activePipeId={activePipeId}
            setActivePipeId={setActivePipeId}
            onRegisterSuccess={handleRegisterSuccess}
            onAddMonitoring={handleAddMonitoring}
          />
        )}

        {activeTab === 'map' && (
          <InteractiveFieldMap
            pipes={pipes}
            installations={installations}
            monitoringList={monitoringList}
            onSelectPipeForMobile={(pipeId) => {
              setActivePipeId(pipeId);
              setActiveTab('mobile');
            }}
          />
        )}

        {activeTab === 'dashboard' && (
          <Dashboard
            pipes={pipes}
            installations={installations}
            monitoringList={monitoringList}
          />
        )}

        {activeTab === 'inventory' && (
          <PipeInventory
            pipes={pipes}
            onSelectPipe={(pipeId) => {
              setActivePipeId(pipeId);
              setActiveTab('mobile');
            }}
            onAddPipeBatch={handleAddPipeBatch}
            onOpenGenerateModal={() => setIsGenerateModalOpen(true)}
          />
        )}

        {activeTab === 'labels' && (
          <PrintQRLabels
            pipes={pipes}
            onOpenGenerateModal={() => setIsGenerateModalOpen(true)}
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
        onNavigateToLabels={() => setActiveTab('labels')}
      />

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 text-xs py-6 border-t border-slate-800 text-center">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>🌱 <strong>AWD Pipe System</strong> — Alternate Wetting and Drying Paddy Water Management</span>
          <span className="text-slate-500">Google Sheets + Google Apps Script + HTML Service</span>
        </div>
      </footer>

    </div>
  );
}
