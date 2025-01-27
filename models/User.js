const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  phone: String,
  password: String,
  verificationToken: String,
  resetPasswordToken: String,
  resetPasswordExpiry: Date,
  isVerified: { type: Boolean, default: false },
  tokens: [
    {
      token: String,
    },
  ],
});

module.exports = mongoose.model("User", userSchema);
