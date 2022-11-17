import fetch from "node-fetch";

async function request(body: string) {
  const response = await fetch("http://192.168.226.230:8545", {
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
