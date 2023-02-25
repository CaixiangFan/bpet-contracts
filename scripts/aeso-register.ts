import { ethers, Contract } from "ethers";
import "dotenv/config";
import { parse } from "csv-parse";
import * as path from "path";
import * as fs from "fs";
import * as registryJson from "../artifacts/contracts/Registry.sol/Registry.json";
import { EXPOSED_KEY, setupGoerliProvider, setupProvider } from "./utils";
import { Registry } from "../typechain";

type Register = {
  Index: any;
  AssetId: string;
  BlockNumber: number;
  Capacity: number;
  OfferControl: string;
}

function getContract(wallet: ethers.Wallet): Registry {
  var provider = setupGoerliProvider();
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

  return registryContractInstance;
}

async function main() {
  const DEFAULT_PATH = ethers.utils.defaultPath;
  const DEFAULT_MNEMONIC = 'upset fuel enhance depart portion hope core animal innocent will athlete snack';

  const csvFilePath = path.resolve(__dirname, '../aeso/Registry_20220301_20220314.csv');
  const headers = ['Index', 'AssetId', 'BlockNumber', 'Capacity', 'OfferControl'];
  const fileContent = fs.readFileSync(csvFilePath, { encoding: 'utf-8' });
  
  parse(fileContent, {
    delimiter: ',',
    columns: headers,
  }, async (error, result: Register[]) => {
    if (error) {
      console.error(error);
    }
    const MNEMONIC = process.env.DEFAULT_MNEMONIC ?? DEFAULT_MNEMONIC
    const registeredData = {};
    // skip the header line
    for (let i = 1; i < result.length; i++) {
      const path = DEFAULT_PATH + i
      const wallet = ethers.Wallet.fromMnemonic(MNEMONIC, path)
      
      result[i].Index = wallet.privateKey;
      // registeredData[result[i].AssetId as keyof Register] = result[i];
      const registryContract = getContract(wallet);
      const registerTx = await registryContract.registerSupplier(
        wallet.address,
        result[i].AssetId,
        result[i].BlockNumber,
        result[i].Capacity,
        result[i].OfferControl
      );
      await registerTx.wait();
      console.log(registerTx);
    }
    console.log(result);
    let json = JSON.stringify({registry: result});
    fs.writeFile('./aeso/registry.json', json, 'utf8', (error) => {console.log(error)});
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
