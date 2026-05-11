// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20Like {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address owner) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
}

/// @title Carbon Credit Marketplace for CCT
/// @notice Supports fixed-price listings and timed auctions (default 6 minutes).
contract CarbonCreditMarketplace {
    IERC20Like public immutable cct;
    uint256 public immutable defaultAuctionDuration = 6 minutes;

    uint256 private nextListingId = 1;
    uint256 private nextAuctionId = 1;

    struct Listing {
        address seller;
        uint256 amount;
        uint256 pricePerTokenWei;
        bool active;
    }

    struct Auction {
        address seller;
        uint256 amount;
        uint256 minPriceWei;
        uint64 endTime;
        address highestBidder;
        uint256 highestBid;
        bool settled;
    }

    mapping(uint256 => Listing) public listings;
    mapping(uint256 => Auction) public auctions;

    event ListingCreated(uint256 indexed id, address indexed seller, uint256 amount, uint256 pricePerTokenWei);
    event ListingCancelled(uint256 indexed id);
    event ListingPurchased(uint256 indexed id, address indexed buyer, uint256 amount, uint256 totalPaid);

    event AuctionCreated(uint256 indexed id, address indexed seller, uint256 amount, uint256 minPriceWei, uint64 endTime);
    event AuctionBid(uint256 indexed id, address indexed bidder, uint256 amount); // amount = bid value in wei
    event AuctionSettled(uint256 indexed id, address indexed winner, uint256 bidAmount);
    event AuctionCancelled(uint256 indexed id);

    error NotSeller();
    error NotActive();
    error AlreadySettled();
    error AuctionStillRunning();
    error AuctionEnded();
    error BidTooLow();
    error InvalidAmount();

    constructor(address cctAddress) {
        require(cctAddress != address(0), "cct required");
        cct = IERC20Like(cctAddress);
    }

    // --- Fixed price ---
    function createListing(uint256 amount, uint256 pricePerTokenWei) external returns (uint256 id) {
        require(amount > 0, "amount");
        require(pricePerTokenWei > 0, "price");

        // Pull tokens into escrow
        _pullTokens(msg.sender, amount);

        id = nextListingId++;
        listings[id] = Listing({
            seller: msg.sender,
            amount: amount,
            pricePerTokenWei: pricePerTokenWei,
            active: true
        });

        emit ListingCreated(id, msg.sender, amount, pricePerTokenWei);
    }

    function cancelListing(uint256 id) external {
        Listing storage l = listings[id];
        if (!l.active) revert NotActive();
        if (l.seller != msg.sender) revert NotSeller();

        l.active = false;
        _pushTokens(msg.sender, l.amount);
        emit ListingCancelled(id);
    }

    function buyListing(uint256 id, uint256 amount) external payable {
        Listing storage l = listings[id];
        if (!l.active) revert NotActive();
        if (amount == 0 || amount > l.amount) revert InvalidAmount();

        uint256 totalCost = l.pricePerTokenWei * amount;
        require(msg.value >= totalCost, "insufficient ETH");

        l.amount -= amount;
        if (l.amount == 0) {
            l.active = false;
        }

        _pushTokens(msg.sender, amount);
        _payout(l.seller, totalCost);

        // Refund excess
        if (msg.value > totalCost) {
            _payout(msg.sender, msg.value - totalCost);
        }

        emit ListingPurchased(id, msg.sender, amount, totalCost);
    }

    // --- Auctions ---
    function createAuction(uint256 amount, uint256 minPriceWei) external returns (uint256 id) {
        require(amount > 0, "amount");
        require(minPriceWei > 0, "minPrice");

        _pullTokens(msg.sender, amount);

        id = nextAuctionId++;
        auctions[id] = Auction({
            seller: msg.sender,
            amount: amount,
            minPriceWei: minPriceWei,
            endTime: uint64(block.timestamp + defaultAuctionDuration),
            highestBidder: address(0),
            highestBid: 0,
            settled: false
        });

        emit AuctionCreated(id, msg.sender, amount, minPriceWei, uint64(block.timestamp + defaultAuctionDuration));
    }

    function bid(uint256 id) external payable {
        Auction storage a = auctions[id];
        if (a.settled) revert AlreadySettled();
        if (block.timestamp >= a.endTime) revert AuctionEnded();
        uint256 minBid = a.highestBid == 0 ? a.minPriceWei : a.highestBid + 1; // simple +1 wei increment
        if (msg.value < minBid) revert BidTooLow();

        // Refund previous bidder
        if (a.highestBidder != address(0)) {
            _payout(a.highestBidder, a.highestBid);
        }

        a.highestBidder = msg.sender;
        a.highestBid = msg.value;

        emit AuctionBid(id, msg.sender, msg.value);
    }

    function finalizeAuction(uint256 id) external {
        Auction storage a = auctions[id];
        if (a.settled) revert AlreadySettled();
        if (block.timestamp < a.endTime) revert AuctionStillRunning();

        a.settled = true;

        if (a.highestBidder == address(0)) {
            // No bids, return tokens
            _pushTokens(a.seller, a.amount);
            emit AuctionCancelled(id);
            return;
        }

        // Deliver tokens to winner, pay seller
        _pushTokens(a.highestBidder, a.amount);
        _payout(a.seller, a.highestBid);
        emit AuctionSettled(id, a.highestBidder, a.highestBid);
    }

    function cancelAuction(uint256 id) external {
        Auction storage a = auctions[id];
        if (a.settled) revert AlreadySettled();
        if (a.seller != msg.sender) revert NotSeller();
        if (block.timestamp >= a.endTime) revert AuctionEnded();
        if (a.highestBidder != address(0)) revert NotSeller(); // cannot cancel once bids exist

        a.settled = true;
        _pushTokens(a.seller, a.amount);
        emit AuctionCancelled(id);
    }

    // --- Internal helpers ---
    function _pullTokens(address from, uint256 amount) internal {
        require(cct.allowance(from, address(this)) >= amount, "allowance");
        bool ok = cct.transferFrom(from, address(this), amount);
        require(ok, "transferFrom failed");
    }

    function _pushTokens(address to, uint256 amount) internal {
        bool ok = cct.transfer(to, amount);
        require(ok, "transfer failed");
    }

    function _payout(address to, uint256 amount) internal {
        (bool s, ) = to.call{value: amount}("");
        require(s, "eth transfer failed");
    }

    // --- Views ---
    function getListing(uint256 id) external view returns (Listing memory) {
        return listings[id];
    }

    function getAuction(uint256 id) external view returns (Auction memory) {
        return auctions[id];
    }

    // Helpful view helpers for UIs
    function listingCount() external view returns (uint256) {
        // nextListingId starts at 1, so subtract 1 to get the created count
        return nextListingId - 1;
    }

    function auctionCount() external view returns (uint256) {
        // nextAuctionId starts at 1, so subtract 1 to get the created count
        return nextAuctionId - 1;
    }

    receive() external payable {}
}