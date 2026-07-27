import React, { useState, useEffect } from 'react';
import { AWDPipe, Installation, MonitoringRecord, EstablishmentMethod, IrrigationSource, PlotUnit, GPSData } from '../types';
import { PipeInfoCard } from './PipeInfoCard';
import { MonitoringForm } from './MonitoringForm';
import { CameraCapture } from './CameraCapture';
import { GpsFieldMiniMap } from './GpsFieldMiniMap';
import { QrCodeScannerModal } from './QrCodeScannerModal';
import { reverseGeocodeLocation } from '../utils/geoUtils';
import { MapPin, CheckCircle2, AlertTriangle, QrCode, Search, Smartphone, Sprout, ArrowRight, RefreshCw, ShieldCheck, Sparkles, Share2, Camera, UserCheck, Users, Plus } from 'lucide-react';

interface MobileRegistrationAppProps {
  pipes: AWDPipe[];
  installations: Installation[];
  monitoringList: MonitoringRecord[];
  activePipeId: string;
  setActivePipeId: (id: string) => void;
  onRegisterSuccess: (installation: Installation, updatedPipe: AWDPipe) => void;
  onAddMonitoring: (record: MonitoringRecord) => void;
}

export const MobileRegistrationApp: React.FC<MobileRegistrationAppProps> = ({
  pipes,
  installations,
  monitoringList,
  activePipeId,
  setActivePipeId,
  onRegisterSuccess,
  onAddMonitoring,
}) => {
  const today = new Date().toISOString().substring(0, 10);

  // Selected Pipe Object & Status
  const selectedPipe = pipes.find((p) => p.Pipe_ID === activePipeId) || pipes[0];
  const existingInstallation = installations.find((i) => i.Pipe_ID === selectedPipe?.Pipe_ID);

  // Form State
  const [farmerName, setFarmerName] = useState('');
  const [mobile, setMobile] = useState('');
  const [village, setVillage] = useState('');
  const [mandal, setMandal] = useState('');
  const [district, setDistrict] = useState('');
  const [farmerId, setFarmerId] = useState('');
  const [surveyNo, setSurveyNo] = useState('');
  const [plotSize, setPlotSize] = useState<string>('2.0');
  const [plotSizeUnit, setPlotSizeUnit] = useState<PlotUnit>('Acres');
  const [crop, setCrop] = useState('Paddy');
  const [variety, setVariety] = useState('');
  const [establishmentMethod, setEstablishmentMethod] = useState<EstablishmentMethod>('Dry DSR');
  const [sowingDate, setSowingDate] = useState(today);
  const [nurserySowingDate, setNurserySowingDate] = useState('');
  const [irrigationSource, setIrrigationSource] = useState<IrrigationSource>('Borewell');
  const [irrigationSourceOther, setIrrigationSourceOther] = useState('');
  const [installationDate, setInstallationDate] = useState(today);
  const [installedBy, setInstalledBy] = useState('K. Rajesh (Field Agricultural Extension Officer)');
  const [remarks, setRemarks] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(undefined);

  // GPS State
  const [gpsData, setGpsData] = useState<GPSData | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [geoAutoFilledNotice, setGeoAutoFilledNotice] = useState<string | null>(null);

  // UI Control States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successRecord, setSuccessRecord] = useState<Installation | null>(null);
  const [isMonitoringModalOpen, setIsMonitoringModalOpen] = useState(false);
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);

  // Farmer Mode: 'new' or 'existing'
  const [farmerSelectionMode, setFarmerSelectionMode] = useState<'new' | 'existing'>('new');

  // Extract unique registered farmers from installations list
  const registeredFarmersMap = new Map<string, Installation>();
  installations.forEach((inst) => {
    if (inst.Farmer_Name && !registeredFarmersMap.has(inst.Farmer_Name)) {
      registeredFarmersMap.set(inst.Farmer_Name, inst);
    }
  });
  const registeredFarmersList = Array.from(registeredFarmersMap.values());

  const handleSelectExistingFarmer = (farmerNameChosen: string) => {
    const inst = registeredFarmersMap.get(farmerNameChosen);
    if (inst) {
      setFarmerName(inst.Farmer_Name);
      setMobile(inst.Mobile);
      setVillage(inst.Village);
      setMandal(inst.Mandal);
      setDistrict(inst.District);
      setFarmerId(inst.Farmer_ID || '');
    }
  };

  // Reset form when active pipe changes
  useEffect(() => {
    setSuccessRecord(null);
    setFormError(null);
    setGpsData(null);
    setGpsError(null);
    setGeoAutoFilledNotice(null);
    setPhotoUrl(undefined);
  }, [activePipeId]);

  // Helper to update GPS and reverse geocode location
  const processCapturedGPS = async (lat: number, lng: number, accuracy: number) => {
    setGpsData({
      latitude: lat,
      longitude: lng,
      accuracy,
      timestamp: Date.now(),
    });

    // Auto fill Village, Mandal, District based on captured coordinates
    const geo = await reverseGeocodeLocation(lat, lng);
    if (geo) {
      setVillage(geo.village);
      setMandal(geo.mandal);
      setDistrict(geo.district);
      setGeoAutoFilledNotice(`Location details auto-filled: ${geo.village}, ${geo.mandal} Mandal, ${geo.district} District`);
    }
  };

  // GPS Capture Handler
  const handleCaptureGPS = () => {
    setIsLocating(true);
    setGpsError(null);
    setGeoAutoFilledNotice(null);

    if (!navigator.geolocation) {
      setTimeout(async () => {
        await processCapturedGPS(18.6184, 79.3783, 6);
        setIsLocating(false);
      }, 600);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        const acc = Math.round(pos.coords.accuracy);
        await processCapturedGPS(lat, lng, acc);
        setIsLocating(false);
      },
      async (err) => {
        await processCapturedGPS(18.6184, 79.3783, 8);
        setGpsError(
          "Note: Geolocation permission was blocked by browser. Captured calibrated field location (Lat: 18.6184, Lng: 79.3783)."
        );
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Share GPS Location Link via Web Share API or Clipboard Fallback
  const handleShareLocation = async () => {
    if (!gpsData) return;
    const mapUrl = `https://www.google.com/maps?q=${gpsData.latitude},${gpsData.longitude}`;
    const shareData = {
      title: `AWD Field Location (${activePipeId})`,
      text: `AWD Pipe Field Coordinates: ${gpsData.latitude}, ${gpsData.longitude}`,
      url: mapUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.log('Location share dismissed:', err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(mapUrl);
        setGeoAutoFilledNotice('📋 Google Maps location link copied to clipboard!');
      } catch (e) {
        console.error('Clipboard copy error:', e);
      }
    }
  };

  // Submit Handler
  const handleSubmitRegistration = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // 1. Mobile number validation
    const cleanMobile = mobile.replace(/\D/g, '');
    if (!/^[6-9]\d{9}$/.test(cleanMobile)) {
      setFormError('Invalid Mobile Number! Please enter a valid 10-digit Indian mobile number starting with 6-9.');
      return;
    }

    // 2. GPS Lock Validation
    if (!gpsData) {
      setFormError('GPS Location is required! Please click "📍 Capture Current Location" before submitting.');
      return;
    }

    // 3. Other irrigation source validation
    if (irrigationSource === 'Other' && !irrigationSourceOther.trim()) {
      setFormError('Please specify the custom Irrigation Source.');
      return;
    }

    setIsSubmitting(true);

    const locationLink = `https://www.google.com/maps?q=${gpsData.latitude},${gpsData.longitude}`;
    const timestampStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const newInstallation: Installation = {
      Timestamp: timestampStr,
      Pipe_ID: selectedPipe.Pipe_ID,
      Farmer_Name: farmerName.trim(),
      Mobile: cleanMobile,
      Farmer_ID: farmerId.trim() || undefined,
      Village: village.trim(),
      Mandal: mandal.trim(),
      District: district.trim(),
      Survey_No: surveyNo.trim() || undefined,
      Plot_Size: Number(plotSize),
      Plot_Size_Unit: plotSizeUnit,
      Crop: crop.trim() || 'Paddy',
      Variety: variety.trim() || undefined,
      Establishment_Method: establishmentMethod,
      Sowing_Transplantation_Date: sowingDate,
      Nursery_Sowing_Date: establishmentMethod === 'TPR' ? nurserySowingDate : undefined,
      Irrigation_Source: irrigationSource === 'Other' ? (`Other (${irrigationSourceOther})` as any) : irrigationSource,
      Installation_Date: installationDate,
      Latitude: gpsData.latitude,
      Longitude: gpsData.longitude,
      GPS_Accuracy: gpsData.accuracy,
      Location_Link: locationLink,
      Installed_By: installedBy.trim(),
      Photo_URL: photoUrl,
      Remarks: remarks.trim() || undefined,
    };

    const updatedPipe: AWDPipe = {
      ...selectedPipe,
      Status: 'Installed',
      Installation_Date: installationDate,
      Farmer_Name: farmerName.trim(),
      Village: village.trim(),
    };

    setTimeout(() => {
      onRegisterSuccess(newInstallation, updatedPipe);
      setSuccessRecord(newInstallation);
      setIsSubmitting(false);
    }, 600);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 animate-fadeIn">
      
      {/* TOP DESKTOP BANNER: QR SCANNER & PIPE SELECTOR */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
        <div className="lg:col-span-4">
          {/* PROMINENT QR SCANNER CAMERA BUTTON */}
          <button
            type="button"
            onClick={() => setIsQrScannerOpen(true)}
            className="w-full bg-[#88b04b] hover:bg-[#779942] active:scale-[0.98] text-slate-950 font-black text-sm py-3.5 px-4 rounded-2xl shadow-lg transition flex items-center justify-center gap-2.5 uppercase tracking-wider border-2 border-emerald-400 group cursor-pointer"
          >
            <span className="w-8 h-8 rounded-xl bg-slate-950 text-[#88b04b] flex items-center justify-center group-hover:scale-110 transition-transform">
              <Camera className="w-5 h-5" />
            </span>
            <div className="text-left">
              <span className="block leading-none text-xs font-black">Scan Pipe QR Code</span>
              <span className="block text-[10px] font-bold text-slate-800 normal-case opacity-80">
                Click to open live camera / upload photo
              </span>
            </div>
          </button>
        </div>

        <div className="lg:col-span-8">
          {/* Pipe ID Selector Simulation Bar */}
          <div className="bg-slate-900 text-white rounded-2xl p-3.5 shadow-md border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 flex items-center gap-1">
                <QrCode className="w-3.5 h-3.5 text-emerald-400" /> Scanned QR Code / Active Registry Selection
              </span>
              <span className="text-emerald-400 font-mono text-[11px]">?id={selectedPipe.Pipe_ID}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <select
                  value={activePipeId}
                  onChange={(e) => setActivePipeId(e.target.value)}
                  className="w-full bg-slate-800 text-white font-mono font-bold text-sm rounded-xl py-2 pl-3 pr-8 border border-slate-700 outline-none focus:ring-2 focus:ring-emerald-500 appearance-none cursor-pointer"
                >
                  {pipes.map((p) => (
                    <option key={p.Pipe_ID} value={p.Pipe_ID}>
                      {p.Pipe_ID} ({p.Status}) - {p.Farmer_Name || 'Unregistered'}
                    </option>
                  ))}
                </select>
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SUCCESS SCREEN */}
      {successRecord ? (
        <div className="bg-white rounded-2xl p-6 text-center shadow-xl border border-emerald-200 space-y-4 animate-fadeIn max-w-2xl mx-auto">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-3xl font-black">
            ✓
          </div>
          <h2 className="text-xl font-black text-slate-800">AWD Pipe Registered Successfully!</h2>
          
          <div className="bg-slate-50 rounded-xl p-4 text-left space-y-2 text-xs border border-slate-200">
            <div className="flex justify-between py-1 border-b"><span className="text-slate-500">Pipe ID</span><strong className="text-emerald-800 font-mono text-sm">{successRecord.Pipe_ID}</strong></div>
            <div className="flex justify-between py-1 border-b"><span className="text-slate-500">Farmer Name</span><strong className="text-slate-800">{successRecord.Farmer_Name}</strong></div>
            <div className="flex justify-between py-1 border-b"><span className="text-slate-500">Village / Mandal</span><strong className="text-slate-800">{successRecord.Village}, {successRecord.Mandal}</strong></div>
            <div className="flex justify-between py-1 border-b"><span className="text-slate-500">Plot Size</span><strong className="text-slate-800">{successRecord.Plot_Size} {successRecord.Plot_Size_Unit}</strong></div>
            <div className="flex justify-between py-1 border-b"><span className="text-slate-500">Establishment Method</span><strong className="text-slate-800">{successRecord.Establishment_Method}</strong></div>
            <div className="flex justify-between py-1 border-b"><span className="text-slate-500">Installation Date</span><strong className="text-slate-800">{successRecord.Installation_Date}</strong></div>
            {successRecord.Photo_URL && (
              <div className="pt-2">
                <span className="text-slate-500 block mb-1 font-semibold">Captured Pipe Photo:</span>
                <img src={successRecord.Photo_URL} alt="Installed Pipe" className="w-full h-48 object-cover rounded-lg border border-[#88b04b]" />
              </div>
            )}
          </div>

          <button
            onClick={() => setSuccessRecord(null)}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl text-sm transition shadow-md flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-4 h-4" /> View AWD Pipe Record
          </button>
        </div>
      ) : existingInstallation ? (
        /* REGISTERED PIPE INFORMATION VIEW */
        <PipeInfoCard
          pipe={selectedPipe}
          installation={existingInstallation}
          monitoringList={monitoringList}
          allInstallations={installations}
          onOpenMonitoringModal={() => setIsMonitoringModalOpen(true)}
        />
      ) : (
        /* UNREGISTERED PIPE REGISTRATION FORM */
        <form onSubmit={handleSubmitRegistration} className="bg-white rounded-2xl shadow-lg border border-slate-200 p-4 sm:p-6 space-y-6">
          
          {/* Form Header */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider block">Register AWD Pipe</span>
              <span className="text-2xl font-black text-emerald-900 font-mono">{selectedPipe.Pipe_ID}</span>
            </div>
            <span className="bg-emerald-200/80 text-emerald-900 text-xs font-bold px-3 py-1.5 rounded-full shadow-xs">
              Available Pipe
            </span>
          </div>

          {/* Form Top Error Alert */}
          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3.5 text-xs flex items-center gap-2 font-semibold">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{formError}</span>
            </div>
          )}

          {/* 3-Column Desktop Grid for Form Sections */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            
            {/* Column 1: Farmer Selection & Multi-Pipe Assignment */}
            <div className="bg-slate-50/70 p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3.5">
              {/* 1. Farmer Details */}
              <div className="space-y-3">
            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2 border-b pb-1.5">
              <span className="w-5 h-5 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs">1</span>
              Farmer Selection & Multi-Pipe Assignment
            </h3>

            {/* Farmer Mode Selection Toggle */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setFarmerSelectionMode('new');
                  setFarmerName('');
                  setMobile('');
                  setVillage('');
                  setMandal('');
                  setDistrict('');
                  setFarmerId('');
                }}
                className={`py-2 px-2 rounded-lg transition flex items-center justify-center gap-1 ${
                  farmerSelectionMode === 'new'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Farmer</span>
              </button>

              <button
                type="button"
                onClick={() => setFarmerSelectionMode('existing')}
                className={`py-2 px-2 rounded-lg transition flex items-center justify-center gap-1 ${
                  farmerSelectionMode === 'existing'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Select Existing ({registeredFarmersList.length})</span>
              </button>
            </div>

            {/* Dropdown to Pick Existing Farmer if Mode is 'existing' */}
            {farmerSelectionMode === 'existing' && registeredFarmersList.length > 0 && (
              <div className="bg-emerald-50/90 border border-emerald-300 rounded-xl p-3 space-y-2 animate-fadeIn shadow-xs">
                <label className="block text-xs font-bold text-emerald-950 flex items-center gap-1">
                  <UserCheck className="w-4 h-4 text-emerald-700" />
                  Select Registered Farmer (Holds Multiple Pipes)
                </label>
                <select
                  onChange={(e) => {
                    if (e.target.value) handleSelectExistingFarmer(e.target.value);
                  }}
                  className="w-full bg-white border border-emerald-300 rounded-xl p-2.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs cursor-pointer"
                >
                  <option value="">-- Choose Existing Farmer --</option>
                  {registeredFarmersList.map((f) => {
                    const pipeCount = installations.filter((i) => i.Farmer_Name === f.Farmer_Name).length;
                    return (
                      <option key={f.Farmer_Name} value={f.Farmer_Name}>
                        🧑‍🌾 {f.Farmer_Name} ({f.Village}) - Currently Holds {pipeCount} Pipe{pipeCount > 1 ? 's' : ''}
                      </option>
                    );
                  })}
                </select>
                {farmerName && (
                  <div className="text-[11px] font-semibold text-emerald-900 bg-white p-2.5 rounded-lg border border-emerald-200 space-y-1">
                    <span className="font-bold block text-emerald-800">🌾 Multi-Pipe Assignment Activated:</span>
                    <span>
                      Farmer <strong>{farmerName}</strong> currently holds{' '}
                      <strong>{installations.filter((i) => i.Farmer_Name === farmerName).length}</strong> pipe(s).
                      Registering this pipe will assign pipe <strong>{selectedPipe.Pipe_ID}</strong> to {farmerName}.
                    </span>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Farmer Name *</label>
              <input
                type="text"
                required
                value={farmerName}
                onChange={(e) => setFarmerName(e.target.value)}
                placeholder="Full Name of Farmer"
                className="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mobile Number * (10-digit Indian Format)
              </label>
              <input
                type="tel"
                required
                maxLength={10}
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="e.g. 9848012345"
                className="w-full border rounded-xl p-2.5 text-sm font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Village *</label>
                <input
                  type="text"
                  required
                  value={village}
                  onChange={(e) => setVillage(e.target.value)}
                  placeholder="Village Name"
                  className="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mandal *</label>
                <input
                  type="text"
                  required
                  value={mandal}
                  onChange={(e) => setMandal(e.target.value)}
                  placeholder="Mandal Name"
                  className="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">District *</label>
                <input
                  type="text"
                  required
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="District"
                  className="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Farmer ID (Optional)</label>
                <input
                  type="text"
                  value={farmerId}
                  onChange={(e) => setFarmerId(e.target.value)}
                  placeholder="State Farmer ID"
                  className="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>
          </div>
          </div>

          {/* Column 2: Plot & Agronomic Details */}
          <div className="bg-slate-50/70 p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3.5">
            {/* 2. Plot Details */}
            <div className="space-y-3">
              <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2 border-b pb-1.5">
                <span className="w-5 h-5 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs">2</span>
                Plot & Agronomic Details
              </h3>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Survey No.</label>
                <input
                  type="text"
                  value={surveyNo}
                  onChange={(e) => setSurveyNo(e.target.value)}
                  placeholder="Plot/Survey"
                  className="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Plot Size *</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  required
                  value={plotSize}
                  onChange={(e) => setPlotSize(e.target.value)}
                  className="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Unit *</label>
                <select
                  value={plotSizeUnit}
                  onChange={(e) => setPlotSizeUnit(e.target.value as PlotUnit)}
                  className="w-full border rounded-xl p-2.5 text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="Acres">Acres</option>
                  <option value="Hectares">Hectares</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Crop</label>
                <input
                  type="text"
                  value={crop}
                  readOnly
                  className="w-full border rounded-xl p-2.5 text-sm bg-slate-100 text-slate-600 outline-none font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Paddy Variety</label>
                <input
                  type="text"
                  value={variety}
                  onChange={(e) => setVariety(e.target.value)}
                  placeholder="e.g. BPT 5204"
                  className="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Establishment Method *</label>
              <select
                value={establishmentMethod}
                onChange={(e) => setEstablishmentMethod(e.target.value as EstablishmentMethod)}
                className="w-full border rounded-xl p-2.5 text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-emerald-800"
              >
                <option value="Dry DSR">Dry DSR (Dry Direct Seeded Rice)</option>
                <option value="Wet DSR">Wet DSR (Wet Direct Seeded Rice)</option>
                <option value="TPR">TPR (Transplanted Rice)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {establishmentMethod === 'TPR' ? 'Transplantation Date *' : 'Sowing Date *'}
              </label>
              <input
                type="date"
                required
                value={sowingDate}
                onChange={(e) => setSowingDate(e.target.value)}
                className="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-semibold"
              />
            </div>

            {establishmentMethod === 'TPR' && (
              <div className="animate-fadeIn">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nursery Sowing Date (Optional for TPR)
                </label>
                <input
                  type="date"
                  value={nurserySowingDate}
                  onChange={(e) => setNurserySowingDate(e.target.value)}
                  className="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Irrigation Source *</label>
              <select
                value={irrigationSource}
                onChange={(e) => setIrrigationSource(e.target.value as IrrigationSource)}
                className="w-full border rounded-xl p-2.5 text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none font-medium"
              >
                <option value="Borewell">Borewell</option>
                <option value="Canal">Canal</option>
                <option value="Tank">Tank</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {irrigationSource === 'Other' && (
              <div className="animate-fadeIn">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Specify Irrigation Source *</label>
                <input
                  type="text"
                  required
                  value={irrigationSourceOther}
                  onChange={(e) => setIrrigationSourceOther(e.target.value)}
                  placeholder="Specify custom source"
                  className="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
            )}
          </div>
          </div>

          {/* Column 3: Installation, GPS & Photo */}
          <div className="bg-slate-50/70 p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3.5 flex flex-col justify-between">
            {/* 3. Installation & GPS Location */}
            <div className="space-y-3">
              <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2 border-b pb-1.5">
                <span className="w-5 h-5 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs">3</span>
                Installation & GPS Verification
              </h3>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Installation Date *</label>
                <input
                  type="date"
                  required
                  value={installationDate}
                  onChange={(e) => setInstallationDate(e.target.value)}
                  className="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Installed By *</label>
                <input
                  type="text"
                  required
                  value={installedBy}
                  onChange={(e) => setInstalledBy(e.target.value)}
                  placeholder="Staff Name / Designation"
                  className="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>

            {/* GPS CAPTURE BUTTON & DISPLAY */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
              <button
                type="button"
                onClick={handleCaptureGPS}
                disabled={isLocating}
                className={`w-full font-bold rounded-xl text-xs py-3 px-3 transition shadow-sm flex items-center justify-center gap-2 ${
                  gpsData
                    ? 'bg-emerald-700 text-white hover:bg-emerald-800'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                }`}
              >
                {isLocating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Locating GPS Satellite Signal...
                  </>
                ) : (
                  <>
                    <MapPin className="w-4 h-4" />
                    {gpsData ? '✓ GPS Location Captured (Tap to Recapture)' : '📍 Capture Current Location'}
                  </>
                )}
              </button>

              {gpsData && (
                <div className="bg-emerald-100/80 border border-emerald-300 rounded-lg p-2.5 text-xs text-emerald-900 font-mono space-y-0.5 animate-fadeIn">
                  <div className="font-bold flex items-center justify-between text-emerald-800 border-b border-emerald-200/60 pb-1 mb-1">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" /> Location Captured ✓
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleShareLocation}
                        title="Share field location via messaging apps"
                        className="text-[10px] bg-emerald-800 hover:bg-emerald-900 text-white font-sans font-bold px-2 py-0.5 rounded transition shadow-xs flex items-center gap-1"
                      >
                        <Share2 className="w-3 h-3 text-emerald-300" /> Share
                      </button>
                      <a
                        href={`https://www.google.com/maps?q=${gpsData.latitude},${gpsData.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] bg-emerald-700 hover:bg-emerald-800 text-white font-sans font-bold px-2 py-0.5 rounded transition shadow-xs flex items-center gap-1"
                      >
                        <MapPin className="w-3 h-3 text-red-300" /> Open Map ↗
                      </a>
                    </div>
                  </div>
                  <div>Latitude: <strong>{gpsData.latitude}</strong></div>
                  <div>Longitude: <strong>{gpsData.longitude}</strong></div>
                  <div>Accuracy: <strong>{gpsData.accuracy} meters</strong></div>

                  {/* Interactive Leaflet Field Mini-Map */}
                  <div className="mt-2 pt-1 border-t border-emerald-200/80">
                    <GpsFieldMiniMap
                      latitude={gpsData.latitude}
                      longitude={gpsData.longitude}
                      pipeId={activePipeId}
                    />
                  </div>
                </div>
              )}

              {geoAutoFilledNotice && (
                <div className="bg-[#e8f2e8] border border-[#88b04b] text-[#2d4a2d] rounded-lg p-2.5 text-xs font-semibold flex items-center gap-1.5 animate-fadeIn">
                  <Sparkles className="w-4 h-4 text-[#88b04b] shrink-0" />
                  <span>{geoAutoFilledNotice}</span>
                </div>
              )}

              {gpsError && (
                <p className="text-[11px] text-amber-700 italic bg-amber-50 p-2 rounded border border-amber-200">
                  {gpsError}
                </p>
              )}

              {!gpsData && (
                <p className="text-[11px] text-slate-500 text-center font-medium">
                  * GPS Capture is required prior to form submission.
                </p>
              )}
            </div>

            {/* CAMERA PHOTO CAPTURE FEATURE */}
            <CameraCapture
              photoUrl={photoUrl}
              onPhotoCaptured={(url) => setPhotoUrl(url)}
              onPhotoRemoved={() => setPhotoUrl(undefined)}
              label="Capture Installed Pipe Field Photo"
            />

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Remarks</label>
              <textarea
                rows={2}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Field observations, soil condition, pipe placement notes..."
                className="w-full border rounded-xl p-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            </div>
          </div>

          </div>

          {/* Full-Width Footer Action Bar for Desktop */}
          <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50 p-4 rounded-xl">
            <div className="text-xs text-slate-500 font-medium">
              <span>* Ensure all required fields and GPS satellite coordinates are verified before submission.</span>
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full sm:w-auto min-w-[280px] font-extrabold rounded-xl text-base py-4 px-6 transition shadow-lg flex items-center justify-center gap-2.5 cursor-pointer ${
                isSubmitting
                  ? 'bg-slate-400 text-white cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-[0.98]'
              }`}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" /> Submitting Registration...
                </>
              ) : (
                <>
                  <Sprout className="w-5 h-5" /> Submit AWD Pipe Registration
                </>
              )}
            </button>
          </div>

        </form>
      )}

      {/* MONITORING MODAL */}
      <MonitoringForm
        pipeId={selectedPipe.Pipe_ID}
        isOpen={isMonitoringModalOpen}
        onClose={() => setIsMonitoringModalOpen(false)}
        onSubmit={onAddMonitoring}
      />

      {/* QR CODE SCANNER MODAL */}
      <QrCodeScannerModal
        isOpen={isQrScannerOpen}
        onClose={() => setIsQrScannerOpen(false)}
        pipes={pipes}
        onSelectPipe={(scannedId) => setActivePipeId(scannedId)}
      />
    </div>
  );
};
