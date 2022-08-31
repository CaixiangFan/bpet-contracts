import { expect } from "chai";
// eslint-disable-next-line node/no-unpublished-import
import { BytesLike, Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers, waffle } from "hardhat";
// eslint-disable-next-line node/no-missing-import
import { EnergyToken, Registry, PoolMarket } from "../typechain";



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
      poolMarketContractFactory] = await Promise.all(
        [
        ethers.getContractFactory("EnergyToken"),
        ethers.getContractFactory("Registry"),
        ethers.getContractFactory("PoolMarket")
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
      registryContract.address, 0, 1000);

    await poolMarketContract.deployed();

    const tx1 = await registryContract.connect(accounts[1]).registerSupplier(
      "ENG01", 2, 300, "Albera Energy Ltd."
      );
    await tx1.wait();

    const tx2 = await registryContract.connect(accounts[2]).registerSupplier(
      "ENG02", 3, 300, "Albera Energy Ltd."
      );
    await tx2.wait();

    const tx3 = await registryContract.connect(accounts[3]).registerSupplier(
      "ENG03", 4, 300, "Albera Energy Ltd."
      );
    await tx3.wait();

    const [tx4, tx5] = await Promise.all([
      registryContract.connect(accounts[8]).registerConsumer("FACTORY1", 500, "Alberta Factory1 Ltd."),
      registryContract.connect(accounts[9]).registerConsumer("FACTORY2", 400, "Alberta Factory2 Ltd."),
    ]);
    await tx4.wait();
    await tx5.wait();
  });

  describe("when the poolmarket contract is deployed", async () => {
    it("Correct min/max allowed prices", async () => {
      const minAllowedPrice = await poolMarketContract.minAllowedPrice();
      const maxAllowedPrice = await poolMarketContract.maxAllowedPrice();
      const validOffers = await poolMarketContract.getValidOffers();
      expect(minAllowedPrice).to.eq(0);
      expect(maxAllowedPrice).to.eq(1000);
      expect(validOffers.length).to.eq(0);
    });
  });
  describe("when offer is submitted",async () => {
    it("ENG01 submits a valid offer",async () => {
      const registeredSuppliers = await registryContract.getAllSuppliers();
      console.log(registeredSuppliers);
      const isRegistered = await registryContract.connect(accounts[1]).isRegisteredSupplier(accounts[1].address);
      expect(isRegistered).to.eq(true);
      
      const tx = await poolMarketContract.connect(accounts[1]).submitOffer(
        "ENG01", 0, 5, 50
      );
      await tx.wait();
      const validOffers = await poolMarketContract.getValidOffers();
      console.log(validOffers);
      expect(validOffers.length).to.eq(1);
    });
    it("ENG01 update a valid offer with different price",async () => {
      const registeredSuppliers = await registryContract.getAllSuppliers();
      console.log(registeredSuppliers);
      const isRegistered = await registryContract.connect(accounts[1]).isRegisteredSupplier(accounts[1].address);
      expect(isRegistered).to.eq(true);
      
      const tx = await poolMarketContract.connect(accounts[1]).submitOffer(
        "ENG01", 0, 5, 50
      );
      await tx.wait();
      const validOffers = await poolMarketContract.getValidOffers();
      console.log(validOffers);
      expect(validOffers.length).to.eq(1);
      // update an offer with different amount and price
      const tx2 = await poolMarketContract.connect(accounts[1]).submitOffer(
        "ENG01", 0, 30, 45
      );
      await tx2.wait();
      const validOffers2 = await poolMarketContract.getValidOffers();
      console.log(validOffers2);
      expect(validOffers2.length).to.eq(1);
      const updatedOffer = await poolMarketContract.energyOffers(validOffers2[0]);
      console.log(updatedOffer);
      expect(updatedOffer.price).to.eq(45);
    });
    it("Emits an event when ENG01 submits an offer",async () => {
      const offerId = ethers.utils.solidityKeccak256(["string", "uint8"], ["ENG01", 0]);
      await expect(poolMarketContract.connect(accounts[1]).submitOffer(
        "ENG01", 0, 5, 50)
      ).to.emit(poolMarketContract, "OfferSubmitted")
      .withArgs(offerId, 5, 50);
    });
    it("ENG01 submits an invalid offer over the capacity",async () => {
      const isRegistered = await registryContract.connect(accounts[1]).isRegisteredSupplier(accounts[1].address);
      expect(isRegistered).to.eq(true);
      await expect(poolMarketContract.connect(accounts[1]).submitOffer(
        "ENG01", 0, 500, 50
      )).to.revertedWith("Offered amount exceeds capacity");
      const validOffers = await poolMarketContract.getValidOffers();
      expect(validOffers.length).to.eq(0);
    });
    it("An unregistered suppplier ENG04 submits an offer",async () => {
      const isRegistered = await registryContract.connect(accounts[4]).isRegisteredSupplier(accounts[4].address);
      expect(isRegistered).to.eq(false);
      await expect(poolMarketContract.connect(accounts[4]).submitOffer(
        "ENG04", 0, 5, 50
      )).to.revertedWith("Unregistered supplier");
      const validOffers = await poolMarketContract.getValidOffers();
      expect(validOffers.length).to.eq(0);
    });
  });
  describe("when update demand", async () => {
    beforeEach(async () => {
      const [tx1, tx2, tx3, tx4, tx5] = await Promise.all([
        poolMarketContract.connect(accounts[1]).submitOffer("ENG01", 0, 35, 50),
        poolMarketContract.connect(accounts[2]).submitOffer("ENG02", 1, 27, 55),
        poolMarketContract.connect(accounts[3]).submitOffer("ENG03", 2, 60, 20),
        poolMarketContract.connect(accounts[8]).submitBid("FACTORY1", 30, 30),
        poolMarketContract.connect(accounts[9]).submitBid("FACTORY2", 31, 20),
      ]);
      await tx1.wait();
      await tx2.wait();
      await tx3.wait();
      await tx4.wait();
      await tx5.wait();
    });
    it("update ail demand by increasing an existing bid",async () => {
      const demand = await poolMarketContract.totalDemand();
      expect(demand.ail).to.eq(61);
      const assetId = "FACTORY2";
      const energyBids1 = await poolMarketContract.getValidBids();
      const bid = await poolMarketContract.getEnergyBid(assetId);
      console.log(bid);

      const tx = await poolMarketContract.connect(accounts[9]).submitBid(assetId, 70, 20);
      await tx.wait();
      const newbid = await poolMarketContract.getEnergyBid(assetId);
      console.log(newbid);
      const energyBids2 = await poolMarketContract.getValidBids();
      expect(energyBids1.length).to.eq(energyBids2.length);
      const newDemand = await poolMarketContract.totalDemand();
      expect(newDemand.ail).to.eq(100);
    });
    it("update ail demand by decreasing an existing bid",async () => {
      const demand = await poolMarketContract.totalDemand();
      expect(demand.ail).to.eq(61);
      const energyBids1 = await poolMarketContract.getValidBids();
      console.log(energyBids1);
      const tx = await poolMarketContract.connect(accounts[9]).submitBid("FACTORY2", 30, 20);
      await tx.wait();
      const energyBids2 = await poolMarketContract.getValidBids();
      console.log(energyBids2);
      const newDemand = await poolMarketContract.totalDemand();
      expect(newDemand.ail).to.eq(60);
    });
    it("update ail demand by adding a new bid",async () => {
      const demand = await poolMarketContract.totalDemand();
      expect(demand.ail).to.eq(61);
      const energyBids1 = await poolMarketContract.getValidBids();
      console.log(energyBids1);
      const registerTx = await registryContract.connect(accounts[7]).registerConsumer(
        "FACTORY3", 400, "Alberta Factory3 Ltd."
      );
      await registerTx.wait();
      const tx = await poolMarketContract.connect(accounts[7]).submitBid("FACTORY3", 39, 20);
      await tx.wait();
      const energyBids2 = await poolMarketContract.getValidBids();
      console.log(energyBids2);
      const newDemand = await poolMarketContract.totalDemand();
      expect(newDemand.ail).to.eq(100);
    });
    it("emits an event when updating ail demand",async () => {
      const registerTx = await registryContract.connect(accounts[7]).registerConsumer(
        "FACTORY3", 400, "Alberta Factory3 Ltd."
      );
      await registerTx.wait();
      await expect(poolMarketContract.connect(accounts[7]).submitBid("FACTORY3", 39, 20))
      .emit(poolMarketContract, "DemandChanged")
      .withArgs(100);
      const newDemand = await poolMarketContract.totalDemand();
      expect(newDemand.ail).to.eq(100);
    });
    it("calculate the smp when updating ail demand",async () => {
      const txRegister = await registryContract.connect(accounts[4]).registerSupplier(
        "ENG04", 3, 300, "Albera Energy Ltd."
      );
      await txRegister.wait();
      const txSubmitOffer = await poolMarketContract.connect(accounts[4])
      .submitOffer("ENG04", 2, 60, 70);
      await txSubmitOffer.wait();
      const registerTx = await registryContract.connect(accounts[7]).registerConsumer(
        "FACTORY3", 400, "Alberta Factory3 Ltd."
      );
      await registerTx.wait();
      const tx = await poolMarketContract.connect(accounts[7]).submitBid("FACTORY3", 39, 20);
      await tx.wait();
      const currBlock = await ethers.provider.getBlock("latest");
      const currMinute = Math.floor(currBlock.timestamp / 60) * 60;
      const smp = await poolMarketContract.getSMP(currMinute);
      const newDemand = await poolMarketContract.totalDemand();
      expect(smp).to.eq(55);
      expect(newDemand.ail).to.eq(100);
    });
    it("update an ail demand over total registered capacity",async () => {
      const totalRegisteredCapacity = await registryContract.getTotalCapacity();
      console.log(totalRegisteredCapacity);
      const registerTx = await registryContract.connect(accounts[7]).registerConsumer(
        "FACTORY3", 900, "Alberta Factory3 Ltd."
      );
      await registerTx.wait();
      await expect(poolMarketContract.connect(accounts[7]).submitBid("FACTORY3", 900, 20))
      .to.revertedWith("Demand exceeds total supply");
    });
    it("get dispatched offers after calculating smp",async () => {
      const txRegister = await registryContract.connect(accounts[4]).registerSupplier(
        "ENG04", 3, 300, "Albera Energy Ltd."
      );
      await txRegister.wait();
      const txSubmitOffer = await poolMarketContract.connect(accounts[4])
      .submitOffer("ENG04", 2, 60, 70);
      await txSubmitOffer.wait();
      const registerTx = await registryContract.connect(accounts[7]).registerConsumer(
        "FACTORY3", 400, "Alberta Factory3 Ltd."
      );
      await registerTx.wait();
      const tx = await poolMarketContract.connect(accounts[7]).submitBid("FACTORY3", 59, 20);
      await tx.wait();
      const newDemand = await poolMarketContract.totalDemand();
      expect(newDemand.ail).to.eq(120);
      const currBlock = await ethers.provider.getBlock("latest");
      const currHour = Math.floor(currBlock.timestamp / 3600) * 3600;
      const dispatchedOffers = await poolMarketContract.getDispatchedOffers(currHour);
      console.log(dispatchedOffers);
      const validOffers = await poolMarketContract.getValidOffers();
      console.log(validOffers);
      expect(dispatchedOffers.length).to.eq(3);
    });
    it("calculate pool price after calculating smp",async () => {
      const txRegister = await registryContract.connect(accounts[4]).registerSupplier(
        "ENG04", 3, 300, "Albera Energy Ltd."
      );
      await txRegister.wait();
      const txSubmitOffer = await poolMarketContract.connect(accounts[4])
      .submitOffer("ENG04", 2, 60, 70);
      await txSubmitOffer.wait();
      const registerTx = await registryContract.connect(accounts[7]).registerConsumer(
        "FACTORY3", 400, "Alberta Factory3 Ltd."
      );
      await registerTx.wait();
      const tx = await poolMarketContract.connect(accounts[7]).submitBid("FACTORY3", 119, 20);
      await tx.wait();
      const newDemand = await poolMarketContract.totalDemand();
      expect(newDemand.ail).to.eq(180);
      const currBlock = await ethers.provider.getBlock("latest");
      const currMinute = Math.floor(currBlock.timestamp / 60) * 60;
      const smp = await poolMarketContract.getSMP(currMinute);

      const currHour1 = Math.floor(currBlock.timestamp / 3600) * 3600;
      const dispatchedOffers2 = await poolMarketContract.getDispatchedOffers(currHour1);
      console.log(dispatchedOffers2);
      
      const poolPrice = await poolMarketContract.getPoolPrice(currHour1);
      console.log(poolPrice);
      console.log(smp);
    });
    it("revert when calculating pool price in the future",async () => {
      const currBlock = await ethers.provider.getBlock("latest");
      const currHour = Math.floor(currBlock.timestamp / 3600) * 3600;
      const futureHour = currHour + 3600;
      await expect(poolMarketContract.calculatePoolPrice(futureHour))
      .to.revertedWith("Hour is not valid");
    });
  });
})