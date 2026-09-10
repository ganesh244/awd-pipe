import React, { useState, useEffect, useRef } from 'react';
import { AWDPipe, Installation } from '../types';
import jsQR from 'jsqr';
import { QrCode, Camera, CheckCircle2, X, Search, Sparkles, Smartphone, ShieldCheck, AlertCircle, RefreshCw, Upload, Image as ImageIcon, Volume2 } from 'lucide-react';
import { useDialog } from '../hooks/useDialog';

interface QrCodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  pipes: AWDPipe[];
  installations?: Installation[];
  onSelectPipe: (pipeId: string) => void;
}

export const QrCodeScannerModal: React.FC<QrCodeScannerModalProps> = ({
  isOpen,
  onClose,
  pipes,
  installations = [],
  onSelectPipe,
}) => {
  // Escape-to-close, focus trap, focus restore and scroll lock.
  const { dialogProps } = useDialog({ open: isOpen, onClose, label: 'Scan a pipe QR code' });

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

    const foundInst = !foundPipe
      ? installations.find(
          (i) => i.Pipe_ID.toUpperCase() === cleanId || i.Pipe_ID.toUpperCase().includes(cleanId)
        )
      : null;

    if (foundPipe) {
      stopCameraStream();
      setScannedPipe(foundPipe);
      setScanSuccess(true);
      
      // Auto confirm after 900ms
      setTimeout(() => {
        onSelectPipe(foundPipe.Pipe_ID);
        onClose();
      }, 900);
    } else if (foundInst) {
      stopCameraStream();
      setScannedPipe({ Pipe_ID: foundInst.Pipe_ID } as AWDPipe);
      setScanSuccess(true);
      
      // Auto confirm after 900ms
      setTimeout(() => {
        onSelectPipe(foundInst.Pipe_ID);
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
    <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.7)' }} {...dialogProps}>
      <div className="flex min-h-full items-start justify-center p-4 pt-4 sm:items-center sm:pt-4">
      <div className="max-w-lg w-full relative" style={{ background: 'var(--color-shell)', border: '1px solid rgba(255,255,255,0.15)' }}>

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
        <div className="p-4 flex items-center justify-between text-white" style={{ borderBottom: '2px solid rgba(255,255,255,0.12)' }}>
          <div>
            <div className="awd-kicker" style={{ color: 'var(--color-accent-400)' }}>Scan a pipe QR</div>
            <h2 className="font-black" style={{ fontSize: 16 }}>Point at the physical AWD pipe tag</h2>
          </div>

          <div className="flex items-center gap-1.5">
            {isCameraActive && (
              <button
                type="button"
                onClick={toggleCamera}
                title="Switch front/rear camera"
                className="p-2 text-xs font-bold cursor-pointer flex items-center gap-1"
                style={{ border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.8)' }}
              >
                <RefreshCw className="w-4 h-4" />
                <span className="hidden sm:inline">Flip</span>
              </button>
            )}
            <button onClick={onClose} className="p-2 cursor-pointer" style={{ color: 'rgba(255,255,255,0.7)' }}>
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* CAMERA VIEWPORT */}
        <div className="relative h-72 sm:h-80 flex flex-col items-center justify-center overflow-hidden" style={{ background: '#000' }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`absolute inset-0 w-full h-full object-cover z-0 transition-opacity duration-300 ${
              isCameraActive && !scanSuccess ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          />

          {/* Flush corner-bracket reticle — matches the design prototype's viewfinder */}
          <div className="relative z-10 w-56 h-56 flex items-center justify-center">
            {(['top-2.5 left-2.5 border-t-2 border-l-2', 'top-2.5 right-2.5 border-t-2 border-r-2', 'bottom-2.5 left-2.5 border-b-2 border-l-2', 'bottom-2.5 right-2.5 border-b-2 border-r-2'] as const).map((pos, i) => (
              <div
                key={i}
                className={`absolute w-6 h-6 ${pos}`}
                style={{ borderColor: scanSuccess ? 'var(--color-accent-400)' : 'var(--color-accent-500)', borderStyle: 'solid' }}
              />
            ))}

            {scanSuccess && scannedPipe ? (
              <div className="text-center p-4" style={{ background: 'var(--color-shell)', border: '1px solid var(--color-accent-500)' }}>
                <CheckCircle2 className="w-10 h-10 mx-auto" style={{ color: 'var(--color-accent-400)' }} />
                <div className="text-xs font-black text-white uppercase tracking-widest mt-2">QR verified</div>
                <div className="awd-mono font-black mt-1" style={{ color: 'var(--color-accent-400)', fontSize: 18 }}>{scannedPipe.Pipe_ID}</div>
              </div>
            ) : isCameraActive ? (
              <div className="text-center pointer-events-none">
                <Camera className="w-7 h-7 mx-auto" style={{ color: 'var(--color-accent-400)' }} />
                <div className="text-xs font-bold text-white uppercase tracking-wider mt-2">Align QR inside frame</div>
              </div>
            ) : (
              <div className="text-center">
                <Camera className="w-8 h-8 mx-auto" style={{ color: 'rgba(255,255,255,0.4)' }} />
                <div className="text-xs font-bold mt-2" style={{ color: 'rgba(255,255,255,0.6)' }}>Camera inactive or unavailable</div>
                <button
                  type="button"
                  onClick={() => startCamera(facingMode)}
                  className="awd-btn-primary justify-center mt-3 mx-auto"
                  style={{ fontSize: 12 }}
                >
                  Retry camera
                </button>
              </div>
            )}
          </div>

          {cameraError && !scanSuccess && (
            <div className="absolute inset-x-4 bottom-3 text-xs p-3 flex flex-col sm:flex-row items-center justify-between gap-2 z-20" style={{ background: '#78350F', color: '#FDE68A', border: '1px solid #B45309' }}>
              <div className="flex items-center gap-2 text-left">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{cameraError}</span>
              </div>
              <button type="button" onClick={() => fileInputRef.current?.click()} className="shrink-0 font-bold text-xs px-3 py-1.5 flex items-center gap-1 cursor-pointer" style={{ background: 'var(--color-warning)', color: '#fff' }}>
                <Upload className="w-3.5 h-3.5" /> Upload photo
              </button>
            </div>
          )}

          {scannerError && (
            <div className="absolute top-3 inset-x-4 text-xs p-3 flex items-center justify-between gap-2 z-30" style={{ background: '#7F1D1D', color: '#FECACA', border: '1px solid var(--color-danger)' }}>
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{scannerError}</span>
              </div>
              <button type="button" onClick={() => setScannerError(null)} className="font-bold text-xs px-2 py-0.5 cursor-pointer" style={{ background: 'rgba(0,0,0,0.3)' }}>
                Dismiss
              </button>
            </div>
          )}
        </div>

        {/* MODAL CONTROLS & FALLBACKS */}
        <div className="p-4">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="awd-btn-secondary justify-center w-full"
            style={{ color: 'var(--color-accent-400)', borderColor: 'rgba(255,255,255,0.2)' }}
          >
            <Upload className="w-4 h-4" />
            <span>Upload QR photo / screenshot</span>
          </button>

          <div className="flex items-center gap-3 py-3">
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.15)' }} />
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>Or enter ID</span>
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.15)' }} />
          </div>

          <form onSubmit={handleManualSubmit} className="flex gap-2 w-full">
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value.toUpperCase())}
              placeholder="e.g. AWD-0004"
              className="awd-mono flex-1 uppercase outline-none px-3 py-2.5 text-sm"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff' }}
            />
            <button type="submit" className="awd-btn-primary shrink-0">
              Verify
            </button>
          </form>
        </div>

      </div>
      </div>
    </div>
  );
};
