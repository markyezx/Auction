const mongoose = require("mongoose");

const auctionSchema = new mongoose.Schema({
  productName: { type: String, required: true },
  productDescription: { type: String, required: true },
  productSize: { type: String, required: true },
  startingBid: { type: Number, required: true },
  minimumIncrement: { type: Number, required: true },
  currentBid: { type: Number, required: true },
  highestBidder: { type: String, default: null },
  bids: [{ bidderName: String, bidAmount: Number, bidTime: Date }],
  productImages: { type: [String], required: true }, // productImages ต้องเป็น Array ของ String
  startTime: { type: Date, required: true },
  endsIn: { type: Date, required: true },
  auctionType: { type: String, required: true },
  extendTime: { type: Number, default: 0 },
});

const Auction = mongoose.model("Auction", auctionSchema);
module.exports = Auction;
