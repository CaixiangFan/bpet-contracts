import  { ethers, Contract } from "ethers";
import "dotenv/config";
import * as registryJson from "../artifacts/contracts/Registry.sol/Registry.json";
import * as tokenJson from "../artifacts/contracts/EnergyToken.sol/EnergyToken.json";
import { exit } from "process";
import { EXPOSED_KEY, setupProvider, setupGoerliProvider } from "./utils";
import { Registry,EnergyToken } from "../typechain";

async function main() {
  const provider = setupGoerliProvider();
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

  const supplierWallet = new ethers.Wallet(process.env.PRIVATE_KEY_3 ?? EXPOSED_KEY);
  const registeredInfo =  await registryContractInstance.getSupplier(supplierWallet.address);
  console.log('Registered supplier info:  ', registeredInfo);
  console.log(ethers.utils.formatBytes32String(registeredInfo.assetId));
  console.log(ethers.utils.formatBytes32String(registeredInfo.offerControl));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

