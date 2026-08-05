import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
const DistrictSchema = new mongoose.Schema({}, { strict: false });
const DistrictNode = mongoose.model('DistrictNode', DistrictSchema, 'districtnodes');
async function run() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  console.log("District:", await DistrictNode.findOne({ id: 'dist-test-123' }).lean());
  process.exit();
}
run();
