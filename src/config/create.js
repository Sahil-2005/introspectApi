require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// Import admin model
const Admin = require("../models/user");

const connectDB = require('./db');


connectDB();

async function seedAdmin() {
  try {
    // Check if admin already exists
    const exists = await Admin.findOne({ email: "deep@gmail.com" });

    if (exists) {
      console.log("Admin already exists");
      process.exit();
    }

    // Hash password
    const hashedPassword = await bcrypt.hash("admin123", 10);

    // Create admin
    await Admin.create({
      email: "deep@gmail.com",
      password: hashedPassword
    });

    console.log("Admin seeded successfully");
    console.log("Email: deep@gmail.com");
    console.log("Password: admin123");

    process.exit();

  } catch (err) {
    console.error("Seeding error:", err);
    process.exit(1);
  }
}

seedAdmin();
