//SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

interface IPoolMarket {
    struct DispatchedOffer {
        address supplierAccount; //Offer supplier account
        uint256 dispatchedAmount; //Dispatched amount
        uint256 dispatchedAt; //Dispatched timestamp
    }

    function getPoolPrice(uint256 hour) external view returns (uint256);

    function getDispatchedOffers(uint256 hour)
        external
        view
        returns (DispatchedOffer[] memory);
}
