const express = require("express");
const authController = require("../controllers/authController");
const router = express.Router();
const verifyRefreshToken = require("../middleware/auth");

// Route สำหรับการลงทะเบียน
router.post("/register", authController.register);

// กำหนด Route สำหรับ verifyEmail
router.get("/verify", authController.sendVerificationEmail);

// Route สำหรับ Login
router.post("/login", authController.login);

// POST /logout
router.post("/logout", authController.logout);

module.exports = router;
