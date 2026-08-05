import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const UserSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  username: { type: String, required: true },
  password: { type: String },
  passwordHash: { type: String },
  role: { type: String, required: true },
}, { strict: false });

const User = mongoose.model('User', UserSchema);

async function migratePasswords() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.log('No MONGODB_URI found in .env. Skipping migration.');
    return;
  }

  try {
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB. Starting migration...');

    const users = await User.find({ password: { $exists: true } });
    console.log(`Found ${users.length} users with plaintext passwords.`);

    for (const user of users) {
      if (user.password) {
        user.passwordHash = await bcrypt.hash(user.password, 10);
        user.password = undefined; // remove plaintext field
        await user.save();
        console.log(`Migrated user: ${user.username}`);
      }
    }

    console.log('Migration complete.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
  }
}

migratePasswords();
