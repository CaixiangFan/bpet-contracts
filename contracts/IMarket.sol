//SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

interface IMarket {
    struct DispatchedOffer {
        address supplierAccount; //Offer supplier account
        uint256 dispatchedAmount; //Dispatched amount
        // uint256 price; // offer price
        uint256 dispatchedAt; //Dispatched timestamp
    }
  //   /**
  //   @dev An asset can submit multiple offers each sitting in a block
  //  */
  //   struct Offer {
  //       uint256 amount; //Available MW for dispatch
  //       uint256 price; //Price in ETK cents per MW, 1ETK=1US dollor
  //       uint256 submitMinute; //Epoch time in minute when this offer is submitted or updated
  //       address supplierAccount; //The account of the offer supplier
  //       uint256 dispatchedAt; //Epoch time in minute when this offer is dispatched
  //   }

    function getPoolPrice(uint256 hour) external view returns (uint256);

    function getDispatchedOffers(uint256 hour)
        external
        view
        returns (DispatchedOffer[] memory);
}
