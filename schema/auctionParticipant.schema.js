const mongoose = require("mongoose");

const auctionParticipantSchema = new mongoose.Schema({
  auctionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Auction",
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },
  participantName: { type: String, required: true },
  bids: [
    {
      bidAmount: Number,
      bidTime: Date,
    },
  ],
});

module.exports = mongoose.model("AuctionParticipant", auctionParticipantSchema);
