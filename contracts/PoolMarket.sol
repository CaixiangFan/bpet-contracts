//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IEnergyToken is IERC20 {
    function mint(address, uint256) external;
    function burnFrom(address, uint256) external;
}

interface IRegistry {
  function getSupplier(address) external;
  function getConsumer(address) external;
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
    uint256 amount;
    uint256 price;
  }

  struct Bid {
    uint256 amount;
    uint256 price;
  }

  mapping(address => Offer) public energyOffers;
  mapping(address => Bid) public energyBids;
  address[] public suppliers;
  address[] public consumers;

  IEnergyToken public energyToken;
  IPayment public paymentContract;
  IRegistry public registryContract;
  
  uint[] public minutePoolPrices; // record and update hour by hour
  uint[] public hourlyPoolPrice; // record permanently to calculate payment bill

  constructor(
    address _etkContractAddress,
    address _registryContractAddress,
    address _paymentContractAddress
  ) {
    energyToken = IEnergyToken(_etkContractAddress);
    registryContract = IRegistry(_registryContractAddress);
    paymentContract = IPayment(_paymentContractAddress);
  }

  function initializeBidding () public onlyOwner {
    biddingState=BiddingState.Open;
    marketClearanceState=MarketClearanceState.NotCleared;
    // marketResettingState=MarketResettingState.NotReset;
  }

  function submitOffer(uint256 amount, uint256 price) public {
    energyOffers[msg.sender] = Offer(amount, price);
    suppliers.push(msg.sender);
  }

  function submitBid(uint256 amount, uint256 price) public {
    energyBids[msg.sender] = Bid(amount, price);
    consumers.push(msg.sender);
  }

  ///@dev calculate the pool price for each bid interval (one minute)
  ///if the consumers or suppliers didn't change at the current interval
  ///read the previous values
  function calculateMinutePoolPrices(uint minute) public {
    marketClearanceState = MarketClearanceState.Cleared;
    biddingState = BiddingState.Closed;

    uint totalBidAmount = 0;
    uint totalOfferAmount = 0;
    for (uint i=0; i < consumers.length; i++) {
      totalBidAmount += energyBids[consumers[i]].amount;
    }
    for (uint j=0; j < suppliers.length; j++) {
      totalOfferAmount += energyOffers[suppliers[j]].amount;
      //use the merit order effect to calculate hourly pool price
      if (totalOfferAmount >= totalBidAmount) {
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