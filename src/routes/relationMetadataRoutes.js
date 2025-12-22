const express = require("express");
const router = express.Router();
const relationMetadataController = require("../controllers/relationMetadataController");

// Get all relations for a database
router.get("/", relationMetadataController.getRelationMetadata);

// Get relations for a specific collection
router.get("/collection/:collectionName", relationMetadataController.getCollectionRelations);

// Create a new relation
router.post("/", relationMetadataController.createRelation);

// Update a relation
router.put("/:id", relationMetadataController.updateRelation);

// Delete a relation
router.delete("/:id", relationMetadataController.deleteRelation);

// Validate relation (check for circular references)
router.post("/validate", relationMetadataController.validateRelation);

// Get all collections available for reference in a database
router.get("/available-targets", relationMetadataController.getAvailableTargets);

module.exports = router;
