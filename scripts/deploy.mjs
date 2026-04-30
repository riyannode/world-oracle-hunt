import fs from "node:fs";
import path from "node:path";
import { ethers } from "ethers";
import { createClient, createAccount } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

const KEYSTORE = "/root/.genlayer/keystores/world-oracle-deployer.json";
const PWD = fs.readFileSync("/root/.genlayer-wallet-password.txt", "utf8");
const CONTRACT = "/root/world-oracle-hunt/contracts/world_oracle_hunt_room.py";

async function main() {
  console.log("[1/5] Decrypting keystore...");
  const ks = fs.readFileSync(KEYSTORE, "utf8");
  const wallet = await ethers.Wallet.fromEncryptedJson(ks, PWD);
  console.log("    address:", wallet.address);

  console.log("[2/5] Creating GenLayer client...");
  const account = createAccount(wallet.privateKey);
  const client = createClient({ chain: testnetBradbury, account });

  console.log("[3/5] Reading contract source...");
  const code = fs.readFileSync(CONTRACT, "utf8");
  console.log("    bytes:", code.length);

  const settlementTime = BigInt(Math.floor(Date.now() / 1000) + 3600);
  const args = [
    "BTC/USD spot price (Coinbase) at 2026-04-30T23:45:00Z",
    "number",
    "https://api.coinbase.com/v2/prices/BTC-USD/spot",
    settlementTime,
  ];
  console.log("    args:", args);

  console.log("[4/5] Submitting deploy transaction...");
  const hash = await client.deployContract({ code, args, leaderOnly: false });
  console.log("    DEPLOY_TX_HASH=" + hash);

  console.log("[5/5] Waiting for receipt...");
  const receipt = await client.waitForTransactionReceipt({
    hash,
    retries: 60,
    interval: 5000,
    status: TransactionStatus.ACCEPTED,
  });
  console.log("    receipt:", JSON.stringify(receipt, (k,v)=> typeof v === "bigint" ? v.toString() : v, 2));

  const addr = receipt?.data?.contract_address ?? receipt?.txDataDecoded?.contractAddress;
  console.log("DEPLOY_CONTRACT_ADDRESS=" + addr);
  console.log("DEPLOY_TX_HASH=" + hash);
}

main().catch(err => {
  console.error("FAILED:", err?.message ?? err);
  if (err?.stack) console.error(err.stack);
  process.exit(1);
});
