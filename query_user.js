import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGODB_URI);
const UserSchema = new mongoose.Schema({ username: String, passwordHash: String }, { strict: false });
const User = mongoose.model('User', UserSchema);
async function run() {
  const user = await User.findOne({ username: 'ganeshkeesara' }).lean();
  console.log("DB USER:", user);
  process.exit();
}
run();
