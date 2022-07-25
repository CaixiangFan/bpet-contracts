// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;
//import './RealTimeMarket.sol';
import "./PaymentSettlement.sol";
import "./EnergyToken.sol";

// In this code, i mainly use arrays instead of mapping because web3j does not allow me to send/receive mapping data
// All the types should be uint32 or less as web3j does not convert to BIgInteger when it is > uint32
contract PoolMarket {
  enum BiddingState {
      Closed,
      Open
  }
  enum MarketClearanceState {
      NotCleared,
      Cleared
  }
  enum MarketResettingState {
      NotReset,
      Reset
  }
  BiddingState biddingState;
  MarketClearanceState marketClearanceState;
  MarketResettingState marketResettingState;

  PaymentSettlement ps;
  EnergyToken et;
  //RealTimeMarket realTimeMarket;

  address[] suppliers;
  address[] consumers;
  address[] supplierWinners;
  address[] supplierLosers;
  address[] consumerWinners;
  address[] consumerLosers;

  struct EnergyOffer {
      uint32 amount; // Energy amount in KW
      uint32 priceRate; // The price of energy per KW
  }

  struct EnergyBid {
      uint32 amount; // Energy amount in KW
      uint32 priceRate; // The price of energy per KW
  }

  mapping(address => EnergyOffer) offers;
  mapping(address => EnergyBid) bids;
  mapping(uint32 => uint32) totalOfferForAGivenPriceRate;
  mapping(uint32 => uint32) totalDemandForAGivenPriceRate;
  mapping(address => uint32) supplierEnergyDispatch;
  mapping(address => uint32) consumerEnergyDispatch;
  uint32[] supplierEnergyDispatchToPaymentSettlemt;
  uint32[] consumerEnergyDispatchToPaymentSettlemt;

  uint32 roundMaxRate = 10000;
  uint32 roundMinRate = 0;

  uint32 minAllowedPrice = 0;
  uint32 maxAllowedPrice = 10000;

  uint32 clearingPrice = 0;
  address authorizedEntity;

  constructor(
      address paymentSettlementAddress,
      address energyCoinContractAddress
  ) public {
      authorizedEntity = msg.sender;
      ps = PaymentSettlement(paymentSettlementAddress);
      et = EnergyToken(energyCoinContractAddress);
  }

  //Bidders event recording
  event BiddingInitialized(uint32 startTime, uint32 endTime);

  //New mcp
  event MarketCleared(uint32 price);

  modifier isValidBid(
      uint32 amount,
      uint32 priceRate,
      address addr
  ) {
      require(et.getBalance(addr) >= amount * priceRate); //This also checks whether the user is registered or not because the balance would not be > zero if the users is not registered
      require(minAllowedPrice <= priceRate && priceRate <= maxAllowedPrice);
      _;
  }

  modifier isValidOffer(
      uint32 amount,
      uint32 priceRate,
      address addr
  ) {
      require(et.getSupplierProductionCapacity(addr) >= amount); //This also checks whether the user is registered or not because the capacity would be zero if the users is not registered
      require(minAllowedPrice <= priceRate && priceRate <= maxAllowedPrice);
      _;
  }

  modifier isValidUser(address user) {
      //Check if the user is registered here
      _;
  }

  /*function initializeContract(address _addressOfRTMC) public{
    require(msg.sender==authorizedEntity);
    realTimeMarket = RealTimeMarket(_addressOfRTMC);
}*/

  function initializeBidding() public {
      require(msg.sender == authorizedEntity);
      biddingState = BiddingState.Open;
      marketClearanceState = MarketClearanceState.NotCleared;
      marketResettingState = MarketResettingState.NotReset;
  }

  function submitEnergyOffer(uint32 amount, uint32 priceRate)
      public
      isValidOffer(amount, priceRate, msg.sender)
  {
      // Currently this accepts offer only for one interval
      require(biddingState == BiddingState.Open);
      offers[msg.sender] = EnergyOffer(amount, priceRate);
      totalOfferForAGivenPriceRate[priceRate] += amount;
      suppliers.push(msg.sender);
  }

  function submitEnergyBid(uint32 amount, uint32 priceRate)
      public
      isValidBid(amount, priceRate, msg.sender)
  {
      // Currently this accepts bid only for one interval
      require(biddingState == BiddingState.Open);
      bids[msg.sender] = EnergyBid(amount, priceRate);
      totalDemandForAGivenPriceRate[priceRate] += amount;
      consumers.push(msg.sender);
  }

  //Calculating Market Clearing Price
  function calculateMarkerClearingPrice() public {
      // We assume that the market clearnce is only for one interval
      require(msg.sender == authorizedEntity);
      biddingState = BiddingState.Closed;
      marketClearanceState = MarketClearanceState.Cleared;

      for (uint32 i = 0; i < consumers.length; i++) {
          if (bids[consumers[i]].priceRate > roundMaxRate) {
              roundMaxRate = bids[consumers[i]].priceRate;
          } else if (bids[consumers[i]].priceRate < roundMaxRate) {
              roundMinRate = bids[consumers[i]].priceRate;
          }
      }

      for (uint32 i = 0; i < suppliers.length; i++) {
          if (offers[suppliers[i]].priceRate > roundMaxRate) {
              roundMaxRate = offers[suppliers[i]].priceRate;
          } else if (offers[suppliers[i]].priceRate < roundMaxRate) {
              roundMinRate = offers[suppliers[i]].priceRate;
          }
      }

      uint32 _max = roundMaxRate;
      for (uint32 y = 1; y <= roundMaxRate; y++) {
          totalOfferForAGivenPriceRate[y] += totalOfferForAGivenPriceRate[
              y - 1
          ]; //This is calculating the supply and demand curves
          totalDemandForAGivenPriceRate[
              _max - 1
          ] += totalDemandForAGivenPriceRate[_max];
          _max--;
      }

      for (uint32 v = 0; v <= roundMaxRate; v++) {
          if (
              totalOfferForAGivenPriceRate[v] >=
              totalDemandForAGivenPriceRate[v]
          ) {
              if (
                  totalDemandForAGivenPriceRate[v] >
                  totalOfferForAGivenPriceRate[v - 1]
              ) {
                  clearingPrice = v;
              } else {
                  clearingPrice = v--;
              }

              //Losers/Winners Mapping also add bool T/F, about winner/loser
              for (uint32 q = 0; q < suppliers.length; q++) {
                  if (offers[suppliers[q]].priceRate < clearingPrice) {
                      supplierWinners.push(suppliers[q]);
                      supplierEnergyDispatch[suppliers[q]] = offers[
                          suppliers[q]
                      ].amount;
                      supplierEnergyDispatchToPaymentSettlemt.push(
                          offers[suppliers[q]].amount
                      );
                  } else if (
                      offers[suppliers[q]].priceRate == clearingPrice
                  ) {
                      supplierWinners.push(suppliers[q]);
                      supplierEnergyDispatch[suppliers[q]] = offers[
                          suppliers[q]
                      ].amount;
                      supplierEnergyDispatchToPaymentSettlemt.push(
                          offers[suppliers[q]].amount
                      );
                  } else {
                      supplierLosers.push(suppliers[q]);
                      //  supplierEnergyDispatch[suppliers[q]]= SupplierEnergyDispatch(0,clearingPrice);
                  }
              }

              for (uint32 r = 0; r < consumers.length; r++) {
                  if (bids[consumers[r]].priceRate >= clearingPrice) {
                      consumerWinners.push(consumers[r]);
                      consumerEnergyDispatch[consumers[r]] = bids[
                          consumers[r]
                      ].amount;
                      consumerEnergyDispatchToPaymentSettlemt.push(
                          bids[consumers[r]].amount
                      );
                  } else if (bids[consumers[r]].priceRate == clearingPrice) {
                      consumerWinners.push(consumers[r]);
                      consumerEnergyDispatch[consumers[r]] = offers[
                          consumers[r]
                      ].amount;
                      consumerEnergyDispatchToPaymentSettlemt.push(
                          bids[consumers[r]].amount
                      );
                  } else {
                      consumerLosers.push(consumers[r]);
                      // consumerEnergyDispatch[consumers[r]]= ConsumerEnergyDispatch(0,clearingPrice);
                  }
              }
              emit MarketCleared(clearingPrice);
              break;
          }
      }
  }

  function getMarketClearingPrice() public view returns (uint32) {
      return clearingPrice;
  }

  function getConsumerDispatchedEnergy() public view returns (uint32) {
      return consumerEnergyDispatch[msg.sender];
  }

  function getSupplierDispatchedEnergy() public view returns (uint32) {
      return supplierEnergyDispatch[msg.sender];
  }

  function getAllConsumerDispatchedEnergy()
      public
      view
      returns (uint32[] memory)
  {
      return consumerEnergyDispatchToPaymentSettlemt;
  }

  function getAllSupplierDispatchedEnergy()
      public
      view
      returns (uint32[] memory)
  {
      return supplierEnergyDispatchToPaymentSettlemt;
  }

  function getSuppliers() public view returns (address[] memory) {
      return suppliers;
  }

  function getConsumers() public view returns (address[] memory) {
      return consumers;
  }

  function getSupplierWinners() public view returns (address[] memory) {
      return supplierWinners;
  }

  function getSupplierLosers() public view returns (address[] memory) {
      return supplierLosers;
  }

  function getConsumerWinners() public view returns (address[] memory) {
      return consumerWinners;
  }

  function getConsumerLosers() public view returns (address[] memory) {
      return consumerLosers;
  }

  function getBiddingState()
      public
      view
      returns (BiddingState _biddingState)
  {
      return biddingState;
  }

  function getMarketClearanceState()
      public
      view
      returns (MarketClearanceState _marketClearanceState)
  {
      return marketClearanceState;
  }

  function getMarketResettingState()
      public
      view
      returns (MarketResettingState _marketResettingState)
  {
      return marketResettingState;
  }

  //This function is commented out bcs it is being performed in reset market
  function sendDataToPaymentSettlement() public {
      ps.poolMarketSupplierDispatchData(
          supplierWinners,
          supplierEnergyDispatchToPaymentSettlemt,
          clearingPrice
      );
      ps.poolMarketConsumersDispatchData(
          consumerWinners,
          consumerEnergyDispatchToPaymentSettlemt,
          clearingPrice
      );
  }

  function SendDataAndResetPoolMarket() public {
      // The data has to be sent to Real time contract before it is deleted either in this function or in market clearance

      require(msg.sender == authorizedEntity);
      marketResettingState = MarketResettingState.Reset;
      //Send data to Payment Settlement before deleting the data
      ps.poolMarketSupplierDispatchData(
          supplierWinners,
          supplierEnergyDispatchToPaymentSettlemt,
          clearingPrice
      );
      ps.poolMarketConsumersDispatchData(
          consumerWinners,
          consumerEnergyDispatchToPaymentSettlemt,
          clearingPrice
      );

      for (uint32 i = 0; i < consumers.length; i++) {
          delete bids[consumers[i]];
      }

      for (uint32 i = 0; i < suppliers.length; i++) {
          delete offers[suppliers[i]];
      }

      for (uint32 i = 0; i < supplierWinners.length; i++) {
          delete supplierEnergyDispatch[supplierWinners[i]];
      }

      for (uint32 i = 0; i < consumerWinners.length; i++) {
          delete consumerEnergyDispatch[consumerWinners[i]];
      }

      for (uint32 w = 0; w < roundMaxRate; w++) {
          delete totalOfferForAGivenPriceRate[w];
          delete totalDemandForAGivenPriceRate[w];
      }

      delete suppliers;
      delete consumers;
      delete supplierWinners;
      delete consumerWinners;
      delete supplierLosers;
      delete consumerLosers;
      delete clearingPrice;
      delete supplierEnergyDispatchToPaymentSettlemt;
      delete consumerEnergyDispatchToPaymentSettlemt;
      roundMaxRate = maxAllowedPrice;
      roundMinRate = minAllowedPrice;
  }
}
