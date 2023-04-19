import { ethers } from "ethers";
import "dotenv/config";
import * as _fs from "fs";
import * as tokenJson from "../artifacts/contracts/EnergyToken.sol/EnergyToken.json";
import * as registryJson from "../artifacts/contracts/Registry.sol/Registry.json";
import * as poolMarketJson from "../artifacts/contracts/PoolMarket.sol/PoolMarket.json";
import * as paymentJson from "../artifacts/contracts/Payment.sol/Payment.json";
import { EXPOSED_KEY, setupProvider } from "./utils";
import nodes from './nodes.json'

// Global parameters:
const envDirs = [
                ".env", 
                "/mnt/bpet-front/.env", 
                "/mnt/bpet-microservice/admin/.env", 
                "/mnt/bpet-microservice/etk/.env", 
                "/mnt/bpet-microservice/poolmarket/.env",
                "/mnt/bpet-microservice/register/.env"
              ]
const urlre = /:\/\/.*:854/g
const url = `://${nodes['besu-1']}:854`
const abiDirs = [
                "/mnt/bpet-microservice/admin/src/contracts",
                "/mnt/bpet-microservice/etk/src/contracts",
                "/mnt/bpet-microservice/poolmarket/src/contracts",
                "/mnt/bpet-microservice/register/src/contracts",
                "/mnt/bpet-front/utils/contracts"
                ]

const MINALLOWEDPRICE = 0;
const MAXALLOWEDPRICE = 100000; // 1000 dollors = 100,000 cents
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY ?? EXPOSED_KEY);
var provider = setupProvider();
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
  await tokenContract.deployTransaction.wait();
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
  await registryContract.deployTransaction.wait();
  console.log(
    `Completed! Registry contract deployed at ${registryContract.address}`
  );
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
    registryAddress,
    MINALLOWEDPRICE,
    MAXALLOWEDPRICE
  );
  console.log("Awaiting confirmations");
  await poolmarketContract.deployTransaction.wait();
  console.log(
    `Completed! Pool market contract deployed at ${poolmarketContract.address}`
  );
  return poolmarketContract.address;
}

async function deployPayment(
  tokenAddress: string,
  registryAddress: string,
  poolmarketAddress: string
) {
  console.log("Deploying payment contract");
  const paymentFactory = new ethers.ContractFactory(
    paymentJson.abi,
    paymentJson.bytecode,
    signer
  );
  const paymentContract = await paymentFactory.deploy(
    poolmarketAddress,
    tokenAddress,
    registryAddress
  );
  console.log("Awaiting confirmations");
  await paymentContract.deployTransaction.wait();
  console.log(
    `Completed! Payment contract deployed at ${paymentContract.address}`
  );
  return paymentContract.address;
}

async function main() {
  // update besu RPC URLs in the local .env file
  await updateURLs();

  // update ABIs to back-end microservices and front-end Dapp
  await updateABIs();

  // deploy contracts to besu
  const tokenAddress = await deployEnergyToken();
  const registryAddress = await deployRegistry();
  const poolmarketAddress = await deployPoolMarket(registryAddress);
  const paymentAddress = await deployPayment(
    poolmarketAddress,
    tokenAddress,
    registryAddress
  );

  console.log("=====================");
  console.log("Copy the following to the .env file:");
  console.log("=====================");
  console.log(`TOKEN_CONTRACT_ADDRESS = ${tokenAddress}`);
  console.log(`REGISTRY_CONTRACT_ADDRESS = ${registryAddress}`);
  console.log(`POOLMARKET_CONTRACT_ADDRESS = ${poolmarketAddress}`);
  console.log(`PAYMENT_CONTRACT_ADDRESS = ${paymentAddress}`);

  console.log("=====================");
  console.log("Updating contracts addresses in the .env files...");

  // post deployment: update deployed contract addresses to .env files
  await updateEnvFiles(
    tokenAddress,
    registryAddress,
    poolmarketAddress,
    paymentAddress
  );
}

async function updateABIs() {
  console.log('Updating front-end and back-end ABI JSON files ... ');
  for(var abiDir of abiDirs ) {
    try {
      const etkAbiPath = abiDir+'/EnergyToken.sol/EnergyToken.json';
      await _fs.promises.writeFile(etkAbiPath, JSON.stringify(tokenJson, undefined, 4), "utf8");
      const poomarketAbiPath = abiDir+'/PoolMarket.sol/PoolMarket.json';
      await _fs.promises.writeFile(poomarketAbiPath, JSON.stringify(poolMarketJson, undefined, 4), "utf8");
      const registryAbiPath = abiDir+'/Registry.sol/Registry.json';
      await _fs.promises.writeFile(registryAbiPath, JSON.stringify(registryJson, undefined, 4), "utf8");
      const paymentAbiPath = abiDir+'/Payment.sol/Payment.json';
      await _fs.promises.writeFile(paymentAbiPath, JSON.stringify(paymentJson, undefined, 4), "utf8");
    } catch (err) {
      console.log(err);
    }
  }
}

async function updateURLs() {
  console.log('Updating RPC URLs in the local .env file ... ');
    const firstUpdate = async () => {
      var dirpath = envDirs[0];
      try {
        const fileData = await _fs.promises.readFile(dirpath);
        var fileAsStr = fileData.toString("utf8").replace(urlre, url);
        await _fs.promises.writeFile(dirpath, fileAsStr, "utf8");
      } catch (err) {
        console.log(err);
      }
    }
    await firstUpdate();
  }

async function updateEnvFiles(
  tokenAddress: string,
  registryAddress: string,
  poolmarketAddress: string,
  paymentAddress: string
) {
  console.log('Post deployment: updating contract addressed to front-end and back-end .env files ... ');
  for(var dirpath of envDirs ) {
    try {
      const fileData = await _fs.promises.readFile(dirpath);
      var fileAsStr = fileData.toString("utf8").replaceAll(urlre, url);
      var str = fileAsStr.split("TOKEN_CONTRACT_ADDRESS")[0];
      var address1 = `TOKEN_CONTRACT_ADDRESS = ${tokenAddress}`;
      var address2 = `REGISTRY_CONTRACT_ADDRESS = ${registryAddress}`;
      var address3 = `POOLMARKET_CONTRACT_ADDRESS = ${poolmarketAddress}`;
      var address4 = `PAYMENT_CONTRACT_ADDRESS = ${paymentAddress}`;
      var addresses = `${address1}\n${address2}\n${address3}\n${address4}`;
      await _fs.promises.writeFile(dirpath, str + addresses, "utf8");
    } catch (err) {
      console.log(err);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
