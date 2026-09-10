import React, { useState, useEffect } from 'react';
import { AWDPipe, Installation, MonitoringRecord, EstablishmentMethod, IrrigationSource, PlotUnit, GPSData, User } from '../types';
import { PipeInfoCard } from './PipeInfoCard';
import { MonitoringForm } from './MonitoringForm';
const QrCodeScannerModal = React.lazy(() => import('./QrCodeScannerModal').then(m => ({ default: m.QrCodeScannerModal })));
const PlotBoundaryDrawMap = React.lazy(() => import('./PlotBoundaryDrawMap').then(m => ({ default: m.PlotBoundaryDrawMap })));
import { reverseGeocodeLocation } from '../utils/geoUtils';
import { playSuccessSound } from '../utils/soundUtils';
import { MapPin, CheckCircle2, AlertTriangle, QrCode, Search, Smartphone, Sprout, ArrowRight, RefreshCw, ShieldCheck, Sparkles, Share2, Camera, UserCheck, Users, Plus, ClipboardCheck, Hexagon } from 'lucide-react';

/** Full-screen acknowledgement while a deferred chunk (scanner, map) downloads. */
const ChunkLoadingOverlay: React.FC<{ label: string }> = ({ label }) => (
  <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex flex-col items-center justify-center gap-3 text-white" role="status" aria-live="polite">
    <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
    <span className="text-xs font-semibold">{label}</span>
  </div>
);

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

  // Plot Boundary State (polygon coordinates). Opt-in: the drawing map is not
  // mounted until the worker asks for it, so a normal registration never pays
  // for Leaflet tiles — that matters on the rural 3G these devices run on.
  const [plotBoundary, setPlotBoundary] = useState<[number, number][] | undefined>(undefined);
  const [showBoundaryDraw, setShowBoundaryDraw] = useState(false);

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
    setPlotBoundary(undefined);
    setShowBoundaryDraw(false);

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

  // GPS Capture Handler — Dual-phase for laptop + mobile compatibility
  // ─────────────────────────────────────────────────────────────────
  // PHASE 1 (always): getCurrentPosition(enableHighAccuracy:false)
  //   → Works on laptops (WiFi/IP), fast (2-4 s), accuracy 50-2000 m
  //
  // PHASE 2 (always): watchPosition(enableHighAccuracy:true)
  //   → Works on phones with GPS chip, accuracy 3-30 m
  //   → On laptops: may fail immediately with POSITION_UNAVAILABLE — that
  //     is fine because Phase 1 is already running as fallback.
  //
  // Both phases feed readings into the same sample pool.
  // First to reach accept threshold wins; Phase 2 dominates via weighting.
  // ─────────────────────────────────────────────────────────────────
  const handleCaptureGPS = () => {
    setIsLocating(true);
    setGpsError(null);
    setGeoAutoFilledNotice(null);
    setGpsData(null);
    setGpsLiveAccuracy(null);
    setGpsSampleCount(0);
    setGpsIsFallback(false);

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
      setGpsError('Location services are not supported by this browser. Please use Chrome or Firefox on your device.');
      setIsLocating(false);
      return;
    }

    const INSTANT_ACCEPT_M = 8;     // ≤8 m  → accept immediately
    const GOOD_ACCURACY_M = 50;    // ≤50 m → "good" sample (covers WiFi-on-laptop too)
    const REQUIRED_GOOD = 3;     // need 3 good samples for precise average
    const QUICK_ACCEPT_M = 200;   // ≤200 m → accept after 6 s (covers all WiFi scenarios)
    const QUICK_ACCEPT_DELAY = 6000;  // 6 s quick-accept window
    const HARD_TIMEOUT_MS = 18000; // 18 s absolute max

    const samples: { lat: number; lng: number; acc: number }[] = [];
    let goodSampleCount = 0;
    let watchId: number | null = null;
    let settled = false;
    let phase1Done = false;
    let phase2Failed = false;

    const computeWeightedAvg = (pool: typeof samples) => {
      let wLat = 0, wLng = 0, totalW = 0;
      for (const s of pool) {
        const w = 1 / (s.acc * s.acc);
        wLat += s.lat * w; wLng += s.lng * w; totalW += w;
      }
      return {
        lat: Number((wLat / totalW).toFixed(6)),
        lng: Number((wLng / totalW).toFixed(6)),
        acc: Math.round(pool.reduce((mn, s) => Math.min(mn, s.acc), Infinity)),
      };
    };

    const cleanup = () => {
      if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
      clearTimeout(hardTimer);
      clearTimeout(quickTimer);
      setGpsLiveAccuracy(null);
      setGpsSampleCount(0);
    };

    const finish = async (pool: typeof samples, isApproximate: boolean) => {
      if (settled) return;
      settled = true;
      cleanup();
      const avg = computeWeightedAvg(pool);
      setGpsIsFallback(isApproximate);
      await processCapturedGPS(avg.lat, avg.lng, avg.acc);
      setIsLocating(false);
    };

    const showPermissionError = () => {
      if (settled) return;
      settled = true;
      cleanup();
      setGpsError(
        '📵 Location permission denied.\n' +
        'Click the 🔒 lock icon in your browser address bar → Site Settings → Allow Location, then try again.'
      );
      setIsLocating(false);
    };

    const showFinalError = () => {
      if (settled) return;
      settled = true;
      cleanup();
      setGpsError(
        'Could not get your location.\n' +
        '• On laptop: Click 🔒 in address bar → Allow Location, and make sure Wi-Fi is ON\n' +
        '• On phone: Enable GPS in device Settings → Location'
      );
      setIsLocating(false);
    };

    // Shared reading handler — called by both Phase 1 and Phase 2
    const onReading = (lat: number, lng: number, acc: number) => {
      if (settled) return;
      setGpsLiveAccuracy(acc);
      samples.push({ lat, lng, acc });
      setGpsSampleCount(samples.length);

      // ① Instant-accept: excellent GPS (phone with clear sky)
      if (acc <= INSTANT_ACCEPT_M) { finish(samples, false); return; }

      // ② Collect good GPS samples, average when we have enough
      if (acc <= GOOD_ACCURACY_M) {
        goodSampleCount++;
        if (goodSampleCount >= REQUIRED_GOOD) {
          finish(samples.filter(s => s.acc <= GOOD_ACCURACY_M), false);
        }
      }
    };

    // Quick-accept: after 6 s check if we have any "usable" reading
    const quickTimer = setTimeout(() => {
      if (settled) return;
      const usable = samples.filter(s => s.acc <= QUICK_ACCEPT_M);
      if (usable.length > 0) {
        finish(usable, usable.every(s => s.acc > GOOD_ACCURACY_M));
      }
    }, QUICK_ACCEPT_DELAY);

    // Hard timeout: accept anything we have, or error
    const hardTimer = setTimeout(() => {
      if (settled) return;
      if (samples.length > 0) {
        finish(samples, samples.every(s => s.acc > GOOD_ACCURACY_M));
      } else {
        showFinalError();
      }
    }, HARD_TIMEOUT_MS);

    // ── PHASE 1: Low-accuracy (WiFi/IP) — works on all devices including laptops ──
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        phase1Done = true;
        onReading(pos.coords.latitude, pos.coords.longitude, Math.round(pos.coords.accuracy));
      },
      (err) => {
        phase1Done = true;
        // Permission denied — stop everything, no point retrying
        if (err.code === err.PERMISSION_DENIED) { showPermissionError(); }
        // else: POSITION_UNAVAILABLE or timeout — Phase 2 may still succeed
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 30000 }
    );

    // ── PHASE 2: High-accuracy (GPS chip) — best on phones, often fails on laptops ──
    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        onReading(pos.coords.latitude, pos.coords.longitude, Math.round(pos.coords.accuracy));
      },
      (err) => {
        phase2Failed = true;
        if (err.code === err.PERMISSION_DENIED) {
          showPermissionError();
          return;
        }
        // POSITION_UNAVAILABLE / timeout on laptop — Phase 1 is running as fallback
        // The quickTimer and hardTimer will pick up Phase 1's readings
        console.debug('[GPS] High-accuracy failed (expected on laptop):', err.message);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
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
      Plot_Boundary: plotBoundary,
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
      <div className="max-w-md mx-auto my-8 p-6 bg-white   text-center">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-800 mb-2">No Pipes Available</h2>
        <p className="text-slate-600 text-xs mb-6">
          There are no available pipes to register in your territory. Please contact your administrator.
        </p>
      </div>
    );
  }

  return (
    <div>
      {successRecord ? (
        <div className="p-6 text-center max-w-lg mx-auto mt-6">
          <div className="w-16 h-16 flex items-center justify-center mx-auto" style={{ background: 'var(--color-accent-100)' }}>
            <ShieldCheck className="w-8 h-8" style={{ color: 'var(--color-accent-600)' }} />
          </div>
          <h2 className="font-black mt-4" style={{ fontSize: 22 }}>Registration successful</h2>
          <p className="font-semibold mt-1" style={{ color: 'var(--color-accent-700)' }}>Pipe {successRecord.Pipe_ID} has been assigned.</p>

          <div className="awd-card mt-5 p-4 text-sm text-left">
            <div className="flex justify-between py-1.5" style={{ borderBottom: '2px solid var(--color-border-light)' }}><span style={{ color: 'var(--color-text-muted)' }}>Farmer</span><strong>{successRecord.Farmer_Name}</strong></div>
            <div className="flex justify-between py-1.5" style={{ borderBottom: '2px solid var(--color-border-light)' }}><span style={{ color: 'var(--color-text-muted)' }}>Mobile</span><strong>{successRecord.Mobile}</strong></div>
            <div className="flex justify-between py-1.5" style={{ borderBottom: '2px solid var(--color-border-light)' }}><span style={{ color: 'var(--color-text-muted)' }}>Village / Mandal</span><strong>{successRecord.Village}, {successRecord.Mandal}</strong></div>
            <div className="flex justify-between py-1.5"><span style={{ color: 'var(--color-text-muted)' }}>Plot size</span><strong>{successRecord.Plot_Size} {successRecord.Plot_Size_Unit}</strong></div>
          </div>

          <div className="flex flex-col gap-2 pt-5">
            <button
              type="button"
              onClick={() => {
                setSuccessRecord(null);
                setActivePipeId('');
                resetRegistrationSession();
              }}
              className="awd-btn-primary justify-center"
            >
              <QrCode className="w-5 h-5" /> Register another pipe
            </button>
            <button
              type="button"
              onClick={() => {
                // If they want to view it, we put it back as active pipe and clear success
                setActivePipeId(successRecord.Pipe_ID);
                setSuccessRecord(null);
              }}
              className="awd-btn-secondary justify-center"
            >
              <ClipboardCheck className="w-5 h-5" /> View record
            </button>
          </div>
        </div>
      ) : !activePipeId ? (
        <div className="p-6 sm:p-10 text-center max-w-lg mx-auto mt-4">
          <div className="w-16 h-16 flex items-center justify-center mx-auto" style={{ background: 'var(--color-accent-100)' }}>
            <QrCode className="w-8 h-8" style={{ color: 'var(--color-accent-600)' }} />
          </div>
          <h2 className="font-black mt-4" style={{ fontSize: 22 }}>Scan pipe QR</h2>
          <p className="text-sm mt-2" style={{ color: 'var(--color-text-muted)' }}>
            Scan the QR code on the AWD pipe to verify its identity and begin the registration workflow.
          </p>
          <button
            type="button"
            onClick={() => setIsQrScannerOpen(true)}
            className="awd-btn-primary justify-center w-full mt-6"
            style={{ padding: '16px 20px', fontSize: 14 }}
          >
            <QrCode className="w-5 h-5" /> Scan now
          </button>

          <div className="mt-6 pt-6 text-left" style={{ borderTop: '2px solid var(--color-border-light)' }}>
            <p className="text-sm mb-2" style={{ color: 'var(--color-text-muted)' }}>Can't scan the QR? Enter Pipe ID manually</p>
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
                className="flex-1 awd-mono font-bold uppercase outline-none px-3 py-2.5 text-sm"
                style={{ background: 'var(--color-surface-alt)', border: '2px solid var(--color-border-light)' }}
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
                className="awd-btn-primary"
                style={{ opacity: manualPipeId.trim() ? 1 : 0.4 }}
              >
                Verify
              </button>
            </div>
            {manualError && (
              <p className="text-xs mt-2 font-semibold flex items-center gap-1" style={{ color: 'var(--color-danger)' }}>
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
          <div className="sticky top-0 z-30 px-4 py-3 flex items-center justify-between" style={{ background: 'var(--color-accent-100)', borderBottom: '2px solid var(--color-border-light)' }}>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" style={{ color: 'var(--color-accent-600)' }} />
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase leading-tight" style={{ color: 'var(--color-accent-700)' }}>Selected pipe</span>
                <div className="flex items-center gap-2">
                  <span className="awd-mono font-black text-sm">{selectedPipe?.Pipe_ID}</span>
                  <span className="awd-tag awd-tag-accent"><QrCode className="w-3 h-3" /> Verified</span>
                </div>
              </div>
            </div>
            <button type="button" onClick={() => setIsQrScannerOpen(true)} className="awd-btn-primary" style={{ padding: '8px 12px', fontSize: 12 }}>
              <QrCode className="w-4 h-4" /> Rescan
            </button>
          </div>

          <form onSubmit={handleSubmitRegistration} className="pb-4">

            {/* Step indicator — numbered 01-04 bar, matching the design prototype */}
            <div className="sticky top-[52px] z-20 grid grid-cols-4" style={{ background: 'var(--color-surface)', borderBottom: '2px solid var(--color-border-light)' }}>
              {[
                { num: 1, label: 'Location' },
                { num: 2, label: 'Farmer' },
                { num: 3, label: 'Plot & crop' },
                { num: 4, label: 'Review' }
              ].map((step, idx) => {
                const isCurrent = currentStep === step.num;
                const isDone = currentStep > step.num;
                return (
                  <div
                    key={step.num}
                    className="px-2 py-2.5 text-center"
                    style={{
                      borderLeft: idx === 0 ? 'none' : '2px solid var(--color-border-light)',
                      background: isCurrent ? 'var(--color-accent-500)' : isDone ? 'var(--color-accent-100)' : 'transparent',
                    }}
                  >
                    <div className="awd-mono font-black" style={{ fontSize: 11, color: isCurrent ? '#fff' : isDone ? 'var(--color-accent-700)' : 'var(--color-text-muted)' }}>
                      {String(step.num).padStart(2, '0')}
                    </div>
                    <div className="text-[9.5px] font-bold uppercase tracking-wide mt-0.5" style={{ color: isCurrent ? '#fff' : isDone ? 'var(--color-accent-700)' : 'var(--color-text-muted)' }}>
                      {step.label}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="px-4 py-2">
              {formError && (
                <div role="alert" className="p-3.5 text-xs flex items-center gap-2 font-semibold mb-4" style={{ background: 'var(--color-danger-100)', color: 'var(--color-danger-800)', border: '2px solid var(--color-danger-100)' }}>
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="space-y-4">
                {/* STEP 1: LOCATION (GPS & Village) */}
                {currentStep === 1 && (
                  <div className="animate-fadeIn space-y-3.5 bg-slate-50/70 p-4 sm:p-5  border border-slate-200 ">
                    <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2 border-b pb-1.5">
                      <span className="w-5 h-5 bg-accent-600 text-white rounded-full flex items-center justify-center text-xs">1</span>
                      Location & GPS
                    </h3>

                    <div className="bg-white p-3  border border-slate-200 ">
                      {gpsData ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-xs font-bold text-accent-700">
                              <CheckCircle2 className="w-4 h-4" /> GPS Captured
                            </span>
                            <button
                              type="button"
                              onClick={handleCaptureGPS}
                              className="text-xs font-bold text-slate-500 underline hover:text-accent-600 transition min-h-[44px] px-2"
                            >
                              Retake
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs font-mono tabular-nums bg-accent-50 p-2  border border-accent-100">
                            <div><span className="text-slate-500">Lat:</span> {gpsData.latitude.toFixed(6)}</div>
                            <div><span className="text-slate-500">Lng:</span> {gpsData.longitude.toFixed(6)}</div>
                            <div className="col-span-2 text-slate-500">Accuracy: ±{Math.round(gpsData.accuracy)}m</div>
                          </div>
                          {gpsIsFallback && (
                            <div className="flex items-center gap-1.5 text-xs bg-amber-50 border border-amber-200 text-amber-800  p-2">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                              <span><strong>Approximate location</strong> — laptop/Wi-Fi GPS detected. Use a phone for precise field coordinates.</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <button
                            type="button"
                            onClick={handleCaptureGPS}
                            disabled={isLocating}
                            className={`btn-press w-full py-3 px-4  font-bold flex items-center justify-center gap-2  transition min-h-[44px] ${isLocating ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-slate-800 text-white hover:bg-slate-700'
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
                                      Samples: {gpsSampleCount}/3 — averaging for precision
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
                        <div className="text-xs font-bold text-accent-700 bg-accent-50 p-2  border border-accent-200 flex items-center gap-1.5 animate-fadeIn">
                          <Sparkles className="w-4 h-4 text-accent-500" />
                          Location auto-filled via GPS
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="min-w-0">
                          <label className="text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                            Village * {geoAutoFilledNotice && <span className="text-[9px] bg-accent-100 text-accent-700 px-1 py-0.5 rounded font-bold">✓ GPS</span>}
                          </label>
                          <input
                            type="text"
                            value={village}
                            onChange={(e) => setVillage(e.target.value)}
                            placeholder="Village Name"
                            className="awd-input min-h-[44px]"
                          />
                        </div>
                        <div className="min-w-0">
                          <label className="text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                            Mandal * {geoAutoFilledNotice && <span className="text-[9px] bg-accent-100 text-accent-700 px-1 py-0.5 rounded font-bold">✓ GPS</span>}
                          </label>
                          <input
                            type="text"
                            value={mandal}
                            onChange={(e) => setMandal(e.target.value)}
                            placeholder="Mandal Name"
                            className="awd-input min-h-[44px]"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                            District * {geoAutoFilledNotice && <span className="text-[9px] bg-accent-100 text-accent-700 px-1 py-0.5 rounded font-bold">✓ GPS</span>}
                          </label>
                          <input
                            type="text"
                            value={district}
                            onChange={(e) => setDistrict(e.target.value)}
                            placeholder="District Name"
                            className="awd-input min-h-[44px]"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 2: FARMER */}
                {currentStep === 2 && (
                  <div className="animate-fadeIn space-y-3.5 bg-slate-50/70 p-4 sm:p-5  border border-slate-200 ">
                    <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2 border-b pb-1.5">
                      <span className="w-5 h-5 bg-accent-600 text-white rounded-full flex items-center justify-center text-xs">2</span>
                      Farmer Details
                    </h3>

                    {/* Farmer Mode Selection Toggle */}
                    <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100  border border-slate-200 text-xs font-bold">
                      <button
                        type="button"
                        onClick={() => {
                          setFarmerSelectionMode('new');
                          setFarmerName('');
                          setMobile('');
                          // Do NOT clear village/mandal/district because GPS provided them!
                          setFarmerId('');
                        }}
                        className={`py-2 px-2  flex items-center justify-center gap-1 active:scale-[0.97] transition-all ${farmerSelectionMode === 'new'
                          ? 'bg-accent-700 text-white '
                          : 'text-slate-600 hover:text-slate-900'
                          }`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>New Farmer</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFarmerSelectionMode('existing')}
                        className={`py-2 px-2  flex items-center justify-center gap-1 active:scale-[0.97] transition-all ${farmerSelectionMode === 'existing'
                          ? 'bg-accent-700 text-white '
                          : 'text-slate-600 hover:text-slate-900'
                          }`}
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>Existing ({registeredFarmersList.length})</span>
                      </button>
                    </div>

                    {/* Live Search for Existing Farmer by name or mobile */}
                    {farmerSelectionMode === 'existing' && registeredFarmersList.length > 0 && (
                      <div className="bg-accent-50/90 border border-accent-300  p-3 space-y-2 animate-fadeIn ">
                        <label className="block text-xs font-bold text-accent-950 flex items-center gap-1">
                          <UserCheck className="w-4 h-4 text-accent-700" />
                          Search Registered Farmer
                        </label>
                        <div className="relative">
                          <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                          <input
                            type="text"
                            value={farmerSearch}
                            onChange={(e) => setFarmerSearch(e.target.value)}
                            placeholder="Type name or mobile number..."
                            className="w-full pl-8 pr-3 py-2 text-xs border border-accent-300  bg-white focus:ring-2 focus:ring-accent-500 outline-none min-h-[44px]"
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
                            <div className="max-h-48 overflow-y-auto  border border-accent-200 bg-white divide-y divide-slate-100">
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
                                    className="w-full text-left px-3 py-2.5 hover:bg-accent-50 transition text-xs active:bg-accent-100 active:opacity-70 min-h-[44px]"
                                  >
                                    <div className="font-bold text-slate-800"><UserCheck className="w-4 h-4 inline mr-1" /> {f.Farmer_Name}</div>
                                    <div className="text-slate-500 flex items-center gap-3 mt-0.5">
                                      <span><Smartphone className="w-3.5 h-3.5 inline mr-1" /> {f.Mobile}</span>
                                      <span className="text-accent-700 font-semibold">{pipeCount} pipe{pipeCount > 1 ? 's' : ''}</span>
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
                          className="awd-input min-h-[44px]"
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
                          className="awd-input awd-mono min-h-[44px]"
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
                          className="awd-input min-h-[44px]"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 3: PLOT & CROP */}
                {currentStep === 3 && (
                  <div className="animate-fadeIn space-y-3.5 bg-slate-50/70 p-4 sm:p-5  border border-slate-200 ">
                    <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2 border-b pb-1.5">
                      <span className="w-5 h-5 bg-accent-600 text-white rounded-full flex items-center justify-center text-xs">3</span>
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
                          className="awd-input min-h-[44px]"
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
                          className="awd-input awd-mono min-h-[44px]"
                        />
                      </div>
                      <div className="min-w-0">
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Unit</label>
                        <select
                          value={plotSizeUnit}
                          onChange={(e) => setPlotSizeUnit(e.target.value as PlotUnit)}
                          className="awd-input min-h-[44px]"
                        >
                          <option value="Acres">Acres</option>
                          <option value="Guntas">Guntas (గుంటలు)</option>
                          <option value="Cents">Cents</option>
                          <option value="Hectares">Hectares</option>
                        </select>
                      </div>
                    </div>

                    {/* ── PLOT BOUNDARY (OPTIONAL) ── */}
                    {gpsData && (
                      <div className="pt-2">
                        {showBoundaryDraw ? (
                          <div className="space-y-2">
                            <React.Suspense
                              fallback={
                                <div className="w-full h-56 sm:h-64  border-2 border-slate-200 bg-slate-100 animate-pulse flex items-center justify-center text-xs font-semibold text-slate-500" role="status">
                                  Loading map…
                                </div>
                              }
                            >
                              <PlotBoundaryDrawMap
                                centerLat={gpsData.latitude}
                                centerLng={gpsData.longitude}
                                boundary={plotBoundary}
                                onBoundaryChange={setPlotBoundary}
                              />
                            </React.Suspense>
                            <button
                              type="button"
                              onClick={() => { setShowBoundaryDraw(false); setPlotBoundary(undefined); }}
                              className="w-full text-xs font-bold text-slate-600 hover:text-slate-800 py-2 min-h-[44px]  border border-slate-200 hover:bg-slate-50 transition"
                            >
                              Skip plot boundary
                            </button>
                          </div>
                        ) : plotBoundary && plotBoundary.length >= 3 ? (
                          <div className="flex items-center justify-between gap-2 bg-teal-50 border border-teal-200  px-3 py-2.5">
                            <span className="text-xs font-bold text-teal-800 flex items-center gap-1.5">
                              <Hexagon className="w-3.5 h-3.5" />
                              Plot boundary saved · {plotBoundary.length} points
                            </span>
                            <button
                              type="button"
                              onClick={() => setShowBoundaryDraw(true)}
                              className="text-xs font-bold text-teal-700 hover:text-teal-900 underline min-h-[44px] px-2"
                            >
                              Edit
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setShowBoundaryDraw(true)}
                            className="w-full flex items-center justify-center gap-2 text-xs font-bold text-slate-600 hover:text-accent-700 bg-slate-50 hover:bg-accent-50 border border-dashed border-slate-300 hover:border-accent-300  py-3 min-h-[44px] transition"
                          >
                            <Hexagon className="w-4 h-4" />
                            Add plot boundary
                            <span className="font-semibold text-slate-500">(optional)</span>
                          </button>
                        )}
                      </div>
                    )}

                    {/* Crop & Variety — AWD is exclusively for Paddy */}
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-semibold text-slate-700">Crop</label>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent-100 text-accent-800 text-xs font-bold border border-accent-300">
                          🌾 Paddy
                        </span>
                        <span className="text-[10px] text-slate-400 italic">(AWD is designed exclusively for Paddy)</span>
                      </div>
                      <div className="min-w-0">
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Paddy Variety</label>
                        <input
                          type="text"
                          value={variety}
                          onChange={(e) => setVariety(e.target.value)}
                          placeholder="e.g. MTU-1010, BPT-5204, Samba Mahsuri"
                          className="awd-input min-h-[44px]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div className="min-w-0 col-span-2">
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Est. Method *</label>
                        <select
                          value={establishmentMethod}
                          onChange={(e) => setEstablishmentMethod(e.target.value as EstablishmentMethod)}
                          className="awd-input min-h-[44px]"
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
                          className="awd-input min-h-[44px]"
                        />
                      </div>
                      <div className="min-w-0">
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Irrigation *</label>
                        <select
                          value={irrigationSource}
                          onChange={(e) => setIrrigationSource(e.target.value as IrrigationSource)}
                          className="awd-input min-h-[44px]"
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
                          className="awd-input min-h-[44px]"
                        />
                      </div>
                      <div className="min-w-0">
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Remarks</label>
                        <textarea
                          value={remarks}
                          onChange={(e) => setRemarks(e.target.value)}
                          placeholder="Notes about the plot or installation..."
                          rows={2}
                          className="awd-input" style={{resize:'none'}}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 4: REVIEW */}
                {currentStep === 4 && (
                  <div className="animate-fadeIn space-y-4">
                    <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2 border-b pb-2">
                      <CheckCircle2 className="w-5 h-5 text-accent-600" />
                      Review Registration
                    </h3>

                    <div className="bg-slate-50 border border-slate-200  p-4 space-y-3 text-sm ">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        <div className="col-span-2 text-xs font-bold text-slate-500 uppercase tracking-wider border-b pb-1 mt-2 mb-1">Location</div>
                        <div className="text-slate-500">GPS</div>
                        <div className="font-semibold text-accent-700 text-right">{gpsData ? '✓ Captured' : 'No'}</div>
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
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* STICKY BOTTOM ACTION BAR */}
            <div className="fixed bottom-0 left-0 right-0 z-40 sm:sticky sm:bottom-0" style={{ background: 'var(--color-surface)', borderTop: '2px solid var(--color-border-light)', paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
              <div className="flex items-center gap-2 p-3">
                {currentStep > 1 && (
                  <button type="button" onClick={handlePrevStep} className="awd-btn-secondary justify-center" style={{ flex: '0 0 33%' }}>
                    Back
                  </button>
                )}

                {currentStep < 4 ? (
                  <button type="button" onClick={handleNextStep} className="awd-btn-primary justify-center" style={{ flex: 1 }}>
                    {currentStep === 3 ? 'Review' : 'Next'} <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="awd-btn-primary justify-center"
                    style={{ flex: 1, opacity: isSubmitting ? 0.6 : 1, cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
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

      {/* QR CODE SCANNER MODAL — chunk (jsQR) is only fetched on first open */}
      {isQrScannerOpen && (
        <React.Suspense fallback={<ChunkLoadingOverlay label="Loading scanner…" />}>
          <QrCodeScannerModal
            isOpen={isQrScannerOpen}
            onClose={() => setIsQrScannerOpen(false)}
            pipes={pipes}
            installations={installations}
            onSelectPipe={(scannedId) => setActivePipeId(scannedId)}
          />
        </React.Suspense>
      )}
    </div>
  );
};
