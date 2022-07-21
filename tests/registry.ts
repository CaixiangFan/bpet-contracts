import { expect } from "chai";
// eslint-disable-next-line node/no-unpublished-import
import { BytesLike, Contract } from "ethers";
import { ethers } from "hardhat";
// eslint-disable-next-line node/no-missing-import
import { Registry } from "../typechain";

const PREMINT = ethers.utils.parseEther("0");
const INIT_TOKEN = ethers.utils.parseEther("100");

describe("Testing Registry Contract", () => {
  let registryContract: Contract;
  let accounts: any[];
  let authorizedEntity: any;

  beforeEach(async () => {
    accounts = await ethers.getSigners();
    const tokenFactory = await ethers.getContractFactory(
      "Registry"
    );
    registryContract = await tokenFactory.deploy(INIT_TOKEN);
    await registryContract.deployed();
    authorizedEntity = await registryContract.authorizedEntity();
    console.log(authorizedEntity);
  });

  describe("when the contract is deployed", async () => {
    it("authorized entity is the deployer", async () => {
      const authorizedEntity = await registryContract.authorizedEntity();
      const expectedAuthEntity = accounts[0];

      expect(authorizedEntity).to.eq(expectedAuthEntity);
    });
  });
})