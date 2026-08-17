export interface GeocodedLocation {
  village: string;
  mandal: string;
  district: string;
}

/**
 * Reverse Geocodes Lat/Lng coordinates into Village, Mandal, and District.
 * Uses OpenStreetMap Nominatim API with fallback to known agricultural region mapping.
 *
 * Deployment zone: Kandi village, Kandi Mandal, Sangareddy District, Telangana
 * Confirmed GPS: 17.5812, 78.1084 (Kandi village centroid)
 */
export async function reverseGeocodeLocation(lat: number, lng: number): Promise<GeocodedLocation> {
  try {
    const controller = new AbortController();
    // 6-second timeout — rural networks can be slow
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14&accept-language=en`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      const addr = data.address || {};

      // Debug: log raw address from Nominatim
      console.debug('[GeoUtils] Nominatim raw address:', addr);

      // ── Field mapping for Telangana / India (verified via OSM) ──
      // addr.village      → village name  (e.g. "Kalvemula", "Kandi")
      // addr.hamlet       → sub-village   (e.g. "Kothala", "Laxminagar")
      // addr.county       → "X mandal"    (e.g. "Kandi mandal")
      // addr.state_district → district   (e.g. "Sangareddy")

      // Village: addr.village is the most reliable for Telangana
      const rawVillage =
        addr.village ||
        addr.hamlet ||
        addr.town ||
        addr.suburb ||
        addr.neighbourhood ||
        'Kandi';

      // Mandal: addr.county = "X mandal" — strip the suffix
      const rawMandal =
        addr.county ||
        addr.subdistrict ||
        addr.city_district ||
        'Kandi';

      // District: addr.state_district is the definitive source for Telangana
      const rawDistrict =
        addr.state_district ||
        addr.district ||
        'Sangareddy';

      const village = rawVillage
        .replace(/\s*(village|mandal|district|gram\s*panchayat)\s*/gi, '')
        .trim();

      const mandal = rawMandal
        .replace(/\s*(mandal|subdistrict|tehsil|taluk)\s*/gi, '')
        .trim();

      const district = rawDistrict
        .replace(/\s*(district|zilla)\s*/gi, '')
        .trim();

      console.debug('[GeoUtils] Parsed →', { village, mandal, district });
      return { village, mandal, district };
    }
  } catch (err) {
    console.warn('[GeoUtils] Nominatim failed, using coordinate fallback. Coords:', lat, lng);
  }

  // ── Coordinate-based Fallback (ordered from most-specific to least) ──
  // GPS from the field: 17.531463, 78.098265 → Kandi mandal, Sangareddy dist.
  // Full Sangareddy district bbox approx: lat 17.20–17.80, lng 77.80–78.40

  // Kandi mandal / Sangareddy district — primary deployment zone
  if (lat >= 17.20 && lat <= 17.80 && lng >= 77.80 && lng <= 78.40) {
    return {
      village: 'Kandi',
      mandal: 'Kandi',
      district: 'Sangareddy',
    };
  }

  // Karimnagar region
  if (lat >= 18.0 && lat <= 19.5 && lng >= 78.5 && lng <= 80.5) {
    return {
      village: 'Thimmapur',
      mandal: 'Karimnagar Rural',
      district: 'Karimnagar',
    };
  }

  // Guntur / Coastal AP region
  if (lat >= 16.0 && lat <= 17.0 && lng >= 80.0 && lng <= 81.5) {
    return {
      village: 'Tenali',
      mandal: 'Tenali',
      district: 'Guntur',
    };
  }

  // Generic fallback — default to the actual project deployment zone
  return {
    village: 'Kandi',
    mandal: 'Kandi',
    district: 'Sangareddy',
  };
}
