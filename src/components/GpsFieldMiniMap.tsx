import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ExternalLink, Layers } from 'lucide-react';

interface GpsFieldMiniMapProps {
  latitude: number;
  longitude: number;
  pipeId?: string;
  zoom?: number;
  boundary?: [number, number][];
}

export const GpsFieldMiniMap: React.FC<GpsFieldMiniMapProps> = ({
  latitude,
  longitude,
  pipeId,
  zoom = 15,
  boundary,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const [tileType, setTileType] = useState<'streets' | 'satellite'>('streets');

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      center: [latitude, longitude],
      zoom,
      zoomControl: true,
      attributionControl: false,
    });

    mapInstanceRef.current = map;

    const streetUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    const satelliteUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

    L.tileLayer(tileType === 'satellite' ? satelliteUrl : streetUrl, {
      maxZoom: 21,
      maxNativeZoom: 18,
    }).addTo(map);

    // Flush square pin — matches the design prototype's `.pin` marker
    const customIcon = L.divIcon({
      className: 'custom-map-pin',
      html: `<div style="width: 16px; height: 16px; background-color: var(--color-accent-500); border: 2px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.35);"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });

    L.marker([latitude, longitude], { icon: customIcon }).addTo(map);

    if (boundary && boundary.length >= 3) {
      L.polygon(boundary as L.LatLngExpression[], {
        color: '#376E1C',
        weight: 2,
        fillColor: '#3F7D20',
        fillOpacity: 0.12,
        opacity: 0.8,
      }).addTo(map);
    }

    setTimeout(() => map.invalidateSize(), 200);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [latitude, longitude, zoom, tileType, pipeId, boundary]);

  return (
    <div className="relative w-full mapwrap" style={{ height: 180, border: '2px solid var(--color-border-light)' }}>
      <div ref={mapContainerRef} className="w-full h-full" />

      <button
        type="button"
        onClick={() => setTileType(tileType === 'streets' ? 'satellite' : 'streets')}
        className="absolute top-2 left-2 z-20 flex items-center gap-1 text-[10px] font-bold text-white px-2 py-1 cursor-pointer"
        style={{ background: 'var(--color-shell)' }}
      >
        <Layers className="w-3 h-3" />
        {tileType === 'streets' ? 'Satellite' : 'Street'}
      </button>

      <div className="absolute bottom-2 left-2 z-20 awd-mono text-white text-[10px] px-2 py-1" style={{ background: 'var(--color-shell)' }}>
        {latitude.toFixed(4)}, {longitude.toFixed(4)}
      </div>

      <a
        href={`https://www.google.com/maps?q=${latitude},${longitude}`}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute top-2 right-2 z-20 text-white font-bold text-[10px] px-2 py-1 flex items-center gap-1"
        style={{ background: 'var(--color-accent-500)' }}
      >
        Google Maps<ExternalLink className="w-3 h-3" />
      </a>
    </div>
  );
};
