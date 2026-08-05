import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { INITIAL_STATES, INITIAL_DISTRICTS, INITIAL_AREAS } from './src/data/hierarchyData.js';
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  
  await mongoose.connection.collection('statenodes').deleteMany({});
  await mongoose.connection.collection('districtnodes').deleteMany({});
  await mongoose.connection.collection('areanodes').deleteMany({});
  
  await mongoose.connection.collection('statenodes').insertMany(INITIAL_STATES);
  await mongoose.connection.collection('districtnodes').insertMany(INITIAL_DISTRICTS);
  await mongoose.connection.collection('areanodes').insertMany(INITIAL_AREAS);
  
  console.log("Hierarchy seeded to perfectly match INITIAL_USERS (RAW DB).");
  process.exit();
}
run().catch(console.error);
