# AGENTS.md

This file provides guidance to coding agents when working with code in this repository.

## What this repo is

A benchmarking harness that runs **Kiro CLI** (a headless coding agent, `kiro-cli`) across multiple models against three public benchmarks, replicating the Artificial Analysis Coding Agent Index. The repo itself contains no benchmark tasks or evaluators — those live in external harnesses (`harbor`, `pier`) and a sibling `benchmarks-src/` checkout. This repo's real code is the **adapters** that plug Kiro CLI into those harnesses, plus orchestration/analysis scripts.

Read `README.md` (scope), `docs/methodology.md` (scoring rules + deviations from Artificial Analysis), and `docs/adapter-usage.md` (how to run) before making changes.

## Commands

```bash
# Verify host has required tools (git, terraform, jq, kiro)
python3 scripts/check_env.py

# Install the two benchmark harnesses (external, not vendored here)
uv tool install harbor            # Terminal-Bench 2.0
uv tool install datacurve-pier    # DeepSWE

# Run a single Terminal-Bench 2.0 task (Harbor). -n = concurrent trials, -k/-n control attempts.
PYTHONPATH=$PWD harbor run -d terminal-bench@2.0 \
  --agent adapters.kiro_cli.harbor_agent:KiroCliAgent \
  -m claude-sonnet-4.6 -i <task-name> -n 1

# Run a single DeepSWE task (Pier)
PYTHONPATH=$PWD pier run -p <path-to>/deep-swe/tasks \
  --agent-import-path adapters.kiro_cli.pier_agent:PierKiroCliAgent \
  -m claude-sonnet-4.6 -i <task-name> -n 1

# Phase 2 pilot (both benchmarks × {auto, claude-opus-5} × sampled tasks × 3 attempts)
setsid scripts/run_pilot.sh &   # detach-safe; watch ../pilot/logs/pilot.log

# Distributed small batch (AWS): enqueue jobs, then aggregate from S3
python3 scripts/enqueue_jobs.py --queue-url <jobs-queue-url> --run-id <run-id>
python3 scripts/aggregate.py results/<run-id>/trials --markdown-out report.md

# Requeue specific trials (e.g. all current errors) from a JSON list
python3 scripts/enqueue_jobs.py --run-id <run-id> --jobs-file <retry-list.json> --queue-url <jobs-queue-url>

# Live ops: run monitor + dashboard while a batch is in flight
python3 scripts/monitor.py --queue-url <jobs-queue-url> --dlq-url <dlq-url> \
  --bucket <results-bucket> --run-id <run-id>
python3 app/server.py        # dashboard at http://127.0.0.1:8080

# Rebuild trial records from worker job dirs (multi-worker safe path):
# 1) on each worker: reparse_records.py --jobs-dir ... --report-file r.json && upload r.json
# 2) locally:        merge_reparse_reports.py --bucket <b> --run-id <id>   (newest record wins)
```

- Harness commands **must** run from the repo root with `PYTHONPATH=$PWD` so `adapters.kiro_cli.*` is importable.
- In non-login shells the invoking user is in the `docker` group only via `sg docker -c '...'`; wrap harness commands accordingly (see `run_pilot.sh`).
- `-m` accepts bare kiro-cli model ids (`auto`, `claude-opus-5`, `claude-sonnet-5`, `claude-opus-4.8`, `claude-sonnet-4.6`, `gpt-5.6-sol`) or provider-prefixed (`kiro/...`). `resolve_model()` just strips the prefix; default is `auto`.

## Architecture

**Three-file adapter layer** (`adapters/kiro_cli/`):
- `kiro_common.py` — all shared logic: locating host binary/auth files, building the headless chat command, CA-cert install command, and telemetry parsing. Both agents import from here; **put shared behavior here, not in one agent.**
- `harbor_agent.py` (`KiroCliAgent`) subclasses harbor's `BaseInstalledAgent`.
- `pier_agent.py` (`PierKiroCliAgent`) subclasses pier's `BaseInstalledAgent`.

**Invocation details that matter (hard-won):**
- `build_chat_command` invokes **`kiro-cli-chat` directly**, not the `kiro-cli` launcher: kiro-cli 2.15.x re-splits argv when forwarding to kiro-cli-chat, so any instruction with bullet lines starting with `- ` dies in clap parsing before the session starts. Keep both binaries staged (whoami/--version still use the launcher), but never route a prompt through it.
- The tee pipeline must **fall back to plain `tee` when `stdbuf` is missing** — several minimal task images (SWE-Atlas QnA repos) lack coreutils, and `| stdbuf -oL tee` would fail the whole command instantly.

The two agents are near-mirrors but differ in **where staging happens**, which is the key non-obvious design point:
- **Harbor** uploads the binary + auth state in `install()` (runs against a live container).
- **Pier** cannot: pier inlines `install_spec()` into the image **build**, where host `upload_file`/`upload_dir` don't exist yet. So Pier does the upload live at the start of `run()` via `_stage_and_install()`; `install_spec()` only carries build-safe steps (CA certs). If you add setup logic, put container-live steps in the right place for each harness.

**Auth model (no credentials in the repo).** Two modes, chosen automatically: when `KIRO_API_KEY` is set on the host, the agents inject it into the container environment and stage no auth files (a staged browser session would take precedence over the key — see kiro.dev/docs/cli/authentication). Otherwise, each trial uploads from the host at run time: `~/.local/share/kiro-cli/data.sqlite3` and `~/.aws/sso/` (login state is portable across `$HOME`s and OIDC tokens auto-refresh). In both modes each trial also uploads both `kiro-cli` and `kiro-cli-chat` binaries (the former execs the latter — upload both), and both agents verify with `kiro-cli whoami` and **fail fast** if it doesn't work. Host paths are overridable via `KIRO_CLI_BINARY_DIR`, `KIRO_CLI_AUTH_HOME`, `KIRO_CLI_REGION`, `KIRO_CLI_CA_BUNDLE`.

**Air-gapped DeepSWE.** Pier task sandboxes run `network_mode = no-network`. `PierKiroCliAgent.network_allowlist()` declares exactly the hosts kiro-cli needs (inference, OIDC refresh, telemetry, kiro.dev management/auth) for a given region. New kiro network dependencies must be added there or runs will hang/fail. DeepSWE grades the **git diff of `/app`**, so `run()` has a `finally` block that commits any uncommitted changes as a safeguard — preserve that.

**AWS worker fleet (`infra/`).** Terraform-managed: SQS jobs queue → EC2 workers (systemd runs `scripts/worker.sh`) → S3 results bucket. The repo working tree is distributed to workers **via S3** (`s3://<results-bucket>/repo/`), not git — sync it before/while workers boot, and **always `--exclude 'kiro-pats*'`** (a PAT file once leaked to the bucket this way). `scripts/enqueue_jobs.py` creates jobs (one message = benchmark × task × model × attempt); each trial uploads a normalized JSON record; `scripts/aggregate.py` turns those into pass@1/cost reports. SWE-Atlas-QnA runs on harbor with the same `KiroCliAgent` (`-d scale-ai/swe-atlas-qna`) and needs `OPENAI_API_KEY`/`OPENAI_API_BASE` for its LLM-judge verifier.

**Kiro key rotation (per trial, not per process).** Workers read the key list from Secrets Manager (`<project>/kiro-api-keys`), `shuf` it at startup, and rotate `KIRO_API_KEY` **per trial** (`keys[(trial_num + wid - 1) % N]`, logged as `using key X/N`). Binding a key to a long-lived loop pins the whole fleet onto the first keys and triggers rate-limit massacres — that was the single largest contamination source of the first full run. Size the fleet at ~4-6 concurrent trials per key.

**Trial record taxonomy and the no-telemetry invariant.** Records are `{status: passed|failed|error, credits, cost_usd, time_seconds, error_kind}`; harnesses score every agent death as reward 0, so `worker.sh make_record` (and `reparse_records.derive`, kept in sync) reclassifies by scanning `kiro-cli.txt`: `rate_limit` / `transient_api` / `db_locked` signatures, plus the invariant **failed + no credits → `error/no_telemetry`** — unless the log shows substantial work (≥5 tool calls or ≥10 KB; ~10% of completed harbor runs lose the trailing Credits line, their verifier 0 is genuine). `error` never counts as a result: requeue it (deterministic S3 key overwrites); `failed` is never retried.

**Repair workflow (do not skip).** To re-derive records fleet-wide, never run `reparse_records.py --upload` on every worker — stale job dirs on other workers clobber newer records (last writer wins on the same S3 key). Use `--report-file` + `scripts/merge_reparse_reports.py` (keeps the record from the newest trial result.json per key). QnA job dirs are nested (`scale-ai/` in the task name) — the reparse handles it; keep any new job-name logic compatible.

**Observability.** `scripts/monitor.py` watches queue depth + records and raises quality alerts on rolling-window rate-limit/no-telemetry deaths and 45-min stalls (agent stream hangs are real — kiro API streams can die silently; kill trials whose kiro-cli.txt is silent >45 min, they retry cleanly). `app/` is a localhost dashboard (`python3 app/server.py`, Vite+React UI in `app/web/`): queue, worker fleet, per-key credit usage via `scripts/kiro_account_usage.py`, and the task × model × attempt status matrix.

**Telemetry = credits, not tokens.** Kiro CLI does not expose token counts. Each headless run prints a trailing `Credits: X.XX • Time: Ys` line; output is teed to `kiro-cli.txt` in the trial's logs. `parse_telemetry()` sums credits across turns, takes the last time value, and computes `cost_usd = credits × $0.04` (`CREDIT_USD_RATE`, the published overage rate). `populate_context_post_run()` writes this into the harness `result.json`. Exact credit values are also queryable from `data.sqlite3` (`conversations_v2` → `user_turn_metadata.usage_info`).

## Constraints when editing

- **Never commit auth material.** `data.sqlite3`, `kiro-auth-token*.json`, `sso/cache/`, and `kiro-pats*.txt` are gitignored; keep it that way. `KIRO_API_KEY` values likewise come from the host env or Secrets Manager at run time — never write them into the repo. Auth is always read from the host at run time. Mirror the repo to S3 with `--exclude 'kiro-pats*'` (and the usual `.git/jobs/results/tfstate` excludes).
- Keep the harbor and pier adapters behaviorally in sync via `kiro_common.py` — a change to command building, auth staging, or telemetry should generally touch the shared module, not one agent.
- The uploaded binary is glibc-linked (requires GLIBC 2.34; ~800 MB, `docker cp`, no in-sandbox download). For older-glibc/musl task images the adapters fall back to kiro's musl build, expected on the host at `~/.local/bin-musl` (override `KIRO_CLI_MUSL_BINARY_DIR`); if the musl pair is absent, those tasks fail at install-time `whoami`.
- When changing scoring or task counts, update `docs/methodology.md` — it tracks the exact alignment with (and deviations from) the Artificial Analysis methodology being replicated.
