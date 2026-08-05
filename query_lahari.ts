import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const UserSchema = new mongoose.Schema({ username: String }, { strict: false });
const User = mongoose.model('User', UserSchema, 'users');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  const users = await User.find({}).lean();
  console.log("Users:", users.map(u => u.username));
  process.exit();
}
run().catch(console.error);
