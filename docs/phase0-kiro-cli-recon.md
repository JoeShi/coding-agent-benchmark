# Phase 0 Recon: Kiro CLI Automation Feasibility

Date: 2026-07-27 · Environment: kiro-cli 2.14.2, IAM Identity Center login (us-east-1)

**Conclusion: feasible, no blockers.**

## Headless mode

```bash
kiro-cli chat --no-interactive --trust-all-tools --model <MODEL_ID> "<prompt>"
```

- `--no-interactive` runs to completion and exits; `--trust-all-tools` lets the agent use tools (file writes, shell) without prompts.
- Fine-grained allowlists available via `--trust-tools=fs_read,fs_write`.

## Model selection

`--model <model_id>`; full list via `kiro-cli chat --list-models -f json`. All six target variants exist:

| Variant | model_id | Context | Credit multiplier |
|---|---|---|---|
| Auto | `auto` | 1M | 1.0× |
| Opus 5 | `claude-opus-5` | 1M | 2.2× |
| Sonnet 5 | `claude-sonnet-5` | 1M | 1.3× |
| Opus 4.8 | `claude-opus-4.8` | 1M | 2.2× |
| Sonnet 4.6 | `claude-sonnet-4.6` | 1M | see `--list-models` |
| GPT 5.6 Sol | `gpt-5.6-sol` | 272k | 2.4× |

## Telemetry (credits, not tokens)

- Each run prints `Credits: X.XX • Time: Ys`.
- Structured extraction: local sqlite `~/.local/share/kiro-cli/data.sqlite3`, table `conversations_v2` → `user_turn_metadata.usage_info` (exact credit value), plus `request_metadata.context_usage_percentage`.
- Raw token counts are **not exposed** (fields exist but are null).
- For multi-request sessions, sum `usage_info` across the conversation.

## Concurrency

Two parallel headless sessions ran concurrently with no degradation (only N=2 tested; higher-N throttling thresholds to be probed in the pilot).

## Credentials

OIDC access tokens are short-lived (~15 min observed) and auto-refreshed by the CLI. Since each task is a fresh CLI invocation, refresh happens naturally; low risk for unattended runs.

## End-to-end smoke task

Task: implement an LRU cache + pytest suite, self-run until passing (claude-sonnet-4.6).
Result: **1.13 credits, 1m36s**, 30 tests written; independently re-run, all 30 passed.

## Full-run cost/time rough estimate (to be calibrated by pilot)

- Scale: 321 tasks × 3 attempts × 6 variants = **5,778 attempts**.
- Toy task cost 1.13 credits; real benchmark tasks (DeepSWE especially: reference solutions average 668 LOC across 7 files) estimated 10–50 credits per attempt at Sonnet level; average variant multiplier ≈ 1.7×.
- Rough total: **80k–500k credits ≈ $3.2k–$20k @ $0.04/credit**. Very high uncertainty — the pilot exists to tighten this.
- Subscription plans cap monthly included credits (Power tier: 10,000/month); overage billing at $0.04/credit must be enabled.
- Time: at ~30 min/attempt average and concurrency 20, ≈ 6 days; sustainable concurrency TBD.
