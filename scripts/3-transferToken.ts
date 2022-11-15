import { ethers, Contract, BigNumber } from "ethers";
import "dotenv/config";
import * as tokenJson from "../artifacts/contracts/EnergyToken.sol/EnergyToken.json";
import { EXPOSED_KEY, setupProvider } from "./utils";
import { EnergyToken } from "../typechain";

function convertBigNumberToNumber(value: BigNumber): number {
  const decimals = 18;
  return Math.round(Number(ethers.utils.formatEther(value)) * 10 ** decimals);
}

async function main() {
  const contractAddress: string = String(process.env.TOKEN_CONTRACT_ADDRESS);
  const priKey = process.env.PRIVATE_KEY ?? EXPOSED_KEY;
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
  let initBalance = convertBigNumberToNumber(balanceFrom);
  if (initBalance === 0) {
    let etkAmount = 10000;
    console.log(`Minting ${etkAmount} ETK to ${fromWallet.address}`);
    let mintTx = await contractInstance.mint(fromWallet.address, etkAmount);
    await mintTx.wait();
    balanceFrom = await contractInstance.balanceOf(fromWallet.address);
  }
  console.log(
    `Energy Token balance of fromAddress ${fromWallet.address} is ${balanceFrom}`
  );

  const receiver_addr = process.env.ETK_RECEIVER ?? fromWallet.address;
  let balanceToBN = await contractInstance.balanceOf(receiver_addr);
  let balanceTo = convertBigNumberToNumber(balanceToBN);
  console.log(
    `Energy Token balance of toAddress ${receiver_addr} is ${balanceTo}`
  );

  let totalSupply = await contractInstance.totalSupply();
  console.log(`Total supply: ${totalSupply}`);

  const toWallet = new ethers.Wallet(
    process.env.ETK_RECEIVER_PRIVATE_KEY ?? EXPOSED_KEY
  );
  console.log("Transfering 100 energy tokens to ", toWallet.address);
  const transferTx = await contractInstance.transfer(toWallet.address, 100);
  await transferTx.wait();

  let newBalanceFrom = await contractInstance.balanceOf(fromWallet.address);
  console.log(
    `New energy token balance of ${fromWallet.address} is ${newBalanceFrom} `
  );

  let balance2 = await contractInstance.balanceOf(toWallet.address);
  console.log(`New balance of ${toWallet.address}: ${balance2}`);

  totalSupply = await contractInstance.totalSupply();
  console.log(`Total supply: ${totalSupply}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
