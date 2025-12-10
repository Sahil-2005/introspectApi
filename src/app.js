// src/app.js
const express = require("express");
const cors = require("cors");
const introspectRoutes = require("./routes/introspectRoutes");

const relationsRoutes = require("./routes/relationsRoutes");

const app = express();

// Global middlewares
app.use(express.json());
app.use(cors());

// Base route
app.get("/", (req, res) => {
  res.json({
    message: "Mongo Introspect API (Node + Express + Mongoose)",
  });
});

// Mount introspection routes under /api
app.use("/api/introspect", introspectRoutes);
app.use("/api/relations", relationsRoutes);

// Health alias at /api/health
const { checkConnection } = require("./controllers/introspectController");
app.get("/api/health", checkConnection);

module.exports = app;
