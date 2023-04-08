//SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IRegistry} from "./IRegistry.sol";
import {IMarket} from "./IMarket.sol";

contract PoolMarket is Ownable, IMarket {
    /**
  @dev An asset can submit multiple offers each sitting in a block
   */
    struct Offer {
        uint256 amount; //Available MW for dispatch
        uint256 price; //Price in ETK cents per MW, 1ETK=1US dollor
        uint256 submitMinute; //Epoch time in minute when this offer is submitted or updated
        address supplierAccount; //The account of the offer supplier
    }

    /**
  @dev An asset can submit multiple bids
  In the production in Alberta, this bid has not been used to calculate the SMP
   */
    struct Bid {
        uint256 amount;
        uint256 price; //Price in ETK cents per MW, 1ETK=1US dollor
        uint256 submitMinute; //Epoch time in minute when this bid is submitted or updated
        address consumerAccount; //The account of the consumer
    }

    // For Alberta market, offers are submitted at the beginning of hour and not allowed to change;
    // while bids can be submitted and updated anytime in an hour
    mapping(bytes32 => Offer) public energyOffers; //offerId is the keccak256 Hash value of account+blockNumber
    mapping(address => uint256[]) private bidHours; // an account has bids in the list of hours in unix time
    mapping(uint256 => Bid[]) private energyBids; // energy bids of an hour in unix time
    mapping(uint256 => DispatchedOffer[]) private dispatchedOffers; // key is the dispatched hour in unix time 
    bytes32[] private validOfferIDs; // The valid offers (only offerIDs) used to calculate the merit order

    IRegistry internal registryContract;

    uint256 public minAllowedPrice;
    uint256 public maxAllowedPrice;
    mapping(uint256 => bytes32) public systemMarginalOfferIDs; //map the time in minute in the form of Unix time to the system marginal offerID
    mapping(uint256 => uint256) private poolPrices; // map the time in hour in the form of Unix time to the poolPrices
    uint256[] private systemMarginalMinutes; //store time in minute in the form of Unix time used to index the systemMarginalOfferIDs
    uint256[] private poolPriceHours; //store time in hour in the form of Unix time used to index the poolPrices
    mapping(uint256 => uint256) public totalDemands; // map the time in minute in the form of Unix time to the total demand
    uint256[] private totalDemandMinutes; // store time in minute in the form of Unix time used to index the totalDemands

    event OfferSubmitted(
        uint256 indexed amount,
        uint256 indexed price,
        address sender
    );
    event BidSubmitted(
        uint256 indexed amount,
        uint256 indexed price,
        address sender
    );

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

    modifier validOffer(
        address account,
        uint256 amount,
        uint256 price
    ) {
        require(
            price <= maxAllowedPrice && price >= minAllowedPrice,
            "Invalid price"
        );
        require(
            amount >= 0 &&
                amount <= registryContract.getSupplier(account).capacity,
            "Invalid amount"
        );
        _;
    }
    constructor(
        address _registryContractAddress,
        uint256 _minAllowedPrice,
        uint256 _maxAllowedPrice
    ) {
        registryContract = IRegistry(_registryContractAddress);
        minAllowedPrice = _minAllowedPrice;
        maxAllowedPrice = _maxAllowedPrice;
    }

    /**
  @dev submit an offer to the pool market; one account only allows to have one offer in an interval
  the new submitted offer from the same account will update the previous one
   */
    function submitOffer(
        uint8 blockNumber,
        uint256 amount,
        uint256 price
    )
        public
        registeredSupplier(msg.sender)
        validOffer(msg.sender, amount, price)
    {
        // generate offerId as the value keccak256(senderAccount, blockNumber)
        // blockNumber is an int representing identical price and amount of this supplier.
        bytes32 offerId = keccak256(abi.encodePacked(msg.sender, blockNumber));
        // if offerId does not exist, add new offerId to the offer list
        if (energyOffers[offerId].submitMinute == 0)
            validOfferIDs.push(offerId);
        energyOffers[offerId] = Offer(
            amount,
            price,
            (block.timestamp / 60) * 60,
            msg.sender
        );
        emit OfferSubmitted(amount, price, msg.sender);
    }

    /**
  @dev Submit bid to pool market will change AIL; one account only allows to have one bid in an interval;
  the new submitted bid from the same account will update the previous one, increasing or decreasing
  the AIL.
   */
    function submitBid(
        uint256 _amount,
        uint256 _price
    )
        public
        registeredConsumer(msg.sender)
    {
        require(
            _price <= maxAllowedPrice && _price >= minAllowedPrice,
            "Invalid price"
        );
        uint256 currHour = (block.timestamp / 3600) * 3600;
        uint256 currMinute = (block.timestamp / 60) * 60;
        // update demands
        uint256 currAmount = 0; // current bid amount of this account
        uint256 bidHoursLen = bidHours[msg.sender].length;
        if (bidHoursLen > 0 && bidHours[msg.sender][bidHoursLen-1] == currHour) {
          uint256 currHourBidsLen = energyBids[currHour].length;
          for (uint256 i = currHourBidsLen - 1; i >= 0; i --) {
            if (energyBids[currHour][i].consumerAccount == msg.sender) {
              currAmount = energyBids[currHour][i].amount;
              break;
            }
          }
        } else {
          // if current bid hour does not exist, add current hour to the index list
          bidHours[msg.sender].push(currHour);
        }
        uint256 totalAmount = getLatestTotalDemand();
        // reset total demand in a new hour
        if (energyBids[currHour].length == 0) totalAmount = 0;
        unchecked {
          totalAmount = totalAmount + _amount;
          require(totalAmount >= currAmount, "Overflow max uint256");
          totalAmount = totalAmount - currAmount;
        }
        
        require(
            totalAmount <= registryContract.getTotalCapacity(),
            "Demand exceeds total supply"
        );
        totalDemands[currMinute] = totalAmount;
        totalDemandMinutes.push(currMinute);

        // add a new bid
        energyBids[currHour].push(Bid(
            _amount,
            _price,
            currMinute,
            msg.sender
        ));
        emit BidSubmitted(_amount, _price, msg.sender);
    }

    /**
  @dev Sort current valid offers by price and return a snapshot of merit order list (only offer IDs).
   */
    function getMeritOrderSnapshot() private view returns (bytes32[] memory) {
        bytes32[] memory meritOrderSnapshot = validOfferIDs;
        uint256 len = meritOrderSnapshot.length;
        for (uint256 i = 0; i < len; i++) {
            for (uint256 j = i + 1; j < len; j++) {
                if (
                    energyOffers[meritOrderSnapshot[i]].price >
                    energyOffers[meritOrderSnapshot[j]].price
                ) {
                    bytes32 temp = meritOrderSnapshot[i];
                    meritOrderSnapshot[i] = meritOrderSnapshot[j];
                    meritOrderSnapshot[j] = temp;
                }
            }
        }
        return meritOrderSnapshot;
    }

    ///@dev Calculate the system marginal price. This happens regularly through external function calls.
    function calculateSMP() public onlyOwner {
        uint256 currHour = (block.timestamp / 3600) * 3600;
        if (energyBids[currHour].length > 0 && validOfferIDs.length > 0) {
            uint256 aggregatedOfferAmount = 0;
            // get the latest total demand
            uint256 latestTotalDemand = getLatestTotalDemand();
            // get the ascending sorted energyOffers (offerId)
            bytes32[] memory meritOrderOfferIDs = getMeritOrderSnapshot();
            uint256 nowHour = (block.timestamp / 3600) * 3600;
            for (uint256 i = 0; i < meritOrderOfferIDs.length; i++) {
                address supplierAccount = energyOffers[meritOrderOfferIDs[i]]
                    .supplierAccount;
                uint256 amount = energyOffers[meritOrderOfferIDs[i]].amount;
                aggregatedOfferAmount += amount;
                dispatchedOffers[nowHour].push(
                    DispatchedOffer(supplierAccount, amount, block.timestamp)
                );
                //use the merit order effect to calculate the SMP,
                if (aggregatedOfferAmount >= latestTotalDemand) {
                    uint256 nowMinute = (block.timestamp / 60) * 60;
                    systemMarginalOfferIDs[nowMinute] = meritOrderOfferIDs[i];
                    systemMarginalMinutes.push(nowMinute);
                    break;
                }
            }
        }
    }

    /**
  @dev Calculated the weighted pool price. 
  In the backend, set time intervals to call calculatePoolPrice each hour.
  At the beginning of each hour, calculateSMP must be executed.
  Params: hour is the hour beginning of the calculation duration
   */
    function calculatePoolPrice(uint256 hour) public onlyOwner {
        require(hour < block.timestamp, "Hour is not valid");
        uint256 cummulatedPrice = 0;
        for (uint256 i = 0; i < systemMarginalMinutes.length; i++) {
            uint256 timestamp = systemMarginalMinutes[i];
            // condition: in the previous hour
            if (timestamp >= hour && timestamp < hour + 3600) {
                uint256 price = energyOffers[systemMarginalOfferIDs[timestamp]]
                    .price;
                uint256 durationMinutes = 0;
                if (
                    (i < systemMarginalMinutes.length - 1) &&
                    (systemMarginalMinutes[i + 1] < hour + 3600)
                ) {
                    durationMinutes =
                        (systemMarginalMinutes[i + 1] -
                            systemMarginalMinutes[i]) /
                        60;
                } else {
                    durationMinutes =
                        60 -
                        (systemMarginalMinutes[i] - hour) /
                        60;
                }
                cummulatedPrice += price * durationMinutes;
            }
        }
        poolPrices[hour] = cummulatedPrice / 60;
        poolPriceHours.push(hour);
    }

    /**
  @dev Get a snapshot of current total demand.
  In reality, AIL might be collected from substations/smart meters.
   */
    function getLatestTotalDemand() public view returns (uint256) {
        uint256 demandsLength = totalDemandMinutes.length;
        if (demandsLength > 0) {
            return
                totalDemands[totalDemandMinutes[totalDemandMinutes.length - 1]];
        }
        return 0;
    }

    function getPoolpriceHours() public view returns (uint256[] memory) {
        return poolPriceHours;
    }

    function getSystemMarginalMinutes() public view returns (uint256[] memory) {
        return systemMarginalMinutes;
    }

    /**
  @dev Query the marginal price of the given minute in unix time. 
   */
    function getSMP(uint256 minute) public view returns (uint256) {
        return energyOffers[systemMarginalOfferIDs[minute]].price;
    }

    /**
  @dev Query the marginal offer of given minute in unix time. 
   */
    function getMarginalOffer(
        uint256 minute
    ) public view returns (Offer memory) {
        return energyOffers[systemMarginalOfferIDs[minute]];
    }

    function getPoolPrice(uint256 hour) public view override returns (uint256) {
        return poolPrices[hour];
    }

    function getValidOfferIDs() public view returns (bytes32[] memory) {
        return validOfferIDs;
    }

    function getBidHours() external view returns (uint256[] memory) {
      return bidHours[msg.sender];
    }

    function getEnergyBids(uint256 hour) external view returns(Bid[] memory) {
      return energyBids[hour];
    }

    function getTotalDemandMinutes() public view returns (uint256[] memory) {
        return totalDemandMinutes;
    }

    function getDispatchedOffers(
        uint256 hour
    ) public view override returns (DispatchedOffer[] memory) {
        return dispatchedOffers[hour];
    }
}
