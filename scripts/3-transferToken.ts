import  { ethers, Contract } from "ethers";
import "dotenv/config";
import * as tokenJson from "../artifacts/contracts/EnergyToken.sol/EnergyToken.json";
import { exit } from "process";
import { EXPOSED_KEY, setupProvider } from "./utils";
import { EnergyToken } from "../typechain";

async function main() {
  const contractAddress: string = String(process.env.TOKEN_CONTRACT_ADDRESS);
  const priKey = process.env.PRIVATE_KEY2 ?? EXPOSED_KEY;
  const fromWallet = new ethers.Wallet(priKey ?? EXPOSED_KEY);
  const provider = setupProvider();
  const signer = fromWallet.connect(provider);
  const contractInstance: EnergyToken = new Contract(
    contractAddress,
    tokenJson.abi,
    signer
  ) as EnergyToken;
  console.log(`Contract attached to account ${fromWallet.address}`);
  let balanceFrom = await contractInstance.balanceOf(fromWallet.address);
  console.log(`Energy Token balance of ${fromWallet.address} is ${balanceFrom}`);

  let totalSupply = await contractInstance.totalSupply();
  console.log(`Total supply: ${totalSupply}`);

  const toWallet =  new ethers.Wallet(process.env.PRIVATE_KEY ?? EXPOSED_KEY);
  console.log('Transfering 100 energy tokens to ', toWallet.address);
  const transferTx = await contractInstance.transfer(toWallet.address, 100);
  await transferTx.wait();

  let newBalanceFrom = await contractInstance.balanceOf(fromWallet.address);
  console.log(`New energy token balance of ${fromWallet.address} is ${newBalanceFrom} `);

  let balance2 = await contractInstance.balanceOf(toWallet.address);
  console.log(`Balance of ${toWallet.address}: ${balance2}`);

  totalSupply = await contractInstance.totalSupply();
  console.log(`Total supply: ${totalSupply}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

