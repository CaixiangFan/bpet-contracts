import  { ethers, Contract } from "ethers";
import "dotenv/config";
import * as registryJson from "../artifacts/contracts/Registry.sol/Registry.json";
import { exit } from "process";
import { EXPOSED_KEY, setupGoerliProvider } from "./utils";
import { Registry } from "../typechain";

async function main() {
  const provider = setupGoerliProvider();
  const registryContractAddress = String(process.env.REGISTRY_CONTRACT_ADDRESS);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY ?? EXPOSED_KEY);
  const registrySigner = wallet.connect(provider);
  const registryContractInstance: Registry = new Contract(
    registryContractAddress,
    registryJson.abi,
    registrySigner
  ) as Registry;

  const registeredSuppliers =  await registryContractInstance.getAllSuppliers();
  console.log('Initial registered supplier accounts:  ', registeredSuppliers);

  const registeredConsumers =  await registryContractInstance.getAllConsumers();
  console.log('Initial registered consumer accounts:  ', registeredConsumers);

  const registerSupplierTx = await registryContractInstance.registerSupplier(
    "ENG01", 4, 500, "Albera Enmax Ltd."
    );
  await registerSupplierTx.wait();

  const registerConsumerTx = await registryContractInstance.registerConsumer(
    "FACTORY1", 300, "Alberta Food Ltd."
    );
  await registerConsumerTx.wait();

  const newregisteredSuppliers =  await registryContractInstance.getAllSuppliers();
  console.log('New registered supplier accounts:  ', newregisteredSuppliers);

  const newregisteredConsumers =  await registryContractInstance.getAllConsumers();
  console.log('New registered consumer accounts:  ', newregisteredConsumers);

  const registeredSupplierInfo =  await registryContractInstance.getSupplier(wallet.address);
  console.log('Registered Supplier info:  ', registeredSupplierInfo);

  const registeredConsumerInfo =  await registryContractInstance.getConsumer(wallet.address);
  console.log('Registered Supplier info:  ', registeredConsumerInfo);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

