// src/config/env.js
require("dotenv").config();

const config = {
  PORT: process.env.PORT || 3000,
  MONGO_URI: process.env.MONGO_URI,
};

if (!config.MONGO_URI) {
  throw new Error("MONGO_URI is not defined in .env");
}

module.exports = config;
