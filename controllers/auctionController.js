const Auction = require("../schemas/v1/auction.schema");
const BidCollect = require("../schemas/v1/bidCollect.schema");

// Create a new auction
const createAuction = async (req, res) => {
  try {
    const auction = new Auction(req.body);
    await auction.save();
    res.status(201).json(auction);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Read all auctions
const getAllAuctions = async (req, res) => {
  try {
    const auctions = await Auction.find();
    res.json(auctions);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Read an auction by ID
const getAuctionById = async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id);
    if (!auction) {
      return res.status(404).json({ error: "Auction not found" });
    }
    res.json(auction);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Update an auction by ID
const updateAuctionById = async (req, res) => {
  try {
    const auction = await Auction.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!auction) {
      return res.status(404).json({ error: "Auction not found" });
    }
    res.json(auction);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Delete an auction by ID
const deleteAuctionById = async (req, res) => {
  try {
    const auction = await Auction.findByIdAndDelete(req.params.id);
    if (!auction) {
      return res.status(404).json({ error: "Auction not found" });
    }
    res.json({ message: "Auction deleted successfully" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Place a bid on an auction
const placeBid = async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id);
    if (!auction) {
      return res.status(404).json({ error: "Auction not found" });
    }

    const { bidderName, bidAmount } = req.body;

    if (
      bidAmount <= auction.currentBid ||
      bidAmount < auction.startingBid + auction.minimumIncrement
    ) {
      return res.status(400).json({
        error:
          "Bid amount must be higher than the current bid and meet the minimum increment",
      });
    }

    auction.currentBid = bidAmount;
    auction.highestBidder = bidderName;
    auction.bids.push({ bidderName, bidAmount });

    await auction.save();

    // Save the successful bid in BidCollect
    const bidCollect = new BidCollect({
      auctionId: auction._id,
      bidderName,
      bidAmount,
    });
    await bidCollect.save();

    res.json(auction);
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
};
