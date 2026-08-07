import React, { useState, useEffect, useRef } from 'react';
import { AWDPipe } from '../types';
import jsQR from 'jsqr';
import { QrCode, Camera, CheckCircle2, X, Search, Sparkles, Smartphone, ShieldCheck, AlertCircle, RefreshCw, Upload, Image as ImageIcon, Volume2 } from 'lucide-react';

interface QrCodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  pipes: AWDPipe[];
  onSelectPipe: (pipeId: string) => void;
}

export const QrCodeScannerModal: React.FC<QrCodeScannerModalProps> = ({
  isOpen,
  onClose,
  pipes,
  onSelectPipe,
}) => {
  const [manualCode, setManualCode] = useState('');
  const [scannedPipe, setScannedPipe] = useState<AWDPipe | null>(null);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);

  // Camera stream states
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isScanning, setIsScanning] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Stop camera stream when modal closes or unmounts
  const stopCameraStream = () => {
    setIsScanning(false);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setIsCameraActive(false);
  };

  useEffect(() => {
    if (isOpen) {
      setManualCode('');
      setScannedPipe(null);
      setScanSuccess(false);
      setScannerError(null);
      setCameraError(null);
      startCamera(facingMode);
    } else {
      stopCameraStream();
    }
    return () => {
      stopCameraStream();
    };
  }, [isOpen, facingMode]);

  // Synchronize stream with video element whenever camera becomes active
  useEffect(() => {
    if (isCameraActive && mediaStreamRef.current && videoRef.current) {
      if (videoRef.current.srcObject !== mediaStreamRef.current) {
        videoRef.current.srcObject = mediaStreamRef.current;
      }
      videoRef.current.setAttribute('playsinline', 'true');
      videoRef.current.play().catch((e) => console.log('Video play error:', e));
    }
  }, [isCameraActive]);

  // Start live camera video stream
  const startCamera = async (mode: 'environment' | 'user') => {
    stopCameraStream();
    setCameraError(null);

    // Check if mediaDevices API is available (blocked on HTTP over LAN in some browsers)
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError(
        'Live webcam feed is blocked by browser security (requires localhost or HTTPS). Please use the "Upload QR Photo" button below or type the code.'
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      mediaStreamRef.current = stream;
      setIsCameraActive(true);
      setIsScanning(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.play().catch((e) => console.log('Video play error:', e));
      }
    } catch (err: any) {
      console.warn('Unable to access camera:', err);
      setCameraError(
        'Camera permission denied or device not found. Please check browser permissions or use "Upload QR Photo" below.'
      );
    }
  };

  // Toggle between front and rear cameras
  const toggleCamera = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
  };

  // QR Scanning Loop using jsQR
  const tick = () => {
    if (!isScanning || !videoRef.current || !canvasRef.current || scanSuccess) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });

        if (code && code.data) {
          // Play beep sound or vibrate if supported
          if (navigator.vibrate) {
            navigator.vibrate([100, 50, 100]);
          }
          handleProcessScan(code.data);
          return;
        }
      }
    }
    animationFrameRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    if (isScanning && isCameraActive && !scanSuccess) {
      animationFrameRef.current = requestAnimationFrame(tick);
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isScanning, isCameraActive, scanSuccess]);

  if (!isOpen) return null;

  // Handle pipe selection from scan
  const handleProcessScan = (codeToScan: string) => {
    setScannerError(null);
    const cleanId = codeToScan.trim().toUpperCase().replace(/.*[?&]ID=/i, '');
    
    const foundPipe = pipes.find(
      (p) => p.Pipe_ID.toUpperCase() === cleanId || p.Pipe_ID.toUpperCase().includes(cleanId)
    );

    if (foundPipe) {
      stopCameraStream();
      setScannedPipe(foundPipe);
      setScanSuccess(true);
      
      // Auto confirm after 900ms
      setTimeout(() => {
        onSelectPipe(foundPipe.Pipe_ID);
        onClose();
      }, 900);
    } else {
      // Check if it looks like an AWD code anyway
      if (cleanId.startsWith('AWD-')) {
        setScannerError(`QR Code "${cleanId}" scanned, but it is not currently in your Pipe Registry list.`);
      } else {
        setScannerError(`QR Code "${cleanId}" is not a recognized AWD System tag.`);
      }
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      handleProcessScan(manualCode);
    }
  };

  // Handle uploading an image file containing a QR code
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code && code.data) {
            handleProcessScan(code.data);
          } else {
            setScannerError('Could not detect a clear QR code in the uploaded photo. Please try another image or align closer.');
          }
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  // Sample unassigned available pipes for quick testing
  const availablePipes = pipes.filter((p) => p.Status === 'Available').slice(0, 4);
  const registeredPipes = pipes.filter((p) => p.Status === 'Installed').slice(0, 3);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="flex min-h-full items-start justify-center p-4 pt-4 sm:items-center sm:pt-4">
      <div className="bg-slate-900 border-2 border-[#88b04b] text-white rounded-3xl max-w-lg w-full shadow-2xl space-y-0 relative">
        
        {/* Hidden canvas for video QR frame processing */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Hidden file input for QR photo upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />

        {/* MODAL HEADER */}
        <div className="bg-[#2d4a2d] p-4 flex items-center justify-between border-b border-emerald-900/60">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-[#88b04b] text-slate-950 flex items-center justify-center font-extrabold shadow-md animate-pulse">
              <QrCode className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base font-extrabold uppercase tracking-wide text-white flex items-center gap-2">
                Scan AWD Pipe QR Code
                {isCameraActive && (
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-emerald-200 font-medium">
                Live Camera Scanner • Point at physical AWD Pipe Tag
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {isCameraActive && (
              <button
                type="button"
                onClick={toggleCamera}
                title="Switch Front/Rear Camera"
                className="bg-emerald-800/80 hover:bg-emerald-700 text-emerald-200 p-2 rounded-xl text-xs font-bold transition flex items-center gap-1 border border-emerald-600/40"
              >
                <RefreshCw className="w-4 h-4" />
                <span className="hidden sm:inline">Flip</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="text-slate-300 hover:text-white p-2 rounded-xl hover:bg-white/10 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* CAMERA VIEWPORT */}
        <div className="relative bg-black h-72 sm:h-80 flex flex-col items-center justify-center overflow-hidden">
          {/* Animated Background Grid */}
          <div className="absolute inset-0 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:16px_16px] opacity-20 pointer-events-none" />

          {/* LIVE VIDEO FEED - Rendered unconditionally so videoRef is never null when attaching stream */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`absolute inset-0 w-full h-full object-cover z-0 transition-opacity duration-300 ${
              isCameraActive && !scanSuccess ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          />

          {/* Laser Scanner Line Animation */}
          {isCameraActive && !scanSuccess && (
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_20px_#10b981] animate-[bounce_2s_infinite] z-10 pointer-events-none" />
          )}

          {/* Reticle Framing Box */}
          <div className={`relative z-10 w-56 h-56 border-2 rounded-3xl flex items-center justify-center transition-all duration-300 shadow-2xl backdrop-blur-[2px] ${
            scanSuccess ? 'border-emerald-400 bg-emerald-500/30 scale-105' : 'border-[#88b04b]/90 border-dashed bg-black/10'
          }`}>
            {/* Corner Bracket Accents */}
            <div className="absolute -top-2.5 -left-2.5 w-6 h-6 border-t-4 border-l-4 border-[#88b04b] rounded-tl-lg" />
            <div className="absolute -top-2.5 -right-2.5 w-6 h-6 border-t-4 border-r-4 border-[#88b04b] rounded-tr-lg" />
            <div className="absolute -bottom-2.5 -left-2.5 w-6 h-6 border-b-4 border-l-4 border-[#88b04b] rounded-bl-lg" />
            <div className="absolute -bottom-2.5 -right-2.5 w-6 h-6 border-b-4 border-r-4 border-[#88b04b] rounded-br-lg" />

            {scanSuccess && scannedPipe ? (
              <div className="text-center space-y-2 animate-scaleIn bg-slate-950/90 p-4 rounded-2xl border border-emerald-400/80 shadow-2xl">
                <CheckCircle2 className="w-14 h-14 text-emerald-400 mx-auto animate-bounce" />
                <span className="text-xs font-black text-white uppercase tracking-widest block">QR Verified!</span>
                <span className="text-xl font-mono font-black text-[#88b04b] bg-emerald-950 px-3 py-1 rounded-xl border border-emerald-800 block">
                  {scannedPipe.Pipe_ID}
                </span>
              </div>
            ) : isCameraActive ? (
              <div className="text-center space-y-2 p-2 bg-black/40 rounded-xl backdrop-blur-sm pointer-events-none">
                <Camera className="w-8 h-8 text-[#88b04b] mx-auto animate-pulse" />
                <span className="text-[11px] font-bold text-emerald-200 block uppercase tracking-wider">
                  Align QR inside frame
                </span>
                <span className="text-[9px] text-slate-300 block">
                  Searching for QR pattern...
                </span>
              </div>
            ) : (
              <div className="text-center space-y-3 p-4">
                <Camera className="w-10 h-10 text-slate-500 mx-auto" />
                <span className="text-xs font-bold text-slate-300 block">
                  Camera inactive or unavailable
                </span>
                <button
                  type="button"
                  onClick={() => startCamera(facingMode)}
                  className="bg-[#88b04b] hover:bg-[#779942] text-slate-950 font-extrabold text-xs px-4 py-2 rounded-xl transition uppercase shadow-md"
                >
                  Retry Camera
                </button>
              </div>
            )}
          </div>

          {/* Camera Error Message Overlay */}
          {cameraError && !scanSuccess && (
            <div className="absolute inset-x-4 bottom-3 bg-amber-950/95 text-amber-200 text-xs p-3 rounded-2xl border border-amber-500/60 flex flex-col sm:flex-row items-center justify-between gap-2 z-20 shadow-xl animate-fadeIn">
              <div className="flex items-center gap-2 text-left">
                <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
                <span>{cameraError}</span>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs px-3.5 py-1.5 rounded-xl shrink-0 transition uppercase tracking-wider flex items-center gap-1 shadow-md"
              >
                <Upload className="w-3.5 h-3.5" /> Upload Photo
              </button>
            </div>
          )}

          {/* Scanner Toast Error Overlay */}
          {scannerError && (
            <div className="absolute top-3 inset-x-4 bg-red-950/95 text-red-200 text-xs p-3 rounded-2xl border border-red-500/80 flex items-center justify-between gap-2 z-30 shadow-2xl animate-fadeIn">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                <span>{scannerError}</span>
              </div>
              <button
                type="button"
                onClick={() => setScannerError(null)}
                className="text-red-300 hover:text-white font-bold text-xs px-2 py-0.5 rounded bg-red-900/50"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>

        {/* MODAL CONTROLS & FALLBACKS */}
        <div className="p-4 bg-slate-900 space-y-4">
          
          {/* Quick Photo Upload & Manual Entry Form */}
          <div className="flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="bg-slate-800 hover:bg-slate-700 text-emerald-300 font-extrabold text-xs py-2.5 px-4 rounded-xl border border-emerald-500/30 transition flex items-center justify-center gap-2 uppercase tracking-wider shadow-sm shrink-0"
            >
              <Upload className="w-4 h-4 text-[#88b04b]" />
              <span>Upload QR Photo / Screenshot</span>
            </button>

            <form onSubmit={handleManualSubmit} className="flex gap-2 flex-1">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="Type ID (e.g. AWD-0004)"
                  className="w-full bg-slate-800 text-white font-mono text-xs rounded-xl px-3 py-2.5 border border-slate-700 outline-none focus:border-[#88b04b] uppercase"
                />
                <Search className="w-4 h-4 text-slate-500 absolute right-3 top-3 pointer-events-none" />
              </div>
              <button
                type="submit"
                className="bg-[#88b04b] hover:bg-[#779942] text-slate-950 font-extrabold text-xs px-4 py-2.5 rounded-xl transition uppercase tracking-wider shrink-0 shadow-md font-sans"
              >
                Submit
              </button>
            </form>
          </div>

        </div>

      </div>
      </div>
    </div>
  );
};
