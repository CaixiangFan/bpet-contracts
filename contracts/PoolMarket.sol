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
    uint8 blockAmount; // Block amount from 1 to 7
    uint16 capacity; // Energy amount in MWh
    string offerControl; // Offer control parties separated by a semi-colon
  }

  struct Consumer {
    string assetId;
    uint16 load;
    string offerControl;
  }
  function getSupplier(address) external view returns(Supplier memory);
  function getConsumer(address) external view returns(Consumer memory);
  function getOwnSupplier() external view returns(Supplier memory);
  function getOwnConsumer() external view returns(Consumer memory);
  function isRegisteredSupplier() external view returns(bool);
  function isRegisteredConsumer() external view returns(bool);
  function getTotalCapacity() external view returns(uint16);
}

contract PoolMarket is Ownable{

  enum BiddingState {Closed, Open}
  enum MarketClearanceState {NotCleared,Cleared}

  BiddingState public biddingState;
  MarketClearanceState public marketClearanceState;

  /**
  @dev An asset can submit multiple offers each sitting in a block
   */
  struct Offer {
    uint16 amount; //Available MW for dispatch
    uint16 price; //Price in EKT per MW, 1EKT=1US dollor
    uint256 submitMinute; //Epoch time in minute when this offer is submitted
    bool isValid;
  }

  /**
  @dev In Alberta, this bid has not been used to calculate the SMP
   */
  struct Bid {
    uint16 amount;
    uint16 price;
  }

  /**
  @dev Defines the realtime total energy demand in Alberta. 
  This AIL, along with the offers, is used to calculate the SMP each minute.
  If none of ail and offers changes in a minute, SMP keeps unchanged for that minute.
  If one of the ail and offers changes, SMP changes based on the merit order effect.
   */
  struct Demand {
    uint16 ail; // Alberta internal load in MW, may change every minute
    uint lastUpdated; //The timestamp in minute when the lastest AIL updates
  }

  mapping(bytes32 => Offer) public energyOffers; //offerId is the Hash value of assetId+blockNumber
  mapping(bytes32 => Bid) public energyBids; //bidId is the hash value of assetId+timestamp
  bytes32[] public validOffers; //Merit order (only IDs) of the valid offers
  bytes32[] public validBids;

  IEnergyToken public energyToken;
  IRegistry public registryContract;
  
  Demand public totalDemand;
  uint16 public minAllowedPrice;
  uint16 public maxAllowedPrice;
  mapping(uint256 => uint16) public systemMarginalPrices; //key is the current time in minute in the form of Unix time (uint32)
  mapping(uint256 => uint16) public poolPrices; // key is the current time in hour in the form of Unix time (uint32)

  event OfferSubmitted(bytes32 offerId, uint16 amount, uint16 price);
  event BidSubmitted(bytes32 bidId, uint16 amount, uint16 price);
  event OfferDeleted(bytes32 offerId);
  event DemandChanged(uint256 ail);

  constructor(
    address _etkContractAddress,
    address _registryContractAddress
  ) {
    energyToken = IEnergyToken(_etkContractAddress);
    registryContract = IRegistry(_registryContractAddress);
    minAllowedPrice = 0;
    maxAllowedPrice = 1000;
  }

  modifier registeredSupplier() {
    require(registryContract.isRegisteredSupplier(), "Unregistered supplier");
    _;
  }

  modifier registeredConsumer() {
    require(registryContract.isRegisteredConsumer(), "Unregistered consumer");
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
  }

  /**
  @dev submit an offer to the pool market; one account only allows to have one offer in an interval
  the new submitted offer from the same account will update the previous one
   */
  function submitOffer(
    string memory _assetId,
    uint8 _blockNumber,
    uint16 _amount, 
    uint16 _price
    ) public 
    registeredSupplier
    validOffer(_amount, _price, msg.sender)
    {
    require(biddingState == BiddingState.Open, "Bidding closed");
    require(
      keccak256(abi.encodePacked(_assetId)) == 
      keccak256(abi.encodePacked(registryContract.getOwnSupplier().assetId)),
       "Cannot submit offer for others");
    bytes32 offerId = keccak256(abi.encodePacked(_assetId, _blockNumber));
    uint256 _submitMinute = block.timestamp / 60 * 60;
    energyOffers[offerId] = Offer(_amount, _price, _submitMinute, true);
    
    validOffers.push(offerId);
    emit OfferSubmitted(offerId, _amount, _price);
  }

  /**
  @dev Delete an offer from the offer array. This decreases the supplies and triggers msp calculation
   */
  function deleteOffer(
    string memory _assetId,
    uint8 _blockNumber
  ) public registeredSupplier {
    require(biddingState == BiddingState.Open, "Bidding closed");
    require(
      keccak256(abi.encodePacked(_assetId)) == 
      keccak256(abi.encodePacked(registryContract.getOwnSupplier().assetId)),
       "Cannot submit offer for others");
    bytes32 offerId = keccak256(abi.encodePacked(_assetId, _blockNumber));
    uint256 submitMinute = block.timestamp / 60 * 60;
    energyOffers[offerId].submitMinute = submitMinute;
    energyOffers[offerId].isValid = false;
    //retrieve and delete the corresponding element(offerId) from the validOffers array
    for (uint i=0; i < validOffers.length; i++) {
      if (offerId == validOffers[i]) {
        validOffers[i] = validOffers[validOffers.length - 1];
        validOffers.pop();
      }
    }
    emit OfferDeleted(offerId);
  }

  /**
  @dev Submit AIL as one big bid to the pool market; one account only allows to have one bid in an interval
  the new submitted bid from the same account will update the previous one
   */
  function submitBid(
    string memory _assetId,
    uint16 _amount, 
    uint16 _price
    ) public 
    registeredConsumer
    validBid(_amount, _price, msg.sender)
    {
    require(biddingState == BiddingState.Open, "Bidding closed");
    require(
      keccak256(abi.encodePacked(_assetId)) == 
      keccak256(abi.encodePacked(registryContract.getOwnConsumer().assetId)),
       "Cannot submit bid for others");
    bytes32 bidId = keccak256(abi.encodePacked(_assetId, block.timestamp));
    energyBids[bidId] = Bid(_amount, _price);
    validBids.push(bidId);
    emit BidSubmitted(bidId, _amount, _price);
  }

  function getMeritOrderSnapshot() private view returns(bytes32[] memory){
    bytes32[] memory meritOrderSnapshot = validOffers;
    uint256 len = meritOrderSnapshot.length;
    for(uint i = 0; i < len; i++) {
      for(uint256 j = i+1; j < len; j++) {
        if( energyOffers[meritOrderSnapshot[i]].price > 
        energyOffers[meritOrderSnapshot[j]].price) {
          bytes32 temp = meritOrderSnapshot[i];
          meritOrderSnapshot[i] = meritOrderSnapshot[j];
          meritOrderSnapshot[j] = temp;
        }
      }
    }
    return meritOrderSnapshot;
  }

  /**
  @dev Updates AIL in realtime. This triggers SMP calculation.
  AIL is collected from substations/smart meters.
   */
  function updateDemand(uint16 ail) public onlyOwner{
    require(ail < registryContract.getTotalCapacity(), "Demand exceeds total supply");
    totalDemand.ail = ail;
    totalDemand.lastUpdated = block.timestamp;
    calculateSMP(ail);
    emit DemandChanged(ail);
  }

  ///@dev calculate the system marginal price when demand or offers change
  function calculateSMP(uint16 _ail) public {
    //during calculating the SMP, system cannot accept new offers/bids
    //this requires a high-performance blockchain system to process this transaction
    //in a very short time, otherwise services stop for a long period time
    marketClearanceState = MarketClearanceState.Cleared;
    biddingState = BiddingState.Closed;

    uint16 aggregatedOfferAmount = 0;
    // slice energyOffers only to be current minute's
    // get the ascending sorted energyOffers (offerId)
    bytes32[] memory meritOrderOffers = getMeritOrderSnapshot();
    for (uint i=0; i < meritOrderOffers.length; i++) {
      aggregatedOfferAmount += energyOffers[meritOrderOffers[i]].amount;
      //use the merit order effect to calculate the SMP,
      if (aggregatedOfferAmount >= _ail) {
        uint256 nowMinute = block.timestamp / 60 * 60;
        systemMarginalPrices[nowMinute] = energyOffers[meritOrderOffers[i]].price;
        break;
      }
    }
    marketClearanceState = MarketClearanceState.NotCleared;
    biddingState = BiddingState.Open;
  }

  /**
  @dev Query the price of given minute in unix time. 
   */
  function getSMP(uint minute) public view returns (uint16) {
    // try minute by minute before the given timestamp; once find in the systemMarginalPrices mapping, return it.
    return systemMarginalPrices[minute];
  }

  /**
  @dev Calculated the weighted pool price. 
  IN the backend, set time intervals to call calculatePoolPrice and calculateSMP by listening to the events.
   */
  function calculatePoolPrice(uint hour) public {
    require(hour < block.timestamp, "Hour is not valid");
    uint16 poolWeightedPrice;
    uint16 currSMP = systemMarginalPrices[hour];
    uint8 currSMPMinutes;
    for (uint i = 1; i < 60; i++){
      hour += 60 * i;
      currSMPMinutes ++;
      //assume that all valid SMPs are greater than 0
      if(systemMarginalPrices[hour] > 0) {
        poolWeightedPrice += currSMP * currSMPMinutes;
        currSMP = systemMarginalPrices[hour];
        currSMPMinutes = 0;
      }
    }
    poolPrices[hour] = poolWeightedPrice / 60;
  }

  function getPoolPrice(uint hour) public view returns (uint16) {
    return poolPrices[hour];
  }
}