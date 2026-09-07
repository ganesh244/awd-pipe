import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin, Undo2, Trash2, Check, Layers, PenTool, Move, Info, Maximize2
} from 'lucide-react';

interface PlotBoundaryDrawMapProps {
  centerLat: number;
  centerLng: number;
  boundary: [number, number][] | undefined;
  onBoundaryChange: (boundary: [number, number][] | undefined) => void;
}

/**
 * Calculate polygon area in acres using the Shoelace formula
 * with haversine-based coordinate-to-meter conversion
 */
const calculatePolygonAreaAcres = (coords: [number, number][]): number => {
  if (coords.length < 3) return 0;

  // Convert lat/lng to meters relative to the centroid
  const toRadians = (d: number) => (d * Math.PI) / 180;
  const centroidLat = coords.reduce((s, c) => s + c[0], 0) / coords.length;
  const metersPerDegreeLat = 111320;
  const metersPerDegreeLng = 111320 * Math.cos(toRadians(centroidLat));

  const points = coords.map(([lat, lng]) => ({
    x: (lng - coords[0][1]) * metersPerDegreeLng,
    y: (lat - coords[0][0]) * metersPerDegreeLat,
  }));

  // Shoelace formula
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  area = Math.abs(area) / 2;

  // Convert m² → acres (1 acre = 4046.86 m²)
  return area / 4046.86;
};

export const PlotBoundaryDrawMap: React.FC<PlotBoundaryDrawMapProps> = ({
  centerLat,
  centerLng,
  boundary,
  onBoundaryChange,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const polygonLayerRef = useRef<L.Polygon | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const polylineLayerRef = useRef<L.Polyline | null>(null);
  const centerMarkerRef = useRef<L.Marker | null>(null);

  const [drawingPoints, setDrawingPoints] = useState<[number, number][]>(boundary || []);
  const [isDrawing, setIsDrawing] = useState(!boundary || boundary.length === 0);
  const [isClosed, setIsClosed] = useState(!!boundary && boundary.length >= 3);
  const [tileType, setTileType] = useState<'satellite' | 'streets'>('satellite');

  const drawingPointsRef = useRef(drawingPoints);
  drawingPointsRef.current = drawingPoints;
  const isDrawingRef = useRef(isDrawing);
  isDrawingRef.current = isDrawing;
  const isClosedRef = useRef(isClosed);
  isClosedRef.current = isClosed;

  const computedArea = isClosed && drawingPoints.length >= 3
    ? calculatePolygonAreaAcres(drawingPoints)
    : 0;

  // ── Render vertices + polyline/polygon on the map ──
  const renderOverlays = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const pts = drawingPointsRef.current;

    // Clear old overlays
    markersLayerRef.current?.clearLayers();
    if (polylineLayerRef.current) { map.removeLayer(polylineLayerRef.current); polylineLayerRef.current = null; }
    if (polygonLayerRef.current) { map.removeLayer(polygonLayerRef.current); polygonLayerRef.current = null; }

    if (pts.length === 0) return;

    // Draw vertex markers
    pts.forEach(([lat, lng], idx) => {
      const isFirst = idx === 0;
      const isLast = idx === pts.length - 1;
      const vertexIcon = L.divIcon({
        className: 'plot-vertex',
        html: `
          <div style="
            width: ${isFirst ? 18 : 14}px;
            height: ${isFirst ? 18 : 14}px;
            border-radius: 50%;
            background: ${isFirst ? '#10b981' : isLast && !isClosedRef.current ? '#f59e0b' : '#0ea5e9'};
            border: 3px solid white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.35);
            cursor: ${isFirst && pts.length >= 3 && !isClosedRef.current ? 'pointer' : 'default'};
          "></div>
        `,
        iconSize: [isFirst ? 18 : 14, isFirst ? 18 : 14],
        iconAnchor: [isFirst ? 9 : 7, isFirst ? 9 : 7],
      });
      const marker = L.marker([lat, lng], { icon: vertexIcon, interactive: isFirst && pts.length >= 3 && !isClosedRef.current });
      if (isFirst && pts.length >= 3 && !isClosedRef.current) {
        marker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          closePoly();
        });
        marker.bindTooltip('Click to close polygon', { direction: 'top', offset: [0, -12], className: 'plot-tooltip' });
      }
      marker.addTo(markersLayerRef.current!);
    });

    if (isClosedRef.current && pts.length >= 3) {
      // Filled polygon
      polygonLayerRef.current = L.polygon(pts, {
        color: '#10b981',
        weight: 2.5,
        fillColor: '#10b981',
        fillOpacity: 0.18,
        dashArray: undefined,
      }).addTo(map);
    } else if (pts.length >= 2) {
      // Open polyline
      polylineLayerRef.current = L.polyline(pts, {
        color: '#0ea5e9',
        weight: 2.5,
        dashArray: '8, 6',
        opacity: 0.85,
      }).addTo(map);
    }
  }, []);

  const closePoly = useCallback(() => {
    if (drawingPointsRef.current.length < 3) return;
    setIsClosed(true);
    setIsDrawing(false);
    onBoundaryChange([...drawingPointsRef.current]);
    setTimeout(renderOverlays, 0);
  }, [onBoundaryChange, renderOverlays]);

  // ── Initialize map ──
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      center: [centerLat, centerLng],
      zoom: 18,
      attributionControl: false,
      zoomControl: true,
    });
    mapInstanceRef.current = map;

    const satelliteUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    const streetUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    L.tileLayer(tileType === 'satellite' ? satelliteUrl : streetUrl, {
      maxZoom: 21,
      maxNativeZoom: 18,
    }).addTo(map);

    // Center marker (pipe location)
    const centerIcon = L.divIcon({
      className: 'center-pin',
      html: `
        <div style="position: relative; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; width: 28px; height: 28px; border-radius: 50%; background: rgba(239, 68, 68, 0.3); animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="width: 16px; height: 16px; border-radius: 50%; background: #ef4444; border: 3px solid white; box-shadow: 0 3px 10px rgba(0,0,0,0.4); z-index: 10;"></div>
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
    centerMarkerRef.current = L.marker([centerLat, centerLng], { icon: centerIcon, interactive: false }).addTo(map);
    centerMarkerRef.current.bindTooltip('📍 Pipe Installation Point', { direction: 'top', offset: [0, -14], permanent: false });

    // Layer group for vertex markers
    markersLayerRef.current = L.layerGroup().addTo(map);

    // Map click handler for drawing
    map.on('click', (e: L.LeafletMouseEvent) => {
      if (!isDrawingRef.current || isClosedRef.current) return;
      const newPt: [number, number] = [e.latlng.lat, e.latlng.lng];
      setDrawingPoints((prev) => {
        const next = [...prev, newPt];
        drawingPointsRef.current = next;
        setTimeout(renderOverlays, 0);
        return next;
      });
    });

    setTimeout(() => {
      map.invalidateSize();
      renderOverlays();
    }, 250);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-render overlays when points change
  useEffect(() => {
    renderOverlays();
  }, [drawingPoints, isClosed, renderOverlays]);

  // Update tiles
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) map.removeLayer(layer);
    });
    const satelliteUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    const streetUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    L.tileLayer(tileType === 'satellite' ? satelliteUrl : streetUrl, {
      maxZoom: 21, maxNativeZoom: 18,
    }).addTo(map);
  }, [tileType]);

  const handleUndo = () => {
    if (isClosed) return;
    setDrawingPoints((prev) => {
      const next = prev.slice(0, -1);
      drawingPointsRef.current = next;
      return next;
    });
  };

  const handleClearAll = () => {
    setDrawingPoints([]);
    drawingPointsRef.current = [];
    setIsClosed(false);
    setIsDrawing(true);
    onBoundaryChange(undefined);
  };

  const handleReEdit = () => {
    setIsClosed(false);
    setIsDrawing(true);
    onBoundaryChange(undefined);
  };

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <PenTool className="w-3.5 h-3.5 text-emerald-600" />
          Draw Plot Boundary
          <span className="text-[10px] font-semibold text-slate-400 ml-1">(Optional)</span>
        </label>
        {isClosed && computedArea > 0 && (
          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            ≈ {computedArea.toFixed(2)} acres
          </span>
        )}
      </div>

      {/* Instructions */}
      {isDrawing && !isClosed && (
        <div className="flex items-start gap-1.5 text-[10px] text-slate-500 bg-blue-50 border border-blue-100 rounded-lg px-2.5 py-1.5">
          <Info className="w-3 h-3 text-blue-500 shrink-0 mt-0.5" />
          <span>
            {drawingPoints.length === 0
              ? 'Tap on the map to place corner points around your plot boundary.'
              : drawingPoints.length < 3
                ? `${3 - drawingPoints.length} more point${3 - drawingPoints.length > 1 ? 's' : ''} needed to form a polygon. Keep tapping.`
                : 'Tap the green starting point or click "Close Polygon" to finish.'}
          </span>
        </div>
      )}

      {/* Map */}
      <div className="relative w-full h-56 sm:h-64 rounded-xl overflow-hidden border-2 border-slate-200 shadow-sm">
        <div ref={mapContainerRef} className="w-full h-full z-10" />

        {/* Map Controls Overlay */}
        <div className="absolute top-2 left-2 z-20 flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => setTileType(t => t === 'satellite' ? 'streets' : 'satellite')}
            className="bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 hover:bg-black/80 transition border border-white/10"
          >
            <Layers className="w-3 h-3" />
            {tileType === 'satellite' ? 'Street' : 'Satellite'}
          </button>
        </div>

        {/* Drawing Mode Indicator */}
        <div className={`absolute top-2 right-2 z-20 text-[10px] font-extrabold px-2.5 py-1 rounded-lg border flex items-center gap-1.5 ${
          isClosed
            ? 'bg-emerald-500/90 text-white border-emerald-400/30'
            : isDrawing
              ? 'bg-amber-500/90 text-white border-amber-400/30 animate-pulse'
              : 'bg-slate-500/90 text-white border-slate-400/30'
        }`}>
          {isClosed ? (
            <><Check className="w-3 h-3" /> Boundary Set</>
          ) : (
            <><PenTool className="w-3 h-3" /> Drawing Mode</>
          )}
        </div>

        {/* Points Count */}
        {drawingPoints.length > 0 && (
          <div className="absolute bottom-2 left-2 z-20 bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-lg border border-white/10">
            {drawingPoints.length} point{drawingPoints.length !== 1 ? 's' : ''}
            {isClosed ? ' (closed)' : ''}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        {!isClosed && (
          <>
            <button
              type="button"
              onClick={handleUndo}
              disabled={drawingPoints.length === 0}
              className="flex-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 font-bold text-xs py-2 px-3 rounded-lg transition flex items-center justify-center gap-1.5 min-h-[40px] border border-slate-200"
            >
              <Undo2 className="w-3.5 h-3.5" /> Undo
            </button>
            <button
              type="button"
              onClick={closePoly}
              disabled={drawingPoints.length < 3}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs py-2 px-3 rounded-lg transition flex items-center justify-center gap-1.5 min-h-[40px] shadow-sm"
            >
              <Check className="w-3.5 h-3.5" /> Close Polygon
            </button>
          </>
        )}
        {isClosed && (
          <button
            type="button"
            onClick={handleReEdit}
            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2 px-3 rounded-lg transition flex items-center justify-center gap-1.5 min-h-[40px] border border-slate-200"
          >
            <PenTool className="w-3.5 h-3.5" /> Re-draw Boundary
          </button>
        )}
        <button
          type="button"
          onClick={handleClearAll}
          disabled={drawingPoints.length === 0}
          className="bg-red-50 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed text-red-600 font-bold text-xs py-2 px-3 rounded-lg transition flex items-center justify-center gap-1.5 min-h-[40px] border border-red-200"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
