// controllers/backendApiController.js
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

    // helper: detect 24-hex and return ObjectId or original string
    const tryObjectId = (val) => {
      if (typeof val === "string" && /^[a-fA-F0-9]{24}$/.test(val)) {
        try { return new mongoose.Types.ObjectId(val); } catch (e) { return val; }
      }
      return val;
    };

    // PUT — update existing doc(s) using configurable single match field
    if (method === "PUT") {
      const incoming = Array.isArray(payload) ? payload : [payload];
      if (incoming.length === 0) {
        return res.status(400).json({ ok: false, message: "Empty payload for PUT" });
      }

      // matchField decides which field to use as filter (default _id)
      const matchField = (api.meta && api.meta.matchField) ? String(api.meta.matchField) : "_id";

      // determine which columns are allowed to be updated: use api.columns (same as POST fields),
      // exclude system fields and the matchField itself
      const BODY_FIELD_EXCLUDE = new Set(["_id", "id", "__v", "createdAt", "updatedAt", "created_at", "updated_at"]);
      const allowedUpdateCols = (api.columns || []).filter((c) => !BODY_FIELD_EXCLUDE.has(c) && c !== matchField);

      if (allowedUpdateCols.length === 0) {
        return res.status(400).json({ ok: false, message: "No editable columns available for this PUT API." });
      }

      const ops = [];
      for (const item of incoming) {
        // get the identifier value from the payload depending on matchField
        let matchVal = item[matchField];

        // fallback to common fields if user gave id/_id when matchField is different
        if (matchVal === undefined && (item._id !== undefined)) matchVal = item._id;
        if (matchVal === undefined && (item.id !== undefined)) matchVal = item.id;

        if (matchVal === undefined || matchVal === null || matchVal === "") {
          return res.status(400).json({ ok: false, message: `Each PUT payload must include the match field "${matchField}" (or _id/id) as criteria` });
        }

        // build filter
        let filter;
        if (matchField === "_id") {
          // require ObjectId for _id
          try {
            filter = { _id: new mongoose.Types.ObjectId(matchVal) };
          } catch (e) {
            return res.status(400).json({ ok: false, message: `Invalid _id: ${matchVal}` });
          }
        } else {
          // if it looks like an ObjectId string try to convert; else use as-is
          filter = { [matchField]: tryObjectId(matchVal) };
        }

        // Fetch current document so we don't accidentally overwrite unchanged fields
        const existingDoc = await collection.findOne(filter);
        if (!existingDoc) {
          return res.status(404).json({ ok: false, message: "Document to update not found" });
        }

        // build setFields only for columns explicitly provided in the payload
        // and ignore empty-string values coming from clients (treat them as "no change")
        const setFields = {};
        for (const col of allowedUpdateCols) {
          if (Object.prototype.hasOwnProperty.call(item, col)) {
            const val = item[col];
            // Skip empty-string values which are often sent by forms for untouched inputs
            if (val === "") continue;
            setFields[col] = val;
          }
        }

        // If no editable fields were provided, reject the request for that item
        if (Object.keys(setFields).length === 0) {
          return res.status(400).json({ ok: false, message: `No updatable fields provided for match field "${matchField}"` });
        }

        // Always mark as updated when there are changes
        setFields.updatedAt = now;

        ops.push({ filter, update: { $set: setFields }, options: { upsert: false } });
      }

      const updateResults = [];
      for (const op of ops) {
        const r = await collection.updateOne(op.filter, op.update, op.options);
        updateResults.push(r);
      }

      // gather updated documents
      const filters = ops.map((o) => o.filter);
      // combine filters with $or
      let query = {};
      if (filters.length === 1) query = filters[0];
      else query = { $or: filters };

      let updatedDocs = await collection.find(query).toArray();

      // remove internal fields before returning (like __v)
      updatedDocs = updatedDocs.map((d) => {
        const clone = { ...d };
        if (clone.__v !== undefined) delete clone.__v;
        return clone;
      });

      return res.status(200).json({
        ok: true,
        method,
        matchedCount: updateResults.reduce((s, r) => s + (r.matchedCount || 0), 0),
        modifiedCount: updateResults.reduce((s, r) => s + (r.modifiedCount || 0), 0),
        data: updatedDocs,
      });
    }

    // POST — create new docs (existing behavior)
    if (method !== "POST") {
      return res.status(400).json({ ok: false, message: "Only POST is supported for execution (for now)" });
    }

    const incoming = Array.isArray(payload) ? payload : [payload];
    const docs = incoming.map((item = {}) => {
      const doc = { ...item };
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
    let inserted = await collection.find({ _id: { $in: insertedIds } }).toArray();

    inserted = inserted.map((d) => {
      const clone = { ...d };
      if (clone.__v !== undefined) delete clone.__v;
      return clone;
    });

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
