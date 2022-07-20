//SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

/// @title P2P-ET PoolMarket
/// @author Stephen Fan
/// @notice This contract makes the pool market rules; each bid interval (default one minute), 
/// registered supplieres and consumers submit one or more offers/bids, pool market calculates
/// the System Marginal Price using Merit Order Effect
/// Each hour's HE price is the average of all SMP prices in this hour
/// @dev who deploys this contract? what priorities does this role/account have?
contract AESOPoolMarket {
  // enum HourEnding {1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24}
  enum MarketClearanceState {
    NotCleared,
    Cleared
  }

  enum MarketState {
    Open,
    Closed
  }
  MarketClearanceState public marketClearanceState;
  MarketState public marketState;

  struct EnergyOffer {
    uint16 amount; // Energy amount in MW
    uint16 priceRate; // The price of energy per MW
  }

  struct EnergyBid {
    uint16 amount; // Energy amount in MW
    uint16 priceRate; // The price of energy per MW
  }

  mapping(address => EnergyOffer) public energyOffers;
  mapping(address => EnergyBid) public energyBids;
  address public _authorizedEntity;

  // modifier isValidBid(
  //     uint32 amount,
  //     uint32 priceRate,
  //     address addr
  // ) {
  //     require(et.getBalance(addr) >= amount * priceRate); //This also checks whether the user is registered or not because the balance would not be > zero if the users is not registered
  //     require(minAllowedPrice <= priceRate && priceRate <= maxAllowedPrice);
  //     _;
  // }

  // modifier isValidOffer(
  //     uint32 amount,
  //     uint32 priceRate,
  //     address addr
  // ) {
  //     require(et.getSupplierProductionCapacity(addr) >= amount); //This also checks whether the user is registered or not because the capacity would be zero if the users is not registered
  //     require(minAllowedPrice <= priceRate && priceRate <= maxAllowedPrice);
  //     _;
  // }

  constructor () {
    _authorizedEntity = msg.sender;
  }


  function initializeBidding() public {
    require(msg.sender == _authorizedEntity, "Cannot initilize the market");
    marketState = MarketState.Open;
    marketClearanceState = MarketClearanceState.NotCleared;
  }
  /// Submit an offer to the market in the current bid interval; if no new offer submitted, 
  function submitOffer (uint16 _amount, uint16 _priceRate) public {
    // Currently this accepts offer only for one interval
    require(marketState == MarketState.Open, "Cannot submit as market closed");
    energyOffers[msg.sender] = EnergyOffer(_amount, _priceRate);
    // totalOfferForAGivenPriceRate[priceRate] += amount;
    // suppliers.push(msg.sender);
  }

  /// Submit a bid to the market in the current bid interval
  function submitBid (uint16 _amount, uint16 _priceRate) public {
    // Currently this accepts bid only for one interval
    require(marketState == MarketState.Open, "Cannot submit as market closed");
    energyBids[msg.sender] = EnergyBid(_amount, _priceRate);
    // totalDemandForAGivenPriceRate[priceRate] += amount;
    // consumers.push(msg.sender);
  }

  //Calculating Market Clearing Price
  function calculateMarketClearingPrice() public {
    
  }
}
