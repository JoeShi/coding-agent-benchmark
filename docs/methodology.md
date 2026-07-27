# Methodology Alignment

This project replicates the [Artificial Analysis Coding Agent Index](https://artificialanalysis.ai/methodology/coding-agents-benchmarking) (methodology v1.3, July 2026) as closely as publicly possible.

## Index construction (as published by Artificial Analysis)

- Per benchmark: for each task, average the 3 evaluated attempts (binary pass/fail), then average across tasks so every task has equal weight (task-normalized pass@1).
- Composite index: simple average of the three benchmark scores.
- Components: DeepSWE (113 tasks), Terminal-Bench v2 (84 of 89 tasks — five excluded for environment compatibility), SWE-Atlas-QnA (124 tasks).
- Agent variants use default reasoning settings.

## Where we match

- Same three public benchmarks and their official evaluators, unmodified.
- 3 attempts per task, binary outcomes, task-normalized averaging, simple-average index.
- Default model/reasoning settings in Kiro CLI.

## Known deviations

1. **Cost basis**: Kiro CLI does not expose token counts, so we cannot report input/cache/output token breakdowns or API per-token cost. Cost is reported as Kiro Credits × $0.04 (published overage rate), with `context_usage_percentage` as a context-consumption proxy.
2. **Model serving**: Kiro routes models via Amazon Bedrock; served model revisions may differ from what Artificial Analysis evaluates via first-party APIs.
3. **Terminal-Bench exclusions**: we follow the same 84-task subset as Artificial Analysis where the exclusion list is publicly derivable; otherwise we run the full 89 and report both numbers.
4. **Environment**: our sandbox hosts differ from Artificial Analysis's, which can affect wall-clock time and, rarely, environment-sensitive tasks.

## Version

Tracked methodology version: **v1.3** (SWE-Atlas-QnA scored as binary pass/fail aligned with Scale AI Task Resolve Rate).
