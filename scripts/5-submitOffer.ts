import "dotenv/config";
import * as child_process from "child_process";
import * as schedule from 'node-schedule';
import * as submitOffersJson from "../aeso/SubmitOffer_20220301_20220314.json";

async function main() {
  // const offset = new Date("2023-03-07 0:00:00").getTime() - new Date("2022-03-01 0:00:00").getTime();
  const offersMap = new Map(Object.entries(submitOffersJson));
  const hourKeys = offersMap.keys();
  // submit the initial offers
  var currHour: string = "2022-03-01 0:00:00";
  submitOffers(currHour);
  // schedule offer submissions at the begining of each hour
  schedule.scheduleJob('0 1 * * * *', () => {
    // resubmit the first hour's offers
    currHour = hourKeys.next().value.toString();
    submitOffers(currHour);
});
  
async function submitOffers(currHour:string) {
  console.log(`processing offers of ${currHour}`);
  const currOffers = offersMap.get(currHour); 
  const totalCurrOffersNum = currOffers?.length;
  // console.log('Total offers #: ', totalCurrOffersNum);
  if (currOffers != undefined && totalCurrOffersNum != undefined) {
    // set worker numbers to make txsPerWorker<=10
    const maxTxsPerWorker = 3;
    const maxWorkersNum = 22;
    var workersNum: number = Math.ceil(totalCurrOffersNum / maxTxsPerWorker);
    if (totalCurrOffersNum <= maxTxsPerWorker) workersNum = totalCurrOffersNum;
    if (workersNum > maxWorkersNum) workersNum = maxWorkersNum;
    
    const step:number = Math.ceil(currOffers.length / workersNum);
    
    var startIdx: number = 0;
    var endIdx: number = step - 1;
    // console.log(`txs/per worker: ${step}, maxWorkersNum ${workersNum}`);
  
    for (let i = endIdx; i < currOffers.length;) {
      if ((i < currOffers.length - 1) && (currOffers[i].AssetId == currOffers[i+1].AssetId)) {
        i++;
        endIdx = i;
        continue;
      } 
      var offersStr: string[] = [];
      currOffers.slice(startIdx, endIdx + 1).forEach((item) => {
        offersStr.push(JSON.stringify(item));
      });
      // pass the string of offers to child_process via the IPC
      child_process.fork("submitOffer.ts", offersStr, {cwd: "./scripts/modules"});
  
      startIdx = endIdx + 1;
      i = startIdx + step - 1;
      endIdx = i;
      if ((startIdx < currOffers.length - 1) && (endIdx > currOffers.length - 1)) {
        // process the last batch txs
        endIdx = currOffers.length - 1;
        offersStr = []
        currOffers.slice(startIdx, endIdx + 1).forEach((item) => {
          offersStr.push(JSON.stringify(item));
        });
        child_process.fork("submitOffer.ts", offersStr, {cwd: "./scripts/modules"});
      }
    }
  }
}

}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
