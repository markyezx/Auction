const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const authRoutes = require("./routes/authRoutes");
const auctionRoutes = require("./routes/auctionRoutes");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");

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
app.use("/", authRoutes);
app.use("/api/auctions", auctionRoutes); // เส้นทาง API

// เริ่มต้นเซิร์ฟเวอร์
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);

  // Static files middleware
  app.use(express.static(path.join(__dirname, "views")));
});
