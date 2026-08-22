import React, { useState } from 'react';
import { AWDPipe, Installation, MonitoringRecord } from '../types';
import { MapPin, Plus, CheckCircle2, UserCheck, ShieldAlert, History, Calendar, Sprout, Phone, ZoomIn, Camera, X, Loader2 } from 'lucide-react';
import { PhotoLightbox } from './PhotoLightbox';

const apiFetch = (url: RequestInfo | URL, options?: RequestInit) => {
  const token = localStorage.getItem('awd_auth_token');
  const headers = new Headers(options?.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(url, { ...options, headers });
};

interface PipeInfoCardProps {
  pipe: AWDPipe;
  installation: Installation;
  monitoringList: MonitoringRecord[];
  allInstallations?: Installation[];
  onOpenMonitoringModal: () => void;
  onClose?: () => void;
}

export const PipeInfoCard: React.FC<PipeInfoCardProps> = ({
  pipe,
  installation,
  monitoringList,
  allInstallations = [],
  onOpenMonitoringModal,
  onClose,
}) => {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxCaption, setLightboxCaption] = useState<string>('');
  const [photoUrl, setPhotoUrl] = useState<string | null | undefined>(undefined); // undefined=not fetched, null=no photo
  const [photoLoading, setPhotoLoading] = useState(false);

  const handlePhotoClick = async () => {
    // If already fetched or loading, open lightbox directly
    if (photoLoading) return;
    if (photoUrl !== undefined) {
      if (photoUrl) openLightbox(photoUrl, `Installation Photo — ${pipe.Pipe_ID}`);
      return;
    }
    // Lazy-fetch the photo on first click
    setPhotoLoading(true);
    try {
      const res = await apiFetch(`/api/installations/${encodeURIComponent(installation.Pipe_ID)}/photo`);
      const data = await res.json();
      setPhotoUrl(data.Photo_URL || null);
      if (data.Photo_URL) openLightbox(data.Photo_URL, `Installation Photo — ${pipe.Pipe_ID}`);
    } catch {
      setPhotoUrl(null);
    } finally {
      setPhotoLoading(false);
    }
  };

  const openLightbox = (url: string, caption: string) => {
    setLightboxUrl(url);
    setLightboxCaption(caption);
  };
  // Find all pipes owned by this farmer
  const farmerPipes = allInstallations.filter(
    (i) => i.Farmer_Name.toLowerCase() === installation.Farmer_Name.toLowerCase()
  );
  // Mask sensitive farmer information
  const maskPhone = (phone?: string) => {
    if (!phone) return '******';
    const clean = phone.replace(/\D/g, '');
    if (clean.length >= 10) {
      return `${clean.substring(0, 2)}******${clean.substring(8)}`;
    }
    return '******';
  };

  const maskFarmerId = (fid?: string) => {
    if (!fid) return 'N/A';
    if (fid.length > 5) {
      return `${fid.substring(0, 3)}***${fid.substring(fid.length - 2)}`;
    }
    return '***';
  };

  const pipeMonitoring = monitoringList.filter((m) => m.Pipe_ID === pipe.Pipe_ID);

  return (
    <div className="space-y-6">
      {/* Photo Lightbox */}
      {lightboxUrl && (
        <PhotoLightbox
          url={lightboxUrl}
          caption={lightboxCaption}
          onClose={() => setLightboxUrl(null)}
        />
      )}

      {/* Top Action Bar — sticky, always visible */}
      {onClose && (
        <div className="sticky top-0 z-20 flex items-center justify-between bg-emerald-700 px-4 py-3 rounded-2xl shadow-lg border border-emerald-600">
          <button
            onClick={onClose}
            className="flex items-center gap-2 text-sm font-extrabold text-white hover:text-emerald-100 transition-colors group"
          >
            <X className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            ← New Registration
          </button>
          <span className="text-xs text-emerald-200 font-mono font-semibold">{pipe.Pipe_ID}</span>
        </div>
      )}

      {/* Privacy Warning Banner */}
      <div className="bg-amber-500/10 border border-amber-500/30 text-amber-900 rounded-xl p-3 text-xs flex items-center gap-2 shadow-xs">
        <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
        <span>
          <strong>Registered AWD Pipe:</strong> Sensitive farmer contact details are masked for privacy compliance.
        </span>
      </div>

      {/* Side-by-Side Desktop Grid Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Main Pipe Card (Left Column on Desktop) */}
        <div className="lg:col-span-7 bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden">
          
          {/* Header Status Bar */}
          <div className="bg-gradient-to-r from-emerald-800 to-teal-800 text-white p-4 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-200">AWD Pipe ID</span>
              <h2 className="text-2xl font-black">{pipe.Pipe_ID}</h2>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className="bg-emerald-500/20 border border-emerald-400/30 text-emerald-100 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-sm">
                <CheckCircle2 className="w-3.5 h-3.5" /> Installed
              </span>
              {onClose && (
                <button
                  onClick={onClose}
                  className="bg-white/10 hover:bg-white/20 text-white px-3 py-1 rounded-full text-xs font-bold transition-colors flex items-center gap-1"
                >
                  <X className="w-3 h-3" /> Close
                </button>
              )}
            </div>
          </div>

          {/* Info Grid */}
          <div className="p-4 sm:p-5 space-y-4">
            
            {/* Farmer & Location Section */}
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                Farmer & Plot Overview
              </h3>
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs">
                <div>
                  <span className="text-slate-400 block text-xs">Farmer Name</span>
                  <span className="font-bold text-slate-800 text-sm">{installation.Farmer_Name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-xs flex items-center gap-0.5">
                    <Phone className="w-2.5 h-2.5 text-slate-400" /> Mobile (Protected)
                  </span>
                  <span className="font-mono font-bold text-slate-600">{maskPhone(installation.Mobile)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-xs">Location</span>
                  <span className="font-semibold text-slate-800">{installation.Village}, {installation.Mandal}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-xs">District</span>
                  <span className="font-semibold text-slate-800">{installation.District}</span>
                </div>
              </div>

              {farmerPipes.length > 0 && (
                <div className="mt-2 bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-xs text-emerald-900 flex flex-col gap-1">
                  <div className="font-bold flex items-center justify-between">
                    <span>🌾 Registered Pipes for {installation.Farmer_Name}:</span>
                    <span className="bg-emerald-700 text-white font-mono px-2 py-0.5 rounded text-xs">
                      {farmerPipes.length} Pipe{farmerPipes.length > 1 ? 's' : ''} Assigned
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {farmerPipes.map((fp) => (
                      <span
                        key={fp.Pipe_ID}
                        className={`font-mono text-xs font-bold px-2 py-0.5 rounded border ${
                          fp.Pipe_ID === pipe.Pipe_ID
                            ? 'bg-emerald-800 text-white border-emerald-900'
                            : 'bg-white text-emerald-800 border-emerald-300'
                        }`}
                      >
                        {fp.Pipe_ID} {fp.Pipe_ID === pipe.Pipe_ID ? '📍 (Current)' : ''}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Plot & Crop Details */}
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Sprout className="w-3.5 h-3.5 text-emerald-600" />
                Agronomic Parameters
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Plot Size & Unit</span>
                  <span className="font-bold text-slate-800">{installation.Plot_Size} {installation.Plot_Size_Unit} (Survey: {installation.Survey_No || 'N/A'})</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Establishment Method</span>
                  <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {installation.Establishment_Method}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">
                    {installation.Establishment_Method === 'TPR' ? 'Transplantation Date' : 'Sowing Date'}
                  </span>
                  <span className="font-semibold text-slate-800">{installation.Sowing_Transplantation_Date}</span>
                </div>
                {installation.Nursery_Sowing_Date && (
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500">Nursery Sowing Date</span>
                    <span className="font-semibold text-slate-800">{installation.Nursery_Sowing_Date}</span>
                  </div>
                )}
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Crop & Variety</span>
                  <span className="font-semibold text-slate-800">{installation.Crop} - {installation.Variety || 'Local'}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500">Irrigation Source</span>
                  <span className="font-semibold text-slate-800">{installation.Irrigation_Source}</span>
                </div>
                {/* Photo section — lazy-loaded on first click to avoid sending 400KB on startup */}
                {(installation.Photo_URL !== undefined || photoUrl !== null) && (
                  <div className="pt-2">
                    <div className="text-slate-400 text-xs mb-1.5 font-bold uppercase flex items-center gap-1">
                      <Camera className="w-3 h-3" /> Installation Field Photo
                      <span className="ml-auto text-slate-300 font-normal flex items-center gap-0.5">
                        <ZoomIn className="w-3 h-3" /> Click to expand
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handlePhotoClick}
                      className="w-full group relative overflow-hidden rounded-xl border border-slate-700 bg-slate-950 p-1.5 shadow-inner hover:border-emerald-400 transition-all cursor-pointer"
                    >
                      <div className="w-full flex items-center justify-center min-h-[140px] max-h-48 overflow-hidden bg-slate-900 rounded-lg p-1">
                        {photoLoading ? (
                          <div className="flex flex-col items-center gap-2 text-slate-400">
                            <Loader2 className="w-6 h-6 animate-spin" />
                            <span className="text-xs">Loading photo...</span>
                          </div>
                        ) : photoUrl ? (
                          <img
                            src={photoUrl}
                            alt={`AWD installation field photo for pipe ${pipe.Pipe_ID}`}
                            loading="lazy"
                            width="400"
                            height="176"
                            className="max-h-44 max-w-full w-auto object-contain rounded group-hover:scale-102 transition-transform duration-300"
                          />
                        ) : installation.Photo_URL ? (
                          <img
                            src={installation.Photo_URL}
                            alt={`AWD installation field photo for pipe ${pipe.Pipe_ID}`}
                            loading="lazy"
                            width="400"
                            height="176"
                            className="max-h-44 max-w-full w-auto object-contain rounded group-hover:scale-102 transition-transform duration-300"
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-slate-500">
                            <Camera className="w-6 h-6" />
                            <span className="text-xs">Tap to load photo</span>
                          </div>
                        )}
                      </div>
                      <div className="absolute inset-0 bg-slate-950/0 group-hover:bg-slate-950/30 transition-all flex items-center justify-center">
                        <ZoomIn className="w-7 h-7 text-white opacity-0 group-hover:opacity-100 transition-all drop-shadow-lg" />
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 grid grid-cols-2 gap-2">
              <a
                href={installation.Location_Link}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition border border-slate-200"
              >
                <MapPin className="w-4 h-4 text-emerald-600" />
                View GPS Location
              </a>
              <button
                onClick={onOpenMonitoringModal}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Add Visit Log
              </button>
            </div>

          </div>
        </div>

        {/* Monitoring Visit Logs Timeline (Right Column on Desktop) */}
        <div className="lg:col-span-5 bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-5">
          <div className="flex items-center justify-between border-b pb-3 mb-3">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <History className="w-4 h-4 text-emerald-600" />
              Field Monitoring Visits ({pipeMonitoring.length})
            </h3>
            <button
              onClick={onOpenMonitoringModal}
              className="text-xs text-emerald-700 font-semibold hover:underline flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> New Visit
            </button>
          </div>

        {pipeMonitoring.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-xs">
            No monitoring visits recorded yet for this pipe.
          </div>
        ) : (
          <div className="space-y-3">
            {pipeMonitoring.map((visit, idx) => (
              <div key={idx} className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-800 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> {visit.Visit_Date}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs font-extrabold ${
                    visit.AWD_Followed === 'Yes'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : visit.AWD_Followed === 'Partially'
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : 'bg-red-100 text-red-800 border border-red-300'
                  }`}>
                    AWD: {visit.AWD_Followed}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-slate-600 pt-1">
                  <div>Water Level: <strong className="text-slate-800">{visit.Water_Level}</strong></div>
                  <div>Crop Stage: <strong className="text-slate-800">{visit.Crop_Stage}</strong></div>
                  <div>Pipe Condition: <strong className="text-slate-800">{visit.Pipe_Condition}</strong></div>
                  <div>Visited By: <strong className="text-slate-800">{visit.Visited_By}</strong></div>
                </div>
                {visit.Remarks && (
                  <div className="text-xs text-slate-500 italic bg-white p-2 rounded border border-slate-100 mt-1">
                    "{visit.Remarks}"
                  </div>
                )}
                {visit.Photo_URL && (
                  <div className="mt-1.5">
                    <button
                      type="button"
                      onClick={() => openLightbox(visit.Photo_URL!, `Visit Photo — ${visit.Visit_Date} · ${pipe.Pipe_ID}`)}
                      className="w-full group relative overflow-hidden rounded-lg border border-slate-200 hover:border-blue-400 transition-all"
                    >
                      <div className="flex items-center gap-1 text-xs text-slate-400 font-bold uppercase tracking-wider px-2 pt-1.5 pb-1">
                        <Camera className="w-3 h-3" /> Visit Photo <ZoomIn className="w-3 h-3 ml-auto" />
                      </div>
                      <img
                        src={visit.Photo_URL}
                        alt={`Monitoring visit photo for pipe ${pipe.Pipe_ID} on ${visit.Visit_Date}`}
                        loading="lazy"
                        width="400"
                        height="128"
                        className="w-full h-32 object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                        <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-all drop-shadow-lg" />
                      </div>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  );
};
