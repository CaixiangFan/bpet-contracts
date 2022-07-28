//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

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