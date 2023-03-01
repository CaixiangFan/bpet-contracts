import  { ethers, Contract } from "ethers";
import "dotenv/config";
import { EXPOSED_KEY, getRegistryContract } from "./utils";

async function main() {
  console.log('deleteUser.ts [supplier|consumer] accountToDelete');
  const args = process.argv.slice(2);
  const wallet_admin = new ethers.Wallet(process.env.PRIVATE_KEY ?? EXPOSED_KEY);
  const contract = getRegistryContract(wallet_admin);
  switch (args.length)
  {
    case 0:
      console.log('Please provide a type [supplier|consumer] and a valid account to be deleted!');
      break
    case 1:
      if (ethers.utils.isAddress(args[0])) {
        await contract.deleteSupplier(args[0]);
        await contract.deleteConsumer(args[0]);
        break
      }
      console.log('Please provide a valid account to be deleted!');
      break;
    case 2:
      switch (args[0]) 
      {
        case "supplier":
          if (ethers.utils.isAddress(args[1])) {
            await contract.deleteSupplier(args[1]);
            break
          }
          console.log('Please provide a valid account to be deleted!');
          break
        case "consumer":
          if (ethers.utils.isAddress(args[1])) {
            await contract.deleteConsumer(args[1]);
            break
          }
          console.log('Please provide a valid account to be deleted!');
          break
      }
  }
}


main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

