import { ethers } from "ethers";
import "dotenv/config";
import { parse } from "csv-parse";
import * as path from "path";
import * as fs from "fs";
import { getRegistryContract } from "./utils";

type Register = {
  Index: any;
  AssetId: string;
  BlockNumber: number;
  Capacity: number;
  OfferControl: string;
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
    var registeredData = new Map<string, Register>();
    // skip the header line
    for (let i = 1; i < result.length; i++) {
      const path = DEFAULT_PATH + i
      const wallet = ethers.Wallet.fromMnemonic(MNEMONIC, path)
      
      result[i].Index = wallet.privateKey;
      registeredData.set(result[i].AssetId, result[i]);
      const registryContract = getRegistryContract(wallet);
      const registerTx = await registryContract.registerSupplier(
        wallet.address,
        result[i].AssetId,
        result[i].BlockNumber,
        result[i].Capacity,
        result[i].OfferControl
      );
      // await registerTx.wait();
      // console.log(registerTx);
    }
    const jsonObj = Object.fromEntries(registeredData);
    console.log(JSON.stringify(jsonObj, undefined, 4));
    fs.writeFile(
      './aeso/Registry_20220301_20220314.json', 
      JSON.stringify(jsonObj, undefined, 4), 
      'utf8', 
      (error) => {console.log(error)});
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
