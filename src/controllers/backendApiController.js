// const BackendApi = require("../models/backendApi");
// const mongoose = require("mongoose");

// const createBackendApi = async (req, res) => {
//   try {
//     const {
//       api_name,
//       columns = [],
//       request = "GET",
//       dbName,
//       collectionName,
//       description,
//       payloadSample,
//       password,
//       meta,
//     } = req.body || {};

//     if (!api_name) {
//       return res.status(400).json({ ok: false, message: "Field api_name is required" });
//     }

//     const normalizedRequest = String(request).toUpperCase();

//     const doc = await BackendApi.create({
//       api_name,
//       columns,
//       request: normalizedRequest,
//       dbName,
//       collectionName,
//       description,
//       payloadSample,
//       password,
//       meta,
//     });

//     return res.status(201).json({ ok: true, data: doc });
//   } catch (err) {
//     console.error("Create backend API failed:", err);
//     return res.status(500).json({ ok: false, message: "Failed to create backend API", error: err.message });
//   }
// };

// const listBackendApis = async (_req, res) => {
//   try {
//     const apis = await BackendApi.find().sort({ createdAt: -1 });
//     return res.json({ ok: true, data: apis });
//   } catch (err) {
//     console.error("List backend APIs failed:", err);
//     return res.status(500).json({ ok: false, message: "Failed to fetch backend APIs", error: err.message });
//   }
// };

// const deleteBackendApi = async (req, res) => {
//   try {
//     const { id } = req.params;
//     if (!id) return res.status(400).json({ ok: false, message: "Id is required" });

//     const deleted = await BackendApi.findByIdAndDelete(id);
//     if (!deleted) return res.status(404).json({ ok: false, message: "API not found" });

//     return res.json({ ok: true, message: "API deleted", data: deleted });
//   } catch (err) {
//     console.error("Delete backend API failed:", err);
//     return res.status(500).json({ ok: false, message: "Failed to delete backend API", error: err.message });
//   }
// };

// const executeBackendApi = async (req, res) => {
//   try {
//     const { id } = req.params;
//     if (!id) return res.status(400).json({ ok: false, message: "Id is required" });

//     if (mongoose.connection.readyState !== 1) {
//       return res.status(503).json({ ok: false, message: "Mongoose is not connected" });
//     }

//     const api = await BackendApi.findById(id);
//     if (!api) return res.status(404).json({ ok: false, message: "API not found" });

//     const dbName = api.dbName || req.body.dbName;
//     const collectionName = api.collectionName || req.body.collectionName;
//     if (!dbName || !collectionName) {
//       return res.status(400).json({ ok: false, message: "Missing dbName or collectionName" });
//     }

//     const db = mongoose.connection.client.db(dbName);
//     const collection = db.collection(collectionName);

//     const method = (api.request || "GET").toUpperCase();
//     const payload = req.body?.payload ?? {};
//     const now = new Date();

//     // helper: detect 24-hex and return ObjectId or original string
//     const tryObjectId = (val) => {
//       if (typeof val === "string" && /^[a-fA-F0-9]{24}$/.test(val)) {
//         try { return new mongoose.Types.ObjectId(val); } catch (e) { return val; }
//       }
//       return val;
//     };

//     // PUT — update existing doc(s) using configurable single match field
//     if (method === "PUT") {
//       const incoming = Array.isArray(payload) ? payload : [payload];
//       if (incoming.length === 0) {
//         return res.status(400).json({ ok: false, message: "Empty payload for PUT" });
//       }

//       const matchField = (api.meta && api.meta.matchField) ? String(api.meta.matchField) : "_id";

//       const BODY_FIELD_EXCLUDE = new Set(["_id", "id", "__v", "createdAt", "updatedAt", "created_at", "updated_at"]);
//       const allowedUpdateCols = (api.columns || []).filter((c) => !BODY_FIELD_EXCLUDE.has(c) && c !== matchField);

//       if (allowedUpdateCols.length === 0) {
//         return res.status(400).json({ ok: false, message: "No editable columns available for this PUT API." });
//       }

//       const ops = [];
//       for (const item of incoming) {
//         let matchVal = item[matchField];
//         if (matchVal === undefined && (item._id !== undefined)) matchVal = item._id;
//         if (matchVal === undefined && (item.id !== undefined)) matchVal = item.id;

//         if (matchVal === undefined || matchVal === null || matchVal === "") {
//           return res.status(400).json({ ok: false, message: `Each PUT payload must include the match field "${matchField}" (or _id/id) as criteria` });
//         }

//         let filter;
//         if (matchField === "_id") {
//           try {
//             filter = { _id: new mongoose.Types.ObjectId(matchVal) };
//           } catch (e) {
//             return res.status(400).json({ ok: false, message: `Invalid _id: ${matchVal}` });
//           }
//         } else {
//           filter = { [matchField]: tryObjectId(matchVal) };
//         }

//         const existingDoc = await collection.findOne(filter);
//         if (!existingDoc) {
//           return res.status(404).json({ ok: false, message: "Document to update not found" });
//         }

//         const setFields = {};
//         for (const col of allowedUpdateCols) {
//           if (Object.prototype.hasOwnProperty.call(item, col)) {
//             const val = item[col];
//             if (val === "") continue; // skip empty-string (no change)
//             setFields[col] = val;
//           }
//         }

//         if (Object.keys(setFields).length === 0) {
//           return res.status(400).json({ ok: false, message: `No updatable fields provided for match field "${matchField}"` });
//         }

//         setFields.updatedAt = now;
//         ops.push({ filter, update: { $set: setFields }, options: { upsert: false } });
//       }

//       const updateResults = [];
//       for (const op of ops) {
//         const r = await collection.updateOne(op.filter, op.update, op.options);
//         updateResults.push(r);
//       }

//       const filters = ops.map((o) => o.filter);
//       let query = {};
//       if (filters.length === 1) query = filters[0];
//       else query = { $or: filters };

//       let updatedDocs = await collection.find(query).toArray();
//       updatedDocs = updatedDocs.map((d) => {
//         const clone = { ...d };
//         if (clone.__v !== undefined) delete clone.__v;
//         return clone;
//       });

//       return res.status(200).json({
//         ok: true,
//         method,
//         matchedCount: updateResults.reduce((s, r) => s + (r.matchedCount || 0), 0),
//         modifiedCount: updateResults.reduce((s, r) => s + (r.modifiedCount || 0), 0),
//         data: updatedDocs,
//       });
//     }

//     // FETCH — retrieve a single doc by configurable match field
//     if (method === "FETCH") {
//       const matchField = (api.meta && api.meta.matchField) ? String(api.meta.matchField) : "_id";
//       let matchVal = payload[matchField];
//       if (matchVal === undefined && (payload._id !== undefined)) matchVal = payload._id;
//       if (matchVal === undefined && (payload.id !== undefined)) matchVal = payload.id;

//       if (matchVal === undefined || matchVal === null || matchVal === "") {
//         return res.status(400).json({ ok: false, message: `FETCH requires value for match field "${matchField}" (or _id/id)` });
//       }

//       let filter;
//       if (matchField === "_id") {
//         try {
//           filter = { _id: new mongoose.Types.ObjectId(matchVal) };
//         } catch (e) {
//           return res.status(400).json({ ok: false, message: `Invalid _id: ${matchVal}` });
//         }
//       } else {
//         filter = { [matchField]: tryObjectId(matchVal) };
//       }

//       const doc = await collection.findOne(filter);
//       if (!doc) {
//         return res.status(404).json({ ok: false, message: "No data found for the provided criteria" });
//       }

//       const cleanDoc = { ...doc };
//       if (cleanDoc.__v !== undefined) delete cleanDoc.__v;

//       return res.status(200).json({ ok: true, method, data: cleanDoc });
//     }

//     // DELETE — remove doc(s) using configurable single match field
//     if (method === "DELETE") {
//       const incoming = Array.isArray(payload) ? payload : [payload];
//       if (incoming.length === 0) {
//         return res.status(400).json({ ok: false, message: "Empty payload for DELETE" });
//       }

//       const matchField = (api.meta && api.meta.matchField) ? String(api.meta.matchField) : "_id";

//       const deletedDocs = [];
//       let totalDeleted = 0;

//       for (const item of incoming) {
//         let matchVal = item[matchField];
//         if (matchVal === undefined && (item._id !== undefined)) matchVal = item._id;
//         if (matchVal === undefined && (item.id !== undefined)) matchVal = item.id;

//         if (matchVal === undefined || matchVal === null || matchVal === "") {
//           return res.status(400).json({ ok: false, message: `Each DELETE payload must include the match field "${matchField}" (or _id/id) as criteria` });
//         }

//         let filter;
//         if (matchField === "_id") {
//           try {
//             filter = { _id: new mongoose.Types.ObjectId(matchVal) };
//           } catch (e) {
//             return res.status(400).json({ ok: false, message: `Invalid _id: ${matchVal}` });
//           }
//         } else {
//           filter = { [matchField]: tryObjectId(matchVal) };
//         }

//         const docsToDelete = await collection.find(filter).toArray();
//         if (docsToDelete.length === 0) continue;

//         const delRes = await collection.deleteMany(filter);
//         totalDeleted += (delRes.deletedCount || 0);

//         docsToDelete.forEach((d) => {
//           const clone = { ...d };
//           if (clone.__v !== undefined) delete clone.__v;
//           deletedDocs.push(clone);
//         });
//       }

//       return res.status(200).json({
//         ok: true,
//         method,
//         deletedCount: totalDeleted,
//         data: deletedDocs,
//       });
//     }

//     // POST — create new docs (insert)
//     if (method !== "POST") {
//       return res.status(400).json({ ok: false, message: "Only POST/PUT/DELETE/FETCH are supported for execution (for now)" });
//     }

//     const incoming = Array.isArray(payload) ? payload : [payload];
//     const docs = incoming.map((item = {}) => {
//       const doc = { ...item };
//       try {
//         doc._id = doc._id ? new mongoose.Types.ObjectId(doc._id) : new mongoose.Types.ObjectId();
//       } catch {
//         doc._id = new mongoose.Types.ObjectId();
//       }
//       if (!doc.id) doc.id = doc._id.toString();
//       doc.createdAt = doc.createdAt || doc.created_at || now;
//       doc.updatedAt = now;
//       return doc;
//     });

//     const insertRes = await collection.insertMany(docs);
//     const insertedIds = Object.values(insertRes.insertedIds || {});
//     let inserted = await collection.find({ _id: { $in: insertedIds } }).toArray();

//     inserted = inserted.map((d) => {
//       const clone = { ...d };
//       if (clone.__v !== undefined) delete clone.__v;
//       return clone;
//     });

//     return res.status(201).json({
//       ok: true,
//       method,
//       insertedCount: insertRes.insertedCount,
//       data: inserted,
//     });
//   } catch (err) {
//     console.error("Execute backend API failed:", err);
//     return res
//       .status(500)
//       .json({
//         ok: false,
//         message: "Failed to execute backend API",
//         error: err.message,
//       });
//   }
// };

// module.exports = {
//   createBackendApi,
//   listBackendApis,
//   deleteBackendApi,
//   executeBackendApi,
// };
const BackendApi = require("../models/backendApi");
const mongoose = require("mongoose");

// ... (createBackendApi, listBackendApis, deleteBackendApi remain unchanged) ...
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

    // Helper to build filter based on matchField
    const buildFilter = (meta, payloadItem) => {
        const matchField = (meta && meta.matchField) ? String(meta.matchField) : "_id";
        
        // If the payload has the key, we use it. If not, we return empty filter (match all)
        // unless it's strictly required by specific methods logic.
        let matchVal = payloadItem[matchField];
        if (matchVal === undefined && (payloadItem._id !== undefined)) matchVal = payloadItem._id;
        if (matchVal === undefined && (payloadItem.id !== undefined)) matchVal = payloadItem.id;
        
        if (matchVal === undefined || matchVal === null || matchVal === "") {
            return {}; // No filter
        }

        if (matchField === "_id") {
            try {
                return { _id: new mongoose.Types.ObjectId(matchVal) };
            } catch (e) {
                return { _id: matchVal }; // Fallback
            }
        }
        return { [matchField]: tryObjectId(matchVal) };
    };

    // -------------------------------------------------------------------------
    // AGGREGATION HANDLERS
    // -------------------------------------------------------------------------
    
    // COUNT: Counts documents matching the criteria
    if (method === "COUNT") {
        const filter = buildFilter(api.meta, payload);
        const count = await collection.countDocuments(filter);
        return res.status(200).json({ ok: true, method, data: { count } });
    }

    // SUM, AVG, MIN, MAX
    // SUM, AVG, MIN, MAX
    if (["SUM", "AVG", "MIN", "MAX"].includes(method)) {
        const aggregateField = api.meta?.aggregateField;
        if (!aggregateField) {
             return res.status(400).json({ ok: false, message: `${method} requires an 'aggregateField' to be defined in API settings.` });
        }

        const filter = buildFilter(api.meta, payload);
        const operator = `$${method.toLowerCase()}`; // $sum, $avg, $min, $max

        const pipeline = [
            { $match: filter },
            // Add a conversion stage to handle Strings that look like Numbers
            {
                $project: {
                    convertedValue: {
                        $convert: {
                            input: `$${aggregateField}`,
                            to: "double",       // Attempt to convert to Number
                            onError: 0,         // If conversion fails (e.g. "abc"), use 0
                            onNull: 0           // If field is missing, use 0
                        }
                    }
                }
            },
            { 
                $group: { 
                    _id: null, 
                    result: { [operator]: "$convertedValue" } 
                } 
            }
        ];

        const result = await collection.aggregate(pipeline).toArray();
        const value = result.length > 0 ? result[0].result : 0;
        return res.status(200).json({ ok: true, method, data: { [aggregateField]: value } });
    }

    // GROUP_BY: Groups by a specific field and counts occurrences
    if (method === "GROUP_BY") {
        const aggregateField = api.meta?.aggregateField;
        if (!aggregateField) {
             return res.status(400).json({ ok: false, message: "GROUP_BY requires an 'aggregateField' (the field to group by)." });
        }
        
        const filter = buildFilter(api.meta, payload);

        const pipeline = [
            { $match: filter },
            { 
                $group: { 
                    _id: `$${aggregateField}`, 
                    count: { $sum: 1 } 
                } 
            },
            { $sort: { count: -1 } }, // Sort by highest count
            { $limit: 100 } // Safety limit
        ];

        const result = await collection.aggregate(pipeline).toArray();
        return res.status(200).json({ ok: true, method, data: result });
    }

    // -------------------------------------------------------------------------
    // EXISTING CRUD HANDLERS
    // -------------------------------------------------------------------------

    // PUT
    if (method === "PUT") {
      const incoming = Array.isArray(payload) ? payload : [payload];
      if (incoming.length === 0) return res.status(400).json({ ok: false, message: "Empty payload for PUT" });
      
      const matchField = (api.meta && api.meta.matchField) ? String(api.meta.matchField) : "_id";
      const BODY_FIELD_EXCLUDE = new Set(["_id", "id", "__v", "createdAt", "updatedAt", "created_at", "updated_at"]);
      const allowedUpdateCols = (api.columns || []).filter((c) => !BODY_FIELD_EXCLUDE.has(c) && c !== matchField);

      if (allowedUpdateCols.length === 0) return res.status(400).json({ ok: false, message: "No editable columns available." });

      const ops = [];
      for (const item of incoming) {
        // Strict check for match value presence for PUT
        let matchVal = item[matchField];
        if (matchVal === undefined && (item._id !== undefined)) matchVal = item._id;
        if (matchVal === undefined && (item.id !== undefined)) matchVal = item.id;

        if (matchVal === undefined || matchVal === "") {
             return res.status(400).json({ ok: false, message: `PUT requires value for match field "${matchField}"` });
        }
        
        const filter = buildFilter(api.meta, item); // Re-use helper
        
        const setFields = {};
        for (const col of allowedUpdateCols) {
          if (Object.prototype.hasOwnProperty.call(item, col)) {
            const val = item[col];
            if (val === "") continue;
            setFields[col] = val;
          }
        }
        if (Object.keys(setFields).length === 0) continue;

        setFields.updatedAt = now;
        ops.push({ filter, update: { $set: setFields } });
      }

      if(ops.length === 0) return res.status(400).json({ ok: false, message: "No valid updates found." });

      const updateResults = [];
      for (const op of ops) {
        const r = await collection.updateOne(op.filter, op.update);
        updateResults.push(r);
      }
      
      return res.status(200).json({
        ok: true,
        method,
        modifiedCount: updateResults.reduce((s, r) => s + (r.modifiedCount || 0), 0),
        data: { message: "Update complete" }, // Simplified return
      });
    }

    // FETCH
    if (method === "FETCH") {
      const filter = buildFilter(api.meta, payload);
      // Ensure strictly that filter is not empty (FETCH requires ID/Criteria)
      if(Object.keys(filter).length === 0) {
          return res.status(400).json({ ok: false, message: "FETCH requires criteria." });
      }

      const doc = await collection.findOne(filter);
      if (!doc) return res.status(404).json({ ok: false, message: "No data found" });
      
      const cleanDoc = { ...doc };
      if (cleanDoc.__v !== undefined) delete cleanDoc.__v;

      return res.status(200).json({ ok: true, method, data: cleanDoc });
    }

    // DELETE
    if (method === "DELETE") {
      const incoming = Array.isArray(payload) ? payload : [payload];
      if (incoming.length === 0) return res.status(400).json({ ok: false, message: "Empty payload" });

      const deletedDocs = [];
      let totalDeleted = 0;

      for (const item of incoming) {
        const filter = buildFilter(api.meta, item);
        if(Object.keys(filter).length === 0) {
             return res.status(400).json({ ok: false, message: "DELETE requires criteria." });
        }
        
        const docsToDelete = await collection.find(filter).toArray();
        if (docsToDelete.length === 0) continue;

        const delRes = await collection.deleteMany(filter);
        totalDeleted += (delRes.deletedCount || 0);
        docsToDelete.forEach((d) => deletedDocs.push(d));
      }

      return res.status(200).json({ ok: true, method, deletedCount: totalDeleted, data: deletedDocs });
    }

    // POST (Insert)
    if (method === "POST") {
        const incoming = Array.isArray(payload) ? payload : [payload];
        const docs = incoming.map((item = {}) => {
        const doc = { ...item };
        try { doc._id = doc._id ? new mongoose.Types.ObjectId(doc._id) : new mongoose.Types.ObjectId(); } 
        catch { doc._id = new mongoose.Types.ObjectId(); }
        if (!doc.id) doc.id = doc._id.toString();
        doc.createdAt = doc.createdAt || doc.created_at || now;
        doc.updatedAt = now;
        return doc;
        });

        const insertRes = await collection.insertMany(docs);
        return res.status(201).json({ ok: true, method, insertedCount: insertRes.insertedCount, data: docs });
    }

    return res.status(400).json({ ok: false, message: "Method not supported" });

  } catch (err) {
    console.error("Execute backend API failed:", err);
    return res.status(500).json({ ok: false, message: "Failed to execute backend API", error: err.message });
  }
};

module.exports = {
  createBackendApi,
  listBackendApis,
  deleteBackendApi,
  executeBackendApi,
};