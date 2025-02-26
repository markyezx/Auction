const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const User = require("../models/User");
const emailController = require("../controllers/emailController");
const nodemailer = require("nodemailer");

// Function สำหรับตรวจสอบรูปแบบรหัสผ่าน
function validatePassword(password) {
  const passwordRegex = /^.{4,}$/; // ตรวจสอบรหัสผ่านที่มีอย่างน้อย 4 ตัวอักษร
  return passwordRegex.test(password);
}

// Register Function
exports.register = async (req, res) => {
  const { name, email, password, phone } = req.body;

  try {
    const userExists = await User.findOne({ email });
    if (userExists)
      return res.status(400).json({ msg: "Email already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(16).toString("hex");

    const newUser = new User({
      name,
      email,
      phone,
      password: hashedPassword,
      verificationToken,
    });
    await newUser.save();

    const emailResponse = await emailController.sendVerificationEmail(
      email,
      name,
      verificationToken
    );
    if (!emailResponse.success) {
      console.error("Email error:", emailResponse.message);
      return res
        .status(500)
        .json({ msg: "Failed to send verification email." });
    }

    res
      .status(201)
      .json({ msg: "User registered successfully. Please verify your email." });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

// ฟังก์ชันสำหรับยืนยันอีเมล
exports.sendVerificationEmail = async (req, res) => {
  const { token } = req.query;

  try {
    console.log("Token received:", token);

    // ค้นหาผู้ใช้
    const user = await User.findOne({ verificationToken: token });
    if (!user) {
      return res
        .status(400)
        .json({ msg: "Invalid or expired verification token." });
    }
    console.log("User found:", user);

    // เปลี่ยนสถานะ
    user.isVerified = true;
    user.verificationToken = null;

    await user.save();
    console.log("User updated:", user);

    res.status(200).json({ msg: "Email verified successfully." });
  } catch (err) {
    console.error("Error verifying email:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

// Generate Access & Refresh Tokens
function generateTokens(user) {
  const accessToken = jwt.sign(
    { id: user._id, email: user.email, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: "15m" }
  );
  const refreshToken = jwt.sign(
    { id: user._id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: "7d" }
  );
  return { accessToken, refreshToken };
}

// Login Function
exports.login = async (req, res) => {
  const { email, password } = req.body;
  try {
    if (!email || !password)
      return res.status(400).json({ msg: "Email and password are required" });

    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ msg: "Invalid email or password" });
    }

    if (!user.isVerified) {
      const verificationToken = crypto.randomBytes(16).toString("hex");
      user.verificationToken = verificationToken;
      await user.save();
      await emailController.sendVerificationEmail(
        user.email,
        user.name,
        verificationToken
      );
      return res.status(400).json({
        msg: "Your email is not verified yet. Verification email resent.",
      });
    }

    const { accessToken, refreshToken } = generateTokens(user);
    user.refreshToken = refreshToken;
    user.accessToken = accessToken;
    await user.save();

    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      maxAge: 15 * 60 * 1000, // 15 minutes for access token
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days for refresh token
    });

    res.status(200).json({
      msg: "Login successful",
      accessToken,
      refreshToken,
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

// Logout Function
exports.logout = async (req, res) => {
  const refreshToken = req.cookies ? req.cookies.refreshToken : null;

  if (!refreshToken) {
    return res.status(401).json({ msg: "No refresh token provided" });
  }

  try {
    await User.updateOne(
      { refreshToken },
      { $unset: { refreshToken: 1, accessToken: 1 } }
    );
    res.clearCookie("refreshToken");
    res.clearCookie("accessToken");
    res.status(200).json({ msg: "Logout successful" });
  } catch (err) {
    console.error("Logout error:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

// Refresh Token
exports.refreshToken = async (req, res) => {
  const { refreshToken } = req.cookies;
  if (!refreshToken)
    return res.status(401).json({ msg: "No refresh token provided" });

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findOne({ _id: decoded.id, refreshToken });
    if (!user) return res.status(403).json({ msg: "Invalid refresh token" });

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user);
    user.refreshToken = newRefreshToken;
    user.accessToken = accessToken;
    await user.save();

    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.status(200).json({ accessToken });
  } catch (err) {
    console.error("Refresh token error:", err);
    res.status(403).json({ msg: "Invalid or expired refresh token" });
  }
};

// ฟังก์ชัน resetPassword สำหรับรีเซ็ตรหัสผ่านใหม่
exports.resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;

  try {
    if (!token || !newPassword) {
      return res
        .status(400)
        .json({ msg: "Token and new password are required" });
    }

    // ค้นหาผู้ใช้โดยใช้ token และตรวจสอบ expiry
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpiry: { $gt: Date.now() }, // ตรวจสอบว่า token ยังไม่หมดอายุ
    });

    if (!user) {
      return res.status(400).json({ msg: "Invalid or expired token" });
    }

    // ตรวจสอบรูปแบบของรหัสผ่านใหม่
    if (!validatePassword(newPassword)) {
      return res.status(400).json({
        msg: "Password must be at least 4 characters long.",
      });
    }

    // เข้ารหัสรหัสผ่านใหม่
    const hashedPassword = await bcrypt.hash(newPassword, 4);
    user.password = hashedPassword;

    // ล้าง token และ expiry
    user.resetPasswordToken = null;
    user.resetPasswordExpiry = null;

    await user.save();

    res.status(200).json({ msg: "Password reset successfully" });
  } catch (err) {
    console.error("Error in resetPassword:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

// ปรับปรุง forgotPassword สำหรับการสร้างลิงก์ยืนยันการลืมรหัสผ่าน
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    if (!email) {
      return res.status(400).json({ msg: "Email is required" });
    }

    // ค้นหาผู้ใช้ในฐานข้อมูลจากอีเมล
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    // สร้าง token และบันทึก token พร้อม expiry
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = Date.now() + 3600000; // 1 ชั่วโมง

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpiry = resetTokenExpiry;

    await user.save();

    // สร้างลิงก์ยืนยันการลืมรหัสผ่าน
    const resetLink = `${process.env.CLIENT_URL}/confirm-reset-password?token=${resetToken}`;

    console.log("Sending reset link:", resetLink);

    // ส่งอีเมล
    const emailSent = await emailController.sendPasswordResetEmail(
      user.email,
      resetLink
    );
    if (!emailSent.success) {
      return res
        .status(500)
        .json({ msg: "Failed to send password reset email" });
    }

    res.status(200).json({ msg: "Password reset email sent successfully" });
  } catch (err) {
    console.error("Error in forgotPassword:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

// ฟังก์ชัน confirmResetPassword สำหรับยืนยันลิงก์ที่ส่งไป
const path = require("path");

exports.confirmResetPassword = async (req, res) => {
  const { token } = req.query;

  try {
    if (!token) {
      return res.status(400).send("<h1>Token is required</h1>");
    }

    // ค้นหาผู้ใช้โดยใช้ token และตรวจสอบ expiry
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpiry: { $gt: Date.now() }, // ตรวจสอบว่า token ยังไม่หมดอายุ
    });

    if (!user) {
      return res.status(400).send("<h1>Invalid or expired token</h1>");
    }

    // เส้นทางไฟล์ reset-password.html
    const resetPasswordPath = path.resolve(
      __dirname,
      "../views/reset-password.html"
    );

    res.sendFile(resetPasswordPath);
  } catch (err) {
    console.error("Error in confirmResetPassword:", err);
    res.status(500).send("<h1>Server error</h1>");
  }
};
