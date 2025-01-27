const express = require("express");
const authController = require("../controllers/authController"); // ตรวจสอบเส้นทางนี้ให้ถูกต้อง
const router = express.Router();

// กำหนดเส้นทาง POST สำหรับการรีเซ็ตรหัสผ่าน
router.get("/confirm-reset-password", authController.confirmResetPassword);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);
router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/logout", authController.logout);

// เส้นทางสำหรับยืนยันอีเมล
router.get("/verify", authController.sendVerificationEmail);

module.exports = router;
