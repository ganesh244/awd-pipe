import React, { useState, useRef, useEffect } from 'react';
import { Camera, RefreshCw, CheckCircle2, Image as ImageIcon, X, AlertCircle } from 'lucide-react';

interface CameraCaptureProps {
  photoUrl: string | undefined;
  onPhotoCaptured: (url: string) => void;
  onPhotoRemoved: () => void;
  label?: string;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({
  photoUrl,
  onPhotoCaptured,
  onPhotoRemoved,
  label = 'Capture Pipe Field Photo',
}) => {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Stop camera stream on unmount
  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, []);

  const stopCameraStream = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const startCamera = async () => {
    setStreamError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      mediaStreamRef.current = stream;
      setIsCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.warn('Unable to open live camera stream directly:', err);
      setStreamError('Live webcam feed not available or blocked in browser. Use camera file capture below.');
      // Fallback: trigger native mobile file input
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    }
  };

  // Helper: Compress image to max 600px dimension and 0.6 JPEG quality (~30-50KB) to preserve 512MB MongoDB free tier limit
  const compressImage = (dataUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 600;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.6));
        } else {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  const captureSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      // Add watermark overlay for AWD Pipe verification
      ctx.fillStyle = 'rgba(4, 47, 46, 0.7)';
      ctx.fillRect(10, canvas.height - 40, 280, 30);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(`AWD FIELD VERIFIED • ${new Date().toLocaleDateString()}`, 20, canvas.height - 20);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
      compressImage(dataUrl).then((compressed) => {
        onPhotoCaptured(compressed);
        stopCameraStream();
      });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        compressImage(result).then((compressed) => onPhotoCaptured(compressed));
      };
      reader.readAsDataURL(file);
    }
  };

  // Generate a realistic field sample photo for rapid testing/desktop fallback
  const handleSamplePhoto = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Background Paddy Green Gradient
      const grad = ctx.createLinearGradient(0, 0, 0, 400);
      grad.addColorStop(0, '#2d4a2d');
      grad.addColorStop(0.6, '#4d7c0f');
      grad.addColorStop(1, '#15803d');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 600, 400);

      // Water channel / soil surface
      ctx.fillStyle = '#78350f';
      ctx.fillRect(0, 280, 600, 120);
      ctx.fillStyle = '#1e3a8a';
      ctx.globalAlpha = 0.4;
      ctx.fillRect(0, 310, 600, 90);
      ctx.globalAlpha = 1.0;

      // Draw AWD Pipe (Perforated PVC Pipe)
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.roundRect(260, 100, 80, 240, 8);
      ctx.fill();
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Perforations
      ctx.fillStyle = '#1e293b';
      for (let y = 140; y < 310; y += 20) {
        for (let x = 275; x < 330; x += 18) {
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Pipe Label Tag
      ctx.fillStyle = '#042f2e';
      ctx.fillRect(250, 120, 100, 25);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px monospace';
      ctx.fillText('AWD-PIPE ✓', 260, 137);

      // Paddy Stalks
      ctx.strokeStyle = '#84cc16';
      ctx.lineWidth = 4;
      for (let x = 20; x < 580; x += 35) {
        if (x < 240 || x > 360) {
          ctx.beginPath();
          ctx.moveTo(x, 300);
          ctx.quadraticCurveTo(x - 10, 200, x - 15, 80);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x + 5, 300);
          ctx.quadraticCurveTo(x + 15, 180, x + 25, 90);
          ctx.stroke();
        }
      }

      // Watermark Bar
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(15, 345, 570, 40);
      ctx.fillStyle = '#86efac';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(`🌱 AWD FIELD INSPECTION PHOTO • LOGGED AT ${new Date().toLocaleTimeString()}`, 30, 370);

      const sampleUrl = canvas.toDataURL('image/jpeg', 0.65);
      compressImage(sampleUrl).then((compressed) => onPhotoCaptured(compressed));
    }
  };

  return (
    <div className="space-y-2 bg-[#f4f7f2] border border-[#d1dbd1] p-3.5 rounded-lg">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-[#2d3a2d] uppercase tracking-wider flex items-center gap-1.5">
          <Camera className="w-4 h-4 text-[#88b04b]" />
          {label}
        </label>
        {photoUrl && (
          <span className="bg-[#88b04b] text-white text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Photo Attached
          </span>
        )}
      </div>

      {/* Hidden File Input for Native Camera / Gallery Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* PHOTO PREVIEW STATE */}
      {photoUrl ? (
        <div className="relative rounded-lg overflow-hidden border-2 border-[#88b04b] shadow-sm bg-black group">
          <img src={photoUrl} alt="AWD Pipe Installation Photo" className="w-full h-44 object-cover" />
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 text-white flex items-center justify-between text-xs">
            <span className="font-mono text-[10px] text-emerald-300 font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Photo Logged
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="bg-white/20 hover:bg-white/30 text-white font-bold text-[10px] px-2.5 py-1 rounded transition backdrop-blur-sm"
              >
                Retake
              </button>
              <button
                type="button"
                onClick={onPhotoRemoved}
                className="bg-red-600/80 hover:bg-red-600 text-white font-bold text-[10px] px-2 py-1 rounded transition"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      ) : isCameraActive ? (
        /* LIVE CAMERA STREAM VIEW */
        <div className="relative rounded-lg overflow-hidden border-2 border-[#2d4a2d] bg-black">
          <video ref={videoRef} autoPlay playsInline className="w-full h-52 object-cover" />
          <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-3 px-4">
            <button
              type="button"
              onClick={captureSnapshot}
              className="bg-[#88b04b] hover:bg-[#779942] text-white font-bold px-5 py-2.5 rounded-lg shadow-lg text-xs flex items-center gap-2 uppercase tracking-wider"
            >
              <Camera className="w-4 h-4" /> Snap Photo
            </button>
            <button
              type="button"
              onClick={stopCameraStream}
              className="bg-slate-800/80 text-white font-bold px-3 py-2.5 rounded-lg text-xs border border-slate-600"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        /* NO PHOTO ATTACHED - ACTION BUTTONS */
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={startCamera}
              className="bg-[#2d4a2d] hover:bg-[#1a2d1a] text-white font-bold text-xs py-2.5 px-3 rounded-lg transition shadow flex items-center justify-center gap-2 uppercase tracking-wider"
            >
              <Camera className="w-4 h-4 text-[#88b04b]" /> Open Camera
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="bg-white hover:bg-slate-50 text-[#2d3a2d] border-2 border-[#d1dbd1] font-bold text-xs py-2.5 px-3 rounded-lg transition flex items-center justify-center gap-2 uppercase tracking-wider"
            >
              <ImageIcon className="w-4 h-4 text-[#88b04b]" /> Upload File
            </button>
          </div>

          <button
            type="button"
            onClick={handleSamplePhoto}
            className="w-full bg-[#e2e8f0] hover:bg-slate-300 text-slate-700 text-[11px] font-bold py-1.5 rounded transition flex items-center justify-center gap-1.5"
          >
            <span>📷 Attach Field Pipe Sample Photo</span>
          </button>

          {streamError && (
            <p className="text-[10px] text-amber-700 bg-amber-50 p-2 rounded border border-amber-200 flex items-center gap-1">
              <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
              {streamError}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
