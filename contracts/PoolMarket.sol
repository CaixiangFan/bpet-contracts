//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IEnergyToken is IERC20 {
    function mint(address, uint256) external;
    function burnFrom(address, uint256) external;
}

interface IRegistry {
  struct Supplier {
    string assetId; // Asset Short Name Identifier
    uint8 blockNumber; // Block Number from 0 to 6
    uint16 capacity; // Energy amount in MWh
    string offerControl; // Offer control parties separated by a semi-colon
  }

  struct Consumer {
    string assetId;
    uint8 blockNumber;
    uint16 demand;
    string offerControl;
  }
  function getSupplier(address) external view returns(Supplier memory);
  function getConsumer(address) external view returns(Consumer memory);
}

interface IPayment {
  function pay() external;
}

contract PoolMarket is Ownable{

  enum BiddingState {Closed, Open}
  enum MarketClearanceState {NotCleared,Cleared}
  // enum MarketResettingState {NotReset, Reset}

  BiddingState public biddingState;
  MarketClearanceState public marketClearanceState;

  struct Offer {
    uint16 amount;
    uint16 price;
  }

  struct Bid {
    uint16 amount;
    uint16 price;
  }

  mapping(address => Offer) public energyOffers;
  mapping(address => Bid) public energyBids;
  address[] public suppliers;
  address[] public consumers;

  IEnergyToken public energyToken;
  IPayment public paymentContract;
  IRegistry public registryContract;
  
  uint8 public minAllowedPrice;
  uint16 public maxAllowedPrice;
  uint16[] public minutePoolPrices; // record 60 system marginal prices and update hour by hour
  uint16[] public hourlyPoolPrice; // record permanently to calculate payment bill

  constructor(
    address _etkContractAddress,
    address _registryContractAddress,
    address _paymentContractAddress
  ) {
    energyToken = IEnergyToken(_etkContractAddress);
    registryContract = IRegistry(_registryContractAddress);
    paymentContract = IPayment(_paymentContractAddress);
    minAllowedPrice = 0;
    maxAllowedPrice = 1000;
  }

  modifier registeredSupplier(
    address offerSender
  ) {
    require(bytes(registryContract.getSupplier(offerSender).assetId).length != 0, "Unregistered supplier");
    _;
  }

  modifier registeredConsumer(
    address bidSender
  ) {
    require(bytes(registryContract.getConsumer(bidSender).assetId).length != 0, "Unregistered supplier");
    _;
  }

  modifier validOffer(
    uint16 amount,
    uint16 price,
    address offerSender
  ) {
    require(price <= maxAllowedPrice && price >= minAllowedPrice, "Invalid price");
    require(amount <= registryContract.getSupplier(offerSender).capacity, "Offered amount exceeds capacity");
    _;
  }

  modifier validBid(
    uint16 amount,
    uint16 price,
    address bidSender
  ) {
    require(price <= maxAllowedPrice && price >= minAllowedPrice, "Invalid price");
    require(energyToken.balanceOf(bidSender) >= amount * price, "Insufficient ETK balance");
    _;
  }

  function initializeBidding () public onlyOwner {
    biddingState=BiddingState.Open;
    marketClearanceState=MarketClearanceState.NotCleared;
    // marketResettingState=MarketResettingState.NotReset;
  }

  function submitOffer(
    uint16 amount, 
    uint16 price
    ) public 
    registeredSupplier(msg.sender)
    validOffer(amount, price, msg.sender)
    {
    require(biddingState == BiddingState.Open, "Bidding closed");
    energyOffers[msg.sender] = Offer(amount, price);
    suppliers.push(msg.sender);
  }

  function submitBid(
    uint16 amount, 
    uint16 price
    ) public 
    registeredConsumer(msg.sender)
    validBid(amount, price, msg.sender)
    {
    require(biddingState == BiddingState.Open, "Bidding closed");
    energyBids[msg.sender] = Bid(amount, price);
    consumers.push(msg.sender);
  }

  ///@dev calculate the pool price for each bid interval (one minute)
  ///if the consumers or suppliers didn't change at the current interval
  ///read the previous values
  function calculateSMP(uint8 minute) public onlyOwner{
    //when calculating the SMP, system cannot accept new offers/bids
    //this requires a high-performance blockchain system to process this transaction
    //in a very short time, otherwise services stop for a long period time
    marketClearanceState = MarketClearanceState.Cleared;
    biddingState = BiddingState.Closed;

    uint totalBidAmount = 0;
    uint aggregatedOfferAmount = 0;
    for (uint i=0; i < consumers.length; i++) {
      // slice energyBids only to be current minute's
      totalBidAmount += energyBids[consumers[i]].amount;
    }
    // slice energyOffers only to be current minute's
    // use the quick sort to sort the energyOffers in an ascending order
    for (uint j=0; j < suppliers.length; j++) {
      aggregatedOfferAmount += energyOffers[suppliers[j]].amount;
      //use the merit order effect to calculate the SMP,
      //e.g., the max price of offer submitted to the market which has been dispatched 
      if (aggregatedOfferAmount >= totalBidAmount) {
        minutePoolPrices[minute] = energyOffers[suppliers[j]].price;
        break;
      }
    }
  }

  function getMarketPrice(uint minute) public view returns (uint) {
    return minutePoolPrices[minute];
  }

  function calculateHourlyPoolPrice() public {
    
  }
}