import { ethers } from "ethers";
import "dotenv/config";
import { parse } from "csv-parse";
import * as path from "path";
import * as fs from "fs";
import * as registryJson from "../aeso/Registry_20220301_20220314.json";
import { EXPOSED_KEY, getPoolMarketContract } from "./utils";

type SubmitOffer = {
  Index: number;
  Date: string;
  HE: number;
  AssetId: string;
  BlockNumber: number;
  Price: number;
  From: number;
  To: number;
  Size: number;
  AvailableMW: number;
  OfferControl: string;
}

async function main() {
  const csvFilePath = path.resolve(__dirname, '../aeso/SubmitOffer_20220301_20220314.csv');
  const headers = [ 'Index', 
                    'Date', 
                    'HE', 
                    'AssetId', 
                    'BlockNumber', 
                    'Price',
                    'From',
                    'To',
                    'Size',
                    'AvailableMW',
                    'OfferControl'
                  ];
  const fileContent = fs.readFileSync(csvFilePath, { encoding: 'utf-8' });
  
  parse(fileContent, {
    delimiter: ',',
    columns: headers,
  }, async (error, result: SubmitOffer[]) => {
    if (error) {
      console.error(error);
    }

    // convert json object to map for faster retrieve
    let registeredUsers = new Map(Object.entries(registryJson));
    // skip the header line
    for (let i = 1; i < result.length; i++) {
      // TODO: improve offer submission perforamnce
      // 1. for each day, iterate hours ending from 1 to 24
      // 2. compare current offers with previous hour, submit new offers and delete non-existing ones
      // 3. use async process
      if (result[i].Date == "2022-03-01" && result[i].HE == 1) {
        const priKey = registeredUsers.get(result[i].AssetId)?.Index ?? EXPOSED_KEY;
        const wallet = new ethers.Wallet(priKey);
        const contract = getPoolMarketContract(wallet);
        const submitOfferTx = await contract.submitOffer(
          result[i].BlockNumber,
          result[i].AvailableMW,
          result[i].Price
        );
        await submitOfferTx.wait();
        console.log(submitOfferTx.hash, 
          result[i].BlockNumber,
          result[i].AvailableMW,
          result[i].Price);
      }
    }
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
