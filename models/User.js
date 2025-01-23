const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  tokens: [{ token: String }],
  verificationToken: { type: String },
  isVerified: { type: Boolean, default: false },
  resetPasswordToken: { type: String }, // ฟิลด์สำหรับ token การรีเซ็ตรหัสผ่าน
  resetPasswordExpiry: { type: Date }, // ฟิลด์หมดอายุของ token
});

module.exports = mongoose.model("User", userSchema);
