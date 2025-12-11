const express = require("express");
const { createBackendApi, listBackendApis, deleteBackendApi } = require("../controllers/backendApiController");

const router = express.Router();

router.post("/", createBackendApi);
router.get("/", listBackendApis);
router.delete("/:id", deleteBackendApi);

module.exports = router;

