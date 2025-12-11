// src/controllers/introspectController.js
const mongoose = require("mongoose");

/**
 * GET /api/health
 * Check if DB connection is valid
 */
const checkConnection = async (req, res) => {
  try {
    const state = mongoose.connection.readyState; // 0,1,2,3
    const states = ["disconnected", "connected", "connecting", "disconnecting"];

    if (state !== 1) {
      return res.status(503).json({
        ok: false,
        status: "unhealthy",
        connectionState: states[state] || state,
        message: "Mongoose is not connected to MongoDB",
      });
    }

    // extra safety: ping via driver
    const adminDb = mongoose.connection.db.admin();
    await adminDb.ping();

    return res.json({
      ok: true,
      status: "healthy",
      connectionState: states[state],
      message: "MongoDB connection is valid",
    });
  } catch (err) {
    console.error("Health check failed:", err);
    return res.status(500).json({
      ok: false,
      status: "unhealthy",
      message: "Health check failed",
      error: err.message,
    });
  }
};

/**
 * GET /api/introspect/databases
 * List all databases on the Mongo server
 */
const listDatabases = async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        ok: false,
        message: "Mongoose is not connected",
      });
    }

    const admin = mongoose.connection.client.db().admin();
    const { databases } = await admin.listDatabases();

    return res.json({
      ok: true,
      count: databases.length,
      databases: databases.map((db) => ({
        name: db.name,
        sizeOnDisk: db.sizeOnDisk,
        empty: db.empty,
      })),
    });
  } catch (err) {
    console.error("List databases failed:", err);
    return res.status(500).json({
      ok: false,
      message: "Failed to list databases",
      error: err.message,
    });
  }
};

/**
 * GET /api/introspect/collections?dbName=...
 * List all collections (tables) of a given DB
 */
const listCollections = async (req, res) => {
  const { dbName } = req.query;

  if (!dbName) {
    return res.status(400).json({
      ok: false,
      message: "Query param dbName is required",
    });
  }

  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        ok: false,
        message: "Mongoose is not connected",
      });
    }

    const db = mongoose.connection.client.db(dbName);
    const collections = await db.listCollections().toArray();

    return res.json({
      ok: true,
      dbName,
      count: collections.length,
      collections: collections.map((c) => c.name),
    });
  } catch (err) {
    console.error("List collections failed:", err);
    return res.status(500).json({
      ok: false,
      message: "Failed to list collections",
      error: err.message,
    });
  }
};

/**
 * GET /api/introspect/documents?dbName=...&collectionName=...&limit=10
 * Fetch data from a specific collection
 */
const getDocuments = async (req, res) => {
  const { dbName, collectionName, limit } = req.query;

  if (!dbName || !collectionName) {
    return res.status(400).json({
      ok: false,
      message: "Query params dbName and collectionName are required",
    });
  }

  const docsLimit = Number(limit) > 0 ? Number(limit) : 10;

  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        ok: false,
        message: "Mongoose is not connected",
      });
    }

    const db = mongoose.connection.client.db(dbName);
    const collection = db.collection(collectionName);

    const documents = await collection.find({}).limit(docsLimit).toArray();

    return res.json({
      ok: true,
      dbName,
      collectionName,
      limit: docsLimit,
      count: documents.length,
      documents,
    });
  } catch (err) {
    console.error("Get documents failed:", err);
    return res.status(500).json({
      ok: false,
      message: "Failed to fetch documents",
      error: err.message,
    });
  }
};

/**
 * GET /api/introspect/columns?dbName=...&collectionName=...
 * List unique top-level fields for a given collection
 */
const listColumns = async (req, res) => {
  const { dbName, collectionName } = req.query;

  if (!dbName || !collectionName) {
    return res.status(400).json({
      ok: false,
      message: "Query params dbName and collectionName are required",
    });
  }

  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        ok: false,
        message: "Mongoose is not connected",
      });
    }

    const db = mongoose.connection.client.db(dbName);
    const collection = db.collection(collectionName);

    const sampleDocs = await collection.find({}).limit(100).toArray();
    const columnsSet = new Set();

    sampleDocs.forEach((doc) => {
      Object.keys(doc || {}).forEach((key) => columnsSet.add(key));
    });

    const columns = Array.from(columnsSet).sort();

    return res.json({
      ok: true,
      dbName,
      collectionName,
      columnsCount: columns.length,
      columns,
    });
  } catch (err) {
    console.error("List columns failed:", err);
    return res.status(500).json({
      ok: false,
      message: "Failed to list columns",
      error: err.message,
    });
  }
};

const connectCustomDb = async (req, res) => {
  const { uri } = req.body;

  if (!uri) {
    return res.status(400).json({
      ok: false,
      message: "Field 'uri' (MongoDB connection string) is required in request body",
    });
  }

  // Optional safety: allow only mongodb:// or mongodb+srv://
  if (!uri.startsWith("mongodb://") && !uri.startsWith("mongodb+srv://")) {
    return res.status(400).json({
      ok: false,
      message: "Invalid MongoDB URI. It should start with mongodb:// or mongodb+srv://",
    });
  }

  try {
    // If already connected or connecting, disconnect first
    if (mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) {
      await mongoose.disconnect();
    }

    // Connect to the provided URI
    await mongoose.connect(uri, {
      // add any options you like here
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
    });

    const state = mongoose.connection.readyState; // 0,1,2,3
    const states = ["disconnected", "connected", "connecting", "disconnecting"];

    return res.status(200).json({
      ok: true,
      message: "Connected to custom MongoDB successfully",
      connectionState: states[state] || state,
    });
  } catch (error) {
    console.error("Custom DB connect failed:", error);
    return res.status(500).json({
      ok: false,
      message: "Failed to connect to custom MongoDB",
      error: error.message,
    });
  }
};

module.exports = {
  checkConnection,
  listDatabases,
  listCollections,
  getDocuments,
  connectCustomDb,
  listColumns
};
