# Test Plan: Kiro CLI Coding-Agent Benchmark (Small-Batch E2E → Full Run)

Date: 2026-07-29 · Status: **completed** — small batch and the full run
(`full-20260729`, 5,778 trials) are done; see
`results/full-20260729/full-report.md` for the execution history and
`results/full-20260729/report.md` for final scores.

## 1. Goals and metrics

Benchmark Kiro CLI across the three Artificial Analysis Coding Agent Index
components and report, per model variant:

- **pass@1 per benchmark** (task-normalized: mean of 3 attempts per task, then
  mean across tasks) and the **composite index** (simple average of the three
  benchmarks) — see `docs/methodology.md`.
- **Cost**: Kiro Credits per task/variant and USD at $0.04/credit (published
  overage rate). Kiro CLI exposes no token counts.
- **Wall-clock time** per task/variant.

## 2. Scope

### Small batch (this plan's execution target)

End-to-end pipeline validation: **3 tasks per benchmark × 4 model variants ×
3 attempts = 108 trials**.

- Variants: `auto`, `claude-opus-5`, `claude-sonnet-5`, `gpt-5.6-sol`
- Task list: `scripts/smoke_tasks.json`
- Estimated: ~2–2.5 h at concurrency ~12; ~1.5k–3k credits (~$60–120).

### Full run (follow-up, sized by small-batch measurements)

321 tasks (TB2 84 + DeepSWE 113 + SWE-Atlas-QnA 124) × 4–6 variants × 3
attempts. Account count needed = ⌈target concurrency ÷ measured per-account
concurrency limit⌉; the small batch doubles as the rate-limit probe.

## 3. Authentication

**Kiro API keys** (`KIRO_API_KEY`, created at app.kiro.dev → API Keys, Pro
tier+; see [kiro.dev/docs/cli/authentication](https://kiro.dev/docs/cli/authentication/)).
The adapters inject the key into the task container environment; no sqlite/SSO
state is staged (an active browser session would take precedence over the
key). File-based login-state upload remains as fallback when `KIRO_API_KEY`
is unset.

- Small batch needs **2 accounts** (validates multi-account dispatch; one
  would suffice to run).
- Keys are stored in AWS Secrets Manager (`kiro-bench/kiro-api-keys`);
  workers `shuf` the list at boot and rotate the key **per trial**
  (`keys[(trial_num + wid - 1) % N]`, logged per trial). Binding a key to a
  long-lived worker loop pins the fleet onto the first keys and causes
  rate-limit massacres — do not regress this.
- Credits consumed via API keys decrement the account's subscription credits;
  enable overage billing + budget alerts per account before the full run.

## 4. Pipeline architecture

```
enqueue_jobs.py ──► SQS jobs queue ──► EC2 workers (ASG, Docker + harnesses)
                                           │  one job = benchmark×task×model×attempt
                                           ▼
                                     normalized trial record + raw logs
                                           ▼
                          S3 results bucket ──► aggregate.py ──► report
```

- **Job message**: `{"run_id", "benchmark", "task", "model", "attempt"}` —
  produced by `scripts/enqueue_jobs.py` from `scripts/smoke_tasks.json`.
- **Worker** (`scripts/worker.sh`, launched by
  `infra/templates/user_data.sh.tftpl`): long-polls SQS, runs the matching
  harness (`harbor run` / `pier run` / SWE-Atlas runner), normalizes the
  outcome into a trial record, uploads to
  `s3://<bucket>/<run_id>/trials/<benchmark>/<task>/<model>/attempt-<n>.json`,
  deletes the message. The deterministic object key makes SQS retries
  idempotent (overwrite, not duplicate).
- **Trial record**: `{run_id, benchmark, task, model, attempt, status:
  passed|failed|error, credits, cost_usd, time_seconds, error_kind}`.
  `error` = infrastructure/agent failure (rate limit, auth, harness crash) —
  scores 0 per AA convention ("failed or errored attempts score 0") and is
  listed for re-run; a re-run overwrites the record at the same S3 key.
- **Aggregation** (`scripts/aggregate.py`): task-normalized pass@1 per
  benchmark, composite index, credits/cost/time per variant, JSON + Markdown.

## 5. AWS infrastructure (Terraform, `infra/`)

Flat, minimal stack: default VPC + one SG · S3 results bucket (versioned,
30-day lifecycle) · SQS jobs queue + DLQ (visibility timeout 2 h — a single
trial can be long) · Secrets Manager (API keys) · IAM instance profile ·
Launch template (Amazon Linux 2023, c7i.8xlarge, 500 GB gp3) + On-Demand ASG
· CloudWatch log group + alarms (DLQ messages, queue age).

Non-goals for the skeleton: multi-region, spot fleets, custom AMI (docker +
harnesses are installed in user_data; pre-baking is a full-run optimization).

## 6. Execution timeline (small batch)

| Phase | Duration | Content |
|---|---|---|
| Preflight | ~15 min | 1-task local smoke per benchmark (auth + adapter sanity) |
| Infra up | ~15 min | `terraform apply`, workers register healthy |
| Enqueue + run | ~2 h | 108 jobs; workers at concurrency ~12 across 2 accounts |
| Aggregate | ~15 min | `aws s3 sync` + `aggregate.py` → `results/<run_id>/report.md` |

Exit criteria: all 108 trials have a trial record (≤5% `error` after one
re-enqueue pass), report produced, per-variant credits/cost present.

## 7. Open items / risks

- **SWE-Atlas-QnA judge endpoint** — the QnA verifier is an LLM judge and
  needs `OPENAI_API_KEY`/`OPENAI_API_BASE` on every worker (official judge:
  `anthropic/claude-opus-4-5-20251101` via any OpenAI-compatible endpoint).
  No judge ⇒ all QnA tasks score 0. The QnA tasks themselves run on harbor
  with the same `KiroCliAgent` (no separate adapter).
- **Harness result.json schema** — `scripts/worker.sh:make_record` maps the
  harbor/pier result schema to trial records; marked REQUIRES-VALIDATION and
  must be checked against a real run on the run host.
- **Per-account concurrency limit** — unknown; watch for
  ThrottlingException/429 during the small batch (workers retry via SQS
  visibility timeout; DLQ after 2 receives).
- **API-key network endpoints in air-gapped pier sandboxes** — the pier
  `network_allowlist()` covers kiro.dev management/auth hosts; if API-key
  validation hits a host not on the list, add it (first pier smoke will show).
- **Credit budget** — set per-account billing alerts before the run; the
  queue can be drained (set ASG to 0) as a kill switch.
- **Version pinning** — record kiro-cli version, harness versions (SWE-Atlas
  officially pins harbor v0.18.0), and dataset revisions in
  `results/<run_id>/` alongside the report.
- **QnA resource footprint** — 16 CPU / 16 GB per QnA task and 3 h agent
  timeout; size worker instances and SQS visibility (4 h) accordingly.

## 8. Full-run operational checklist (validated 2026-08-01)

Hard-won steps for a clean one-shot full run; details and post-mortem in
`results/full-20260729/full-report.md` and
`docs/full-20260729-retrospective.md`.

1. **Repo → S3 sync with excludes**: `aws s3 sync . s3://<bucket>/repo/
   --exclude '.git/*' --exclude 'jobs/*' --exclude 'results/*'
   --exclude '*.tfstate*' --exclude 'infra/.terraform/*'
   --exclude 'kiro-pats*'` (a PAT file leaked once without the last one).
2. **Keys**: put all Kiro API keys in the `kiro-bench/kiro-api-keys` secret;
   verify each with `scripts/kiro_account_usage.py` (validity + remaining
   credits). Target ~4-6 concurrent trials per key
   (`worker_count × WORKER_CONCURRENCY ÷ keys`).
3. **Image caches**: pre-warm TB2 images via the docker-hub ECR PTC and QnA
   images via the ghcr ECR PTC (`scripts/warm_images.sh`); never let trials
   pull from ghcr/Docker Hub directly at run time.
4. **Monitor every run**: `scripts/monitor.py` (quality alerts catch
   rate-limit/no-telemetry blowouts within minutes) or the `app/` dashboard.
   The rolling failed-no-credits rate is the fastest contamination signal.
5. **Cleanup discipline**: after the queue drains, requeue **error records
   only** (`enqueue_jobs.py --jobs-file`); never retry `failed`. Repeat until
   residual errors are persistent-death only, then accept them as 0.
6. **Record repair**: never `reparse_records.py --upload` fleet-wide (stale
   job dirs clobber newer records). Use `--report-file` on workers +
   `scripts/merge_reparse_reports.py`.
7. **Hung agents**: a trial whose `kiro-cli.txt` is silent >45 min is dead
   (kiro API stream hang) — kill the harness process; the message is
   re-consumed normally. Do not wait for the 3-4 h timeout.
8. **Wrap-up**: check DLQ is empty, do a final report-merge, run
   `aggregate.py --provenance`, and only then scale workers to 0.
