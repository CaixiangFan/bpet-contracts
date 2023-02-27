//SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

interface IRegistry {
    struct Supplier {
        address account; //Account address
        string assetId; // Asset Short Name Identifier
        uint8 blockAmount; // Block amount from 1 to 7
        uint16 capacity; // Energy amount in MWh
        string offerControl; // Offer control parties separated by a semi-colon
    }

    struct Consumer {
        address account; //Account address
        string assetId;
        uint16 load;
        string offerControl;
    }

    function getSupplier(address) external view returns (Supplier memory);

    function getConsumer(address) external view returns (Consumer memory);

    function getAllSuppliers() external view returns (address[] memory);

    function getAllConsumers() external view returns (address[] memory);

    function isRegisteredSupplier(address) external view returns (bool);

    function isRegisteredConsumer(address) external view returns (bool);

    function getTotalCapacity() external view returns (uint16);
}
