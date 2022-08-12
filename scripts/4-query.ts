import  { ethers, Contract } from "ethers";
import "dotenv/config";
import * as registryJson from "../artifacts/contracts/Registry.sol/Registry.json";
import * as tokenJson from "../artifacts/contracts/EnergyToken.sol/EnergyToken.json";
import { exit } from "process";
import { EXPOSED_KEY, setupProvider } from "./utils";
import { Registry,EnergyToken } from "../typechain";

async function main() {
  const provider = setupProvider();
  const registryContractAddress = String(process.env.REGISTRY_CONTRACT_ADDRESS);
  const priKey = process.env.PRIVATE_KEY ?? EXPOSED_KEY;
  const wallet = new ethers.Wallet(priKey ?? EXPOSED_KEY);
  const registrySigner = wallet.connect(provider);
  const registryContractInstance: Registry = new Contract(
    registryContractAddress,
    registryJson.abi,
    registrySigner
  ) as Registry;

  const registeredSuppliers =  await registryContractInstance.getAllSuppliers();
  console.log('All registered supplier accounts:  ', registeredSuppliers);

  const registeredConsumers =  await registryContractInstance.getAllConsumers();
  console.log('All registered consumer accounts:  ', registeredConsumers);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

