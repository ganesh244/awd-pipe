import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { AWDPipe, Installation, MonitoringRecord } from '../types';
import {
  MapPin, Search, Layers, ShieldCheck, Filter, Smartphone, ExternalLink,
  Calendar, Sprout, UserCheck, Eye, Compass, RefreshCw, Sparkles, Navigation, CheckCircle2, AlertTriangle, Droplet
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

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Installed' | 'Available' | 'Damaged'>('Installed');
  const [villageFilter, setVillageFilter] = useState<string>('All');
  const [tileType, setTileType] = useState<'satellite' | 'streets'>('satellite');
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
      // Assign realistic staggered coordinates around Kandi, Sangareddy area
      // Kandi village actual coords: 17.5812, 78.1084
      const pipeIndex = parseInt(pipe.Pipe_ID.replace(/\D/g, ''), 10) || (idx + 1);
      lat = 17.5700 + ((pipeIndex * 0.008) % 0.12);
      lng = 78.0900 + ((pipeIndex * 0.010) % 0.15);
    } else {
      // Check if coordinates overlap with another pipe
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

  // Render & update markers whenever filteredPipes changes
  useEffect(() => {
    if (!mapInstanceRef.current || !markersGroupRef.current) return;

    const map = mapInstanceRef.current;
    const layerGroup = markersGroupRef.current;
    layerGroup.clearLayers();

    const bounds = L.latLngBounds([]);

    filteredPipes.forEach((item) => {
      const { pipe, installation, lastMonitoring, latitude, longitude } = item;

      let pinColor = '#10b981'; // Emerald
      let pulseColor = 'rgba(16, 185, 129, 0.35)';
      let statusLabel = 'Installed';

      if (pipe.Status === 'Available') {
        pinColor = '#f59e0b'; // Amber
        pulseColor = 'rgba(245, 158, 11, 0.35)';
        statusLabel = 'Available';
      } else if (pipe.Status === 'Damaged') {
        pinColor = '#ef4444'; // Red
        pulseColor = 'rgba(239, 68, 68, 0.35)';
        statusLabel = 'Damaged';
      }

      const farmerName = installation?.Farmer_Name || pipe.Farmer_Name || 'Unassigned Field';
      const village = installation?.Village || pipe.Village || 'Central Depot';

      const customIcon = L.divIcon({
        className: 'custom-field-pin',
        html: `
          <div style="position: relative; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
            <div style="position: absolute; width: 36px; height: 36px; border-radius: 50%; background-color: ${pulseColor}; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            <div style="width: 26px; height: 26px; border-radius: 50%; background-color: ${pinColor}; border: 3px solid #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; z-index: 10;">
              <span style="color: white; font-size: 11px; font-weight: 900;">📍</span>
            </div>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      const marker = L.marker([latitude, longitude], { icon: customIcon });

      marker.on('click', () => {
        setSelectedPipeDetails({ pipe, installation, lastMonitoring });
      });

      marker.bindTooltip(`
        <div style="font-family: inherit; padding: 6px 8px; min-width: 160px; background: #ffffff; color: #0f172a; border-radius: 10px; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px rgba(0,0,0,0.15);">
          <div style="font-size: 11px; font-weight: 900; color: #059669;">${pipe.Pipe_ID} (${statusLabel})</div>
          <div style="font-size: 11px; font-weight: 700; color: #1e293b; margin-top: 2px;">🧑‍🌾 ${farmerName}</div>
          <div style="font-size: 10px; color: #64748b;">📍 ${village}</div>
          <div style="font-size: 9px; color: #0284c7; font-weight: 800; margin-top: 4px;">Click pin to view full inspection card →</div>
        </div>
      `, {
        direction: 'top',
        offset: [0, -10],
      });

      marker.addTo(layerGroup);
      bounds.extend([latitude, longitude]);
    });

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

  const installedCount = installations.length;
  const availableCount = pipes.filter((p) => p.Status === 'Available').length;
  const damagedCount = pipes.filter((p) => p.Status === 'Damaged').length;

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* ── HEADER CONTROLS BAR (EMERALD AGRICULTURAL LIGHT THEME) ── */}
      <div className="bg-white text-slate-900 rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200 space-y-4">
        
        {/* Top Title & Metrics Row */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-900/10">
              <Compass className="w-5 h-5 text-white animate-spin-slow" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black tracking-wide text-slate-900 flex items-center gap-2">
                <span>Interactive Field GIS Map</span>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-300">
                  GPS Active
                </span>
              </h1>
              <p className="text-xs text-slate-500">
                Spatial AWD pipe tracking & field plot inspection across paddy sectors
              </p>
            </div>
          </div>

          {/* KPI Stat Pills */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
            <button
              onClick={() => setStatusFilter('Installed')}
              className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'Installed'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow-xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>Installed: <strong>{installedCount}</strong></span>
            </button>

            <button
              onClick={() => setStatusFilter('Available')}
              className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'Available'
                  ? 'bg-amber-50 text-amber-800 border-amber-300 shadow-xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span>Available: <strong>{availableCount}</strong></span>
            </button>

            <button
              onClick={() => setStatusFilter('Damaged')}
              className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'Damaged'
                  ? 'bg-rose-50 text-rose-800 border-rose-300 shadow-xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span>Damaged: <strong>{damagedCount}</strong></span>
            </button>

            <button
              onClick={() => setStatusFilter('All')}
              className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                statusFilter === 'All'
                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:text-slate-900'
              }`}
            >
              Total: <strong>{pipes.length}</strong>
            </button>
          </div>
        </div>

        {/* ── SEARCH & FILTERS ROW ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search Farmer, Pipe ID, Village..."
              className="w-full pl-9 pr-3 py-2 text-xs font-semibold bg-slate-50 text-slate-900 border border-slate-300 rounded-xl outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 transition"
            />
          </div>

          {/* Status Filter Dropdown */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-emerald-600 shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full p-2 text-xs font-bold bg-slate-50 border border-slate-300 text-slate-800 rounded-xl outline-none focus:border-emerald-500 focus:bg-white transition cursor-pointer"
            >
              <option value="All">All Statuses</option>
              <option value="Installed">🟢 Installed Only</option>
              <option value="Available">🟡 Available Only</option>
              <option value="Damaged">🔴 Damaged Only</option>
            </select>
          </div>

          {/* Village Filter Dropdown */}
          <div className="flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-teal-600 shrink-0" />
            <select
              value={villageFilter}
              onChange={(e) => setVillageFilter(e.target.value)}
              className="w-full p-2 text-xs font-bold bg-slate-50 border border-slate-300 text-slate-800 rounded-xl outline-none focus:border-emerald-500 focus:bg-white transition cursor-pointer"
            >
              <option value="All">All Villages ({villages.length})</option>
              {villages.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          {/* Map Layer Switcher & Bounds Reset */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTileType(tileType === 'streets' ? 'satellite' : 'streets')}
              className="flex-1 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-xs py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm border border-emerald-400/30 cursor-pointer"
            >
              <Layers className="w-4 h-4 text-emerald-100" />
              <span>{tileType === 'streets' ? 'Satellite View' : 'Street Map'}</span>
            </button>

            <button
              type="button"
              onClick={handleResetBounds}
              title="Fit map bounds to show all pins"
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs p-2 rounded-xl transition border border-slate-300 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── MAP CANVAS CONTAINER & DETAILED POPUP OVERLAY ── */}
      <div className="relative w-full h-[620px] rounded-2xl overflow-hidden shadow-sm border border-slate-300 bg-slate-100">
        
        {/* Leaflet DOM Canvas Element */}
        <div ref={mapContainerRef} className="w-full h-full z-10" />

        {/* Map Legend Overlay */}
        <div className="absolute bottom-4 left-4 z-20 bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 shadow-md flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-emerald-700"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Installed</span>
          <span className="flex items-center gap-1.5 text-amber-700"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Available</span>
          <span className="flex items-center gap-1.5 text-rose-700"><span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Damaged</span>
        </div>

        {/* ── FLOATING INSPECTION CARD (Appears when clicking a field pin) ── */}
        {selectedPipeDetails && (
          <div className="absolute top-4 right-4 z-30 max-w-sm w-full bg-white text-slate-900 rounded-2xl shadow-2xl border-2 border-emerald-500/40 overflow-hidden animate-scaleIn">
            
            {/* Card Header */}
            <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 text-white p-3.5 flex items-center justify-between border-b border-emerald-600/30">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-white font-extrabold text-sm shadow-xs">
                  📍
                </div>
                <div>
                  <h3 className="text-sm font-black tracking-wide text-white font-mono flex items-center gap-1.5">
                    <span>{selectedPipeDetails.pipe.Pipe_ID}</span>
                  </h3>
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full inline-block mt-0.5 ${
                    selectedPipeDetails.pipe.Status === 'Installed'
                      ? 'bg-emerald-300 text-emerald-950'
                      : selectedPipeDetails.pipe.Status === 'Available'
                      ? 'bg-amber-300 text-amber-950'
                      : 'bg-rose-400 text-white'
                  }`}>
                    {selectedPipeDetails.pipe.Status}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedPipeDetails(null)}
                className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Card Content Body */}
            <div className="p-4 space-y-3 text-xs text-slate-700 max-h-[460px] overflow-y-auto">
              
              {selectedPipeDetails.installation ? (
                <>
                  {/* Farmer Overview */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-semibold">Farmer Name:</span>
                      <strong className="text-slate-900 font-bold">{selectedPipeDetails.installation.Farmer_Name}</strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-semibold">Mobile:</span>
                      <span className="font-mono text-emerald-700 font-bold">{selectedPipeDetails.installation.Mobile}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-semibold">Location:</span>
                      <strong className="text-slate-800">
                        {selectedPipeDetails.installation.Village}, {selectedPipeDetails.installation.Mandal}
                      </strong>
                    </div>
                    <div className="flex justify-between items-center border-t border-slate-200 pt-1.5 mt-1">
                      <span className="text-slate-500 font-semibold">Plot Size:</span>
                      <strong className="text-emerald-800 font-black">
                        {selectedPipeDetails.installation.Plot_Size} {selectedPipeDetails.installation.Plot_Size_Unit}
                      </strong>
                    </div>
                  </div>

                  {/* Field Crop Info */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-emerald-50/80 p-2.5 rounded-xl border border-emerald-200">
                      <span className="text-emerald-800 font-bold block mb-0.5 flex items-center gap-1">
                        <Sprout className="w-3.5 h-3.5 text-emerald-600" /> Crop / Variety
                      </span>
                      <span className="font-bold text-slate-900">{selectedPipeDetails.installation.Crop}</span>
                      <span className="text-[10px] text-slate-500 block">{selectedPipeDetails.installation.Variety || 'Local'}</span>
                    </div>
                    <div className="bg-teal-50/80 p-2.5 rounded-xl border border-teal-200">
                      <span className="text-teal-800 font-bold block mb-0.5 flex items-center gap-1">
                        <Droplet className="w-3.5 h-3.5 text-teal-600" /> Method
                      </span>
                      <span className="font-bold text-slate-900">{selectedPipeDetails.installation.Establishment_Method}</span>
                      <span className="text-[10px] text-slate-500 block">{selectedPipeDetails.installation.Irrigation_Source || 'Borewell'}</span>
                    </div>
                  </div>

                  {/* Captured Field Installation Photo */}
                  {selectedPipeDetails.installation.Photo_URL && (
                    <div className="space-y-1">
                      <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider block">
                        Field Installation Photo
                      </span>
                      <div className="w-full bg-slate-900 rounded-xl p-1 flex items-center justify-center border border-slate-200 overflow-hidden">
                        <img
                          src={selectedPipeDetails.installation.Photo_URL}
                          alt="Installed Pipe Field Photo"
                          className="max-h-36 max-w-full w-auto object-cover rounded-lg shadow-sm"
                        />
                      </div>
                    </div>
                  )}

                  {/* Latest Inspection Visit */}
                  {selectedPipeDetails.lastMonitoring && (
                    <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-3 space-y-1.5">
                      <span className="text-blue-900 font-bold text-[10px] uppercase tracking-wider block flex items-center justify-between">
                        <span>Latest Water Inspection</span>
                        <span className="font-mono text-[9px] text-blue-700">{selectedPipeDetails.lastMonitoring.Date}</span>
                      </span>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600">Water Depth:</span>
                        <strong className="text-blue-900 font-mono text-xs">{selectedPipeDetails.lastMonitoring.Water_Level}</strong>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600">AWD Followed:</span>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                          selectedPipeDetails.lastMonitoring.AWD_Followed === 'Yes'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}>
                          {selectedPipeDetails.lastMonitoring.AWD_Followed}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Coordinates & Google Maps Link */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
                    <span className="font-mono text-slate-500 text-[11px]">
                      GPS: {selectedPipeDetails.installation.Latitude.toFixed(4)}, {selectedPipeDetails.installation.Longitude.toFixed(4)}
                    </span>
                    <a
                      href={`https://www.google.com/maps?q=${selectedPipeDetails.installation.Latitude},${selectedPipeDetails.installation.Longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-700 font-extrabold hover:underline flex items-center gap-1 text-[11px]"
                    >
                      <span>Google Maps</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </>
              ) : (
                <div className="text-center py-6 space-y-2">
                  <p className="text-slate-700 font-medium">
                    This pipe is currently <strong className="text-amber-700 font-bold">Unassigned / Available</strong>.
                  </p>
                  <p className="text-slate-500 text-xs">
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
                className="w-full bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-700 hover:to-teal-700 text-white font-black py-2.5 px-3 rounded-xl transition shadow-md flex items-center justify-center gap-2 uppercase tracking-wider text-xs border-b-2 border-emerald-900/20 cursor-pointer active:scale-95 mt-2"
              >
                <Smartphone className="w-4 h-4 text-white" />
                <span>Open Pipe in Mobile App</span>
              </button>

            </div>
          </div>
        )}

      </div>
    </div>
  );
};
