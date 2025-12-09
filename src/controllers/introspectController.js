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

module.exports = {
  checkConnection,
  listDatabases,
  listCollections,
  getDocuments,
};
