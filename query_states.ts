import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const StateSchema = new mongoose.Schema({ name: String }, { strict: false });
const StateNode = mongoose.model('StateNode', StateSchema, 'statenodes');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  const states = await StateNode.find({}).lean();
  console.log("States:", JSON.stringify(states, null, 2));
  process.exit();
}
run().catch(console.error);
