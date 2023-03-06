import { ethers } from "ethers";
import { EXPOSED_KEY, getPoolMarketContract } from "../utils";
import * as submitOffersJson from "../../aeso/SubmitOffer_20220301_20220314.json";
import * as registryJson from "../../aeso/Registry_20220301_20220314.json";

// type SubmitOffer = {
//   Index: number;
//   Merge: string;
//   Date: string;
//   HE: number;
//   AssetId: string;
//   BlockNumber: number;
//   Price: number;
//   AvailableMW: number;
//   OfferControl: string;
// };

async function main() {

  const offersMap = new Map(Object.entries(submitOffersJson));
  const registeredUsers = new Map(Object.entries(registryJson));
  var data = process.argv.slice(2);
  const currHour = data[2];
  const currOffers = offersMap.get(currHour); 
  var offersToSubmit = currOffers?.slice(+data[0], +data[1] + 1);

  if (offersToSubmit != undefined) {
    for (var offer of offersToSubmit) { 
      var _priKey: string = registeredUsers.get(offer.AssetId)?.Index ?? EXPOSED_KEY;;
      var _blockNumber: number = +offer.BlockNumber;
      var _availableMW: number = +offer.AvailableMW;
      var _price: number = +offer.Price; 
      const wallet = new ethers.Wallet(_priKey);
      const contract = getPoolMarketContract(wallet);
    
      const submitOfferTx = await contract.submitOffer(
      _blockNumber,
      _availableMW,
      _price
      );
      await submitOfferTx.wait();
      console.log(submitOfferTx);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});