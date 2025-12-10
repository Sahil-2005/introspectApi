// src/routes/introspectRoutes.js
const express = require("express");
const {
  checkConnection,
  listDatabases,
  listCollections,
  getDocuments,
  connectCustomDb
} = require("../controllers/introspectController");

const router = express.Router();


router.post("/connect", connectCustomDb);


// Health / connection
router.get("/health", checkConnection);

// Introspection
router.get("/databases", listDatabases);
router.get("/collections", listCollections);
router.get("/documents", getDocuments);

module.exports = router;
