const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const authRoutes = require("./routes/authRoutes");
const auctionRoutes = require("./routes/auctionRoutes");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
const cookieParser = require("cookie-parser");

// โหลดตัวแปรจากไฟล์ .env
dotenv.config();

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000", // อนุญาตให้เฉพาะ CLIENT_URL ที่กำหนด
    credentials: true, // อนุญาตให้ส่ง cookies และ authentication headers
    methods: ["GET", "POST", "PUT", "DELETE"], // อนุญาต HTTP methods ที่ใช้
    allowedHeaders: ["Content-Type", "Authorization"], // อนุญาตเฉพาะ Headers ที่จำเป็น
  })
);

// Middleware
app.use(bodyParser.json());
app.use(express.json());
app.use(cookieParser()); // ✅ รองรับการใช้ Cookies

// เชื่อมต่อ MongoDB
mongoose
  .connect(process.env.DB_URI)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) =>
    console.error("❌ Error connecting to MongoDB:", err.message)
  );

// Routes
app.use("/api/auth", authRoutes);
app.use("/auth", authRoutes);
app.use("/", authRoutes);
app.use("/api/auctions", auctionRoutes); // เส้นทาง API
app.use("/uploads", express.static("public/uploads")); // ✅ เปิดให้เข้าถึงโฟลเดอร์รูป

// ✅ Static files middleware (สำหรับ Frontend)
app.use(express.static(path.join(__dirname, "views")));

// เริ่มต้นเซิร์ฟเวอร์
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
