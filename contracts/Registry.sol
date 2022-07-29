//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import { IEnergyToken } from "./IEnergyToken.sol";
import { IRegistry } from "./IRegistry.sol";

/// @title P2P-ET Registry
/// @author Stephen Fan
/// @notice This contract enables users to register register energy suppliers and consumers; 
/// only registered assets can participate energy trading (on-chain permission).
/// @dev who deploys this contract? what priorities does this role/account have?
contract Registry is Ownable, IRegistry {
  uint16 public purchaseRatio;
  uint16 public initialBalance;
  uint16 public totalCapacity;
  address public authorizedEntity;
  IEnergyToken public energyToken;

  mapping(address => Supplier) public registeredSuppliers;
  mapping(address => Consumer) public registeredConsumers;
  address[] public registeredSupplierAccounts;
  address[] public registeredConsumerAccounts;

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

  modifier validAssetId(string memory assetId) {
    require(bytes(assetId).length != 0, "Invalid assetId");
    _;
  }

  function purchaseTokens() public payable {
      require(msg.value >= initialBalance * purchaseRatio, "Ether not enough to register");
      energyToken.mint(msg.sender, msg.value / purchaseRatio);
  }

  /**
  @dev Register a supplier. Each supplier has an address, an unique AssetId, 
  multiple block numbers, offer control parties, total capacity of all blocks 
   */
  function registerSupplier (
    string memory _assetId,
    uint8 _blockAmount,
    uint16 _capacity,
    string memory _offerControl
  ) public payable validAssetId(_assetId){
      purchaseTokens();
      registeredSuppliers[msg.sender] = Supplier(_assetId, _blockAmount, _capacity, _offerControl);
      registeredSupplierAccounts.push(msg.sender);
      totalCapacity += _capacity;
  }

  function registerConsumer (
    string memory _assetId,
    uint16 _load,
    string memory _offerControl
  ) public payable validAssetId(_assetId){
      require(msg.value >= initialBalance * purchaseRatio, "Ether not enough to register");
      energyToken.mint(msg.sender, msg.value / purchaseRatio);
      registeredConsumers[msg.sender] = Consumer(_assetId, _load, _offerControl);
      registeredSupplierAccounts.push(msg.sender);
  }

  function getAllSuppliers () public view override onlyOwner returns (address[] memory) {
    return registeredSupplierAccounts;
  }

  function getAllConsumers () public view override onlyOwner returns (address[] memory) {
    return registeredConsumerAccounts;
  }

  function getSupplier (
    address supplierAddress
    ) override public view returns (Supplier memory) {
    return registeredSuppliers[supplierAddress];
  }

  function getConsumer (
    address consumerAddress
    ) override public view returns (Consumer memory) {
    return registeredConsumers[consumerAddress];
  }

  function isRegisteredSupplier(address account) override public view returns(bool) {
    return bytes(registeredSuppliers[account].assetId).length != 0; 
  }

  function isRegisteredConsumer(address account) override public view returns(bool) {
    return bytes(registeredSuppliers[account].assetId).length != 0;
  }

  function getTotalCapacity() override public view returns(uint16) {
    return totalCapacity;
  }
}