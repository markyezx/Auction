const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const User = require("../models/User");
const emailController = require("../controllers/emailController");

// Function สำหรับตรวจสอบรูปแบบรหัสผ่าน
function validatePassword(password) {
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\W).{8,}$/;
  return passwordRegex.test(password);
}

// Register Function
exports.register = async (req, res) => {
  const { username, lastname, email, password } = req.body; // เพิ่ม lastname

  try {
    // ตรวจสอบว่ามีผู้ใช้ที่ลงทะเบียนด้วยอีเมลนี้แล้วหรือไม่
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ msg: "Email already exists" });
    }

    // เข้ารหัสรหัสผ่าน
    const hashedPassword = await bcrypt.hash(password, 10);

    // สร้าง Token สำหรับการยืนยัน
    const verificationToken = crypto.randomBytes(16).toString("hex");

    // บันทึกข้อมูลผู้ใช้
    const newUser = new User({
      username,
      lastname, // เพิ่ม lastname
      email,
      password: hashedPassword,
      verificationToken,
    });
    await newUser.save();

    // ส่งอีเมลยืนยัน
    const emailResponse = await emailController.sendVerificationEmail(
      email,
      username,
      verificationToken
    );

    // ตรวจสอบว่าอีเมลถูกส่งหรือไม่
    if (!emailResponse.success) {
      console.error("Email error:", emailResponse.message); // แสดงข้อผิดพลาดที่เกิดขึ้นจากฟังก์ชันส่งอีเมล
      return res
        .status(500)
        .json({ msg: "Failed to send verification email." });
    }

    res
      .status(201)
      .json({ msg: "User registered successfully. Please verify your email." });
  } catch (err) {
    console.error("Server error:", err); // แสดงข้อผิดพลาดจากเซิร์ฟเวอร์
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
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: "Invalid credentials" });
    }

    // ตรวจสอบสถานะการยืนยันอีเมล
    if (!user.isVerified) {
      return res
        .status(400)
        .json({ msg: "Please verify your email before logging in." });
    }

    // ตรวจสอบรหัสผ่าน
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: "Invalid credentials" });
    }

    // สร้าง JWT Token
    const token = jwt.sign(
      { id: user._id, email: user.email }, // ข้อมูล payload
      process.env.JWT_SECRET, // รหัสลับใน .env
      { expiresIn: "1h" } // อายุการใช้งานของ token
    );

    // บันทึก Token ลงใน MongoDB
    user.tokens.push({ token }); // เพิ่ม token ลงในฟิลด์ tokens
    await user.save(); // บันทึกการเปลี่ยนแปลงลงในฐานข้อมูล

    // ส่ง response พร้อม token
    res.json({
      msg: "Logged in successfully",
      token,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

// Logout
exports.logout = async (req, res) => {
  const { email, token } = req.body; // ต้องส่ง token มาใน body

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: "User not found" });
    }

    // ลบ Token ที่ระบุออกจากอาร์เรย์ tokens
    user.tokens = user.tokens.filter((item) => item.token !== token);
    await user.save();

    res.json({ msg: "Logged out successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};
