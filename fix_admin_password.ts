import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
dotenv.config();
const UserSchema = new mongoose.Schema({}, { strict: false });
const User = mongoose.model('User', UserSchema, 'users');
async function run() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  const hash = bcrypt.hashSync('admin123', 10);
  await User.updateOne({ username: 'admin' }, { $set: { passwordHash: hash } });
  console.log("Admin password set to admin123");
  process.exit();
}
run();
