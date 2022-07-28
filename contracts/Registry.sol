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
  uint16 public totalCapacity;
  address public authorizedEntity;
  IEnergyToken public energyToken;

  struct Supplier {
    string assetId; // Asset Short Name Identifier
    uint8 blockAmount; // The amount of blocks from 1 to 7
    uint16 capacity; // The total capacity of this generator in MW
    string offerControl; // Offer control parties separated by a semi-colon
  }

  struct Consumer {
    string assetId;
    uint16 load;
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

  function isRegisteredSupplier() public view returns(bool) {
    return bytes(registeredSuppliers[msg.sender].assetId).length != 0; 
  }

  function isRegisteredConsumer() public view returns(bool) {
    return bytes(registeredSuppliers[msg.sender].assetId).length != 0;
  }

  function getTotalCapacity() public view returns(uint16) {
    return totalCapacity;
  }
}