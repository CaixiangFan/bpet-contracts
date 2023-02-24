import fetch from "node-fetch";
import "dotenv/config";

async function request(body: string) {
  const defaultURL = "http//192.168.226.193:8545";
  const response = await fetch(process.env.BESU_URL || defaultURL, {
    method: "POST",
    body: body,
  });
  const data = await response.json();

  return data;
}

async function queryPending() {
  var pendingBody =
    '{"jsonrpc":"2.0","method":"txpool_besuPendingTransactions","params":[1000,{"gas":{"lt":"0xffffff"},"nonce":{"gt":"0x00"}}],"id":1}';
  const pendingResponse = await request(pendingBody);
  console.log(pendingResponse.result);
}

async function queryStats() {
  // https://besu.hyperledger.org/en/stable/public-networks/reference/api/#txpool_besupendingtransactions
  var statsBody =
    '{"jsonrpc":"2.0","method":"txpool_besuStatistics","params":[],"id":1}';
  const statsResponse = await request(statsBody);
  console.log(statsResponse.result);
}

async function queryTx() {
  var txBody =
    '{"jsonrpc":"2.0","method":"txpool_besuTransactions","params":[],"id":1}';
  const txResponse = await request(txBody);
  console.log('Pending transactions in the txpool:');
  console.log(txResponse.result);
  console.log(`There are ${txResponse.result.length} pending transactions in the txpool:`);
}

async function main() {
  await queryPending();
  await queryStats();
  await queryTx();
}

main();
