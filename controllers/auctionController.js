const Auction = require("../schema/auction.schema");
const BidCollect = require("../schema/bidCollect.schema");
const AuctionParticipant = require("../schema/auctionParticipant.schema");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
const User = require("../schema/user.schema");
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
    console.log(req.body); // ตรวจสอบว่า productImages ถูกส่งมาหรือไม่

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

    // ตรวจสอบว่า productImages ถูกส่งมาและเป็น Array ที่มีรูปภาพอย่างน้อยหนึ่งไฟล์
    if (
      !productImages ||
      !Array.isArray(productImages) ||
      productImages.length === 0
    ) {
      return res
        .status(400)
        .json({ error: "At least one product image is required." });
    }

    // ตรวจสอบประเภทของแต่ละรูปภาพใน productImages
    productImages.forEach((image, index) => {
      if (typeof image !== "string" || !image.trim()) {
        return res.status(400).json({
          error: `Invalid image URL at index ${index}, should be a non-empty string`,
        });
      }
    });

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
      productImages, // บันทึก productImages ลง MongoDB
      startTime,
      endsIn,
      auctionType,
      extendTime: auctionType === "auto_extend" ? extendTime : 0,
    });

    await auction.save();
    res.status(201).json(auction);
  } catch (error) {
    console.error(error);
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
    if (!auction) return res.status(404).json({ error: "Auction not found" });

    let participant = await AuctionParticipant.findOne({ auctionId, userId });
    if (!participant) {
      participant = new AuctionParticipant({
        auctionId,
        userId,
        participantName: username,
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

    // ✅ ตรวจสอบและต่อเวลาถ้าจำเป็น
    if (auction.auctionType === "auto_extend") {
      const remainingTime = (auction.endsIn - now) / 1000;
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
    req.user = decoded;
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

    if (!token || token === "null") {
      return res
        .status(401)
        .json({ error: "Access denied. No token provided." });
    }

    let decoded;
    try {
      decoded = jwt.verify(
        token.replace("Bearer ", ""),
        process.env.JWT_SECRET
      );
    } catch (error) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const userId = decoded.userId;
    const participantName = decoded.username;

    if (!userId || !participantName) {
      return res.status(400).json({ error: "Invalid token data" });
    }

    // ✅ ป้องกัน Duplicate Key Error ด้วย `findOneAndUpdate`
    const participant = await AuctionParticipant.findOneAndUpdate(
      { auctionId, userId },
      { auctionId, userId, participantName },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res
      .status(201)
      .json({ message: "Joined auction successfully", participant });
  } catch (error) {
    console.error("Join Auction Error:", error);
    res.status(400).json({ error: error.message });
  }
};

// ฟังก์ชันปิดการประมูล
const closeAuction = async (req, res) => {
  try {
    const auctionId = req.params.id;
    const auction = await Auction.findById(auctionId);

    if (!auction) {
      return res.status(404).json({ error: "Auction not found" });
    }

    // ค้นหาผู้ชนะ (bidder ที่เสนอราคาสูงสุด)
    const highestBid = await BidCollect.findOne({ auctionId })
      .sort({ bidAmount: -1 })
      .limit(1);

    if (!highestBid) {
      auction.status = "closed";
      await auction.save();
      return res.status(200).json({
        message: "No bids were placed. Auction closed without a winner.",
      });
    }

    // ค้นหาข้อมูลของผู้ชนะจาก AuctionParticipant
    const winner = await AuctionParticipant.findOne({
      auctionId: auction._id,
      participantName: highestBid.bidderName,
    });

    if (!winner) {
      return res
        .status(400)
        .json({ error: "Winner not found in participants." });
    }

    // ดึงข้อมูลอีเมลจาก User
    const user = await User.findById(winner.userId);
    if (!user || !user.email) {
      return res
        .status(400)
        .json({ error: "Winner email not found. Cannot send notification." });
    }

    // ประกาศผู้ชนะ
    auction.winner = highestBid.bidderName;
    auction.status = "closed";
    await auction.save();

    // ส่งอีเมลแจ้งผู้ชนะ
    sendWinnerEmail(
      user.email, // ดึงอีเมลจาก User
      highestBid.bidderName,
      highestBid.bidAmount,
      auction
    );

    res.json({
      message: "Auction closed successfully",
      winner: highestBid.bidderName,
    });
  } catch (error) {
    console.error("Close Auction Error:", error);
    res.status(400).json({ error: error.message });
  }
};

const sendWinnerEmail = async (winnerEmail, winnerName, bidAmount, auction) => {
  try {
    console.log("Sending email to:", winnerEmail); // ตรวจสอบอีเมลที่ส่ง

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER, // อีเมลที่ใช้ส่ง
        pass: process.env.EMAIL_PASS, // รหัสผ่านที่เชื่อมโยงกับอีเมล
      },
    });

    // HTML Message ที่ปรับให้สวยงาม
    const htmlMessage = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 10px; padding: 20px; background-color: #fefefe;">
        <div style="text-align: center; background-color:rgb(241, 91, 42); padding: 15px; border-radius: 10px 10px 0 0; color: white;">
          <h2>🎉 ยินดีด้วย! คุณชนะการประมูล ${auction.productName}</h2>
        </div>
        <div style="padding: 20px; color: #333;">
          <p>เรียน <strong>${winnerName}</strong>,</p>
          <p>ขอแสดงความยินดี! คุณได้ชนะการประมูลสำหรับผลิตภัณฑ์ "${auction.productName}" ด้วยราคาประมูลสุดท้ายที่ $${bidAmount}.</p>
          <p>กรุณาติดต่อเราสำหรับรายละเอียดเพิ่มเติมเกี่ยวกับการชำระเงินและการจัดส่ง</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="mailto:support@AuctionUfa99.com" style="background-color:rgb(241, 91, 42); color: white; text-decoration: none; padding: 10px 20px; border-radius: 5px; font-size: 16px;">ติดต่อทีมสนับสนุน</a>
          </div>
          <p>หากคุณไม่ได้เข้าร่วมการประมูลนี้ กรุณาเพิกเฉยต่ออีเมลนี้หรือแจ้งทีมสนับสนุนของเราได้ที่ <a href="mailto:support@AuctionUfa99.com" style="color: #f15b2a;">support@AuctionUfa99.com</a></p>
        </div>
        <div style="text-align: center; background-color: #f9f9f9; padding: 10px; border-radius: 0 0 10px 10px; color: #999;">
          <p>ขอบคุณที่เลือกใช้บริการของเรา</p>
        </div>
      </div>
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: winnerEmail,
      subject: `🎉 Congratulations! You won the auction for ${auction.productName}`,
      html: htmlMessage, // ใช้ HTML แทนการส่งข้อความแบบ text
    };

    // ส่งอีเมล
    await transporter.sendMail(mailOptions);
    console.log(`Winner email sent to ${winnerEmail}`);
  } catch (error) {
    console.error("Send Email Error:", error);
    // ส่งข้อผิดพลาดที่เกิดขึ้นให้ผู้ดูแลระบบ
    throw new Error("Failed to send winner email.");
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
  closeAuction,
};
