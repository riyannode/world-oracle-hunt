# World Oracle Hunt — Intelligent Contract MVP

The single-room MVP of the [World Oracle Hunt](https://gist.github.com/riyannode/7a354bfedfe42cb2124a8a74ae822d22) game, written for **GenLayer Testnet Bradbury**.

`world_oracle_hunt_room.py` deploys one prediction room. Players submit a guess via `predict(answer)`; once the `settlement_time` is reached, anyone calls `lock()` and then `settle()`. The contract autonomously fetches every URL listed in `sources_csv`, asks the GenLayer validator LLMs to derive a canonical answer (with the Equivalence Principle making sure validators agree), then names a winner — closest-to-the-pin for numeric questions, exact match for text.

## Why this showcases GenLayer

| Feature | Where it lives in the contract |
|---|---|
| Native web fetch (no oracle) | `gl.nondet.web.get(url)` inside `leader_fn` of `settle()` |
| LLM-driven canonicalization of subjective data | `gl.nondet.exec_prompt(...)` inside the same block |
| Equivalence Principle (validators agree) | `validator_fn` in `settle()` re-runs the pipeline, compares only decision fields |
| Optimistic Democracy (anomaly handling) | If sources disagree, contract sets `phase = ANOMALY` and stores the reason instead of paying out — appeals can be resolved off-chain or in a v2 |
| Public read API for frontends | `get_state()` / `get_predictions()` |

## Deploy to Testnet Bradbury (CLI)

> All commands assume you have already run the **one-time setup** below. Detailed step-by-step instructions are in [`/home/ubuntu/world-oracle-hunt/DEPLOY.md`](../DEPLOY.md).

```bash
# 1. Set the network
genlayer network testnet-bradbury

# 2. Deploy with constructor args
#    args order: question, answer_format, sources_csv, settlement_time
genlayer deploy \
  --contract world_oracle_hunt_room.py \
  --args \
    "BTC/USD closing price on Coinbase at 2026-05-01 23:59 UTC" \
    "number" \
    "https://api.coinbase.com/v2/prices/BTC-USD/spot,https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd" \
    1746153540
```

Successful output looks like:

```
Contract deployed successfully!
Transaction Hash: 0x...
Contract Address: 0x...
```

Open the transaction on the explorer to confirm:
`https://explorer-bradbury.genlayer.com/tx/<TX_HASH>`

## Constructor parameters

| Position | Name | Type | Example | Notes |
|---|---|---|---|---|
| 1 | `question` | `str` | `"BTC/USD closing price ..."` | Free text shown in the UI |
| 2 | `answer_format` | `str` | `"number"` or `"text"` | Drives both the LLM prompt and the winner-selection heuristic |
| 3 | `sources_csv` | `str` | `"https://...,https://..."` | Comma-separated URLs (CLI doesn't accept `list` directly) |
| 4 | `settlement_time` | `u256` | `1746153540` | Unix seconds when the room can be locked + settled |

## Public methods

| Method | Visibility | Purpose |
|---|---|---|
| `predict(answer)` | write | Submit / replace your guess while phase is `OPEN` |
| `lock()` | write | Move the room to `LOCKED` once `settlement_time` is reached |
| `settle()` | write | Fetch all sources, run the LLM consensus, set `winner` |
| `get_state()` | view | Snapshot of phase, question, sources, winner, etc. |
| `get_predictions()` | view | Full list of submitted guesses |

## Future v2 (kept out of this MVP for clarity)

- Stake-and-payout in GEN (currently the contract just records the winner)
- Commit-reveal scheme to prevent answer copying
- Factory contract to deploy many rooms cheaply
- Tournament leaderboard + NFT badges
