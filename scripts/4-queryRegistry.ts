import { ethers } from "ethers";
import "dotenv/config";
import { EXPOSED_KEY, getRegistryContract } from "./utils";
import { Registry } from "../typechain";

async function main() {
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY ?? EXPOSED_KEY);
  const registryContractInstance = getRegistryContract(wallet);

  const registeredSuppliers = await registryContractInstance.getAllSuppliers();
  console.log("All registered supplier accounts:  ", registeredSuppliers);
  console.log("Total registered supplier accounts #:  ", registeredSuppliers.length);

  const registeredConsumers = await registryContractInstance.getAllConsumers();
  console.log("All registered consumer accounts:  ", registeredConsumers);
  console.log("Total registered consumer accounts #:  ", registeredConsumers.length);

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
