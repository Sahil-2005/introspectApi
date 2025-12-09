// src/config/db.js
const mongoose = require("mongoose");
const { MONGO_URI } = require("./env");

async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI, {
      // options mostly not needed in latest Mongoose but kept for clarity
      autoIndex: false,
    });

    console.log("✅ MongoDB connected using Mongoose");

    mongoose.connection.on("disconnected", () => {
      console.warn("⚠️  MongoDB disconnected");
    });

    mongoose.connection.on("error", (err) => {
      console.error("❌ MongoDB error:", err);
    });
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  }
}

module.exports = connectDB;
