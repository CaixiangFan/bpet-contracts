import * as poolmarketJson from "../artifacts/contracts/PoolMarket.sol/PoolMarket.json";
import { ethers, Contract } from "ethers";
import { setupProvider, EXPOSED_KEY, DEFAULT_RECEIVER } from "./utils";
import { PoolMarket } from "../typechain";

async function submitBid(amount: number, price: number) {
  const poolmarketContractAddress =
    process.env.POOLMARKET_CONTRACT_ADDRESS ?? DEFAULT_RECEIVER;
  const wallet = new ethers.Wallet(
    process.env.CONSUMER1_PRIVATE_KEY ?? EXPOSED_KEY
  );
  const provider = setupProvider();
  const poolmarketSigner = wallet.connect(provider);
  const poolmarketContractInstance: PoolMarket = new Contract(
    poolmarketContractAddress,
    poolmarketJson.abi,
    poolmarketSigner
  ) as PoolMarket;
  poolmarketContractAddress;

  const tx = await poolmarketContractInstance.submitBid(amount, price);
  console.log(tx.data);
}

async function main() {
  await submitBid(200, 45);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
