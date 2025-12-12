const jwt = require("jsonwebtoken");
const Admin = require("../models/user");

// ✅ Authentication middleware - verifies JWT and attaches admin to request
exports.protect = async (req, res, next) => {
  try {
    // Prefer session cookie flow: fetch JWT stored in DB using session token
    const sessionToken = req.cookies?.session || req.headers['x-session-token'];
    if (sessionToken) {
      const adminDoc = await Admin.findOne({ sessionToken, sessionExpires: { $gt: new Date() } });
      if (!adminDoc) return res.status(401).json({ message: 'Not authorized, invalid or expired session' });

      const jwtToken = adminDoc.jwtToken;
      if (!jwtToken) return res.status(401).json({ message: 'Not authorized, jwt missing' });

      const decoded = jwt.verify(jwtToken, process.env.JWT_SECRET);
      req.admin = decoded; // { id: ... }
      req.adminDoc = adminDoc; // attach full admin doc for downstream use
      return next();
    }

    // Fallback: Bearer token in Authorization header (legacy)
    let token = req.headers.authorization;
    if (!token || !token.startsWith('Bearer')) {
      return res.status(401).json({ message: 'Not authorized, token missing' });
    }

    token = token.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (err) {
    console.error('Auth protect error:', err);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

// ✅ RBAC middleware - authorizes based on admin roles
exports.authorizeRoles = (...roles) => {
  return async (req, res, next) => {
    try {
      // req.admin is set by protect middleware
      if (!req.admin || !req.admin.id) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const admin = await Admin.findById(req.admin.id);
      if (!admin) {
        return res.status(404).json({ message: "Admin not found" });
      }

      // Check if admin role is in allowed roles
      if (!roles.includes(admin.role)) {
        return res.status(403).json({ message: `Role '${admin.role}' not allowed. Allowed roles: ${roles.join(", ")}` });
      }

      req.admin = admin; // attach full admin object for later use
      next();
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Authorization error" });
    }
  };
};
