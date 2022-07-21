//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

/// @title P2P-ET Registry
/// @author Stephen Fan
/// @notice This contract enables users to register register energy suppliers and consumers; 
/// only registered assets can participate energy trading (on-chain permission).
/// @dev who deploys this contract? what priorities does this role/account have?
contract Registry{
  // enum MarketType { POOL, BILATERAL }
  struct Supplier {
    bytes32 assetId; // Asset Short Name Identifier
    uint8 blockNumber; // Block Number from 0 to 6
    uint16 capacity; // Energy amount in MWh
    string offerControl; // Offer control parties separated by a semi-colon
  }

  struct Consumer {
    bytes32 assetId;
    uint8 blockNumber;
    uint16 demand;
    string offerControl;
  }

  mapping(address => Supplier) public registeredSuppliers;
  mapping(address => Consumer) public registeredConsumers;
  // MarketType public marketType;
  uint16 public initialBalance;
  address public authorizedEntity;

  constructor(uint16 _initialBalance) {
    initialBalance = _initialBalance;
    authorizedEntity = msg.sender;
  }

  function registerSupplier (
    bytes32 _assetId,
    uint8 _blockNumber,
    uint16 _capacity,
    string memory _offerControl
  ) public {
      require(msg.sender == authorizedEntity, "Cannot register suppliers!");
      registeredSuppliers[msg.sender] = Supplier(_assetId, _blockNumber, _capacity, _offerControl);
  }

  function registerConsumer (
    bytes32 _assetId,
    uint8 _blockNumber,
    uint16 _demand,
    string memory _offerControl
  ) public {
      require(msg.sender == authorizedEntity, "Cannot register consumers!");
      registeredConsumers[msg.sender] = Consumer(_assetId, _blockNumber, _demand, _offerControl);
  }
}