//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IEnergyToken is IERC20 {
    function mint(address, uint256) external;
    function burnFrom(address, uint256) external;
}

/// @title P2P-ET Registry
/// @author Stephen Fan
/// @notice This contract enables users to register register energy suppliers and consumers; 
/// only registered assets can participate energy trading (on-chain permission).
/// @dev who deploys this contract? what priorities does this role/account have?
contract Registry is Ownable{
  // enum MarketType { POOL, BILATERAL }
  uint16 public purchaseRatio;
  uint16 public initialBalance;
  address public authorizedEntity;
  IEnergyToken public energyToken;

  struct Supplier {
    string assetId; // Asset Short Name Identifier
    uint8 blockNumber; // Block Number from 0 to 6
    uint16 capacity; // Energy amount in MWh
    string offerControl; // Offer control parties separated by a semi-colon
  }

  struct Consumer {
    string assetId;
    uint8 blockNumber;
    uint16 demand;
    string offerControl;
  }

  mapping(address => Supplier) public registeredSuppliers;
  mapping(address => Consumer) public registeredConsumers;
  // MarketType public marketType;

  constructor(
    uint16 _initialBalance,
    uint16 _purchaseRatio,
    address _energyTokenAddress
    ) {
    initialBalance = _initialBalance;
    purchaseRatio = _purchaseRatio;
    authorizedEntity = msg.sender;
    energyToken = IEnergyToken(_energyTokenAddress);
  }

  function purchaseTokens() public payable {
      require(msg.value >= initialBalance * purchaseRatio, "Ether not enough to register");
      energyToken.mint(msg.sender, msg.value / purchaseRatio);
  }

  function registerSupplier (
    string memory _assetId,
    uint8 _blockNumber,
    uint16 _capacity,
    string memory _offerControl
  ) public payable{
      // require(msg.value >= initialBalance * purchaseRatio, "Ether not enough to register");
      // energyToken.mint(msg.sender, msg.value / purchaseRatio);
      purchaseTokens();
      registeredSuppliers[msg.sender] = Supplier(_assetId, _blockNumber, _capacity, _offerControl);
  }

  function registerConsumer (
    string memory _assetId,
    uint8 _blockNumber,
    uint16 _demand,
    string memory _offerControl
  ) public payable {
      require(msg.value >= initialBalance * purchaseRatio, "Ether not enough to register");
      energyToken.mint(msg.sender, msg.value / purchaseRatio);
      registeredConsumers[msg.sender] = Consumer(_assetId, _blockNumber, _demand, _offerControl);
  }

  function getOwnSupplier () public view returns (Supplier memory) {
    return registeredSuppliers[msg.sender];
  }

  function getOwnConsumer () public view returns (Consumer memory) {
    return registeredConsumers[msg.sender];
  }

  function getSupplier (
    address supplierAddress
    ) public view onlyOwner returns (Supplier memory) {
    return registeredSuppliers[supplierAddress];
  }

  function getConsumer (
    address consumerAddress
    ) public view onlyOwner returns (Consumer memory) {
    return registeredConsumers[consumerAddress];
  }
}