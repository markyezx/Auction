const mongoose = require("mongoose");

const auctionSchema = new mongoose.Schema({
  productName: { type: String, required: true },
  productDescription: { type: String, required: true },
  productSize: { type: String, required: true },
  startingBid: { type: Number, required: true },
  minimumIncrement: { type: Number, required: true },
  currentBid: { type: Number, required: true, default: 0 },
  highestBidder: { type: String, default: null },
  bids: [
    {
      bidderName: { type: String, required: true },
      bidAmount: { type: Number, required: true },
      bidTime: { type: Date, default: Date.now },
    },
  ],
  startTime: { type: Date, required: true },
  endsIn: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const Auction = mongoose.model("Auction", auctionSchema);

module.exports = Auction;
