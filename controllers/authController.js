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
  const { name, email, password, phone } = req.body; // ใช้ name แทน username และ lastname, เพิ่ม phone

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
    // ค้นหาผู้ใช้จากอีเมล
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: "Invalid credentials" });
    }

    // ตรวจสอบรหัสผ่าน
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: "Invalid credentials" });
    }

    // ตรวจสอบว่าผู้ใช้ได้ยืนยันอีเมลหรือยัง
    if (!user.isVerified) {
      // ส่งอีเมลยืนยันอีกครั้ง
      const emailResponse = await emailController.sendVerificationEmail(
        user.email,
        user.name, // ใช้ name
        user.verificationToken
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

    // สร้าง JWT Token
    const token = jwt.sign(
      { id: user._id, email: user.email }, // Payload
      process.env.JWT_SECRET, // รหัสลับใน .env
      { expiresIn: "1h" } // อายุการใช้งาน Token
    );

    // บันทึก Token ลงใน MongoDB
    user.tokens.push({ token }); // เพิ่ม Token ลงในฟิลด์ tokens
    await user.save(); // บันทึกการเปลี่ยนแปลงลงในฐานข้อมูล

    // ส่ง Response พร้อม Token
    res.json({
      msg: "Login successfully",
      token,
    });
  } catch (err) {
    console.error(err);
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

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ msg: "User not found" });
    }

    const isTokenValid = user.tokens.some((item) => item.token === token);
    if (!isTokenValid) {
      return res.status(401).json({ msg: "Invalid token" });
    }

    user.tokens = user.tokens.filter((item) => item.token !== token);
    await user.save();

    res.json({ msg: "Logout successfully" });
  } catch (err) {
    console.error("Logout error:", err);

    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({ msg: "Invalid token" });
    }

    res.status(500).json({ msg: "Server error" });
  }
};
