import mongoose from "mongoose";

try {
  await mongoose.connect("mongodb://localhost:27017/elysian", { serverSelectionTimeoutMS: 5000 });
  console.log("Database:", mongoose.connection.name);
  for (const collection of await mongoose.connection.db.listCollections().toArray()) {
    console.log(collection.name, await mongoose.connection.db.collection(collection.name).countDocuments());
  }
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  console.log("Topology:", hello.setName ?? "standalone");
} finally {
  await mongoose.disconnect();
}