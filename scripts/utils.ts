import { Bytes, ethers, BigNumber } from "ethers";
import "dotenv/config";
import * as tokenJson from "../artifacts/contracts/EnergyToken.sol/EnergyToken.json";
import { exit } from "process";

const EXPOSED_KEY =
  "8da4ef21b864d2cc526dbdb2a120bd2874c36c9d0a1fb7f8c63d7f7a8b41de8f";
const DEFAULT_RECEIVER = "0x8b7A99C5A9FD537370d94b68FBaf3F3FAfb50083";

function setupProvider() {
  const provider = ethers.providers.getDefaultProvider(process.env.BESU_URL);
  return provider;
}

async function attach(contractAddress: string, priKey: string) {
  if (contractAddress && ethers.utils.isAddress(contractAddress)) {
    const wallet = new ethers.Wallet(priKey ?? EXPOSED_KEY);
    const provider = setupProvider();
    const signer = wallet.connect(provider);
    const balanceBN = await signer.getBalance();
    const balance = Number(ethers.utils.formatEther(balanceBN));
    console.log(`Wallet balance ${balance}`);
    if (balance < 0.01) {
      throw new Error("Not enough ether");
    }
    console.log("attaching token contract");
    const contractInstance = new ethers.Contract(
      contractAddress,
      tokenJson.abi,
      signer
    );
    console.log(`Contract attached to account ${contractInstance.address}`);
    return { contractInstance, provider, signer };
  } else {
    console.log("Please provide a valid smart contract address.");
    exit();
  }
}

function convertStringArrayToBytes32(array: string[]) {
  const bytes32Array = [];
  for (let index = 0; index < array.length; index++) {
    bytes32Array.push(ethers.utils.formatBytes32String(array[index]));
  }
  return bytes32Array;
}

function convertBigNumberToNumber(value: BigNumber): number {
  const decimals = 18;
  return Math.round(Number(ethers.utils.formatEther(value)) * 10 ** decimals);
}

function setupGoerliProvider() {
  const infuraOptions = process.env.INFURA_API_KEY
    ? process.env.INFURA_API_SECRET
      ? {
          projectId: process.env.INFURA_API_KEY,
          projectSecret: process.env.INFURA_API_SECRET,
        }
      : process.env.INFURA_API_KEY
    : "";
  const options = {
    alchemy: process.env.ALCHEMY_API_KEY,
    infura: infuraOptions,
  };
  const provider = ethers.providers.getDefaultProvider("goerli", options);
  return provider;
}

export {
  EXPOSED_KEY,
  setupProvider,
  setupGoerliProvider,
  convertStringArrayToBytes32,
  attach,
  DEFAULT_RECEIVER,
  convertBigNumberToNumber,
};
