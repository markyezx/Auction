const mongoose = require("mongoose"); // เพิ่มการ require mongoose

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true }, // ชื่อ
    email: { type: String, required: true, unique: true }, // อีเมล
    phone: { type: String, required: true }, // เบอร์โทรศัพท์
    password: { type: String, required: true }, // รหัสผ่าน
    isVerified: { type: Boolean, default: false }, // สถานะการยืนยันอีเมล
    verificationToken: { type: String }, // โทเค็นยืนยันอีเมล
    tokens: [{ token: { type: String } }], // JWT Token
  },
  { timestamps: true }
); // เปิดใช้ timestamps (createdAt และ updatedAt)

module.exports = mongoose.model("User", userSchema);
