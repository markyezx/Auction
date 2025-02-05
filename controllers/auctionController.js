const Auction = require("../schema/auction.schema");
const BidCollect = require("../schema/bidCollect.schema");

// ฟังก์ชันคำนวณเวลาสิ้นสุดใหม่
const extendAuctionTime = (auction) => {
  const now = new Date();
  const remainingTime = (auction.endsIn - now) / 1000; // วินาที
  if (remainingTime <= 600) {
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
    } = req.body;

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
      startTime,
      endsIn,
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

// ลงบิด (Bid)
const placeBid = async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id);
    if (!auction) return res.status(404).json({ error: "Auction not found" });

    const { bidderName, bidAmount } = req.body;
    const now = new Date();

    if (now > auction.endsIn) {
      // ✅ เปลี่ยนจาก auction.endTime -> auction.endsIn
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

    // ✅ บันทึกการลงบิดใน Auction
    auction.currentBid = bidAmount;
    auction.highestBidder = bidderName;
    auction.bids.push({ bidderName, bidAmount, bidTime: now });

    extendAuctionTime(auction);
    await auction.save();

    // ✅ บันทึกลง BidCollect
    const newBid = new BidCollect({
      auctionId: auction._id,
      bidderName,
      bidAmount,
      bidTime: now,
    });
    await newBid.save();

    res.json({ auction, newBid }); // ✅ ส่งข้อมูลการบิดกลับไป
  } catch (error) {
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

module.exports = {
  createAuction,
  getAllAuctions,
  getAuctionById,
  updateAuctionById,
  deleteAuctionById,
  placeBid,
  getBidsByAuctionId,
};
