import { ethers } from "ethers";
import "dotenv/config";
import { parse } from "csv-parse";
import * as path from "path";
import * as fs from "fs";
import * as registryJson from "../aeso/Registry_20220301_20220314.json";
import { EXPOSED_KEY, getPoolMarketContract } from "./utils";

type SubmitOffer = {
  Index: number;
  Merge: string;
  Date: string;
  HE: number;
  AssetId: string;
  BlockNumber: number;
  Price: number;
  AvailableMW: number;
  OfferControl: string;
};

async function main() {
  const csvFilePath = path.resolve(
    __dirname,
    "../aeso/SubmitOffer_20220301_20220314.csv"
  );
  const headers = [
    "Index",
    "Merge",
    "Date",
    "HE",
    "AssetId",
    "BlockNumber",
    "Price",
    "AvailableMW",
    "OfferControl",
  ];
  const fileContent = fs.readFileSync(csvFilePath, { encoding: "utf-8" });

  parse(
    fileContent,
    {
      delimiter: ",",
      columns: headers,
    },
    async (error, result: SubmitOffer[]) => {
      if (error) {
        console.error(error);
      }

      // convert json object to map for faster retrieve
      let registeredUsers = new Map(Object.entries(registryJson));
      // skip the header line
      for (let i = 1; i < result.length; i++) {
        // TODO: improve offer submission perforamnce
        // 1. for each day, iterate hours ending from 1 to 24
        // 2. compare current offers set A with previous hour's offers set B:
        //    1) submit offers of A - B (in A but not in B)
        //    2) submit Offer(0, 0) for offers of B - A (in B but not in A)
        // 3. use async process
        if (result[i].Date == "2022-03-01" && result[i].HE == 4) {
          const priKey =
            registeredUsers.get(result[i].AssetId)?.Index ?? EXPOSED_KEY;
          const wallet = new ethers.Wallet(priKey);
          const contract = getPoolMarketContract(wallet);
          var _blockNumber = result[i].BlockNumber;
          var _availableMW = result[i].AvailableMW;
          var _price = result[i].Price;
          // check if offer only exists in the previous hour but not in current hour
          if (result[i].Merge == "right_only") {
            _availableMW = 0;
            _price = 0;
          }
          const submitOfferTx = await contract.submitOffer(
            _blockNumber,
            _availableMW,
            _price
          );
          await submitOfferTx.wait();
          console.log(
            result[i].Merge,
            wallet.address,
            _blockNumber,
            _availableMW,
            _price
          );
        }
      }
    }
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
