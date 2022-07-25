import { ethers } from "ethers";
import "dotenv/config";
import * as registryJson from "../artifacts/contracts/Registry.sol/Registry.json";
import { EXPOSED_KEY, setupProvider } from "./utils";

const INIT_TOKEN = 100;
const PURCHASE_RATIO = 1;

async function main() {
  const wallet =
    process.env.MNEMONIC && process.env.MNEMONIC.length > 0
      ? ethers.Wallet.fromMnemonic(process.env.MNEMONIC)
      : new ethers.Wallet(process.env.PRIVATE_KEY ?? EXPOSED_KEY);
  console.log(`Using address ${wallet.address}`);
  const provider = setupProvider();
  const signer = wallet.connect(provider);

  const balanceBN = await signer.getBalance();
  const balance = Number(ethers.utils.formatEther(balanceBN));
  console.log(`Wallet balance ${balance}`);
  if (balance < 0.01) {
    throw new Error("Not enough ether");
  }
  console.log("Deploying Registry contract");
  const registryFactory = new ethers.ContractFactory(
    registryJson.abi,
    registryJson.bytecode,
    signer
  );
  const tokenAddress = String(process.env.TOKEN_CONTRACT_ADDRESS);
  const registryContract = await registryFactory.deploy(
    INIT_TOKEN, PURCHASE_RATIO, tokenAddress
  );
  console.log("Awaiting confirmations");
  await registryContract.deployed();
  console.log("Completed");
  console.log(`Contract deployed at ${registryContract.address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});