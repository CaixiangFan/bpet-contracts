import "dotenv/config";
import * as child_process from "child_process";
import * as submitOffersJson from "../aeso/SubmitOffer_20220301_20220314.json";


async function main() {
  const currHour = "2022-03-01 0:00:00";
  const offersMap = new Map(Object.entries(submitOffersJson));
  const currOffers = offersMap.get(currHour); 
  const totalCurrOffersNum = currOffers?.length;
  console.log('Total offers #: ', totalCurrOffersNum);
  if (currOffers != undefined && totalCurrOffersNum != undefined) {
    // set worker numbers to make txsPerWorker<=10
    const maxTxsPerWorker = 10;
    var workersNum: number = Math.ceil(totalCurrOffersNum / maxTxsPerWorker);
    if (totalCurrOffersNum <= maxTxsPerWorker) workersNum = totalCurrOffersNum;

    workersNum = 22;

    const step:number = Math.ceil(currOffers.length / workersNum);
    
    var startIdx: number = 0;
    var endIdx: number = step - 1;
    console.log(`txs/per worker: ${step}, workersNum ${workersNum}`);

    for (let i = endIdx; i < currOffers.length;) {
      // console.log('current offer: ', currOffers[i]);
      if (currOffers[i].AssetId == currOffers[i+1].AssetId) {
        i++;
        endIdx = i;
        continue;
      } 
      const range: string[] = [startIdx.toString(), endIdx.toString(), currHour];
      console.log('range: ', range);
      const offersOfCurrRange = currOffers.slice(startIdx, endIdx+1);
      var offersOfCurrRangeAssetID = [];
      for (let j = 0; j < offersOfCurrRange.length; j++) offersOfCurrRangeAssetID.push(offersOfCurrRange[j].AssetId);
      console.log(offersOfCurrRangeAssetID);
      // const cp = child_process.fork("submitOffer.ts", range, {cwd: "./scripts/modules"});

      startIdx = endIdx + 1;
      i = startIdx + step - 1;
      endIdx = i;
      if (endIdx > currOffers.length - 1) {
        endIdx = currOffers.length - 1;
        console.log('range: ', [startIdx.toString(), endIdx.toString()]);
        // child_process.fork("submitOffer.ts", [startIdx.toString(), endIdx.toString(), currHour], {cwd: "./scripts/modules"});
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
