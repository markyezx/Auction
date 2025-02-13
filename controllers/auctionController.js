const Auction = require("../schema/auction.schema");
const BidCollect = require("../schema/bidCollect.schema");
const AuctionParticipant = require("../schema/auctionParticipant.schema");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
// ฟังก์ชันคำนวณเวลาสิ้นสุดใหม่
const extendAuctionTime = (auction) => {
  const now = new Date();
  const remainingTime = (auction.endsIn - now) / 1000; // วินาที
  if (remainingTime <= 600 && auction.endsIn > now) {
    // ตรวจสอบว่าประมูลยังไม่หมดเวลา
    auction.endsIn = new Date(now.getTime() + 10 * 60 * 1000); // ต่อเวลา 10 นาที
  }
};

// สร้างการประมูลใหม่
const createAuction = async (req, res) => {
  try {
    const {
      productName,
      productDescription,
      productSize,
      startingBid,
      minimumIncrement,
      durationMinutes,
      auctionType,
      extendTime,
      productImages,
    } = req.body;

    if (
      !productImages ||
      !Array.isArray(productImages) ||
      productImages.length === 0
    ) {
      return res
        .status(400)
        .json({ error: "At least one product image is required." });
    }

    const startTime = new Date();
    const endsIn = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

    const auction = new Auction({
      productName,
      productDescription,
      productSize,
      startingBid,
      minimumIncrement,
      currentBid: startingBid,
      highestBidder: null,
      bids: [],
      productImages,
      startTime,
      endsIn,
      auctionType,
      extendTime: auctionType === "auto_extend" ? extendTime : 0,
    });

    await auction.save();
    res.status(201).json(auction);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ดึงข้อมูลการประมูลทั้งหมด
const getAllAuctions = async (req, res) => {
  try {
    const auctions = await Auction.find();
    res.json(auctions);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ดึงข้อมูลประมูลเฉพาะ ID
const getAuctionById = async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id);
    if (!auction) return res.status(404).json({ error: "Auction not found" });
    res.json(auction);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// อัปเดตข้อมูลการประมูล
const updateAuctionById = async (req, res) => {
  try {
    const auction = await Auction.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!auction) return res.status(404).json({ error: "Auction not found" });
    res.json(auction);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ลบการประมูล
const deleteAuctionById = async (req, res) => {
  try {
    const auction = await Auction.findByIdAndDelete(req.params.id);
    if (!auction) return res.status(404).json({ error: "Auction not found" });
    res.json({ message: "Auction deleted successfully" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// 📌 **ฟังก์ชันวางบิด**
const placeBid = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const auctionId = req.params.id;
    const { bidAmount } = req.body;
    const userId = req.user.userId;
    const username = req.user.username;

    const auction = await Auction.findById(auctionId);
    if (!auction) {
      return res.status(404).json({ error: "Auction not found" });
    }

    let participant = await AuctionParticipant.findOne({ auctionId, userId });
    if (!participant) {
      participant = new AuctionParticipant({
        auctionId,
        userId,
        participantName: username,
        bids: [],
      });
      await participant.save();
    }

    const now = new Date();
    if (now > auction.endsIn) {
      return res.status(400).json({ error: "Auction has ended" });
    }
    if (
      bidAmount <= auction.currentBid ||
      bidAmount < auction.currentBid + auction.minimumIncrement
    ) {
      return res.status(400).json({
        error: "Bid must be higher than current bid + minimum increment",
      });
    }

    auction.currentBid = bidAmount;
    auction.highestBidder = participant.participantName;
    auction.bids.push({
      bidderName: participant.participantName,
      bidAmount,
      bidTime: now,
    });

    const bidCollect = new BidCollect({
      auctionId,
      userId,
      bidAmount,
      bidTime: now,
      bidderName: participant.participantName,
    });
    await bidCollect.save();

    // **เช็คเงื่อนไขการต่อเวลา**
    if (auction.auctionType === "auto_extend") {
      const remainingTime = (auction.endsIn - now) / 1000; // คำนวณเวลาเหลือ
      if (remainingTime <= auction.extendTime * 60) {
        auction.endsIn = new Date(
          now.getTime() + auction.extendTime * 60 * 1000
        );
      }
    }

    await auction.save();
    participant.bids.push({ bidAmount, bidTime: now });
    await participant.save();

    res.json({ auction, participant });
  } catch (error) {
    console.error("Place Bid Error:", error);
    res.status(400).json({ error: error.message });
  }
};

// ดึงข้อมูลการบิดทั้งหมดในแต่ละประมูล
const getBidsByAuctionId = async (req, res) => {
  try {
    const auctionId = req.params.id; // รับ auctionId จาก URL

    const bids = await BidCollect.aggregate([
      { $match: { auctionId: mongoose.Types.ObjectId(auctionId) } },
      {
        $lookup: {
          from: "auctions",
          localField: "auctionId",
          foreignField: "_id",
          as: "auctionDetails",
        },
      },
      { $unwind: "$auctionDetails" },
      {
        $project: {
          _id: 1,
          bidderName: 1,
          bidAmount: 1,
          bidTime: 1,
          auctionDetails: {
            productName: 1,
            productDescription: 1,
            startingBid: 1,
          },
        },
      },
    ]);

    if (!bids || bids.length === 0) {
      return res.status(404).json({ error: "No bids found for this auction" });
    }

    res.json(bids);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Middleware ดึงข้อมูล user จาก token
const authenticateUser = (req, res, next) => {
  const authHeader = req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Access denied. No token provided." });
  }

  const token = authHeader.replace("Bearer ", "");
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // เก็บข้อมูล userId และ username ไว้ใน req
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
};

// 📌 **ฟังก์ชันเข้าร่วมประมูล**
const joinAuction = async (req, res) => {
  try {
    const auctionId = req.params.id;
    const token = req.header("Authorization");

    // ตรวจสอบว่า token มีค่าไหม
    if (!token || token === "null") {
      return res
        .status(401)
        .json({ error: "Access denied. No token provided or invalid token." });
    }

    // ถอดรหัส token
    let decoded;
    try {
      decoded = jwt.verify(
        token.replace("Bearer ", ""),
        process.env.JWT_SECRET
      );
    } catch (error) {
      return res.status(401).json({ error: "Invalid token" });
    }

    // ตรวจสอบว่า userId และ username มีใน decoded หรือไม่
    const userId = decoded.userId;
    const participantName = decoded.username;

    if (!userId || !participantName) {
      return res
        .status(400)
        .json({ error: "Invalid token. Missing user data." });
    }

    // ตรวจสอบการประมูล
    const auction = await Auction.findById(auctionId);
    if (!auction) {
      return res.status(404).json({ error: "Auction not found" });
    }

    // เช็คการเข้าร่วมประมูล
    const existingParticipant = await AuctionParticipant.findOne({
      auctionId,
      userId,
    });
    if (existingParticipant) {
      return res
        .status(400)
        .json({ error: "You have already joined this auction" });
    }

    // ตรวจสอบว่า `token` ไม่เป็น null และไม่ซ้ำกัน
    const existingTokenParticipant = await AuctionParticipant.findOne({
      token: token,
    });

    if (existingTokenParticipant) {
      return res
        .status(400)
        .json({ error: "Token already exists in another participant record" });
    }

    // บันทึกผู้เข้าร่วม
    const participant = new AuctionParticipant({
      auctionId,
      userId,
      participantName,
      token, // เก็บ token ลงไปด้วย
      bids: [],
    });

    await participant.save();
    res
      .status(201)
      .json({ message: "Joined auction successfully", participant });
  } catch (error) {
    console.error("Join Auction Error:", error);
    res.status(400).json({ error: error.message });
  }
};

module.exports = {
  createAuction,
  getAllAuctions,
  getAuctionById,
  updateAuctionById,
  deleteAuctionById,
  placeBid,
  getBidsByAuctionId,
  joinAuction,
  authenticateUser,
};
