// const Admin = require("../models/user");
// const bcrypt = require("bcryptjs");
// const jwt = require("jsonwebtoken");
// const crypto = require("crypto");
// const { sendEmail } = require("../config/email");

// /* LOGIN ADMIN */
// /* LOGIN ADMIN */
// exports.loginAdmin = async (req, res) => {
//   try {
//     const { email, password } = req.body;

//     if (!email || !password) {
//       return res.status(400).json({ message: "All fields are required" });
//     }

//     const admin = await Admin.findOne({ email });
//     if (!admin) {
//       return res.status(401).json({ message: "Invalid email or password" });
//     }

//     const isMatch = await bcrypt.compare(password, admin.password);
//     if (!isMatch) {
//       return res.status(401).json({ message: "Invalid email or password" });
//     }

//     // -------- Generate Tokens --------
//     const token = jwt.sign({ id: admin._id }, process.env.JWT_SECRET, {
//       expiresIn: "7d",
//     });

//     const sessionToken = crypto.randomBytes(32).toString("hex");
//     const sessionExpiry = Date.now() + 7 * 24 * 60 * 60 * 1000;

//     admin.jwtToken = token;
//     admin.sessionToken = sessionToken;
//     admin.sessionExpires = new Date(sessionExpiry);
//     await admin.save();

//     // Cookie for refresh-like behavior
//     const cookieOpts = {
//       httpOnly: true,
//       maxAge: 7 * 24 * 60 * 60 * 1000,
//       sameSite: "lax",
//     };
//     if (process.env.NODE_ENV === "production") cookieOpts.secure = true;

//     res.cookie("session", sessionToken, cookieOpts);

//     // -------- Final Response (your requested format) --------
//     return res.status(200).json({
//       success: true,
//       user: {
//         id: admin._id,
//         email: admin.email,
//         // name: admin.name || null,
//         role: "admin",
//         // phone: admin.phone || null,
//       },
//       tokens: {
//         accessToken: token,
//         refreshToken: sessionToken,
//         idToken: token,
//         expiresIn: 7 * 24 * 60 * 60, // seconds
//       },
//       platform: "admin-panel",
//     });

//   } catch (err) {
//     console.error(err);
//     return res.status(500).json({ message: "Server error" });
//   }
// };


// /* 🔹 FORGOT PASSWORD */
// exports.forgotPassword = async (req, res) => {
//   try {
//     const { email } = req.body;

//     if (!email) {
//       return res.status(400).json({ message: "Email is required" });
//     }

//     const admin = await Admin.findOne({ email });

//     // Don't reveal whether admin exists (security)
//     if (!admin) {
//       return res.json({
//         message:
//           "If an account with that email exists, a password reset link has been sent.",
//       });
//     }

//     // Generate reset token
//     const resetToken = crypto.randomBytes(32).toString("hex");
//     // const resetTokenExpiry = Date.now() + 60 * 60 * 1000; 
//     const resetTokenExpiry = Date.now() + 60 * 60 * 1000; // 1 hour

//     admin.resetPasswordToken = resetToken;
//     admin.resetPasswordExpires = resetTokenExpiry;
//     await admin.save();

//     const baseUrl =
//       process.env.FRONTEND_URL || process.env.BACKEND_URL || "http://localhost:5000";

//     // This is where your frontend reset page would be
//     const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;

//     console.log("Password reset link:", resetUrl);

//     const html = `
//       <p>You requested a password reset for your admin account.</p>
//       <p>Click the link below to set a new password (valid for 1 hour):</p>
//       <a href="${resetUrl}" target="_blank">${resetUrl}</a>
//     `;

//     await sendEmail({
//       to: admin.email,
//       subject: "Admin Panel Password Reset",
//       html,
//     });

//     return res.json({
//       message:
//         "If an account with that email exists, a password reset link has been sent.",
//     });
//   } catch (err) {
//     console.error("Forgot password error:", err);
//     res.status(500).json({ message: "Server error" });
//   }
// };


// /* 🔹 RESET PASSWORD */
// exports.resetPassword = async (req, res) => {
//   try {
//     const { token, password } = req.body;

//     if (!token || !password) {
//       return res.status(400).json({
//         message: "Token and new password are required",
//       });
//     }

//     const admin = await Admin.findOne({
//       resetPasswordToken: token,
//       resetPasswordExpires: { $gt: Date.now() }, // token not expired
//     });

//     if (!admin) {
//       return res.status(400).json({
//         message: "Invalid or expired reset token",
//       });
//     }

//     // Hash new password manually (since you don't have a pre-save hook)
//     const salt = await bcrypt.genSalt(10);
//     const hashedPassword = await bcrypt.hash(password, salt);

//     admin.password = hashedPassword;
//     admin.resetPasswordToken = null;
//     admin.resetPasswordExpires = null;

//     await admin.save();

//     return res.json({ message: "Password has been reset successfully" });
//   } catch (err) {
//     console.error("Reset password error:", err);
//     res.status(500).json({ message: "Server error" });
//   }
// };


// /* LOGOUT ADMIN - clears session token and cookie */
// exports.logoutAdmin = async (req, res) => {
//   try {
//     const sessionToken = req.cookies?.session;
//     if (sessionToken) {
//       const admin = await Admin.findOne({ sessionToken });
//       if (admin) {
//         admin.sessionToken = null;
//         admin.jwtToken = null;
//         admin.sessionExpires = null;
//         await admin.save();
//       }
//     }

//     // Clear cookie
//     res.clearCookie("session");
//     return res.json({ message: "Logged out" });
//   } catch (err) {
//     console.error("Logout error:", err);
//     return res.status(500).json({ message: "Server error" });
//   }
// };

const Admin = require("../models/user");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { sendEmail } = require("../config/email");

const SESSION_TTL_DAYS = parseInt(process.env.SESSION_TTL_DAYS || "30", 10);
const SESSION_TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;

/* LOGIN ADMIN */
/* LOGIN ADMIN */
exports.loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // -------- Generate Tokens --------
    const token = jwt.sign({ id: admin._id }, process.env.JWT_SECRET, {
      expiresIn: `${SESSION_TTL_DAYS}d`,
    });

    const sessionToken = crypto.randomBytes(32).toString("hex");
    const sessionExpiry = Date.now() + SESSION_TTL_MS;

    admin.jwtToken = token;
    admin.sessionToken = sessionToken;
    admin.sessionExpires = new Date(sessionExpiry);
    await admin.save();

    // Cookie for refresh-like behavior
    const cookieOpts = {
      httpOnly: true,
      maxAge: SESSION_TTL_MS,
      sameSite: "lax",
    };
    if (process.env.NODE_ENV === "production") cookieOpts.secure = true;

    res.cookie("session", sessionToken, cookieOpts);

    // -------- Final Response (your requested format) --------
    return res.status(200).json({
      success: true,
      user: {
        id: admin._id,
        email: admin.email,
        // name: admin.name || null,
        role: "admin",
        // phone: admin.phone || null,
      },
      tokens: {
        accessToken: token,
        refreshToken: sessionToken,
        idToken: token,
        expiresIn: SESSION_TTL_MS / 1000, // seconds
      },
      platform: "admin-panel",
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};


/* 🔹 FORGOT PASSWORD */
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const admin = await Admin.findOne({ email });

    // Don't reveal whether admin exists (security)
    if (!admin) {
      return res.json({
        message:
          "If an account with that email exists, a password reset link has been sent.",
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    // const resetTokenExpiry = Date.now() + 60 * 60 * 1000; 
    const resetTokenExpiry = Date.now() + 60 * 60 * 1000; // 1 hour

    admin.resetPasswordToken = resetToken;
    admin.resetPasswordExpires = resetTokenExpiry;
    await admin.save();

    const baseUrl =
      process.env.FRONTEND_URL || process.env.BACKEND_URL || "http://localhost:5000";

    // This is where your frontend reset page would be
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;

    console.log("Password reset link:", resetUrl);

    const html = `
      <p>You requested a password reset for your admin account.</p>
      <p>Click the link below to set a new password (valid for 1 hour):</p>
      <a href="${resetUrl}" target="_blank">${resetUrl}</a>
    `;

    await sendEmail({
      to: admin.email,
      subject: "Admin Panel Password Reset",
      html,
    });

    return res.json({
      message:
        "If an account with that email exists, a password reset link has been sent.",
    });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ message: "Server error" });
  }
};


/* 🔹 RESET PASSWORD */
exports.resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        message: "Token and new password are required",
      });
    }

    const admin = await Admin.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }, // token not expired
    });

    if (!admin) {
      return res.status(400).json({
        message: "Invalid or expired reset token",
      });
    }

    // Hash new password manually (since you don't have a pre-save hook)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    admin.password = hashedPassword;
    admin.resetPasswordToken = null;
    admin.resetPasswordExpires = null;

    await admin.save();

    return res.json({ message: "Password has been reset successfully" });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ message: "Server error" });
  }
};


/* LOGOUT ADMIN - clears session token and cookie */
exports.logoutAdmin = async (req, res) => {
  try {
    const sessionToken = req.cookies?.session;
    if (sessionToken) {
      const admin = await Admin.findOne({ sessionToken });
      if (admin) {
        admin.sessionToken = null;
        admin.jwtToken = null;
        admin.sessionExpires = null;
        await admin.save();
      }
    }

    // Clear cookie
    res.clearCookie("session");
    return res.json({ message: "Logged out" });
  } catch (err) {
    console.error("Logout error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};