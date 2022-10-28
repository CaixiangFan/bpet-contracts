import { ethers, Contract } from "ethers";
import "dotenv/config";
import * as registryJson from "../artifacts/contracts/Registry.sol/Registry.json";
import * as tokenJson from "../artifacts/contracts/EnergyToken.sol/EnergyToken.json";
import { EXPOSED_KEY, setupProvider, setupGoerliProvider } from "./utils";
import { Registry, EnergyToken } from "../typechain";

async function main() {
  var provider = setupGoerliProvider();
  const network = process.env.PROVIDER_NETWORK;
  if (network === "Besu") {
    provider = setupProvider();
  }

  const registryContractAddress = String(process.env.REGISTRY_CONTRACT_ADDRESS);
  const priKey = process.env.PRIVATE_KEY ?? EXPOSED_KEY;
  const wallet = new ethers.Wallet(priKey ?? EXPOSED_KEY);
  const registrySigner = wallet.connect(provider);
  const registryContractInstance: Registry = new Contract(
    registryContractAddress,
    registryJson.abi,
    registrySigner
  ) as Registry;

  const registeredSuppliers = await registryContractInstance.getAllSuppliers();
  console.log("All registered supplier accounts:  ", registeredSuppliers);

  const registeredConsumers = await registryContractInstance.getAllConsumers();
  console.log("All registered consumer accounts:  ", registeredConsumers);

  await getSuppliersInfo(registeredSuppliers, registryContractInstance);
  await getConsumersInfo(registeredConsumers, registryContractInstance);
}

async function getSuppliersInfo(
  supplierAccounts: string[],
  registryContractInstance: Registry
) {
  if (supplierAccounts.length !== 0) {
    for (let i = 0; i < supplierAccounts.length; i++) {
      let registryInfo = await registryContractInstance.getSupplier(
        supplierAccounts[i]
      );
      console.log(
        supplierAccounts[i],
        registryInfo.assetId,
        registryInfo.blockAmount,
        registryInfo.capacity,
        registryInfo.offerControl
      );
    }
  }
}

async function getConsumersInfo(
  consumerAccounts: string[],
  registryContractInstance: Registry
) {
  if (consumerAccounts.length !== 0) {
    for (let i = 0; i < consumerAccounts.length; i++) {
      let registryInfo = await registryContractInstance.getConsumer(
        consumerAccounts[i]
      );
      console.log(
        consumerAccounts[i],
        registryInfo.assetId,
        registryInfo.load,
        registryInfo.offerControl
      );
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
