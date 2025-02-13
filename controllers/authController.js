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
  const { name, email, password, phone } = req.body; // ใช้ name แทน username และ lastname, เพิ่ม phone

  try {
    // ตรวจสอบว่ามีผู้ใช้ที่ลงทะเบียนด้วยอีเมลนี้แล้วหรือไม่
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ msg: "Email already exists" });
    }

    // เข้ารหัสรหัสผ่าน
    const hashedPassword = await bcrypt.hash(password, 10); // ค่า 10 คือ salt rounds

    // สร้าง Token สำหรับการยืนยัน
    const verificationToken = crypto.randomBytes(16).toString("hex");

    // บันทึกข้อมูลผู้ใช้
    const newUser = new User({
      name, // เก็บชื่อ
      email,
      phone, // เก็บเบอร์โทรศัพท์
      password: hashedPassword,
      verificationToken,
    });
    await newUser.save();

    // ส่งอีเมลยืนยัน
    const emailResponse = await emailController.sendVerificationEmail(
      email,
      name, // ส่ง name ไปในอีเมล
      verificationToken
    );

    // ตรวจสอบว่าอีเมลถูกส่งหรือไม่
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

// Login Function
exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    // ตรวจสอบว่ามี email และ password ใน request body หรือไม่
    if (!email || !password) {
      return res.status(400).json({ msg: "Email and password are required" });
    }

    // ค้นหาผู้ใช้จากอีเมล
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: "Invalid email or password" });
    }

    // ตรวจสอบรหัสผ่าน
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: "Invalid email or password" });
    }

    // ตรวจสอบสถานะการยืนยันอีเมล
    if (!user.isVerified) {
      // สร้าง Verification Token ใหม่
      const verificationToken = crypto.randomBytes(16).toString("hex");
      user.verificationToken = verificationToken;

      // บันทึก Token ใหม่ในฐานข้อมูล
      await user.save();

      // ส่งอีเมลยืนยัน
      const emailResponse = await emailController.sendVerificationEmail(
        user.email,
        user.name, // ชื่อผู้ใช้
        verificationToken
      );

      if (!emailResponse.success) {
        console.error(
          "Failed to resend verification email:",
          emailResponse.message
        );
        return res.status(500).json({
          msg: "Your email is not verified yet. Failed to resend verification email. Please contact support.",
        });
      }

      return res.status(400).json({
        msg: "Your email is not verified yet. A verification email has been resent to your email address.",
      });
    }

    // สร้าง JWT Token ใหม่
    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        userId: user._id,
        username: user.name,
      }, // Payload
      process.env.JWT_SECRET, // รหัสลับใน .env
      { expiresIn: "1h" } // อายุการใช้งาน Token
    );

    // บันทึก Token ลงในฟิลด์ tokens ของผู้ใช้
    user.tokens.push({ token });

    // เก็บ Token ใหม่สุดในฐานข้อมูล
    await user.save();

    // ตั้งค่า Cookie สำหรับ Token
    res.cookie("token", token, {
      httpOnly: true, // ป้องกันการเข้าถึงผ่าน JavaScript
      secure: process.env.NODE_ENV === "production", // ใช้ HTTPS ใน production
      sameSite: "strict", // ป้องกัน Cross-Site Request Forgery (CSRF)
      maxAge: 3600000, // อายุคุกกี้ 1 ชั่วโมง (หน่วยเป็นมิลลิวินาที)
    });

    // ส่ง Response พร้อมข้อความสำเร็จ
    res.status(200).json({
      msg: "Login successfully",
      token, // ส่ง Token กลับใน Response ด้วย (ถ้าต้องการใช้ใน Client)
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ msg: "Server error" });
  }
};

// Logout Function
exports.logout = async (req, res) => {
  const { email } = req.body;
  const token = req.headers.authorization?.split(" ")[1];

  try {
    if (!email || !token) {
      return res
        .status(400)
        .json({ msg: "Email and authorization token are required" });
    }

    // ตรวจสอบและถอดรหัส Token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({ msg: "Token has expired" });
      }
      return res.status(401).json({ msg: "Invalid token" });
    }

    // ค้นหาผู้ใช้
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: "User not found" });
    }

    // ตรวจสอบว่า Token ตรงกับในฐานข้อมูลหรือไม่
    const isTokenValid = user.tokens.some((item) => item.token === token);
    if (!isTokenValid) {
      return res.status(401).json({ msg: "Token is not valid for this user" });
    }

    // ลบ Token
    user.tokens = user.tokens.filter((item) => item.token !== token);
    await user.save();

    res.json({ msg: "Logout successfully" });
  } catch (err) {
    console.error("Logout error:", err);
    res.status(500).json({ msg: "Server error" });
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
