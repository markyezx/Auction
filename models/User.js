const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  phone: String,
  password: String,
  isVerified: { type: Boolean, default: false },
  verificationToken: String,
  resetPasswordToken: String,
  resetPasswordExpiry: Date,
  refreshToken: String,
  accessToken: String,
});

const User = mongoose.model("User", userSchema);

module.exports = User;
