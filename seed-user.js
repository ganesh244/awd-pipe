import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const UserSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  role: { type: String, required: true },
  mobile: { type: String },
  state: { type: String },
  district: { type: String },
  area: { type: String },
  reportsToId: { type: String },
  password: { type: String },
  username: { type: String },
  email: { type: String },
  phone: { type: String },
  isActive: { type: Boolean },
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const adminUser = {
    id: 'usr-admin-ganesh',
    name: 'Ganesh Keesara',
    username: 'ganeshkeesara',
    password: 'BLACKperaL1',
    role: 'Admin',
    email: 'ganesh@awdpipe.org',
    phone: '+91 98765 00000',
    isActive: true,
  };

  await User.findOneAndUpdate({ id: adminUser.id }, adminUser, { upsert: true });
  console.log('User ganeshkeesara inserted/updated!');
  process.exit(0);
}

run().catch(console.error);
