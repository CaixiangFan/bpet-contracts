import { parse } from "csv-parse";
import * as path from "path";
import * as fs from "fs";

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

      let submitOffersMap = new Map<string, SubmitOffer[]>();
      
      var currDateHour: string = result[1].Date + ' ' + (+result[1].HE - 1).toString() + ':00:00';
      let currHourOffers: SubmitOffer[] = [];

      // skip the header line
      for (let i = 1; i < result.length; i++) {      
        let dateHour: string = result[i].Date + ' ' + (+result[i].HE - 1).toString() + ':00:00';
        if (currDateHour != dateHour) {
          submitOffersMap.set(currDateHour, currHourOffers);
          currHourOffers = [];
          currDateHour = dateHour;
        }
        currHourOffers.push(result[i]);
      }
      
      const jsonObj = Object.fromEntries(submitOffersMap);
      console.log(JSON.stringify(jsonObj, undefined, 4));
      fs.writeFile(
        './aeso/SubmitOffer_20220301_20220314.json', 
        JSON.stringify(jsonObj, undefined, 4), 
        'utf8', 
        (error) => {console.log(error)});
    }
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
