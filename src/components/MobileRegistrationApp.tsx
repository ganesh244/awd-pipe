import React, { useState, useEffect } from 'react';
import { AWDPipe, Installation, MonitoringRecord, EstablishmentMethod, IrrigationSource, PlotUnit, GPSData, User } from '../types';
import { PipeInfoCard } from './PipeInfoCard';
import { MonitoringForm } from './MonitoringForm';
import { CameraCapture } from './CameraCapture';
import { GpsFieldMiniMap } from './GpsFieldMiniMap';
import { QrCodeScannerModal } from './QrCodeScannerModal';
import { reverseGeocodeLocation } from '../utils/geoUtils';
import { playSuccessSound } from '../utils/soundUtils';
import { MapPin, CheckCircle2, AlertTriangle, QrCode, Search, Smartphone, Sprout, ArrowRight, RefreshCw, ShieldCheck, Sparkles, Share2, Camera, UserCheck, Users, Plus, ClipboardCheck } from 'lucide-react';

interface MobileRegistrationAppProps {
  pipes: AWDPipe[];
  installations: Installation[];
  monitoringList: MonitoringRecord[];
  activePipeId: string;
  currentUser?: User;
  setActivePipeId: (id: string) => void;
  onRegisterSuccess: (installation: Installation, updatedPipe: AWDPipe) => void;
  onAddMonitoring: (record: MonitoringRecord) => void;
}

export const MobileRegistrationApp: React.FC<MobileRegistrationAppProps> = ({
  pipes,
  installations,
  monitoringList,
  activePipeId,
  currentUser,
  setActivePipeId,
  onRegisterSuccess,
  onAddMonitoring,
}) => {
  const today = new Date().toISOString().substring(0, 10);

  // Selected Pipe Object & Status
  const existingInstallation = installations.find(
    (i) => i.Pipe_ID.toUpperCase() === activePipeId.toUpperCase()
  );
  const selectedPipe =
    pipes.find((p) => p.Pipe_ID.toUpperCase() === activePipeId.toUpperCase()) ||
    (existingInstallation
      ? {
          Pipe_ID: existingInstallation.Pipe_ID,
          Batch_No: '',
          QR_URL: '',
          Status: 'Installed' as const,
          Installation_Date: existingInstallation.Installation_Date,
          Farmer_Name: existingInstallation.Farmer_Name,
          Village: existingInstallation.Village,
          District: existingInstallation.District,
        }
      : undefined);

  // Form State
  const [farmerName, setFarmerName] = useState('');
  const [mobile, setMobile] = useState('');
  const [village, setVillage] = useState('');
  const [mandal, setMandal] = useState('');
  const [district, setDistrict] = useState(currentUser?.district || 'West Godavari');
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
  const [installedBy, setInstalledBy] = useState(currentUser ? `${currentUser.name} (${currentUser.role})` : 'K. Rajesh (Field Facilitator)');
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
  const [manualPipeId, setManualPipeId] = useState('');
  const [manualError, setManualError] = useState('');
  const [currentStep, setCurrentStep] = useState(1);
  const [pipeSearch, setPipeSearch] = useState('');
  const [showPipeDropdown, setShowPipeDropdown] = useState(false);
  const [gpsIsFallback, setGpsIsFallback] = useState(false);
  const [gpsLiveAccuracy, setGpsLiveAccuracy] = useState<number | null>(null); // live accuracy shown during capture
  const [gpsSampleCount, setGpsSampleCount] = useState(0); // how many samples collected

  // Farmer Mode: 'new' or 'existing'
  const [farmerSelectionMode, setFarmerSelectionMode] = useState<'new' | 'existing'>('new');
  // Search state for existing farmer live search
  const [farmerSearch, setFarmerSearch] = useState('');

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

  // Reset registration session completely
  const resetRegistrationSession = () => {
    // NOTE: Does NOT clear successRecord — that is managed explicitly by user action only
    setFormError(null);
    
    // GPS State
    setGpsData(null);
    setGpsError(null);
    setGpsIsFallback(false);
    setGeoAutoFilledNotice(null);
    
    // Farmer State
    setFarmerSelectionMode('new');
    setFarmerName('');
    setMobile('');
    setFarmerId('');
    setVillage('');
    setMandal('');
    setDistrict('');
    
    // Plot State
    setSurveyNo('');
    setPlotSize('');
    setPlotSizeUnit('Acres');
    setCrop('Paddy');
    setVariety('');
    setEstablishmentMethod('Dry DSR');
    
    // Installation State
    setIrrigationSource('Borewell');
    setIrrigationSourceOther('');
    setInstallationDate(new Date().toISOString().split('T')[0]);
    setPhotoUrl(undefined);
    setRemarks('');
    
    // Form control
    setCurrentStep(1);
    setPipeSearch('');
  };

  // Reset form when active pipe changes
  useEffect(() => {
    // If we just completed a registration (successRecord is set), do NOT reset—
    // the user is reviewing the success screen. Reset only happens via explicit user action.
    if (successRecord) return;

    // Otherwise perform a full session reset on every activePipeId change
    resetRegistrationSession();

    if (activePipeId) {
      const currentPipe = pipes.find(p => p.Pipe_ID === activePipeId);
      // Pre-fill the district based on the newly selected pipe
      if (currentPipe && currentPipe.District) {
        const districtMap: Record<string, string> = {
          'KRM': 'Karimnagar', 'NGD': 'Nalgonda', 'KMN': 'Khammam', 'MDK': 'Medak', 'PED': 'Peddapalli',
          'HYD': 'Hyderabad', 'NZB': 'Nizamabad', 'MBN': 'Mahabubnagar', 'GNT': 'Guntur', 'VSP': 'Visakhapatnam',
          'EG': 'East Godavari', 'WG': 'West Godavari', 'KRI': 'Krishna', 'KRN': 'Kurnool', 'CTR': 'Chittoor',
          'RAI': 'Raichur', 'SHI': 'Shivamogga', 'BELL': 'Ballari', 'BLR': 'Bengaluru', 'MYS': 'Mysuru',
          'PUN': 'Pune', 'NGP': 'Nagpur', 'NSK': 'Nashik', 'MUM': 'Mumbai', 'CHE': 'Chennai',
          'CBE': 'Coimbatore', 'MDU': 'Madurai', 'SLM': 'Salem', 'LKO': 'Lucknow', 'KNP': 'Kanpur',
          'VNS': 'Varanasi', 'AGR': 'Agra', 'ADB': 'Adilabad', 'BDK': 'Bhadradri Kothagudem', 'HNK': 'Hanamkonda',
          'JGT': 'Jagtial', 'JGN': 'Jangaon', 'JSB': 'Jayashankar Bhupalpally', 'JGD': 'Jogulamba Gadwal',
          'KMR': 'Kamareddy', 'KMM': 'Khammam', 'KBA': 'Komaram Bheem Asifabad', 'MBD': 'Mahabubabad',
          'MNC': 'Mancherial', 'MED': 'Medchal-Malkajgiri', 'MLG': 'Mulugu', 'NGK': 'Nagarkurnool',
          'NLG': 'Nalgonda', 'NRP': 'Narayanpet', 'NRM': 'Nirmal', 'PDP': 'Peddapalli', 'RJS': 'Rajanna Sircilla',
          'RRD': 'Ranga Reddy', 'SRD': 'Sangareddy', 'SDP': 'Siddipet', 'SRP': 'Suryapet', 'VKB': 'Vikarabad',
          'WNP': 'Wanaparthy', 'WGL': 'Warangal', 'YDB': 'Yadadri Bhuvanagiri'
        };
        setDistrict(districtMap[currentPipe.District] || currentPipe.District);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePipeId]);

  const filteredPipes = pipes.filter((p) => {
    const term = pipeSearch.trim().toLowerCase();
    if (!term) return true;
    return (
      p.Pipe_ID.toLowerCase().includes(term) ||
      (p.Farmer_Name || '').toLowerCase().includes(term) ||
      p.Status.toLowerCase().includes(term)
    );
  });

  const validateStep = (step: number): string | null => {
    if (step === 1) {
      if (!gpsData) return 'GPS location is required. Tap "Capture Current Location" first.';
      if (gpsIsFallback) return 'Real GPS coordinates are required. Enable location permissions and recapture.';
      if (!village.trim() || !mandal.trim() || !district.trim()) return 'Village, Mandal, and District are required.';
    }
    if (step === 2) {
      if (farmerSelectionMode === 'new') {
        if (!farmerName.trim()) return 'Farmer Name is required.';
        const cleanMobile = mobile.replace(/\D/g, '');
        if (!/^[6-9]\d{9}$/.test(cleanMobile)) return 'Enter a valid 10-digit Indian mobile number.';
      }
    }
    if (step === 3) {
      if (!plotSize || Number(plotSize) <= 0) return 'Plot size must be greater than zero.';
      if (irrigationSource === 'Other' && !irrigationSourceOther.trim()) return 'Please specify the irrigation source.';
    }
    return null;
  };

  const handleNextStep = () => {
    const err = validateStep(currentStep);
    if (err) { setFormError(err); return; }
    setFormError(null);
    setCurrentStep((s) => Math.min(4, s + 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePrevStep = () => {
    setFormError(null);
    setCurrentStep((s) => Math.max(1, s - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
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

  // GPS Capture Handler — multi-sample weighted average for maximum precision
  // Collects up to REQUIRED_SAMPLES readings ≤ MAX_ACCEPT_ACCURACY m,
  // then computes an inverse-square-weighted average of lat/lng.
  const handleCaptureGPS = () => {
    setIsLocating(true);
    setGpsError(null);
    setGeoAutoFilledNotice(null);
    setGpsData(null);
    setGpsLiveAccuracy(null);
    setGpsSampleCount(0);

    const useMockGps = import.meta.env.DEV && import.meta.env.VITE_ENABLE_MOCK_GPS === 'true';

    if (useMockGps) {
      setTimeout(async () => {
        await processCapturedGPS(17.5812, 78.1084, 4);
        setIsLocating(false);
        setGpsLiveAccuracy(null);
        setGpsSampleCount(0);
      }, 800);
      return;
    }

    if (!navigator.geolocation) {
      setGpsError('GPS Location is mandatory. Please check your browser/device permissions and try again.');
      setIsLocating(false);
      return;
    }

    const REQUIRED_SAMPLES = 5;    // collect this many good samples before averaging
    const MAX_ACCEPT_ACCURACY = 30; // only accept readings ≤ 30 m
    const INSTANT_ACCEPT = 8;       // if ≤ 8 m, accept immediately (excellent lock)
    const HARD_TIMEOUT_MS = 30000;  // 30 s max wait

    const samples: { lat: number; lng: number; acc: number }[] = [];
    let watchId: number | null = null;
    let settled = false;

    // Weighted-average the collected samples (weight = 1 / acc²)
    const computeWeightedAvg = () => {
      let wLat = 0, wLng = 0, totalWeight = 0;
      for (const s of samples) {
        const w = 1 / (s.acc * s.acc);
        wLat += s.lat * w;
        wLng += s.lng * w;
        totalWeight += w;
      }
      return {
        lat: Number((wLat / totalWeight).toFixed(6)),
        lng: Number((wLng / totalWeight).toFixed(6)),
        acc: Math.round(samples.reduce((mn, s) => Math.min(mn, s.acc), Infinity)),
      };
    };

    const finish = async (lat: number, lng: number, acc: number) => {
      if (settled) return;
      settled = true;
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      clearTimeout(giveUpTimer);
      setGpsLiveAccuracy(null);
      setGpsSampleCount(0);
      await processCapturedGPS(lat, lng, acc);
      setIsLocating(false);
    };

    // Hard timeout — use best weighted average we have
    const giveUpTimer = setTimeout(() => {
      if (settled) return;
      if (samples.length > 0) {
        const avg = computeWeightedAvg();
        finish(avg.lat, avg.lng, avg.acc);
      } else {
        if (watchId !== null) navigator.geolocation.clearWatch(watchId);
        settled = true;
        setGpsLiveAccuracy(null);
        setGpsSampleCount(0);
        setGpsError('GPS Location is mandatory. Please check your browser/device permissions and try again.');
        setIsLocating(false);
      }
    }, HARD_TIMEOUT_MS);

    watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const acc = Math.round(pos.coords.accuracy);

        // Always show live accuracy so user can see it improving
        setGpsLiveAccuracy(acc);

        // Ignore very noisy readings
        if (acc > MAX_ACCEPT_ACCURACY) return;

        // Instant accept for extremely precise readings
        if (acc <= INSTANT_ACCEPT) {
          samples.push({ lat, lng, acc });
          const avg = computeWeightedAvg();
          setGpsSampleCount(samples.length);
          await finish(avg.lat, avg.lng, avg.acc);
          return;
        }

        samples.push({ lat, lng, acc });
        setGpsSampleCount(samples.length);

        // Once we have enough good samples, compute the weighted average
        if (samples.length >= REQUIRED_SAMPLES) {
          const avg = computeWeightedAvg();
          await finish(avg.lat, avg.lng, avg.acc);
        }
      },
      (_err) => {
        clearTimeout(giveUpTimer);
        if (!settled) {
          settled = true;
          if (watchId !== null) navigator.geolocation.clearWatch(watchId);
          setGpsLiveAccuracy(null);
          setGpsSampleCount(0);
          setGpsError('GPS Location is mandatory. Please check your browser/device permissions and try again.');
          setIsLocating(false);
        }
      },
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
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
        setGeoAutoFilledNotice('Google Maps location link copied to clipboard!');
      } catch (e) {
        console.error('Clipboard copy error:', e);
      }
    }
  };

  // Submit Handler
  const handleSubmitRegistration = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPipe) return;
    setFormError(null);

    // 1. Mobile number validation
    const cleanMobile = mobile.replace(/\D/g, '');
    if (!/^[6-9]\d{9}$/.test(cleanMobile)) {
      setFormError('Invalid Mobile Number! Please enter a valid 10-digit Indian mobile number starting with 6-9.');
      return;
    }

    // 2. GPS Lock Validation
    if (!gpsData) {
      setFormError('GPS Location is required! Please click "Capture Current Location" before submitting.');
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
      State: currentUser?.state || 'Andhra Pradesh',
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
      Registered_By_User_ID: currentUser?.id,
      Area_Manager_User_ID: (currentUser?.role === 'CF' || currentUser?.role === 'JCF') ? currentUser?.reportsToId : (currentUser?.role === 'Area Manager' ? currentUser?.id : undefined),
      Photo_URL: photoUrl,
      Remarks: remarks.trim() || undefined,
    };

    const updatedPipe: AWDPipe = {
      ...selectedPipe,
      Status: 'Installed',
      Installation_Date: installationDate,
      Farmer_Name: farmerName.trim(),
      Village: village.trim(),
      State: currentUser?.state || 'Andhra Pradesh',
      District: district.trim(),
    };

    setTimeout(() => {
      onRegisterSuccess(newInstallation, updatedPipe);
      setSuccessRecord(newInstallation);
      playSuccessSound();
      // NOTE: Do NOT clear activePipeId here — that would trigger resetRegistrationSession
      // which would race against the success screen. activePipeId is cleared when user
      // explicitly clicks "Register Another Pipe".
      setIsSubmitting(false);
    }, 600);
  };
  if (pipes.length === 0) {
    return (
      <div className="max-w-md mx-auto my-8 p-6 bg-white rounded-3xl shadow-xl text-center">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-800 mb-2">No Pipes Available</h2>
        <p className="text-slate-600 text-xs mb-6">
          There are no available pipes to register in your territory. Please contact your administrator.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 animate-fadeIn">
      {successRecord ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center space-y-6 animate-fadeIn max-w-2xl mx-auto">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto animate-bounce shadow-inner">
            <ShieldCheck className="w-10 h-10 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Registration Successful!</h2>
            <p className="text-emerald-700 font-semibold mt-1">Pipe {successRecord.Pipe_ID} has been successfully assigned.</p>
          </div>

          <div className="bg-slate-50 rounded-xl p-6 text-sm text-left max-w-sm mx-auto border border-slate-100 space-y-3 shadow-xs">
            <div className="flex justify-between py-1 border-b"><span className="text-slate-500">Farmer</span><strong className="text-slate-800">{successRecord.Farmer_Name}</strong></div>
            <div className="flex justify-between py-1 border-b"><span className="text-slate-500">Mobile</span><strong className="text-slate-800">{successRecord.Mobile}</strong></div>
            <div className="flex justify-between py-1 border-b"><span className="text-slate-500">Village / Mandal</span><strong className="text-slate-800">{successRecord.Village}, {successRecord.Mandal}</strong></div>
            <div className="flex justify-between py-1"><span className="text-slate-500">Plot Size</span><strong className="text-slate-800">{successRecord.Plot_Size} {successRecord.Plot_Size_Unit}</strong></div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setSuccessRecord(null);
                setActivePipeId('');
                resetRegistrationSession();
              }}
              className="w-full sm:w-auto px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-md active:scale-95 min-h-[44px]"
            >
              <QrCode className="w-5 h-5" /> Register Another Pipe
            </button>
            <button
              type="button"
              onClick={() => {
                // If they want to view it, we put it back as active pipe and clear success
                setActivePipeId(successRecord.Pipe_ID);
                setSuccessRecord(null);
              }}
              className="w-full sm:w-auto px-8 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-sm active:scale-95 min-h-[44px]"
            >
              <ClipboardCheck className="w-5 h-5" /> View Record
            </button>
          </div>
        </div>
      ) : !activePipeId ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-10 space-y-8 animate-fadeIn text-center max-w-lg mx-auto mt-4 sm:mt-12">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <QrCode className="w-10 h-10 text-emerald-600" />
          </div>
          <div className="space-y-3">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Scan Pipe QR</h2>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">
              Scan the QR code on the AWD pipe to verify its identity and begin the registration workflow.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsQrScannerOpen(true)}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-4 px-6 rounded-xl text-lg transition-all shadow-md active:scale-95 flex items-center justify-center gap-3 min-h-[56px]"
          >
            <QrCode className="w-6 h-6" /> Scan Now
          </button>
          
          <div className="pt-6 border-t border-slate-100">
            <p className="text-sm text-slate-500 mb-3 text-left">Can't scan the QR? Enter Pipe ID manually</p>
            <div className="flex gap-2">
              <input 
                type="text"
                placeholder="AWD-XXXX"
                value={manualPipeId}
                onChange={(e) => {
                  setManualError('');
                  setManualPipeId(e.target.value.toUpperCase());
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && manualPipeId.trim()) {
                    e.preventDefault();
                    const id = manualPipeId.trim().toUpperCase();
                    if (!id.startsWith('AWD-')) {
                      setManualError('Pipe ID must start with AWD- (e.g. AWD-1234)');
                      return;
                    }
                    const existingPipe = pipes.find((p) => p.Pipe_ID.toUpperCase() === id);
                    const existingInst = installations.find((i) => i.Pipe_ID.toUpperCase() === id);

                    if (!existingPipe && !existingInst) {
                      setManualError('Pipe ID not found in registry.');
                      return;
                    }
                    if (existingInst || (existingPipe && existingPipe.Status === 'Installed')) {
                      // Already installed — open its card for visit logging
                      setActivePipeId(existingInst ? existingInst.Pipe_ID : existingPipe!.Pipe_ID);
                      setManualPipeId('');
                      return;
                    }
                    if (existingPipe && existingPipe.Status !== 'Available') {
                      setManualError(`Pipe status is "${existingPipe.Status}". Only Available pipes can be registered.`);
                      return;
                    }
                    setActivePipeId(existingPipe!.Pipe_ID);
                    setManualPipeId('');
                  }
                }}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-mono font-bold text-slate-800 uppercase focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={() => {
                  const id = manualPipeId.trim().toUpperCase();
                  if (!id.startsWith('AWD-')) {
                    setManualError('Pipe ID must start with AWD- (e.g. AWD-1234)');
                    return;
                  }
                  const existingPipe = pipes.find((p) => p.Pipe_ID.toUpperCase() === id);
                  const existingInst = installations.find((i) => i.Pipe_ID.toUpperCase() === id);

                  if (!existingPipe && !existingInst) {
                    setManualError('Pipe ID not found in registry.');
                    return;
                  }
                  if (existingInst || (existingPipe && existingPipe.Status === 'Installed')) {
                    // Already installed — open its card for visit logging
                    setActivePipeId(existingInst ? existingInst.Pipe_ID : existingPipe!.Pipe_ID);
                    setManualPipeId('');
                    return;
                  }
                  if (existingPipe && existingPipe.Status !== 'Available') {
                    setManualError(`Pipe status is "${existingPipe.Status}". Only Available pipes can be registered.`);
                    return;
                  }
                  setActivePipeId(existingPipe!.Pipe_ID);
                  setManualPipeId('');
                }}
                disabled={!manualPipeId.trim()}
                className="bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-sm active:scale-95"
              >
                Verify
              </button>
            </div>
            {manualError && (
              <p className="text-red-500 text-xs text-left mt-2 font-semibold flex items-center gap-1 animate-fadeIn">
                <AlertTriangle className="w-3 h-3" /> {manualError}
              </p>
            )}
          </div>
        </div>
      ) : existingInstallation && selectedPipe ? (
        <PipeInfoCard
          pipe={selectedPipe}
          installation={existingInstallation}
          monitoringList={monitoringList}
          allInstallations={installations}
          onOpenMonitoringModal={() => setIsMonitoringModalOpen(true)}
          onClose={() => setActivePipeId('')}
        />
      ) : (
        /* UNREGISTERED PIPE REGISTRATION FORM */
        <div className="relative">
          {/* COMPACT STICKY PIPE CONTEXT BAR */}
          <div className="sticky top-0 z-30 bg-emerald-50 border-b border-emerald-200 px-4 py-3 flex items-center justify-between shadow-sm sm:rounded-t-2xl">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <div className="flex flex-col">
                <span className="text-[10px] text-emerald-700 font-bold uppercase leading-tight">Selected Pipe</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-emerald-900 font-black text-sm">{selectedPipe?.Pipe_ID}</span>
                  <span className="text-[10px] bg-emerald-200 text-emerald-900 px-1.5 py-0.5 rounded shadow-xs font-bold flex items-center gap-1"><QrCode className="w-3 h-3" /> Verified</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsQrScannerOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg shadow-sm active:scale-95 transition-all flex items-center justify-center text-xs font-bold gap-1 min-h-[44px]"
            >
              <QrCode className="w-4 h-4" /> Rescan
            </button>
          </div>

          <form onSubmit={handleSubmitRegistration} className="bg-white sm:rounded-b-2xl sm:shadow-lg sm:border sm:border-slate-200 space-y-4 pb-4">

            {/* STICKY STEP INDICATOR (Fix overlap by placing it relatively or moving top-[64px]) */}
            <div className="sticky top-[64px] sm:top-[68px] z-20 bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05)]">
              {[
                { num: 1, label: 'Location' },
                { num: 2, label: 'Farmer' },
                { num: 3, label: 'Plot' },
                { num: 4, label: 'Review' }
              ].map((step, idx) => (
                <div key={step.num} className="flex flex-col items-center gap-1 flex-1 relative">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold z-10 transition-colors ${currentStep === step.num ? 'bg-emerald-600 text-white ring-4 ring-emerald-100' :
                      currentStep > step.num ? 'bg-emerald-200 text-emerald-800' :
                        'bg-slate-100 text-slate-400'
                    }`}>
                    {currentStep > step.num ? <CheckCircle2 className="w-4 h-4" /> : step.num}
                  </div>
                  <span className={`text-[10px] font-bold ${currentStep === step.num ? 'text-emerald-700' :
                      currentStep > step.num ? 'text-emerald-600' :
                        'text-slate-400'
                    }`}>{step.label}</span>
                  {idx < 3 && (
                    <div className={`absolute top-3.5 left-1/2 w-full h-0.5 -z-0 ${currentStep > step.num ? 'bg-emerald-200' : 'bg-slate-100'
                      }`} />
                  )}
                </div>
              ))}
            </div>

            <div className="px-4 py-2">
              {formError && (
                <div role="alert" className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3.5 text-xs flex items-center gap-2 font-semibold mb-4 animate-fadeIn">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="space-y-4">
                {/* STEP 1: LOCATION (GPS & Village) */}
                {currentStep === 1 && (
                  <div className="animate-fadeIn space-y-3.5 bg-slate-50/70 p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
                    <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2 border-b pb-1.5">
                      <span className="w-5 h-5 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs">1</span>
                      Location & GPS
                    </h3>

                    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                      {gpsData ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                              <CheckCircle2 className="w-4 h-4" /> GPS Captured
                            </span>
                            <button
                              type="button"
                              onClick={handleCaptureGPS}
                              className="text-xs font-bold text-slate-500 underline hover:text-emerald-600 transition min-h-[44px] px-2"
                            >
                              Retake
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-emerald-50 p-2 rounded-lg border border-emerald-100">
                            <div><span className="text-slate-500">Lat:</span> {gpsData.latitude.toFixed(6)}</div>
                            <div><span className="text-slate-500">Lng:</span> {gpsData.longitude.toFixed(6)}</div>
                            <div className="col-span-2 text-slate-500">Accuracy: ±{Math.round(gpsData.accuracy)}m</div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <button
                            type="button"
                            onClick={handleCaptureGPS}
                            disabled={isLocating}
                            className={`w-full py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm transition active:scale-[0.98] min-h-[44px] ${isLocating ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-slate-800 text-white hover:bg-slate-700'
                              }`}
                          >
                            {isLocating ? (
                              <>
                                <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                                <span className="flex flex-col items-start leading-tight text-left">
                                  <span>
                                    {gpsLiveAccuracy !== null
                                      ? `Locking GPS... ±${gpsLiveAccuracy}m`
                                      : 'Searching for GPS signal...'}
                                  </span>
                                  {gpsSampleCount > 0 && (
                                    <span className="text-[10px] font-normal opacity-80">
                                      Samples: {gpsSampleCount}/5 — averaging for precision
                                    </span>
                                  )}
                                </span>
                              </>
                            ) : (
                              <><MapPin className="w-4 h-4" /> Capture Current Location</>
                            )}
                          </button>
                          {gpsError && (
                            <div className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-100 flex items-start gap-1">
                              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                              <span>{gpsError}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Auto-filled Location Details */}
                    <div className="space-y-3 pt-2">
                      {geoAutoFilledNotice && (
                        <div className="text-xs font-bold text-emerald-700 bg-emerald-50 p-2 rounded-lg border border-emerald-200 flex items-center gap-1.5 animate-fadeIn">
                          <Sparkles className="w-4 h-4 text-emerald-500" />
                          Location auto-filled via GPS
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="min-w-0">
                          <label className="text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                            Village * {geoAutoFilledNotice && <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1 py-0.5 rounded font-bold">✓ GPS</span>}
                          </label>
                          <input
                            type="text"
                            value={village}
                            onChange={(e) => setVillage(e.target.value)}
                            placeholder="Village Name"
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none min-h-[44px] transition"
                          />
                        </div>
                        <div className="min-w-0">
                          <label className="text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                            Mandal * {geoAutoFilledNotice && <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1 py-0.5 rounded font-bold">✓ GPS</span>}
                          </label>
                          <input
                            type="text"
                            value={mandal}
                            onChange={(e) => setMandal(e.target.value)}
                            placeholder="Mandal Name"
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none min-h-[44px] transition"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                            District * {geoAutoFilledNotice && <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1 py-0.5 rounded font-bold">✓ GPS</span>}
                          </label>
                          <input
                            type="text"
                            value={district}
                            onChange={(e) => setDistrict(e.target.value)}
                            placeholder="District Name"
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none min-h-[44px] transition"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 2: FARMER */}
                {currentStep === 2 && (
                  <div className="animate-fadeIn space-y-3.5 bg-slate-50/70 p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
                    <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2 border-b pb-1.5">
                      <span className="w-5 h-5 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs">2</span>
                      Farmer Details
                    </h3>

                    {/* Farmer Mode Selection Toggle */}
                    <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold">
                      <button
                        type="button"
                        onClick={() => {
                          setFarmerSelectionMode('new');
                          setFarmerName('');
                          setMobile('');
                          // Do NOT clear village/mandal/district because GPS provided them!
                          setFarmerId('');
                        }}
                        className={`py-2 px-2 rounded-lg flex items-center justify-center gap-1 active:scale-[0.97] transition-all ${farmerSelectionMode === 'new'
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
                        className={`py-2 px-2 rounded-lg flex items-center justify-center gap-1 active:scale-[0.97] transition-all ${farmerSelectionMode === 'existing'
                            ? 'bg-emerald-700 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                          }`}
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>Existing ({registeredFarmersList.length})</span>
                      </button>
                    </div>

                    {/* Live Search for Existing Farmer by name or mobile */}
                    {farmerSelectionMode === 'existing' && registeredFarmersList.length > 0 && (
                      <div className="bg-emerald-50/90 border border-emerald-300 rounded-xl p-3 space-y-2 animate-fadeIn shadow-xs">
                        <label className="block text-xs font-bold text-emerald-950 flex items-center gap-1">
                          <UserCheck className="w-4 h-4 text-emerald-700" />
                          Search Registered Farmer
                        </label>
                        <div className="relative">
                          <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                          <input
                            type="text"
                            value={farmerSearch}
                            onChange={(e) => setFarmerSearch(e.target.value)}
                            placeholder="Type name or mobile number..."
                            className="w-full pl-8 pr-3 py-2 text-xs border border-emerald-300 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 outline-none min-h-[44px]"
                          />
                        </div>
                        {/* Filtered results */}
                        {(() => {
                          const term = farmerSearch.trim().toLowerCase();
                          const numSearch = farmerSearch.replace(/\D/g, '');
                          const results = registeredFarmersList.filter(
                            (f) =>
                              f.Farmer_Name.toLowerCase().includes(term) ||
                              (numSearch.length > 0 && f.Mobile && f.Mobile.includes(numSearch))
                          );
                          return results.length === 0 ? (
                            <div className="text-xs text-slate-500 text-center py-2">No farmers found matching "{farmerSearch}"</div>
                          ) : (
                            <div className="max-h-48 overflow-y-auto rounded-xl border border-emerald-200 bg-white divide-y divide-slate-100">
                              {results.map((f) => {
                                const pipeCount = installations.filter((i) => i.Farmer_Name === f.Farmer_Name).length;
                                return (
                                  <button
                                    key={f.Farmer_Name}
                                    type="button"
                                    onClick={() => {
                                      handleSelectExistingFarmer(f.Farmer_Name);
                                      setFarmerSearch(f.Farmer_Name);
                                    }}
                                    className="w-full text-left px-3 py-2.5 hover:bg-emerald-50 transition text-xs active:bg-emerald-100 active:opacity-70 min-h-[44px]"
                                  >
                                    <div className="font-bold text-slate-800"><UserCheck className="w-4 h-4 inline mr-1" /> {f.Farmer_Name}</div>
                                    <div className="text-slate-500 flex items-center gap-3 mt-0.5">
                                      <span><Smartphone className="w-3.5 h-3.5 inline mr-1" /> {f.Mobile}</span>
                                      <span className="text-emerald-700 font-semibold">{pipeCount} pipe{pipeCount > 1 ? 's' : ''}</span>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    <div className="space-y-3">
                      <div className="min-w-0">
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Farmer Name *</label>
                        <input
                          type="text"
                          value={farmerName}
                          onChange={(e) => setFarmerName(e.target.value)}
                          placeholder="Full Name"
                          disabled={farmerSelectionMode === 'existing'}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none disabled:bg-slate-100 min-h-[44px] transition"
                        />
                      </div>
                      <div className="min-w-0">
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile Number *</label>
                        <input
                          type="tel"
                          value={mobile}
                          onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').substring(0, 10))}
                          placeholder="10-digit mobile"
                          disabled={farmerSelectionMode === 'existing'}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none disabled:bg-slate-100 min-h-[44px] transition"
                        />
                      </div>
                      <div className="min-w-0">
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Farmer ID (Optional)</label>
                        <input
                          type="text"
                          value={farmerId}
                          onChange={(e) => setFarmerId(e.target.value)}
                          placeholder="State Farmer ID"
                          disabled={farmerSelectionMode === 'existing'}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none disabled:bg-slate-100 min-h-[44px] transition"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 3: PLOT & CROP */}
                {currentStep === 3 && (
                  <div className="animate-fadeIn space-y-3.5 bg-slate-50/70 p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
                    <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2 border-b pb-1.5">
                      <span className="w-5 h-5 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs">3</span>
                      Plot, Crop & Installation
                    </h3>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="min-w-0 col-span-2">
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Survey No.</label>
                        <input
                          type="text"
                          value={surveyNo}
                          onChange={(e) => setSurveyNo(e.target.value)}
                          placeholder="Survey number"
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none min-h-[44px] transition"
                        />
                      </div>
                      <div className="min-w-0">
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Plot Size *</label>
                        <input
                          type="number"
                          value={plotSize}
                          onChange={(e) => setPlotSize(e.target.value)}
                          min="0.1"
                          step="0.1"
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none min-h-[44px] transition"
                        />
                      </div>
                      <div className="min-w-0">
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Unit</label>
                        <select
                          value={plotSizeUnit}
                          onChange={(e) => setPlotSizeUnit(e.target.value as PlotUnit)}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none min-h-[44px] transition"
                        >
                          <option value="Acres">Acres</option>
                          <option value="Guntas">Guntas (గుంటలు)</option>
                          <option value="Cents">Cents</option>
                          <option value="Hectares">Hectares</option>
                        </select>
                      </div>
                    </div>

                    {/* Crop & Variety */}
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div className="min-w-0">
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Crop *</label>
                        <select
                          value={crop}
                          onChange={(e) => setCrop(e.target.value)}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none min-h-[44px] transition"
                        >
                          <option value="Paddy">🌾 Paddy</option>
                          <option value="Maize">🌽 Maize</option>
                          <option value="Cotton">🌿 Cotton</option>
                          <option value="Groundnut">🥜 Groundnut</option>
                          <option value="Soybean">🫘 Soybean</option>
                          <option value="Sunflower">🌻 Sunflower</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div className="min-w-0">
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Variety</label>
                        <input
                          type="text"
                          value={variety}
                          onChange={(e) => setVariety(e.target.value)}
                          placeholder="e.g. MTU-1010, BPT-5204"
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none min-h-[44px] transition"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div className="min-w-0 col-span-2">
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Est. Method *</label>
                        <select
                          value={establishmentMethod}
                          onChange={(e) => setEstablishmentMethod(e.target.value as EstablishmentMethod)}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none min-h-[44px] transition"
                        >
                          <option value="Dry DSR">Dry DSR</option>
                          <option value="Wet DSR">Wet DSR</option>
                          <option value="Machine Transplanting">Machine Transplanting</option>
                          <option value="Manual Transplanting">Manual Transplanting</option>
                          <option value="Broadcast">Broadcast</option>
                        </select>
                      </div>
                      <div className="min-w-0">
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Sowing Date</label>
                        <input
                          type="date"
                          value={sowingDate}
                          onChange={(e) => setSowingDate(e.target.value)}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none min-h-[44px] transition"
                        />
                      </div>
                      <div className="min-w-0">
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Irrigation *</label>
                        <select
                          value={irrigationSource}
                          onChange={(e) => setIrrigationSource(e.target.value as IrrigationSource)}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none min-h-[44px] transition"
                        >
                          <option value="Borewell">Borewell</option>
                          <option value="Canal">Canal</option>
                          <option value="Tank">Tank</option>
                          <option value="Rainfed">Rainfed</option>
                          <option value="Other">Other...</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-3 pt-2">
                      <div className="min-w-0">
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Installation Date *</label>
                        <input
                          type="date"
                          value={installationDate}
                          onChange={(e) => setInstallationDate(e.target.value)}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none min-h-[44px] transition"
                        />
                      </div>
                      <div className="min-w-0">
                        <CameraCapture 
                          label="Installation Photo (Optional)"
                          photoUrl={photoUrl}
                          onPhotoCaptured={setPhotoUrl} 
                          onPhotoRemoved={() => setPhotoUrl(undefined)}
                        />
                      </div>
                      <div className="min-w-0">
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Remarks</label>
                        <textarea
                          value={remarks}
                          onChange={(e) => setRemarks(e.target.value)}
                          placeholder="Notes about the plot or installation..."
                          rows={2}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition resize-none"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 4: REVIEW */}
                {currentStep === 4 && (
                  <div className="animate-fadeIn space-y-4">
                    <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2 border-b pb-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      Review Registration
                    </h3>

                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 text-sm shadow-xs">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        <div className="col-span-2 text-xs font-bold text-slate-500 uppercase tracking-wider border-b pb-1 mt-2 mb-1">Location</div>
                        <div className="text-slate-500">GPS</div>
                        <div className="font-semibold text-emerald-700 text-right">{gpsData ? '✓ Captured' : 'No'}</div>
                        <div className="text-slate-500">Village/Mandal</div>
                        <div className="font-semibold text-slate-800 text-right">{village}, {mandal}</div>
                        <div className="text-slate-500">District</div>
                        <div className="font-semibold text-slate-800 text-right">{district}</div>

                        <div className="col-span-2 text-xs font-bold text-slate-500 uppercase tracking-wider border-b pb-1 mt-4 mb-1">Farmer Details</div>
                        <div className="text-slate-500">Name</div>
                        <div className="font-semibold text-slate-800 text-right">{farmerName}</div>
                        <div className="text-slate-500">Mobile</div>
                        <div className="font-semibold text-slate-800 text-right">{mobile}</div>

                        <div className="col-span-2 text-xs font-bold text-slate-500 uppercase tracking-wider border-b pb-1 mt-4 mb-1">Plot Details</div>
                        <div className="text-slate-500">Size</div>
                        <div className="font-semibold text-slate-800 text-right">{plotSize} {plotSizeUnit}</div>
                        <div className="text-slate-500">Crop / Method</div>
                        <div className="font-semibold text-slate-800 text-right">{crop} ({establishmentMethod})</div>

                        <div className="col-span-2 text-xs font-bold text-slate-500 uppercase tracking-wider border-b pb-1 mt-4 mb-1">Installation</div>
                        <div className="text-slate-500">Date</div>
                        <div className="font-semibold text-slate-800 text-right">{installationDate}</div>
                        <div className="text-slate-500">Photo Attached</div>
                        <div className="font-semibold text-slate-800 text-right">{photoUrl ? 'Yes' : 'No'}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* STICKY BOTTOM ACTION BAR */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-40 sm:sticky sm:bottom-0 sm:rounded-b-2xl" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
              <div className="flex items-center gap-3 max-w-7xl mx-auto">
                {currentStep > 1 && (
                  <button
                    type="button"
                    onClick={handlePrevStep}
                    className="w-1/3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-lg text-sm transition shadow-sm flex items-center justify-center min-h-[44px]"
                  >
                    Back
                  </button>
                )}

                {currentStep < 4 ? (
                  <button
                    type="button"
                    onClick={handleNextStep}
                    className={`${currentStep > 1 ? 'w-2/3' : 'w-full'} bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-lg text-sm transition shadow-sm flex items-center justify-center gap-2 min-h-[44px]`}
                  >
                    {currentStep === 3 ? 'Review' : 'Next'} <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={`w-2/3 font-extrabold rounded-lg text-sm py-3 transition shadow-md flex items-center justify-center gap-2 min-h-[44px] ${isSubmitting
                        ? 'bg-slate-400 text-white cursor-not-allowed'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-[0.98]'
                      }`}
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" /> Submitting...
                      </>
                    ) : (
                      <>
                        <Sprout className="w-5 h-5" /> Submit
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      )}

      {/* MONITORING MODAL */}{/* MONITORING MODAL */}
      {/* MONITORING MODAL */}
      <MonitoringForm
        pipeId={selectedPipe?.Pipe_ID || ''}
        isOpen={isMonitoringModalOpen}
        onClose={() => setIsMonitoringModalOpen(false)}
        onSubmit={onAddMonitoring}
        currentUser={currentUser}
      />

      {/* QR CODE SCANNER MODAL */}
      <QrCodeScannerModal
        isOpen={isQrScannerOpen}
        onClose={() => setIsQrScannerOpen(false)}
        pipes={pipes}
        installations={installations}
        onSelectPipe={(scannedId) => setActivePipeId(scannedId)}
      />
    </div>
  );
};
