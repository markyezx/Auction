const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true },
  // ข้อมูลผู้ใช้เพิ่มเติมที่ต้องการ
});

// ถ้าโมเดล `User` ถูกประกาศแล้ว จะไม่ทำการประกาศใหม่
module.exports = mongoose.models.User || mongoose.model("User", userSchema);
