import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
dotenv.config();
const UserSchema = new mongoose.Schema({}, { strict: false });
const User = mongoose.model('User', UserSchema, 'users');
async function run() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  try {
    const newUser = { id: 'usr-test-123', username: 'testuser', role: 'CF', passwordHash: 'abc' };
    await User.create(newUser);
    console.log("Success");
  } catch (err) {
    console.error("DB Error:", err);
  }
  process.exit();
}
run();
