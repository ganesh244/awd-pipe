import React, { useState } from 'react';
import { AWDPipe, Installation, MonitoringRecord } from '../types';
import { MapPin, Plus, ShieldAlert, Calendar, Phone, ZoomIn, Camera, X, Loader2, Hexagon } from 'lucide-react';
import { PhotoLightbox } from './PhotoLightbox';
import { GpsFieldMiniMap } from './GpsFieldMiniMap';

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

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2 text-xs" style={{ borderTop: '1px solid var(--color-border-light)' }}>
      <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      <span className="font-bold text-right">{value}</span>
    </div>
  );
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
    if (photoLoading) return;
    if (photoUrl !== undefined) {
      if (photoUrl) openLightbox(photoUrl, `Installation Photo — ${pipe.Pipe_ID}`);
      return;
    }
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

  const farmerPipes = allInstallations.filter(
    (i) => i.Farmer_Name.toLowerCase() === installation.Farmer_Name.toLowerCase()
  );

  const maskPhone = (phone?: string) => {
    if (!phone) return '******';
    const clean = phone.replace(/\D/g, '');
    if (clean.length >= 10) return `${clean.substring(0, 2)}******${clean.substring(8)}`;
    return '******';
  };

  const maskFarmerId = (fid?: string) => {
    if (!fid) return 'N/A';
    if (fid.length > 5) return `${fid.substring(0, 3)}***${fid.substring(fid.length - 2)}`;
    return '***';
  };

  const pipeMonitoring = monitoringList.filter((m) => m.Pipe_ID === pipe.Pipe_ID);

  return (
    <div>
      {lightboxUrl && (
        <PhotoLightbox url={lightboxUrl} caption={lightboxCaption} onClose={() => setLightboxUrl(null)} />
      )}

      {onClose && (
        <div className="sticky top-0 z-20 flex items-center justify-between px-4 py-3 text-white" style={{ background: 'var(--color-shell)' }}>
          <button onClick={onClose} className="flex items-center gap-2 text-sm font-extrabold cursor-pointer">
            <X className="w-4 h-4" /> New Registration
          </button>
          <span className="awd-mono text-xs opacity-80">{pipe.Pipe_ID}</span>
        </div>
      )}

      {/* Header — mono pipe ID, status tag */}
      <div className="p-4" style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border-light)' }}>
        <div className="awd-kicker">AWD Pipe ID</div>
        <div className="flex items-center justify-between mt-0.5">
          <h2 className="awd-mono font-black" style={{ fontSize: 24 }}>{pipe.Pipe_ID}</h2>
          <span className="awd-tag awd-tag-accent">{pipe.Status || 'Installed'}</span>
        </div>
        {pipe.Batch_No && <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{pipe.Batch_No}{pipe.Security_Hash ? ` · hash ${pipe.Security_Hash}` : ''}</div>}
      </div>

      {/* Dark "Installed" summary block */}
      <div className="p-4 text-white" style={{ background: 'var(--color-shell)' }}>
        <div className="text-[11px] uppercase tracking-wide opacity-70">Installed {installation.Installation_Date}</div>
        <div className="font-black mt-1" style={{ fontSize: 20 }}>{installation.Farmer_Name}</div>
        <div className="text-xs opacity-80 mt-0.5">{installation.Plot_Size} {installation.Plot_Size_Unit} · {installation.Crop} · {installation.Village}</div>
      </div>

      {/* Privacy notice */}
      <div className="flex items-center gap-2 px-4 py-2.5 text-xs" style={{ background: '#FFFBEB', borderBottom: '1px solid var(--color-border-light)', color: '#92400E' }}>
        <ShieldAlert className="w-4 h-4 shrink-0" />
        Farmer contact details are masked for privacy compliance.
      </div>

      {farmerPipes.length > 1 && (
        <div className="p-4" style={{ borderBottom: '1px solid var(--color-border-light)' }}>
          <div className="text-xs font-bold mb-1.5">{farmerPipes.length} pipes registered to {installation.Farmer_Name}</div>
          <div className="flex flex-wrap gap-1.5">
            {farmerPipes.map((fp) => (
              <span key={fp.Pipe_ID} className={`awd-tag ${fp.Pipe_ID === pipe.Pipe_ID ? 'awd-tag-accent' : 'awd-tag-neutral'}`}>
                {fp.Pipe_ID}{fp.Pipe_ID === pipe.Pipe_ID ? ' · current' : ''}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Table: Farmer */}
      <div className="px-4 pt-4 pb-1"><h3 className="awd-kicker">Farmer</h3></div>
      <div className="px-4">
        <Field label="Name" value={installation.Farmer_Name} />
        <Field label={<span className="flex items-center gap-1"><Phone className="w-3 h-3" />Mobile</span>} value={<span className="awd-mono">{maskPhone(installation.Mobile)}</span>} />
        <Field label="Farmer ID" value={maskFarmerId(installation.Farmer_ID)} />
      </div>

      {/* Table: Plot & crop */}
      <div className="px-4 pt-4 pb-1"><h3 className="awd-kicker">Plot &amp; crop</h3></div>
      <div className="px-4">
        <Field label="Village / Mandal" value={`${installation.Village}, ${installation.Mandal}`} />
        <Field label="District / State" value={`${installation.District}${installation.State ? ', ' + installation.State : ''}`} />
        <Field label="Survey no." value={installation.Survey_No || '—'} />
        <Field label="Plot size" value={
          <span className="flex items-center gap-1.5 justify-end">
            {installation.Plot_Size} {installation.Plot_Size_Unit}
            {installation.Plot_Boundary && installation.Plot_Boundary.length >= 3 && (
              <span className="awd-tag awd-tag-neutral"><Hexagon className="w-2.5 h-2.5" /></span>
            )}
          </span>
        } />
        <Field label="Crop & variety" value={`${installation.Crop} — ${installation.Variety || 'Local'}`} />
        <Field label="Establishment method" value={installation.Establishment_Method} />
        <Field label={installation.Establishment_Method === 'TPR' ? 'Transplanting date' : 'Sowing date'} value={installation.Sowing_Transplantation_Date} />
        {installation.Nursery_Sowing_Date && <Field label="Nursery sowing date" value={installation.Nursery_Sowing_Date} />}
        <Field label="Irrigation source" value={installation.Irrigation_Source} />
        <Field label="Installed by" value={installation.Installed_By || '—'} />
      </div>

      {/* Location & plot boundary */}
      <div className="px-4 pt-4 pb-1"><h3 className="awd-kicker">Location &amp; plot boundary</h3></div>
      <div className="px-4 pb-1">
        <Field label="GPS" value={<span className="awd-mono">{installation.Latitude?.toFixed(5)}, {installation.Longitude?.toFixed(5)} · ±{installation.GPS_Accuracy}m</span>} />
        {installation.Plot_Boundary && installation.Plot_Boundary.length >= 3 && (
          <Field label="Boundary" value={`${installation.Plot_Boundary.length} corners walked`} />
        )}
      </div>
      {installation.Latitude && installation.Longitude && (
        <div className="px-4 pb-4">
          <GpsFieldMiniMap
            latitude={installation.Latitude}
            longitude={installation.Longitude}
            pipeId={pipe.Pipe_ID}
            boundary={installation.Plot_Boundary}
          />
        </div>
      )}

      {/* Installation photo */}
      {(installation.Photo_URL !== undefined || photoUrl !== null) && (
        <div className="px-4 pt-2 pb-4">
          <div className="awd-kicker mb-1.5 flex items-center gap-1"><Camera className="w-3 h-3" /> Installation photo</div>
          <button type="button" onClick={handlePhotoClick} className="w-full relative overflow-hidden cursor-pointer" style={{ border: '1px solid var(--color-border-light)', background: 'var(--color-shell)' }}>
            <div className="w-full flex items-center justify-center" style={{ minHeight: 140, maxHeight: 192 }}>
              {photoLoading ? (
                <div className="flex flex-col items-center gap-2 text-white/60"><Loader2 className="w-6 h-6 animate-spin" /><span className="text-xs">Loading photo…</span></div>
              ) : (photoUrl || installation.Photo_URL) ? (
                <img src={photoUrl || installation.Photo_URL} alt={`Installation photo for pipe ${pipe.Pipe_ID}`} loading="lazy" className="max-h-48 max-w-full w-auto object-contain" />
              ) : (
                <div className="flex flex-col items-center gap-2 text-white/60"><Camera className="w-6 h-6" /><span className="text-xs">Tap to load photo</span></div>
              )}
            </div>
          </button>
        </div>
      )}

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-0 mx-4 mb-4" style={{ border: '1px solid var(--color-border-light)' }}>
        <a href={installation.Location_Link} target="_blank" rel="noopener noreferrer" className="awd-btn-secondary justify-center" style={{ border: 0, borderRight: '1px solid var(--color-border-light)' }}>
          <MapPin className="w-4 h-4" />View on map
        </a>
        <button onClick={onOpenMonitoringModal} className="awd-btn-primary justify-center" style={{ border: 0 }}>
          <Plus className="w-4 h-4" />Add visit log
        </button>
      </div>

      {/* Monitoring visits — this app's real "record trail" */}
      <div className="flex items-center justify-between px-4 pt-2 pb-1.5">
        <h3 className="font-extrabold text-sm">Monitoring visits ({pipeMonitoring.length})</h3>
        <button onClick={onOpenMonitoringModal} className="text-xs font-bold flex items-center gap-1 cursor-pointer" style={{ color: 'var(--color-accent-700)' }}>
          <Plus className="w-3 h-3" /> New visit
        </button>
      </div>

      {pipeMonitoring.length === 0 ? (
        <div className="px-4 py-6 text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>No monitoring visits recorded yet.</div>
      ) : (
        <div className="awd-card" style={{ borderLeft: 0, borderRight: 0, borderBottom: 0 }}>
          {pipeMonitoring.map((visit, idx) => (
            <div key={idx} className="p-3 text-xs" style={{ borderTop: idx === 0 ? 'none' : '1px solid var(--color-border-light)' }}>
              <div className="flex items-center justify-between">
                <span className="font-bold flex items-center gap-1"><Calendar className="w-3 h-3" />{visit.Visit_Date}</span>
                <span className={`awd-tag ${
                  visit.AWD_Followed === 'Yes' ? 'awd-tag-accent' : visit.AWD_Followed === 'Partially' ? 'awd-tag-warning' : 'awd-tag-danger'
                }`}>AWD: {visit.AWD_Followed}</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 pt-2" style={{ color: 'var(--color-text-secondary)' }}>
                <div>Water level: <strong>{visit.Water_Level}</strong></div>
                <div>Crop stage: <strong>{visit.Crop_Stage}</strong></div>
                <div>Condition: <strong>{visit.Pipe_Condition}</strong></div>
                <div>Visited by: <strong>{visit.Visited_By}</strong></div>
              </div>
              {visit.Remarks && (
                <div className="mt-1.5 italic" style={{ color: 'var(--color-text-muted)' }}>"{visit.Remarks}"</div>
              )}
              {visit.Photo_URL && (
                <button
                  type="button"
                  onClick={() => openLightbox(visit.Photo_URL!, `Visit Photo — ${visit.Visit_Date} · ${pipe.Pipe_ID}`)}
                  className="w-full mt-1.5 cursor-pointer"
                  style={{ border: '1px solid var(--color-border-light)' }}
                >
                  <div className="flex items-center gap-1 text-[10px] font-bold uppercase px-2 pt-1.5 pb-1" style={{ color: 'var(--color-text-muted)' }}>
                    <Camera className="w-3 h-3" /> Visit photo <ZoomIn className="w-3 h-3 ml-auto" />
                  </div>
                  <img src={visit.Photo_URL} alt={`Monitoring visit photo for pipe ${pipe.Pipe_ID} on ${visit.Visit_Date}`} loading="lazy" className="w-full object-cover" style={{ height: 128 }} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
