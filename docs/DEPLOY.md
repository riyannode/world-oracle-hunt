# Deploy Guide — World Oracle Hunt MVP

Step-by-step guide to deploying [`contracts/world_oracle_hunt_room.py`](contracts/world_oracle_hunt_room.py) to **GenLayer Testnet Bradbury**, then submitting the deployment as a contribution to the GenLayer Foundation portal under *Projects & Milestones* (20–4000 pts).

> Every command in this file is meant to be run in **your own terminal**, on **your own wallet**, so that the deployer address (and the future Dev Fee) is yours.

---

## Network reference (Testnet Bradbury)

| Setting | Value |
|---|---|
| GenLayer RPC | `https://rpc-bradbury.genlayer.com` |
| Chain ID | `4221` |
| Currency | GEN |
| Faucet | https://testnet-faucet.genlayer.foundation |
| Explorer | https://explorer-bradbury.genlayer.com |

---

## 0. Prerequisites

| You need | How to check |
|---|---|
| Node.js v14+ | `node --version` |
| npm | `npm --version` |
| Git | `git --version` |
| A wallet (e.g. MetaMask) you control | already connected to the GenLayer portal |

---

## 1. Add Testnet Bradbury to your wallet

In MetaMask: *Networks → Add network manually* and paste:

- Network name: `GenLayer Bradbury`
- New RPC URL: `https://rpc-bradbury.genlayer.com`
- Chain ID: `4221`
- Currency symbol: `GEN`
- Block explorer URL: `https://explorer-bradbury.genlayer.com`

---

## 2. Get testnet GEN from the faucet

1. Open https://testnet-faucet.genlayer.foundation
2. Connect your wallet (or paste your address)
3. Request tokens. You should see them land in your wallet under the *GenLayer Bradbury* network within a minute.

If the faucet rate-limits, retry from the same browser session after a few minutes.

---

## 3. Install GenLayer CLI

```bash
npm install -g genlayer
genlayer --version
```

If `npm install -g` complains about EACCES on macOS/Linux, prefix with `sudo` *or* configure npm to use a user-local prefix:

```bash
mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.zshrc   # or ~/.bashrc
source ~/.zshrc
npm install -g genlayer
```

---

## 4. Configure the CLI

```bash
# Pick the network
genlayer network testnet-bradbury

# Hook up your wallet (the CLI will prompt you to import a private key
# or to connect to MetaMask, depending on the version installed)
genlayer keygen   # or `genlayer wallet import` — see `genlayer --help`
```

> Never paste your **mainnet** private key. Use a fresh testnet-only key. You can export a private key from MetaMask via *Account details → Show private key*.

---

## 5. Grab the contract

```bash
git clone https://github.com/<your-username>/world-oracle-hunt.git
# OR just download the file directly:
curl -L -o world_oracle_hunt_room.py \
  https://gist.githubusercontent.com/riyannode/<gist-id>/raw/world_oracle_hunt_room.py

cd world-oracle-hunt
```

(If you haven't pushed the contract to your own repo yet, you can copy
`contracts/world_oracle_hunt_room.py` from the materials I gave you.)

---

## 6. Pick the constructor arguments

| Argument | Example value | Notes |
|---|---|---|
| `question` | `"BTC/USD closing price on Coinbase at 2026-05-01 23:59 UTC"` | Free text |
| `answer_format` | `"number"` | Or `"text"` for categorical |
| `sources_csv` | `"https://api.coinbase.com/v2/prices/BTC-USD/spot,https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd"` | Comma-separated, no spaces |
| `settlement_time` | `1746153540` | Unix seconds; pick at least 15 min in the future |

Generate a future Unix timestamp quickly:

```bash
# 30 minutes from now
date -u +%s -d "+30 minutes"   # GNU date (Linux)
date -u -v+30M +%s             # BSD date (macOS)
```

---

## 7. Deploy

```bash
genlayer deploy \
  --contract contracts/world_oracle_hunt_room.py \
  --args \
    "BTC/USD closing price on Coinbase at 2026-05-01 23:59 UTC" \
    "number" \
    "https://api.coinbase.com/v2/prices/BTC-USD/spot,https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd" \
    1746153540
```

Expected output:

```
Contract deployed successfully!
Transaction Hash: 0x1234...
Contract Address: 0xabcd...
```

Save both values — you'll need them as Evidence URLs.

---

## 8. Verify on the explorer

Open:

- `https://explorer-bradbury.genlayer.com/tx/<TX_HASH>` → deployment transaction
- `https://explorer-bradbury.genlayer.com/address/<CONTRACT_ADDRESS>` → live contract

Take a screenshot of the explorer page showing the deployed contract — useful evidence.

---

## 9. (Optional) Smoke-test the room

```bash
# Submit a guess
genlayer call <CONTRACT_ADDRESS> predict --args "65432"

# Inspect state
genlayer call <CONTRACT_ADDRESS> get_state

# Once settlement_time has passed:
genlayer call <CONTRACT_ADDRESS> lock
genlayer call <CONTRACT_ADDRESS> settle
```

If `settle()` succeeds, `get_state()` will show `phase = "SETTLED"`, the `canonical_answer`, and the `winner` address.

---

## 10. Submit to the portal

1. Open https://portal.genlayer.foundation/#/builders/contributions
2. Connect Wallet (the same one that deployed the contract).
3. Scroll to **Contributions (open call)** → click **Submit →** on **Projects & Milestones**.
4. Fill the form:
   - **Title**: `World Oracle Hunt — MVP contract on Bradbury`
   - **Date**: today
   - **Description**: paste the elevator pitch from `portal-description-en.txt` and add a line  
     `MVP deployed at <CONTRACT_ADDRESS> (tx <TX_HASH>).`
   - **Evidence URLs** — at minimum:
     1. **Type**: `GenLayer Studio Contract` → URL: `https://explorer-bradbury.genlayer.com/address/<CONTRACT_ADDRESS>`
     2. **Type**: `GitHub Repository` → URL: your repo with the contract source
     3. **Type**: `Other` → URL: the gist with the full concept
5. Solve reCAPTCHA → Submit.

You can submit *Projects & Milestones* repeatedly as new milestones land (frontend, factory contract, tournament, etc.).

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `npm install -g genlayer` fails with EACCES | Use the user-local npm prefix shown in §3, or prefix with `sudo` |
| `genlayer deploy` returns `insufficient funds` | Top up via the faucet again; check the wallet is on chain ID 4221 |
| `settle()` reverts with `Too early to lock` | Wait until `block.timestamp >= settlement_time`, then call `lock()` first |
| Validator nodes disagree → transaction undetermined | Pick more reliable sources (hardcoded JSON APIs work better than HTML pages) |
| `gl.nondet.web.get` fails | Some endpoints block server-side fetches; choose endpoints that allow public CORS-free GET |
