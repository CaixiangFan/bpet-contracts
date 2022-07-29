//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

interface IPoolMarket {
  struct DispatchedOffer {
    address supplierAccount; //Offer supplier account
    uint16 dispatchedAmount; //Dispatched amount
    uint256 dispatchedAt; //Dispatched timestamp
  }

  function getPoolPrice(uint hour) external view returns(uint16);
  function getDispatchedOffers(uint hour) external view returns(DispatchedOffer[] memory);
}