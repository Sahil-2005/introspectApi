// src/app.js
const express = require("express");
const cors = require("cors");
const introspectRoutes = require("./routes/introspectRoutes");

const relationsRoutes = require("./routes/relationsRoutes");
const relationMetadataRoutes = require("./routes/relationMetadataRoutes");
const backendApiRoutes = require("./routes/backendApiRoutes");
const { protect, authorizeRoles } = require("./middleware/authMiddleware");
const cookieParser = require('cookie-parser');


const app = express();

// Global middlewares
app.use(express.json());
app.use(cors({
  origin: 'http://localhost:5173', // exact origin of your React app
  credentials: true,
}));
app.use("/api/auth", require("./routes/authRoute"));
// Base route
app.get("/", (req, res) => {
  res.json({
    message: "Mongo Introspect API (Node + Express + Mongoose)",
  });
});

// Mount introspection routes under /api
app.use("/api/introspect", protect, authorizeRoles("admin"), introspectRoutes);
app.use("/api/relations", protect, authorizeRoles("admin"), relationsRoutes);
app.use("/api/relation-metadata", protect, authorizeRoles("admin"), relationMetadataRoutes);
app.use("/api/backend-apis", protect, authorizeRoles("admin"), backendApiRoutes);

// Health alias at /api/health
const { checkConnection } = require("./controllers/introspectController");
app.get("/api/health", checkConnection);

module.exports = app;
