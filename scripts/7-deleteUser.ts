import  { ethers, Contract } from "ethers";
import "dotenv/config";
import * as registryJson from "../artifacts/contracts/Registry.sol/Registry.json";
import { EXPOSED_KEY, setupGoerliProvider,setupProvider } from "./utils";
import { Registry } from "../typechain";

function getContract(wallet: ethers.Wallet): Registry {
  var provider = setupGoerliProvider()
  const network = process.env.PROVIDER_NETWORK;
  if (network === "Besu") {
    provider = setupProvider();
  }

  const registryContractAddress = String(process.env.REGISTRY_CONTRACT_ADDRESS);
  const registrySigner = wallet.connect(provider);
  const registryContractInstance: Registry = new Contract(
    registryContractAddress,
    registryJson.abi,
    registrySigner
  ) as Registry;

  return registryContractInstance
}

async function main() {
  const addrs = [process.env.SUPPLIER1 ?? EXPOSED_KEY, 
                process.env.SUPPLIER2 ?? EXPOSED_KEY,
                process.env.SUPPLIER3 ?? EXPOSED_KEY]
  const wallet_admin = new ethers.Wallet(process.env.PRIVATE_KEY ?? EXPOSED_KEY);
  const contract = getContract(wallet_admin);
  console.log("Deleting ... :", addrs);
  for (var addr of addrs) {
    const deleteUserTx = await contract.deleteSupplier(addr);
    await deleteUserTx.wait();
  }

  const registeredSuppliers =  await contract.getAllSuppliers();
  console.log('Registered Suppliers #:  ', registeredSuppliers.length);

  const registeredConsumers =  await contract.getAllConsumers();
  console.log('Registered Consumers #:  ', registeredConsumers.length);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

