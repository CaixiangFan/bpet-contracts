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
    uint amount; //Available MW for dispatch
    uint price; //Price in EKT per MW, 1EKT=1US dollor
    uint submitMinute; //Epoch time in minute when this offer is submitted or updated
    address supplierAccount; //The account of the offer supplier
    bool isValid; // Indicator if this offer is deleted or not
  }

  /**
  @dev An asset can submit multiple bids
  In the production in Alberta, this bid has not been used to calculate the SMP
   */
  struct Bid {
    uint amount;
    uint price;
    uint submitMinute; //Epoch time in minute when this bid is submitted or updated
    address consumerAccount; //The account of the consumer
  }

  mapping(bytes32 => Offer) public energyOffers; //offerId is the Hash value of assetId+blockNumber
  mapping(bytes32 => Bid) public energyBids; //bidId is the hash value of assetId
  mapping(uint => DispatchedOffer[]) public dispatchedOffers;
  bytes32[] public validOfferIDs; // The valid offers (only offerIDs) used to calculate the merit order
  bytes32[] public validBidIDs; // The valid bids (only bidIDs) used to calculate the merit order

  IRegistry public registryContract;
  
  // Demand public totalDemand;
  uint public minAllowedPrice;
  uint public maxAllowedPrice;
  mapping(uint => bytes32) public systemMarginalOfferIDs; //map the time in minute in the form of Unix time (uint32) to the system marginal offerID
  mapping(uint => uint) public poolPrices; // map the time in hour in the form of Unix time (uint32) to the poolPrices
  mapping(uint => uint) public totalDemands; // map the time in minute in the form of Unix time (uint32) to the total demand
  uint[] public systemMarginalMinutes; //store time in minute in the form of Unix time (uint32) used to index the systemMarginalOfferIDs 
  uint[] public poolPriceHours; //store time in hour in the form of Unix time (uint32) used to index the poolPrices
  uint[] public totalDemandMinutes; // store time in minute in the form of Unix time (uint32) used to index the totalDemands

  event OfferSubmitted(bytes32 offerId, uint amount, uint price);
  event BidSubmitted(bytes32 bidId, uint amount, uint price);
  event OfferDeleted(bytes32 offerId);
  event DemandChanged(uint ail);

  modifier registeredSupplier(address account) {
    require(registryContract.isRegisteredSupplier(account), "Unregistered supplier");
    _;
  }

  modifier registeredConsumer(address account) {
    require(registryContract.isRegisteredConsumer(account), "Unregistered consumer");
    _;
  }

  modifier validOffer(
    uint amount,
    uint price
  ) {
    require(price <= maxAllowedPrice && price >= minAllowedPrice, "Invalid price");
    // require(amount <= registryContract.getSupplier().capacity, "Offered amount exceeds capacity");
    _;
  }

  modifier validBid(
    uint amount,
    uint price,
    address bidSender
  ) {
    require(price <= maxAllowedPrice && price >= minAllowedPrice, "Invalid price");
    // require(energyToken.balanceOf(bidSender) >= amount * price, "Insufficient ETK balance");
    _;
  }

  constructor(
    address _registryContractAddress,
    uint _minAllowedPrice,
    uint _maxAllowedPrice
  ) {
    registryContract = IRegistry(_registryContractAddress);
    minAllowedPrice = _minAllowedPrice;
    maxAllowedPrice = _maxAllowedPrice;
    marketState = MarketState.Open;
    // totalDemand.ail = 0;
    // totalDemand.lastUpdated = block.timestamp;
  }

  /**
  @dev submit an offer to the pool market; one account only allows to have one offer in an interval
  the new submitted offer from the same account will update the previous one
   */
  function submitOffer(
    string memory assetId,
    uint8 blockNumber,
    uint amount, 
    uint price
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
    uint submitMinute = block.timestamp / 60 * 60;
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
    if (totalDemandMinutes.length > 0) {
      calculateSMP();
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
    uint submitMinute = block.timestamp / 60 * 60;
    energyOffers[offerId].submitMinute = submitMinute;
    energyOffers[offerId].isValid = false;
    //retrieve and delete the corresponding element(offerId) from the validOfferIDs array
    for (uint i=0; i < validOfferIDs.length; i++) {
      if (offerId == validOfferIDs[i]) {
        validOfferIDs[i] = validOfferIDs[validOfferIDs.length - 1];
        validOfferIDs.pop();
      }
    }
    calculateSMP();
    emit OfferDeleted(offerId);
  }

  /**
  @dev Updates AIL in realtime. This triggers SMP calculation.
  AIL is collected from substations/smart meters.
   */
  function updateDemand() private {
    uint totalAmount = 0;
    for (uint i = 0; i < validBidIDs.length; i ++) {
      totalAmount += energyBids[validBidIDs[i]].amount;
    }
    require( totalAmount < registryContract.getTotalCapacity(), "Demand exceeds total supply");
    uint currMinute = block.timestamp / 60 * 60;
    totalDemands[currMinute] = totalAmount;
    totalDemandMinutes.push(currMinute);
    calculateSMP();
    emit DemandChanged(totalAmount);
  }

  /**
  @dev Submit bid to pool market will change AIL; one account only allows to have one bid in an interval;
  the new submitted bid from the same account will update the previous one, increasing or decreasing
  the AIL.
   */
  function submitBid(
    string memory _assetId,
    uint _amount, 
    uint _price
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
    uint submitMinute = block.timestamp / 60 * 60;
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
    uint len = meritOrderSnapshot.length;
    for(uint i = 0; i < len; i++) {
      for(uint j = i+1; j < len; j++) {
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
  function calculateSMP() private {
    //during calculating the SMP, system cannot accept new offers/bids
    //this requires a high-performance blockchain system to process this transaction
    //in a very short time, otherwise services stop for a long period time
    marketState = MarketState.Closed;
    uint aggregatedOfferAmount = 0;
    uint latestTotalDemand = totalDemands[totalDemandMinutes[totalDemandMinutes.length - 1]]; // get the latest total demand
    // get the ascending sorted energyOffers (offerId)
    bytes32[] memory meritOrderOfferIDs = getMeritOrderSnapshot();
    uint nowHour = block.timestamp / 3600 * 3600;
    for (uint i=0; i < meritOrderOfferIDs.length; i++) {
      address supplierAccount = energyOffers[meritOrderOfferIDs[i]].supplierAccount;
      uint amount = energyOffers[meritOrderOfferIDs[i]].amount;
      aggregatedOfferAmount += amount;
      dispatchedOffers[nowHour].push(DispatchedOffer(supplierAccount, amount, block.timestamp));
      //use the merit order effect to calculate the SMP,
      if (aggregatedOfferAmount >= latestTotalDemand) {
        uint nowMinute = block.timestamp / 60 * 60;
        systemMarginalOfferIDs[nowMinute] = meritOrderOfferIDs[i];
        systemMarginalMinutes.push(nowMinute);
        break;
      }
    }

    // Loop to aggregate all dispatched energy of each account
    for (uint j=0; j < dispatchedOffers[nowHour].length; j++) {
      address supplierAccount = dispatchedOffers[nowHour][j].supplierAccount;
      uint dispatchedAmount = dispatchedOffers[nowHour][j].dispatchedAmount;
      uint dispatchedAt = dispatchedOffers[nowHour][j].dispatchedAt;
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
  In the backend, set time intervals to call calculatePoolPrice each hour.
  At the beginning of each hour, calculateSMP must be executed.
  Params: hour is the hour beginning of the calculation duration
   */
  function calculatePoolPrice(uint hour) public {
    require(hour < block.timestamp, "Hour is not valid");
    //calculate a smp for that hour timestamp before calculating pool price
    //this makes sure at least one msp exists in that hour
    calculateSMP();
    uint poolPrice = 0;
    uint cummulatedPrice = 0;
    for (uint i=0; i<systemMarginalMinutes.length; i++) {
      uint timestamp = systemMarginalMinutes[i];
      // condition: in the previous hour
      if (timestamp >= hour && timestamp < hour+3600) {
        uint price = energyOffers[systemMarginalOfferIDs[timestamp]].price;
        uint durationMinutes = 0;
        if ((i < systemMarginalMinutes.length -1) && (systemMarginalMinutes[i+1] < hour+3600)) {
          durationMinutes = (systemMarginalMinutes[i+1] - systemMarginalMinutes[i])/60;
        } else {
          durationMinutes = 60 - (systemMarginalMinutes[i] - hour) / 60;
        }
        cummulatedPrice += price * durationMinutes;
      }
    }
    poolPrice = cummulatedPrice / 60;
    poolPrices[hour] = poolPrice;
    poolPriceHours.push(hour);
  }

  /**
  @dev Query the index in timestamps of all demands. 
   */
  function getTotalDemandMinutes() public view returns(uint[] memory) {
    return totalDemandMinutes;
  }

  function getPoolpriceHours() public view returns(uint[] memory) {
    return poolPriceHours;
  }

  function getLatestTotalDemand() public view returns(uint) {
    return totalDemands[totalDemandMinutes[totalDemandMinutes.length - 1]];
  }

  function getRegisteredSupplierAssetId() public view returns(string memory) {
    return registryContract.getSupplier(msg.sender).assetId;
  }

  /**
  @dev Query the marginal price of given minute in unix time. 
   */
  function getSMP(uint minute) public view returns (uint) {
    return energyOffers[systemMarginalOfferIDs[minute]].price;
  }

    /**
  @dev Query the marginal offer of given minute in unix time. 
   */
  function getMarginalOffer(uint minute) public view returns (Offer memory) {
    return energyOffers[systemMarginalOfferIDs[minute]];
  }
  
  function getPoolPrice(uint hour) override public view returns (uint) {
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