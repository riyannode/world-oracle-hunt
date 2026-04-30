// World Oracle Hunt — frontend logic
// Talks to a deployed Intelligent Contract on GenLayer Testnet Bradbury.

const CONFIG = {
  contract: "0x8ae9C9d56161b10BD5261582E069470a5a482E81",
  rpc: "https://rpc-bradbury.genlayer.com",
  chainIdHex: "0x107D", // 4221
  chainIdDec: 4221,
  chainName: "GenLayer Bradbury",
  explorer: "https://explorer-bradbury.genlayer.com",
  currency: { name: "GEN", symbol: "GEN", decimals: 18 },
};

// ---------- DOM helpers ----------
const $ = (id) => document.getElementById(id);
const fmt = {
  shortAddr: (a) => (a ? a.slice(0, 6) + "…" + a.slice(-4) : ""),
  rel(unixSeconds) {
    const now = Math.floor(Date.now() / 1000);
    const diff = unixSeconds - now;
    if (Math.abs(diff) < 60) return diff >= 0 ? `in ${diff}s` : `${Math.abs(diff)}s ago`;
    const m = Math.floor(Math.abs(diff) / 60);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    if (d > 0) return diff >= 0 ? `in ${d}d ${h % 24}h` : `${d}d ${h % 24}h ago`;
    if (h > 0) return diff >= 0 ? `in ${h}h ${m % 60}m` : `${h}h ${m % 60}m ago`;
    return diff >= 0 ? `in ${m}m` : `${m}m ago`;
  },
  num(x) {
    if (x === undefined || x === null || x === "") return "—";
    return x;
  },
};

// ---------- GenLayer client ----------
function getReadClient() {
  // No wallet → only read calls work (gen_call doesn't need a signer)
  return window.genlayer.createClient({
    chain: window.genlayer.chains.testnetBradbury,
    endpoint: CONFIG.rpc,
  });
}

function getWriteClient() {
  if (!window.ethereum) throw new Error("MetaMask not found");
  if (!state.wallet) throw new Error("Wallet not connected");
  // Pass account as viem JsonRpcAccount shape so the SDK can read account.address
  return window.genlayer.createClient({
    chain: window.genlayer.chains.testnetBradbury,
    endpoint: CONFIG.rpc,
    provider: window.ethereum,
    account: state.wallet, // viem parseAccount() will turn a 0x-string into a JsonRpcAccount
  });
}

// ---------- State ----------
let state = {
  contract: null, // contract state object
  wallet: null,   // connected address
  chainOk: false, // on Bradbury?
};

// ---------- Initial UI wiring ----------
$("contractLink").href = `${CONFIG.explorer}/address/${CONFIG.contract}`;
$("contractLink").textContent = CONFIG.contract;
$("verifyLink").href = `${CONFIG.explorer}/address/${CONFIG.contract}`;

// ---------- Read state ----------
async function refreshState() {
  try {
    const client = getReadClient();
    const result = await client.readContract({
      address: CONFIG.contract,
      functionName: "get_state",
    });
    // result is JSON-like; ensure plain object
    const s = normalizeContractValue(result);
    state.contract = s;
    renderContractState(s);
  } catch (err) {
    console.error("get_state failed:", err);
    $("questionText").textContent = "Could not load contract state.";
    $("phaseText").textContent = "ERROR";
  }

  try {
    const client = getReadClient();
    const result = await client.readContract({
      address: CONFIG.contract,
      functionName: "get_predictions",
    });
    const preds = normalizeContractValue(result);
    renderPredictions(Array.isArray(preds) ? preds : []);
  } catch (err) {
    console.error("get_predictions failed:", err);
    $("predictionsBody").innerHTML =
      `<div class="text-red-400">Failed to load: ${escapeHtml(String(err.message || err))}</div>`;
  }
}

function normalizeContractValue(v) {
  // GenLayer SDK returns Map / Address-wrapped / bigint values; coerce to plain JSON-ish.
  if (v === null || v === undefined) return v;
  if (v instanceof Map) {
    const o = {};
    for (const [k, val] of v) o[k] = normalizeContractValue(val);
    return o;
  }
  if (typeof v === "bigint") return Number(v);
  if (Array.isArray(v)) return v.map(normalizeContractValue);
  if (typeof v === "object") {
    if (v.bytes && v.bytes.length === 20) {
      // Address
      return "0x" + Array.from(v.bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    const o = {};
    for (const k of Object.keys(v)) o[k] = normalizeContractValue(v[k]);
    return o;
  }
  return v;
}

function renderContractState(s) {
  // Expected fields: phase, creator, question, answer_format, sources (array),
  // settlement_time, num_predictions, canonical_answer, winner, anomaly_reason
  $("questionText").textContent = s.question || "—";
  $("questionFormat").textContent = "format: " + (s.answer_format || "—");
  $("phaseText").textContent = s.phase || "—";
  $("phasePill").className = "pill ml-auto phase-" + (s.phase || "OPEN");

  const settlementTs = Number(s.settlement_time || 0);
  $("settlementRel").textContent = fmt.rel(settlementTs);

  $("predCount").textContent = fmt.num(s.num_predictions);
  $("canonicalAnswer").textContent = fmt.num(s.canonical_answer);
  $("winnerAddr").textContent =
    s.winner && s.winner !== "0x0000000000000000000000000000000000000000"
      ? fmt.shortAddr(s.winner)
      : "—";

  const sources = Array.isArray(s.sources) ? s.sources : [];
  $("sourcesList").innerHTML = sources
    .map((u) => `<a class="text-accent2 hover:underline break-all" target="_blank" href="${u}">${escapeHtml(u)}</a>`)
    .join('<span class="text-white/30 mx-2">·</span>');

  // Show settle/lock section if phase ≠ SETTLED
  const showOps = s.phase === "OPEN" || s.phase === "LOCKED";
  $("settleSection").classList.toggle("hidden", !showOps);
  $("lockBtn").disabled = s.phase !== "OPEN" || Math.floor(Date.now() / 1000) < settlementTs;
  $("settleBtn").disabled = s.phase !== "LOCKED";
}

function renderPredictions(preds) {
  if (preds.length === 0) {
    $("predictionsBody").innerHTML =
      '<div class="text-white/40 italic">No predictions yet — be the first.</div>';
    return;
  }
  $("predictionsBody").innerHTML = preds
    .map((p) => {
      // p.player, p.answer, p.timestamp
      const player = fmt.shortAddr(p.player || "");
      const answer = escapeHtml(String(p.answer ?? ""));
      const ts = p.timestamp ? new Date(Number(p.timestamp) * 1000).toLocaleString() : "";
      return `
        <div class="flex items-center justify-between rounded-lg bg-white/3 border border-white/5 px-3 py-2">
          <div class="flex items-center gap-3">
            <div class="text-xs font-mono text-white/50">${player}</div>
            <div class="font-mono text-base">${answer}</div>
          </div>
          <div class="text-[10px] text-white/40 num">${ts}</div>
        </div>`;
    })
    .join("");
}

// ---------- Wallet ----------
async function connectWallet() {
  if (!window.ethereum) {
    setTxStatus("MetaMask not detected. Install MetaMask first.", "error");
    return;
  }
  try {
    const [addr] = await window.ethereum.request({ method: "eth_requestAccounts" });
    state.wallet = addr;
    await ensureChain();
    updateWalletUI();
  } catch (err) {
    console.error(err);
    setTxStatus(err.message || String(err), "error");
  }
}

async function ensureChain() {
  const cur = await window.ethereum.request({ method: "eth_chainId" });
  if (cur === CONFIG.chainIdHex) {
    state.chainOk = true;
    return;
  }
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CONFIG.chainIdHex }],
    });
    state.chainOk = true;
  } catch (err) {
    if (err && err.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: CONFIG.chainIdHex,
            chainName: CONFIG.chainName,
            rpcUrls: [CONFIG.rpc],
            blockExplorerUrls: [CONFIG.explorer],
            nativeCurrency: CONFIG.currency,
          },
        ],
      });
      state.chainOk = true;
    } else {
      throw err;
    }
  }
}

function updateWalletUI() {
  if (state.wallet && state.chainOk) {
    $("connectBtn").textContent = fmt.shortAddr(state.wallet);
    $("netPill").innerHTML = '<span class="pulse-dot"></span>Bradbury';
    $("netPill").className = "pill bg-emerald-500/15 text-emerald-300";
    $("predictBtn").disabled = false;
    $("predictBtn").textContent = "Submit prediction";
  } else if (state.wallet) {
    $("connectBtn").textContent = fmt.shortAddr(state.wallet);
    $("netPill").innerHTML = '<span class="pulse-dot"></span>Wrong network';
    $("netPill").className = "pill bg-red-500/15 text-red-300";
  } else {
    $("connectBtn").textContent = "Connect wallet";
    $("netPill").innerHTML = '<span class="pulse-dot"></span>Disconnected';
    $("netPill").className = "pill bg-white/5 text-white/60";
  }
}

// ---------- Write actions ----------
async function submitPrediction(answer) {
  if (!state.wallet || !state.chainOk) {
    await connectWallet();
    if (!state.wallet || !state.chainOk) return;
  }
  setTxStatus("Submitting prediction (sign in your wallet)…", "info");
  try {
    const client = getWriteClient();
    const txHash = await client.writeContract({
      address: CONFIG.contract,
      functionName: "predict",
      args: [answer],
      value: 0n,
    });
    setTxStatus(
      `Submitted! <a class="text-accent2 hover:underline" target="_blank" href="${CONFIG.explorer}/tx/${txHash}">${fmt.shortAddr(
        txHash,
      )}</a> — waiting for ACCEPTED…`,
      "info",
    );
    await waitForTx(client, txHash);
    setTxStatus(
      `Confirmed: <a class="text-accent2 hover:underline" target="_blank" href="${CONFIG.explorer}/tx/${txHash}">${fmt.shortAddr(
        txHash,
      )}</a>`,
      "success",
    );
    await refreshState();
  } catch (err) {
    console.error(err);
    setTxStatus(err.message || String(err), "error");
  }
}

async function callWriteMethod(method) {
  if (!state.wallet || !state.chainOk) {
    await connectWallet();
    if (!state.wallet || !state.chainOk) return;
  }
  setTxStatus(`Calling ${method}() (sign in your wallet)…`, "info");
  try {
    const client = getWriteClient();
    const txHash = await client.writeContract({
      address: CONFIG.contract,
      functionName: method,
      args: [],
      value: 0n,
    });
    setTxStatus(
      `Submitted ${method}() → <a class="text-accent2 hover:underline" target="_blank" href="${CONFIG.explorer}/tx/${txHash}">${fmt.shortAddr(
        txHash,
      )}</a> — waiting…`,
      "info",
    );
    await waitForTx(client, txHash);
    setTxStatus(`${method}() confirmed.`, "success");
    await refreshState();
  } catch (err) {
    console.error(err);
    setTxStatus(err.message || String(err), "error");
  }
}

async function waitForTx(client, hash) {
  // Poll until status is decided
  for (let i = 0; i < 60; i++) {
    try {
      const tx = await client.getTransaction({ hash });
      const status = tx?.status_name || tx?.status;
      if (status && ["ACCEPTED", "FINALIZED", "UNDETERMINED"].includes(String(status))) return tx;
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 5000));
  }
  return null;
}

function setTxStatus(html, kind) {
  const el = $("txStatus");
  el.classList.remove("hidden");
  el.innerHTML = html;
  el.className = "mt-4 rounded-lg px-3 py-2 text-xs ";
  if (kind === "error") el.className += "bg-red-500/15 border border-red-500/30 text-red-300";
  else if (kind === "success") el.className += "bg-emerald-500/15 border border-emerald-500/30 text-emerald-200";
  else el.className += "bg-white/5 border border-white/10 text-white/80";
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]),
  );
}

// ---------- Event wiring ----------
$("connectBtn").addEventListener("click", connectWallet);
$("refreshBtn").addEventListener("click", refreshState);
$("predictForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const v = $("answerInput").value.trim();
  if (!v) return;
  submitPrediction(v);
});
$("lockBtn").addEventListener("click", () => callWriteMethod("lock"));
$("settleBtn").addEventListener("click", () => callWriteMethod("settle"));

if (window.ethereum) {
  window.ethereum.on?.("chainChanged", () => location.reload());
  window.ethereum.on?.("accountsChanged", (accs) => {
    state.wallet = accs[0] || null;
    updateWalletUI();
  });
}

// First load
updateWalletUI();
refreshState();
// Auto-refresh every 30s
setInterval(refreshState, 30000);
