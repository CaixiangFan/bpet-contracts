import { ethers } from "ethers";
import "dotenv/config";
import * as tokenJson from "../artifacts/contracts/EnergyToken.sol/EnergyToken.json";
import * as registryJson from "../artifacts/contracts/Registry.sol/Registry.json";
import * as poolMarketJson from "../artifacts/contracts/PoolMarket.sol/PoolMarket.json";
import * as paymentJson from "../artifacts/contracts/Payment.sol/Payment.json";
import { EXPOSED_KEY, setupGoerliProvider } from "./utils";

// Glabal parameters:
// const PURCHASE_RATIO = 1;
const MINALLOWEDPRICE = 0;
const MAXALLOWEDPRICE = 1000;
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY ?? EXPOSED_KEY);
const provider = setupGoerliProvider();
const signer = wallet.connect(provider);

async function deployEnergyToken() {
  console.log("Deploying Token contract");
  const tokenFactory = new ethers.ContractFactory(
    tokenJson.abi,
    tokenJson.bytecode,
    signer
  );
  const tokenContract = await tokenFactory.deploy();
  console.log("Awaiting confirmations");
  await tokenContract.deployed();
  console.log(`Completed! Token contract deployed at ${tokenContract.address}`);
  return tokenContract.address;
}

async function deployRegistry() {
  console.log("Deploying Registry contract");
  const registryFactory = new ethers.ContractFactory(
    registryJson.abi,
    registryJson.bytecode,
    signer
  );
  const registryContract = await registryFactory.deploy();
  console.log("Awaiting confirmations");
  await registryContract.deployed();
  console.log(`Completed! Registry contract deployed at ${registryContract.address}`);
  return registryContract.address;
}

async function deployPoolMarket(registryAddress: string) {
  console.log("Deploying pool market contract");
  const poolmarketFactory = new ethers.ContractFactory(
    poolMarketJson.abi,
    poolMarketJson.bytecode,
    signer
  );
  const poolmarketContract = await poolmarketFactory.deploy(
    registryAddress, MINALLOWEDPRICE, MAXALLOWEDPRICE
  );
  console.log("Awaiting confirmations");
  await poolmarketContract.deployed();
  console.log(`Completed! Pool market contract deployed at ${poolmarketContract.address}`);
  return poolmarketContract.address;
}

async function deployPayment(tokenAddress: string, registryAddress: string, poolmarketAddress: string) {
  console.log("Deploying payment contract");
  const paymentFactory = new ethers.ContractFactory(
    paymentJson.abi,
    paymentJson.bytecode,
    signer
  );
  const paymentContract = await paymentFactory.deploy(
    poolmarketAddress, tokenAddress, registryAddress
  );
  console.log("Awaiting confirmations");
  await paymentContract.deployed();
  console.log(`Completed! Payment contract deployed at ${paymentContract.address}`);
  return paymentContract.address;
}

async function main() {
  const tokenAddress = await deployEnergyToken();
  const registryAddress = await deployRegistry();
  const poolmarketAddress = await deployPoolMarket(registryAddress);
  // const paymentAddress = await deployPayment(poolmarketAddress, tokenAddress, registryAddress);

  console.log('Copy the following to the .env file:');
  console.log('=====================');
  console.log(`TOKEN_CONTRACT_ADDRESS = ${tokenAddress}`);
  console.log(`REGISTRY_CONTRACT_ADDRESS = ${registryAddress}`);
  console.log(`POOLMARKET_CONTRACT_ADDRESS = ${poolmarketAddress}`);
  // console.log(`PAYMENT_CONTRACT_ADDRESS = ${paymentAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});