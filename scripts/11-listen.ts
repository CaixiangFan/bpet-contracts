import { ethers, Contract } from "ethers";
import "dotenv/config";
import * as poolmarketJson from "../artifacts/contracts/EnergyToken.sol/EnergyToken.json";
import * as tokenJson from "../artifacts/contracts/EnergyToken.sol/EnergyToken.json";
import * as registryJson from "../artifacts/contracts/Registry.sol/Registry.json";
import {
  EXPOSED_KEY,
  setupProvider,
  DEFAULT_RECEIVER,
  convertBigNumberToNumber,
} from "./utils";
import { PoolMarket, EnergyToken, Registry } from "../typechain";

async function getPoolmarketContractInstance() {
  const poolmarketContractAddress = String(
    process.env.POOLMARKET_CONTRACT_ADDRESS
  );
  const priKey = process.env.PRIVATE_KEY ?? EXPOSED_KEY;
  const wallet = new ethers.Wallet(priKey ?? EXPOSED_KEY);
  const provider = setupProvider();
  const poolmarketSigner = wallet.connect(provider);
  const poolmarketContractInstance: PoolMarket = new Contract(
    poolmarketContractAddress,
    poolmarketJson.abi,
    poolmarketSigner
  ) as PoolMarket;
  return poolmarketContractInstance;
}

async function getETKContractInstance() {
  const contractAddress: string = String(process.env.TOKEN_CONTRACT_ADDRESS);
  const priKey = process.env.PRIVATE_KEY ?? EXPOSED_KEY;
  const fromWallet = new ethers.Wallet(priKey ?? EXPOSED_KEY);
  const provider = setupProvider();
  const signer = fromWallet.connect(provider);
  const etkContractInstance: EnergyToken = new Contract(
    contractAddress,
    tokenJson.abi,
    signer
  ) as EnergyToken;
  return etkContractInstance;
}

async function listenPoolmarketEvents() {
  console.log("Listening to Poolmarket contract...");
  const poolmarketContractInstance = await getPoolmarketContractInstance();
  poolmarketContractInstance.on(
    "OfferSubmitted",
    (amount, price, sender, event) => {
      let offer = {
        amount: convertBigNumberToNumber(amount),
        price: convertBigNumberToNumber(price),
        sender: sender,
        data: event,
      };
      console.log(JSON.stringify(offer, null, 4));
    }
  );
}

async function getRegistryContractInstance() {
  const registryContractAddress = String(process.env.REGISTRY_CONTRACT_ADDRESS);
  const priKey = process.env.PRIVATE_KEY ?? EXPOSED_KEY;
  const wallet = new ethers.Wallet(priKey ?? EXPOSED_KEY);
  const provider = setupProvider();
  const registrySigner = wallet.connect(provider);
  const registryContractInstance: Registry = new Contract(
    registryContractAddress,
    registryJson.abi,
    registrySigner
  ) as Registry;
  return registryContractInstance;
}

async function listenETKEvents() {
  const tokenContractInstance = await getETKContractInstance();
  const receiver = process.env.ETK_RECEIVER ?? DEFAULT_RECEIVER;
  console.log("Transfering 1 token to receiver ...");
  const transferTx = await tokenContractInstance.transfer(receiver, 1);
  await transferTx.wait();
  console.log("Listening to ETK contract...");
  tokenContractInstance.on("Transfer", (log) => {
    console.log({ log });
  });

  const filter = tokenContractInstance.filters.Transfer();
  const provider = setupProvider();
  provider.on(filter, (log) => {
    console.log({ log });
  });
}

async function getConsumers() {
  const registryContractInstance = await getRegistryContractInstance();
  const registeredConsumers = await registryContractInstance.getAllConsumers();
  // console.log("All registered consumer accounts:  ", registeredConsumers);
  return registeredConsumers;
}

async function queryETKForConsumers(accounts: string[]) {
  const etkContractInstance = await getETKContractInstance();
  for (let i = 0; i < accounts.length; i++) {
    var balanceBN = await etkContractInstance.balanceOf(accounts[i]);
    console.log(`${accounts[i]}: ${convertBigNumberToNumber(balanceBN)}`);
  }
}

async function main() {
  listenPoolmarketEvents();
  // const accounts = await getConsumers();
  // await queryETKForConsumers(accounts);
  // listenETKEvents();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
