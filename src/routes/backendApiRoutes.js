// backend/introspectApi/src/routes/backendApiRoutes.js
const express = require("express");
const {
  createBackendApi,
  listBackendApis,
  deleteBackendApi,
  executeBackendApi,
} = require("../controllers/backendApiController");

const router = express.Router();

// Create API
router.post("/", createBackendApi);

// List APIs
router.get("/", listBackendApis);

// Delete an API
router.delete("/:id", deleteBackendApi);

// Execute a saved API (POST is used for executing; backend decides action by saved `request` field)
router.post("/:id/execute", executeBackendApi);

module.exports = router;
