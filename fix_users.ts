import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { INITIAL_USERS } from './src/data/hierarchyData.js';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  console.log("Connected to MongoDB.");
  
  await mongoose.connection.collection('users').deleteMany({});
  console.log("Wiped existing users.");

  await mongoose.connection.collection('users').insertMany(INITIAL_USERS);
  console.log("Inserted INITIAL_USERS with passwordHashes!");
  
  process.exit();
}
run().catch(console.error);
