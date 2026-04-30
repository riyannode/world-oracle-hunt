# World Oracle Hunt — MVP Intelligent Contract Deployed to Bradbury

## Title
World Oracle Hunt — MVP Intelligent Contract deployed to Testnet Bradbury

## Date
2026-04-30

## Description (paste into the portal Description field)

World Oracle Hunt is a multiplayer prediction game in which players race to guess a real-world data point before the official feeds report it. Settlement is performed inside an Intelligent Contract on GenLayer: when the room locks, the contract autonomously fetches the configured web sources (e.g. Coinbase, CoinGecko), asks the validator LLMs to derive a single canonical answer using the Equivalence Principle, and pays out the closest-to-the-pin (numeric) or exact-match (text) winner. If the sources disagree, the room is flagged ANOMALY and ready for Optimistic-Democracy appeal.

This submission delivers Phase 1 of the project: a single-room MVP contract that compiles, lints (`genvm-lint check` ✓), and is now live on Testnet Bradbury — exercising native `gl.nondet.web.get`, `gl.nondet.exec_prompt`, and consensus-aware settlement in 270 lines of Python. Players, staking, and a frontend follow in subsequent milestones.

The full game design (mechanics, lifecycle, replayability, mockups) was previously submitted under the Mini-games for GenLayer's Community mission and is included below as Evidence.

## Evidence URLs

- **GenLayer Contract on Bradbury** — https://explorer-bradbury.genlayer.com/address/0x8ae9C9d56161b10BD5261582E069470a5a482E81
- **Deployment transaction** — https://explorer-bradbury.genlayer.com/tx/0xfb423154176c0c8c5a1c7c5369b4045b82b4a1ed6f9a3e95ae2e4f8ad47468cd
- **Full concept document (game design + roadmap)** — https://gist.github.com/riyannode/7a354bfedfe42cb2124a8a74ae822d22

## Notes for the reviewer

- Contract: `WorldOracleHuntRoom` (single-room MVP). 5 public methods: `get_state`, `get_predictions` (view); `predict`, `lock`, `settle` (write).
- Constructor args used for this deployment:
  - `question`: BTC/USD spot price (Coinbase) at 2026-04-30T23:45:00Z
  - `answer_format`: number
  - `sources_csv`: https://api.coinbase.com/v2/prices/BTC-USD/spot
  - `settlement_time`: ~1 hour after deploy
- Linter: `genvm-lint check` → all checks pass.
- Source code is included verbatim in the deployment payload (see explorer "Code" tab).
