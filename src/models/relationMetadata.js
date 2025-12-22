const mongoose = require("mongoose");

/**
 * RelationMetadata Schema
 * Stores explicit relationship definitions between collections
 * This allows for visualization and proper population during queries
 */
const relationMetadataSchema = new mongoose.Schema({
  // The database where the relation exists
  dbName: {
    type: String,
    required: true,
    index: true
  },
  // Source collection containing the reference field
  sourceCollection: {
    type: String,
    required: true,
    index: true
  },
  // Field name in the source collection that holds the reference
  sourceField: {
    type: String,
    required: true
  },
  // Target collection being referenced
  targetCollection: {
    type: String,
    required: true,
    index: true
  },
  // Relationship type: 'one-to-one', 'one-to-many', 'many-to-one', 'many-to-many'
  relationType: {
    type: String,
    enum: ['one-to-one', 'one-to-many', 'many-to-one', 'many-to-many'],
    default: 'many-to-one'
  },
  // Whether the reference is required
  isRequired: {
    type: Boolean,
    default: false
  },
  // Optional description of the relationship
  description: {
    type: String,
    default: ''
  },
  // Whether to auto-populate this relation when fetching documents
  autoPopulate: {
    type: Boolean,
    default: false
  },
  // Whether this relation was auto-detected from schema/data (vs manually created)
  inferredFromSchema: {
    type: Boolean,
    default: false
  },
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index to ensure unique relations
relationMetadataSchema.index(
  { dbName: 1, sourceCollection: 1, sourceField: 1 },
  { unique: true }
);

// Update timestamp on save
relationMetadataSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model("RelationMetadata", relationMetadataSchema);
