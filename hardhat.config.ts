import * as dotenv from "dotenv";

import { HardhatUserConfig, task } from "hardhat/config";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "hardhat-storage-layout";

dotenv.config();

const EXPOSED_KEY = "8f2a55949038a9610f50fb23b5883af3b4ecb3c3bb792cbcefbd1542c692be63";
// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.19",
    settings: {
      viaIR: true,
      metadata: {
        appendCBOR: false,
        bytecodeHash: "none"
      },
      optimizer: {
        enabled: true,
        runs: 1,
      }
    }
  },
  networks: {
    besu: {
      url: process.env.BESU_URL || "",
      accounts: [
        process.env.PRIVATE_KEY !== undefined ? process.env.PRIVATE_KEY : EXPOSED_KEY,
        process.env.PRIVATE_KEY2 !== undefined ? process.env.PRIVATE_KEY2 : EXPOSED_KEY,
      ]
    },
    goerli: {
      url: process.env.ALCHEMY_GOERLI_URL || "",
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
      gas: 100000000000,
      allowUnlimitedContractSize: true,
    },
  },
  gasReporter: {
    enabled: (process.env.REPORT_GAS) ? true : false,
    currency: "ETK",
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  paths: { tests: "tests" },
};

export default config;
