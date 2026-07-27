# coding-agent-benchmark

Benchmarking [Kiro CLI](https://kiro.dev) coding-agent performance and cost across multiple models, replicating the [Artificial Analysis Coding Agent Index](https://artificialanalysis.ai/agents/coding-agents) methodology so results can be positioned against their public leaderboard.

## What this measures

The Artificial Analysis Coding Agent Index is a simple average of task-normalized pass@1 across three public benchmarks (3 attempts per task):

| Component | Tasks | Type | Scoring |
|---|---|---|---|
| [DeepSWE](https://github.com/datacurve-ai/deep-swe) | 113 | Long-horizon implementation | Program verifier, binary pass/fail |
| [Terminal-Bench v2](https://github.com/laude-institute/terminal-bench) | 84 | Agentic terminal use | Test suite pass/fail |
| [SWE-Atlas-QnA](https://github.com/scaleapi/SWE-Atlas) | 124 | Repository Q&A | Binary pass/fail (Task Resolve Rate) |

Per-variant metrics: pass@1 per benchmark, composite index, cost per task, and wall-clock time per task.

## Variants under test

Kiro CLI with: **Auto, Claude Opus 5, Claude Sonnet 5, Claude Opus 4.8, Claude Sonnet 4.6, GPT 5.6 Sol** — all with default reasoning settings.

## Cost model

Kiro is subscription-based and does not expose raw token counts, so cost is measured in **Kiro Credits × $0.04/credit** (the published overage rate). This is a known deviation from Artificial Analysis's API per-token cost basis — see [`docs/methodology.md`](docs/methodology.md) for full alignment notes and deviations.

## Repository layout

- `docs/` — methodology alignment notes, recon findings
- `adapters/` — Kiro CLI agent adapters for each benchmark harness
- `scripts/` — run orchestration, scoring, analysis
- `results/` — structured run results (JSON) and aggregates

## Status

- [x] Phase 0 — Kiro CLI automation recon (see `docs/phase0-kiro-cli-recon.md`)
- [ ] Phase 1 — Repo scaffold + benchmark adapters
- [ ] Phase 2 — Pilot run (~10 tasks/benchmark × 3 attempts × 1–2 variants)
- [ ] Phase 3 — Full run (6 variants × 321 tasks × 3 attempts)
- [ ] Phase 4 — Analysis, leaderboard comparison, release
