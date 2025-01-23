const mongoose = require("mongoose");

const userAuctionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    auctionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Auction",
      required: true,
    },
    bidAmount: { type: Number, required: true },
    paymentStatus: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "pending",
    },
    paymentDetails: {
      stripePaymentId: { type: String },
      amount: { type: Number },
      currency: { type: String },
      status: { type: String },
      createdAt: { type: Date, default: Date.now },
    },
  },
  { timestamps: true }
);

const UserAuction = mongoose.model("UserAuction", userAuctionSchema);

module.exports = UserAuction;
