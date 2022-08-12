import { expect } from "chai";
// eslint-disable-next-line node/no-unpublished-import
import { BytesLike, Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers, waffle } from "hardhat";
// eslint-disable-next-line node/no-missing-import
import { EnergyToken, Registry } from "../typechain";

const PREMINT = ethers.utils.parseEther("0");
const INIT_TOKEN = "100";
const PURCHASE_RATIO = "1";

describe("Testing Registry Contract", () => {
  let registryContract: Contract;
  let etkContract: Contract;
  let accounts: SignerWithAddress[];
  let provider = waffle.provider;

  beforeEach(async () => {
    accounts = await ethers.getSigners();
    const [etkContractFactory, registryContractFactory] = 
      await Promise.all([
        ethers.getContractFactory("EnergyToken"),
        ethers.getContractFactory("Registry")
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
  });

  describe("when the contract is deployed", async () => {
    it("authorized entity is the deployer", async () => {
      const authorizedEntity = await registryContract.authorizedEntity();
      const expectedAuthEntity = accounts[0].address;
      expect(authorizedEntity).to.eq(expectedAuthEntity);
    });
    it("purchase ratio is 1", async () => {
      const expectedPurchaseRatio = await registryContract.purchaseRatio();
      expect(expectedPurchaseRatio).to.eq(Number(PURCHASE_RATIO));
    });
    it("balance and total is 0", async () => {
      const balance = await etkContract.balanceOf(accounts[0].address);
      const totalSupply = await etkContract.totalSupply();
      expect(balance).to.eq(0);
      expect(totalSupply).to.eq(0);
    });
    it("Token name is EnergyToken with symbol ETK", async () => {
      const name = await etkContract.name();
      const symbol = await etkContract.symbol();
      expect(name).to.eq("EnergyToken");
      expect(symbol).to.eq("ETK");
    });
  });

  describe("when a supplier is registered", async () => {
    it("after registered the initial balance is 100", async () => {
      const ethBalance = await provider.getBalance(accounts[1].address)
      console.log(ethers.utils.formatEther(ethBalance));
      const tx = await registryContract.connect(accounts[1]).registerSupplier(
        "ENG03", 3, 300, "Albera Energy Ltd.", {value: Number(INIT_TOKEN) * Number(PURCHASE_RATIO)}
        );
      await tx.wait();
      const balance = await etkContract.balanceOf(accounts[1].address);

      const ethBalanceAfter = await provider.getBalance(accounts[1].address);
      console.log("after balance: ", ethers.utils.formatEther(ethBalanceAfter));
      expect(balance).to.eq(100);
    });
    
    it("get correct registration ino of a registered supplier", async () => {
      const tx = await registryContract.connect(accounts[1]).registerSupplier(
        "ENG03", 3, 300, "Albera Energy Ltd.", {value: 100}
        );
      await tx.wait();
      const registeredInfo = await registryContract.connect(accounts[1]).getOwnSupplier();
      expect(registeredInfo.assetId).to.eq("ENG03");
      expect(registeredInfo.blockAmount).to.eq(3);
      expect(registeredInfo.capacity).to.eq(300);
      expect(registeredInfo.offerControl).to.eq("Albera Energy Ltd.");
    });
    it("ether balance is not enough for registering supplier", async () => {
      const balanceBN = await provider.getBalance(accounts[3].address)
      console.log('Balance: ', ethers.utils.formatEther(balanceBN));
      await expect(registryContract.connect(accounts[3]).registerSupplier(
        "ENG04", 3, 300, "Albera Energy Ltd.", {value: 50}
      )).to.be.revertedWith("Ether not enough to register");
    })
    it("cannot re-register supplier with the same account", async () => {
      await registryContract.connect(accounts[0]).registerSupplier(
        "ENG04", 3, 300, "Albera Energy Ltd.", {value: 100});

      console.log('Successfully register account first time: ', accounts[0].address);
      await expect(registryContract.connect(accounts[0]).registerSupplier(
        "ENG04", 3, 300, "Albera Energy Ltd.", {value: 100}
      )).to.be.revertedWith("Account has already registered");
    })
  });

  describe("when a consumer is registered", async () => {
    it("after register the balance of a consumer is 100", async () => {
      const ethBalance = await provider.getBalance(accounts[2].address)
      console.log(ethers.utils.formatEther(ethBalance));
      const tx = await registryContract.connect(accounts[2]).registerConsumer(
        "UAENG", 100, "University of Alberta.", {value: Number(INIT_TOKEN) * Number(PURCHASE_RATIO)}
        );
      await tx.wait();
      const balance = await etkContract.balanceOf(accounts[2].address);
      expect(balance).to.eq(100);
    });
    it("get correct registration ino of a registered consumer", async () => {
      const tx = await registryContract.connect(accounts[2]).registerConsumer(
        "UAENG", 100, "University of Alberta.", {value: 100}
        );
      await tx.wait();
      const registeredInfo = await registryContract.connect(accounts[2]).getOwnConsumer();
      expect(registeredInfo.assetId).to.eq("UAENG");
      expect(registeredInfo.load).to.eq(100);
      expect(registeredInfo.offerControl).to.eq("University of Alberta.");
    });
    it("ether balance is not enough for registering consumer", async () => {
      const balanceBN = await provider.getBalance(accounts[3].address)
      console.log('Balance: ', ethers.utils.formatEther(balanceBN));
      await expect(registryContract.connect(accounts[3]).registerConsumer(
        "UAENG", 100, "University of Alberta", {value: 50}
      )).to.be.revertedWith("Ether not enough to register");
    })
    it("cannot re-register consumer with the same account", async () => {
      await registryContract.connect(accounts[0]).registerConsumer(
        "CONSUMER1", 300, "Albera Energy Ltd.", {value: 100});

      console.log('Successfully register account first time: ', accounts[0].address);
      await expect(registryContract.connect(accounts[0]).registerConsumer(
        "CONSUMER1", 300, "Albera Energy Ltd.", {value: 100}
      )).to.be.revertedWith("Account has already registered");
    })
  });

  describe("query the registered participants", async () => {
    it("registry admin get supplier registration info", async () => {
      const tx = await registryContract.connect(accounts[1]).registerSupplier(
        "ENG04", 3, 300, "Albera Energy Ltd.", {value: 100}
        );
      await tx.wait();
      const info = await registryContract.getSupplier(accounts[1].address);
      expect(info.assetId).to.eq("ENG04");
      expect(info.blockAmount).to.eq(3);
      expect(info.capacity).to.eq(300);
      expect(info.offerControl).to.eq("Albera Energy Ltd.");
    });
    it("registry admin get consumer registration info", async () => {
      const tx = await registryContract.connect(accounts[2]).registerConsumer(
        "UAENG", 100, "University of Alberta.", {value: 100}
        );
      await tx.wait();
      const registeredInfo = await registryContract.getConsumer(accounts[2].address);
      expect(registeredInfo.assetId).to.eq("UAENG");
      expect(registeredInfo.load).to.eq(100);
      expect(registeredInfo.offerControl).to.eq("University of Alberta.");
    });
    it("participant cannot get other supplier's registration info", async () => {
      const tx = await registryContract.connect(accounts[1]).registerSupplier(
        "ENG04", 3, 300, "Albera Energy Ltd.", {value: 100}
        );
      await tx.wait();
      await expect(registryContract.connect(accounts[2]).getSupplier(accounts[1].address)
      ).to.be.reverted;
    });
    it("participant cannot get other consumer's registration info", async () => {
      const tx = await registryContract.connect(accounts[1]).registerConsumer(
        "UAENG", 100, "University of Alberta", {value: 100}
        );
      await tx.wait();
      await expect(registryContract.connect(accounts[2]).getConsumer(accounts[1].address)
      ).to.be.reverted;
    });
  });
})