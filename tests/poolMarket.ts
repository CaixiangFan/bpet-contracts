import { expect } from "chai";
// eslint-disable-next-line node/no-unpublished-import
import { BytesLike, Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers, waffle } from "hardhat";
// eslint-disable-next-line node/no-missing-import
import { EnergyToken, Registry, PoolMarket } from "../typechain";

const PREMINT = ethers.utils.parseEther("0");
const INIT_TOKEN = "100";
const PURCHASE_RATIO = "1";

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

    registryContract = await registryContractFactory.deploy(
      INIT_TOKEN, PURCHASE_RATIO, etkContract.address);
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
      "ENG01", 2, 300, "Albera Energy Ltd.", {value: Number(INIT_TOKEN) * Number(PURCHASE_RATIO)}
      );
    await tx1.wait();

    const tx2 = await registryContract.connect(accounts[2]).registerSupplier(
      "ENG02", 3, 300, "Albera Energy Ltd.", {value: Number(INIT_TOKEN) * Number(PURCHASE_RATIO)}
      );
    await tx2.wait();

    const tx3 = await registryContract.connect(accounts[3]).registerSupplier(
      "ENG03", 4, 300, "Albera Energy Ltd.", {value: Number(INIT_TOKEN) * Number(PURCHASE_RATIO)}
      );
    await tx3.wait();
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
      const isRegistered = await registryContract.connect(accounts[1]).isRegisteredSupplier(accounts[1].address);
      expect(isRegistered).to.eq(true);
      const tx = await poolMarketContract.connect(accounts[1]).submitOffer(
        "ENG01", 0, 5, 50
      );
      await tx.wait();
      const validOffers = await poolMarketContract.getValidOffers();
      expect(validOffers.length).to.eq(1);
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
      const [tx1, tx2, tx3, tx4] = await Promise.all([
        poolMarketContract.connect(accounts[1]).submitOffer("ENG01", 0, 35, 50),
        poolMarketContract.connect(accounts[2]).submitOffer("ENG02", 1, 27, 55),
        poolMarketContract.connect(accounts[3]).submitOffer("ENG03", 2, 60, 20),
        poolMarketContract.updateDemand(100)
      ]);
      await tx1.wait();
      await tx2.wait();
      await tx3.wait();
      await tx4.wait();
    });
    it("update ail demand",async () => {
      const demand = await poolMarketContract.totalDemand();
      expect(demand.ail).to.eq(100);

      const tx = await poolMarketContract.updateDemand(100);
      await tx.wait();

      const newDemand = await poolMarketContract.totalDemand();
      expect(newDemand.ail).to.eq(100);
    });
    it("emits an event when updating ail demand",async () => {
      await expect(poolMarketContract.updateDemand(100))
      .emit(poolMarketContract, "DemandChanged")
      .withArgs(100);
      const newDemand = await poolMarketContract.totalDemand();
      expect(newDemand.ail).to.eq(100);
    });
    it("calculate the smp when updating ail demand",async () => {
      const txRegister = await registryContract.connect(accounts[4]).registerSupplier(
        "ENG04", 3, 300, "Albera Energy Ltd.", {value: Number(INIT_TOKEN) * Number(PURCHASE_RATIO)}
      );
      await txRegister.wait();
      const txSubmitOffer = await poolMarketContract.connect(accounts[4])
      .submitOffer("ENG04", 2, 60, 70);
      await txSubmitOffer.wait();
      const tx = await poolMarketContract.updateDemand(100);
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
      await expect(poolMarketContract.updateDemand(1000))
      .to.revertedWith("Demand exceeds total supply");
    });
    it("get dispatched offers after calculating smp",async () => {
      const txRegister = await registryContract.connect(accounts[4]).registerSupplier(
        "ENG04", 3, 300, "Albera Energy Ltd.", {value: Number(INIT_TOKEN) * Number(PURCHASE_RATIO)}
      );
      await txRegister.wait();
      const txSubmitOffer = await poolMarketContract.connect(accounts[4])
      .submitOffer("ENG04", 2, 60, 70);
      await txSubmitOffer.wait();
      const txUpdateDemand = await poolMarketContract.updateDemand(180);
      await txUpdateDemand.wait();
      const newDemand = await poolMarketContract.totalDemand();
      expect(newDemand.ail).to.eq(180);
      const currBlock = await ethers.provider.getBlock("latest");
      const currHour = Math.floor(currBlock.timestamp / 3600) * 3600;
      const dispatchedOffers = await poolMarketContract.getDispatchedOffers(currHour);
      console.log(dispatchedOffers);
      expect(dispatchedOffers.length).to.eq(4);
    });
    it("calculate pool price after calculating smp",async () => {
      const txRegister = await registryContract.connect(accounts[4]).registerSupplier(
        "ENG04", 3, 300, "Albera Energy Ltd.", {value: Number(INIT_TOKEN) * Number(PURCHASE_RATIO)}
      );
      await txRegister.wait();
      const txSubmitOffer = await poolMarketContract.connect(accounts[4])
      .submitOffer("ENG04", 2, 60, 70);
      await txSubmitOffer.wait();
      const txUpdateDemand = await poolMarketContract.updateDemand(180);
      await txUpdateDemand.wait();
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