// controllers/relationsController.js
const mongoose = require("mongoose");

function collectRefsFromSchema(schema, addRef) {
  schema.eachPath((pathname, schemaType) => {
    const options = schemaType.options || {};

    // Direct ref: { type: ObjectId, ref: 'User' }
    if (options.ref) {
      addRef(options.ref);
    }

    // Array of refs: [{ type: ObjectId, ref: 'User' }]
    if (schemaType.$isMongooseArray && schemaType.caster?.options?.ref) {
      addRef(schemaType.caster.options.ref);
    }

    // Nested schema / subdocument
    if (schemaType.schema) {
      collectRefsFromSchema(schemaType.schema, addRef);
    }
  });
}

exports.getRelations = (req, res) => {
  try {
    // optional: ensure connection is up
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        message: "Mongoose is not connected",
      });
    }

    const relations = {};
    const modelNames = mongoose.modelNames();

    for (const modelName of modelNames) {
      const schema = mongoose.model(modelName).schema;
      const refs = new Set();

      const addRef = (refName) => {
        if (refName) refs.add(refName);
      };

      collectRefsFromSchema(schema, addRef);

      relations[modelName] = Array.from(refs);
    }

    return res.status(200).json({
      success: true,
      data: relations,
    });
  } catch (error) {
    console.error("getRelations failed:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

