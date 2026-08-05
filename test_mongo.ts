import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  console.log("districts:");
  console.log(await mongoose.connection.collection('districtnodes').find({}).toArray());
  process.exit();
}
run();
