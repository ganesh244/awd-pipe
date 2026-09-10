import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { AWDPipe, Installation, MonitoringRecord } from '../types';
import {
  MapPin, Search, Layers, Smartphone, ExternalLink,
  Calendar, Sprout, UserCheck, Compass, RefreshCw, Droplet, Hexagon, X,
} from 'lucide-react';

interface InteractiveFieldMapProps {
  pipes: AWDPipe[];
  installations: Installation[];
  monitoringList: MonitoringRecord[];
  onSelectPipeForMobile: (pipeId: string) => void;
}

export const InteractiveFieldMap: React.FC<InteractiveFieldMapProps> = ({
  pipes,
  installations,
  monitoringList,
  onSelectPipeForMobile,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const polygonsGroupRef = useRef<L.LayerGroup | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Installed' | 'Available' | 'Damaged'>('Installed');
  const [villageFilter, setVillageFilter] = useState<string>('All');
  const [tileType, setTileType] = useState<'satellite' | 'streets'>('satellite');
  const [showBoundaries, setShowBoundaries] = useState(true);
  const [selectedPipeDetails, setSelectedPipeDetails] = useState<{
    pipe: AWDPipe;
    installation?: Installation;
    lastMonitoring?: MonitoringRecord;
  } | null>(null);

  // useMemo: villages list — only recalc when installations change
  const villages = useMemo(
    () => Array.from(new Set(installations.map((i) => i.Village).filter(Boolean))),
    [installations]
  );

  // useMemo: map marker data — only recalc when pipes/installations/monitoring change
  const mapPipes = useMemo(() => {
    const coordCounts = new Map<string, number>();
    return pipes.map((pipe, idx) => {
      const inst = installations.find((i) => i.Pipe_ID === pipe.Pipe_ID);
      const lastMon = monitoringList
        .filter((m) => m.Pipe_ID === pipe.Pipe_ID)
        .sort((a, b) => new Date(b.Timestamp).getTime() - new Date(a.Timestamp).getTime())[0];

      let lat = inst?.Latitude;
      let lng = inst?.Longitude;
      const hasValidGps = lat && lng && lat !== 0 && lng !== 0;

      if (!hasValidGps) {
        // Staggered fallback coords around Kandi, Sangareddy (17.5812, 78.1084)
        const pipeIndex = parseInt(pipe.Pipe_ID.replace(/\D/g, ''), 10) || (idx + 1);
        lat = 17.5700 + ((pipeIndex * 0.008) % 0.12);
        lng = 78.0900 + ((pipeIndex * 0.010) % 0.15);
      } else {
        // Offset overlapping coordinates
        const coordKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
        const count = coordCounts.get(coordKey) || 0;
        coordCounts.set(coordKey, count + 1);
        if (count > 0) {
          const angle = count * (Math.PI / 3);
          const radius = 0.0022 * count;
          lat = lat + Math.sin(angle) * radius;
          lng = lng + Math.cos(angle) * radius;
        }
      }

      return { pipe, installation: inst, lastMonitoring: lastMon, latitude: lat, longitude: lng };
    });
  }, [pipes, installations, monitoringList]);

  // useMemo: filtered list — only recalc when filters/search/mapPipes change
  // NOT when selectedPipeDetails changes → prevents fitBounds on pin click
  const filteredPipes = useMemo(
    () =>
      mapPipes.filter((mp) => {
        const matchesSearch =
          mp.pipe.Pipe_ID.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (mp.installation?.Farmer_Name || mp.pipe.Farmer_Name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          (mp.installation?.Village || mp.pipe.Village || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'All' || mp.pipe.Status === statusFilter;
        const matchesVillage = villageFilter === 'All' || mp.installation?.Village === villageFilter;
        return matchesSearch && matchesStatus && matchesVillage;
      }),
    [mapPipes, searchTerm, statusFilter, villageFilter]
  );

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      // Kandi, Sangareddy — confirmed GPS: 17.5812, 78.1084
      center: [17.5812, 78.1084],
      zoom: 12,
      attributionControl: false,
    });

    mapInstanceRef.current = map;

    const streetUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    const satelliteUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

    L.tileLayer(tileType === 'satellite' ? satelliteUrl : streetUrl, {
      maxZoom: 21,
      maxNativeZoom: 18, // ArcGIS satellite tiles only go to zoom 18 in rural India
    }).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);
    markersGroupRef.current = layerGroup;

    const polygonsGroup = L.layerGroup().addTo(map);
    polygonsGroupRef.current = polygonsGroup;

    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update map tile type
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        map.removeLayer(layer);
      }
    });

    const streetUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    const satelliteUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

    L.tileLayer(tileType === 'satellite' ? satelliteUrl : streetUrl, {
      maxZoom: 21,
      maxNativeZoom: 18,
    }).addTo(map);
  }, [tileType]);

  // Render & update markers whenever filteredPipes changes.
  // Pin shape/colors follow the design prototype's flat-square-pin language
  // (real PipeStatus values, not the prototype's mock Verified/Unverified).
  useEffect(() => {
    if (!mapInstanceRef.current || !markersGroupRef.current) return;

    const map = mapInstanceRef.current;
    const layerGroup = markersGroupRef.current;
    layerGroup.clearLayers();
    polygonsGroupRef.current?.clearLayers();

    const bounds = L.latLngBounds([]);

    filteredPipes.forEach((item) => {
      const { pipe, installation, lastMonitoring, latitude, longitude } = item;

      let pinColor = 'var(--color-accent-500)';
      let statusLabel = 'Installed';

      if (pipe.Status === 'Available') {
        pinColor = 'var(--color-text-muted)';
        statusLabel = 'Available';
      } else if (pipe.Status === 'Damaged') {
        pinColor = 'var(--color-danger)';
        statusLabel = 'Damaged';
      }

      const farmerName = installation?.Farmer_Name || pipe.Farmer_Name || 'Unassigned Field';
      const village = installation?.Village || pipe.Village || 'Central Depot';

      // Flush 14×14 square pin (matches the design prototype's `.pin` marker)
      const customIcon = L.divIcon({
        className: 'custom-field-pin',
        html: `
          <div style="width: 16px; height: 16px; background-color: ${pinColor}; border: 2px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.35); cursor: pointer;"></div>
        `,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });

      const marker = L.marker([latitude, longitude], { icon: customIcon });

      marker.on('click', () => {
        setSelectedPipeDetails({ pipe, installation, lastMonitoring });
      });

      marker.bindTooltip(`
        <div style="font-family: inherit; padding: 6px 8px; min-width: 160px; background: var(--color-surface); color: var(--color-text-primary); border: 1px solid var(--color-border-light); border-radius: 0;">
          <div style="font-size: 11px; font-weight: 800; color: ${pinColor};">${pipe.Pipe_ID} · ${statusLabel}</div>
          <div style="font-size: 11px; font-weight: 700; margin-top: 2px;">${farmerName}</div>
          <div style="font-size: 10px; color: var(--color-text-secondary);">${village}</div>
        </div>
      `, {
        direction: 'top',
        offset: [0, -10],
      });

      marker.addTo(layerGroup);
      bounds.extend([latitude, longitude]);

      // ── PLOT BOUNDARY POLYGON ──
      if (showBoundaries && installation?.Plot_Boundary && installation.Plot_Boundary.length >= 3) {
        const polygon = L.polygon(installation.Plot_Boundary as L.LatLngExpression[], {
          color: pipe.Status === 'Damaged' ? '#DC2626' : pipe.Status === 'Available' ? '#94A3B8' : '#3F7D20',
          weight: 2,
          fillColor: pipe.Status === 'Damaged' ? '#DC2626' : pipe.Status === 'Available' ? '#94A3B8' : '#3F7D20',
          fillOpacity: 0.12,
          opacity: 0.7,
        });
        polygon.on('click', () => {
          setSelectedPipeDetails({ pipe, installation, lastMonitoring });
        });
        polygon.bindTooltip(`
          <div style="font-family: inherit; padding: 4px 6px; font-size: 10px; font-weight: 700;">
            ${farmerName}'s Plot — ${pipe.Pipe_ID}
          </div>
        `, { direction: 'center', sticky: true });
        polygon.addTo(polygonsGroupRef.current!);
      }
    });

    if (filteredPipes.length > 0 && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
    }
  }, [filteredPipes, showBoundaries]);

  const handleResetBounds = () => {
    if (!mapInstanceRef.current || filteredPipes.length === 0) return;
    const bounds = L.latLngBounds(filteredPipes.map((p) => [p.latitude, p.longitude]));
    if (bounds.isValid()) {
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
    }
  };

  const installedCount = installations.length;
  const availableCount = pipes.filter((p) => p.Status === 'Available').length;
  const damagedCount = pipes.filter((p) => p.Status === 'Damaged').length;

  const filterChip = (label: string, value: typeof statusFilter, count: number) => (
    <button
      onClick={() => setStatusFilter(value)}
      className={`awd-tag ${statusFilter === value ? 'awd-tag-accent' : 'awd-tag-neutral'}`}
      style={{ cursor: 'pointer', border: statusFilter === value ? '2px solid var(--color-accent-500)' : '2px solid transparent' }}
    >
      {label}: {count}
    </button>
  );

  return (
    <div>
      {/* ── HEADER CONTROLS ── */}
      <div className="awd-card" style={{ padding: 16 }}>
        <div className="flex items-center gap-2.5 pb-3" style={{ borderBottom: '1px solid var(--color-border-light)' }}>
          <div className="w-9 h-9 flex items-center justify-center" style={{ background: 'var(--color-accent-500)', color: '#fff' }}>
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <div className="awd-kicker">Field GIS Map</div>
            <h1 className="font-extrabold text-sm">Installed / Available / Damaged pipe tracking</h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-3 pb-1">
          {filterChip('Installed', 'Installed', installedCount)}
          {filterChip('Available', 'Available', availableCount)}
          {filterChip('Damaged', 'Damaged', damagedCount)}
          {filterChip('All', 'All', pipes.length)}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search Farmer, Pipe ID, Village…"
              className="w-full pl-9 pr-3 py-2 text-xs font-semibold outline-none"
              style={{ background: 'var(--color-surface-alt)', border: '1px solid var(--color-border-light)', borderRadius: 0 }}
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="w-full p-2 text-xs font-bold outline-none cursor-pointer"
            style={{ background: 'var(--color-surface-alt)', border: '1px solid var(--color-border-light)', borderRadius: 0 }}
          >
            <option value="All">All Statuses</option>
            <option value="Installed">Installed Only</option>
            <option value="Available">Available Only</option>
            <option value="Damaged">Damaged Only</option>
          </select>

          <select
            value={villageFilter}
            onChange={(e) => setVillageFilter(e.target.value)}
            className="w-full p-2 text-xs font-bold outline-none cursor-pointer"
            style={{ background: 'var(--color-surface-alt)', border: '1px solid var(--color-border-light)', borderRadius: 0 }}
          >
            <option value="All">All Villages ({villages.length})</option>
            {villages.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTileType(tileType === 'streets' ? 'satellite' : 'streets')}
              className="awd-btn-primary flex-1 justify-center"
              style={{ padding: '8px 10px', fontSize: 12 }}
            >
              <Layers className="w-4 h-4" />
              <span>{tileType === 'streets' ? 'Satellite' : 'Street Map'}</span>
            </button>
            <button type="button" onClick={handleResetBounds} title="Fit map bounds to show all pins" className="awd-btn-secondary" style={{ padding: 8 }}>
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setShowBoundaries(v => !v)}
              title={showBoundaries ? 'Hide plot boundaries' : 'Show plot boundaries'}
              className="awd-btn-secondary"
              style={{ padding: 8, background: showBoundaries ? 'var(--color-accent-100)' : undefined }}
            >
              <Hexagon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── MAP CANVAS ── */}
      <div className="relative w-full mapwrap" style={{ height: 620, border: '1px solid var(--color-border-light)', borderTop: 0, background: 'var(--color-surface-alt)' }}>
        <div ref={mapContainerRef} className="w-full h-full z-10" />

        {/* Legend */}
        <div className="absolute bottom-4 left-4 z-20 flex items-center gap-3 flex-wrap awd-card" style={{ padding: '8px 14px', fontSize: 11, fontWeight: 700 }}>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3" style={{ background: 'var(--color-accent-500)' }} /> Installed</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3" style={{ background: 'var(--color-text-muted)' }} /> Available</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3" style={{ background: 'var(--color-danger)' }} /> Damaged</span>
          {showBoundaries && (
            <span className="flex items-center gap-1.5" style={{ borderLeft: '1px solid var(--color-border-light)', paddingLeft: 10 }}>
              <Hexagon className="w-3 h-3" /> Plot boundary
            </span>
          )}
        </div>

        {/* ── SELECTED PLOT DETAIL CARD ── */}
        {selectedPipeDetails && (
          <div className="absolute top-4 right-4 z-30 max-w-sm w-full awd-card" style={{ boxShadow: '0 12px 28px rgba(0,0,0,0.25)', maxHeight: '90%', display: 'flex', flexDirection: 'column' }}>
            <div className="flex items-center justify-between p-3.5 text-white shrink-0" style={{ background: 'var(--color-shell)' }}>
              <div>
                <div className="awd-mono font-black text-sm">{selectedPipeDetails.pipe.Pipe_ID}</div>
                <span className={`awd-tag mt-1 ${
                  selectedPipeDetails.pipe.Status === 'Installed' ? 'awd-tag-accent' :
                  selectedPipeDetails.pipe.Status === 'Damaged' ? 'awd-tag-danger' : 'awd-tag-neutral'
                }`}>
                  {selectedPipeDetails.pipe.Status}
                </span>
              </div>
              <button type="button" onClick={() => setSelectedPipeDetails(null)} className="text-white/70 hover:text-white cursor-pointer" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs overflow-y-auto">
              {selectedPipeDetails.installation ? (
                <>
                  <div className="awd-card" style={{ padding: 12, fontSize: 12 }}>
                    <div className="flex justify-between py-1"><span style={{ color: 'var(--color-text-muted)' }}>Farmer</span><strong>{selectedPipeDetails.installation.Farmer_Name}</strong></div>
                    <div className="flex justify-between py-1 awd-hr"><span style={{ color: 'var(--color-text-muted)' }}>Mobile</span><span className="awd-mono">{selectedPipeDetails.installation.Mobile}</span></div>
                    <div className="flex justify-between py-1 awd-hr"><span style={{ color: 'var(--color-text-muted)' }}>Location</span><strong>{selectedPipeDetails.installation.Village}, {selectedPipeDetails.installation.Mandal}</strong></div>
                    <div className="flex justify-between py-1 awd-hr"><span style={{ color: 'var(--color-text-muted)' }}>Plot size</span><strong>{selectedPipeDetails.installation.Plot_Size} {selectedPipeDetails.installation.Plot_Size_Unit}</strong></div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="awd-card" style={{ padding: 10 }}>
                      <div className="flex items-center gap-1 font-bold mb-0.5"><Sprout className="w-3.5 h-3.5" style={{ color: 'var(--color-accent-600)' }} />Crop</div>
                      <div className="font-bold">{selectedPipeDetails.installation.Crop}</div>
                      <div style={{ color: 'var(--color-text-muted)', fontSize: 10 }}>{selectedPipeDetails.installation.Variety || '—'}</div>
                    </div>
                    <div className="awd-card" style={{ padding: 10 }}>
                      <div className="flex items-center gap-1 font-bold mb-0.5"><Droplet className="w-3.5 h-3.5" style={{ color: 'var(--color-accent-600)' }} />Method</div>
                      <div className="font-bold">{selectedPipeDetails.installation.Establishment_Method}</div>
                      <div style={{ color: 'var(--color-text-muted)', fontSize: 10 }}>{selectedPipeDetails.installation.Irrigation_Source || '—'}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="awd-card" style={{ padding: 10 }}>
                      <div className="flex items-center gap-1 font-bold mb-0.5"><Calendar className="w-3.5 h-3.5" />Installed on</div>
                      <div className="awd-mono font-bold">{selectedPipeDetails.installation.Installation_Date || '—'}</div>
                    </div>
                    <div className="awd-card" style={{ padding: 10 }}>
                      <div className="flex items-center gap-1 font-bold mb-0.5"><UserCheck className="w-3.5 h-3.5" />Installed by</div>
                      <div className="font-bold truncate">{selectedPipeDetails.installation.Installed_By || '—'}</div>
                    </div>
                  </div>

                  {selectedPipeDetails.installation.Photo_URL && (
                    <img src={selectedPipeDetails.installation.Photo_URL} alt="Installation" className="w-full object-cover" style={{ maxHeight: 140, border: '1px solid var(--color-border-light)' }} />
                  )}

                  {selectedPipeDetails.lastMonitoring && (
                    <div className="awd-card" style={{ padding: 12 }}>
                      <div className="awd-kicker">Latest water inspection · {selectedPipeDetails.lastMonitoring.Date}</div>
                      <div className="flex justify-between mt-1"><span>Water depth</span><strong className="awd-mono">{selectedPipeDetails.lastMonitoring.Water_Level}</strong></div>
                      <div className="flex justify-between mt-1">
                        <span>AWD followed</span>
                        <span className={`awd-tag ${selectedPipeDetails.lastMonitoring.AWD_Followed === 'Yes' ? 'awd-tag-accent' : 'awd-tag-warning'}`}>
                          {selectedPipeDetails.lastMonitoring.AWD_Followed}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2" style={{ borderTop: '1px solid var(--color-border-light)' }}>
                    <span className="awd-mono" style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>
                      {selectedPipeDetails.installation.Latitude.toFixed(4)}, {selectedPipeDetails.installation.Longitude.toFixed(4)}
                    </span>
                    <a
                      href={`https://www.google.com/maps?q=${selectedPipeDetails.installation.Latitude},${selectedPipeDetails.installation.Longitude}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 font-bold"
                      style={{ color: 'var(--color-accent-700)' }}
                    >
                      Google Maps<ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </>
              ) : (
                <div className="text-center py-6">
                  <p className="font-semibold">This pipe is currently <strong style={{ color: 'var(--color-warning)' }}>Available / unassigned</strong>.</p>
                  <p style={{ color: 'var(--color-text-muted)' }} className="mt-1">Ready to be scanned and registered to a farmer's plot.</p>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  onSelectPipeForMobile(selectedPipeDetails.pipe.Pipe_ID);
                  setSelectedPipeDetails(null);
                }}
                className="awd-btn-primary w-full justify-center mt-1"
              >
                <Smartphone className="w-4 h-4" />
                Open pipe in mobile app
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── RESULTS LIST ── */}
      <div className="flex items-baseline justify-between px-1 pt-4 pb-1.5">
        <h3 className="font-extrabold text-sm">{filteredPipes.length} plot{filteredPipes.length === 1 ? '' : 's'} in view</h3>
        <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Tap a row to open on the map</span>
      </div>
      <div className="awd-card">
        {filteredPipes.slice(0, 50).map(({ pipe, installation }) => (
          <div
            key={pipe.Pipe_ID}
            className="awd-row"
            onClick={() => setSelectedPipeDetails({ pipe, installation, lastMonitoring: monitoringList.filter(m => m.Pipe_ID === pipe.Pipe_ID).sort((a, b) => new Date(b.Timestamp).getTime() - new Date(a.Timestamp).getTime())[0] })}
          >
            <span className="w-3.5 h-3.5 flex-none" style={{
              background: pipe.Status === 'Installed' ? 'var(--color-accent-500)' : pipe.Status === 'Damaged' ? 'var(--color-danger)' : 'var(--color-text-muted)'
            }} />
            <div className="flex-1 min-w-0">
              <div className="awd-mono font-extrabold" style={{ fontSize: 12.5 }}>{pipe.Pipe_ID}</div>
              <div className="text-xs truncate" style={{ color: 'var(--color-text-secondary)' }}>
                {installation?.Farmer_Name || pipe.Farmer_Name || '—'} · {installation?.Village || pipe.Village || '—'}
              </div>
            </div>
            <MapPin className="w-4 h-4 flex-none" style={{ color: 'var(--color-text-muted)' }} />
          </div>
        ))}
        {filteredPipes.length === 0 && (
          <div className="px-4 py-6 text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>No plots match the current filters.</div>
        )}
      </div>
    </div>
  );
};
