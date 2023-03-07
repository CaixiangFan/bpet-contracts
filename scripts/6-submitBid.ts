import { ethers } from "ethers";
import "dotenv/config";
import { parse } from "csv-parse";
import * as path from "path";
import * as fs from "fs";
import * as schedule from 'node-schedule';
import { EXPOSED_KEY, getPoolMarketContract } from "./utils";

type SubmitBid = {
  Index: any;
  DateHE: string;
  Time: string;
  Price: number;
  Date: string;
  HE: number;
  DispatchedMW: number;
}
const BIDSFILE = './aeso/SubmitBid_20220301_20220314.json'; 

async function main() {
  // if (fs.existsSync(BIDSFILE)) {
  //   console.log(`${BIDSFILE} exists!`);
  //   return;
  // }

  // console.log(`Generating ${BIDSFILE} ... `);
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
    const wallet = new ethers.Wallet(process.env.CONSUMER1_PRIVATE_KEY ?? EXPOSED_KEY);
    const poolmarketContractInstance = getPoolMarketContract(wallet);
    // skip the header line
    // must start with the 1st item and keep align with offer submissions 
    var i = 1;
    const job = schedule.scheduleJob('50 * * * * *', async () => {
      const currMinute: number = +(result[i].Time.split(':')[1]);
      const currHour: number = result[i].Time.includes('24:') ? 0 : +(result[i].Time.split(':')[0]);
      const amount: number = result[i].DispatchedMW;
      const now = new Date();
      console.log(`Now ${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}, should submit next bid amount=${amount}MW at ${currHour}:${currMinute}`);
      if (now.getMinutes() == currMinute) {
        console.log(`Submitting a bid: (${amount} MW, 50 $) at ${currHour}:${currMinute}`);
        const tx = await poolmarketContractInstance.submitBid(amount, 50);
        await tx.wait();
        console.log(tx);
        console.log(`Submitted a bid: (${amount} MW, 50 $) at ${currHour}:${currMinute}`);
        i ++;
        if (i === result.length) job.cancel();
      }
    })
    }
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
