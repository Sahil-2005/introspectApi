const mongoose = require("mongoose");
const RelationMetadata = require("../models/relationMetadata");

/**
 * Get all relation metadata for a database
 * GET /api/relation-metadata?dbName=...
 */
exports.getRelationMetadata = async (req, res) => {
  try {
    const { dbName } = req.query;
    
    if (!dbName) {
      return res.status(400).json({
        ok: false,
        message: "Query param 'dbName' is required"
      });
    }

    const relations = await RelationMetadata.find({ dbName }).lean();
    
    // Group by source collection for easier visualization
    const grouped = {};
    relations.forEach(rel => {
      if (!grouped[rel.sourceCollection]) {
        grouped[rel.sourceCollection] = [];
      }
      grouped[rel.sourceCollection].push({
        _id: rel._id,
        sourceField: rel.sourceField,
        targetCollection: rel.targetCollection,
        relationType: rel.relationType,
        isRequired: rel.isRequired,
        description: rel.description,
        autoPopulate: rel.autoPopulate
      });
    });

    return res.json({
      ok: true,
      relations: grouped,
      raw: relations
    });
  } catch (err) {
    console.error("[getRelationMetadata] error:", err);
    return res.status(500).json({
      ok: false,
      message: "Failed to fetch relation metadata",
      error: err.message
    });
  }
};

/**
 * Get relations for a specific collection
 * GET /api/relation-metadata/collection/:collectionName?dbName=...
 */
exports.getCollectionRelations = async (req, res) => {
  try {
    const { collectionName } = req.params;
    const { dbName } = req.query;
    
    if (!dbName || !collectionName) {
      return res.status(400).json({
        ok: false,
        message: "Both 'dbName' query param and 'collectionName' are required"
      });
    }

    // Get relations where this collection is the source
    const outgoingRelations = await RelationMetadata.find({
      dbName,
      sourceCollection: collectionName
    }).lean();

    // Get relations where this collection is the target (reverse relations)
    const incomingRelations = await RelationMetadata.find({
      dbName,
      targetCollection: collectionName
    }).lean();

    return res.json({
      ok: true,
      outgoing: outgoingRelations,
      incoming: incomingRelations
    });
  } catch (err) {
    console.error("[getCollectionRelations] error:", err);
    return res.status(500).json({
      ok: false,
      message: "Failed to fetch collection relations",
      error: err.message
    });
  }
};

/**
 * Create a new relation
 * POST /api/relation-metadata
 */
exports.createRelation = async (req, res) => {
  try {
    const {
      dbName,
      sourceCollection,
      sourceField,
      targetCollection,
      relationType = 'many-to-one',
      isRequired = false,
      description = '',
      autoPopulate = false
    } = req.body;

    // Validate required fields
    if (!dbName || !sourceCollection || !sourceField || !targetCollection) {
      return res.status(400).json({
        ok: false,
        message: "Fields 'dbName', 'sourceCollection', 'sourceField', and 'targetCollection' are required"
      });
    }

    // Prevent self-referencing on the same field (circular)
    if (sourceCollection === targetCollection && sourceField === '_id') {
      return res.status(400).json({
        ok: false,
        message: "Cannot create a self-reference on _id field"
      });
    }

    // Check if relation already exists
    const existing = await RelationMetadata.findOne({
      dbName,
      sourceCollection,
      sourceField
    });

    if (existing) {
      return res.status(409).json({
        ok: false,
        message: `A relation already exists for field '${sourceField}' in collection '${sourceCollection}'`
      });
    }

    // Check for circular reference chains
    const circularCheck = await checkCircularReference(dbName, sourceCollection, targetCollection);
    if (circularCheck.isCircular) {
      return res.status(400).json({
        ok: false,
        message: `Circular reference detected: ${circularCheck.path.join(' -> ')}`,
        circularPath: circularCheck.path
      });
    }

    // Create the relation
    const relation = new RelationMetadata({
      dbName,
      sourceCollection,
      sourceField,
      targetCollection,
      relationType,
      isRequired,
      description,
      autoPopulate
    });

    await relation.save();

    // Update the collection schema to reflect the reference type
    await updateCollectionSchemaWithRef(dbName, sourceCollection, sourceField, targetCollection, isRequired);

    return res.status(201).json({
      ok: true,
      message: "Relation created successfully",
      relation
    });
  } catch (err) {
    console.error("[createRelation] error:", err);
    if (err.code === 11000) {
      return res.status(409).json({
        ok: false,
        message: "A relation with this source field already exists"
      });
    }
    return res.status(500).json({
      ok: false,
      message: "Failed to create relation",
      error: err.message
    });
  }
};

/**
 * Update a relation
 * PUT /api/relation-metadata/:id
 */
exports.updateRelation = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Don't allow changing source collection/field (delete and recreate instead)
    delete updates.dbName;
    delete updates.sourceCollection;
    delete updates.sourceField;

    const relation = await RelationMetadata.findByIdAndUpdate(
      id,
      { ...updates, updatedAt: new Date() },
      { new: true }
    );

    if (!relation) {
      return res.status(404).json({
        ok: false,
        message: "Relation not found"
      });
    }

    return res.json({
      ok: true,
      message: "Relation updated successfully",
      relation
    });
  } catch (err) {
    console.error("[updateRelation] error:", err);
    return res.status(500).json({
      ok: false,
      message: "Failed to update relation",
      error: err.message
    });
  }
};

/**
 * Delete a relation
 * DELETE /api/relation-metadata/:id
 */
exports.deleteRelation = async (req, res) => {
  try {
    const { id } = req.params;

    const relation = await RelationMetadata.findByIdAndDelete(id);

    if (!relation) {
      return res.status(404).json({
        ok: false,
        message: "Relation not found"
      });
    }

    return res.json({
      ok: true,
      message: "Relation deleted successfully"
    });
  } catch (err) {
    console.error("[deleteRelation] error:", err);
    return res.status(500).json({
      ok: false,
      message: "Failed to delete relation",
      error: err.message
    });
  }
};

/**
 * Validate a potential relation (check for circular references)
 * POST /api/relation-metadata/validate
 */
exports.validateRelation = async (req, res) => {
  try {
    const { dbName, sourceCollection, targetCollection } = req.body;

    if (!dbName || !sourceCollection || !targetCollection) {
      return res.status(400).json({
        ok: false,
        message: "Fields 'dbName', 'sourceCollection', and 'targetCollection' are required"
      });
    }

    const circularCheck = await checkCircularReference(dbName, sourceCollection, targetCollection);

    return res.json({
      ok: true,
      isValid: !circularCheck.isCircular,
      isCircular: circularCheck.isCircular,
      circularPath: circularCheck.path
    });
  } catch (err) {
    console.error("[validateRelation] error:", err);
    return res.status(500).json({
      ok: false,
      message: "Failed to validate relation",
      error: err.message
    });
  }
};

/**
 * Get available target collections for a database
 * GET /api/relation-metadata/available-targets?dbName=...
 */
exports.getAvailableTargets = async (req, res) => {
  try {
    const { dbName } = req.query;

    if (!dbName) {
      return res.status(400).json({
        ok: false,
        message: "Query param 'dbName' is required"
      });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        ok: false,
        message: "Database not connected"
      });
    }

    const db = mongoose.connection.client.db(dbName);
    const collections = await db.listCollections().toArray();
    
    const targets = collections.map(col => ({
      name: col.name,
      // Generate a model name (capitalize first letter, singularize if needed)
      modelName: toModelName(col.name)
    }));

    return res.json({
      ok: true,
      targets
    });
  } catch (err) {
    console.error("[getAvailableTargets] error:", err);
    return res.status(500).json({
      ok: false,
      message: "Failed to fetch available targets",
      error: err.message
    });
  }
};

// ============ Helper Functions ============

/**
 * Check for circular references in the relation chain
 */
async function checkCircularReference(dbName, sourceCollection, targetCollection, visited = new Set(), path = []) {
  // Add current source to path
  path.push(sourceCollection);
  
  // If target is already in visited, we have a circle
  if (visited.has(targetCollection)) {
    path.push(targetCollection);
    return { isCircular: true, path };
  }

  // If source equals target, it's a self-reference (allowed for some cases)
  if (sourceCollection === targetCollection) {
    // Self-reference is okay, but we should note it
    return { isCircular: false, path: [], isSelfReference: true };
  }

  visited.add(sourceCollection);

  // Get all relations from the target collection
  const targetRelations = await RelationMetadata.find({
    dbName,
    sourceCollection: targetCollection
  }).lean();

  // Check each outgoing relation from the target
  for (const rel of targetRelations) {
    const result = await checkCircularReference(
      dbName,
      targetCollection,
      rel.targetCollection,
      new Set(visited),
      [...path]
    );
    if (result.isCircular) {
      return result;
    }
  }

  return { isCircular: false, path: [] };
}

/**
 * Update collection schema to add reference field
 */
async function updateCollectionSchemaWithRef(dbName, collectionName, fieldName, targetCollection, isRequired) {
  try {
    const db = mongoose.connection.client.db(dbName);
    const col = db.collection(collectionName);
    
    // Update existing documents to ensure the field exists
    // We use ObjectId type for reference fields
    const updateResult = await col.updateMany(
      { [fieldName]: { $exists: false } },
      { $set: { [fieldName]: null } }
    );

    console.log(`[updateCollectionSchemaWithRef] Updated ${updateResult.modifiedCount} documents in ${collectionName}`);
    
    return true;
  } catch (err) {
    console.error("[updateCollectionSchemaWithRef] error:", err);
    return false;
  }
}

/**
 * Convert collection name to model name
 * e.g., "users" -> "User", "order_items" -> "OrderItem"
 */
function toModelName(collectionName) {
  // Remove trailing 's' for simple pluralization
  let name = collectionName;
  if (name.endsWith('ies')) {
    name = name.slice(0, -3) + 'y';
  } else if (name.endsWith('s') && !name.endsWith('ss')) {
    name = name.slice(0, -1);
  }
  
  // Convert to PascalCase
  return name
    .split(/[_-]/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');
}
