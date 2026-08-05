import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
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
    await mongoose.connect(mongoUri);
    isMongoConnected = true;
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
    isMongoConnected = false;
  }
};

connectDB();

// API Endpoints

// 1. GET /api/init -> Load all initial data for frontend
app.get('/api/init', async (req, res) => {
  try {
    if (!isMongoConnected) {
      await connectDB();
    }
    if (isMongoConnected) {
      const users = await User.find({}).lean();
      const pipes = await Pipe.find({}).sort({ createdAt: -1 }).lean();
      const installations = await Installation.find({}).sort({ createdAt: -1 }).lean();
      const monitoringList = await MonitoringRecord.find({}).sort({ createdAt: -1 }).lean();
      const states = await StateNode.find({}).lean();
      const districts = await DistrictNode.find({}).lean();
      const areas = await AreaNode.find({}).lean();

      // Clean _id and __v for clean frontend consumption
      const cleanUsers = users.map(({ _id, __v, ...rest }) => rest);
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
      return res.json({
        dbStatus: 'local',
        users: inMemoryData.users,
        pipes: inMemoryData.pipes,
        installations: inMemoryData.installations,
        monitoringList: inMemoryData.monitoringList,
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
app.post('/api/installations', async (req, res) => {
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
app.put('/api/installations/:pipeId', async (req, res) => {
  const { pipeId } = req.params;
  const targetId = decodeURIComponent(pipeId).trim();
  const updated = req.body;
  try {
    if (isMongoConnected) {
      const isObjId = mongoose.Types.ObjectId.isValid(targetId);
      const query = isObjId
        ? { $or: [{ Pipe_ID: targetId }, { _id: targetId }] }
        : { Pipe_ID: new RegExp(`^${targetId.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}$`, 'i') };

      await Installation.findOneAndUpdate(query, updated, { new: true });
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
app.delete('/api/installations/:pipeId', async (req, res) => {
  const { pipeId } = req.params;
  const targetId = decodeURIComponent(pipeId).trim();
  try {
    if (isMongoConnected) {
      const isObjId = mongoose.Types.ObjectId.isValid(targetId);
      const query = isObjId
        ? { $or: [{ Pipe_ID: targetId }, { _id: targetId }] }
        : { Pipe_ID: new RegExp(`^${targetId.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}$`, 'i') };

      const foundInst = await Installation.findOne(query);
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
app.delete('/api/installations/clear/all', async (req, res) => {
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
app.post('/api/monitoring', async (req, res) => {
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
app.post('/api/pipes/batch', async (req, res) => {
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
app.put('/api/pipes/:id', async (req, res) => {
  const pipeId = req.params.id;
  const updates = req.body;
  try {
    if (isMongoConnected) {
      await Pipe.findOneAndUpdate({ Pipe_ID: pipeId }, updates);
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
app.put('/api/pipes/batch/rename', async (req, res) => {
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
app.delete('/api/pipes/batch/:batchNo', async (req, res) => {
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
app.post('/api/users', async (req, res) => {
  const { newUser } = req.body;
  try {
    if (isMongoConnected) {
      await new User(newUser).save();
    } else {
      inMemoryData.users.push(newUser);
    }
    res.json({ success: true, dbStatus: isMongoConnected ? 'cloud' : 'local' });
  } catch (err) {
    console.error('Error adding user:', err);
    res.status(500).json({ error: 'Failed to add user' });
  }
});

// 6. PUT /api/users/:id -> Update user credentials/roles
app.put('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  const { updatedUser } = req.body;
  try {
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
app.delete('/api/users/:id', async (req, res) => {
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
app.put('/api/hierarchy/state', async (req, res) => {
  const { id, name, managerId, managerName } = req.body;
  try {
    if (isMongoConnected) {
      await StateNode.findOneAndUpdate({ id }, { name, managerId, managerName }, { new: true });
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
app.put('/api/hierarchy/district', async (req, res) => {
  const { id, name, stateId, stateName, managerId, managerName } = req.body;
  try {
    if (isMongoConnected) {
      await DistrictNode.findOneAndUpdate({ id }, { name, stateId, stateName, managerId, managerName }, { new: true });
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
app.put('/api/hierarchy/area', async (req, res) => {
  const { id, name, districtId, districtName, stateName, managerId, managerName } = req.body;
  try {
    if (isMongoConnected) {
      await AreaNode.findOneAndUpdate({ id }, { name, districtId, districtName, stateName, managerId, managerName }, { new: true });
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
app.post('/api/hierarchy/states', async (req, res) => {
  try {
    const newState = req.body;
    if (isMongoConnected) {
      await StateNode.create(newState);
    } else {
      inMemoryData.states.push(newState);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create state' });
  }
});

app.post('/api/hierarchy/districts', async (req, res) => {
  try {
    const newDistrict = req.body;
    if (isMongoConnected) {
      await DistrictNode.create(newDistrict);
    } else {
      inMemoryData.districts.push(newDistrict);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create district' });
  }
});

app.post('/api/hierarchy/areas', async (req, res) => {
  try {
    const newArea = req.body;
    if (isMongoConnected) {
      await AreaNode.create(newArea);
    } else {
      inMemoryData.areas.push(newArea);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create area' });
  }
});

// DELETE routes
app.delete('/api/hierarchy/states/:id', async (req, res) => {
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

      await StateNode.deleteMany({
        $or: [
          { id: targetId },
          { id },
          ...(stateToDel ? [{ _id: stateToDel._id }] : []),
          ...(stateName ? [{ name: stateName }] : [])
        ]
      });

      await DistrictNode.deleteMany({
        $or: [
          { stateId: targetId },
          { stateId: id },
          ...(stateName ? [{ stateName }] : [])
        ]
      });

      await AreaNode.deleteMany({
        $or: [
          { districtId: { $in: districtIds } },
          ...(stateName ? [{ stateName }] : [])
        ]
      });

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

app.delete('/api/hierarchy/districts/:id', async (req, res) => {
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

      await DistrictNode.deleteMany({ $or: [{ id: targetId }, { id }, ...(districtToDel ? [{ _id: districtToDel._id }] : []), ...(districtName ? [{ name: districtName }] : [])] });
      await AreaNode.deleteMany({ $or: [{ districtId: targetId }, { districtId: id }, ...(districtName ? [{ districtName }] : [])] });

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

app.delete('/api/hierarchy/areas/:id', async (req, res) => {
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

      await AreaNode.deleteMany({ $or: [{ id: targetId }, { id }, ...(areaToDel ? [{ _id: areaToDel._id }] : []), ...(areaName ? [{ name: areaName }] : [])] });
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

app.post('/api/hierarchy/save', async (req, res) => {
  const { users, states, districts, areas } = req.body;
  try {
    if (isMongoConnected) {
      await Promise.all([
        User.deleteMany({}),
        StateNode.deleteMany({}),
        DistrictNode.deleteMany({}),
        AreaNode.deleteMany({}),
      ]);

      if (users?.length) await User.insertMany(users);
      if (states?.length) await StateNode.insertMany(states);
      if (districts?.length) await DistrictNode.insertMany(districts);
      if (areas?.length) await AreaNode.insertMany(areas);
    } else {
      inMemoryData.users = users || [];
      inMemoryData.states = states || [];
      inMemoryData.districts = districts || [];
      inMemoryData.areas = areas || [];
    }

    res.json({ success: true, dbStatus: isMongoConnected ? 'cloud' : 'local' });
  } catch (err) {
    console.error('Error saving hierarchy snapshot:', err);
    res.status(500).json({ error: 'Failed to save hierarchy snapshot' });
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
