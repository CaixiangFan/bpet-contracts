//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

interface IPoolMarket {
  struct DispatchedOffer {
    address supplierAccount; //Offer supplier account
    uint dispatchedAmount; //Dispatched amount
    uint dispatchedAt; //Dispatched timestamp
  }

  function getPoolPrice(uint hour) external view returns(uint);
  function getDispatchedOffers(uint hour) external view returns(DispatchedOffer[] memory);
}