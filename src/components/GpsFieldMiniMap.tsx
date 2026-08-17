import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { ExternalLink, Layers, MapPin, Maximize2 } from 'lucide-react';

interface GpsFieldMiniMapProps {
  latitude: number;
  longitude: number;
  pipeId?: string;
  zoom?: number;
}

export const GpsFieldMiniMap: React.FC<GpsFieldMiniMapProps> = ({
  latitude,
  longitude,
  pipeId,
  zoom = 15,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [tileType, setTileType] = useState<'streets' | 'satellite'>('streets');

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Destroy prior map instance if existing
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    // Initialize Leaflet map
    const map = L.map(mapContainerRef.current, {
      center: [latitude, longitude],
      zoom: zoom,
      zoomControl: true,
      attributionControl: false,
    });

    mapInstanceRef.current = map;

    // Tile layer URLs
    const streetUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    const satelliteUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

    const tileLayer = L.tileLayer(tileType === 'satellite' ? satelliteUrl : streetUrl, {
      maxZoom: 21,
      maxNativeZoom: 18, // prevent blank tiles at high zoom in rural areas
    });

    tileLayer.addTo(map);

    // Custom pulse marker icon
    const customIcon = L.divIcon({
      className: 'custom-map-pin',
      html: `
        <div style="position: relative; width: 32px; height: 32px; display: flex; items-center; justify-content: center;">
          <div style="position: absolute; width: 32px; height: 32px; border-radius: 50%; background-color: rgba(239, 68, 68, 0.4); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="width: 20px; height: 20px; border-radius: 50%; background-color: #ef4444; border: 3px solid #ffffff; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3); z-index: 10;"></div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    const marker = L.marker([latitude, longitude], { icon: customIcon }).addTo(map);
    markerRef.current = marker;

    if (pipeId) {
      marker.bindPopup(`
        <div style="font-family: sans-serif; font-size: 12px; font-weight: bold; color: #1e293b;">
          📍 AWD Field Pipe: <span style="color: emerald-700;">${pipeId}</span><br/>
          <span style="font-size: 10px; color: #64748b;">Lat: ${latitude}, Lng: ${longitude}</span>
        </div>
      `);
    }

    // Invalidate size on container render
    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [latitude, longitude, zoom, tileType, pipeId]);

  return (
    <div className="relative w-full h-44 rounded-xl overflow-hidden border-2 border-emerald-400 shadow-sm group">
      {/* Map DOM Element */}
      <div ref={mapContainerRef} className="w-full h-full bg-slate-200" />

      {/* Satellite / Street Layer Toggle */}
      <div className="absolute top-2 left-2 z-20 flex items-center gap-1 bg-black/70 backdrop-blur-xs p-1 rounded-lg border border-white/20">
        <button
          type="button"
          onClick={() => setTileType(tileType === 'streets' ? 'satellite' : 'streets')}
          className="text-xs font-bold text-white px-2 py-0.5 rounded flex items-center gap-1 hover:bg-white/20 transition active:scale-[0.97] transition-transform"
        >
          <Layers className="w-3 h-3 text-[emerald-600]" />
          {tileType === 'streets' ? 'Switch Satellite' : 'Switch Map'}
        </button>
      </div>

      {/* Live Pin Overlay Banner */}
      <div className="absolute bottom-2 left-2 z-20 bg-slate-900/80 backdrop-blur-xs text-white text-xs font-mono px-2 py-1 rounded-md border border-white/20 shadow flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span>GPS: {latitude.toFixed(4)}, {longitude.toFixed(4)}</span>
      </div>

      {/* Full Google Maps Direct Link */}
      <a
        href={`https://www.google.com/maps?q=${latitude},${longitude}`}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute top-2 right-2 z-20 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs px-2.5 py-1 rounded-md transition shadow flex items-center gap-1 border border-emerald-500/50"
      >
        <span>Open Google Maps</span>
        <ExternalLink className="w-3 h-3 text-emerald-200" />
      </a>
    </div>
  );
};
