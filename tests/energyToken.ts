import { expect } from "chai";
// eslint-disable-next-line node/no-unpublished-import
import { BytesLike, Contract } from "ethers";
import { ethers } from "hardhat";
// eslint-disable-next-line node/no-missing-import
import { EnergyToken } from "../typechain";

const PREMINT = ethers.utils.parseEther("0");
const TEST_MINT_VALUE = ethers.utils.parseEther("10");

describe("Testing ERC20 Token", () => {
  let tokenContract: Contract;
  let accounts: any[];
  let minterRoleHash: BytesLike;

  beforeEach(async () => {
    accounts = await ethers.getSigners();
    const tokenFactory = await ethers.getContractFactory(
      "EnergyToken"
    );
    tokenContract = await tokenFactory.deploy();
    await tokenContract.deployed();
    minterRoleHash = await tokenContract.MINTER_ROLE();
  });

  describe("when the contract is deployed", async () => {
    it("has zero total supply", async () => {
      const totalSupplyBN = await tokenContract.totalSupply();
      const expectedValueBN = PREMINT;
      const diffBN = totalSupplyBN.gt(expectedValueBN)
        ? totalSupplyBN.sub(expectedValueBN)
        : expectedValueBN.sub(totalSupplyBN);
      const diff = Number(diffBN);
      expect(diff).to.eq(0);
    });

    it("sets the deployer as minter", async () => {
      const hasRole = await tokenContract.hasRole(
        minterRoleHash,
        accounts[0].address
      );
      expect(hasRole).to.eq(true);
    });
  });
  describe("when the minter mints tokens", async () => {
    beforeEach(async () => {
      const mintTx = await tokenContract.mint(
        accounts[1].address,
        TEST_MINT_VALUE
      );
      await mintTx.wait();
    });

    it("updates the total supply", async () => {
      const totalSupplyBN = await tokenContract.totalSupply();
      const expectedValueBN = TEST_MINT_VALUE;
      const diffBN = totalSupplyBN.gt(expectedValueBN)
        ? totalSupplyBN.sub(expectedValueBN)
        : expectedValueBN.sub(totalSupplyBN);
      const diff = Number(diffBN);
      expect(diff).to.eq(0);
    });

    it("has given balance to the account", async () => {
      const balanceOfBN = await tokenContract.balanceOf(accounts[1].address);
      const expectedValueBN = TEST_MINT_VALUE;
      const diffBN = balanceOfBN.gt(expectedValueBN)
        ? balanceOfBN.sub(expectedValueBN)
        : expectedValueBN.sub(balanceOfBN);
      const diff = Number(diffBN);
      expect(diff).to.eq(0);
    });
  });
  describe("when tokens are burned", async () => {
    beforeEach(async () => {
      const mintTx = await tokenContract.mint(
        accounts[2].address,
        TEST_MINT_VALUE
      );
      await mintTx.wait();
    });
    it("account has balance decreased", async () => {
      const balanceOfBN = await tokenContract.balanceOf(accounts[2].address);
      // console.log('balance: ', ethers.utils.formatEther(balanceOfBN));
      const burnAmountBN = ethers.utils.parseEther("5");
      const owner = await tokenContract.owner();
      const approveTx = await tokenContract.connect(accounts[2]).approve(owner, burnAmountBN);
      await approveTx.wait();
      const allowance = await tokenContract.allowance(accounts[2].address, owner);
      // console.log('Allowance: ', ethers.utils.formatEther(allowance));
      expect(balanceOfBN).to.be.eq(TEST_MINT_VALUE);
      const burnFromTx = await tokenContract.burnFrom(accounts[2].address, burnAmountBN);
      await burnFromTx.wait();
      const balanceNew = await tokenContract.balanceOf(accounts[2].address);
      expect(balanceNew).to.eq(ethers.utils.parseEther("5"));
    });
    it("decreases the total token supply", async () => {
      const totalSupplyBN = await tokenContract.totalSupply();
      // console.log('total supply: ', ethers.utils.formatEther(totalSupplyBN));
      const owner = await tokenContract.owner();
      const burnAmountBN = ethers.utils.parseEther("4");
      const approveTx = await tokenContract.connect(accounts[2]).approve(owner, burnAmountBN);
      await approveTx.wait();
      expect(totalSupplyBN).to.be.eq(TEST_MINT_VALUE);
      const burnFromTx = await tokenContract.burnFrom(accounts[2].address, burnAmountBN);
      await burnFromTx.wait();
      const newTotalSupplyBN = await tokenContract.totalSupply();
      // console.log('total supply afterwards: ', ethers.utils.formatEther(newTotalSupplyBN));
      expect(newTotalSupplyBN).to.eq(ethers.utils.parseEther("6"));
    });
  });
});