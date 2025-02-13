const mongoose = require("mongoose");

const auctionSchema = new mongoose.Schema({
  productName: String,
  productDescription: String,
  productSize: String,
  startingBid: Number,
  minimumIncrement: Number,
  currentBid: Number,
  highestBidder: String,
  bids: [
    {
      bidderName: String,
      bidAmount: Number,
      bidTime: Date,
    },
  ],
  productImages: [
    {
      type: String,
      required: true,
    },
  ],
  startTime: Date,
  endsIn: Date,
  auctionType: {
    type: String,
    enum: ["auto_extend", "fixed_time"],
    required: true,
  },
  extendTime: {
    type: Number,
    default: 10, // ค่าเริ่มต้นคือ 10 นาที (เฉพาะ auto_extend)
  },
});

const Auction = mongoose.model("Auction", auctionSchema);

module.exports = Auction;
