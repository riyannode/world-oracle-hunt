# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""
World Oracle Hunt — single-room MVP Intelligent Contract

A multiplayer game where players guess a real-world data point before the
official oracle / trusted feed reports it. When `settle()` is called after
the room's settlement_time, the contract autonomously fetches data from
multiple web sources, asks the GenLayer validator LLMs to derive the
canonical answer, and pays out the closest-to-the-pin (numeric) or
exact-match (text) winner.

Targets the GenLayer Foundation Mini-games mission. See the full concept at:
https://gist.github.com/riyannode/7a354bfedfe42cb2124a8a74ae822d22

Author: Rexa (riyannode)
"""

import json
from dataclasses import dataclass

from genlayer import *


# ---------------------------------------------------------------------------
# Player record (persistent storage)
# ---------------------------------------------------------------------------
@allow_storage
@dataclass
class Prediction:
    player: Address
    answer: str  # raw answer the player submitted


# ---------------------------------------------------------------------------
# Room phases
# ---------------------------------------------------------------------------
PHASE_OPEN = "OPEN"           # players can still submit predictions
PHASE_LOCKED = "LOCKED"       # settlement_time hit; awaiting settle() call
PHASE_SETTLED = "SETTLED"     # canonical answer chosen, winner known
PHASE_ANOMALY = "ANOMALY"     # sources disagreed badly; needs appeal


class WorldOracleHuntRoom(gl.Contract):
    # ---- Configuration ----
    question: str               # human-readable question, e.g. "BTC/USD closing price on Coinbase at <ts>"
    answer_format: str          # "number" or "text"
    sources_csv: str            # comma-separated list of URLs the contract will fetch at settle time
    settlement_time: u256       # unix seconds; settle() can only succeed after this

    # ---- Game state ----
    creator: Address
    predictions: DynArray[Prediction]
    phase: str                  # PHASE_*
    canonical_answer: str       # filled after a successful settle()
    winner: Address             # filled after a successful settle()
    anomaly_reason: str         # filled if validators flag the sources

    # -----------------------------------------------------------------------
    def __init__(
        self,
        question: str,
        answer_format: str,
        sources_csv: str,
        settlement_time: u256,
    ):
        assert answer_format in ("number", "text"), \
            "answer_format must be 'number' or 'text'"
        assert len(sources_csv) > 0, "sources_csv must not be empty"

        self.question = question
        self.answer_format = answer_format
        self.sources_csv = sources_csv
        self.settlement_time = settlement_time
        self.creator = gl.message.sender_address
        self.phase = PHASE_OPEN
        self.canonical_answer = ""
        self.anomaly_reason = ""
        # `winner` defaults to the zero address

    # -----------------------------------------------------------------------
    # Read-only views
    # -----------------------------------------------------------------------
    @gl.public.view
    def get_state(self) -> dict:
        """Return everything a frontend needs to render the room."""
        return {
            "question": self.question,
            "answer_format": self.answer_format,
            "sources": self._sources(),
            "settlement_time": int(self.settlement_time),
            "creator": str(self.creator),
            "phase": self.phase,
            "num_predictions": len(self.predictions),
            "canonical_answer": self.canonical_answer,
            "winner": str(self.winner),
            "anomaly_reason": self.anomaly_reason,
        }

    @gl.public.view
    def get_predictions(self) -> list:
        return [
            {"player": str(p.player), "answer": p.answer}
            for p in self.predictions
        ]

    # -----------------------------------------------------------------------
    # Player actions
    # -----------------------------------------------------------------------
    @gl.public.write
    def predict(self, answer: str):
        """Submit a guess. One submission per address; can be replaced while
        the room is still OPEN."""
        if self.phase != PHASE_OPEN:
            raise gl.vm.UserError("Room is no longer accepting predictions")

        sender = gl.message.sender_address

        # If sender already submitted, replace it (last write wins until lock)
        for i in range(len(self.predictions)):
            if self.predictions[i].player == sender:
                self.predictions[i].answer = answer
                return

        self.predictions.append(Prediction(player=sender, answer=answer))

    @gl.public.write
    def lock(self):
        """Move from OPEN → LOCKED once settlement_time is reached. Anyone
        can call this; it just gates settle() from accepting late guesses."""
        if self.phase != PHASE_OPEN:
            raise gl.vm.UserError("Room is not OPEN")
        if gl.block.timestamp < int(self.settlement_time):
            raise gl.vm.UserError("Too early to lock the room")
        self.phase = PHASE_LOCKED

    # -----------------------------------------------------------------------
    # Core: GenLayer settlement (Intelligent Contract + Equivalence Principle)
    # -----------------------------------------------------------------------
    @gl.public.write
    def settle(self):
        """Fetch the configured web sources, ask validator LLMs to derive a
        single canonical answer, and pay out the winner.

        This is the heart of the GenLayer showcase:
        - `gl.nondet.web.get(...)` fetches HTTPS endpoints natively from the
          contract — no external oracle needed.
        - `gl.vm.run_nondet_unsafe(...)` runs the leader function plus a
          validator function so consensus is reached via the Equivalence
          Principle / Optimistic Democracy.
        """
        if self.phase != PHASE_LOCKED:
            raise gl.vm.UserError("Room must be LOCKED before settle()")

        question = self.question
        answer_format = self.answer_format
        urls = self._sources()

        def leader_fn() -> dict:
            # 1. Fetch every configured source.
            fetched = []
            for url in urls:
                page = gl.nondet.web.get(url)
                # Trim the body to keep on-chain payload bounded; LLM only
                # needs enough text to answer the question.
                fetched.append({"url": url, "body": page.body[:4000]})

            # 2. Ask the validator LLM to pick a canonical answer.
            prompt = f"""
You are settling a prediction-market question. Read the sources, then answer.

Question: {question}
Expected answer format: {answer_format}
Sources:
{json.dumps(fetched, indent=2)}

Rules:
- If the sources clearly agree, return the canonical answer.
- If they disagree by more than a small margin (e.g. >1% for numbers, or
  conflicting categorical results), return status="ANOMALY" and explain.
- For "number" format: return ONLY the numeric value, no currency symbols.
- For "text" format: return the shortest unambiguous label.

Reply with strict JSON:
{{
  "status": "OK" | "ANOMALY",
  "answer": "<canonical answer when status=OK, otherwise empty>",
  "reason": "<why ANOMALY, otherwise empty>"
}}
""".strip()
            raw = gl.nondet.exec_prompt(prompt)
            return json.loads(raw)

        def validator_fn(leader_result) -> bool:
            # Re-run the leader pipeline independently and compare only the
            # decision fields (status + canonical answer). Reasoning text can
            # differ between LLMs and is not compared.
            if not isinstance(leader_result, gl.vm.Return):
                return False
            mine = leader_fn()
            theirs = leader_result.calldata
            if mine.get("status") != theirs.get("status"):
                return False
            if mine.get("status") != "OK":
                # Both flagged ANOMALY — accept regardless of reason text.
                return True
            return self._answers_match(
                mine.get("answer", ""),
                theirs.get("answer", ""),
            )

        result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)

        if result.get("status") != "OK":
            self.phase = PHASE_ANOMALY
            self.anomaly_reason = result.get("reason", "")
            return

        canonical = result.get("answer", "").strip()
        if canonical == "":
            raise gl.vm.UserError("Leader returned empty canonical answer")

        self.canonical_answer = canonical
        self.winner = self._pick_winner(canonical)
        self.phase = PHASE_SETTLED

    # -----------------------------------------------------------------------
    # Internal helpers
    # -----------------------------------------------------------------------
    def _sources(self) -> list[str]:
        return [s.strip() for s in self.sources_csv.split(",") if s.strip()]

    def _answers_match(self, a: str, b: str) -> bool:
        """Lightweight equivalence used in validator_fn."""
        if self.answer_format == "number":
            try:
                fa = float(a.replace(",", "").strip())
                fb = float(b.replace(",", "").strip())
            except (TypeError, ValueError):
                return False
            denom = max(abs(fa), abs(fb), 1e-9)
            return abs(fa - fb) / denom <= 0.005  # 0.5% tolerance
        return a.strip().lower() == b.strip().lower()

    def _pick_winner(self, canonical: str) -> Address:
        """Numeric: closest-to-the-pin. Text: first exact match wins."""
        if len(self.predictions) == 0:
            return Address(b"\x00" * 20)

        if self.answer_format == "number":
            try:
                target = float(canonical.replace(",", "").strip())
            except (TypeError, ValueError):
                return Address(b"\x00" * 20)

            best_idx = 0
            best_diff = float("inf")
            for i in range(len(self.predictions)):
                try:
                    guess = float(
                        self.predictions[i].answer.replace(",", "").strip()
                    )
                except (TypeError, ValueError):
                    continue
                diff = abs(guess - target)
                if diff < best_diff:
                    best_diff = diff
                    best_idx = i
            return self.predictions[best_idx].player

        target = canonical.strip().lower()
        for i in range(len(self.predictions)):
            if self.predictions[i].answer.strip().lower() == target:
                return self.predictions[i].player

        return Address(b"\x00" * 20)
