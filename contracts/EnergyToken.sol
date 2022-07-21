// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract EnergyToken is ERC20, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    constructor() ERC20("EnergyToken", "ETK") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }

    function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }
}
// contract EnergyToken {
//   uint _test;
//   uint32 _totalSupply;
//   uint32 _decimals;
//   string _symbol;
//   string _name;
//   mapping(address => uint32) _balanceOf;
//   mapping(address => uint32) _suppplierProductionCapacity;
//   mapping(address => mapping(address => uint32)) _allowances;
//   address authorizedEntity;
//   uint32 _exchangeRate;

//   constructor(
//       string memory name,
//       string memory symbol,
//       uint32 decimals,
//       uint32 totalSupply,
//       uint32 exchangeRate
//   ) public {
//       _symbol = symbol;
//       _name = name;
//       _decimals = decimals;
//       _totalSupply = totalSupply;
//       _balanceOf[msg.sender] = totalSupply;
//       authorizedEntity = msg.sender;
//       _exchangeRate = exchangeRate;
//   }

//   function registerProducers(
//       address[] memory addresses,
//       uint32 initialBalance,
//       uint32 productionCapacity
//   ) public {
//       require(msg.sender == authorizedEntity);
//       for (uint256 i = 0; i < addresses.length; i++) {
//           // registeredProducers.push(addresses[i]);
//           //  allRegisteredUsers.push(addresses[i]);
//           _balanceOf[addresses[i]] = initialBalance;
//           _suppplierProductionCapacity[addresses[i]] = productionCapacity;
//       }
//   }

//   function registerConsumers(
//       address[] memory addresses,
//       uint32 initialBalance
//   ) public {
//       require(msg.sender == authorizedEntity);
//       for (uint256 i = 0; i < addresses.length; i++) {
//           //  registeredConsumers.push(addresses[i]);
//           //  allRegisteredUsers.push(addresses[i]);
//           _balanceOf[addresses[i]] = initialBalance;
//       }
//   }

//   function buyEnergyCoin() public payable {
//       if (msg.value < _exchangeRate) revert();
//       _balanceOf[msg.sender] = uint32(msg.value / _exchangeRate);
//   }

//   function updateAccountBalances(
//       address[] memory winnersAddresses,
//       int32[] memory netPaymentData
//   ) public {
//       // require (msg.sender==authorizedEntity); The message is coming from Payment settlement Contract. So no need to Specify this requirement
//       //Update accounts balances for all users
//       for (uint256 i = 0; i < winnersAddresses.length; i++) {
//           if (netPaymentData[i] < 0) {
//               _balanceOf[winnersAddresses[i]] -= uint32(netPaymentData[i]);
//           } else {
//               _balanceOf[winnersAddresses[i]] += uint32(netPaymentData[i]);
//           }
//       }
//   }

//   function getBalance(address _addr) public view returns (uint32) {
//       return _balanceOf[_addr];
//   }

//   function getSupplierProductionCapacity(address _addr)
//       public
//       view
//       returns (uint32)
//   {
//       return _suppplierProductionCapacity[_addr];
//   }

//   function getMyOwnBalance() public view returns (uint32) {
//       return uint32(_balanceOf[msg.sender]);
//   }

//   function setBalance(address _addr, uint32 _value) public returns (bool) {
//       // require (msg.sender==authorizedEntity); The message is coming from Payment settlement Contract. I am not sure how to secure it for now
//       _balanceOf[_addr] += _value;
//       return true;
//   }

//   function transfer(address _to, uint32 _value) public returns (bool) {
//       if (_value > 0 && _value <= _balanceOf[msg.sender]) {
//           _balanceOf[msg.sender] = _balanceOf[msg.sender].sub(_value);
//           _balanceOf[_to] = _balanceOf[_to].add(_value);
//           return true;
//       }
//       return false;
//   }

//   function transferFrom(
//       address _from,
//       address _to,
//       uint32 _value
//   ) public returns (bool) {
//       if (
//           _allowances[_from][msg.sender] > 0 &&
//           _value > 0 &&
//           _allowances[_from][msg.sender] >= _value &&
//           _balanceOf[_from] >= _value
//       ) {
//           _balanceOf[_from] = _balanceOf[_from].sub(_value);
//           _balanceOf[_to] = _balanceOf[_to].add(_value);
//           _allowances[_from][msg.sender] -= _value;
//           return true;
//       }
//       return false;
//   }

//   function approve(address _spender, uint32 _value) public returns (bool) {
//       _allowances[msg.sender][_spender] = _value;
//       return true;
//   }

//   function allowance(address _owner, address _spender)
//       public
//       view
//       returns (uint256)
//   {
//       return _allowances[_owner][_spender];
//   }
// }
