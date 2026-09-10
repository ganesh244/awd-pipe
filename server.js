import express from 'express';
import cors from 'cors';
import compression from 'compression';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import dns from 'dns';

// Fix querySrv ETIMEOUT issues by setting public DNS servers.
// Originally only applied in development, but the same SRV-lookup timeouts can
// happen in production too (flaky ISP/network DNS resolvers) — so this now
// always runs, everywhere, to remove DNS as a variable entirely.
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  // Fail silently if environment doesn't allow custom DNS
}

import { INITIAL_PIPES, INITIAL_INSTALLATIONS, INITIAL_MONITORING } from './src/data/initialData.ts';
import { INITIAL_STATES, INITIAL_DISTRICTS, INITIAL_AREAS, INITIAL_USERS } from './src/data/hierarchyData.ts';
import { reconcileHierarchy } from './src/utils/hierarchyChain.ts';

dotenv.config();

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
// Gzip every response above 1KB. /api/init ships a large JSON payload (pipes,
// installations, monitoring records) to field devices on rural 2G/3G links —
// JSON compresses ~85-90%, so this is the single biggest transfer-time win.
// level 6 is zlib's default: near-max ratio at a fraction of the CPU of level 9,
// which matters on Render's free tier (shared CPU, 512MB).
app.use(compression({ threshold: 1024, level: 6 }));
// 10MB limit to handle compressed Base64 images and batch QR generations cleanly
app.use(express.json({ limit: '10mb' }));

// In-Memory Fallback State (when MongoDB Atlas is not connected or offline)
let inMemoryData = {
  users: [...INITIAL_USERS],
  states: [...INITIAL_STATES],
  districts: [...INITIAL_DISTRICTS],
  areas: [...INITIAL_AREAS],
  pipes: [...INITIAL_PIPES],
  installations: [...INITIAL_INSTALLATIONS],
  monitoringList: [...INITIAL_MONITORING],
  settings: { phases: [
    { id: 'phase-1', name: 'Phase 1', target: 1000 },
    { id: 'phase-2', name: 'Phase 2', target: 1000 },
    { id: 'phase-3', name: 'Phase 3', target: 1000 },
  ] },
};

// Program rollout phases (cumulative install milestones). Editable by Admins via
// PUT /api/settings/phases; served in /api/init. This default is used until an
// Admin saves their own.
const DEFAULT_PHASES = [
  { id: 'phase-1', name: 'Phase 1', target: 1000 },
  { id: 'phase-2', name: 'Phase 2', target: 1000 },
  { id: 'phase-3', name: 'Phase 3', target: 1000 },
];
const sanitizePhases = (raw) => {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const clean = raw.slice(0, 12).map((p, i) => ({
    id: String((p && p.id) || `phase-${i + 1}`),
    name: (String((p && p.name) || `Phase ${i + 1}`).trim().slice(0, 40)) || `Phase ${i + 1}`,
    target: Math.max(1, Math.min(1000000, Math.round(Number(p && p.target) || 0))),
  })).filter((p) => p.target >= 1);
  return clean.length ? clean : null;
};

let isMongoConnected = false;

// Always check readyState directly — isMongoConnected flag can go stale
// This mirrors exactly what db-stats does (and it works)
const isDbReady = () => mongoose.connection.readyState === 1 && !!mongoose.connection.db;
const getDb = () => mongoose.connection.db;

// Mongoose Schemas & Models
const UserSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  username: { type: String, required: true },
  password: { type: String },
  role: { type: String, required: true },
  email: { type: String },
  phone: { type: String },
  isActive: { type: Boolean, default: true },
  state: { type: String },
  district: { type: String },
  areaName: { type: String },
  reportsToId: { type: String },
  createdById: { type: String },
}, { timestamps: true, strict: false });

const StateSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  code: { type: String },
  managerId: { type: String },
  managerName: { type: String },
}, { timestamps: true });

const DistrictSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  stateId: { type: String },
  stateName: { type: String },
  name: { type: String, required: true },
  managerId: { type: String },
  managerName: { type: String },
}, { timestamps: true });

const AreaSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  districtId: { type: String },
  districtName: { type: String },
  stateName: { type: String },
  name: { type: String, required: true },
  managerId: { type: String },
  managerName: { type: String },
}, { timestamps: true });

const PipeSchema = new mongoose.Schema({
  Pipe_ID: { type: String, required: true, unique: true },
  Batch_No: { type: String },
  QR_URL: { type: String },
  Status: { type: String },
  Installation_Date: { type: String },
  Farmer_Name: { type: String },
  Village: { type: String },
  State: { type: String },
  District: { type: String },
  Replaced_By_Pipe_ID: { type: String },
  Replaces_Pipe_ID: { type: String },
  Status_Reason: { type: String },
  Status_Changed_Date: { type: String },
}, { timestamps: true });

const InstallationSchema = new mongoose.Schema({
  Timestamp: { type: String },
  Pipe_ID: { type: String, required: true },
  Farmer_Name: { type: String, required: true },
  Mobile: { type: String },
  Farmer_ID: { type: String },
  Village: { type: String },
  Mandal: { type: String },
  District: { type: String },
  State: { type: String },
  Survey_No: { type: String },
  Plot_Size: { type: Number },
  Plot_Size_Unit: { type: String },
  Crop: { type: String },
  Variety: { type: String },
  Establishment_Method: { type: String },
  Sowing_Transplantation_Date: { type: String },
  Nursery_Sowing_Date: { type: String },
  Irrigation_Source: { type: String },
  Installation_Date: { type: String },
  Latitude: { type: Number },
  Longitude: { type: Number },
  GPS_Accuracy: { type: Number },
  Location_Link: { type: String },
  Installed_By: { type: String },
  Registered_By_User_ID: { type: String },
  Area_Manager_User_ID: { type: String },
  Photo_URL: { type: String },
  Remarks: { type: String },
  Plot_Boundary: { type: [[Number]], default: undefined },
  Record_Status: { type: String },
  Replaced_By_Pipe_ID: { type: String },
  Replaced_Date: { type: String },
  Replacement_Reason: { type: String },
  Replaces_Pipe_ID: { type: String },
}, { timestamps: true });

const MonitoringSchema = new mongoose.Schema({
  Timestamp: { type: String },
  Pipe_ID: { type: String, required: true },
  Visit_Date: { type: String },
  Water_Level: { type: String },
  Crop_Stage: { type: String },
  AWD_Followed: { type: String },
  Pipe_Condition: { type: String },
  Visited_By: { type: String },
  Visited_By_User_ID: { type: String },
  Latitude: { type: Number },
  Longitude: { type: Number },
  Photo_URL: { type: String },
  Remarks: { type: String },
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);
const StateNode = mongoose.model('StateNode', StateSchema);
const DistrictNode = mongoose.model('DistrictNode', DistrictSchema);
const AreaNode = mongoose.model('AreaNode', AreaSchema);
const Pipe = mongoose.model('Pipe', PipeSchema);
const Installation = mongoose.model('Installation', InstallationSchema);
const MonitoringRecord = mongoose.model('MonitoringRecord', MonitoringSchema);

const SettingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  phases: { type: Array, default: undefined },
}, { timestamps: true, strict: false });
const Setting = mongoose.model('Setting', SettingSchema);

// Connect to MongoDB Atlas
// ─── Index management ────────────────────────────────────────────────────────
// Every /api/init query previously ran as a full collection scan (which is why
// they needed maxTimeMS(30000) and a 30s response cache to stay usable). These
// indexes mirror the exact filter and sort shapes used by getScopeFilter() and
// the /api/init handler, so those queries become index seeks instead.
//
// createIndex is idempotent — an existing identical index is a no-op — so this
// is safe to run on every boot. Each index is created independently so that one
// failure (e.g. an options conflict with an index mongoose already built, or
// duplicate keys blocking a unique index) never prevents the others.
const INDEX_PLAN = [
  // Scope filters are $or over these fields; createdAt backs the descending sort.
  ['installations', { Pipe_ID: 1 }],
  ['installations', { State: 1 }],
  ['installations', { District: 1, State: 1 }],
  ['installations', { Registered_By_User_ID: 1 }],
  ['installations', { createdAt: -1 }],

  // MonitoringSchema has no State/District fields, so scope narrowing for
  // monitoring records happens entirely via Visited_By_User_ID.
  ['monitoringrecords', { Pipe_ID: 1 }],
  ['monitoringrecords', { Visited_By_User_ID: 1 }],
  ['monitoringrecords', { createdAt: -1 }],

  // Pipes are filtered by Status on init and by Batch_No for batch rename/delete.
  ['pipes', { Pipe_ID: 1 }],
  ['pipes', { Status: 1 }],
  ['pipes', { Batch_No: 1 }],

  // Login looks users up by username; the hierarchy walk keys off id.
  ['users', { id: 1 }],
  ['users', { username: 1 }],

  ['statenodes', { id: 1 }],
  ['districtnodes', { id: 1 }],
  ['areanodes', { id: 1 }],
];

const ensureIndexes = async () => {
  if (!isDbReady()) return;
  const db = getDb();
  let created = 0;
  let skipped = 0;
  for (const [collection, keys] of INDEX_PLAN) {
    try {
      await db.collection(collection).createIndex(keys);
      created++;
    } catch (err) {
      // IndexOptionsConflict / IndexKeySpecsConflict just mean an equivalent
      // index already exists under different options — not a problem.
      skipped++;
      console.warn(`🟡 [Indexes] Skipped ${collection} ${JSON.stringify(keys)}: ${err?.message || err}`);
    }
  }
  console.log(`🟢 [Indexes] Ready — ${created} ensured, ${skipped} skipped.`);
};

const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.log('🟡 [MongoDB Atlas] No MONGODB_URI found in .env. Running in Local Demo Mode (In-Memory Fallback).');
    return;
  }

  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
      heartbeatFrequencyMS: 10000,
      maxPoolSize: 5,    // 5 sockets — enough for parallel Promise.all queries
      minPoolSize: 0,
      maxIdleTimeMS: 20000,  // drop idle socket after 20s (before Atlas 30s kill)
      family: 4,
    });
    console.log('🟢 [MongoDB Atlas] Successfully connected to Cloud Database (Free 512MB Tier)!');

    // Auto-seed if database is empty
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log('🌱 [MongoDB Atlas] Database empty! Seeding initial AWD Pipes, Users, and Registrations...');
      await User.insertMany(INITIAL_USERS);
      await Pipe.insertMany(INITIAL_PIPES);
      await Installation.insertMany(INITIAL_INSTALLATIONS);
      await MonitoringRecord.insertMany(INITIAL_MONITORING);
      console.log('✅ [MongoDB Atlas] Seeding complete!');
    }
    const stateCount = await StateNode.countDocuments();
    if (stateCount === 0) {
      console.log('🌱 [MongoDB Atlas] Seeding hierarchy...');
      await StateNode.insertMany(INITIAL_STATES);
      await DistrictNode.insertMany(INITIAL_DISTRICTS);
      await AreaNode.insertMany(INITIAL_AREAS);
    }

    // Build indexes after any seeding, so a first-boot seed is indexed too.
    // Not awaited: index creation must never delay the server accepting traffic.
    ensureIndexes().catch(err => console.warn('🟡 [Indexes] Setup failed:', err?.message || err));
  } catch (error) {
    console.error('🔴 [MongoDB Atlas] Connection Error:', error?.message || error);
    console.log('🟡 [MongoDB Atlas] Falling back to Local Demo Mode.');
  }
};

// Keep isMongoConnected in sync with mongoose's ACTUAL connection state, instead of a
// manually-set flag that can go stale if the connection drops mid-session.
mongoose.connection.on('connected', () => {
  isMongoConnected = true;
  console.log('🟢 [MongoDB Atlas] Connection established.');
});
mongoose.connection.on('disconnected', () => {
  isMongoConnected = false;
  console.warn('🟡 [MongoDB Atlas] Connection lost. Falling back to Local Demo Mode until reconnected.');
});
mongoose.connection.on('reconnected', () => {
  isMongoConnected = true;
  console.log('🟢 [MongoDB Atlas] Reconnected.');
});
mongoose.connection.on('error', (err) => {
  console.error('🔴 [MongoDB Atlas] Connection error:', err?.message || err);
});

connectDB();

// Safety net: if the connection ever drops and mongoose's built-in reconnection
// (bufferCommands/auto-reconnect) doesn't recover it on its own within a bit,
// actively retry rather than staying stuck in Local Demo Mode indefinitely.
setInterval(() => {
  if (!isMongoConnected && process.env.MONGODB_URI && mongoose.connection.readyState === 0) {
    console.log('🔁 [MongoDB Atlas] Attempting to reconnect...');
    connectDB();
  }
}, 30000);



const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  // Fix #3: In production a missing JWT_SECRET means every server restart generates
  // a new random secret, silently invalidating all existing sessions. Log loudly.
  console.error('╔══════════════════════════════════════════════════════════════════╗');
  console.error('║  SECURITY WARNING: JWT_SECRET is not set in your .env file.     ║');
  console.error('║  A random ephemeral secret will be used — ALL users will be      ║');
  console.error('║  logged out on every server restart. Set JWT_SECRET in .env!    ║');
  console.error('╚══════════════════════════════════════════════════════════════════╝');
}
const ACTIVE_JWT_SECRET = JWT_SECRET || crypto.randomBytes(32).toString('hex');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skipSuccessfulRequests: true,
  message: { error: 'Too many login attempts' }
});

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  jwt.verify(token, ACTIVE_JWT_SECRET, (err, user) => {
    // Fix #7: return 401 (not 403) for invalid/expired tokens.
    // The frontend checks res.status === 401 to trigger the session-expiry toast
    // and redirect to login. 403 means "forbidden" (authenticated but not allowed),
    // which is the wrong semantic and breaks the client-side expiry detection.
    if (err) return res.status(401).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

// A user record is only renderable by the client if it has both an id (used as
// the React key and for every hierarchy lookup) and a name (the display label).
// The deployed database contains at least one leftover test record missing both,
// which otherwise surfaces as a blank row in the hierarchy view. Filtering here
// hides such records from API responses WITHOUT deleting anything — the document
// stays in the collection untouched.
// Plot boundaries arrive from the field app as an array of [lat, lng] pairs.
// They are stored verbatim otherwise, so validate rather than trust: a
// malformed or very large polygon would either break the map that renders it or
// quietly eat the 512MB free tier. Anything that is not a usable polygon is
// dropped to undefined — the field is optional, so discarding a bad value is
// always safe and never blocks the registration itself.
const MAX_BOUNDARY_POINTS = 500;

const sanitizePlotBoundary = (raw) => {
  if (!Array.isArray(raw) || raw.length < 3) return undefined;
  if (raw.length > MAX_BOUNDARY_POINTS) return undefined;
  // Number(null), Number('') and Number([]) are all 0, which would silently
  // place a vertex at 0,0 instead of rejecting bad input. Only a real number or
  // a non-empty numeric string counts.
  const num = (v) => {
    if (typeof v === 'number') return v;
    if (typeof v === 'string' && v.trim() !== '') return Number(v);
    return NaN;
  };
  const cleaned = [];
  for (const point of raw) {
    if (!Array.isArray(point) || point.length !== 2) return undefined;
    const lat = num(point[0]);
    const lng = num(point[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return undefined;
    cleaned.push([lat, lng]);
  }
  return cleaned;
};

const isDisplayableUser = (u) => !!(u && u.id && u.name);

// Districts and areas whose parent node no longer exists cannot be rendered in
// the hierarchy tree — they have nothing to hang from. Rather than deleting the
// documents, they are withheld from API responses so the records stay in the
// collection and remain recoverable.
//
// The non-empty guard matters: if the parent collection ever came back empty
// (a failed or timed-out query), every child would look dangling and the whole
// hierarchy would vanish from the UI. In that case nothing is filtered.
const dropDangling = (children, parents, foreignKey) => {
  if (!Array.isArray(parents) || parents.length === 0) return children;
  const parentIds = new Set(parents.map((p) => p.id).filter(Boolean));
  return children.filter((c) => !c[foreignKey] || parentIds.has(c[foreignKey]));
};

// Recompute and persist the chain. Called after any user mutation so that
// adding, moving, or deactivating a manager re-settles everyone beneath them.
// Failures are logged and swallowed: a reconciliation problem must never turn
// an otherwise successful user save into an error for the field device.
const applyHierarchyReconciliation = async () => {
  try {
    if (!isDbReady()) {
      const changes = reconcileHierarchy(inMemoryData.users);
      changes.forEach((c) => {
        const target = inMemoryData.users.find((u) => u.id === c.id);
        if (target) target.reportsToId = c.to;
      });
      return changes;
    }
    const db = getDb();
    const users = await db.collection('users').find({}).maxTimeMS(8000).toArray();
    const changes = reconcileHierarchy(users);
    for (const c of changes) {
      await db.collection('users').updateOne({ id: c.id }, { $set: { reportsToId: c.to } });
      console.log(`🔗 [Hierarchy] ${c.role} ${c.name}: reportsTo ${c.from || '(none)'} -> ${c.to}`);
    }
    return changes;
  } catch (err) {
    console.warn('🟡 [Hierarchy] Reconciliation skipped:', err?.message || err);
    return [];
  }
};


const getScopeFilter = async (user) => {
  if (!user) return { mongo: { _id: null }, memory: () => false };

  if (user.role === 'Admin') {
    // visibleUserIds === null means "no restriction" (see /api/init).
    return { mongo: {}, memory: () => true, allUsers: null, visibleUserIds: null };
  }

  let allUsers = [];
  if (isDbReady()) {
    try {
      allUsers = await getDb().collection('users').find({}).maxTimeMS(8000).toArray();
    } catch (scopeErr) {
      console.warn('[getScopeFilter] User query timed out, using in-memory fallback:', scopeErr.message);
      allUsers = inMemoryData.users;
    }
  } else {
    allUsers = inMemoryData.users;
  }

  const subUserIds = new Set([user.id]);
  let added = true;
  while (added) {
    added = false;
    for (const u of allUsers) {
      if (subUserIds.has(u.id)) continue;
      const directReport = u.reportsToId && subUserIds.has(u.reportsToId);
      const createdReport = u.createdById && subUserIds.has(u.createdById);
      if (directReport || createdReport) {
        subUserIds.add(u.id);
        added = true;
      }
    }
  }

  // A user may see their own subtree plus their chain of superiors. The
  // ancestors are needed so the client can still resolve "reports to" names and
  // so the hierarchy view isn't rooted at an unknown parent.
  const usersById = new Map(allUsers.map(u => [u.id, u]));
  const visibleUserIds = new Set(subUserIds);
  let cursor = usersById.get(user.id);
  const guard = new Set();
  while (cursor && !guard.has(cursor.id)) {
    guard.add(cursor.id);
    const parentId = cursor.reportsToId || cursor.createdById;
    if (!parentId) break;
    visibleUserIds.add(parentId);
    cursor = usersById.get(parentId);
  }

  const subIdsArray = Array.from(subUserIds);
  const subNames = allUsers.filter(u => subUserIds.has(u.id)).map(u => (u.name || '').toLowerCase().replace(/[^a-z0-9]/g, '')).filter(Boolean);
  const nameRegexes = subNames.map(n => new RegExp(n.split('').join('.*'), 'i'));

  if (user.role === 'State Manager') {
    const s = user.state || '';
    return {
      mongo: {
        $or: [
          { State: s },
          { Registered_By_User_ID: { $in: subIdsArray } },
          { Visited_By_User_ID: { $in: subIdsArray } }
        ]
      },
      memory: (item) =>
        (item.State || '').toLowerCase() === s.toLowerCase() ||
        (item.Registered_By_User_ID && subUserIds.has(item.Registered_By_User_ID)) ||
        (item.Visited_By_User_ID && subUserIds.has(item.Visited_By_User_ID)),
      allUsers,
      visibleUserIds
    };
  }

  if (user.role === 'District Manager') {
    const d = user.district || '';
    const s = user.state || '';
    return {
      mongo: {
        $or: [
          { District: d, State: s },
          { Registered_By_User_ID: { $in: subIdsArray } },
          { Visited_By_User_ID: { $in: subIdsArray } }
        ]
      },
      memory: (item) =>
        ((item.District || '').toLowerCase() === d.toLowerCase() && (item.State || '').toLowerCase() === s.toLowerCase()) ||
        (item.Registered_By_User_ID && subUserIds.has(item.Registered_By_User_ID)) ||
        (item.Visited_By_User_ID && subUserIds.has(item.Visited_By_User_ID)),
      allUsers,
      visibleUserIds
    };
  }

  return {
    mongo: {
      $or: [
        { Registered_By_User_ID: { $in: subIdsArray } },
        { Visited_By_User_ID: { $in: subIdsArray } },
        ...(user.role === 'Area Manager' && user.areaName ? [{ Area: new RegExp('^' + user.areaName.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + '$', 'i') }] : []),
        ...(nameRegexes.length > 0 ? [{ Installed_By: { $in: nameRegexes } }] : [])
      ]
    },
    memory: (item) => {
      if (item.Registered_By_User_ID && subUserIds.has(item.Registered_By_User_ID)) return true;
      if (item.Visited_By_User_ID && subUserIds.has(item.Visited_By_User_ID)) return true;
      if (user.role === 'Area Manager' && item.Area && item.Area.toLowerCase() === (user.areaName || '').toLowerCase()) return true;
      if (item.Installed_By) {
        const iNorm = (item.Installed_By || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (subNames.some(sName => sName.length >= 2 && (iNorm.includes(sName) || sName.includes(iNorm)))) return true;
      }
      return false;
    },
    allUsers,
    visibleUserIds
  };
};

// API Endpoints

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Required' });
  try {
    // Exact match first, then a case-insensitive retry. Usernames are stored
    // lowercase, but a mobile keyboard can still capitalise or autocorrect what
    // the field worker typed; failing them over a leading capital is pure
    // friction, not security. The exact match stays first so an existing login
    // never changes which account it resolves to.
    const typed = username.trim();
    let user = null;
    if (isDbReady()) {
      const users = getDb().collection('users');
      user = await users.findOne({ username: typed }, { maxTimeMS: 8000 });
      if (!user) {
        const exact = new RegExp(`^${typed.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}$`, 'i');
        user = await users.findOne({ username: exact }, { maxTimeMS: 8000 });
      }
    } else {
      user = inMemoryData.users.find((u) => u.username === typed)
        || inMemoryData.users.find((u) => (u.username || '').toLowerCase() === typed.toLowerCase())
        || null;
    }

    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    let isValid = false;
    if (user.passwordHash) isValid = await bcrypt.compare(password, user.passwordHash);
    // Removed insecure plaintext fallback

    if (!isValid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user.id, role: user.role, state: user.state, district: user.district, areaName: user.areaName, name: user.name },
      ACTIVE_JWT_SECRET,
      { expiresIn: '4h' }
    );
    const { password: _p, passwordHash: _ph, ...safeUser } = user;
    res.json({ token, user: safeUser });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});


// Silently renew a still-valid token so an active session doesn't hard-expire
// mid-use. The frontend calls this periodically; it does NOT bypass expiry —
// authenticateToken already rejects genuinely expired/invalid tokens before this runs.
app.post('/api/refresh-token', authenticateToken, async (req, res) => {
  const newToken = jwt.sign(
    { id: req.user.id, role: req.user.role, state: req.user.state, district: req.user.district, areaName: req.user.areaName, name: req.user.name },
    ACTIVE_JWT_SECRET,
    { expiresIn: '4h' }
  );
  res.json({ token: newToken });
});

// Admin Dev Tools: GET /api/admin/db-stats -> MongoDB Database & Storage Details
app.get('/api/admin/db-stats', authenticateToken, async (req, res) => {
  if (req.user.role !== 'Admin') {
    return res.status(403).json({ error: 'Admin access required for Dev Tools' });
  }

  try {
    const isConnected = mongoose.connection.readyState === 1;

    if (isConnected && mongoose.connection.db) {
      const db = mongoose.connection.db;

      let dbStats = {};
      try {
        dbStats = await db.stats();
      } catch (err) {
        console.warn('db.stats() error:', err.message);
      }

      const collections = await db.listCollections().toArray();
      const collectionStats = [];

      for (const coll of collections) {
        try {
          const cStats = await db.command({ collStats: coll.name });
          collectionStats.push({
            name: coll.name,
            count: cStats.count || 0,
            size: cStats.size || 0,
            storageSize: cStats.storageSize || 0,
            totalIndexSize: cStats.totalIndexSize || 0,
            avgObjSize: cStats.avgObjSize || 0,
          });
        } catch {
          const count = await db.collection(coll.name).countDocuments().catch(() => 0);
          collectionStats.push({
            name: coll.name,
            count: count,
            size: count * 450,
            storageSize: count * 700,
            totalIndexSize: count * 80,
            avgObjSize: 450,
          });
        }
      }

      const mem = process.memoryUsage();

      return res.json({
        dbStatus: 'cloud',
        dbName: db.databaseName || 'awd_pipe_db',
        dataSize: dbStats.dataSize || collectionStats.reduce((a, c) => a + c.size, 0),
        storageSize: dbStats.storageSize || collectionStats.reduce((a, c) => a + c.storageSize, 0),
        indexSize: dbStats.indexSize || collectionStats.reduce((a, c) => a + c.totalIndexSize, 0),
        objectsCount: dbStats.objects || collectionStats.reduce((a, c) => a + c.count, 0),
        collectionsCount: dbStats.collections || collections.length,
        avgDocSize: dbStats.avgObjSize || 0,
        collections: collectionStats.sort((a, b) => b.size - a.size),
        system: {
          nodeVersion: process.version,
          mongooseVersion: mongoose.version,
          uptimeSeconds: Math.floor(process.uptime()),
          heapUsed: mem.heapUsed,
          heapTotal: mem.heapTotal,
          rss: mem.rss,
        },
      });
    } else {
      // In-Memory Fallback Store
      const mem = process.memoryUsage();
      const inMemCollections = [
        { name: 'users', count: inMemoryData.users.length, size: JSON.stringify(inMemoryData.users).length },
        { name: 'pipes', count: inMemoryData.pipes.length, size: JSON.stringify(inMemoryData.pipes).length },
        { name: 'installations', count: inMemoryData.installations.length, size: JSON.stringify(inMemoryData.installations).length },
        { name: 'monitoring', count: inMemoryData.monitoringList.length, size: JSON.stringify(inMemoryData.monitoringList).length },
        { name: 'statenodes', count: inMemoryData.states.length, size: JSON.stringify(inMemoryData.states).length },
        { name: 'districtnodes', count: inMemoryData.districts.length, size: JSON.stringify(inMemoryData.districts).length },
        { name: 'areanodes', count: inMemoryData.areas.length, size: JSON.stringify(inMemoryData.areas).length },
      ].map((c) => ({
        ...c,
        storageSize: Math.round(c.size * 1.4),
        totalIndexSize: Math.round(c.size * 0.15),
        avgObjSize: c.count ? Math.round(c.size / c.count) : 0,
      }));

      const totalSize = inMemCollections.reduce((a, c) => a + c.size, 0);

      return res.json({
        dbStatus: 'local',
        dbName: 'In-Memory Draft Store',
        dataSize: totalSize,
        storageSize: Math.round(totalSize * 1.4),
        indexSize: Math.round(totalSize * 0.15),
        objectsCount: inMemCollections.reduce((a, c) => a + c.count, 0),
        collectionsCount: inMemCollections.length,
        avgDocSize: Math.round(totalSize / (inMemCollections.reduce((a, c) => a + c.count, 0) || 1)),
        collections: inMemCollections.sort((a, b) => b.size - a.size),
        system: {
          nodeVersion: process.version,
          mongooseVersion: mongoose.version,
          uptimeSeconds: Math.floor(process.uptime()),
          heapUsed: mem.heapUsed,
          heapTotal: mem.heapTotal,
          rss: mem.rss,
        },
      });
    }
  } catch (err) {
    console.error('Error in /api/admin/db-stats:', err);
    res.status(500).json({ error: err.message });
  }
});

// Request coalescing for /api/init — prevent the frontend retry storm from opening
// multiple simultaneous MongoDB connections (which floods the M0 free tier)
let initInFlight = null;

// Server-side cache for /api/init — avoids re-querying MongoDB on every refresh.
// Keyed by user role+scope so different users get correct scoped data.
// Invalidated automatically on any write operation (install/pipe/user changes).
const initCache = new Map(); // key → { data, expiresAt }
const INIT_CACHE_TTL = 30 * 1000; // 30 seconds
const invalidateInitCache = () => initCache.clear();

// 1. GET /api/init -> Load all initial data for frontend
app.get('/api/init', authenticateToken, async (req, res) => {
  try {
    if (!isMongoConnected) {
      await connectDB();
    }
    const scope = await getScopeFilter(req.user);

    // Serve from cache if fresh (avoids re-querying MongoDB on every UI refresh)
    const cacheKey = `${req.user.role}|${req.user.id}`;
    const cached = initCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return res.json(cached.data);
    }

    if (isDbReady()) {
      // Use native driver (same as db-stats which always works)
      // Run all 7 queries IN PARALLEL with Promise.all — saves 4-6s vs sequential
      const MT = 30000; // 30s per query — accounts for slow India→Atlas latency on M0
      const db = getDb();
      const pipeQuery = req.user.role === 'Admin' ? {} : {
        $or: [{ Status: 'Available' }, scope.mongo]
      };

      // Non-admins get the user list that getScopeFilter already loaded for the
      // hierarchy walk, narrowed to their subtree plus their own chain of
      // superiors. This does two things: it stops every field worker from
      // downloading the entire staff directory, and it avoids a second full
      // scan of the users collection on every init.
      const usersQuery = scope.visibleUserIds === null
        ? db.collection('users').find({}).maxTimeMS(MT).toArray()
        : Promise.resolve((scope.allUsers || []).filter(u => scope.visibleUserIds.has(u.id)));

      const [users, pipes, installations, monitoringList, states, districts, areas] = await Promise.all([
        usersQuery,
        db.collection('pipes').find(pipeQuery).maxTimeMS(MT).toArray(),                              // no sort — frontend sorts; avoids full collection scan
        db.collection('installations').find(scope.mongo, { projection: { Photo_URL: 0 } }).sort({ createdAt: -1 }).maxTimeMS(MT).toArray(),
        db.collection('monitoringrecords').find(scope.mongo).sort({ createdAt: -1 }).maxTimeMS(MT).toArray(),
        db.collection('statenodes').find({}).maxTimeMS(MT).toArray(),
        db.collection('districtnodes').find({}).maxTimeMS(MT).toArray(),
        db.collection('areanodes').find({}).maxTimeMS(MT).toArray(),
      ]);

      // Clean _id and __v for clean frontend consumption, and REMOVE password hashes
      const cleanUsers = users.filter(isDisplayableUser).map(({ _id, __v, password, passwordHash, ...rest }) => rest);
      const cleanPipes = pipes.map(({ _id, __v, ...rest }) => rest);
      const cleanInstallations = installations.map(({ _id, __v, ...rest }) => rest);
      const cleanMonitoringList = monitoringList.map(({ _id, __v, ...rest }) => rest);
      const cleanStates = states.map(({ _id, __v, ...rest }) => rest);
      const cleanDistricts = districts.map(({ _id, __v, ...rest }) => rest);
      const cleanAreas = areas.map(({ _id, __v, ...rest }) => rest);

      const visibleDistricts = dropDangling(cleanDistricts, cleanStates, 'stateId');
      const visibleAreas = dropDangling(cleanAreas, visibleDistricts, 'districtId');

      const settingsDoc = await db.collection('settings').findOne({ key: 'phaseConfig' }).catch(() => null);
      const phases = sanitizePhases(settingsDoc && settingsDoc.phases) || DEFAULT_PHASES;

      const payload = {
        dbStatus: 'cloud',
        users: cleanUsers,
        pipes: cleanPipes,
        installations: cleanInstallations,
        monitoringList: cleanMonitoringList,
        states: cleanStates,
        districts: visibleDistricts,
        areas: visibleAreas,
        settings: { phases },
      };

      // Cache the result for 30s
      initCache.set(cacheKey, { data: payload, expiresAt: Date.now() + INIT_CACHE_TTL });

      return res.json(payload);
    } else {
      // In-memory fallback
      const visibleMemoryUsers = scope.visibleUserIds === null
        ? inMemoryData.users
        : inMemoryData.users.filter(u => scope.visibleUserIds.has(u.id));
      const cleanUsers = visibleMemoryUsers.filter(isDisplayableUser).map(({ password, passwordHash, ...rest }) => rest);
      const filteredPipes = req.user.role === 'Admin' ? inMemoryData.pipes : inMemoryData.pipes.filter(p => p.Status === 'Available' || scope.memory(p));

      return res.json({
        dbStatus: 'local',
        users: cleanUsers,
        pipes: filteredPipes,
        installations: inMemoryData.installations.filter(scope.memory),
        monitoringList: inMemoryData.monitoringList.filter(scope.memory),
        states: inMemoryData.states,
        districts: inMemoryData.districts,
        areas: inMemoryData.areas,
        settings: { phases: (inMemoryData.settings && inMemoryData.settings.phases) || DEFAULT_PHASES },
      });
    }
  } catch (err) {
    console.error('Error fetching init data:', err);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

// 2. POST /api/installations -> Create new field registration and update pipe
app.post('/api/installations', authenticateToken, async (req, res) => {
  const scope = await getScopeFilter(req.user);
  if (req.body.installation && !scope.memory(req.body.installation)) return res.status(403).json({ error: 'Out of scope' });
  const { installation, updatedPipe } = req.body;
  try {
    if (installation && 'Plot_Boundary' in installation) {
      installation.Plot_Boundary = sanitizePlotBoundary(installation.Plot_Boundary);
    }
    if (isMongoConnected) {
      await new Installation(installation).save();
      await Pipe.findOneAndUpdate({ Pipe_ID: updatedPipe.Pipe_ID }, updatedPipe, { upsert: true });
    } else {
      inMemoryData.installations.unshift(installation);
      inMemoryData.pipes = inMemoryData.pipes.map((p) =>
        p.Pipe_ID === updatedPipe.Pipe_ID ? updatedPipe : p
      );
    }
    invalidateInitCache(); res.json({ success: true, dbStatus: isMongoConnected ? 'cloud' : 'local' });
  } catch (err) {
    console.error('Error saving installation:', err);
    res.status(500).json({ error: 'Failed to save installation' });
  }
});

// 2a. POST /api/pipes/replace -> Swap a damaged/stolen pipe for a fresh one,
// keeping the farmer. Old pipe -> Damaged/Removed (with a link to its
// replacement); the old installation is kept as history (Record_Status
// 'Replaced'); a fresh installation carries the farmer's data onto the new pipe.
app.post('/api/pipes/replace', authenticateToken, async (req, res) => {
  const scope = await getScopeFilter(req.user);
  const { oldPipeId, newPipeId, reason } = req.body || {};
  if (!oldPipeId || !newPipeId) return res.status(400).json({ error: 'oldPipeId and newPipeId are required' });
  if (oldPipeId === newPipeId) return res.status(400).json({ error: 'New pipe must be different from the old pipe' });
  const swapReason = reason === 'Stolen' ? 'Stolen' : 'Damaged';
  const newStatus = swapReason === 'Stolen' ? 'Removed' : 'Damaged';
  const nowIso = new Date().toISOString();
  const today = nowIso.split('T')[0];

  try {
    // Load the old installation, and both pipes, from Mongo or memory.
    let oldInst, oldPipe, newPipe;
    if (isDbReady()) {
      const db = getDb();
      oldInst = await db.collection('installations').findOne({ Pipe_ID: oldPipeId, Record_Status: { $ne: 'Replaced' } });
      oldPipe = await db.collection('pipes').findOne({ Pipe_ID: oldPipeId });
      newPipe = await db.collection('pipes').findOne({ Pipe_ID: newPipeId });
    } else {
      oldInst = inMemoryData.installations.find((i) => i.Pipe_ID === oldPipeId && i.Record_Status !== 'Replaced');
      oldPipe = inMemoryData.pipes.find((p) => p.Pipe_ID === oldPipeId);
      newPipe = inMemoryData.pipes.find((p) => p.Pipe_ID === newPipeId);
    }

    if (!oldInst) return res.status(404).json({ error: 'No active installation found for the old pipe' });
    if (!newPipe) return res.status(404).json({ error: 'New pipe not found in inventory' });
    if (newPipe.Status && newPipe.Status !== 'Available') {
      return res.status(409).json({ error: `New pipe is ${newPipe.Status}, not Available` });
    }
    // Only let a user replace a pipe whose installation is within their scope.
    if (!scope.memory(oldInst)) return res.status(403).json({ error: 'Out of scope' });

    // Build the fresh installation from the old one (drop DB internals & photo).
    const { _id, __v, Photo_URL, Record_Status, Replaced_By_Pipe_ID, Replaced_Date, Replacement_Reason, Replaces_Pipe_ID, ...carry } = oldInst;
    const newInstallation = {
      ...carry,
      Pipe_ID: newPipeId,
      Timestamp: nowIso,
      Installation_Date: today,
      Record_Status: 'Active',
      Replaces_Pipe_ID: oldPipeId,
    };
    if (newInstallation.Plot_Boundary) newInstallation.Plot_Boundary = sanitizePlotBoundary(newInstallation.Plot_Boundary);

    const newPipeUpdate = {
      Status: 'Installed',
      Farmer_Name: oldInst.Farmer_Name,
      Village: oldInst.Village,
      District: oldInst.District,
      State: oldInst.State,
      Installation_Date: today,
      Replaces_Pipe_ID: oldPipeId,
    };
    const oldPipeUpdate = {
      Status: newStatus,
      Status_Reason: swapReason,
      Status_Changed_Date: today,
      Replaced_By_Pipe_ID: newPipeId,
    };
    const oldInstUpdate = {
      Record_Status: 'Replaced',
      Replaced_By_Pipe_ID: newPipeId,
      Replaced_Date: today,
      Replacement_Reason: swapReason,
    };

    if (isDbReady()) {
      const db = getDb();
      await new Installation(newInstallation).save();
      await db.collection('installations').updateOne({ Pipe_ID: oldPipeId, Record_Status: { $ne: 'Replaced' } }, { $set: oldInstUpdate });
      await db.collection('pipes').updateOne({ Pipe_ID: newPipeId }, { $set: newPipeUpdate });
      await db.collection('pipes').updateOne({ Pipe_ID: oldPipeId }, { $set: oldPipeUpdate });
    } else {
      inMemoryData.installations.unshift(newInstallation);
      const oi = inMemoryData.installations.find((i) => i.Pipe_ID === oldPipeId && i.Record_Status !== 'Replaced' && i !== newInstallation);
      if (oi) Object.assign(oi, oldInstUpdate);
      inMemoryData.pipes = inMemoryData.pipes.map((p) =>
        p.Pipe_ID === newPipeId ? { ...p, ...newPipeUpdate } :
        p.Pipe_ID === oldPipeId ? { ...p, ...oldPipeUpdate } : p
      );
    }

    invalidateInitCache();
    res.json({
      success: true,
      newInstallation,
      newPipe: { ...newPipe, ...newPipeUpdate },
      oldPipe: { ...oldPipe, ...oldPipeUpdate },
      oldInstallation: { ...oldInst, ...oldInstUpdate },
      dbStatus: isMongoConnected ? 'cloud' : 'local',
    });
  } catch (err) {
    console.error('Error replacing pipe:', err);
    res.status(500).json({ error: 'Failed to replace pipe' });
  }
});

// 1c. PUT /api/settings/phases -> Admin edits the rollout phases + targets.
app.put('/api/settings/phases', authenticateToken, async (req, res) => {
  if (req.user.role !== 'Admin') return res.status(403).json({ error: 'Admin only' });
  const clean = sanitizePhases(req.body && req.body.phases);
  if (!clean) return res.status(400).json({ error: 'phases must be a non-empty list with valid targets' });
  try {
    if (isDbReady()) {
      await getDb().collection('settings').updateOne(
        { key: 'phaseConfig' },
        { $set: { key: 'phaseConfig', phases: clean, updatedAt: new Date() } },
        { upsert: true }
      );
    } else {
      inMemoryData.settings = { phases: clean };
    }
    invalidateInitCache();
    res.json({ success: true, phases: clean, dbStatus: isMongoConnected ? 'cloud' : 'local' });
  } catch (err) {
    console.error('Error saving phases:', err);
    res.status(500).json({ error: 'Failed to save phases' });
  }
});

// 2b. PUT /api/installations/:pipeId -> Update farmer installation details
app.put('/api/installations/:pipeId', authenticateToken, async (req, res) => {
  const scope = await getScopeFilter(req.user);
  const { pipeId } = req.params;
  const targetId = decodeURIComponent(pipeId).trim();
  const updated = req.body;
  try {
    if (updated && 'Plot_Boundary' in updated) {
      updated.Plot_Boundary = sanitizePlotBoundary(updated.Plot_Boundary);
    }
    if (isMongoConnected) {
      const isObjId = mongoose.Types.ObjectId.isValid(targetId);
      const query = isObjId
        ? { $or: [{ Pipe_ID: targetId }, { _id: targetId }] }
        : { Pipe_ID: new RegExp(`^${targetId.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}$`, 'i') };

      await Installation.findOneAndUpdate({ $and: [query, scope.mongo] }, updated, { new: true });
      await Pipe.findOneAndUpdate(
        { Pipe_ID: new RegExp(`^${targetId.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}$`, 'i') },
        {
          Farmer_Name: updated.Farmer_Name,
          Village: updated.Village,
          District: updated.District,
          State: updated.State,
          Installation_Date: updated.Installation_Date,
        }
      );
    } else {
      inMemoryData.installations = inMemoryData.installations.map((i) =>
        i.Pipe_ID.toLowerCase() === targetId.toLowerCase() ? { ...i, ...updated } : i
      );
      inMemoryData.pipes = inMemoryData.pipes.map((p) =>
        p.Pipe_ID.toLowerCase() === targetId.toLowerCase()
          ? {
            ...p,
            Farmer_Name: updated.Farmer_Name,
            Village: updated.Village,
            District: updated.District,
            State: updated.State,
            Installation_Date: updated.Installation_Date,
          }
          : p
      );
    }
    invalidateInitCache(); res.json({ success: true, dbStatus: isMongoConnected ? 'cloud' : 'local' });
  } catch (err) {
    console.error('Error updating installation:', err);
    res.status(500).json({ error: 'Failed to update installation' });
  }
});

// 2b-photo. GET /api/installations/:pipeId/photo -> Fetch ONLY the Photo_URL for a specific installation
// Photo_URL is a ~400KB base64 string — excluded from /api/init to keep startup fast.
// The frontend fetches it lazily when the user opens a specific installation detail.
app.get('/api/installations/:pipeId/photo', authenticateToken, async (req, res) => {
  const targetId = decodeURIComponent(req.params.pipeId).trim();
  try {
    if (isDbReady()) {
      const doc = await getDb().collection('installations').findOne(
        { Pipe_ID: new RegExp(`^${targetId.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}$`, 'i') },
        { projection: { Photo_URL: 1, _id: 0 } }
      );
      return res.json({ Photo_URL: doc?.Photo_URL || null });
    } else {
      const inst = inMemoryData.installations.find(i => i.Pipe_ID?.toLowerCase() === targetId.toLowerCase());
      return res.json({ Photo_URL: inst?.Photo_URL || null });
    }
  } catch (err) {
    console.error('Error fetching installation photo:', err);
    res.status(500).json({ error: 'Failed to fetch photo' });
  }
});

// 2c. DELETE /api/installations/:pipeId -> Delete farmer installation record
app.delete('/api/installations/:pipeId', authenticateToken, async (req, res) => {
  const scope = await getScopeFilter(req.user);
  const { pipeId } = req.params;
  const targetId = decodeURIComponent(pipeId).trim();
  try {
    if (isMongoConnected) {
      const isObjId = mongoose.Types.ObjectId.isValid(targetId);
      const query = isObjId
        ? { $or: [{ Pipe_ID: targetId }, { _id: targetId }] }
        : { Pipe_ID: new RegExp(`^${targetId.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}$`, 'i') };

      const foundInst = await Installation.findOne({ $and: [query, scope.mongo] });
      const actualPipeId = foundInst ? foundInst.Pipe_ID : targetId;

      await Installation.deleteMany(query);

      await Pipe.findOneAndUpdate(
        { Pipe_ID: new RegExp(`^${actualPipeId.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}$`, 'i') },
        {
          Status: 'Available',
          Farmer_Name: '',
          Village: '',
          District: '',
          State: '',
          Installation_Date: '',
        }
      );

      await MonitoringRecord.deleteMany({
        Pipe_ID: new RegExp(`^${actualPipeId.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}$`, 'i'),
      });
    } else {
      inMemoryData.installations = inMemoryData.installations.filter(
        (i) => i.Pipe_ID.toLowerCase() !== targetId.toLowerCase()
      );
      inMemoryData.monitoringList = inMemoryData.monitoringList.filter(
        (m) => m.Pipe_ID.toLowerCase() !== targetId.toLowerCase()
      );
      inMemoryData.pipes = inMemoryData.pipes.map((p) =>
        p.Pipe_ID.toLowerCase() === targetId.toLowerCase()
          ? {
            ...p,
            Status: 'Available',
            Farmer_Name: '',
            Village: '',
            District: '',
            State: '',
            Installation_Date: '',
          }
          : p
      );
    }
    invalidateInitCache(); res.json({ success: true, dbStatus: isMongoConnected ? 'cloud' : 'local' });
  } catch (err) {
    console.error('Error deleting installation:', err);
    res.status(500).json({ error: 'Failed to delete installation' });
  }
});

// 2d. DELETE /api/installations/clear/all -> Clear all test installations & monitoring records
app.delete('/api/installations/clear/all', authenticateToken, async (req, res, next) => { if (req.user.role !== 'Admin') return res.status(403).json({ error: 'Admin only' }); return next(); }, async (req, res) => {
  try {
    if (isMongoConnected) {
      await Installation.deleteMany({});
      await MonitoringRecord.deleteMany({});
      await Pipe.updateMany({}, {
        Status: 'Available',
        Farmer_Name: '',
        Village: '',
        District: '',
        State: '',
        Installation_Date: '',
      });
    } else {
      inMemoryData.installations = [];
      inMemoryData.monitoringList = [];
      inMemoryData.pipes = inMemoryData.pipes.map((p) => ({
        ...p,
        Status: 'Available',
        Farmer_Name: '',
        Village: '',
        District: '',
        State: '',
        Installation_Date: '',
      }));
    }
    invalidateInitCache(); res.json({ success: true, dbStatus: isMongoConnected ? 'cloud' : 'local' });
  } catch (err) {
    console.error('Error clearing all installations:', err);
    res.status(500).json({ error: 'Failed to clear test data' });
  }
});

// 3. POST /api/monitoring -> Save monitoring log & update pipe condition
app.post('/api/monitoring', authenticateToken, async (req, res) => {
  const scope = await getScopeFilter(req.user);
  if (req.body.record && !scope.memory(req.body.record)) return res.status(403).json({ error: 'Out of scope' });
  const { record } = req.body;
  try {
    if (isMongoConnected) {
      await new MonitoringRecord(record).save();
      if (record.Pipe_Condition && record.Pipe_Condition !== 'Good') {
        await Pipe.findOneAndUpdate({ Pipe_ID: record.Pipe_ID }, { Status: record.Pipe_Condition });
      }
    } else {
      inMemoryData.monitoringList.unshift(record);
      if (record.Pipe_Condition && record.Pipe_Condition !== 'Good') {
        inMemoryData.pipes = inMemoryData.pipes.map((p) =>
          p.Pipe_ID === record.Pipe_ID ? { ...p, Status: record.Pipe_Condition } : p
        );
      }
    }
    invalidateInitCache(); res.json({ success: true, dbStatus: isMongoConnected ? 'cloud' : 'local' });
  } catch (err) {
    console.error('Error saving monitoring record:', err);
    res.status(500).json({ error: 'Failed to save monitoring log' });
  }
});

// 4. POST /api/pipes/batch -> Insert newly generated pipe batches
app.post('/api/pipes/batch', authenticateToken, async (req, res) => {
  if (req.user.role !== 'Admin') return res.status(403).json({ error: 'Admin only' });
  const { newPipes } = req.body;
  try {
    if (isMongoConnected) {
      await Pipe.insertMany(newPipes);
    } else {
      inMemoryData.pipes.unshift(...newPipes);
    }
    invalidateInitCache(); res.json({ success: true, dbStatus: isMongoConnected ? 'cloud' : 'local' });
  } catch (err) {
    console.error('Error saving batch pipes:', err);
    res.status(500).json({ error: 'Failed to save pipe batch' });
  }
});

// 4.5 PUT /api/pipes/:id -> Update an existing pipe
app.put('/api/pipes/:id', authenticateToken, async (req, res) => {
  const scope = await getScopeFilter(req.user);
  const pipeId = req.params.id;
  const updates = req.body;
  try {
    if (isMongoConnected) {
      await Pipe.findOneAndUpdate({ $and: [{ Pipe_ID: pipeId }, scope.mongo] }, updates);
    } else {
      inMemoryData.pipes = inMemoryData.pipes.map((p) =>
        p.Pipe_ID === pipeId ? { ...p, ...updates } : p
      );
    }
    invalidateInitCache(); res.json({ success: true, dbStatus: isMongoConnected ? 'cloud' : 'local' });
  } catch (err) {
    console.error('Error updating pipe:', err);
    res.status(500).json({ error: 'Failed to update pipe' });
  }
});

// 4.6 PUT /api/pipes/batch/rename -> Rename a batch
app.put('/api/pipes/batch/rename', authenticateToken, async (req, res) => {
  if (req.user.role !== 'Admin') return res.status(403).json({ error: 'Admin only' });
  const { oldBatchNo, newBatchNo } = req.body;
  try {
    if (isMongoConnected) {
      await Pipe.updateMany({ Batch_No: oldBatchNo }, { Batch_No: newBatchNo });
    } else {
      inMemoryData.pipes = inMemoryData.pipes.map((p) =>
        p.Batch_No === oldBatchNo ? { ...p, Batch_No: newBatchNo } : p
      );
    }
    invalidateInitCache(); res.json({ success: true, dbStatus: isMongoConnected ? 'cloud' : 'local' });
  } catch (err) {
    console.error('Error renaming batch:', err);
    res.status(500).json({ error: 'Failed to rename batch' });
  }
});

// 4.7 DELETE /api/pipes/batch/:batchNo -> Delete a batch
app.delete('/api/pipes/batch/:batchNo', authenticateToken, async (req, res) => {
  if (req.user.role !== 'Admin') return res.status(403).json({ error: 'Admin only' });
  const batchNo = req.params.batchNo;
  try {
    if (isMongoConnected) {
      await Pipe.deleteMany({ Batch_No: batchNo });
    } else {
      inMemoryData.pipes = inMemoryData.pipes.filter((p) => p.Batch_No !== batchNo);
    }
    invalidateInitCache(); res.json({ success: true, dbStatus: isMongoConnected ? 'cloud' : 'local' });
  } catch (err) {
    console.error('Error deleting batch:', err);
    res.status(500).json({ error: 'Failed to delete batch' });
  }
});

// 5. POST /api/users -> Add user to hierarchy
app.post('/api/users', authenticateToken, async (req, res) => {
  const { newUser, newArea } = req.body;
  if (!newUser) return res.status(400).json({ error: 'newUser required' });
  if (req.user.role !== 'Admin') {
    if (newUser.role === 'Admin') return res.status(403).json({ error: 'Cannot create Admin users' });
    const existing = isMongoConnected
      ? await User.findOne({ id: newUser.id }).lean()
      : inMemoryData.users.find(u => u.id === newUser.id);
    if (existing) return res.status(403).json({ error: 'Cannot modify existing users via this endpoint' });

    // Enforce that a manager can only create subordinates within their own region
    const norm = (s) => (s || '').toLowerCase().trim();
    if (req.user.role === 'State Manager') {
      if (newUser.role !== 'District Manager' && newUser.role !== 'Area Manager' && newUser.role !== 'CF' && newUser.role !== 'JCF') {
        return res.status(403).json({ error: 'State Manager cannot create this role' });
      }
      if (norm(newUser.state) !== norm(req.user.state)) {
        return res.status(403).json({ error: 'Cannot create users outside your state' });
      }
    } else if (req.user.role === 'District Manager') {
      if (newUser.role !== 'Area Manager' && newUser.role !== 'CF' && newUser.role !== 'JCF') {
        return res.status(403).json({ error: 'District Manager cannot create this role' });
      }
      if (norm(newUser.district) !== norm(req.user.district) || norm(newUser.state) !== norm(req.user.state)) {
        return res.status(403).json({ error: 'Cannot create users outside your district' });
      }
    } else if (req.user.role === 'Area Manager') {
      if (newUser.role !== 'CF' && newUser.role !== 'JCF') {
        return res.status(403).json({ error: 'Area Manager cannot create this role' });
      }
      if (norm(newUser.areaName) !== norm(req.user.areaName) || norm(newUser.district) !== norm(req.user.district)) {
        return res.status(403).json({ error: 'Cannot create users outside your area' });
      }
    } else {
      return res.status(403).json({ error: 'Not authorized to create users' });
    }
  }
  if (!newUser.name) {
    newUser.name = newUser.username || 'Unknown';
  }
  try {
    if (newUser.password) {
      newUser.passwordHash = bcrypt.hashSync(newUser.password, 10);
      delete newUser.password;
    }
    if (isMongoConnected) {
      // If a new area node was provided, upsert it atomically before the user
      if (newArea && newArea.id) {
        await AreaNode.findOneAndUpdate(
          { id: newArea.id },
          { $set: newArea },
          { upsert: true, returnDocument: 'after' }
        );
      }
      // Upsert user so duplicate username/id doesn't fail
      await User.findOneAndUpdate(
        { id: newUser.id },
        { $set: newUser },
        { upsert: true, returnDocument: 'after' }
      );
    } else {
      if (newArea) {
        const existingAreaIdx = inMemoryData.areas.findIndex(a => a.id === newArea.id);
        if (existingAreaIdx >= 0) inMemoryData.areas[existingAreaIdx] = newArea;
        else inMemoryData.areas.push(newArea);
      }
      const existingIdx = inMemoryData.users.findIndex(u => u.id === newUser.id);
      if (existingIdx >= 0) inMemoryData.users[existingIdx] = newUser;
      else inMemoryData.users.push(newUser);
    }
    // Adding a manager can re-parent people who previously fell back a tier.
    await applyHierarchyReconciliation();
    invalidateInitCache(); res.json({ success: true, dbStatus: isMongoConnected ? 'cloud' : 'local' });
  } catch (err) {
    console.error('Error adding user:', err);
    res.status(500).json({ error: 'Failed to add user' });
  }
});

// 6. PUT /api/users/:id -> Update user credentials/roles
app.put('/api/users/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { updatedUser } = req.body;
  if (req.user.role !== 'Admin' && req.user.id !== id) {
    return res.status(403).json({ error: 'Admin only' });
  }
  if (req.user.role !== 'Admin' && updatedUser.role && updatedUser.role !== req.user.role) {
    return res.status(403).json({ error: 'Cannot change role' });
  }
  try {
    if (updatedUser.password) {
      updatedUser.passwordHash = bcrypt.hashSync(updatedUser.password, 10);
      delete updatedUser.password;
    }
    if (isMongoConnected) {
      await User.findOneAndUpdate({ id }, updatedUser);
    } else {
      inMemoryData.users = inMemoryData.users.map((u) => (u.id === id ? updatedUser : u));
    }
    // A changed role, district or area moves this user — and possibly their
    // subordinates — to a different place in the chain.
    await applyHierarchyReconciliation();
    invalidateInitCache(); res.json({ success: true, dbStatus: isMongoConnected ? 'cloud' : 'local' });
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// 6. DELETE /api/users/:id -> Delete a user
app.delete('/api/users/:id', authenticateToken, async (req, res) => {
  const userId = req.params.id;
  try {
    if (isMongoConnected) {
      await User.findOneAndDelete({ id: userId });
      await StateNode.updateMany({ managerId: userId }, { $set: { managerId: '', managerName: '' } });
      await DistrictNode.updateMany({ managerId: userId }, { $set: { managerId: '', managerName: '' } });
      await AreaNode.updateMany({ managerId: userId }, { $set: { managerId: '', managerName: '' } });
    } else {
      inMemoryData.users = inMemoryData.users.filter(u => u.id !== userId);
      inMemoryData.states = inMemoryData.states.map(s => s.managerId === userId ? { ...s, managerId: '', managerName: '' } : s);
      inMemoryData.districts = inMemoryData.districts.map(d => d.managerId === userId ? { ...d, managerId: '', managerName: '' } : d);
      inMemoryData.areas = inMemoryData.areas.map(a => a.managerId === userId ? { ...a, managerId: '', managerName: '' } : a);
    }
    // Removing a manager would otherwise leave their subordinates pointing at a
    // parent that no longer exists; this lifts them to the next tier up.
    await applyHierarchyReconciliation();
    invalidateInitCache(); res.json({ success: true, dbStatus: isMongoConnected ? 'cloud' : 'local' });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// 7. PUT /api/hierarchy/state -> Update a state
app.put('/api/hierarchy/state', authenticateToken, async (req, res) => {
  const { id, name, managerId, managerName } = req.body;
  try {
    if (isMongoConnected) {
      await StateNode.findOneAndUpdate({ id }, { name, managerId, managerName }, { upsert: true, returnDocument: 'after' });
    } else {
      inMemoryData.states = inMemoryData.states.map((state) =>
        state.id === id ? { ...state, name, managerId, managerName } : state
      );
      inMemoryData.districts = inMemoryData.districts.map((district) =>
        district.stateId === id ? { ...district, stateName: name } : district
      );
      inMemoryData.areas = inMemoryData.areas.map((area) =>
        area.stateName === req.body.previousName ? { ...area, stateName: name } : area
      );
    }
    invalidateInitCache(); res.json({ success: true, dbStatus: isMongoConnected ? 'cloud' : 'local' });
  } catch (err) {
    console.error('Error updating state:', err);
    res.status(500).json({ error: 'Failed to update state' });
  }
});

// 8. PUT /api/hierarchy/district -> Update a district
app.put('/api/hierarchy/district', authenticateToken, async (req, res) => {
  const { id, name, stateId, stateName, managerId, managerName } = req.body;
  try {
    if (isMongoConnected) {
      await DistrictNode.findOneAndUpdate({ id }, { name, stateId, stateName, managerId, managerName }, { upsert: true, returnDocument: 'after' });
    } else {
      const previous = inMemoryData.districts.find((district) => district.id === id);
      inMemoryData.districts = inMemoryData.districts.map((district) =>
        district.id === id ? { ...district, name, stateId, stateName, managerId, managerName } : district
      );
      inMemoryData.areas = inMemoryData.areas.map((area) =>
        area.districtId === id
          ? { ...area, districtName: name, stateName }
          : area
      );
      if (previous) {
        inMemoryData.users = inMemoryData.users.map((user) =>
          user.district === previous.name ? { ...user, district: name, state: stateName || user.state } : user
        );
      }
    }
    invalidateInitCache(); res.json({ success: true, dbStatus: isMongoConnected ? 'cloud' : 'local' });
  } catch (err) {
    console.error('Error updating district:', err);
    res.status(500).json({ error: 'Failed to update district' });
  }
});

// 9. PUT /api/hierarchy/area -> Update an area
app.put('/api/hierarchy/area', authenticateToken, async (req, res) => {
  const { id, name, districtId, districtName, stateName, managerId, managerName } = req.body;
  try {
    if (isMongoConnected) {
      await AreaNode.findOneAndUpdate({ id }, { name, districtId, districtName, stateName, managerId, managerName }, { upsert: true, returnDocument: 'after' });
    } else {
      const previous = inMemoryData.areas.find((area) => area.id === id);
      inMemoryData.areas = inMemoryData.areas.map((area) =>
        area.id === id ? { ...area, name, districtId, districtName, stateName, managerId, managerName } : area
      );
      if (previous) {
        inMemoryData.users = inMemoryData.users.map((user) =>
          user.areaName === previous.name
            ? { ...user, areaName: name, district: districtName || user.district, state: stateName || user.state }
            : user
        );
      }
    }
    invalidateInitCache(); res.json({ success: true, dbStatus: isMongoConnected ? 'cloud' : 'local' });
  } catch (err) {
    console.error('Error updating area:', err);
    res.status(500).json({ error: 'Failed to update area' });
  }
});

// POST routes for creation
app.post('/api/hierarchy/states', authenticateToken, async (req, res) => {
  try {
    const newState = req.body;
    if (isMongoConnected) {
      await StateNode.create(newState);
    } else {
      inMemoryData.states.push(newState);
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to create state:', err);
    res.status(500).json({ error: 'Failed to create state' });
  }
});

app.post('/api/hierarchy/districts', authenticateToken, async (req, res) => {
  try {
    const newDistrict = req.body;
    if (isMongoConnected) {
      await DistrictNode.create(newDistrict);
    } else {
      inMemoryData.districts.push(newDistrict);
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to create district:', err);
    res.status(500).json({ error: 'Failed to create district' });
  }
});

app.post('/api/hierarchy/areas', authenticateToken, async (req, res) => {
  try {
    const newArea = req.body;
    if (isMongoConnected) {
      await AreaNode.create(newArea);
    } else {
      inMemoryData.areas.push(newArea);
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to create area:', err);
    res.status(500).json({ error: 'Failed to create area' });
  }
});

// DELETE routes
app.delete('/api/hierarchy/states/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (isMongoConnected) {
      const query = mongoose.Types.ObjectId.isValid(id) ? { $or: [{ id }, { _id: id }] } : { id };
      let stateToDel = await StateNode.findOne(query);
      if (!stateToDel) {
        stateToDel = await StateNode.findOne({ $or: [{ name: id }, { code: id }] });
      }

      const stateName = stateToDel?.name;
      const targetId = stateToDel?.id || id;

      const matchingDistricts = await DistrictNode.find({
        $or: [
          { stateId: targetId },
          { stateId: id },
          ...(stateName ? [{ stateName }] : [])
        ]
      }).lean();

      const districtIds = matchingDistricts.map(d => d.id);
      const districtNames = matchingDistricts.map(d => d.name);

      const matchingAreas = await AreaNode.find({
        $or: [
          { districtId: { $in: districtIds } },
          ...(stateName ? [{ stateName }] : [])
        ]
      }).lean();

      const areaNames = matchingAreas.map(a => a.name);

      await StateNode.deleteMany({ $or: [{ id: targetId }, { id }] });

      await DistrictNode.deleteMany({ $or: [{ stateId: targetId }, { stateId: id }] });

      if (districtIds.length > 0) {
        await AreaNode.deleteMany({ districtId: { $in: districtIds } });
      }

      if (stateName) {
        await User.deleteMany({
          role: { $ne: 'Admin' },
          $or: [
            { state: stateName },
            { district: { $in: districtNames } },
            { areaName: { $in: areaNames } },
          ],
        });
      }
    } else {
      const stateToDel = inMemoryData.states.find(s => s.id === id || s.name === id);
      const stateName = stateToDel?.name;
      const targetId = stateToDel?.id || id;

      const districtIds = new Set(inMemoryData.districts.filter(d => d.stateId === targetId || d.stateId === id || d.stateName === stateName).map(d => d.id));
      const districtNames = new Set(inMemoryData.districts.filter(d => d.stateId === targetId || d.stateId === id || d.stateName === stateName).map(d => d.name));
      const areaNames = new Set(inMemoryData.areas.filter(a => districtIds.has(a.districtId) || a.stateName === stateName).map(a => a.name));

      inMemoryData.states = inMemoryData.states.filter(s => s.id !== targetId && s.id !== id && s.name !== stateName);
      inMemoryData.districts = inMemoryData.districts.filter(d => !districtIds.has(d.id) && d.stateName !== stateName);
      inMemoryData.areas = inMemoryData.areas.filter(a => !districtIds.has(a.districtId) && a.stateName !== stateName);

      if (stateName) {
        inMemoryData.users = inMemoryData.users.filter(u =>
          u.role === 'Admin' ||
          (u.state !== stateName && !districtNames.has(u.district || '') && !areaNames.has(u.areaName || ''))
        );
      }
    }
    invalidateInitCache(); res.json({ success: true, dbStatus: isMongoConnected ? 'cloud' : 'local' });
  } catch (err) {
    console.error('Error deleting state:', err);
    res.status(500).json({ error: 'Failed to delete state' });
  }
});

app.delete('/api/hierarchy/districts/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (isMongoConnected) {
      const query = mongoose.Types.ObjectId.isValid(id) ? { $or: [{ id }, { _id: id }] } : { id };
      let districtToDel = await DistrictNode.findOne(query);
      if (!districtToDel) {
        districtToDel = await DistrictNode.findOne({ name: id });
      }
      const districtName = districtToDel?.name;
      const targetId = districtToDel?.id || id;

      const matchingAreas = await AreaNode.find({ $or: [{ districtId: targetId }, { districtId: id }, ...(districtName ? [{ districtName }] : [])] }).lean();
      const areaNames = matchingAreas.map(a => a.name);

      await DistrictNode.deleteMany({ $or: [{ id: targetId }, { id }] });
      await AreaNode.deleteMany({ districtId: { $in: [targetId, id] } });

      if (districtName) {
        await User.deleteMany({
          role: { $ne: 'Admin' },
          $or: [
            { district: districtName },
            { areaName: { $in: areaNames } },
          ],
        });
      }
    } else {
      const districtToDel = inMemoryData.districts.find(d => d.id === id || d.name === id);
      const districtName = districtToDel?.name;
      const targetId = districtToDel?.id || id;
      const areaNames = new Set(inMemoryData.areas.filter(a => a.districtId === targetId || a.districtId === id || a.districtName === districtName).map(a => a.name));

      inMemoryData.districts = inMemoryData.districts.filter(d => d.id !== targetId && d.id !== id && d.name !== districtName);
      inMemoryData.areas = inMemoryData.areas.filter(a => a.districtId !== targetId && a.districtId !== id && a.districtName !== districtName);
      if (districtName) {
        inMemoryData.users = inMemoryData.users.filter(u =>
          u.role === 'Admin' ||
          (u.district !== districtName && !areaNames.has(u.areaName || ''))
        );
      }
    }
    invalidateInitCache(); res.json({ success: true, dbStatus: isMongoConnected ? 'cloud' : 'local' });
  } catch (err) {
    console.error('Error deleting district:', err);
    res.status(500).json({ error: 'Failed to delete district' });
  }
});

app.delete('/api/hierarchy/areas/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (isMongoConnected) {
      const query = mongoose.Types.ObjectId.isValid(id) ? { $or: [{ id }, { _id: id }] } : { id };
      let areaToDel = await AreaNode.findOne(query);
      if (!areaToDel) {
        areaToDel = await AreaNode.findOne({ name: id });
      }
      const areaName = areaToDel?.name;
      const targetId = areaToDel?.id || id;

      await AreaNode.deleteMany({ $or: [{ id: targetId }, { id }] });

      if (areaName) {
        await User.deleteMany({
          role: { $ne: 'Admin' },
          areaName,
        });
      }
    } else {
      const areaToDel = inMemoryData.areas.find(a => a.id === id || a.name === id);
      const areaName = areaToDel?.name;
      const targetId = areaToDel?.id || id;

      inMemoryData.areas = inMemoryData.areas.filter(a => a.id !== targetId && a.id !== id && a.name !== areaName);
      if (areaName) {
        inMemoryData.users = inMemoryData.users.filter(u =>
          u.role === 'Admin' || u.areaName !== areaName
        );
      }
    }
    invalidateInitCache(); res.json({ success: true, dbStatus: isMongoConnected ? 'cloud' : 'local' });
  } catch (err) {
    console.error('Error deleting area:', err);
    res.status(500).json({ error: 'Failed to delete area' });
  }
});



import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static frontend assets built by Vite in production (Render deployment)
// Hashed, content-addressed assets (JS/CSS/images in dist/assets) — safe to cache forever,
// since Vite gives each build's files a unique hash in the filename.
app.use('/assets', express.static(path.join(__dirname, 'dist', 'assets'), {
  maxAge: '1y',
  immutable: true,
}));

// Everything else in dist/ (manifest.json, icons, etc.) — safe defaults, no aggressive caching.
app.use(express.static(path.join(__dirname, 'dist'), { index: false }));

// Anything that looks like a file but was NOT found by express.static — a
// hashed chunk from a previous build, sw.js, a font — must 404 here rather
// than fall through to the SPA index.html below. Serving HTML with a 200 for a
// missing .js is worse than a 404: the browser rejects it as a module script
// ("expected JavaScript, got text/html"), the lazy-loaded screen goes blank,
// and the service worker's asset cache can pin that bad response for a year.
// Deep links like /?id=AWD-1234 have no extension and still reach the SPA.
app.use((req, res, next) => {
  const looksLikeFile = req.path.startsWith('/assets/') || /\.[a-z0-9]{2,5}$/i.test(req.path);
  if (req.method === 'GET' && looksLikeFile && !req.path.startsWith('/api/')) {
    return res.status(404).type('text/plain').send('Not found');
  }
  next();
});

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  const indexPath = path.join(__dirname, 'dist', 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(200).send('API Server Running. Build frontend with npm run build for SPA view.');
    }
  });
});

app.listen(PORT, () => {
  console.log(`🚀 AWD Pipe Backend API running on port ${PORT}`);
});