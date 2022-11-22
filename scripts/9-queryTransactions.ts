import fetch from "node-fetch";
import "dotenv/config";

async function request(body: string) {
  const defaultURL = "http//192.168.226.162:8545";
  const response = await fetch(process.env.BESU_URL || defaultURL, {
    method: "POST",
    body: body,
  });
  const data = await response.json();

  return data;
}

async function queryPending() {
  var pendingBody =
    '{"jsonrpc":"2.0","method":"txpool_besuPendingTransactions","params":[1000,{"gas":{"gt":"0x5209"},"nonce":{"gt":"0x1"}}],"id":1}';
  const pendingResponse = await request(pendingBody);
  console.log(pendingResponse.result);
}

async function queryStats() {
  var statsBody =
    '{"jsonrpc":"2.0","method":"txpool_besuStatistics","params":[],"id":1}';
  const statsResponse = await request(statsBody);
  console.log(statsResponse);
}

async function queryTx() {
  var txBody =
    '{"jsonrpc":"2.0","method":"txpool_besuTransactions","params":[],"id":1}';
  const txResponse = await request(txBody);
  console.log(txResponse.result.length);
}

async function main() {
  await queryPending();
  await queryStats();
  await queryTx();
}

main();
