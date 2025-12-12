const express = require("express");
const {
  loginAdmin,
  forgotPassword,
  resetPassword,
  logoutAdmin,
} = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/login", loginAdmin);

// Logout (clears cookie + server session)
router.post("/logout", protect, logoutAdmin);

// 🔹 Forgot password (no auth needed)
router.post("/forgot-password", forgotPassword);

// 🔹 Reset password (no auth needed)
router.post("/reset-password", resetPassword);

// ✅ Token verification route (protected via session token or cookie)
router.get("/verify", protect, async (req, res) => {
  try {
    const Admin = require("../models/user");

    // If protect attached the admin doc (session token flow), use it
    const adminDoc = req.adminDoc || (req.admin?.id ? await Admin.findById(req.admin.id) : null);

    if (!adminDoc) {
      return res.status(404).json({
        ok: false,
        message: "Admin not found",
      });
    }

    return res.json({
      ok: true,
      admin: {
        id: adminDoc._id,
        email: adminDoc.email,
        role: adminDoc.role || "admin",
      },
    });
  } catch (err) {
    console.error("Verify error:", err);
    return res.status(500).json({
      ok: false,
      message: "Server error",
    });
  }
});

module.exports = router;
