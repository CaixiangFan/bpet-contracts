import { ethers, BigNumber } from "ethers";
import "dotenv/config";
import { EXPOSED_KEY, getPoolMarketContract } from "./utils";

const wallet = new ethers.Wallet(process.env.PRIVATE_KEY ?? EXPOSED_KEY);
const poolmarketContractInstance = getPoolMarketContract(wallet);

function convertBigNumberToNumber(value: BigNumber) {
  const decimals = 18;
  return Math.round(Number(ethers.utils.formatEther(value)) * 10 ** decimals);
}

async function queryOffers() {

  const offerIds = await poolmarketContractInstance.getValidOfferIDs();
  var offers = [];
  console.log("All submitted offers:");
  console.log("=======================");
  for (let i = 0; i < offerIds.length; i++) {
    var offer = await poolmarketContractInstance.energyOffers(offerIds[i]);
    var amount = convertBigNumberToNumber(offer.amount);
    var price = convertBigNumberToNumber(offer.price);
    var submitMinute = new Date(convertBigNumberToNumber(offer.submitMinute) * 1000).toLocaleString("en-us");
    var supplierAccount = offer.supplierAccount;
    var covertedOffer = {
      amount,
      price,
      submitMinute,
      supplierAccount,
    };
    offers.push(covertedOffer);
    console.log(`${i + 1}: ${JSON.stringify(covertedOffer)}`);
  }
  console.log(`Total offers #: ${offers.length}`);
  console.log("============End===========");
  return offers;
}

async function queryBids() {
  const bidIds = await poolmarketContractInstance.getValidBidIDs();
  var bids = [];
  console.log("All submitted bids:");
  console.log("=======================");
  for (let i = 0; i < bidIds.length; i++) {
    var bid = await poolmarketContractInstance.energyBids(bidIds[i]);
    var submitTimeStamp = convertBigNumberToNumber(bid.submitMinute);
    var submitTime = new Date(submitTimeStamp * 1000);
    var convertedBid = {
      amount: convertBigNumberToNumber(bid.amount),
      price: convertBigNumberToNumber(bid.price),
      submitminute: submitTime.toLocaleString("en-us"),
      account: bid.consumerAccount,
    };
    bids.push(convertedBid);
    console.log(`${i + 1}: ${JSON.stringify(convertedBid)}`);
  }
  console.log(`Total bids #: ${bids.length}`);
  console.log("============End===========");
  return bids;
}

async function queryPoolPrices() {
  const poolPriceHours = await poolmarketContractInstance.getPoolpriceHours();
  console.log("All pool prices:");
  console.log("=======================");
  for (var hour in poolPriceHours) {
    const poolPrice = await poolmarketContractInstance.getPoolPrice(hour);
    console.log({hour, poolPrice});
  }
  console.log("============End===========");
}

async function queryTotalDemand() {
  const latestTotalDemand = await poolmarketContractInstance.getLatestTotalDemand();
  console.log("The latest total demand:");
  console.log("=======================");
  console.log(convertBigNumberToNumber(latestTotalDemand));
  console.log("============End===========");
}

async function main() {
  var query = process.argv[2] ?? undefined;
  switch (query) {
    case "offers":
      await queryOffers();
      break;
    case "bids":
      await queryBids();
      break;
    case "poolprices":
      await queryPoolPrices();
      break;
    case "totaldemand":
      await queryTotalDemand();
      break;
    case undefined:
      await queryOffers();
      await queryBids();
      await queryPoolPrices();
      await queryTotalDemand();
      break;
  }
}


main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
