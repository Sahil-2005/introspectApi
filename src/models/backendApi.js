const mongoose = require("mongoose");

const backendApiSchema = new mongoose.Schema(
  {
    api_name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    columns: { type: [String], default: [] },
    request: {
      type: String,
      enum: ["GET", "POST", "PUT", "FETCH", "DELETE"],
      default: "GET",
    },
    dbName: { type: String, trim: true },
    collectionName: { type: String, trim: true },
    payloadSample: { type: mongoose.Schema.Types.Mixed },
    password: { type: String, trim: true },
    meta: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

module.exports = mongoose.model("BackendApi", backendApiSchema);

