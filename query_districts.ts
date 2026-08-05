import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const DistrictSchema = new mongoose.Schema({ name: String, stateId: String }, { strict: false });
const DistrictNode = mongoose.model('DistrictNode', DistrictSchema, 'districtnodes');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  const districts = await DistrictNode.find({ name: 'Nizamabad' }).lean();
  console.log("Districts:", JSON.stringify(districts, null, 2));
  process.exit();
}
run().catch(console.error);
