import { ethers, Contract, BigNumber } from "ethers";
import "dotenv/config";
import * as marketJson from "../artifacts/contracts/PoolMarket.sol/PoolMarket.json";
import * as tokenJson from "../artifacts/contracts/EnergyToken.sol/EnergyToken.json";
import { EXPOSED_KEY, setupProvider, setupGoerliProvider } from "./utils";
import { PoolMarket, EnergyToken } from "../typechain";

async function main() {
  var provider = setupGoerliProvider();
  const network = process.env.PROVIDER_NETWORK;
  if (network === "Besu") {
    provider = setupProvider();
  }

  const poolMarketContractAddress = String(
    process.env.POOLMARKET_CONTRACT_ADDRESS
  );
  const priKey = process.env.PRIVATE_KEY ?? EXPOSED_KEY;
  const wallet = new ethers.Wallet(priKey ?? EXPOSED_KEY);
  const poolMarketSigner = wallet.connect(provider);
  const poolMarketContractInstance: PoolMarket = new Contract(
    poolMarketContractAddress,
    marketJson.abi,
    poolMarketSigner
  ) as PoolMarket;

  await getOffers(poolMarketContractInstance);
  await getBids(poolMarketContractInstance);
}

function convertBigNumberToNumber(value: BigNumber) {
  const decimals = 18;
  return Math.round(Number(ethers.utils.formatEther(value)) * 10 ** decimals);
}

async function getOffers(poolmarketContractInstance: PoolMarket) {
  const offerIds = await poolmarketContractInstance.getValidOfferIDs();
  var offers = [];
  console.log("All submitted offers:");
  console.log("=======================");
  for (let i = 0; i < offerIds.length; i++) {
    var offer = await poolmarketContractInstance.getEnergyOffer(offerIds[i]);
    var amount = convertBigNumberToNumber(offer.amount);
    var price = convertBigNumberToNumber(offer.price);
    var submitMinute = convertBigNumberToNumber(offer.submitMinute);
    var supplierAccount = offer.supplierAccount;
    var isValid = offer.isValid;
    var covertedOffer = {
      amount,
      price,
      submitMinute,
      supplierAccount,
      isValid,
    };
    offers.push(covertedOffer);
    console.log(`${i + 1}: ${JSON.stringify(covertedOffer)}`);
  }
  console.log(`Total offers #: ${offers.length}`);
  return offers;
}

async function getBids(poolmarketContractInstance: PoolMarket) {
  const bidIds = await poolmarketContractInstance.getValidBidIDs();
  var bids = [];
  console.log("All submitted bids:");
  console.log("=======================");
  for (let i = 0; i < bidIds.length; i++) {
    var bid = await poolmarketContractInstance.getEnergyBid(bidIds[i]);
    var submitTimeStamp = convertBigNumberToNumber(bid.submitMinute);
    var submitTime = new Date(submitTimeStamp * 1000);
    var convertedBid = {
      submitTime: submitTime.toLocaleTimeString("en-us"),
      amount: convertBigNumberToNumber(bid.amount),
      price: convertBigNumberToNumber(bid.price),
      submitminute: convertBigNumberToNumber(bid.submitMinute),
      account: bid.consumerAccount,
    };
    bids.push(convertedBid);
    console.log(`${i + 1}: ${JSON.stringify(convertedBid)}`);
  }
  console.log(`Total bids #: ${bids.length}`);
  return bids;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
