import  { ethers, Contract } from "ethers";
import "dotenv/config";
import * as tokenJson from "../artifacts/contracts/EnergyToken.sol/EnergyToken.json";
import { exit } from "process";
import { EXPOSED_KEY, setupProvider } from "./utils";
import { EnergyToken } from "../typechain";

async function main() {
  const contractAddress: string = String(process.env.TOKEN_CONTRACT_ADDRESS);
  const priKey = process.env.PRIVATE_KEY ?? EXPOSED_KEY;
  const wallet = new ethers.Wallet(priKey ?? EXPOSED_KEY);
  const provider = setupProvider();
  const signer = wallet.connect(provider);
  const contractInstance: EnergyToken = new Contract(
    contractAddress,
    tokenJson.abi,
    signer
  ) as EnergyToken;
  console.log(`Contract attached to account ${wallet.address}`);


  let totalSupply = await contractInstance.totalSupply();
  console.log(`Total supply: ${totalSupply}`);

  let balance = await contractInstance.balanceOf(wallet.address);
  console.log(`Balance of ${wallet.address}: ${balance}`);

  const receiptWallet =  new ethers.Wallet(process.env.PRIVATE_KEY2 ?? EXPOSED_KEY);
  console.log('Transfering 20 tokens to ', receiptWallet.address);
  const transferTx = await contractInstance.transfer(receiptWallet.address, 20);
  await transferTx.wait();
  console.log(`New balances: `)

  totalSupply = await contractInstance.totalSupply();
  console.log(`Total supply: ${totalSupply}`);

  balance = await contractInstance.balanceOf(wallet.address);
  console.log(`Balance of ${wallet.address}: ${balance}`);

  let balance2 = await contractInstance.balanceOf(receiptWallet.address);
  console.log(`Balance of ${receiptWallet.address}: ${balance2}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

