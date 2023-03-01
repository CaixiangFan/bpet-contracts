//SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import {IRegistry} from "./IRegistry.sol";
import {IPoolMarket} from "./IPoolMarket.sol";

contract PoolMarket is Ownable, IPoolMarket {
    enum MarketState {
        Closed,
        Open
    }
    MarketState public marketState;

    /**
  @dev An asset can submit multiple offers each sitting in a block
   */
    struct Offer {
        uint256 amount; //Available MW for dispatch
        uint256 price; //Price in ETK per MW, 1ETK=1US dollor
        uint256 submitMinute; //Epoch time in minute when this offer is submitted or updated
        address supplierAccount; //The account of the offer supplier
        bool isValid; // Indicator if this offer is deleted or not
    }

    /**
  @dev An asset can submit multiple bids
  In the production in Alberta, this bid has not been used to calculate the SMP
   */
    struct Bid {
        uint256 amount;
        uint256 price;
        uint256 submitMinute; //Epoch time in minute when this bid is submitted or updated
        address consumerAccount; //The account of the consumer
    }

    mapping(bytes32 => Offer) public energyOffers; //offerId is the keccak256 Hash value of assetId+blockNumber
    mapping(bytes32 => Bid) public energyBids; //bidId is the keccak256 hash value of assetId
    mapping(uint256 => DispatchedOffer[]) public dispatchedOffers;
    bytes32[] public validOfferIDs; // The valid offers (only offerIDs) used to calculate the merit order
    bytes32[] public validBidIDs; // The valid bids (only bidIDs) used to calculate the merit order

    IRegistry public registryContract;

    // Demand public totalDemand;
    uint256 public minAllowedPrice;
    uint256 public maxAllowedPrice;
    mapping(uint256 => bytes32) public systemMarginalOfferIDs; //map the time in minute in the form of Unix time (uint32) to the system marginal offerID
    mapping(uint256 => uint256) public poolPrices; // map the time in hour in the form of Unix time (uint32) to the poolPrices
    uint256[] public systemMarginalMinutes; //store time in minute in the form of Unix time (uint32) used to index the systemMarginalOfferIDs
    uint256[] public poolPriceHours; //store time in hour in the form of Unix time (uint32) used to index the poolPrices
    mapping(uint256 => uint256) public totalDemands; // map the time in minute in the form of Unix time (uint32) to the total demand
    uint256[] public totalDemandMinutes; // store time in minute in the form of Unix time (uint32) used to index the totalDemands

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
    event OfferDeleted(bytes32 offerId);
    event DemandChanged(
        uint256 indexed oldTotalDemand,
        uint256 indexed newTotalDemand
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

    modifier validOffer(uint256 amount, uint256 price) {
        require(
            price <= maxAllowedPrice && price >= minAllowedPrice,
            "Invalid price"
        );
        // require(amount <= registryContract.getSupplier().capacity, "Offered amount exceeds capacity");
        _;
    }

    modifier validBid(
        uint256 amount,
        uint256 price,
        address bidSender
    ) {
        require(
            price <= maxAllowedPrice && price >= minAllowedPrice,
            "Invalid price"
        );
        // require(energyToken.balanceOf(bidSender) >= amount * price, "Insufficient ETK balance");
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
        marketState = MarketState.Open;
    }

    /**
  @dev submit an offer to the pool market; one account only allows to have one offer in an interval
  the new submitted offer from the same account will update the previous one
   */
    function submitOffer(
        uint8 blockNumber,
        uint256 amount,
        uint256 price
    ) public registeredSupplier(msg.sender) validOffer(amount, price) {
        require(marketState == MarketState.Open, "Market closed");
        require(
            amount <= registryContract.getSupplier(msg.sender).capacity,
            "Offered amount exceeds capacity"
        );
        // generate offerId as the hash value of sender account and blockNumber.
        bytes32 offerId = keccak256(abi.encodePacked(msg.sender, blockNumber));
        uint256 submitMinute = (block.timestamp / 60) * 60;
        energyOffers[offerId] = Offer(
            amount,
            price,
            submitMinute,
            msg.sender,
            true
        );
        // check if offerId exists or not; if yes, update offer content but leaves offerId unchanged
        // if not, push new offerId to offer list
        bool offerIdExists = false;
        for (uint256 i = 0; i < validOfferIDs.length; i++) {
            if (offerId == validOfferIDs[i]) {
                offerIdExists = true;
                break;
            }
        }
        if (!offerIdExists) {
            validOfferIDs.push(offerId);
        }
        emit OfferSubmitted(amount, price, msg.sender);
    }

    /**
  @dev Delete an offer from the offer array. This decreases the supplies and triggers msp calculation
   */
    function deleteOffer(string memory _assetId, uint8 _blockNumber)
        public
        registeredSupplier(msg.sender)
    {
        require(marketState == MarketState.Open, "Bidding closed");
        require(
            keccak256(abi.encode(_assetId)) ==
                keccak256(
                    abi.encode(registryContract.getSupplier(msg.sender).assetId)
                ),
            "Cannot submit offer for others"
        );
        bytes32 offerId = keccak256(abi.encodePacked(_assetId, _blockNumber));
        uint256 submitMinute = (block.timestamp / 60) * 60;
        energyOffers[offerId].submitMinute = submitMinute;
        energyOffers[offerId].isValid = false;
        //retrieve and delete the corresponding element(offerId) from the validOfferIDs array
        for (uint256 i = 0; i < validOfferIDs.length; i++) {
            if (offerId == validOfferIDs[i]) {
                validOfferIDs[i] = validOfferIDs[validOfferIDs.length - 1];
                validOfferIDs.pop();
            }
        }
        emit OfferDeleted(offerId);
    }

    /**
  @dev Submit bid to pool market will change AIL; one account only allows to have one bid in an interval;
  the new submitted bid from the same account will update the previous one, increasing or decreasing
  the AIL.
   */
    function submitBid(uint256 _amount, uint256 _price)
        public
        registeredConsumer(msg.sender)
        validBid(_amount, _price, msg.sender)
    {
        require(marketState == MarketState.Open, "Bidding closed");
        // An account can only maintain a bid state
        // Generate bidId for a submitted bid based on the sender account
        bytes32 bidId = keccak256(abi.encode(msg.sender));
        uint256 currentBidAmount = 0;
        for (uint256 i = 0; i < validBidIDs.length; i++) {
            // check if current bid exists with the same account and different amounts
            if (bidId == validBidIDs[i]) {
                currentBidAmount = energyBids[validBidIDs[i]].amount;
                break;
            }
        }
        uint256 currentTotalDemand = getLatestTotalDemand();
        require(
            currentTotalDemand - currentBidAmount + _amount <=
                registryContract.getTotalCapacity(),
            "Demand exceeds total supply"
        );
        if (currentBidAmount == 0) {
            // if current bid does not exist, add the bidId to the index list
            validBidIDs.push(bidId);
        }
        uint256 submitMinute = (block.timestamp / 60) * 60;
        // update current bid or add a new bid
        energyBids[bidId] = Bid(_amount, _price, submitMinute, msg.sender);
        emit BidSubmitted(_amount, _price, msg.sender);
        updateDemand();
    }

    /**
  @dev Sort current valid offers by price and return a snapshot of merit order list (only offer IDs).
   */
    function getMeritOrderSnapshot() private view returns (bytes32[] memory) {
        bytes32[] memory meritOrderSnapshot = validOfferIDs;
        uint256 len = meritOrderSnapshot.length;
        for (uint256 i = 0; i < len; i++) {
            if (energyOffers[meritOrderSnapshot[i]].isValid) {
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
        }
        return meritOrderSnapshot;
    }

    ///@dev Calculate the system marginal price. This happens regularly through external function calls.
    function calculateSMP() public onlyOwner {
        if (validBidIDs.length > 0 && validOfferIDs.length > 0) {
            //during calculating the SMP, system cannot accept new offers/bids
            //this requires a high-performance blockchain system to process this transaction
            //in a very short time, otherwise services stop for a long period time
            marketState = MarketState.Closed;
            // if (bidUpdated) updateDemand();
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

            // Loop to aggregate all dispatched energy of each account
            for (uint256 j = 0; j < dispatchedOffers[nowHour].length; j++) {
                address supplierAccount = dispatchedOffers[nowHour][j]
                    .supplierAccount;
                uint256 dispatchedAmount = dispatchedOffers[nowHour][j]
                    .dispatchedAmount;
                uint256 dispatchedAt = dispatchedOffers[nowHour][j]
                    .dispatchedAt;
                for (
                    uint256 k = j + 1;
                    k < dispatchedOffers[nowHour].length;
                    k++
                ) {
                    if (
                        dispatchedOffers[nowHour][k].supplierAccount ==
                        supplierAccount
                    ) {
                        uint256 len = dispatchedOffers[nowHour].length;
                        dispatchedAmount += dispatchedOffers[nowHour][k]
                            .dispatchedAmount;
                        dispatchedOffers[nowHour][k] = dispatchedOffers[
                            nowHour
                        ][len - 1];
                        dispatchedOffers[nowHour].pop();
                    }
                }
                dispatchedOffers[nowHour][j] = DispatchedOffer(
                    supplierAccount,
                    dispatchedAmount,
                    dispatchedAt
                );
            }
            marketState = MarketState.Open;
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
        //calculate a smp for that hour timestamp before calculating pool price
        //this makes sure at least one msp exists in that hour
        calculateSMP();
        uint256 poolPrice = 0;
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
        poolPrice = cummulatedPrice / 60;
        poolPrices[hour] = poolPrice;
        poolPriceHours.push(hour);
    }

    /**
  @dev Updates AIL in realtime. This triggers SMP calculation.
  AIL is collected from substations/smart meters.
   */
    function updateDemand() private {
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < validBidIDs.length; i++) {
            totalAmount += energyBids[validBidIDs[i]].amount;
        }
        require(
            totalAmount < registryContract.getTotalCapacity(),
            "Demand exceeds total supply"
        );
        uint256 currMinute = (block.timestamp / 60) * 60;
        uint256 currentTotalDemand = getLatestTotalDemand();
        emit DemandChanged(currentTotalDemand, totalAmount);
        totalDemands[currMinute] = totalAmount;
        totalDemandMinutes.push(currMinute);
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

    function getRegisteredSupplierAssetId()
        public
        view
        returns (string memory)
    {
        return registryContract.getSupplier(msg.sender).assetId;
    }

    function getSystemMarginalMinutes() public view returns (uint256[] memory) {
        return systemMarginalMinutes;
    }

    /**
  @dev Query the marginal price of given minute in unix time. 
   */
    function getSMP(uint256 minute) public view returns (uint256) {
        return energyOffers[systemMarginalOfferIDs[minute]].price;
    }

    /**
  @dev Query the marginal offer of given minute in unix time. 
   */
    function getMarginalOffer(uint256 minute)
        public
        view
        returns (Offer memory)
    {
        return energyOffers[systemMarginalOfferIDs[minute]];
    }

    function getPoolPrice(uint256 hour) public view override returns (uint256) {
        return poolPrices[hour];
    }

    function getValidOfferIDs() public view returns (bytes32[] memory) {
        return validOfferIDs;
    }

    function getValidBidIDs() public view returns (bytes32[] memory) {
        return validBidIDs;
    }

    function getEnergyBid(bytes32 bidId) public view returns (Bid memory) {
        return energyBids[bidId];
    }

    function getEnergyOffer(bytes32 offerId)
        public
        view
        returns (Offer memory)
    {
        return energyOffers[offerId];
    }

    function getDispatchedOffers(uint256 hour)
        public
        view
        override
        returns (DispatchedOffer[] memory)
    {
        return dispatchedOffers[hour];
    }
}
