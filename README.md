# World Oracle Hunt

> **A real-world data prediction game powered by GenLayer Intelligent Contracts and Optimistic Democracy consensus.**

Players guess real-world data (asset prices, match results, debate outcomes, weather, etc.) **before** the official oracles or trusted feeds report it. When the *settlement time* hits, a GenLayer Intelligent Contract autonomously fetches data from multiple web sources, validates it via the Equivalence Principle, and — if anomalies appear — automatically triggers an *appeal* through Optimistic Democracy.

---

## 1. Elevator Pitch

**World Oracle Hunt** is a peer-to-peer prediction dApp where every *room* contains a single question about a real-world event that will happen in the next 1 hour to 7 days. There is no admin who decides the right answer, no centralized oracle to bribe, and no "trusted reporter" like in classical prediction markets. **The judge is the GenLayer AI validator network, which fetches live web data at settlement time.**

Tagline: *"Predict the world before the world reports it."*

---

## 2. Problem Statement

Today's prediction markets and P2P betting platforms have three structural weaknesses:

| Problem | Conventional fix | Why it still fails |
|---|---|---|
| Outcome resolution | Centralized oracle (Chainlink, UMA, etc.) | Depends on a feed that can be manipulated or delayed |
| Subjective questions (e.g. "who won the debate?") | Manual committee / *optimistic oracle* | Slow, expensive, bribable |
| Data anomalies | Manual dispute | Requires a proposer + bond; never happens automatically |

**World Oracle Hunt** uses three GenLayer-native primitives to solve all three **inside a single contract**:

1. **Intelligent Contract** → fetch web data natively, no external oracle needed.
2. **Equivalence Principle** → multiple validators run the same prompt; results are accepted if *semantically equivalent*.
3. **Optimistic Democracy** → if validators disagree, the *appeal* + staking mechanism kicks in automatically.

---

## 3. Submission Target: Mission "Mini-games for GenLayer's Community"

This concept is targeted at the following ongoing portal mission:

> *"Mini-games for GenLayer's Community — create a fun and engaging mini-game for the daily gatherings of our community members. The mini-game must showcase GenLayer's Intelligent Contract and Optimistic Democracy consensus."*

**Requirement check:**

| Mission requirement | World Oracle Hunt |
|---|---|
| Multiplayer and/or in rooms | ✓ Each question is a multiplayer room |
| Lasts between 5–15 min | ✓ **Speed Round** mode (see §4.5) |
| Replayable once per week (new/random content) | ✓ Questions auto-curated from weekly viral news |
| Leaderboard for XP distribution | ✓ Seasonal leaderboard + NFT badges |
| Showcases Intelligent Contract + Optimistic Democracy | ✓ Both primitives sit at the core of settlement |
| Subjectivity / AI consensus | ✓ Subjective questions (debates, sentiment) — exactly GenLayer's sweet spot |

Beyond this mission, the concept is also a fit for the open-call category **Projects & Milestones** (20–4000 pts) once an MVP is deployed, and **Educational Content** (20–600 pts) when paired with a tutorial.

---

## 4. Game Mechanics

### 4.1 Lifecycle of a single Room

```
┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ 1. CREATE    │ → │ 2. PREDICT   │ → │ 3. SETTLE    │ → │ 4. PAYOUT    │
│ (anyone can) │   │ (players     │   │ (Intelligent │   │ (auto, on-   │
│              │   │  stake +     │   │  Contract    │   │  chain)      │
│              │   │  answer)     │   │  fetches web)│   │              │
└──────────────┘   └──────────────┘   └──────────────┘   └──────────────┘
                       lock-in                 ↓
                                       ┌──────────────┐
                                       │ 3a. APPEAL   │
                                       │ (if data is  │
                                       │  anomalous)  │
                                       └──────────────┘
```

### 4.2 Question Types

| Category | Example | Data Sources |
|---|---|---|
| Numeric / objective | "What is BTC/USD closing price on Coinbase at 2026-05-01 23:59 UTC?" | Coinbase, Binance, CoinGecko APIs |
| Outcome / objective | "Which team wins El Clásico on 2026-05-04?" | ESPN, BBC Sport, official league |
| Structured subjective | "Who is judged the winner of tonight's presidential debate by post-debate polling across 3 national outlets?" | CNN, Detik, Kompas + LLM judge |
| Viral news | "Does film X get an IMDB rating ≥ 7.5 within its first 48 hours?" | IMDB, Rotten Tomatoes |

### 4.3 Staking Rules

- Each player *stakes* tokens (e.g. testnet GEN) to submit an answer.
- Answers are *hashed and committed* first (commit-reveal scheme) to prevent *front-running*.
- Prize pool = total stake − protocol fee (2%) − dev fee (per the GenLayer Dev Fee model).
- *Tie-breaker* for numeric questions: closest-to-the-pin wins.

### 4.4 Replayability

- **Daily rooms**: lightweight daily questions (asset prices, weather, sports).
- **Weekly rooms**: bigger questions tied to that week's viral news (auto-curated via trending APIs + LLM filter).
- **Seasonal tournaments**: season-long leaderboard, NFT badges for top oracle hunters.

### 4.5 Speed Round (5–15 minute mode for daily community gatherings)

To match the "Mini-games" mission format, rooms have a short mode that fits inside a GenLayer *daily community call*:

```
  T+0:00   Host opens the room → contract pulls 1 question from the pool
           (e.g. "What is BTC/USD price exactly 10 minutes from now on Coinbase?")
  T+0:00 → T+2:00   PREDICT phase: all players commit answer + small stake
  T+2:00 → T+12:00  LIVE phase: lively chat, the price moves in real time
  T+12:00  SETTLE: Intelligent Contract fetches the endpoint → settles via
           Equivalence Principle
  T+12:30  PAYOUT: closest-to-the-pin wins, leaderboard updated
```

Speed Round variants:
- **Price Pin** (numeric) — guess the exact / closest number.
- **Headline Hunter** (categorical) — guess who will be #1 trending on X/Twitter in 10 minutes.
- **Score Snipe** (live sports) — predict the half-time score of an ongoing match.
- **Sentiment Showdown** (subjective) — predict whether the next headline from a major outlet about topic X will be positive or negative (a pure stress test of Optimistic Democracy + LLM judging).

---

## 5. The GenLayer Role (Technical Detail)

### 5.1 Intelligent Contract

When the *settlement* block time is reached, the contract executes a non-deterministic block:

```python
# pseudocode — GenLayer-style Python contract
class WorldOracleHuntRoom(gl.Contract):
    question: str
    settlement_time: int
    sources: list[str]   # ex: ["https://api.coinbase.com/...", "https://api.binance.com/..."]
    answers: dict[Address, bytes32]  # commit hash
    revealed: dict[Address, str]

    @gl.public.write
    def settle(self):
        assert block.timestamp >= self.settlement_time

        # === non-deterministic block ===
        with gl.eq_principle_strict_eq():
            fetched = []
            for url in self.sources:
                data = gl.get_webpage(url, mode="json")  # native web fetch
                fetched.append(data)

            # LLM normalizes & cross-checks
            truth = gl.exec_prompt(
                f"""Given these {len(fetched)} sources answering:
                "{self.question}"
                Sources: {fetched}
                Return the single canonical answer. If sources disagree
                significantly, return 'ANOMALY' and explain why.
                """
            )
        # ===============================

        if truth.startswith("ANOMALY"):
            self._trigger_extended_review(truth)
            return

        self._distribute_payout(truth)
```

### 5.2 Equivalence Principle

- *Strict mode* for numeric questions (prices, scores) → all validators must arrive at the same number (with a small epsilon tolerance).
- *Comparative / non-comparative mode* for subjective questions → validators may answer with different paraphrases as long as they are *semantically equivalent* (e.g. "Candidate A wins" ≡ "Debate winner: A").

### 5.3 Optimistic Democracy

- **Initial validation**: the leader validator performs the fetch + reasoning; the other validators verify.
- **Finality window**: 1 hour (configurable per-room).
- **Appeal**: any player with evidence of an alternative source can post a bond → a fresh validator round decides whether to re-execute.
- **Slashing**: validators that consistently end up in the *minority* during re-execution lose stake → an economic incentive to stay honest.

This solves the "the API returned suspicious data" case from the original concept: **anomalies automatically trigger democratic consensus — no manual user proposer needed**.

---

## 6. System Architecture

```
Frontend (Next.js + GenLayer JS SDK)
         │
         ├── Wallet (MetaMask / GenLayer wallet)
         │
         ▼
Intelligent Contract: WorldOracleHuntFactory
         │
         ├── deploys ──► Room #1 (BTC price)
         ├── deploys ──► Room #2 (Election debate)
         └── deploys ──► Room #N
                              │
                              ▼
              GenLayer Validator Network
              (web fetch + LLM consensus)
                              │
                              ▼
              Trusted real-world data
              (Coinbase, ESPN, BBC, etc.)
```

---

## 7. Why This Is Hard / Impossible on Classical Smart Contracts

| Required capability | Classical EVM | GenLayer |
|---|---|---|
| Fetch an HTTPS endpoint from inside the contract | ❌ requires an external oracle | ✅ native `gl.get_webpage()` |
| Understand "debate winner" from free text | ❌ cannot parse natural language | ✅ `gl.exec_prompt()` to validator LLMs |
| Reach consensus when sources differ | ❌ revert / freeze | ✅ Equivalence Principle + Appeal |
| Deterministic settlement over subjective data | ❌ requires a manual committee | ✅ Optimistic Democracy |

---

## 8. Execution Roadmap

| Phase | Deliverable | Estimate |
|---|---|---|
| 0. Concept & feedback | This document, community feedback | week 1 |
| 1. MVP contract | `Room` contract (commit-reveal + settle) deployed to Testnet Bradbury | week 2 |
| 2. Frontend | Next.js dApp: list rooms, predict, claim payout | week 3 |
| 3. Multi-source | Add 3+ sources per question + anomaly detection | week 4 |
| 4. Game layer | Leaderboard, NFT badges, tournament | week 5 |
| 5. Mainnet | Post-Bradbury migration → mainnet, activate Dev Fee | TBD |

---

## 9. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| A web source is intentionally tampered with at settlement time | Multi-source + LLM cross-check + appeal |
| LLM hallucination | `eq_principle_strict_eq` for numeric questions, prompt with explicit "ANOMALY" instruction |
| Front-running of answers | Commit-reveal scheme |
| Ambiguous questions | Community-curator validators bond-review questions before a room goes live |
| Spammed rooms | Minimum stake required to create a room |

---

## 10. How to Submit on the GenLayer Portal

The `portal.genlayer.foundation/#/submit-contribution` portal has multiple categories. The **best-fit** category for this concept:

### 🎯 Primary option — Mission "Mini-games for GenLayer's Community" (Ongoing)

This mission explicitly invites multiplayer game submissions built on Intelligent Contracts + Optimistic Democracy. The brief is almost a 1:1 match for World Oracle Hunt.

**Submission steps:**
1. Open https://portal.genlayer.foundation/#/builders/contributions
2. Connect Wallet (top right button).
3. On the *"Mini-games for GenLayer's Community"* card → click **Submit →**.
4. Fill out the form:
   - **Description** → paste the contents of `portal-description-en.txt` (see attachment).
   - **Evidence URLs**:
     - Public link to the full concept (Medium / Mirror / public Notion / GitHub README) — at least 1 required.
     - Optional but very helpful: a demo video (Loom / YouTube ≤ 3 minutes).
     - Repo link if an MVP exists — optional.
   - **Date**: today's date.
5. Solve the reCAPTCHA → Submit. Initial status: **Pending Review** by a steward.

**Tips to score higher points:**
- Before submitting, cross-post the concept to the GenLayer Discord `#dev-chat` channel (and reference it in the mission topic) to get early feedback and visibility.
- Include at least one UI mockup (Figma / Excalidraw) — clear evidence of effort.
- Restate the four mission requirements (multiplayer, 5–15 min, replayable, leaderboard) explicitly in the description so reviewers can tick them off quickly.

### Parallel option — Open call "Projects & Milestones" (20–4000 pts)
After a minimal MVP exists (deployed contract + basic frontend), submit again as a milestone. The point range is significantly higher.

### Complementary option — "Educational Content" (20–600 pts)
If you also produce a tutorial / video / blog post explaining how to build World Oracle Hunt step-by-step, submit it separately under this category.

### Note on Hackathon Bradbury
DoraHacks registration is **closed**. The "Hackathon: GenLayer Testnet Bradbury" mission card on the portal still says *Ongoing* but only accepts entries that were already registered on DoraHacks during the hackathon window.

---

## 11. Submission Checklist

- [ ] GenLayer Foundation profile complete (display name + email)
- [ ] Correct contribution type selected
- [ ] Contribution date filled in (actual date, not the future)
- [ ] Description ≤ 1000 characters — reuse the elevator pitch from §1
- [ ] Evidence URLs (minimum one, ideally 2–3): article / repo / explorer link
- [ ] reCAPTCHA solved
- [ ] Submit → status **Pending Review** → wait for steward review

---

## 12. License & Attribution

Concept by **Rexa**, documented for the GenLayer community. Free to use / fork with attribution.

This document is built on top of the official documentation:
- [GenLayer Builder Program](https://portal.genlayer.foundation/)
- [Optimistic Democracy](https://docs.genlayer.com/understand-genlayer-protocol/core-concepts/optimistic-democracy)
- [Intelligent Contracts](https://docs.genlayer.com/understand-genlayer-protocol/what-are-intelligent-contracts)
- [Contribution Types](https://mintlify.com/genlayer-foundation/points/guides/contribution-types)
