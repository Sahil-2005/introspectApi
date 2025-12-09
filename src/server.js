// src/server.js
const app = require("./app");
const connectDB = require("./config/db");
const { PORT } = require("./config/env");

(async () => {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`🚀 Server listening on http://localhost:${PORT}`);
  });
})();
