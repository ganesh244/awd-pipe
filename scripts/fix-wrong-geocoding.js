/**
 * fix-wrong-geocoding.js
 * One-time migration: fixes installations whose Village / Mandal / District
 * were incorrectly auto-filled as "Medchal / Ghatkesar / Medchal-Malkajgiri"
 * due to an overbroad coordinate-fallback bug.
 *
 * Usage:  node scripts/fix-wrong-geocoding.js
 * Safe to re-run (idempotent).
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import dns from 'dns';

dotenv.config();
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (_) {}

// Sangareddy district bounding box (GPS verified: Kandi 17.5812, 78.1084)
const SANGAREDDY_BBOX = { latMin: 17.20, latMax: 17.80, lngMin: 77.80, lngMax: 78.40 };

function isInSangareddyBbox(lat, lng) {
  return lat >= SANGAREDDY_BBOX.latMin && lat <= SANGAREDDY_BBOX.latMax
      && lng >= SANGAREDDY_BBOX.lngMin && lng <= SANGAREDDY_BBOX.lngMax;
}

async function reverseGeocode(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14&accept-language=en`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'AWD-Pipe-GeoFix/1.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};
      const strip = (s, re) => (s || '').replace(re, '').trim();
      return {
        village:  strip(addr.village || addr.hamlet || addr.town || 'Kandi', /\s*(village|mandal|district|gram\s*panchayat)\s*/gi),
        mandal:   strip(addr.county  || addr.subdistrict || 'Kandi',         /\s*(mandal|subdistrict|tehsil|taluk)\s*/gi),
        district: strip(addr.state_district || addr.district || 'Sangareddy', /\s*(district|zilla)\s*/gi),
        source:   'nominatim',
      };
    }
  } catch (err) {
    console.warn(`  ⚠ Nominatim failed for ${lat},${lng}: ${err.message}`);
  }
  if (isInSangareddyBbox(lat, lng)) {
    return { village: 'Kandi', mandal: 'Kandi', district: 'Sangareddy', source: 'bbox-fallback' };
  }
  return null;
}

const Installation = mongoose.model('Installation', new mongoose.Schema({}, { strict: false }), 'installations');

async function main() {
  const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!MONGO_URI) { console.error('❌  MONGODB_URI not set in .env'); process.exit(1); }

  console.log('🔌 Connecting to MongoDB Atlas...');
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected.\n');

  const wrongRecords = await Installation.find({
    $or: [{ District: 'Medchal-Malkajgiri' }, { Mandal: 'Ghatkesar' }, { Village: 'Medchal' }],
  }).lean();

  console.log(`📋 Found ${wrongRecords.length} wrong record(s).\n`);
  if (wrongRecords.length === 0) {
    console.log('✅ Nothing to fix!');
    await mongoose.disconnect();
    return;
  }

  let fixed = 0, skipped = 0, noGps = 0;

  for (const rec of wrongRecords) {
    const { Latitude: lat, Longitude: lng, Pipe_ID: pipeId = rec._id } = rec;
    if (!lat || !lng || lat === 0 || lng === 0) {
      console.log(`  ⏭  ${pipeId}: No GPS — skipping.`);
      noGps++; continue;
    }
    console.log(`  🔍 ${pipeId}: GPS ${lat},${lng}  →  currently: ${rec.Village}, ${rec.Mandal}, ${rec.District}`);
    await new Promise(r => setTimeout(r, 1100)); // Nominatim 1 req/s rate limit

    const geo = await reverseGeocode(lat, lng);
    if (!geo) { console.log(`     ⚠ Could not determine — skipping.`); skipped++; continue; }
    if (geo.village === rec.Village && geo.mandal === rec.Mandal && geo.district === rec.District) {
      console.log(`     ✓ Already correct.`); skipped++; continue;
    }
    await Installation.updateOne({ _id: rec._id }, { $set: { Village: geo.village, Mandal: geo.mandal, District: geo.district } });
    console.log(`     ✅ Fixed → ${geo.village}, ${geo.mandal}, ${geo.district}  [${geo.source}]`);
    fixed++;
  }

  console.log(`\n${'═'.repeat(35)}`);
  console.log(`✅ Fixed: ${fixed}  |  ⏭ Skipped: ${skipped}  |  📡 No GPS: ${noGps}`);
  console.log(`${'═'.repeat(35)}\n`);
  await mongoose.disconnect();
  console.log('🔌 Done!');
}

main().catch(err => { console.error('❌ Fatal:', err); process.exit(1); });
