import { expect } from "chai";
import { BigNumber, Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers, waffle } from "hardhat";
import { EnergyToken, Registry, PoolMarket } from "../typechain";
import { isAddress } from "ethers/lib/utils";

function convertBigNumberToNumber(value: BigNumber): number {
  const decimals = 18;
  return Math.round(Number(ethers.utils.formatEther(value)) * 10 ** decimals);
}

function convertNumberToBigNumber(value: number): BigNumber {
  const decimals = 18;
  return ethers.utils.parseEther(String(value));
}

describe("Testing PoolMarket Contract", () => {
  let registryContract: Contract;
  let etkContract: Contract;
  let poolMarketContract: Contract;
  let accounts: SignerWithAddress[];
  let provider = waffle.provider;

  beforeEach(async () => {
    accounts = await ethers.getSigners();
    const [
      etkContractFactory,
      registryContractFactory,
      poolMarketContractFactory,
    ] = await Promise.all([
      ethers.getContractFactory("EnergyToken"),
      ethers.getContractFactory("Registry"),
      ethers.getContractFactory("PoolMarket"),
    ]);
    etkContract = await etkContractFactory.deploy();
    await etkContract.deployed();

    registryContract = await registryContractFactory.deploy();
    await registryContract.deployed();

    const minterRole = await etkContract.MINTER_ROLE();
    const minterRoleTx = await etkContract.grantRole(
      minterRole,
      registryContract.address
    );
    await minterRoleTx.wait();

    poolMarketContract = await poolMarketContractFactory.deploy(
      registryContract.address,
      0,
      100000
    );

    await poolMarketContract.deployed();

    const tx1 = await registryContract
      .connect(accounts[1])
      .registerSupplier(
        accounts[1].address,
        "ENG01",
        2,
        300,
        "Albera Energy Ltd."
      );
    await tx1.wait(1);

    const tx2 = await registryContract
      .connect(accounts[2])
      .registerSupplier(
        accounts[2].address,
        "ENG02",
        3,
        300,
        "Albera Energy Ltd."
      );
    await tx2.wait(1);

    const tx3 = await registryContract
      .connect(accounts[3])
      .registerSupplier(
        accounts[3].address,
        "ENG03",
        4,
        300,
        "Albera Energy Ltd."
      );
    await tx3.wait(1);

    const [tx4, tx5] = await Promise.all([
      registryContract
        .connect(accounts[8])
        .registerConsumer(
          accounts[8].address,
          "FACTORY1",
          500,
          "Alberta Factory1 Ltd."
        ),
      registryContract
        .connect(accounts[9])
        .registerConsumer(
          accounts[9].address,
          "FACTORY2",
          400,
          "Alberta Factory2 Ltd."
        ),
    ]);
    await tx4.wait(1);
    await tx5.wait(1);
  });

  describe("when the poolmarket contract is deployed", async () => {
    it("Correct min/max allowed prices", async () => {
      const minAllowedPrice = await poolMarketContract.minAllowedPrice();
      const maxAllowedPrice = await poolMarketContract.maxAllowedPrice();
      const validOfferIDs = await poolMarketContract.getValidOfferIDs();
      expect(minAllowedPrice).to.eq(0);
      expect(maxAllowedPrice).to.eq(100000);
      expect(validOfferIDs.length).to.eq(0);
    });
  });
  describe("when offer is submitted", async () => {
    it("ENG01 submits a valid offer", async () => {
      const registeredSuppliers = await registryContract.getAllSuppliers();
      // console.log(registeredSuppliers);
      const isRegistered = await registryContract
        .connect(accounts[1])
        .isRegisteredSupplier(accounts[1].address);
      expect(isRegistered).to.eq(true);
      // const bnPrice = convertNumberToBigNumber(50.00);
      const tx = await poolMarketContract
        .connect(accounts[1])
        .submitOffer(0, 5, 5035);
      await tx.wait();
      const validOfferIDs = await poolMarketContract.getValidOfferIDs();
      // console.log(validOfferIDs);
      expect(validOfferIDs.length).to.eq(1);
    });
    it("ENG01 update a valid offer with different price", async () => {
      const registeredSuppliers = await registryContract.getAllSuppliers();
      // console.log(registeredSuppliers);
      const isRegistered = await registryContract
        .connect(accounts[1])
        .isRegisteredSupplier(accounts[1].address);
      expect(isRegistered).to.eq(true);

      const tx = await poolMarketContract
        .connect(accounts[1])
        .submitOffer(0, 5, 50);
      await tx.wait();
      const validOfferIDs = await poolMarketContract.getValidOfferIDs();
      // console.log(validOfferIDs);
      expect(validOfferIDs.length).to.eq(1);
      // update an offer with different amount and price
      const tx2 = await poolMarketContract
        .connect(accounts[1])
        .submitOffer(0, 30, 45);
      await tx2.wait();
      const validOfferIDs2 = await poolMarketContract.getValidOfferIDs();
      // console.log(validOfferIDs2);
      expect(validOfferIDs2.length).to.eq(1);
      const updatedOffer = await poolMarketContract.energyOffers(
        validOfferIDs2[0]
      );
      // console.log(updatedOffer);
      expect(updatedOffer.price).to.eq(45);
    });
    it("Emits an event when ENG01 submits an offer", async () => {
      const offerId = ethers.utils.solidityKeccak256(
        ["string", "uint8"],
        [accounts[1].address, 0]
      );
      // console.log(offerId);
      await expect(
        poolMarketContract.connect(accounts[1]).submitOffer(0, 5, 50)
      ).to.emit(poolMarketContract, "OfferSubmitted");
      // .withArgs(offerId, 5, 50);
    });
    it("ENG01 submits an invalid offer over the capacity", async () => {
      const isRegistered = await registryContract
        .connect(accounts[1])
        .isRegisteredSupplier(accounts[1].address);
      expect(isRegistered).to.eq(true);
      await expect(
        poolMarketContract.connect(accounts[1]).submitOffer(0, 500, 50)
      ).to.revertedWith("Invalid amount");
      const validOfferIDs = await poolMarketContract.getValidOfferIDs();
      expect(validOfferIDs.length).to.eq(0);
    });
    it("An unregistered suppplier ENG04 submits an offer", async () => {
      const isRegistered = await registryContract
        .connect(accounts[4])
        .isRegisteredSupplier(accounts[4].address);
      expect(isRegistered).to.eq(false);
      await expect(
        poolMarketContract.connect(accounts[4]).submitOffer(0, 5, 50)
      ).to.revertedWith("Unregistered supplier");
      const validOfferIDs = await poolMarketContract.getValidOfferIDs();
      expect(validOfferIDs.length).to.eq(0);
    });
  });
  describe("when update demand", async () => {
    beforeEach(async () => {
      // submitOffer(blockNum, amount, price)
      // submitBid(amount, price)
      const [tx1, tx2, tx3, tx4, tx5] = await Promise.all([
        poolMarketContract.connect(accounts[1]).submitOffer(0, 35, 50),
        poolMarketContract.connect(accounts[2]).submitOffer(1, 27, 55),
        poolMarketContract.connect(accounts[3]).submitOffer(2, 60, 20),
        poolMarketContract.connect(accounts[8]).submitBid(30, 30),
        poolMarketContract.connect(accounts[9]).submitBid(31, 20),
      ]);
      await tx1.wait(1);
      await tx2.wait(1);
      await tx3.wait(1);
      await tx4.wait(1);
      await tx5.wait(1);
    });
    it("update ail demand by increasing an existing bid", async () => {     
      const latestDemand = await poolMarketContract.getLatestTotalDemand();
      expect(latestDemand).to.eq(61);
      const currBlock = await ethers.provider.getBlock("latest");
      const currHour = Math.floor(currBlock.timestamp / 3600) * 3600;
      const energyBids1 = await poolMarketContract.getEnergyBids(currHour);
      // console.log({energyBids1});

      const tx = await poolMarketContract
        .connect(accounts[9])
        .submitBid(70, 20);
      await tx.wait(1);

      const energyBids2 = await poolMarketContract.getEnergyBids(currHour);
      expect(energyBids1.length + 1).to.eq(energyBids2.length);

      const newDemand = await poolMarketContract.getLatestTotalDemand();
      expect(newDemand).to.eq(100);
    });
    it("update ail demand by decreasing an existing bid", async () => {
      const demand = await poolMarketContract.getLatestTotalDemand();
      expect(demand).to.eq(61);
      const currBlock = await ethers.provider.getBlock("latest");
      const currHour = Math.floor(currBlock.timestamp / 3600) * 3600;
      const energyBids1 = await poolMarketContract.getEnergyBids(currHour);
      const tx = await poolMarketContract
        .connect(accounts[9])
        .submitBid(30, 20);
      await tx.wait(1);
      const energyBids2 = await poolMarketContract.getEnergyBids(currHour);
      const newDemand = await poolMarketContract.getLatestTotalDemand();
      expect(newDemand).to.eq(60);
      expect(energyBids1.length + 1).to.eq(energyBids2.length);
    });
    it("update ail demand by adding a new bid", async () => {
      const demand = await poolMarketContract.getLatestTotalDemand();
      expect(demand).to.eq(61);
      const currBlock = await ethers.provider.getBlock("latest");
      const currHour = Math.floor(currBlock.timestamp / 3600) * 3600;
      const energyBids1 = await poolMarketContract.getEnergyBids(currHour);
      const registerTx = await registryContract
        .connect(accounts[7])
        .registerConsumer(
          accounts[7].address,
          "FACTORY3",
          400,
          "Alberta Factory3 Ltd."
        );
      await registerTx.wait(1);
      const tx = await poolMarketContract
        .connect(accounts[7])
        .submitBid(39, 20);
      await tx.wait(1);
      const newDemand = await poolMarketContract.getLatestTotalDemand();
      const energyBids2 = await poolMarketContract.getEnergyBids(currHour);
      expect(newDemand).to.eq(100);
      expect(energyBids1.length + 1).to.eq(energyBids2.length);
    });
    it("emits an event when updating ail demand", async () => {
      const registerTx = await registryContract
        .connect(accounts[7])
        .registerConsumer(
          accounts[7].address,
          "FACTORY3",
          400,
          "Alberta Factory3 Ltd."
        );
      await registerTx.wait(1);
      // emit BidSubmitted(_amount, _price, msg.sender);
      await expect(
        poolMarketContract.connect(accounts[7]).submitBid(39, 20)
      ).to.emit(poolMarketContract, "BidSubmitted").withArgs(39, 20, accounts[7].address);
      const newDemand = await poolMarketContract.getLatestTotalDemand();
      expect(newDemand).to.eq(100);
    });
    it("calculate the smp when updating ail demand", async () => {
      const txRegister = await registryContract
        .connect(accounts[4])
        .registerSupplier(
          accounts[4].address,
          "ENG04",
          3,
          300,
          "Albera Energy Ltd."
        );
      await txRegister.wait();
      const txSubmitOffer = await poolMarketContract
        .connect(accounts[4])
        .submitOffer(2, 60, 70);
      await txSubmitOffer.wait();
      const registerTx = await registryContract
        .connect(accounts[7])
        .registerConsumer(
          accounts[7].address,
          "FACTORY3",
          400,
          "Alberta Factory3 Ltd."
        );
      await registerTx.wait();
      const tx = await poolMarketContract
        .connect(accounts[7])
        .submitBid(39, 20);
      await tx.wait();
      const currBlock = await ethers.provider.getBlock("latest");
      const currMinute = Math.floor(currBlock.timestamp / 60) * 60;
      const calculateSMPTx = await poolMarketContract.calculateSMP();
      await calculateSMPTx.wait();
      const smp = await poolMarketContract.getSMP(currMinute);
      // console.log({smp});
      const newDemand = await poolMarketContract.getLatestTotalDemand();
      expect(smp).to.eq(55);
      expect(newDemand).to.eq(100);
    });
    it("update an ail demand over total registered capacity", async () => {
      const totalRegisteredCapacity = await registryContract.getTotalCapacity();
      // console.log(totalRegisteredCapacity);
      const registerTx = await registryContract
        .connect(accounts[7])
        .registerConsumer(
          accounts[7].address,
          "FACTORY3",
          900,
          "Alberta Factory3 Ltd."
        );
      await registerTx.wait();
      const updateDemandTx = await poolMarketContract.calculateSMP();
      await updateDemandTx.wait();
      await expect(
        poolMarketContract.connect(accounts[7]).submitBid(900, 20)
      ).to.revertedWith("Demand exceeds total supply");
    });
    it("get dispatched offers after calculating smp", async () => {
      const txRegister = await registryContract
        .connect(accounts[4])
        .registerSupplier(
          accounts[4].address,
          "ENG04",
          3,
          300,
          "Albera Energy Ltd."
        );
      await txRegister.wait();
      const txSubmitOffer = await poolMarketContract
        .connect(accounts[4])
        .submitOffer(2, 60, 70);
      await txSubmitOffer.wait();
      const registerTx = await registryContract
        .connect(accounts[7])
        .registerConsumer(
          accounts[7].address,
          "FACTORY3",
          400,
          "Alberta Factory3 Ltd."
        );
      await registerTx.wait();
      const tx = await poolMarketContract
        .connect(accounts[7])
        .submitBid(59, 20);
      await tx.wait();
      const calculateSMPTx = await poolMarketContract.calculateSMP();
      await calculateSMPTx.wait();
      const newDemand = await poolMarketContract.getLatestTotalDemand();
      // console.log({newDemand});
      expect(newDemand).to.eq(120);
      const currBlock = await ethers.provider.getBlock("latest");
      const currHour = Math.floor(currBlock.timestamp / 3600) * 3600;
      const dispatchedOffers = await poolMarketContract.getDispatchedOffers(
        currHour
      );
      // console.log(dispatchedOffers);
      const validOfferIDs = await poolMarketContract.getValidOfferIDs();
      // console.log(validOfferIDs);
      expect(dispatchedOffers.length).to.eq(3);
    });
    it("calculate pool price after calculating smp", async () => {
      const txRegister = await registryContract
        .connect(accounts[4])
        .registerSupplier(
          accounts[4].address,
          "ENG04",
          3,
          300,
          "Albera Energy Ltd."
        );
      await txRegister.wait();
      const txSubmitOffer = await poolMarketContract
        .connect(accounts[4])
        .submitOffer(2, 60, 70);
      await txSubmitOffer.wait();
      const registerTx = await registryContract
        .connect(accounts[7])
        .registerConsumer(
          accounts[7].address,
          "FACTORY3",
          400,
          "Alberta Factory3 Ltd."
        );
      await registerTx.wait();
      const tx = await poolMarketContract
        .connect(accounts[7])
        .submitBid(119, 20);
      await tx.wait();
      const calculateSMPTx = await poolMarketContract.calculateSMP();
      await calculateSMPTx.wait();
      const newDemand = await poolMarketContract.getLatestTotalDemand();
      expect(newDemand).to.eq(180);
      const currBlock = await ethers.provider.getBlock("latest");
      const currMinute = Math.floor(currBlock.timestamp / 60) * 60;
      const smp = await poolMarketContract.getSMP(currMinute);
      const currHour1 = Math.floor(currBlock.timestamp / 3600) * 3600;

      const calculatePoolPriceTx = await poolMarketContract.calculatePoolPrice(currHour1);
      await calculatePoolPriceTx.wait();
      const poolPrice = await poolMarketContract.getPoolPrice(currHour1);
      
      // manually calculate poolprice from smp
      const minutes = new Date(currBlock.timestamp * 1000).getMinutes();
      const pp = Math.floor((convertBigNumberToNumber(smp) * (60-minutes)) / 60);
      // compare calculated with obtained from chain
      expect(convertBigNumberToNumber(poolPrice)).eq(pp);
    });
    it("revert when calculating pool price in the future", async () => {
      const currBlock = await ethers.provider.getBlock("latest");
      const currHour = Math.floor(currBlock.timestamp / 3600) * 3600;
      const futureHour = currHour + 3600;
      await expect(
        poolMarketContract.calculatePoolPrice(futureHour)
      ).to.revertedWith("Hour is not valid");
    });
  });
});
