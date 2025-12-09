// src/middleware/jwtAuthMiddleware.js
const { verifyAccessToken } = require("../utils/jwt");

function jwtAuthMiddleware(req, res, next) {
  const auth = req.headers["authorization"];

  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({
      ok: false,
      message: "Missing or invalid Authorization header",
    });
  }

  const token = auth.split(" ")[1];

  try {
    const payload = verifyAccessToken(token);
    req.user = payload; // attach user info to req
    next();
  } catch (err) {
    return res.status(401).json({
      ok: false,
      message: "Invalid or expired access token",
    });
  }
}

module.exports = jwtAuthMiddleware;
