# Benchmark Aggregate Report

| Model | TB2 pass@1 | DeepSWE pass@1 | SWE-Atlas-QnA pass@1 | Composite | Credits | Cost (USD) | Mean time | Error trials |
|---|---|---|---|---|---|---|---|---|
| auto | 0.603 (84 tasks) | 0.209 (113 tasks) | 0.290 (124 tasks) | 0.368 | 9012.68 | $360.51 | 499s | 18 |
| claude-opus-4.8 | 0.738 (84 tasks) | 0.572 (113 tasks) | 0.505 (124 tasks) | 0.605 | 23312.86 | $932.51 | 651s | 12 |
| claude-opus-5 | 0.778 (84 tasks) | 0.670 (113 tasks) | 0.508 (124 tasks) | 0.652 | 30033.19 | $1201.33 | 884s | 52 |
| claude-sonnet-4.6 | 0.611 (84 tasks) | 0.136 (113 tasks) | 0.333 (124 tasks) | 0.360 | 13337.17 | $533.49 | 515s | 17 |
| claude-sonnet-5 | 0.698 (84 tasks) | 0.319 (113 tasks) | 0.363 (124 tasks) | 0.460 | 26113.85 | $1044.55 | 693s | 10 |
| gpt-5.6-sol | 0.766 (84 tasks) | 0.667 (113 tasks) | 0.535 (124 tasks) | 0.656 | 12587.16 | $503.49 | 553s | 13 |

Scores are task-normalized pass@1 (3 attempts averaged per task, then
averaged across tasks). Errored trials score 0 (AA convention) and are
listed in the JSON output for re-running; a re-run overwrites the record.
Credits/cost are observed lower bounds and mean time uses only trials with
telemetry. Coverage by model is recorded in the JSON output.

## Run environment

- kiro-cli: 2.15.1 (glibc), 2.15.2 (musl fallback) — KIRO_API_KEY x13 independent Kiro accounts, shuffled per worker, rotated per trial
- harnesses: harbor 0.20.0, pier 0.3.0
- datasets: terminal-bench@2.0 (harbor registry, 84 tasks = AA evaluated subset) / commit e016041a6ccf8da29906afc9a3f5a8df940a1f78 (113 tasks) / scale-ai/swe-atlas-qna (harbor registry, 124 tasks)
- QnA judge: claude-opus-4-5 via a private OpenAI-compatible proxy (host redacted)
- infra: 25 (21x c7i.4xlarge + 4x c7i.8xlarge), 3 loops each = 75 concurrent trials (~5.8 per key) in us-east-1
