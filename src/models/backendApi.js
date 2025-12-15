// const mongoose = require("mongoose");

// const backendApiSchema = new mongoose.Schema(
//   {
//     api_name: { type: String, required: true, trim: true },
//     description: { type: String, trim: true },
//     columns: { type: [String], default: [] },
//     request: {
//       type: String,
//       enum: ["GET", "POST", "PUT", "FETCH", "DELETE"],
//       default: "GET",
//     },
//     dbName: { type: String, trim: true },
//     collectionName: { type: String, trim: true },
//     payloadSample: { type: mongoose.Schema.Types.Mixed },
//     password: { type: String, trim: true },
//     meta: { type: mongoose.Schema.Types.Mixed },
//   },
//   { timestamps: true }
// );

// module.exports = mongoose.model("BackendApi", backendApiSchema);

const mongoose = require("mongoose");

const backendApiSchema = new mongoose.Schema(
  {
    api_name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    columns: {
      type: [String],
      default: [],
    },
    request: {
      type: String,
      enum: [
        "GET",
        "POST",
        "PUT",
        "DELETE",
        "FETCH",
        // Add these new aggregate methods:
        "COUNT",
        "SUM",
        "AVG",
        "MIN",
        "MAX",
        "GROUP_BY"
      ],
      default: "GET",
    },
    dbName: {
      type: String,
      required: true,
    },
    collectionName: {
      type: String,
      required: true,
    },
    payloadSample: {
      type: Object,
      default: {},
    },
    password: {
      type: String, // Optional password protection
      select: false,
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {}, 
      // meta.matchField -> used for PUT/DELETE/FETCH/AGGREGATES
      // meta.aggregateField -> used for SUM/AVG/MIN/MAX/GROUP_BY
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("BackendApi", backendApiSchema);