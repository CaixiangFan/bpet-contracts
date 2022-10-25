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
  const wallet_consumer1 = new ethers.Wallet(process.env.CONSUMER1_PRIVATE_KEY ?? EXPOSED_KEY);
  const wallet_consumer2 = new ethers.Wallet(process.env.CONSUMER2_PRIVATE_KEY ?? EXPOSED_KEY);
  const wallet_consumer3 = new ethers.Wallet(process.env.CONSUMER3_PRIVATE_KEY ?? EXPOSED_KEY);
  const wallet_supplier1 = new ethers.Wallet(process.env.SUPPLIER1_PRIVATE_KEY ?? EXPOSED_KEY);
  const wallet_supplier2 = new ethers.Wallet(process.env.SUPPLIER2_PRIVATE_KEY ?? EXPOSED_KEY);
  const wallet_supplier3 = new ethers.Wallet(process.env.SUPPLIER3_PRIVATE_KEY ?? EXPOSED_KEY);

  console.log('Registered Consumer1 ', wallet_consumer1.address);
  const registryContract1 = getContract(wallet_consumer1);
  const registerConsumerTx1 = await registryContract1.registerConsumer(
    wallet_consumer1.address,
    "CONSUMER1",
    200,
    "Alberta Consumer Ltd1"
  );
  await registerConsumerTx1.wait()

  console.log('Registered Consumer2 ', wallet_consumer2.address);
  const registryContract2 = getContract(wallet_consumer1);
  const registerConsumerTx2 = await registryContract2.registerConsumer(
    wallet_consumer2.address,
    "CONSUMER2",
    300,
    "Alberta Consumer Ltd2"
  );
  await registerConsumerTx2.wait()
  
  console.log('Registered Consumer3 ', wallet_consumer3.address);
  const registryContract3 = getContract(wallet_consumer1);
  const registerConsumerTx3 = await registryContract3.registerConsumer(
    wallet_consumer3.address,
    "CONSUMER3",
    400,
    "Alberta Consumer Ltd3"
  );
  await registerConsumerTx3.wait()
  
  console.log('Registered Supplier1 ', wallet_supplier1.address);
  const registryContract4 = getContract(wallet_supplier1);
  const registerSupplierTx1 = await registryContract4.registerSupplier(
    wallet_supplier1.address,
    "SUPPLIER1",
    2,
    300,
    "Alberta Solar Farm Ltd1"
  );
  await registerSupplierTx1.wait()
  
  console.log('Registered Supplier2 ', wallet_supplier2.address);
  const registryContract5 = getContract(wallet_supplier2);
  const registerSupplierTx2 = await registryContract5.registerSupplier(
    wallet_supplier2.address,
    "SUPPLIER2",
    3,
    350,
    "Alberta Enmax Ltd2"
  );
  await registerSupplierTx2.wait()
  
  console.log('Registered Supplier3 ', wallet_supplier3.address);
  const registryContract6 = getContract(wallet_supplier3);
  const registerSupplierTx3 = await registryContract6.registerSupplier(
    wallet_supplier3.address,
    "SUPPLIER3",
    4,
    500,
    "Alberta Supplier Ltd3"
  );
  await registerSupplierTx3.wait()

  const wallet_admin = new ethers.Wallet(process.env.PRIVATE_KEY ?? EXPOSED_KEY);
  const contract = getContract(wallet_admin);
  const registeredSuppliers =  await contract.getAllSuppliers();
  console.log('Registered Suppliers:  ', registeredSuppliers);

  const registeredConsumers =  await contract.getAllConsumers();
  console.log('Registered Consumers:  ', registeredConsumers);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

