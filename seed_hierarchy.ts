import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { INITIAL_STATES, INITIAL_DISTRICTS, INITIAL_AREAS } from './src/data/hierarchyData.js';
dotenv.config();

const StateSchema = new mongoose.Schema({}, { strict: false });
const DistrictSchema = new mongoose.Schema({}, { strict: false });
const AreaSchema = new mongoose.Schema({}, { strict: false });

const StateNode = mongoose.model('StateNode', StateSchema, 'statenodes');
const DistrictNode = mongoose.model('DistrictNode', DistrictSchema, 'districtnodes');
const AreaNode = mongoose.model('AreaNode', AreaSchema, 'areanodes');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  
  await StateNode.deleteMany({});
  await DistrictNode.deleteMany({});
  await AreaNode.deleteMany({});
  
  await StateNode.insertMany(INITIAL_STATES);
  await DistrictNode.insertMany(INITIAL_DISTRICTS);
  await AreaNode.insertMany(INITIAL_AREAS);
  
  console.log("Hierarchy seeded to perfectly match INITIAL_USERS.");
  process.exit();
}
run().catch(console.error);
