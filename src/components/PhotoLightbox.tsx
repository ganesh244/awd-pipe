import React, { useEffect, useCallback, useState } from 'react';
import { X, ZoomIn, ZoomOut, RotateCw, RefreshCw, Maximize2, Download, ExternalLink, ShieldCheck } from 'lucide-react';

interface PhotoLightboxProps {
  url: string;
  caption?: string;
  onClose: () => void;
}

export const PhotoLightbox: React.FC<PhotoLightboxProps> = ({ url, caption, onClose }) => {
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.3, 3));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.3, 0.5));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);
  const handleReset = () => {
    setZoom(1);
    setRotation(0);
  };

  // Close on ESC key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleKeyDown]);

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = url;
    a.download = caption ? `${caption.replace(/\s+/g, '_')}.jpg` : 'field_photo_hd.jpg';
    a.target = '_blank';
    a.click();
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-slate-950/90 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={caption ?? 'Full Resolution Field Photo'}
    >
      {/* Lightbox Panel */}
      <div
        className="relative max-w-6xl w-full max-h-[92vh] flex flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Action Bar */}
        <div className="w-full flex items-center justify-between px-2 py-1 bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-700/60 shadow-xl">
          <div className="flex items-center gap-2 overflow-hidden mr-2">
            <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs font-black px-2 py-0.5 rounded-full flex items-center gap-1 uppercase tracking-wider shrink-0">
              <ShieldCheck className="w-3 h-3" /> Full HD Picture
            </span>
            {caption && (
              <span className="text-slate-100 text-xs sm:text-sm font-extrabold truncate">{caption}</span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Zoom Controls */}
            <div className="flex items-center bg-slate-800 rounded-xl p-1 border border-slate-700">
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={zoom <= 0.5}
                className="p-1.5 hover:bg-slate-700 disabled:opacity-40 text-slate-200 rounded-lg transition cursor-pointer"
                title="Zoom Out (-)"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs font-mono font-bold text-emerald-400 px-2 min-w-[45px] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={handleZoomIn}
                disabled={zoom >= 3}
                className="p-1.5 hover:bg-slate-700 disabled:opacity-40 text-slate-200 rounded-lg transition cursor-pointer"
                title="Zoom In (+)"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>

            {/* Rotate Button */}
            <button
              type="button"
              onClick={handleRotate}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
              title="Rotate 90°"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            {/* Reset Button */}
            {(zoom !== 1 || rotation !== 0) && (
              <button
                type="button"
                onClick={handleReset}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 transition cursor-pointer flex items-center gap-1 text-xs font-bold"
                title="Reset View"
              >
                <RefreshCw className="w-3.5 h-3.5" /> 100%
              </button>
            )}

            {/* Open Original */}
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
              title="Open full resolution in new tab"
            >
              <ExternalLink className="w-4 h-4" />
            </a>

            {/* Download */}
            <button
              type="button"
              onClick={handleDownload}
              className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition cursor-pointer shadow-lg shadow-emerald-900/40"
              title="Download Full HD Image"
            >
              <Download className="w-4 h-4" />
            </button>

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-red-600/80 hover:bg-red-600 text-white transition cursor-pointer ml-1"
              title="Close (ESC)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* High Definition Interactive Image Canvas Box */}
        <div className="w-full h-[78vh] overflow-auto rounded-2xl border border-slate-800 shadow-2xl bg-slate-950 flex items-center justify-center p-4 relative">
          <div
            className="transition-transform duration-200 flex items-center justify-center max-w-full max-h-full"
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
              transformOrigin: 'center center',
            }}
          >
            <img
              src={url}
              alt={caption ?? 'Full Resolution Field photo'}
              className="max-w-full max-h-[72vh] object-contain rounded-lg shadow-2xl select-none"
              style={{ display: 'block' }}
            />
          </div>
        </div>

        {/* Bottom Bar Info */}
        <div className="w-full flex items-center justify-between text-xs text-slate-400 font-medium px-2">
          <span>Use zoom controls or scroll to view fine details • Double-click or click ESC to exit</span>
          <span className="font-mono text-emerald-400">High Definition Picture Mode</span>
        </div>
      </div>
    </div>
  );
};
