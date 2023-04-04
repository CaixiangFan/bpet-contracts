import { ethers, BigNumber } from "ethers";
import "dotenv/config";
import { SMP } from './modules/smp.dto';
import { EXPOSED_KEY, getPoolMarketContract, setupProvider } from "./utils";

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
  const provider = setupProvider();
  const currBlock = await provider.getBlock("latest");
  const currHour = Math.floor(currBlock.timestamp / 3600) * 3600;
  const bids = await poolmarketContractInstance.getEnergyBids(currHour);
  console.log("All submitted bids:");
  console.log("=======================");
  var convertedBids = [];
  for (let i = 0; i < bids.length; i++) {
    var bid = bids[i];
    var submitTimeStamp = convertBigNumberToNumber(bid.submitMinute);
    var submitTime = new Date(submitTimeStamp * 1000);
    var convertedBid = {
      amount: convertBigNumberToNumber(bid.amount),
      price: convertBigNumberToNumber(bid.price),
      submitMinute: submitTime.toLocaleString("en-us"),
      account: bid.consumerAccount,
    };
    convertedBids.push(convertedBid);
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

async function querySMP() {
  var datetime = new Date();
  const smps = [];
  const second = datetime.getSeconds();
  const minute = datetime.getMinutes();
  const hour = datetime.getHours();
  const currentTime = Math.floor(datetime.getTime() / 1000);
  const hourStart = currentTime - second - 60 * minute;
  for (let i = 1; i <= 60; i++) {
    var currentMinute = hourStart + 60 * i;
    if (currentMinute < currentTime) {
      var smp = await poolmarketContractInstance.getSMP(currentMinute);
      if (convertBigNumberToNumber(smp) > 0) {
        var date = new Date(currentMinute * 1000);
        var he = date.toLocaleDateString('en-us');
        var minutes = date.getMinutes();
        var marginalOffer =
          await poolmarketContractInstance.getMarginalOffer(
            currentMinute,
          );
        var volume = convertBigNumberToNumber(marginalOffer.amount);
        smps.push(
          new SMP(
            `${he} ${hour + 1}`,
            `${hour}:${minutes}`,
            convertBigNumberToNumber(smp),
            volume,
          ),
        );
      }
    }
  }
  console.log(smps);
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
    case "smp":
      await querySMP();
      break;
    case undefined:
      await queryOffers();
      await queryBids();
      await queryPoolPrices();
      await queryTotalDemand();
      await querySMP();
      break;
  }
}


main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
