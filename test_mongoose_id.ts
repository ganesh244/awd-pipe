import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
const Schema = new mongoose.Schema({ id: { type: String, required: true }, name: String });
const Model = mongoose.model('TestId', Schema);
async function run() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  await Model.deleteMany({});
  try {
    await Model.create({ id: 'test-123', name: 'Test' });
    console.log("Success:", await Model.find({}).lean());
  } catch (e) {
    console.error("Error:", e.message);
  }
  process.exit();
}
run().catch(console.error);
