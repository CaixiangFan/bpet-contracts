//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

interface IPoolMarket {
  struct DispatchedOffer {
    address supplierAccount;
    uint16 dispatchedAmount;
  }

  function getPoolPrice(uint hour) external view returns(uint16);
  function getDispatchedOffers(uint hour) external view returns(DispatchedOffer[] memory);
}