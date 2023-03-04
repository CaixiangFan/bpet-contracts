// const priKey =
// registeredUsers.get(result[i].AssetId)?.Index ?? EXPOSED_KEY;
// const wallet = new ethers.Wallet(priKey);
// const contract = getPoolMarketContract(wallet);
// var _blockNumber = result[i].BlockNumber;
// var _availableMW = result[i].AvailableMW;
// var _price = result[i].Price;
// // check if offer only exists in the previous hour but not in current hour
// if (result[i].Merge == "right_only") {
// _availableMW = 0;
// _price = 0;
// }
// const submitOfferTx = await contract.submitOffer(
// _blockNumber,
// _availableMW,
// _price
// );
var data = process.argv.slice(2);
console.log(data);
