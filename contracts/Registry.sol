//SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IRegistry} from "./IRegistry.sol";

/// @title P2P-ET Registry
/// @author Stephen Fan
/// @notice This contract enables users to register register energy suppliers and consumers;
/// only registered assets can participate energy trading (on-chain permission).
/// @dev who deploys this contract? what priorities does this role/account have?
contract Registry is Ownable, IRegistry {
    uint16 public totalCapacity;
    address public authorizedEntity;

    mapping(address => Supplier) public registeredSuppliers;
    mapping(address => Consumer) public registeredConsumers;
    address[] public registeredSupplierAccounts;
    address[] public registeredConsumerAccounts;

    constructor() // uint16 _purchaseRatio
    {
        // purchaseRatio = _purchaseRatio;
        authorizedEntity = msg.sender;
    }

    modifier validAssetId(string memory assetId) {
        require(bytes(assetId).length != 0, "Invalid assetId");
        _;
    }

    /**
  @dev Register a supplier. Each supplier has an address, an unique AssetId, 
  multiple block numbers, offer control parties, total capacity of all blocks 
   */
    function registerSupplier(
        address _account,
        string memory _assetId,
        uint8 _blockAmount,
        uint16 _capacity,
        string memory _offerControl
    ) public payable validAssetId(_assetId) {
        require(
            bytes(registeredSuppliers[_account].assetId).length == 0,
            "Account has already registered"
        );
        registeredSuppliers[_account] = Supplier(
            _account,
            _assetId,
            _blockAmount,
            _capacity,
            _offerControl
        );
        registeredSupplierAccounts.push(_account);
        totalCapacity += _capacity;
    }

    function registerConsumer(
        address _account,
        string memory _assetId,
        uint16 _load,
        string memory _offerControl
    ) public payable validAssetId(_assetId) {
        require(
            bytes(registeredConsumers[_account].assetId).length == 0,
            "Account has already registered"
        );
        registeredConsumers[_account] = Consumer(
            _account,
            _assetId,
            _load,
            _offerControl
        );
        registeredConsumerAccounts.push(_account);
    }

    function getAllSuppliers()
        public
        view
        override
        onlyOwner
        returns (address[] memory)
    {
        return registeredSupplierAccounts;
    }

    function getAllConsumers()
        public
        view
        override
        onlyOwner
        returns (address[] memory)
    {
        return registeredConsumerAccounts;
    }

    function getSupplier(
        address supplierAddress
    ) public view override returns (Supplier memory) {
        // require(supplierAddress == msg.sender || msg.sender == authorizedEntity, "Cannot query others");
        return registeredSuppliers[supplierAddress];
    }

    function getConsumer(
        address consumerAddress
    ) public view override returns (Consumer memory) {
        // require(consumerAddress == msg.sender || msg.sender == authorizedEntity, "Cannot query others");
        return registeredConsumers[consumerAddress];
    }

    function isRegisteredSupplier(
        address account
    ) public view override returns (bool) {
        return bytes(registeredSuppliers[account].assetId).length != 0;
    }

    function isRegisteredConsumer(
        address account
    ) public view override returns (bool) {
        return bytes(registeredConsumers[account].assetId).length != 0;
    }

    function getTotalCapacity() public view override returns (uint16) {
        return totalCapacity;
    }

    function deleteSupplier(address _accountToFindAndDelete) public onlyOwner {
        if (
            bytes(registeredSuppliers[_accountToFindAndDelete].assetId)
                .length != 0
        ) {
            totalCapacity -= registeredSuppliers[_accountToFindAndDelete]
                .capacity;
            for (uint256 i = 0; i < registeredSupplierAccounts.length; i++) {
                if (registeredSupplierAccounts[i] == _accountToFindAndDelete) {
                    delete registeredSupplierAccounts[i];
                }
            }
            delete registeredSuppliers[_accountToFindAndDelete];
        }
    }

    function deleteConsumer(address _accountToFindAndDelete) public onlyOwner {
        if (
            bytes(registeredConsumers[_accountToFindAndDelete].assetId)
                .length != 0
        ) {
            for (uint256 i = 0; i < registeredConsumerAccounts.length; i++) {
                if (registeredConsumerAccounts[i] == _accountToFindAndDelete) {
                    delete registeredConsumerAccounts[i];
                }
            }
            delete registeredConsumers[_accountToFindAndDelete];
        }
    }
}
