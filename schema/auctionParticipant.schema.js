const mongoose = require("mongoose");

const auctionParticipantSchema = new mongoose.Schema({
  auctionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Auction",
    required: true,
  },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  participantName: { type: String, required: true },
  bids: [
    {
      bidAmount: { type: Number, required: true },
      bidTime: { type: Date, default: Date.now },
    },
  ],
});

auctionParticipantSchema.index({ auctionId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model("AuctionParticipant", auctionParticipantSchema);
