import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

const HASH = process.argv[2] || "0xfb423154176c0c8c5a1c7c5369b4045b82b4a1ed6f9a3e95ae2e4f8ad47468cd";
const STATUS_NAMES = ["UNINITIALIZED","PENDING","PROPOSING","COMMITTING","REVEALING","ACCEPTED","UNDETERMINED","FINALIZED","CANCELED","APPEAL_REVEALING","APPEAL_COMMITTING","READY_TO_FINALIZE","VALIDATORS_TIMEOUT","LEADER_TIMEOUT"];

const client = createClient({ chain: testnetBradbury });
const tx = await client.getTransaction({ hash: HASH });
const s = Number(tx.status ?? -1);
console.log("status:", s, "(", STATUS_NAMES[s] ?? "?", ")");
console.log("contract_address:", tx?.data?.contract_address ?? tx?.txDataDecoded?.contractAddress ?? "(none yet)");
console.log("full:", JSON.stringify(tx, (k,v)=> typeof v === "bigint" ? v.toString() : v, 2).slice(0, 2500));
