import mongoose from "mongoose";

const connectDB = async () => {
  try {
    // ✅ Connect to MongoDB (Local or Cloud)
    const conn = await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/chatverse", {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Failed: ${error.message}`);
    process.exit(1); // Stop server if DB fails
  }
};

export default connectDB;
