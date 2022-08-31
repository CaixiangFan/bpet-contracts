//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import { IRegistry } from "./IRegistry.sol";
import { IPoolMarket } from "./IPoolMarket.sol";

contract PoolMarket is Ownable, IPoolMarket{

  enum MarketState {Closed, Open}
  MarketState public marketState;

  /**
  @dev An asset can submit multiple offers each sitting in a block
   */
  struct Offer {
    uint16 amount; //Available MW for dispatch
    uint16 price; //Price in EKT per MW, 1EKT=1US dollor
    uint256 submitMinute; //Epoch time in minute when this offer is submitted or updated
    address supplierAccount; //The account of the offer supplier
    bool isValid; // Indicator if this offer is deleted or not
  }

  /**
  @dev In Alberta, this bid has not been used to calculate the SMP
   */
  struct Bid {
    uint16 amount;
    uint16 price;
    uint submitMinute; //Epoch time in minute when this bid is submitted or updated
    address consumerAccount; //The account of the consumer
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
  mapping(bytes32 => Bid) public energyBids; //bidId is the hash value of assetId
  mapping(uint256 => DispatchedOffer[]) public dispatchedOffers;
  bytes32[] public validOfferIDs; // The valid offers (only offerIDs) used to calculate the merit order
  bytes32[] public validBidIDs; // The valid bids (only bidIDs) used to calculate the merit order

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

  modifier registeredSupplier(address account) {
    require(registryContract.isRegisteredSupplier(account), "Unregistered supplier");
    _;
  }

  modifier registeredConsumer(address account) {
    require(registryContract.isRegisteredConsumer(account), "Unregistered consumer");
    _;
  }

  modifier validOffer(
    uint16 amount,
    uint16 price
  ) {
    require(price <= maxAllowedPrice && price >= minAllowedPrice, "Invalid price");
    // require(amount <= registryContract.getSupplier().capacity, "Offered amount exceeds capacity");
    _;
  }

  modifier validBid(
    uint16 amount,
    uint16 price,
    address bidSender
  ) {
    require(price <= maxAllowedPrice && price >= minAllowedPrice, "Invalid price");
    // require(energyToken.balanceOf(bidSender) >= amount * price, "Insufficient ETK balance");
    _;
  }

  constructor(
    address _registryContractAddress,
    uint16 _minAllowedPrice,
    uint16 _maxAllowedPrice
  ) {
    registryContract = IRegistry(_registryContractAddress);
    minAllowedPrice = _minAllowedPrice;
    maxAllowedPrice = _maxAllowedPrice;
    marketState = MarketState.Open;
    totalDemand.ail = 0;
    totalDemand.lastUpdated = block.timestamp;
  }

  function getRegisteredSupplierAssetId() public view returns(string memory) {
    return registryContract.getSupplier(msg.sender).assetId;
  }

  /**
  @dev submit an offer to the pool market; one account only allows to have one offer in an interval
  the new submitted offer from the same account will update the previous one
   */
  function submitOffer(
    string memory assetId,
    uint8 blockNumber,
    uint16 amount, 
    uint16 price
    ) public 
    registeredSupplier(msg.sender)
    validOffer(amount, price)
    {
    require(marketState == MarketState.Open, "Market closed");
    require(
      keccak256(abi.encodePacked(assetId)) == 
      keccak256(abi.encodePacked(registryContract.getSupplier(msg.sender).assetId)),
       "Cannot submit offer for others");
    require(amount <= registryContract.getSupplier(msg.sender).capacity, "Offered amount exceeds capacity");
    bytes32 offerId = keccak256(abi.encodePacked(assetId, blockNumber));
    uint256 submitMinute = block.timestamp / 60 * 60;
    energyOffers[offerId] = Offer(amount, price, submitMinute, msg.sender, true);
    // check if offerId exists or not; if yes, update offer content but leaves offerId unchanged
    // if not, push new offerId to offer list
    bool offerIdExists = false;
    for (uint i=0; i < validOfferIDs.length; i++) {
      if (offerId == validOfferIDs[i]) {
        offerIdExists = true;
        break;
      }
    }
    if (!offerIdExists) {
      validOfferIDs.push(offerId);
    }
    if (totalDemand.ail > 0) {
      calculateSMP(totalDemand.ail);
    }
    emit OfferSubmitted(offerId, amount, price);
  }

  /**
  @dev Delete an offer from the offer array. This decreases the supplies and triggers msp calculation
   */
  function deleteOffer(
    string memory _assetId,
    uint8 _blockNumber
  ) public registeredSupplier(msg.sender) {
    require(marketState == MarketState.Open, "Bidding closed");
    require(
      keccak256(abi.encodePacked(_assetId)) == 
      keccak256(abi.encodePacked(registryContract.getSupplier(msg.sender).assetId)),
       "Cannot submit offer for others");
    bytes32 offerId = keccak256(abi.encodePacked(_assetId, _blockNumber));
    uint256 submitMinute = block.timestamp / 60 * 60;
    energyOffers[offerId].submitMinute = submitMinute;
    energyOffers[offerId].isValid = false;
    //retrieve and delete the corresponding element(offerId) from the validOfferIDs array
    for (uint i=0; i < validOfferIDs.length; i++) {
      if (offerId == validOfferIDs[i]) {
        validOfferIDs[i] = validOfferIDs[validOfferIDs.length - 1];
        validOfferIDs.pop();
      }
    }
    calculateSMP(totalDemand.ail);
    emit OfferDeleted(offerId);
  }

  /**
  @dev Updates AIL in realtime. This triggers SMP calculation.
  AIL is collected from substations/smart meters.
   */
  function updateDemand() private {
    uint16 totalAmount = 0;
    for (uint i = 0; i < validBidIDs.length; i ++) {
      totalAmount += energyBids[validBidIDs[i]].amount;
    }
    require( totalAmount < registryContract.getTotalCapacity(), "Demand exceeds total supply");
    totalDemand.ail = totalAmount;
    totalDemand.lastUpdated = block.timestamp;
    calculateSMP(totalDemand.ail);
    emit DemandChanged(totalDemand.ail);
  }

  /**
  @dev Submit bid to pool market will change AIL; one account only allows to have one bid in an interval;
  the new submitted bid from the same account will update the previous one, increasing or decreasing
  the AIL.
   */
  function submitBid(
    string memory _assetId,
    uint16 _amount, 
    uint16 _price
    ) public 
    registeredConsumer(msg.sender)
    validBid(_amount, _price, msg.sender)
    {
    require(marketState == MarketState.Open, "Bidding closed");
    require(
      keccak256(abi.encodePacked(_assetId)) == 
      keccak256(abi.encodePacked(registryContract.getConsumer(msg.sender).assetId)),
       "Cannot submit bid for others");
    bytes32 bidId = keccak256(abi.encodePacked(_assetId));
    uint256 submitMinute = block.timestamp / 60 * 60;
    energyBids[bidId] = Bid(_amount, _price, submitMinute, msg.sender);
    bool _bidIdExists = false;
    for (uint i=0; i < validBidIDs.length; i++) {
      if (bidId == validBidIDs[i]) {
        _bidIdExists = true;
      }
    }
    if (!_bidIdExists) { validBidIDs.push(bidId); }
    updateDemand();
    emit BidSubmitted(bidId, _amount, _price);
  }

  function getMeritOrderSnapshot() private view returns(bytes32[] memory){
    bytes32[] memory meritOrderSnapshot = validOfferIDs;
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

  ///@dev calculate the system marginal price when demand or offers change
  function calculateSMP(uint16 _ail) private {
    //during calculating the SMP, system cannot accept new offers/bids
    //this requires a high-performance blockchain system to process this transaction
    //in a very short time, otherwise services stop for a long period time
    marketState = MarketState.Closed;

    uint16 aggregatedOfferAmount = 0;
    // get the ascending sorted energyOffers (offerId)
    bytes32[] memory meritOrderOffers = getMeritOrderSnapshot();
    uint256 nowHour = block.timestamp / 3600 * 3600;
    for (uint i=0; i < meritOrderOffers.length; i++) {
      address supplierAccount = energyOffers[meritOrderOffers[i]].supplierAccount;
      uint16 amount = energyOffers[meritOrderOffers[i]].amount;
      aggregatedOfferAmount += amount;
      dispatchedOffers[nowHour].push(DispatchedOffer(supplierAccount, amount, block.timestamp));
      //use the merit order effect to calculate the SMP,
      if (aggregatedOfferAmount >= _ail) {
        uint256 nowMinute = block.timestamp / 60 * 60;
        systemMarginalPrices[nowMinute] = energyOffers[meritOrderOffers[i]].price;
        break;
      }
    }

    // Loop to aggregate all dispatched energy of each account
    for (uint j=0; j < dispatchedOffers[nowHour].length; j++) {
      address supplierAccount = dispatchedOffers[nowHour][j].supplierAccount;
      uint16 dispatchedAmount = dispatchedOffers[nowHour][j].dispatchedAmount;
      uint256 dispatchedAt = dispatchedOffers[nowHour][j].dispatchedAt;
      for (uint k=j+1; k < dispatchedOffers[nowHour].length; k++) {
        if (dispatchedOffers[nowHour][k].supplierAccount == supplierAccount) {
          uint len = dispatchedOffers[nowHour].length;
          dispatchedAmount += dispatchedOffers[nowHour][k].dispatchedAmount;
          dispatchedOffers[nowHour][k] = dispatchedOffers[nowHour][len - 1];
          dispatchedOffers[nowHour].pop();
        }
      }
      dispatchedOffers[nowHour][j] = DispatchedOffer(supplierAccount, dispatchedAmount, dispatchedAt);
    }
    marketState = MarketState.Open;
  }

  /**
  @dev Calculated the weighted pool price. 
  In the backend, set time intervals to call calculatePoolPrice each hour and calculateSMP by listening to the events each minute.
  At the beginning of each hour, calculateSMP must be executed.
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
    uint16 poolPrice = poolWeightedPrice / 60;
    poolPrices[hour] = poolPrice;
  }

  /**
  @dev Query the price of given minute in unix time. 
   */
  function getSMP(uint minute) public view returns (uint16) {
    // try minute by minute before the given timestamp; once find in the systemMarginalPrices mapping, return it.
    return systemMarginalPrices[minute];
  }
  
  function getPoolPrice(uint hour) override public view returns (uint16) {
    return poolPrices[hour];
  }

  function getValidOfferIDs() public view returns(bytes32[] memory) {
    return validOfferIDs;
  }

  function getValidBidIDs() public view returns(bytes32[] memory) {
    return validBidIDs;
  }

  function getEnergyBid(bytes32 bidId) public view returns(Bid memory) {
    return energyBids[bidId];
  }

  function getEnergyOffer(bytes32 offerId) public view returns(Offer memory) {
    return energyOffers[offerId];
  }

  function getDispatchedOffers(uint hour) override public view returns (DispatchedOffer[] memory) {
    return dispatchedOffers[hour];
  }
}