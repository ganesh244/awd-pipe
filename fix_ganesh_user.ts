import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config();

const UserSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  role: { type: String, required: true },
}, { strict: false });

const UserNode = mongoose.model('UserNode', UserSchema, 'users');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  const passwordHash = bcrypt.hashSync('BLACKperaL1', 10);
  
  const existingUser = await UserNode.findOne({ username: 'ganeshkeesara' });
  if (existingUser) {
    existingUser.passwordHash = passwordHash;
    existingUser.isActive = true;
    await existingUser.save();
    console.log("Updated existing ganeshkeesara user.");
  } else {
    await UserNode.create({
      id: `usr-ganesh-${Date.now()}`,
      name: 'Ganesh Keesara',
      username: 'ganeshkeesara',
      passwordHash,
      role: 'Admin',
      isActive: true,
    });
    console.log("Created ganeshkeesara user.");
  }
  process.exit();
}
run().catch(console.error);
