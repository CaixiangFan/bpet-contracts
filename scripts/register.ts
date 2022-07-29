import  { ethers, Contract } from "ethers";
import "dotenv/config";
import * as registryJson from "../artifacts/contracts/Registry.sol/Registry.json";
import * as tokenJson from "../artifacts/contracts/EnergyToken.sol/EnergyToken.json";
import { exit } from "process";
import { EXPOSED_KEY, setupProvider } from "./utils";
import { Registry,EnergyToken } from "../typechain";

async function main() {
  const tokenContractAddress: string = String(process.env.TOKEN_CONTRACT_ADDRESS);
  const priKey = process.env.PRIVATE_KEY ?? EXPOSED_KEY;
  const wallet = new ethers.Wallet(priKey ?? EXPOSED_KEY);
  const provider = setupProvider();
  const tokenSigner = wallet.connect(provider);
  const tokenContractInstance: EnergyToken = new Contract(
    tokenContractAddress,
    tokenJson.abi,
    tokenSigner
  ) as EnergyToken;

  const registryContractAddress = String(process.env.REGISTRY_CONTRACT_ADDRESS);
  const priKey2 = process.env.PRIVATE_KEY2 ?? EXPOSED_KEY;
  const wallet2 = new ethers.Wallet(priKey2 ?? EXPOSED_KEY);
  const registrySigner = wallet2.connect(provider);
  const registryContractInstance: Registry = new Contract(
    registryContractAddress,
    registryJson.abi,
    registrySigner
  ) as Registry;


  let totalSupply = await tokenContractInstance.totalSupply();
  console.log(`Total supply before registration: ${totalSupply}`);

  let balance = await tokenContractInstance.balanceOf(wallet2.address);
  console.log(`Balance of ${wallet2.address}: ${balance}`);

  console.log(`Granting minter role to ${registryContractInstance.address}`);
  const minterRole = await tokenContractInstance.MINTER_ROLE();
  const minterRoleTx = await tokenContractInstance.grantRole(
    minterRole,
    registryContractInstance.address
  );
  await minterRoleTx.wait();

  const registerSupplierTx = await registryContractInstance.registerSupplier(
    "ENG03", 3, 500, "Albera Energy Ltd.", {value: 1000}
    );
  await registerSupplierTx.wait();

  totalSupply = await tokenContractInstance.totalSupply();
  console.log(`Total supply after registration: ${totalSupply}`);

  balance = await tokenContractInstance.balanceOf(wallet2.address);
  console.log(`Balance of ${wallet2.address}: ${balance}`);

  const registrationInfo =  await registryContractInstance.getSupplier(wallet2.address);
  console.log('Registered info:  ', registrationInfo);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

