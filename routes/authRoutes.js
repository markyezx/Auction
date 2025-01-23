const express = require("express");
const authController = require("../controllers/authController"); // ตรวจสอบเส้นทางนี้ให้ถูกต้อง
const router = express.Router();

// กำหนดเส้นทาง POST สำหรับการรีเซ็ตรหัสผ่าน
router.post("/request-password-reset", authController.sendPasswordResetEmail);
router.post("/reset-password", authController.forgotPassword);
router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/logout", authController.logout);

module.exports = router;
