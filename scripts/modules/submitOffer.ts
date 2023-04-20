import { ethers, BigNumber } from "ethers";
import { EXPOSED_KEY, getPoolMarketContract } from "../utils";
import * as registryJson from "../../aeso/Registry_20220301_20220314.json";

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
  const registeredUsers = new Map(Object.entries(registryJson));
  var data = process.argv.slice(2);
  const currOffersStr = data;

  if (currOffersStr != undefined) {
    for (var offerStr of currOffersStr) {
      var offerObj: SubmitOffer = JSON.parse(offerStr);
      var _priKey: string = registeredUsers.get(offerObj.AssetId)?.Index ?? EXPOSED_KEY;;
      var _blockNumber: number = offerObj.BlockNumber;
      var _availableMW: number = offerObj.AvailableMW;
      var _price = Math.round(offerObj.Price * 100); 
      const wallet = new ethers.Wallet(_priKey);
      const contract = getPoolMarketContract(wallet);
      try {
        const submitOfferTx = await contract.submitOffer(
        _blockNumber,
        _availableMW,
        _price
        );
        const receipt = await submitOfferTx.wait(1);
        console.log(receipt.transactionHash, offerObj.AssetId, offerObj.BlockNumber, offerObj.AvailableMW, offerObj.Price);
      } catch (error) {
        console.log({error});
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});