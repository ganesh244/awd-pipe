import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { AWDPipe, Installation, MonitoringRecord } from '../types';
import { MapPin, Search, Layers, ShieldCheck, Filter, Smartphone, ExternalLink, Calendar, Sprout, UserCheck, Eye, Compass, RefreshCw } from 'lucide-react';

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

  const [searchTerm, setSearchTerm] = useState('');
  // Default to 'Installed' so installed pipes are shown first upon opening the map
  const [statusFilter, setStatusFilter] = useState<'All' | 'Installed' | 'Available' | 'Damaged'>('Installed');
  const [villageFilter, setVillageFilter] = useState<string>('All');
  const [tileType, setTileType] = useState<'streets' | 'satellite'>('satellite');
  const [selectedPipeDetails, setSelectedPipeDetails] = useState<{
    pipe: AWDPipe;
    installation?: Installation;
    lastMonitoring?: MonitoringRecord;
  } | null>(null);

  // Extract unique villages
  const villages = Array.from(
    new Set(installations.map((i) => i.Village).filter(Boolean))
  );

  // Map of coordinate occurrences to prevent identical coordinate stacking
  const coordCounts = new Map<string, number>();

  // Prepare map markers data combining installations & pipes
  const mapPipes = pipes.map((pipe, idx) => {
    const inst = installations.find((i) => i.Pipe_ID === pipe.Pipe_ID);
    const lastMon = monitoringList
      .filter((m) => m.Pipe_ID === pipe.Pipe_ID)
      .sort((a, b) => new Date(b.Timestamp).getTime() - new Date(a.Timestamp).getTime())[0];

    // Base coordinates
    let lat = inst?.Latitude;
    let lng = inst?.Longitude;

    const hasValidGps = lat && lng && lat !== 0 && lng !== 0;

    if (!hasValidGps) {
      // Assign realistic staggered coordinates around paddy belt
      const pipeIndex = parseInt(pipe.Pipe_ID.replace(/\D/g, ''), 10) || (idx + 1);
      lat = 18.2000 + ((pipeIndex * 0.038) % 0.45);
      lng = 78.9000 + ((pipeIndex * 0.045) % 0.55);
    } else {
      // Check if coordinates overlap with another pipe
      const coordKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
      const count = coordCounts.get(coordKey) || 0;
      coordCounts.set(coordKey, count + 1);

      if (count > 0) {
        // Apply slight staggering (~150 meters offset) so overlapping field markers do not stack directly on top of each other
        const angle = count * (Math.PI / 3);
        const radius = 0.0022 * count;
        lat = lat + Math.sin(angle) * radius;
        lng = lng + Math.cos(angle) * radius;
      }
    }

    return {
      pipe,
      installation: inst,
      lastMonitoring: lastMon,
      latitude: lat,
      longitude: lng,
    };
  });

  // Filter pipes
  const filteredPipes = mapPipes.filter((mp) => {
    const matchesSearch =
      mp.pipe.Pipe_ID.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (mp.installation?.Farmer_Name || mp.pipe.Farmer_Name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (mp.installation?.Village || mp.pipe.Village || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'All' || mp.pipe.Status === statusFilter;
    const matchesVillage = villageFilter === 'All' || mp.installation?.Village === villageFilter;

    return matchesSearch && matchesStatus && matchesVillage;
  });

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    // Default center Telangana region
    const map = L.map(mapContainerRef.current, {
      center: [18.4386, 79.1288],
      zoom: 9,
      attributionControl: false,
    });

    mapInstanceRef.current = map;

    const streetUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    const satelliteUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

    L.tileLayer(tileType === 'satellite' ? satelliteUrl : streetUrl, {
      maxZoom: 19,
    }).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);
    markersGroupRef.current = layerGroup;

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

    // Remove existing tile layers
    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        map.removeLayer(layer);
      }
    });

    const streetUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    const satelliteUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

    L.tileLayer(tileType === 'satellite' ? satelliteUrl : streetUrl, {
      maxZoom: 19,
    }).addTo(map);
  }, [tileType]);

  // Render & update markers whenever filteredPipes changes
  useEffect(() => {
    if (!mapInstanceRef.current || !markersGroupRef.current) return;

    const map = mapInstanceRef.current;
    const layerGroup = markersGroupRef.current;
    layerGroup.clearLayers();

    const bounds = L.latLngBounds([]);

    filteredPipes.forEach((item) => {
      const { pipe, installation, lastMonitoring, latitude, longitude } = item;

      // Color coding based on status
      let pinColor = '#10b981'; // Emerald for Installed
      let pulseColor = 'rgba(16, 185, 129, 0.4)';
      let statusLabel = 'Installed';

      if (pipe.Status === 'Available') {
        pinColor = '#f59e0b'; // Amber for Available
        pulseColor = 'rgba(245, 158, 11, 0.3)';
        statusLabel = 'Available';
      } else if (pipe.Status === 'Damaged') {
        pinColor = '#ef4444'; // Red for Damaged
        pulseColor = 'rgba(239, 68, 68, 0.3)';
        statusLabel = 'Damaged';
      }

      const farmerName = installation?.Farmer_Name || pipe.Farmer_Name || 'Unassigned Field';
      const village = installation?.Village || pipe.Village || 'Central Depot';

      // Custom Leaflet DivIcon with pulsing aura
      const customIcon = L.divIcon({
        className: 'custom-field-pin',
        html: `
          <div style="position: relative; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
            <div style="position: absolute; width: 36px; height: 36px; border-radius: 50%; background-color: ${pulseColor}; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            <div style="width: 24px; height: 24px; border-radius: 50%; background-color: ${pinColor}; border: 3px solid #ffffff; box-shadow: 0 4px 8px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 10;">
              <span style="color: white; font-size: 10px; font-weight: 900;">📍</span>
            </div>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      const marker = L.marker([latitude, longitude], { icon: customIcon });

      // Click event: Select pipe to show full detail overlay card
      marker.on('click', () => {
        setSelectedPipeDetails({ pipe, installation, lastMonitoring });
      });

      // Hover Tooltip: Popup preview
      marker.bindTooltip(`
        <div style="font-family: sans-serif; padding: 4px; min-width: 150px;">
          <div style="font-size: 11px; font-weight: 800; color: #1e293b;">${pipe.Pipe_ID} (${statusLabel})</div>
          <div style="font-size: 11px; font-weight: 600; color: #047857;">🧑‍🌾 ${farmerName}</div>
          <div style="font-size: 10px; color: #64748b;">📍 ${village}</div>
          <div style="font-size: 9px; color: #10b981; font-weight: bold; margin-top: 2px;">Click marker to open full inspection card →</div>
        </div>
      `, {
        direction: 'top',
        offset: [0, -10],
      });

      marker.addTo(layerGroup);
      bounds.extend([latitude, longitude]);
    });

    // Fit map bounds if markers exist
    if (filteredPipes.length > 0 && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
    }
  }, [filteredPipes]);

  const handleResetBounds = () => {
    if (!mapInstanceRef.current || filteredPipes.length === 0) return;
    const bounds = L.latLngBounds(filteredPipes.map((p) => [p.latitude, p.longitude]));
    if (bounds.isValid()) {
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
    }
  };

  return (
    <div className="space-y-4">
      {/* HEADER CONTROLS BAR */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-[#2d4a2d] text-white flex items-center justify-center font-bold">
                <Compass className="w-5 h-5 text-[#88b04b]" />
              </span>
              <div>
                <h1 className="text-base font-bold text-slate-800 uppercase tracking-wide">
                  Interactive AWD Pipe Field Map
                </h1>
                <p className="text-xs text-slate-500">
                  Real-time GPS mapping & pipe details across paddy fields
                </p>
              </div>
            </div>
          </div>

          {/* Quick Stats Pills */}
          <div className="flex items-center gap-2 text-xs font-semibold">
            <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <strong>{installations.length}</strong> Installed Pipes
            </span>
            <span className="bg-amber-50 text-amber-800 border border-amber-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <strong>{pipes.filter((p) => p.Status === 'Available').length}</strong> Available
            </span>
            <span className="bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200">
              Total: <strong>{pipes.length}</strong> Pipes
            </span>
          </div>
        </div>

        {/* SEARCH & FILTERS ROW */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search Farmer Name, Pipe ID, Village..."
              className="w-full pl-9 pr-3 py-2 text-xs font-medium border border-slate-300 rounded-lg outline-none focus:border-[#88b04b]"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full p-2 text-xs font-bold border border-slate-300 rounded-lg outline-none focus:border-[#88b04b] bg-white text-slate-800"
            >
              <option value="All">All Statuses</option>
              <option value="Installed">🟢 Installed Only</option>
              <option value="Available">🟡 Available Only</option>
              <option value="Damaged">🔴 Damaged Only</option>
            </select>
          </div>

          {/* Village Filter */}
          <div className="flex items-center gap-1">
            <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={villageFilter}
              onChange={(e) => setVillageFilter(e.target.value)}
              className="w-full p-2 text-xs font-bold border border-slate-300 rounded-lg outline-none focus:border-[#88b04b] bg-white text-slate-800"
            >
              <option value="All">All Villages</option>
              {villages.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          {/* Map Layer Switcher & Reset */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTileType(tileType === 'streets' ? 'satellite' : 'streets')}
              className="flex-1 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs py-2 px-3 rounded-lg transition flex items-center justify-center gap-1.5"
            >
              <Layers className="w-3.5 h-3.5 text-[#88b04b]" />
              {tileType === 'streets' ? 'Satellite View' : 'Map View'}
            </button>

            <button
              type="button"
              onClick={handleResetBounds}
              title="Fit map to show all pins"
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs p-2 rounded-lg transition border border-slate-300"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* MAP CANVAS CONTAINER & DETAILED POPUP OVERLAY */}
      <div className="relative w-full h-[580px] rounded-2xl overflow-hidden shadow-lg border-2 border-slate-300 bg-slate-200">
        
        {/* Leaflet DOM Element */}
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* FLOATING INSPECTION CARD (Appears when pointing / clicking a map pin) */}
        {selectedPipeDetails && (
          <div className="absolute top-4 right-4 z-30 max-w-sm w-full bg-white rounded-2xl shadow-2xl border-2 border-[#88b04b] overflow-hidden animate-scaleIn">
            
            {/* Card Top Header */}
            <div className="bg-[#2d4a2d] text-white p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-[#88b04b] text-slate-900 font-extrabold flex items-center justify-center text-xs">
                  📍
                </span>
                <div>
                  <h3 className="text-sm font-bold tracking-wide text-white font-mono">
                    {selectedPipeDetails.pipe.Pipe_ID}
                  </h3>
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full inline-block mt-0.5 ${
                    selectedPipeDetails.pipe.Status === 'Installed'
                      ? 'bg-emerald-400 text-slate-950'
                      : selectedPipeDetails.pipe.Status === 'Available'
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-red-400 text-white'
                  }`}>
                    {selectedPipeDetails.pipe.Status}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedPipeDetails(null)}
                className="text-slate-300 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            {/* Card Content */}
            <div className="p-4 space-y-3 text-xs text-slate-700 max-h-[420px] overflow-y-auto">
              
              {selectedPipeDetails.installation ? (
                <>
                  {/* Farmer Details */}
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-semibold">Farmer Name:</span>
                      <strong className="text-slate-900 font-bold">{selectedPipeDetails.installation.Farmer_Name}</strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-semibold">Mobile:</span>
                      <span className="font-mono text-slate-800">{selectedPipeDetails.installation.Mobile}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-semibold">Location:</span>
                      <strong className="text-slate-800">
                        {selectedPipeDetails.installation.Village}, {selectedPipeDetails.installation.Mandal}
                      </strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-semibold">Plot Size:</span>
                      <strong className="text-emerald-800">
                        {selectedPipeDetails.installation.Plot_Size} {selectedPipeDetails.installation.Plot_Size_Unit}
                      </strong>
                    </div>
                  </div>

                  {/* Field Crop Info */}
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                      <span className="text-emerald-800 font-bold block mb-0.5">🌾 Crop / Variety</span>
                      <span className="font-semibold">{selectedPipeDetails.installation.Crop} ({selectedPipeDetails.installation.Variety})</span>
                    </div>
                    <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                      <span className="text-emerald-800 font-bold block mb-0.5">💧 Method</span>
                      <span className="font-semibold">{selectedPipeDetails.installation.Establishment_Method}</span>
                    </div>
                  </div>

                  {/* Captured Photo if existing */}
                  {selectedPipeDetails.installation.Photo_URL && (
                    <div>
                      <span className="text-slate-500 text-[10px] font-bold block uppercase mb-1">
                        Field Pipe Installation Photo:
                      </span>
                      <div className="w-full bg-slate-900 rounded-xl p-1 flex items-center justify-center min-h-[120px] max-h-44 border border-slate-800">
                        <img
                          src={selectedPipeDetails.installation.Photo_URL}
                          alt="Installed Pipe"
                          className="max-h-40 max-w-full w-auto object-contain rounded-lg shadow-sm"
                        />
                      </div>
                    </div>
                  )}

                  {/* Last Water Level Visit */}
                  {selectedPipeDetails.lastMonitoring && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-2.5 space-y-1">
                      <span className="text-blue-900 font-bold text-[10px] uppercase block">
                        Latest Water Level Inspection:
                      </span>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Water Depth:</span>
                        <strong className="text-blue-800 font-mono">{selectedPipeDetails.lastMonitoring.Water_Level}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Crop Stage:</span>
                        <strong className="text-slate-800">{selectedPipeDetails.lastMonitoring.Crop_Stage}</strong>
                      </div>
                    </div>
                  )}

                  {/* Coordinates & Direct Maps Link */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200 text-[11px]">
                    <span className="font-mono text-slate-500">
                      GPS: {selectedPipeDetails.installation.Latitude.toFixed(4)}, {selectedPipeDetails.installation.Longitude.toFixed(4)}
                    </span>
                    <a
                      href={`https://www.google.com/maps?q=${selectedPipeDetails.installation.Latitude},${selectedPipeDetails.installation.Longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-700 font-bold hover:underline flex items-center gap-0.5"
                    >
                      Google Maps ↗
                    </a>
                  </div>
                </>
              ) : (
                <div className="text-center py-4 space-y-2">
                  <p className="text-slate-600">
                    This pipe is currently <strong className="text-amber-700 font-bold">Unregistered / Available</strong>.
                  </p>
                  <p className="text-slate-400 text-[11px]">
                    Ready to be scanned and registered to a farmer's plot in the Field Mobile App.
                  </p>
                </div>
              )}

              {/* Action Button */}
              <button
                type="button"
                onClick={() => {
                  onSelectPipeForMobile(selectedPipeDetails.pipe.Pipe_ID);
                  setSelectedPipeDetails(null);
                }}
                className="w-full bg-[#2d4a2d] hover:bg-[#1a2d1a] text-white font-bold py-2.5 px-3 rounded-xl transition shadow-md flex items-center justify-center gap-2 uppercase tracking-wider text-xs border-b-2 border-black/20"
              >
                <Smartphone className="w-4 h-4 text-[#88b04b]" />
                Open Pipe in Mobile App
              </button>

            </div>
          </div>
        )}

      </div>
    </div>
  );
};
