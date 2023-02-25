import { ethers, Contract } from "ethers";
import "dotenv/config";
import { parse } from "csv-parse";
import * as path from "path";
import * as fs from "fs";
import * as poolmarketJson from "../artifacts/contracts/PoolMarket.sol/PoolMarket.json";
import * as registryJson from "../aeso/registry.json";
import { EXPOSED_KEY, setupGoerliProvider, setupProvider } from "./utils";
import { PoolMarket } from "../typechain";

type Register = {
  Index: number;
  AssetId: string;
  BlockNumber: number;
  Capacity: number;
  OfferControl: string;
}

type SubmitOffer = {
  Index: number;
  Date: string;
  HE: number;
  AssetId: string;
  BlockNumber: number;
  Price: number;
  From: number;
  To: number;
  Size: number;
  AvailableMW: number;
  OfferControl: string;
}

function getContract(wallet: ethers.Wallet): PoolMarket {
  var provider = setupGoerliProvider();
  const network = process.env.PROVIDER_NETWORK;
  if (network === "Besu") {
    provider = setupProvider();
  }

  const contractAddress = String(process.env.POOLMARKET_CONTRACT_ADDRESS);
  const signer = wallet.connect(provider);
  const contractInstance: PoolMarket = new Contract(
    contractAddress,
    poolmarketJson.abi,
    signer
  ) as PoolMarket;

  return contractInstance;
}

async function main() {
  const csvFilePath = path.resolve(__dirname, '../aeso/SubmitOffer_20220301_20220314.csv');
  const headers = [ 'Index', 
                    'Date', 
                    'HE', 
                    'AssetId', 
                    'BlockNumber', 
                    'Price',
                    'From',
                    'To',
                    'Size',
                    'AvailableMW',
                    'OfferControl'
                  ];
  const fileContent = fs.readFileSync(csvFilePath, { encoding: 'utf-8' });
  
  parse(fileContent, {
    delimiter: ',',
    columns: headers,
  }, async (error, result: SubmitOffer[]) => {
    if (error) {
      console.error(error);
    }
    // skip the header line
    for (let i = 1; i < result.length; i++) {
      if (result[i].Date == "2022-03-01" && result[i].HE == 1) {
        for (var item of registryJson.registry) {
          if (item.AssetId == result[i].AssetId) {
            const wallet = new ethers.Wallet(item.Index);
            const contract = getContract(wallet);
            const submitOfferTx = await contract.submitOffer(
              result[i].BlockNumber,
              result[i].AvailableMW,
              result[i].Price
            );
            await submitOfferTx.wait();
            console.log(submitOfferTx.hash, 
              result[i].BlockNumber,
              result[i].AvailableMW,
              result[i].Price);
            continue;
          }
        }
      }
    }
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
