const express = require("express");
const {
  createBackendApi,
  listBackendApis,
  deleteBackendApi,
  executeBackendApi,
} = require("../controllers/backendApiController");

const router = express.Router();

router.post("/", createBackendApi);
router.get("/", listBackendApis);
router.delete("/:id", deleteBackendApi);
router.post("/:id/execute", executeBackendApi);

module.exports = router;

