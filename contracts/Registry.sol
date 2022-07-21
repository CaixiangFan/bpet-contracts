//SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

/// @title P2P-ET Registry
/// @author Stephen Fan
/// @notice This contract enables users to register register energy suppliers and consumers; 
/// only registered assets can participate energy trading (on-chain permission).
/// @dev who deploys this contract? what priorities does this role/account have?
contract AESORegistry{
  enum MarketType { POOL, BILATERAL }
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
  MarketType public marketType;

  constructor() public {

  }

  function registerSuppliers(
      address[] memory addresses,
      uint32 initialBalance,
      uint32 productionCapacity
  ) public {
      // require(msg.sender == authorizedEntity);
      // for (uint256 i = 0; i < addresses.length; i++) {
      //     // registeredProducers.push(addresses[i]);
      //     //  allRegisteredUsers.push(addresses[i]);
      //     _balanceOf[addresses[i]] = initialBalance;
      //     _suppplierProductionCapacity[addresses[i]] = productionCapacity;
      // }
  }

  function registerConsumers(
      address[] memory addresses,
      uint32 initialBalance
  ) public {
      // require(msg.sender == authorizedEntity);
      // for (uint256 i = 0; i < addresses.length; i++) {
      //     //  registeredConsumers.push(addresses[i]);
      //     //  allRegisteredUsers.push(addresses[i]);
      //     _balanceOf[addresses[i]] = initialBalance;
      // }
  }

}