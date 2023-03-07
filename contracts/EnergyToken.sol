// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/**
  @dev EnergyToken is designed to be a ERC20 stablecoin similar to USDC.
  To buy energy tokens, buyers simply transfers fiat money (e.g., USD) to the market bank account.
  The minter will mint the same amount of energy tokens to buyer's token account.
  To redeem tokens, user submit a request with an amount. Market bank carefully verifies its identity.
  Once verified, it transfers the amount of fiat money to user's bank account and burn the same amount of user's tokens.
   */
contract EnergyToken is ERC20, ERC20Burnable, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    address public owner;

    constructor() ERC20("EnergyToken", "ETK") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        owner = msg.sender;
    }

    function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }
}
