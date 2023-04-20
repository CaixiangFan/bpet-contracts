import { ethers } from "ethers";
import "dotenv/config";
import { parse } from "csv-parse";
import * as path from "path";
import * as fs from "fs";
import * as schedule from 'node-schedule';
import { EXPOSED_KEY, getPoolMarketContract } from "./utils";
import * as submitBidsJson from "../aeso/SubmitBid_20220301_20220314.json";

type SubmitBid = {
  Index: any;
  DateHE: string;
  Time: string;
  Price: number;
  Date: string;
  HE: number;
  DispatchedMW: number;
}

async function generateBidJson() {
  const csvFilePath = path.resolve(__dirname, '../aeso/SubmitBid_20220301_20220314.csv');
  const headers = ['Index', 'Date (HE)','Time', 'Price ($)', 'Date', 'HE', 'DispatchedMW'];
  const fileContent = fs.readFileSync(csvFilePath, { encoding: 'utf-8' });
  parse(fileContent, {
    delimiter: ',',
    columns: headers,
  }, async (error, result: SubmitBid[]) => {
    if (error) {
      console.error(error);
    }
    console.log(result);
    }
  );
}

async function main() {
  const BIDSFILE = './aeso/SubmitBid_20220301_20220314.json'; 
  if (! fs.existsSync(BIDSFILE)) {
    console.log(`${BIDSFILE} not exists!`);
    console.log(`Generating ${BIDSFILE} ... `);
    generateBidJson();
  }

  const offersMap = new Map(Object.entries(submitBidsJson));
  const minuteKeys = offersMap.keys();

  var currBidTimeStr = minuteKeys.next()?.value.toString();
  var currBidMinute: number = +(currBidTimeStr.split(':')[1]);
  const job = schedule.scheduleJob('50 * * * * *', async () => {
    if (currBidTimeStr == undefined) job.cancel();
    // check if time minute matches the current nid minute
    const now = new Date();
    const currMinute: number = now.getMinutes();
    console.log(`Current time:  ${now.toTimeString()}`);
    console.log(`Next bid: ${JSON.stringify(offersMap.get(currBidTimeStr))}`)
    

    if (currBidMinute == currMinute) {
      const bid = offersMap.get(currBidTimeStr);
      if (bid != undefined) {
        console.log(`Submitting bid ${JSON.stringify(bid)}`);
        const wallet = new ethers.Wallet(process.env.CONSUMER1_PRIVATE_KEY ?? EXPOSED_KEY);
        const poolmarketContractInstance = getPoolMarketContract(wallet);
        const amount: number = +bid.Dispatched;
        const price: number = Math.round(parseFloat(bid["Price ($)"]) * 100);
        const tx = await poolmarketContractInstance.submitBid(amount, price);
        await tx.wait();

        currBidTimeStr = minuteKeys.next().value.toString();
        currBidMinute = +(currBidTimeStr.split(':')[1]);
      }
    }
  })
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
