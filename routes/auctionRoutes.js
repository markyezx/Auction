const express = require("express");
const router = express.Router();
const auctionController = require("../controllers/auctionController");

// สร้างประมูล
router.post("/", auctionController.createAuction);

// ดึงข้อมูลประมูลทั้งหมด
router.get("/", auctionController.getAllAuctions);

// ดึงประมูลตาม ID
router.get("/:id", auctionController.getAuctionById);

// อัปเดตประมูล
router.put("/:id", auctionController.updateAuctionById);

// ลบประมูล
router.delete("/:id", auctionController.deleteAuctionById);

// ลงบิด
router.post("/:id/bid", auctionController.placeBid);

// ดึงประมูลที่ผ่านการประมูล
router.get("/:id/bids", auctionController.getBidsByAuctionId);

module.exports = router;
