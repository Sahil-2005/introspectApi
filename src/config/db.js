// src/config/db.js
const mongoose = require("mongoose");
// const { MONGO_URI } = require("./env");

async function connectDB() {
  try {
    // await mongoose.connect(MONGO_URI || 'mongodb+srv://devteam_db_user:cSvIHgoaFX48RuO4@sage.81ahy6f.mongodb.net/sage?retryWrites=true&w=majority&appName=sage', {
      await mongoose.connect('mongodb+srv://devteam_db_user:cSvIHgoaFX48RuO4@sage.81ahy6f.mongodb.net/sage?retryWrites=true&w=majority&appName=sage', {  
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
