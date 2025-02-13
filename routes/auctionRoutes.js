const express = require("express");
const router = express.Router();
const {
  createAuction,
  getAllAuctions,
  getAuctionById,
  updateAuctionById,
  deleteAuctionById,
  placeBid,
  getBidsByAuctionId,
  joinAuction,
  authenticateUser, // เพิ่มที่นี่
} = require("../controllers/auctionController");

// สร้างการประมูลใหม่
router.post("/", createAuction);

// ดึงข้อมูลการประมูลทั้งหมด
router.get("/", getAllAuctions);

// ดึงข้อมูลประมูลเฉพาะ ID
router.get("/:id", getAuctionById);

// อัปเดตข้อมูลการประมูล
router.put("/:id", updateAuctionById);

// ลบการประมูล
router.delete("/:id", deleteAuctionById);

// 📌 **วางบิด** (ต้องมีการตรวจสอบตัวตน)
router.post("/:id/bid", authenticateUser, placeBid);

// 📌 **เข้าร่วมประมูล** (ต้องมีการตรวจสอบตัวตน)
router.post("/:id/join", authenticateUser, joinAuction);

module.exports = router;
