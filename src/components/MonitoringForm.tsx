import React, { useState } from 'react';
import { MonitoringRecord, CropStage, AWDFollowed, PipeCondition, User } from '../types';
import { CameraCapture } from './CameraCapture';
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
  const today = new Date().toISOString().substring(0, 10);

  const [visitDate, setVisitDate] = useState(today);
  const [waterLevel, setWaterLevel] = useState('-5 cm below soil surface');
  const [cropStage, setCropStage] = useState<CropStage>('Tillering');
  const [awdFollowed, setAwdFollowed] = useState<AWDFollowed>('Yes');
  const [pipeCondition, setPipeCondition] = useState<PipeCondition>('Good');
  const [visitedBy, setVisitedBy] = useState(currentUser ? `${currentUser.name} (${currentUser.role})` : 'M. Srinivas (Field Officer)');
  const [remarks, setRemarks] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(undefined);
  const [gpsCaptured, setGpsCaptured] = useState<{ lat: number; lng: number } | null>(null);

  if (!isOpen) return null;

  const handleCaptureGPS = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGpsCaptured({
            lat: Number(pos.coords.latitude.toFixed(6)),
            lng: Number(pos.coords.longitude.toFixed(6)),
          });
        },
        () => {
          // Fallback mock location if denied or unavailable in sandbox
          setGpsCaptured({ lat: 18.6184, lng: 79.3783 });
        }
      );
    } else {
      setGpsCaptured({ lat: 18.6184, lng: 79.3783 });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

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
      Latitude: gpsCaptured ? gpsCaptured.lat : 18.6184,
      Longitude: gpsCaptured ? gpsCaptured.lng : 79.3783,
      Photo_URL: photoUrl,
      Remarks: remarks,
    };

    onSubmit(record);
    setPhotoUrl(undefined);
    onClose();
  };


  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto border border-slate-200">
        
        {/* Modal Header */}
        <div className="flex justify-between items-center border-b pb-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 block">
              Field Inspection Log
            </span>
            <h3 className="font-extrabold text-slate-800 text-lg flex items-center gap-2">
              <Droplet className="w-5 h-5 text-emerald-600" />
              Add Visit for {pipeId}
            </h3>
          </div>
          <button
            onClick={onClose}
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
              className="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Water Level inside AWD Pipe *
            </label>
            <select
              value={waterLevel}
              onChange={(e) => setWaterLevel(e.target.value)}
              className="w-full border rounded-xl p-2.5 text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none font-medium"
            >
              <option value="+5 cm above soil surface">+5 cm (Flooded stage)</option>
              <option value="+2 cm above soil surface">+2 cm (Shallow water)</option>
              <option value="0 cm (At soil surface)">0 cm (Soil surface saturated)</option>
              <option value="-5 cm below soil surface">-5 cm below surface</option>
              <option value="-10 cm below soil surface">-10 cm below surface</option>
              <option value="-15 cm below soil surface (Irrigate Now!)">-15 cm below surface (Threshold reached!)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Crop Stage *</label>
              <select
                value={cropStage}
                onChange={(e) => setCropStage(e.target.value as CropStage)}
                className="w-full border rounded-xl p-2.5 text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
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
                className="w-full border rounded-xl p-2.5 text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-emerald-800"
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
              className="w-full border rounded-xl p-2.5 text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
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
              className="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>

          {/* GPS Quick Capture in Modal */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex items-center justify-between text-xs">
            <span className="text-slate-600 flex items-center gap-1 font-medium">
              <MapPin className="w-3.5 h-3.5 text-emerald-600" />
              {gpsCaptured
                ? `GPS Captured: ${gpsCaptured.lat}, ${gpsCaptured.lng}`
                : 'Optional Visit GPS'}
            </span>
            <button
              type="button"
              onClick={handleCaptureGPS}
              className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-2.5 py-1 rounded-lg text-[11px] transition"
            >
              {gpsCaptured ? 'Recapture' : 'Capture GPS'}
            </button>
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
              className="w-full border rounded-xl p-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
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
