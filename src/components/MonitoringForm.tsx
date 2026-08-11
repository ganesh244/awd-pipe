import React, { useState, useEffect, useMemo } from 'react';
import { MonitoringRecord, CropStage, AWDFollowed, PipeCondition, User } from '../types';
import { CameraCapture } from './CameraCapture';
import { playSuccessSound } from '../utils/soundUtils';
import { X, Calendar, Droplet, UserCheck, AlertCircle, MapPin } from 'lucide-react';

interface MonitoringFormProps {
  pipeId: string;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (record: MonitoringRecord) => void;
  currentUser?: User;
}

export const MonitoringForm: React.FC<MonitoringFormProps> = ({
  pipeId,
  isOpen,
  onClose,
  onSubmit,
  currentUser,
}) => {
  // Stable: only computed once (or when the component mounts), NOT on every render
  const today = useMemo(() => new Date().toISOString().substring(0, 10), []);

  const [visitDate, setVisitDate] = useState(today);
  const [waterLevel, setWaterLevel] = useState('-5 cm below soil surface');
  const [cropStage, setCropStage] = useState<CropStage>('Tillering');
  const [awdFollowed, setAwdFollowed] = useState<AWDFollowed>('Yes');
  const [pipeCondition, setPipeCondition] = useState<PipeCondition>('Good');
  const [visitedBy, setVisitedBy] = useState(currentUser ? `${currentUser.name} (${currentUser.role})` : 'M. Srinivas (Field Officer)');
  const [remarks, setRemarks] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(undefined);
  const [gpsCaptured, setGpsCaptured] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [showGpsWarning, setShowGpsWarning] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Reset form fields when the modal opens for a new pipe
  // `today` is intentionally excluded from deps — it's stable via useMemo
  useEffect(() => {
    if (isOpen) {
      setVisitDate(today);
      setWaterLevel('-5 cm below soil surface');
      setCropStage('Tillering');
      setAwdFollowed('Yes');
      setPipeCondition('Good');
      setRemarks('');
      setPhotoUrl(undefined);
      setGpsCaptured(null);
      setShowGpsWarning(false);
      setIsLocating(false);
      setGpsError(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, pipeId]);

  if (!isOpen) return null;

  const handleCaptureGPS = () => {
    setIsLocating(true);
    setGpsError(null);
    setShowGpsWarning(false);
    setGpsCaptured(null);

    const useMockGps = import.meta.env.DEV && import.meta.env.VITE_ENABLE_MOCK_GPS === "true";

    if (useMockGps) {
      setTimeout(() => {
        setGpsCaptured({ lat: 18.6184, lng: 79.3783, accuracy: 6 });
        setIsLocating(false);
      }, 600);
      return;
    }

    if (!navigator.geolocation) {
      setGpsError("GPS Location is mandatory. Please check your browser/device permissions and try again.");
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsCaptured({
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
          accuracy: Math.round(pos.coords.accuracy)
        });
        setIsLocating(false);
      },
      () => {
        setGpsError("GPS Location is mandatory. Please check your browser/device permissions and try again.");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gpsCaptured) {
      setGpsError("GPS Location is mandatory. Please check your browser/device permissions and try again.");
      return;
    }

    const record: MonitoringRecord = {
      Timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      Pipe_ID: pipeId,
      Visit_Date: visitDate,
      Water_Level: waterLevel,
      Crop_Stage: cropStage,
      AWD_Followed: awdFollowed,
      Pipe_Condition: pipeCondition,
      Visited_By: visitedBy,
      Visited_By_User_ID: currentUser?.id,
      Latitude: gpsCaptured.lat,
      Longitude: gpsCaptured.lng,
      Photo_URL: photoUrl,
      Remarks: remarks,
    };

    onSubmit(record);
    playSuccessSound();
    setPhotoUrl(undefined);
    onClose();
  };


  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto border border-slate-200">
        
        {/* Modal Header */}
        <div className="flex justify-between items-center border-b pb-3">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 block">
              Field Inspection Log
            </span>
            <h3 className="font-extrabold text-slate-800 text-lg flex items-center gap-2">
              <Droplet className="w-5 h-5 text-emerald-600" />
              Add Visit for {pipeId}
            </h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close Monitoring Modal"
            className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 transition font-bold"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-3">
          
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" /> Visit Date *
            </label>
            <input
              type="date"
              required
              value={visitDate}
              onChange={(e) => setVisitDate(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none min-h-[44px] transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Water Level inside AWD Pipe *
            </label>
            <select
              value={waterLevel}
              onChange={(e) => setWaterLevel(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none min-h-[44px] transition"
            >
              <option value="5">+5 cm (Flooded stage)</option>
              <option value="2">+2 cm (Shallow water)</option>
              <option value="0">0 cm (Soil surface saturated)</option>
              <option value="-5">-5 cm below surface</option>
              <option value="-10">-10 cm below surface</option>
              <option value="-15">-15 cm below surface (Threshold reached! ⚠️)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Crop Stage *</label>
              <select
                value={cropStage}
                onChange={(e) => setCropStage(e.target.value as CropStage)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none min-h-[44px] transition"
              >
                <option value="Tillering">Tillering</option>
                <option value="Panicle Initiation">Panicle Initiation</option>
                <option value="Flowering">Flowering</option>
                <option value="Grain Filling">Grain Filling</option>
                <option value="Harvesting">Harvesting</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">AWD Followed? *</label>
              <select
                value={awdFollowed}
                onChange={(e) => setAwdFollowed(e.target.value as AWDFollowed)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none min-h-[44px] transition"
              >
                <option value="Yes">Yes (Compliant)</option>
                <option value="Partially">Partially</option>
                <option value="No">No (Over-flooded)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Pipe Condition *</label>
            <select
              value={pipeCondition}
              onChange={(e) => setPipeCondition(e.target.value as PipeCondition)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none min-h-[44px] transition"
            >
              <option value="Good">Good Condition</option>
              <option value="Damaged">Damaged</option>
              <option value="Missing">Missing / Stolen</option>
              <option value="Replaced">Replaced</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5 text-slate-400" /> Visited By *
            </label>
            <input
              type="text"
              required
              value={visitedBy}
              onChange={(e) => setVisitedBy(e.target.value)}
              placeholder="Officer Name"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none min-h-[44px] transition"
            />
          </div>

          {/* GPS Quick Capture in Modal */}
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={handleCaptureGPS}
              disabled={isLocating}
              className={`w-full font-bold rounded-xl text-xs py-3 px-3 transition shadow-sm flex items-center justify-center gap-2 active:scale-[0.97] transition-transform ${
                gpsCaptured
                  ? 'bg-emerald-100 text-emerald-800 border-2 border-emerald-500'
                  : 'bg-white border-2 border-slate-300 text-slate-700 hover:border-slate-400 hover:bg-slate-50'
              }`}
            >
              {isLocating ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-400 border-t-slate-700 rounded-full animate-spin"></div>
                  Capturing...
                </>
              ) : gpsError && !gpsCaptured ? (
                <>
                  <MapPin className="w-4 h-4" />
                  Failed - Tap to Retry
                </>
              ) : gpsCaptured ? (
                <>
                  <MapPin className="w-4 h-4" />
                  Captured (Tap to Recapture)
                </>
              ) : (
                <>
                  <MapPin className="w-4 h-4" />
                  Not captured - Tap to Capture
                </>
              )}
            </button>

            {gpsCaptured && (
              <div className="bg-emerald-100/80 border border-emerald-300 rounded-lg p-2.5 text-xs text-emerald-900 font-mono space-y-0.5 animate-fadeIn">
                <div>Lat: {gpsCaptured.lat.toFixed(6)}</div>
                <div>Lng: {gpsCaptured.lng.toFixed(6)}</div>
                {gpsCaptured.accuracy !== undefined && (
                  <div className="text-xs text-emerald-700 font-bold mt-1 inline-block bg-emerald-200/50 px-2 py-0.5 rounded">
                    Accuracy: ±{gpsCaptured.accuracy}m
                  </div>
                )}
              </div>
            )}

            {gpsError && (
              <div role="alert" className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-xs font-semibold shadow-sm">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                <span>{gpsError}</span>
              </div>
            )}
          </div>

          {/* Field Photo Capture */}
          <CameraCapture
            photoUrl={photoUrl}
            onPhotoCaptured={(url) => setPhotoUrl(url)}
            onPhotoRemoved={() => setPhotoUrl(undefined)}
            label="Capture Monitored Field Pipe Photo"
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Remarks & Recommendations</label>
            <textarea
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Observations on weed growth, water retention, farmer feedback..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none min-h-[44px] transition"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl text-sm transition shadow-md flex items-center justify-center gap-2"
            >
              <Droplet className="w-4 h-4" /> Save Monitoring Visit
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
