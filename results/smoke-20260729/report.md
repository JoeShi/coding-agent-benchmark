# Benchmark Aggregate Report

| Model | TB2 pass@1 | DeepSWE pass@1 | SWE-Atlas-QnA pass@1 | Composite | Credits | Cost (USD) | Mean time | Error trials |
|---|---|---|---|---|---|---|---|---|
| auto | 0.556 (3 tasks) | 0.222 (3 tasks) | 0.667 (3 tasks) | 0.481 | 141.22 | $5.65 | 326s | 0 |
| claude-opus-5 | 1.000 (3 tasks) | 0.556 (3 tasks) | 0.444 (3 tasks) | 0.667 | 599.97 | $24.00 | 733s | 0 |
| claude-sonnet-5 | 0.889 (3 tasks) | 0.000 (3 tasks) | 0.778 (3 tasks) | 0.556 | 393.60 | $15.74 | 631s | 0 |
| gpt-5.6-sol | 0.667 (3 tasks) | 0.556 (3 tasks) | 0.778 (3 tasks) | 0.667 | 274.91 | $11.00 | 560s | 0 |

Scores are task-normalized pass@1 (3 attempts averaged per task, then
averaged across tasks). Errored trials score 0 (AA convention) and are
listed in the JSON output for re-running; a re-run overwrites the record.
