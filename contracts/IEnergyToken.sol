//SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IEnergyToken is IERC20 {
    function mint(address, uint256) external;

    function burnFrom(address, uint256) external;
}
