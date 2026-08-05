import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
const UserSchema = new mongoose.Schema({}, { strict: false });
const User = mongoose.model('User', UserSchema, 'users');
async function run() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  console.log("Admin:", await User.findOne({ username: 'admin' }).lean());
  process.exit();
}
run();
