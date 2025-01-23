const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const authRoutes = require("./routes/authRoutes");
const bodyParser = require("body-parser");
const cors = require("cors");

// โหลดตัวแปรจากไฟล์ .env
dotenv.config();

const app = express();

// Middleware
app.use(bodyParser.json());
app.use(cors());
app.use(express.json());

// เชื่อมต่อ MongoDB
mongoose
  .connect(process.env.DB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("Error connecting to MongoDB:", err.message));

// Routes
app.use("/api/auth", authRoutes);
app.use("/auth", authRoutes);

// เริ่มต้นเซิร์ฟเวอร์
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
