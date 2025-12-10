const express = require("express");
const router = express.Router();
const { getRelations } = require("../controllers/relationsController");

// GET /api/relations
router.get("/", getRelations);

module.exports = router;