//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IPoolMarket } from "./IPoolMarket.sol";
import { IEnergyToken } from "./IEnergyToken.sol";
import { IRegistry } from "./IRegistry.sol";

contract Payment is Ownable {
  address private marketAccount;
  IEnergyToken public energyToken;
  IPoolMarket public poolMarketContract;
  IRegistry public registryContract;

  modifier registeredSupplier(address account) {
    require(registryContract.isRegisteredSupplier(account), "Unregistered supplier");
    _;
  }

  modifier registeredConsumer(address account) {
    require(registryContract.isRegisteredConsumer(account), "Unregistered consumer");
    _;
  }
  constructor (
    address _poolMarketAddress,
    address _etkContractAddress,
    address _registryContractAddress
  ) {
    marketAccount = msg.sender;
    poolMarketContract = IPoolMarket(_poolMarketAddress);
    energyToken = IEnergyToken(_etkContractAddress);
    registryContract = IRegistry(_registryContractAddress);
  }

  /**
  @dev Enable suppliers to charge from network/market only after service is done, namely the latest hour is the last hour.
   */
  function enableCharge(uint _hour) public onlyOwner{
    //loop to approve all supplieres their corrresponding energy supply price
    uint poolPrice = poolMarketContract.getPoolPrice(_hour);
    uint len = poolMarketContract.getDispatchedOffers(_hour).length;
    
    for (uint i = 0; i < len; i++) {
      address account = poolMarketContract.getDispatchedOffers(_hour)[i].supplierAccount;
      uint amount = poolMarketContract.getDispatchedOffers(_hour)[i].dispatchedAmount;
      energyToken.approve(account, amount * poolPrice);
    }
  }

  /**
  @dev Charges from the distribution network for a specific hour. The latest hour is the last hour.
   */
  function charge(uint _hour, uint _meteredAmount) public registeredSupplier(msg.sender){
    uint poolPrice = poolMarketContract.getPoolPrice(_hour);
    // should transfer from smart contract to generator
    energyToken.transferFrom(marketAccount, msg.sender, poolPrice * _meteredAmount);
  }

  /**
  @dev Pay EKT to the distribution network for a specific hour. The latest hour is the last hour.
   */
  function pay(uint _hour, uint _meteredAmount) public registeredConsumer(msg.sender){
    uint poolPrice = poolMarketContract.getPoolPrice(_hour);
    // should transfer from buyer to smart contract
    energyToken.transfer(marketAccount, poolPrice * _meteredAmount);
  }
}