import { ethers, Contract, BigNumber } from "ethers";
import "dotenv/config";
import * as registryJson from "../artifacts/contracts/Registry.sol/Registry.json";
import * as tokenJson from "../artifacts/contracts/EnergyToken.sol/EnergyToken.json";
import { EXPOSED_KEY, setupProvider } from "./utils";
import { Registry, EnergyToken } from "../typechain";

function convertBigNumberToNumber(value: BigNumber): number {
  const decimals = 18;
  return Math.round(Number(ethers.utils.formatEther(value)) * 10 ** decimals);
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

async function getConsumers() {
  const registryContractInstance = await getRegistryContractInstance();
  const registeredConsumers = await registryContractInstance.getAllConsumers();
  // console.log("All registered consumer accounts:  ", registeredConsumers);
  return registeredConsumers;
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

async function mintETKForConsumers(amount: number, toAccounts: string[]) {
  const etkContractInstance = await getETKContractInstance();
  for (let i = 0; i < toAccounts.length; i++) {
    console.log(`Minting ${amount} ETK to ${toAccounts[i]}`);
    await etkContractInstance.mint(toAccounts[i], amount);
  }
}

async function queryETKForConsumers(accounts: string[]) {
  const etkContractInstance = await getETKContractInstance();
  for (let i = 0; i < accounts.length; i++) {
    var balanceBN = await etkContractInstance.balanceOf(accounts[i]);
    console.log(`${accounts[i]}: ${convertBigNumberToNumber(balanceBN)}`);
  }
}

async function main() {
  const consumers = await getConsumers();
  var cmd = process.argv.slice(2)[0];
  switch (cmd) {
    case "mint":
      await mintETKForConsumers(100000, consumers);
    case "query":
      await queryETKForConsumers(consumers);
      break;
    default:
      console.log("Please give a command: mint/query.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
