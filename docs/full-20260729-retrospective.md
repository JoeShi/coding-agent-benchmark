# Full run full-20260729 — execution history and pitfalls

A retrospective of the full benchmark run (321 tasks × 6 model variants × 3
attempts = 5,778 trials): how many passes it took to get clean data, and
every trap we hit. Written so the next run avoids them.

## Rounds

| Round | Jobs | Outcome |
|---|---|---|
| Smoke `smoke-20260729` | 108 | Passed; validated the pipeline end to end. Report in `results/smoke-20260729/report.md`. |
| Full pass 1 | 5,778 | **Heavily contaminated** — only ~29% of records trustworthy. Root cause: key-rotation bug (see below). |
| Cleanup 1 | 3,445 re-queued | After rate-limit reclassification. Cleaned ~93%. |
| Cleanup 2 | 422 re-queued | After discovering the `transient_api` death mode. |
| Cleanup 3 | 956 re-queued | After adopting the no-telemetry invariant (all remaining suspect `failed` records). |

Final dataset: 5,778 records, residual error ≈ 1% (scores 0 per AA
convention). Aggregate in `results/full-20260729/report.md`.

## Pitfalls (the ones that cost us)

### 1. Key rotation pinned every worker to the first 4 keys
`worker_loop` bound `KIRO_API_KEY` **once at loop start**
(`keys[(wid-1) % N]`). With 4 loops/worker and 6 keys, all 25 workers used
only keys[0..3] — 25 concurrent trials per key, keys 5-6 idle. Kiro rate
limits killed ~2,600 trials, which harnesses scored as reward 0 ("failed").
Fix: shuffle keys per worker, rotate **per trial**
(`keys[(trial_num + wid - 1) % N]`), log `using key X/N` per trial.

### 2. Agent deaths are scored as genuine failures
Neither harness distinguishes "agent solved nothing" from "agent never
ran": pier records `NonZeroAgentExitCodeError` → reward 0; harbor runs the
verifier on the dead agent's workspace → 0. Every kiro-cli death mode
becomes a fake `failed` unless intercepted. Detection signature that
actually works: **a completed agent run always prints a `Credits:` line** —
a `failed` record with `credits: null` is never trustworthy.

### 3. Death modes come in layers (whack-a-mole)
Each cleanup round exposed the next layer:
- **kiro-cli 2.15.x arg-forwarding regression (the biggest one).** The
  `kiro-cli` launcher re-splits argv when forwarding to `kiro-cli-chat`;
  any task instruction with bullet lines starting with `- ` dies instantly
  in clap ("unexpected argument '- ' found") — zero credits, no session,
  verifier scores the untouched workspace 0. kiro-cli 2.9.0 parses the same
  prompt fine. Fix: invoke `kiro-cli-chat` directly in
  `build_chat_command`. This was the dominant cause of the 360 "no agent
  log" deaths — specific tasks failed on *every* model and attempt, which
  is the signature that exposed it.
- `⚠️ Kiro rate limit reached: Request quota exceeded` → `error/rate_limit`
- `Kiro is having trouble responding … failed to generate a response`
  (transient backend failure, 39-second empty trials) → `error/transient_api`
- `error: Failed to open database: database is locked` (kiro-cli sqlite
  lock at startup under concurrency) → `error/db_locked`
- killed mid-run by our own worker restarts — no text at all.

Final fix (the invariant, now in `worker.sh make_record` and
`reparse_records.derive`): `status==failed and credits is None` →
`error/no_telemetry`, **unless the agent log shows substantial work**
(≥5 tool calls or ≥10 KB) — ~10% of completed harbor runs lose the trailing
Credits line, and their verifier 0 is a genuine fail. Verified safe: 0
trials with a `Credits:` line were ever mis-parsed.

### 4. reparse overwrote good records (multi-worker, last-writer-wins)
A retried trial lands on an arbitrary worker; the old job dir stays on the
original one. Fleet-wide `reparse --upload` let **stale dirs clobber newer
records** on the same deterministic S3 key — 667 `passed` flipped to
`error`. Fix: `--report-file` mode + `scripts/merge_reparse_reports.py`
(per trial, keep the record from the dir with the newest `result.json`
mtime). Never `--upload` from multiple workers directly.

### 5. reparse skipped all QnA job dirs
QnA task names contain `/` (`scale-ai/task-…`), so job dirs are nested
(`jobs/<run>-swe-atlas-qna-scale-ai/<task>-<model>-a<n>/`). Top-level
iteration parsed none of them — 2,232 dirs silently skipped. Fix: rejoin
parent+child names before parsing.

### 6. QnA images pulled from ghcr.io at trial time
124 QnA tasks → 11 per-repo `ghcr.io/scaleapi/swe-atlas:*` images. Direct
anonymous pulls failed ~35% of trials (`docker compose up --wait`
RuntimeError, 788 trials). Fix: ECR pull-through cache for ghcr
(`<acct>.dkr.ecr.us-east-1.amazonaws.com/ghcr/…`), worker retags to the
original name; cache pre-warmed with all 11 images. Requires a GitHub PAT
(ECR mandates credentials for the ghcr upstream even for public images).

### 7. Our own operations caused retries
- Two fleet-wide `systemctl restart` (to roll out new worker code) killed
  ~100-150 in-flight trials mid-work → `failed` with no credits.
- SQS visibility timeout is 4 h: killed messages reappear 4 h later —
  expected, not lost.
- 26 long QnA trials were killed by *both* restarts → DLQ ("failed twice").
  Moved back to the main queue manually; DLQ must be checked at wrap-up.

### 8. SSM fleet-management traps
- Long scripts must be base64-encoded into the command (quoting hell);
  inside `xargs … sh -c`, parent-shell variables are invisible unless
  exported (`$P` empty → all warm pulls failed silently).
- IMDSv1 is disabled on the workers: `curl …/meta-data/instance-id`
  returns empty → all 25 workers uploaded to the same S3 key `.json`.
  Use `$(hostname)` or an IMDSv2 token.
- SSM commands run as the SSM service role, not the instance profile —
  no `secretsmanager:GetSecretValue`. Pass secrets inline (they're already
  in Secrets Manager / env files) instead of fetching them from workers.
- Some workers went `ConnectionLost` mid-run; they had to be terminated so
  the ASG replaced them. Stale (un-refreshed) workers must never consume
  jobs — they run old code.

### 9. Earlier infra traps (smoke/first-pass era)
- kiro-cli installer needs `--no-confirm`; both `kiro-cli` and
  `kiro-cli-chat` binaries must be staged.
- docker compose/buildx plugins are not in the AL2023 default docker.
- systemd runs `bash worker.sh` because the S3 repo sync drops the
  execute bit.
- Stale job dirs make harbor/pier "resume" and skip errored trials —
  `rm -rf` the job dir before every trial.
- The job-level `result.json` has no `verifier_result` and masks every
  trial as an infra error if not excluded from record parsing.
- CA bundle must be a resolved path, not a symlink, when mounted into
  containers.
- Task images with glibc < 2.34 need the musl kiro-cli build
  (`~/.local/bin-musl` on workers).
- QnA images ship `ENTRYPOINT ["/bin/bash"]` which breaks compose
  keepalive — neutralized by re-tagging with `ENTRYPOINT []` under flock.

### 10. Secrets hygiene
`aws s3 sync . s3://…/repo/` uploaded `kiro-pats.txt` (11 Kiro PATs) to
the shared bucket. Deleted immediately; the file is gitignored and
permanently `--exclude`d from all repo syncs. Sync commands that mirror
the repo must always exclude credential files.

## What made detection work

- `scripts/monitor.py` quality alert: rolling-window ratio of
  rate-limit/no-telemetry deaths — caught the blowout in minutes instead
  of after the run.
- The local dashboard (`app/`): queue depth, per-key credit burn, task
  matrix — made contamination visible at a glance.
- Raw `kiro-cli.txt` per trial (tee'd agent output) is the ground truth
  for every classification decision.
