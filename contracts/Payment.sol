//SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IMarket} from "./IMarket.sol";
import {IEnergyToken} from "./IEnergyToken.sol";
import {IRegistry} from "./IRegistry.sol";

contract Payment is Ownable {
    address private marketAccount;
    IEnergyToken private energyToken;
    IMarket private poolMarketContract;
    IRegistry private registryContract;

    modifier registeredSupplier(address account) {
        require(
            registryContract.isRegisteredSupplier(account),
            "Unregistered supplier"
        );
        _;
    }

    modifier registeredConsumer(address account) {
        require(
            registryContract.isRegisteredConsumer(account),
            "Unregistered consumer"
        );
        _;
    }

    constructor(
        address _poolMarketAddress,
        address _etkContractAddress,
        address _registryContractAddress
    ) {
        marketAccount = msg.sender;
        poolMarketContract = IMarket(_poolMarketAddress);
        energyToken = IEnergyToken(_etkContractAddress);
        registryContract = IRegistry(_registryContractAddress);
    }

    /**
  @dev Buyers/consumers approve this contract amount of spending tokens only after service is done, 
  namely the latest hour is the last hour.
   */
    function enableCharge(uint256 _hour) public {
        // Loop to aggregate all dispatched energy of each account
        // should move to the Payment contract

        // for (uint256 j = 0; j < dispatchedOffers[nowHour].length; j++) {
        //     address supplierAccount = dispatchedOffers[nowHour][j]
        //         .supplierAccount;
        //     uint256 dispatchedAmount = dispatchedOffers[nowHour][j]
        //         .dispatchedAmount;
        //     uint256 dispatchedAt = dispatchedOffers[nowHour][j]
        //         .dispatchedAt;
        //     for (
        //         uint256 k = j + 1;
        //         k < dispatchedOffers[nowHour].length;
        //         k++
        //     ) {
        //         if (
        //             dispatchedOffers[nowHour][k].supplierAccount ==
        //             supplierAccount
        //         ) {
        //             uint256 len = dispatchedOffers[nowHour].length;
        //             dispatchedAmount += dispatchedOffers[nowHour][k]
        //                 .dispatchedAmount;
        //             dispatchedOffers[nowHour][k] = dispatchedOffers[
        //                 nowHour
        //             ][len - 1];
        //             dispatchedOffers[nowHour].pop();
        //         }
        //     }
        //     dispatchedOffers[nowHour][j] = DispatchedOffer(
        //         supplierAccount,
        //         dispatchedAmount,
        //         dispatchedAt
        //     );
        // }

        //loop to approve all supplieres their corrresponding energy supply price
        uint256 poolPrice = poolMarketContract.getPoolPrice(_hour);
        uint256 len = poolMarketContract.getDispatchedOffers(_hour).length;

        for (uint256 i = 0; i < len; i++) {
            address account = poolMarketContract
            .getDispatchedOffers(_hour)[i].supplierAccount;
            uint256 amount = poolMarketContract
            .getDispatchedOffers(_hour)[i].dispatchedAmount;
            // approve amonut of ETK/USD for the supplier to charge from the consumer
            energyToken.approve(account, (amount * poolPrice) / 100);
        }
    }

    /**
  @dev Charges from the distribution network for a specific hour. The latest hour is the last hour.
   */
    function charge(
        uint256 _hour,
        uint256 _meteredAmount
    ) public registeredSupplier(msg.sender) {
        uint256 poolPrice = poolMarketContract.getPoolPrice(_hour) / 100;
        // should transfer from smart contract to generator
        energyToken.transferFrom(
            marketAccount,
            msg.sender,
            poolPrice * _meteredAmount
        );
    }

    /**
  @dev Pay ETK to the distribution network for a specific hour. The latest hour is the last hour.
   */
    function pay(
        uint256 _hour,
        uint256 _meteredAmount
    ) public registeredConsumer(msg.sender) {
        uint256 poolPrice = poolMarketContract.getPoolPrice(_hour) / 100;
        // should transfer from buyer to smart contract
        energyToken.transfer(marketAccount, poolPrice * _meteredAmount);
    }
}
