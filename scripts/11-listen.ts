import { ethers, BigNumber } from "ethers";
import "dotenv/config";
import * as registryJson from "../artifacts/contracts/Registry.sol/Registry.json";
import {
  getPoolMarketContract,
  getETKContract,
  EXPOSED_KEY,
  convertBigNumberToNumber,
} from "./utils";



async function listenPoolmarketEvents() {
  console.log("Listening to Poolmarket contract...");
  const priKey = process.env.PRIVATE_KEY ?? EXPOSED_KEY;
  const wallet = new ethers.Wallet(priKey ?? EXPOSED_KEY);
  const poolmarketContractInstance = getPoolMarketContract(wallet);

  const listener = (amount: BigNumber, price: BigNumber, sender: string, event: object) => {
    let result = {
      amount: convertBigNumberToNumber(amount),
      price: convertBigNumberToNumber(price),
      sender: sender,
      data: event,
    };
    console.log(JSON.stringify(result, null, 4));
  };

  poolmarketContractInstance.on("OfferSubmitted", listener);
  poolmarketContractInstance.on("BidSubmitted", listener);
}

async function listenETKEvents() {
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY ?? EXPOSED_KEY);
  const tokenContractInstance = getETKContract(wallet);
  console.log("Listening to ETK contract...");
  tokenContractInstance.on("Transfer", (log) => {
    console.log({ log });
  });
}

async function main() {
  listenPoolmarketEvents();
  listenETKEvents();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
