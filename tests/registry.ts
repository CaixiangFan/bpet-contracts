import { expect } from "chai";
// eslint-disable-next-line node/no-unpublished-import
import { BytesLike, Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers, waffle } from "hardhat";
// eslint-disable-next-line node/no-missing-import
import { EnergyToken, Registry } from "../typechain";

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

    registryContract = await registryContractFactory.deploy();
    await registryContract.deployed();
  });

  describe("when the contract is deployed", async () => {
    it("authorized entity is the deployer", async () => {
      const authorizedEntity = await registryContract.authorizedEntity();
      const expectedAuthEntity = accounts[0].address;
      expect(authorizedEntity).to.eq(expectedAuthEntity);
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
    it("get correct registration ino of a registered supplier", async () => {
      const tx = await registryContract.connect(accounts[1]).registerSupplier(
        accounts[1].address, "ENG03", 3, 300, "Albera Energy Ltd."
        );
      await tx.wait();
      const registeredInfo = await registryContract.getSupplier(accounts[1].address);
      expect(registeredInfo.assetId).to.eq("ENG03");
      expect(registeredInfo.blockAmount).to.eq(3);
      expect(registeredInfo.capacity).to.eq(300);
      expect(registeredInfo.offerControl).to.eq("Albera Energy Ltd.");
    });
     it("cannot re-register supplier with the same account", async () => {
      await registryContract.connect(accounts[0]).registerSupplier(
        accounts[0].address, "ENG04", 3, 300, "Albera Energy Ltd.");

      // console.log('Successfully register account first time: ', accounts[0].address);
      await expect(registryContract.connect(accounts[0]).registerSupplier(
        accounts[0].address, "ENG04", 3, 300, "Albera Energy Ltd."
      )).to.be.revertedWith("Account has already registered");
    })
  });

  describe("when a consumer is registered", async () => {
    it("get correct registration ino of a registered consumer", async () => {
      const tx = await registryContract.connect(accounts[2]).registerConsumer(
        accounts[2].address, "UAENG", 100, "University of Alberta."
        );
      await tx.wait();
      const registeredInfo = await registryContract.getConsumer(accounts[2].address);
      expect(registeredInfo.assetId).to.eq("UAENG");
      expect(registeredInfo.load).to.eq(100);
      expect(registeredInfo.offerControl).to.eq("University of Alberta.");
    });
    it("cannot re-register consumer with the same account", async () => {
      await registryContract.connect(accounts[0]).registerConsumer(
        accounts[0].address, "CONSUMER1", 300, "Albera Energy Ltd.");

      // console.log('Successfully register account first time: ', accounts[0].address);
      await expect(registryContract.connect(accounts[0]).registerConsumer(
        accounts[0].address, "CONSUMER1", 300, "Albera Energy Ltd."
      )).to.be.revertedWith("Account has already registered");
    })
  });

  describe("query the registered participants", async () => {
    it("registry admin get supplier registration info", async () => {
      const tx = await registryContract.connect(accounts[1]).registerSupplier(
        accounts[1].address, "ENG04", 3, 300, "Albera Energy Ltd."
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
        accounts[2].address, "UAENG", 100, "University of Alberta."
        );
      await tx.wait();
      const registeredInfo = await registryContract.getConsumer(accounts[2].address);
      expect(registeredInfo.assetId).to.eq("UAENG");
      expect(registeredInfo.load).to.eq(100);
      expect(registeredInfo.offerControl).to.eq("University of Alberta.");
    });
  
    it("Admin can get other supplier's registration info", async () => {
      const tx = await registryContract.connect(accounts[1]).registerSupplier(
        accounts[1].address, "ENG04", 3, 300, "Albera Energy Ltd."
        );
      await tx.wait();
      const registryInfo = await registryContract.connect(accounts[0]).getSupplier(accounts[1].address);
      // console.log(registryInfo);
      expect(registryInfo.assetId).to.be.eq("ENG04");
    });
    it("Admin can get other consumer's registration info", async () => {
      const tx = await registryContract.connect(accounts[1]).registerConsumer(
        accounts[1].address, "UAENG", 100, "University of Alberta"
        );
      await tx.wait();
      const registryInfo = await registryContract.connect(accounts[0]).getConsumer(accounts[1].address);
      // console.log(registryInfo);
      expect(registryInfo.assetId).to.be.eq("UAENG");
    });
  });
  describe("Delete registered participant", async () => {
    beforeEach(async () => {
      const tx1 = await registryContract.connect(accounts[1]).registerSupplier(
        accounts[1].address, "ENG01", 2, 300, "Albera Energy Ltd."
        );
      await tx1.wait();
  
      const tx2 = await registryContract.connect(accounts[2]).registerSupplier(
        accounts[2].address, "ENG02", 3, 300, "Albera Energy Ltd."
        );
      await tx2.wait();
  
      const tx3 = await registryContract.connect(accounts[3]).registerSupplier(
        accounts[3].address, "ENG03", 4, 300, "Albera Energy Ltd."
        );
      await tx3.wait();
    });
    it("Non-registry admin cannot delete a registered supplier", async () => {
      const registeredSuppliers = await registryContract.getAllSuppliers();
      // console.log('Initial: ',registeredSuppliers);
      await expect(registryContract.connect(accounts[1]).deleteSupplier(
        accounts[2].address)).to.be.reverted;
      const newRegisteredSuppliers = await registryContract.getAllSuppliers();
      // console.log('New: ', newRegisteredSuppliers);
    });
    it("registry admin deletes a registered supplier", async () => {
      const registeredSuppliers = await registryContract.getAllSuppliers();
      // console.log('Initial: ',registeredSuppliers);
      const deleteTx = await registryContract.deleteSupplier(accounts[1].address);
      await deleteTx.wait();
      const newRegisteredSuppliers = await registryContract.getAllSuppliers();
      // console.log('New: ', newRegisteredSuppliers);
    });
  });
})