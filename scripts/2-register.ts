import { ethers } from "ethers";
import "dotenv/config";
import { EXPOSED_KEY, getRegistryContract } from "./utils";
import { parse } from "csv-parse";
import * as path from "path";
import * as fs from "fs";

type Register = {
  Index: any;
  AssetId: string;
  BlockNumber: number;
  Capacity: number;
  OfferControl: string;
}

async function registerSuppliers() {
  const priKeys = [
    process.env.SUPPLIER1_PRIVATE_KEY,
    process.env.SUPPLIER2_PRIVATE_KEY,
    process.env.SUPPLIER3_PRIVATE_KEY
  ];
  for (let i = 0; i < priKeys.length; i ++) {
    const wallet = new ethers.Wallet(priKeys[i] ?? EXPOSED_KEY);
    console.log(`Registering supplier ${wallet.address} ...`);
    const registryContract = getRegistryContract(wallet);
    try {
      const registerSupplierTx = await registryContract.registerSupplier(
        wallet.address,
        `SUPPLIER${i+1}`,
        i + 2,
        (i + 1) * 200,
        `Alberta Solar Farm Ltd${i+1}`
      );
      await registerSupplierTx.wait();
      console.log(registerSupplierTx);
    } catch (error) {
      console.log(error);
    }
  }
}

async function registerConsumers() {
  const priKeys = [
    process.env.CONSUMER1_PRIVATE_KEY,
    // process.env.CONSUMER2_PRIVATE_KEY,
    // process.env.CONSUMER3_PRIVATE_KEY
  ];

  for (var priKey of priKeys) {
    const wallet = new ethers.Wallet(priKey ?? EXPOSED_KEY);
    console.log(`Registering consumer ${wallet.address} ...`);
    const registryContract = getRegistryContract(wallet);
    try {
      const registerConsumerTx = await registryContract.registerConsumer(
        wallet.address,
        "AIL",
        50000,
        "Alberta Internal Load Ltd."
      );
      await registerConsumerTx.wait();
      console.log(registerConsumerTx);
    } catch (error) {
      console.log(error);
    }
  }
}

async function registerAESOSuppliers() {
  const DEFAULT_PATH = ethers.utils.defaultPath;
  const DEFAULT_MNEMONIC = 'upset fuel enhance depart portion hope core animal innocent will athlete snack';

  const csvFilePath = path.resolve(__dirname, '../aeso/Registry_20220301_20220314.csv');
  const headers = ['Index', 'AssetId', 'BlockNumber', 'Capacity', 'OfferControl'];
  const fileContent = fs.readFileSync(csvFilePath, { encoding: 'utf-8' });
  
  parse(fileContent, {
    delimiter: ',',
    columns: headers,
  }, async (error, result: Register[]) => {
    if (error) {
      console.error(error);
    }
    const MNEMONIC = process.env.DEFAULT_MNEMONIC ?? DEFAULT_MNEMONIC
    var registeredData = new Map<string, Register>();
    // skip the header line
    for (let i = 1; i < result.length; i++) {
      const path = DEFAULT_PATH + i
      const wallet = ethers.Wallet.fromMnemonic(MNEMONIC, path)
      
      result[i].Index = wallet.privateKey;
      registeredData.set(result[i].AssetId, result[i]);
      const registryContract = getRegistryContract(wallet);
      const registerTx = await registryContract.registerSupplier(
        wallet.address,
        result[i].AssetId,
        result[i].BlockNumber,
        result[i].Capacity,
        result[i].OfferControl
      );
      // await registerTx.wait();
      // console.log(registerTx);
    }
    const jsonObj = Object.fromEntries(registeredData);
    console.log(JSON.stringify(jsonObj, undefined, 4));
    fs.writeFile(
      './aeso/Registry_20220301_20220314.json', 
      JSON.stringify(jsonObj, undefined, 4), 
      'utf8', 
      (error) => {console.log(error)});
  });
}

async function main() {
  //==============RegisterMetaMaskSuppliers===============
  // await registerSuppliers();

  //==============RegisterMetaMaskConsumers===============
  await registerConsumers();

  //==============RegisterAESOSuppliers==================
  await registerAESOSuppliers();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
