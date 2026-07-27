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
  pipes: [...INITIAL_PIPES],
  installations: [...INITIAL_INSTALLATIONS],
  monitoringList: [...INITIAL_MONITORING],
};

let isMongoConnected = false;

// Mongoose Schemas & Models
const UserSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  role: { type: String, required: true },
  mobile: { type: String, required: true },
  state: { type: String },
  district: { type: String },
  area: { type: String },
  reportsToId: { type: String },
  password: { type: String },
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
    if (isMongoConnected) {
      const users = await User.find({}).lean();
      const pipes = await Pipe.find({}).sort({ createdAt: -1 }).lean();
      const installations = await Installation.find({}).sort({ createdAt: -1 }).lean();
      const monitoringList = await MonitoringRecord.find({}).sort({ createdAt: -1 }).lean();

      // Clean _id and __v for clean frontend consumption
      const cleanUsers = users.map(({ _id, __v, ...rest }) => rest);
      const cleanPipes = pipes.map(({ _id, __v, ...rest }) => rest);
      const cleanInstallations = installations.map(({ _id, __v, ...rest }) => rest);
      const cleanMonitoringList = monitoringList.map(({ _id, __v, ...rest }) => rest);

      return res.json({
        dbStatus: 'cloud',
        users: cleanUsers,
        pipes: cleanPipes,
        installations: cleanInstallations,
        monitoringList: cleanMonitoringList,
        states: INITIAL_STATES,
        districts: INITIAL_DISTRICTS,
        areas: INITIAL_AREAS,
      });
    } else {
      return res.json({
        dbStatus: 'local',
        users: inMemoryData.users,
        pipes: inMemoryData.pipes,
        installations: inMemoryData.installations,
        monitoringList: inMemoryData.monitoringList,
        states: INITIAL_STATES,
        districts: INITIAL_DISTRICTS,
        areas: INITIAL_AREAS,
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

// 7. DELETE /api/users/:id -> Delete user from hierarchy
app.delete('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    if (isMongoConnected) {
      await User.findOneAndDelete({ id });
    } else {
      inMemoryData.users = inMemoryData.users.filter((u) => u.id !== id);
    }
    res.json({ success: true, dbStatus: isMongoConnected ? 'cloud' : 'local' });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 AWD Pipe Backend API running on http://localhost:${PORT}`);
});
