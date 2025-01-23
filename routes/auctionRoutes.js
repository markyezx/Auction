const express = require("express");
const router = express.Router();
const {
  createAuction,
  getAllAuctions,
  getAuctionById,
  updateAuctionById,
  deleteAuctionById,
  placeBid,
} = require("../../controllers/auctionController");

// Create a new auction
router.post("/", createAuction);

// Read all auctions
router.get("/", getAllAuctions);

// Read an auction by ID
router.get("/:id", getAuctionById);

// Update an auction by ID
router.put("/:id", updateAuctionById);

// Delete an auction by ID
router.delete("/:id", deleteAuctionById);

// Place a bid on an auction
router.post("/:id/bid", placeBid);

module.exports = router;
