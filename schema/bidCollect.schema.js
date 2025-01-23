const mongoose = require("mongoose");

const bidCollectSchema = new mongoose.Schema({
  auctionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Auction",
    required: true,
  },
  bidderName: { type: String, required: true },
  bidAmount: { type: Number, required: true },
  bidTime: { type: Date, default: Date.now },
});

const BidCollect = mongoose.model("BidCollect", bidCollectSchema);

module.exports = BidCollect;
