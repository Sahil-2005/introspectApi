// src/routes/introspectRoutes.js
const express = require("express");
const {
  checkConnection,
  listDatabases,
  listCollections,
  getDocuments,
  connectCustomDb,
  listColumns,
  createDatabaseAndCollection,
} = require("../controllers/introspectController");

const router = express.Router();


router.post("/connect", connectCustomDb);

// Create DB + collection (and optional schema metadata)
router.post("/create-db", createDatabaseAndCollection);


// Health / connection
router.get("/health", checkConnection);

// Introspection
router.get("/databases", listDatabases);
router.get("/collections", listCollections);
router.get("/documents", getDocuments);
router.get("/colums", listColumns);

module.exports = router;
