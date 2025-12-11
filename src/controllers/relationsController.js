// // controllers/relationsController.js
// const mongoose = require("mongoose");

// function collectRefsFromSchema(schema, addRef) {
//   schema.eachPath((pathname, schemaType) => {
//     const options = schemaType.options || {};

//     // Direct ref: { type: ObjectId, ref: 'User' }
//     if (options.ref) {
//       addRef(options.ref);
//     }

//     // Array of refs: [{ type: ObjectId, ref: 'User' }]
//     if (schemaType.$isMongooseArray && schemaType.caster?.options?.ref) {
//       addRef(schemaType.caster.options.ref);
//     }

//     // Nested schema / subdocument
//     if (schemaType.schema) {
//       collectRefsFromSchema(schemaType.schema, addRef);
//     }
//   });
// }

// exports.getRelations = (req, res) => {
//   try {
//     // optional: ensure connection is up
//     if (mongoose.connection.readyState !== 1) {
//       return res.status(503).json({
//         success: false,
//         message: "Mongoose is not connected",
//       });
//     }

//     const relations = {};
//     const modelNames = mongoose.modelNames();

//     for (const modelName of modelNames) {
//       const schema = mongoose.model(modelName).schema;
//       const refs = new Set();

//       const addRef = (refName) => {
//         if (refName) refs.add(refName);
//       };

//       collectRefsFromSchema(schema, addRef);

//       relations[modelName] = Array.from(refs);
//     }

//     console.log(relations);

//     return res.status(200).json({
//       success: true,
//       data: relations,
//     });
//   } catch (error) {
//     console.error("getRelations failed:", error);
//     return res.status(500).json({
//       success: false,
//       error: error.message,
//     });
//   }
// };



const mongoose = require("mongoose");

exports.getRelations = async (req, res) => {
  try {
    const relations = {};
    
    // 1. Get the raw database connection (supports dynamic switching)
    // Assuming your app switches mongoose.connection or you have a global 'activeDb'
    // If you use a separate connection instance, replace mongoose.connection with that instance.
    const db = mongoose.connection.db; 

    if (!db) {
      return res.status(200).json({ success: true, data: {} });
    }

    // 2. Get all actual collections in the connected DB
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map((c) => c.name);

    // Helper: Map collection names to potential references (e.g. "users" -> "User")
    const normalizeName = (name) => name.toLowerCase().replace(/s$/, ""); 

    for (const col of collections) {
      const colName = col.name;
      const modelName = getModelNameFromCollection(colName);
      
      // -- STRATEGY A: Use Mongoose Schema (if defined in code) --
      if (modelName && mongoose.models[modelName]) {
        relations[colName] = getRelationsFromSchema(mongoose.models[modelName].schema);
      } 
      // -- STRATEGY B: Infer from Data (for custom/external DBs) --
      else {
        relations[colName] = await inferRelationsFromData(db, colName, collectionNames);
      }
    }

    return res.status(200).json({
      success: true,
      data: relations,
    });

  } catch (error) {
    console.error("Relation error:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// --- Helper Functions ---

/**
 * Tries to find if a local Mongoose model exists for this collection name.
 */
function getModelNameFromCollection(collectionName) {
  return mongoose.modelNames().find(
    (name) => mongoose.model(name).collection.name === collectionName
  );
}

/**
 * Extracts refs from a defined Mongoose Schema
 */
function getRelationsFromSchema(schema) {
  const refs = new Set();
  
  schema.eachPath((pathname, schemaType) => {
    // Direct ref (e.g. user: { type: ObjectId, ref: 'User' })
    if (schemaType.options?.ref) {
      refs.add(schemaType.options.ref);
    }
    // Array ref (e.g. users: [{ type: ObjectId, ref: 'User' }])
    if (schemaType.$isMongooseArray && schemaType.caster?.options?.ref) {
      refs.add(schemaType.caster.options.ref);
    }
  });

  return Array.from(refs);
}

/**
 * Scans a real document to guess relations based on field names.
 * e.g. "categoryId" field -> likely points to "categories" collection
 */
async function inferRelationsFromData(db, colName, allCollections) {
  const refs = new Set();
  
  // Fetch one sample document
  const docs = await db.collection(colName).find().limit(1).toArray();
  if (docs.length === 0) return [];
  
  const doc = docs[0];

  // Helper to check if a string looks like an ObjectId
  const isIdLike = (val) => {
    if (!val) return false;
    const str = String(val);
    return /^[0-9a-fA-F]{24}$/.test(str); // 24-char hex string
  };

  // Helper: flatten keys if you want deep inspection, 
  // but for simple top-level inference:
  Object.keys(doc).forEach((key) => {
    // Skip the document's own _id
    if (key === "_id") return;

    const value = doc[key];
    
    // Heuristic: Check if key ends in "Id" or "_id" (e.g. "userId", "category_id")
    if (key.toLowerCase().endsWith("id")) {
      // 1. Guess the target collection name
      // e.g. "userId" -> base "user" -> match against "users" in allCollections
      const baseName = key.replace(/_?id$/i, "").toLowerCase();
      
      const targetCol = allCollections.find(c => {
        // Simple plural check: 'user' matches 'users'
        return c.toLowerCase() === baseName || c.toLowerCase() === baseName + "s";
      });

      if (targetCol && targetCol !== colName) {
         // Verify value looks like an ID (optional but safer)
         if (isIdLike(value) || (Array.isArray(value) && value.some(isIdLike))) {
           refs.add(targetCol);
         }
      }
    }
  });

  return Array.from(refs);
}