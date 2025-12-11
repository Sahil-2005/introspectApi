const BackendApi = require("../models/backendApi");
const mongoose = require("mongoose");

const createBackendApi = async (req, res) => {
  try {
    const {
      api_name,
      columns = [],
      request = "GET",
      dbName,
      collectionName,
      description,
      payloadSample,
      password,
      meta,
    } = req.body || {};

    if (!api_name) {
      return res.status(400).json({ ok: false, message: "Field api_name is required" });
    }

    const normalizedRequest = String(request).toUpperCase();

    const doc = await BackendApi.create({
      api_name,
      columns,
      request: normalizedRequest,
      dbName,
      collectionName,
      description,
      payloadSample,
      password,
      meta,
    });

    return res.status(201).json({ ok: true, data: doc });
  } catch (err) {
    console.error("Create backend API failed:", err);
    return res.status(500).json({ ok: false, message: "Failed to create backend API", error: err.message });
  }
};

const listBackendApis = async (_req, res) => {
  try {
    const apis = await BackendApi.find().sort({ createdAt: -1 });
    return res.json({ ok: true, data: apis });
  } catch (err) {
    console.error("List backend APIs failed:", err);
    return res.status(500).json({ ok: false, message: "Failed to fetch backend APIs", error: err.message });
  }
};

const deleteBackendApi = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ ok: false, message: "Id is required" });

    const deleted = await BackendApi.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ ok: false, message: "API not found" });

    return res.json({ ok: true, message: "API deleted", data: deleted });
  } catch (err) {
    console.error("Delete backend API failed:", err);
    return res.status(500).json({ ok: false, message: "Failed to delete backend API", error: err.message });
  }
};

const executeBackendApi = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ ok: false, message: "Id is required" });

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ ok: false, message: "Mongoose is not connected" });
    }

    const api = await BackendApi.findById(id);
    if (!api) return res.status(404).json({ ok: false, message: "API not found" });

    const dbName = api.dbName || req.body.dbName;
    const collectionName = api.collectionName || req.body.collectionName;
    if (!dbName || !collectionName) {
      return res.status(400).json({ ok: false, message: "Missing dbName or collectionName" });
    }

    const db = mongoose.connection.client.db(dbName);
    const collection = db.collection(collectionName);

    const method = (api.request || "GET").toUpperCase();
    const payload = req.body?.payload ?? {};
    const now = new Date();

    if (method !== "POST") {
      return res.status(400).json({ ok: false, message: "Only POST is supported for execution" });
    }

    const incoming = Array.isArray(payload) ? payload : [payload];
    const docs = incoming.map((item = {}) => {
      const doc = { ...item };
      // auto fields
      try {
        doc._id = doc._id ? new mongoose.Types.ObjectId(doc._id) : new mongoose.Types.ObjectId();
      } catch {
        doc._id = new mongoose.Types.ObjectId();
      }
      if (!doc.id) doc.id = doc._id.toString();
      doc.createdAt = doc.createdAt || doc.created_at || now;
      doc.updatedAt = now;
      return doc;
    });

    const insertRes = await collection.insertMany(docs);
    const insertedIds = Object.values(insertRes.insertedIds || {});
    const inserted = await collection.find({ _id: { $in: insertedIds } }).toArray();

    return res.status(201).json({
      ok: true,
      method,
      insertedCount: insertRes.insertedCount,
      data: inserted,
    });
  } catch (err) {
    console.error("Execute backend API failed:", err);
    return res
      .status(500)
      .json({
        ok: false,
        message: "Failed to execute backend API",
        error: err.message,
      });
  }
};

module.exports = {
  createBackendApi,
  listBackendApis,
  deleteBackendApi,
  executeBackendApi,
};

