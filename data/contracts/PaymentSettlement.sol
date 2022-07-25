// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;
import "./EnergyToken.sol";

// All the types should be uint32 or less as web3j does not convert to BIgInteger when it is > uint32
// In this code, i mainly use arrays instead of mapping because web3j does not allow me to send/receive mapping data

contract PaymentSettlement {
    address authorizedEntity;
    EnergyToken et;
    mapping(address => uint32) consumedEnergy;
    mapping(address => uint32) producedEnergy;
    uint32 poolMarketClearingPrice;
    uint32 balancingMarketClearingPrice = 0; //Since we don't have balancing market for now, i set it to 0
    // mapping (address => uint32) netPayment;
    address[] poolMarketSupplierWinners;
    address[] poolMarketConsumerWinners;

    int32[] netPaymentDataArray;
    address[] allWinnersAddresses;
    uint32[] poolMarketSupplierEnergyDispatch; // This array holds the address and the energy dispach for suppliers
    uint32[] poolMarketConsumerEnergyDispatch; // This array holds the address and the energy dispach for consumers

    enum PaymentSettlementState {
        NotSettled,
        Settled
    }
    enum PaymentSettlementResettingState {
        NotReset,
        Reset
    }
    PaymentSettlementState paymentSettlementState;
    PaymentSettlementResettingState paymentSettlementResettingState;

    constructor(address _energyCoinAddress) public {
        et = EnergyToken(_energyCoinAddress);
        authorizedEntity = msg.sender;
    }

    function poolMarketSupplierDispatchData(
        address[] memory _poolMarketSupplierWinners,
        uint32[] memory _poolMarketSupplierEnergyDispatch,
        uint32 _poolMarketClearingPrice
    ) public {
        paymentSettlementState = PaymentSettlementState.NotSettled;
        paymentSettlementResettingState = PaymentSettlementResettingState
            .NotReset;
        poolMarketClearingPrice = _poolMarketClearingPrice;
        poolMarketSupplierEnergyDispatch = _poolMarketSupplierEnergyDispatch;
        poolMarketSupplierWinners = _poolMarketSupplierWinners;
    }

    function poolMarketConsumersDispatchData(
        address[] memory _poolMarketConsumerWinners,
        uint32[] memory _poolMarketConsumerEnergyDispatch,
        uint32 _poolMarketClearingPrice
    ) public {
        poolMarketClearingPrice = _poolMarketClearingPrice;
        poolMarketConsumerEnergyDispatch = _poolMarketConsumerEnergyDispatch;
        poolMarketConsumerWinners = _poolMarketConsumerWinners;
    }

    /*    
    function poolMarketSupplierDispatchData( address[] memory _poolMarketSupplierWinners, uint32 [2][] memory _poolMarketSupplierEnergyDispatch) public {
        require(msg.sender==authorizedEntity);
        poolMarketSupplierEnergyDispatch=_poolMarketSupplierEnergyDispatch;
        poolMarketSupplierWinners=_poolMarketSupplierWinners;
    }
    
    function poolMarketConsumersDispatchData(address[] memory _poolMarketConsumerWinners, uint32 [2][] memory  _poolMarketConsumerEnergyDispatch) public {
        require(msg.sender==authorizedEntity);
        poolMarketConsumerEnergyDispatch=_poolMarketConsumerEnergyDispatch;
        poolMarketConsumerWinners=_poolMarketConsumerWinners;
    }*/

    function smartMeterConsumedEnergy(uint32 consumedAmount) public {
        // How to prevent losers from sending this function?
        consumedEnergy[msg.sender] = consumedAmount;
    }

    function smartMeterProducedEnergy(uint32 producedAmount) public {
        // How to prevent losers from sending this function?
        producedEnergy[msg.sender] = producedAmount;
    }

    function SettlePayment() public {
        //Here we assume that there is only pool market (the others are not implemented yet). Also the settlement is only for one interval
        require(msg.sender == authorizedEntity);
        paymentSettlementState = PaymentSettlementState.Settled;
        /*  for(uint i=0;i<poolMarketConsumerEnergyDispatch.length;i++){
         address consumerAddress= address(uint160(poolMarketConsumerEnergyDispatch[i][0]));
         uint32 poolMarketDispachAmount = poolMarketConsumerEnergyDispatch[i][1];
         uint32 deviation= consumedEnergy[consumerAddress]-poolMarketDispachAmount;
         uint32 netPayment= poolMarketDispachAmount*poolMarketClearingPrice + deviation*balancingMarketClearingPrice;
         uint32 [2] memory x=  [uint32(consumerAddress),netPayment];
         netPaymentDataArray.push(x);
    }
    
    for(uint i=0;i<poolMarketSupplierEnergyDispatch.length;i++){
         address supplierAddress= address(uint160(poolMarketSupplierEnergyDispatch[i][0]));
         uint32 poolMarketDispachAmount = poolMarketSupplierEnergyDispatch[i][1];
         uint32 deviation= poolMarketDispachAmount-producedEnergy[supplierAddress];
         uint32 netPayment= poolMarketDispachAmount*poolMarketClearingPrice - deviation*balancingMarketClearingPrice;
         uint32 [2] memory x=  [uint32(supplierAddress),netPayment];
         netPaymentDataArray.push(x);
    }*/

        for (uint256 i = 0; i < poolMarketConsumerWinners.length; i++) {
            address consumerAddress = poolMarketConsumerWinners[i];
            uint32 poolMarketDispachAmount = poolMarketConsumerEnergyDispatch[
                i
            ];
            // uint32 deviation= consumedEnergy[consumerAddress]-poolMarketDispachAmount;
            uint32 deviation = 0; //for now, i assume the deviation is 0 as there is no consumption and production data
            int32 netPayment = int32(
                poolMarketDispachAmount *
                    poolMarketClearingPrice +
                    deviation *
                    balancingMarketClearingPrice
            );
            netPaymentDataArray.push(netPayment);
            allWinnersAddresses.push(consumerAddress);
        }

        for (uint256 i = 0; i < poolMarketSupplierWinners.length; i++) {
            address supplierAddress = poolMarketSupplierWinners[i];
            uint32 poolMarketDispachAmount = poolMarketSupplierEnergyDispatch[
                i
            ];
            // uint32 deviation= poolMarketDispachAmount-producedEnergy[supplierAddress];
            uint32 deviation = 0; //for now, i assume the deviation is 0 as there is no consumption and production data
            int32 netPayment = int32(
                poolMarketDispachAmount *
                    poolMarketClearingPrice -
                    deviation *
                    balancingMarketClearingPrice
            );
            netPaymentDataArray.push(netPayment);
            allWinnersAddresses.push(supplierAddress);
        }

        //Update Account balances for all userAddress
        et.updateAccountBalances(allWinnersAddresses, netPaymentDataArray);
    }

    function getPoolMarketConsumerWinners()
        public
        view
        returns (address[] memory)
    {
        return poolMarketConsumerWinners;
    }

    function getPoolMarketSupplierWinners()
        public
        view
        returns (address[] memory)
    {
        return poolMarketSupplierWinners;
    }

    function getPoolMarketSupplierEnergyDispatch()
        public
        view
        returns (uint32[] memory)
    {
        return poolMarketSupplierEnergyDispatch;
    }

    function getPoolMarketConsumerEnergyDispatch()
        public
        view
        returns (uint32[] memory)
    {
        return poolMarketConsumerEnergyDispatch;
    }

    function getAllPoolMarketWinners() public view returns (address[] memory) {
        return allWinnersAddresses;
    }

    function getAllNetPayment() public view returns (int32[] memory) {
        return netPaymentDataArray;
    }

    function getPaymentSettlementState()
        public
        view
        returns (PaymentSettlementState _paymentSettlementState)
    {
        return paymentSettlementState;
    }

    function getPaymentSettlementResettingState()
        public
        view
        returns (
            PaymentSettlementResettingState _paymentSettlementResettingState
        )
    {
        return paymentSettlementResettingState;
    }

    function resetPaymentSettlement() public {
        require(msg.sender == authorizedEntity);
        paymentSettlementResettingState = PaymentSettlementResettingState.Reset;

        /*   for (uint32 i=0; i<poolMarketConsumerWinners.length;i++){ //Currently no produced or consumed energy
        delete consumedEnergy[poolMarketConsumerWinners[i]];
    }

  for (uint32 i=0; i<poolMarketSupplierWinners.length;i++){
        delete producedEnergy[poolMarketSupplierWinners[i]];
    }*/

        delete poolMarketSupplierWinners;
        delete poolMarketConsumerWinners;
        delete netPaymentDataArray;
        delete allWinnersAddresses;
        delete poolMarketSupplierEnergyDispatch; // This array holds the address and the energy dispach for suppliers
        delete poolMarketConsumerEnergyDispatch; // This array holds the address and the energy dispach for consumers
    }
}

/*contract EnergyCoin {
    
    function updateAccountBalances(address[] memory _allWinnersAddresses, uint32[] memory _netPaymentDataArray) public {
    }

}*/
