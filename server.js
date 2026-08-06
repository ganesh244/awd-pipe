import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';

import { INITIAL_PIPES, INITIAL_INSTALLATIONS, INITIAL_MONITORING } from './src/data/initialData.ts';
import { INITIAL_STATES, INITIAL_DISTRICTS, INITIAL_AREAS, INITIAL_USERS } from './src/data/hierarchyData.ts';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
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
};

let isMongoConnected = false;

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

// Connect to MongoDB Atlas
const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.log('🟡 [MongoDB Atlas] No MONGODB_URI found in .env. Running in Local Demo Mode (In-Memory Fallback).');
    return;
  }

  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
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
  console.warn('WARNING: JWT_SECRET not set in environment. Using securely generated ephemeral secret.');
}
import crypto from 'crypto';
const ACTIVE_JWT_SECRET = JWT_SECRET || crypto.randomBytes(32).toString('hex');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts' }
});

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  jwt.verify(token, ACTIVE_JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

const getScopeFilter = async (user) => {
  if (!user) return { mongo: { _id: null }, memory: () => false };

  if (user.role === 'Admin') {
    return { mongo: {}, memory: () => true };
  }

  let allUsers = [];
  if (isMongoConnected) {
    allUsers = await User.find({}).lean();
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
        (item.Visited_By_User_ID && subUserIds.has(item.Visited_By_User_ID))
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
        (item.Visited_By_User_ID && subUserIds.has(item.Visited_By_User_ID))
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
    }
  };
};

// API Endpoints

app.post('/api/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Required' });
  try {
    let user = null;
    if (isMongoConnected) user = await User.findOne({ username: username.trim() }).lean();
    else user = inMemoryData.users.find((u) => u.username === username.trim());

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


// 1. GET /api/init -> Load all initial data for frontend
app.get('/api/init', authenticateToken, async (req, res) => {
  try {
    if (!isMongoConnected) {
      await connectDB();
    }
    const scope = await getScopeFilter(req.user);

    if (isMongoConnected) {
      const users = await User.find({}).lean();
      const pipeQuery = req.user.role === 'Admin' ? {} : {
        $or: [
          { Status: 'Available' },
          scope.mongo
        ]
      };
      const pipes = await Pipe.find(pipeQuery).sort({ createdAt: -1 }).lean();
      const installations = await Installation.find(scope.mongo).sort({ createdAt: -1 }).lean();
      const monitoringList = await MonitoringRecord.find(scope.mongo).sort({ createdAt: -1 }).lean();
      const states = await StateNode.find({}).lean();
      const districts = await DistrictNode.find({}).lean();
      const areas = await AreaNode.find({}).lean();

      // Clean _id and __v for clean frontend consumption, and REMOVE password hashes
      const cleanUsers = users.map(({ _id, __v, password, passwordHash, ...rest }) => rest);
      const cleanPipes = pipes.map(({ _id, __v, ...rest }) => rest);
      const cleanInstallations = installations.map(({ _id, __v, ...rest }) => rest);
      const cleanMonitoringList = monitoringList.map(({ _id, __v, ...rest }) => rest);
      const cleanStates = states.map(({ _id, __v, ...rest }) => rest);
      const cleanDistricts = districts.map(({ _id, __v, ...rest }) => rest);
      const cleanAreas = areas.map(({ _id, __v, ...rest }) => rest);

      return res.json({
        dbStatus: 'cloud',
        users: cleanUsers,
        pipes: cleanPipes,
        installations: cleanInstallations,
        monitoringList: cleanMonitoringList,
        states: cleanStates,
        districts: cleanDistricts,
        areas: cleanAreas,
      });
    } else {
      // In-memory fallback
      const cleanUsers = inMemoryData.users.map(({ password, passwordHash, ...rest }) => rest);
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
    if (isMongoConnected) {
      await new Installation(installation).save();
      await Pipe.findOneAndUpdate({ Pipe_ID: updatedPipe.Pipe_ID }, updatedPipe, { upsert: true });
    } else {
      inMemoryData.installations.unshift(installation);
      inMemoryData.pipes = inMemoryData.pipes.map((p) =>
        p.Pipe_ID === updatedPipe.Pipe_ID ? updatedPipe : p
      );
    }
    res.json({ success: true, dbStatus: isMongoConnected ? 'cloud' : 'local' });
  } catch (err) {
    console.error('Error saving installation:', err);
    res.status(500).json({ error: 'Failed to save installation' });
  }
});

// 2b. PUT /api/installations/:pipeId -> Update farmer installation details
app.put('/api/installations/:pipeId', authenticateToken, async (req, res) => {
  const scope = await getScopeFilter(req.user);
  const { pipeId } = req.params;
  const targetId = decodeURIComponent(pipeId).trim();
  const updated = req.body;
  try {
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
    res.json({ success: true, dbStatus: isMongoConnected ? 'cloud' : 'local' });
  } catch (err) {
    console.error('Error updating installation:', err);
    res.status(500).json({ error: 'Failed to update installation' });
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
          Status: 'Unregistered',
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
            Status: 'Unregistered',
            Farmer_Name: '',
            Village: '',
            District: '',
            State: '',
            Installation_Date: '',
          }
          : p
      );
    }
    res.json({ success: true, dbStatus: isMongoConnected ? 'cloud' : 'local' });
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
        Status: 'Unregistered',
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
        Status: 'Unregistered',
        Farmer_Name: '',
        Village: '',
        District: '',
        State: '',
        Installation_Date: '',
      }));
    }
    res.json({ success: true, dbStatus: isMongoConnected ? 'cloud' : 'local' });
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
    res.json({ success: true, dbStatus: isMongoConnected ? 'cloud' : 'local' });
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
    res.json({ success: true, dbStatus: isMongoConnected ? 'cloud' : 'local' });
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
    res.json({ success: true, dbStatus: isMongoConnected ? 'cloud' : 'local' });
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
    res.json({ success: true, dbStatus: isMongoConnected ? 'cloud' : 'local' });
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
    res.json({ success: true, dbStatus: isMongoConnected ? 'cloud' : 'local' });
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
    res.json({ success: true, dbStatus: isMongoConnected ? 'cloud' : 'local' });
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
    res.json({ success: true, dbStatus: isMongoConnected ? 'cloud' : 'local' });
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
    res.json({ success: true, dbStatus: isMongoConnected ? 'cloud' : 'local' });
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
    res.json({ success: true, dbStatus: isMongoConnected ? 'cloud' : 'local' });
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
    res.json({ success: true, dbStatus: isMongoConnected ? 'cloud' : 'local' });
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
    res.json({ success: true, dbStatus: isMongoConnected ? 'cloud' : 'local' });
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
    res.json({ success: true, dbStatus: isMongoConnected ? 'cloud' : 'local' });
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
    res.json({ success: true, dbStatus: isMongoConnected ? 'cloud' : 'local' });
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
    res.json({ success: true, dbStatus: isMongoConnected ? 'cloud' : 'local' });
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
app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
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