import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const StateSchema = new mongoose.Schema({}, { strict: false });
const DistrictSchema = new mongoose.Schema({ name: String, stateId: String }, { strict: false });
const AreaSchema = new mongoose.Schema({ name: String, districtId: String }, { strict: false });

const StateNode = mongoose.model('StateNode', StateSchema, 'statenodes');
const DistrictNode = mongoose.model('DistrictNode', DistrictSchema, 'districtnodes');
const AreaNode = mongoose.model('AreaNode', AreaSchema, 'areanodes');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  
  // Find all states
  const validStateIds = (await StateNode.find({})).map(s => s.get('id'));
  
  // Find orphan districts
  const districts = await DistrictNode.find({});
  for (const d of districts) {
    if (!validStateIds.includes(d.get('stateId'))) {
      console.log(`Deleting orphan district: ${d.name} (${d.get('id')}) - State ${d.get('stateId')} not found.`);
      await DistrictNode.deleteOne({ _id: d._id });
    }
  }

  // Find all valid districts now
  const validDistrictIds = (await DistrictNode.find({})).map(d => d.get('id'));

  // Find orphan areas
  const areas = await AreaNode.find({});
  for (const a of areas) {
    if (!validDistrictIds.includes(a.get('districtId'))) {
      console.log(`Deleting orphan area: ${a.name} (${a.get('id')}) - District ${a.get('districtId')} not found.`);
      await AreaNode.deleteOne({ _id: a._id });
    }
  }

  // Find exact name duplicates within districts
  const districtGroups = await DistrictNode.aggregate([
    { $group: { _id: "$name", count: { $sum: 1 }, docs: { $push: "$_id" } } },
    { $match: { count: { $gt: 1 } } }
  ]);
  
  for (const g of districtGroups) {
    console.log(`Duplicate District Names: ${g._id}. Deleting all but one.`);
    // Keep the first one, delete the rest
    const toDelete = g.docs.slice(1);
    await DistrictNode.deleteMany({ _id: { $in: toDelete } });
  }

  // Find exact name duplicates within areas
  const areaGroups = await AreaNode.aggregate([
    { $group: { _id: "$name", count: { $sum: 1 }, docs: { $push: "$_id" } } },
    { $match: { count: { $gt: 1 } } }
  ]);

  for (const g of areaGroups) {
    console.log(`Duplicate Area Names: ${g._id}. Deleting all but one.`);
    const toDelete = g.docs.slice(1);
    await AreaNode.deleteMany({ _id: { $in: toDelete } });
  }

  console.log("Cleanup complete!");
  process.exit();
}
run().catch(console.error);
