const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const User = require("../models/User");
const emailController = require("../controllers/emailController");
const nodemailer = require("nodemailer");

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
      // สร้าง Verification Token ใหม่
      const verificationToken = crypto.randomBytes(16).toString("hex");
      user.verificationToken = verificationToken;

      // บันทึก Token ใหม่ลงในฐานข้อมูล
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
      { id: user._id, email: user.email }, // Payload
      process.env.JWT_SECRET, // รหัสลับใน .env
      { expiresIn: "1h" } // อายุการใช้งาน Token
    );

    // ลบ Token เก่าทั้งหมดและเก็บเฉพาะ Token ล่าสุดในฟิลด์ tokens
    user.tokens = [{ token }];
    await user.save();

    // ตั้งค่า Cookie สำหรับ Token
    res.cookie("token", token, {
      httpOnly: true, // ป้องกันการเข้าถึงผ่าน JavaScript
      secure: process.env.NODE_ENV === "production", // ใช้ HTTPS ใน production
      sameSite: "strict", // ป้องกัน Cross-Site Request Forgery (CSRF)
      maxAge: 3600000, // อายุคุกกี้ 1 ชั่วโมง (หน่วยเป็นมิลลิวินาที)
    });

    // ส่ง Response พร้อมข้อความสำเร็จ
    res.json({
      msg: "Login successfully",
      token, // ส่ง Token กลับใน Response ด้วย (ถ้าต้องการใช้ใน Client)
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

// ฟังก์ชันสำหรับส่งอีเมลรีเซ็ตรหัสผ่าน
exports.sendPasswordResetEmail = async (email, resetLink) => {
  try {
    if (!email) {
      throw new Error("Email is required");
    }
    if (!resetLink) {
      throw new Error("Reset link is required");
    }

    console.log("Sending password reset email to:", email);
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST, // ใช้ SMTP host ที่กำหนดใน .env
      port: process.env.SMTP_PORT, // ใช้ SMTP port ที่กำหนดใน .env
      secure: process.env.SMTP_SECURE === "true", // true ถ้าใช้ SSL
      auth: {
        user: process.env.SMTP_USER, // SMTP username
        pass: process.env.SMTP_PASS, // SMTP password
      },
    });

    const mailOptions = {
      from: process.env.SMTP_FROM, // อีเมลที่ใช้ส่ง
      to: email, // ผู้รับอีเมล
      subject: "Password Reset Request",
      html: `<p>Click the link to reset your password: <a href="${resetLink}">Reset Password</a></p>`,
    };

    // ส่งอีเมล
    await transporter.sendMail(mailOptions);
    console.log("Password reset email sent successfully.");
    return { success: true };
  } catch (error) {
    console.error("Failed to send password reset email:", error);
    return { success: false, message: error.message };
  }
};

// ฟังก์ชัน forgotPassword สำหรับส่งลิงค์รีเซ็ตรหัสผ่าน
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

    // สร้างและบันทึก token สำหรับการรีเซ็ตรหัสผ่าน
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = Date.now() + 3600000; // 1 ชั่วโมง

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpiry = resetTokenExpiry;

    await user.save();

    // สร้างลิงค์รีเซ็ตรหัสผ่าน
    const resetLink = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;

    console.log("Sending reset link:", resetLink); // ล็อกค่าลิงค์

    // ส่งอีเมล
    const emailSent = await emailController.sendPasswordResetEmail(
      user.email, // ตรวจสอบว่า user.email มีค่าหรือไม่
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
