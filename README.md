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

## Infrastructure and execution flow

Runs execute on a small Terraform-managed AWS fleet (`infra/`, see `infra/README.md`):

```
enqueue_jobs.py ──► SQS jobs queue ──► EC2 workers (ASG, c7i.8xlarge, Docker)
                                           │  1 message = benchmark × task × model × attempt
                                           ▼
                                  trial record + raw harness logs
                                           ▼
                      S3 results bucket ──► aggregate.py ──► pass@1 / credits / cost report
```

- **Adapters**: `KiroCliAgent` (harbor: Terminal-Bench 2.0 + SWE-Atlas-QnA) and `PierKiroCliAgent` (pier: DeepSWE, air-gapped with a network allowlist) run `kiro-cli-chat chat --no-interactive` inside each task container. Auth is a Kiro API key (`KIRO_API_KEY`) injected into the container; workers read the key list from Secrets Manager, shuffle it at boot, and rotate the key **per trial** to spread per-account rate limits.
- **Worker** (`scripts/worker.sh`, systemd): long-polls SQS, runs one harness trial per message, normalizes the outcome into a trial record (`status: passed|failed|error`, credits, cost, wall time), uploads it to a deterministic S3 key (retries overwrite, never duplicate), then deletes the message. Failed messages redrive to a DLQ; CloudWatch alarms watch DLQ depth and queue age.
- **Repo distribution**: the working tree (adapters + scripts) is synced to `s3://<results-bucket>/repo/` by the operator; workers pull it at boot — no git push needed to run uncommitted changes.
- **SWE-Atlas-QnA judging**: the QnA verifier is an LLM judge (rubric → binary pass/fail); workers carry `OPENAI_API_KEY`/`OPENAI_API_BASE`/`EVAL_MODEL` for the judge endpoint. Judge cost is separate from Kiro credits.
- **Aggregation** (`scripts/aggregate.py`): task-normalized pass@1 per benchmark, composite index, credits/cost/time per variant; errored trials score 0 per AA convention.
- **Local web UI** (`app/`): `cd app/site && npm run dev` serves the Next.js site on 3000. `/` is the results leaderboard, `/monitor` shows queue depth, worker fleet health, per-key Kiro credit usage, and the per-task completion matrix. Both read static snapshots by default; while a run is in flight, start `python3 app/server.py` (monitor API on 8081, proxied as `/api/*`) and switch `/monitor` to Live. See `app/README.md`.

The full runbook (batch sizing, timeline, risks) is in [`docs/test-plan.md`](docs/test-plan.md).

## Repository layout

- `docs/` — methodology alignment notes, recon findings, test plan, full-run retrospective (`full-20260729-retrospective.md`)
- `adapters/` — Kiro CLI agent adapters for each benchmark harness
- `scripts/` — run orchestration, scoring, analysis
- `infra/` — Terraform for the AWS worker fleet (SQS → EC2 workers → S3)
- `app/` — localhost monitoring dashboard (Python API + Vite/React UI)
- `results/` — structured run results (JSON) and aggregates

## Status

- [x] Phase 0 — Kiro CLI automation recon (see `docs/phase0-kiro-cli-recon.md`)
- [x] Phase 1 — Repo scaffold + benchmark adapters (harbor, pier; SWE-Atlas-QnA runs on harbor with the same adapter)
- [x] Phase 2 — Small-batch E2E (3 tasks/benchmark × 4 variants × 3 attempts, see `docs/test-plan.md` and `results/smoke-20260729/report.md`)
- [x] Phase 3 — Full run (6 variants × 321 tasks × 3 attempts; see `results/full-20260729/full-report.md`)
- [ ] Phase 4 — Analysis, leaderboard comparison, release
