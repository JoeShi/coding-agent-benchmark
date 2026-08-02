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
5. **SWE-Atlas-QnA judge**: official scoring uses an LLM judge (default `anthropic/claude-opus-4-5-20251101` via any OpenAI-compatible endpoint, credentials passed to the verifier as `OPENAI_API_KEY`/`OPENAI_API_BASE`). Judge inference cost is separate from (and not included in) the Kiro-credit cost numbers; judge endpoint/model availability may differ from Artificial Analysis's setup.
6. **SWE-Atlas-QnA agent network restriction**: the official run config restricts the agent phase to a single allowlisted host. Kiro CLI needs several endpoints (inference, OIDC refresh, telemetry, kiro.dev management/auth), so we run the agent phase without that restriction (a kiro-cli agent only talks to its own backend regardless).

## Error sensitivity view

The published leaderboard view uses the Artificial Analysis convention: every
failed or errored attempt scores 0. The report also includes an explicitly
non-ranking sensitivity view, **Exclude errors**, to show how residual
infrastructure and backend failures affect the six Kiro variants. For this
view, errored attempts are removed within each task, the remaining binary
attempts are averaged, and then task and benchmark averages are calculated in
the normal order. A task with no valid attempts is omitted from that benchmark
average. Artificial Analysis comparison scores are unchanged in this view.

This normalized result is diagnostic only and must not replace the official
score, because models with different error rates then have different effective
attempt and, occasionally, task coverage.

## Version

Tracked methodology version: **v1.3** (SWE-Atlas-QnA scored as binary pass/fail aligned with Scale AI Task Resolve Rate).
