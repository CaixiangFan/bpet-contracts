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
    it("ENG01 submits an offer",async () => {
      const isRegistered = await registryContract.connect(accounts[1]).isRegisteredSupplier();
      expect(isRegistered).to.eq(true);
      // const registerInfo = await registryContract.connect(accounts[1]).getOwnSupplier();
      // console.log(registerInfo);

      const assetId = await poolMarketContract.connect(accounts[1]).getRegisteredSupplierAssetId();
      console.log('AssetId: ', assetId);
      const tx = await poolMarketContract.connect(accounts[1]).submitOffer(
        "ENG01", 0, 5, 50
      );
      await tx.wait();
      const validOffers = await poolMarketContract.getValidOffers();
      expect(validOffers.length).to.eq(1);
    });
    it("Emits an event when ENG01 submits an offer",async () => {
      // const offerId = ethers.utils.solidityKeccak256(["ENG01"], [0]);
      await expect(poolMarketContract.connect(accounts[1]).submitOffer(
        "ENG01", 0, 5, 50)
      ).to.emit(poolMarketContract, "OfferSubmitted");
      // .withArgs(offerId, 5, 50);
    });
  });
})