#!/usr/bin/env bash
# Benchmark worker loop: poll the SQS jobs queue, run one harness trial per
# message, normalize the outcome into a trial record, and upload it to S3 for
# scripts/aggregate.py. Designed to run on the Terraform-managed workers
# (see infra/templates/user_data.sh.tftpl); configuration comes from
# /etc/kiro-bench.env or the environment:
#
#   JOBS_QUEUE_URL   SQS queue to poll (required)
#   RESULTS_BUCKET   S3 bucket for trial records + raw logs (required)
#   RUN_ID           run identifier, e.g. smoke-20260729 (required)
#   KIRO_API_KEY     Kiro API key used by the adapters (required, or use
#   KIRO_API_KEYS    a space/newline-separated list; each worker loop exports
#                    its own key round-robin so concurrent trials spread
#                    across accounts and dodge per-key rate limits)
#   OPENAI_API_KEY / OPENAI_API_BASE  judge endpoint for swe-atlas-qna's
#                    verifier (required only when running that benchmark)
#   DEEPSWE_TASKS    path to the deep-swe tasks dir (default: /opt/benchmarks-src/deep-swe/tasks)
#   REPO_DIR         this repo checkout (default: /opt/kiro-bench)
#   WORKER_CONCURRENCY  parallel job loops on this instance (default: 1)
#
# Trial record S3 layout (re-synced locally for aggregation):
#   s3://$RESULTS_BUCKET/$RUN_ID/trials/<benchmark>/<task>/<model>/attempt-<n>.json
#   s3://$RESULTS_BUCKET/$RUN_ID/raw/<benchmark>/<task>/<model>/attempt-<n>/  (harness logs)
#
# The object key is deterministic per (benchmark, task, model, attempt), so a
# retried message overwrites the previous record instead of duplicating it.
#
# SQS visibility timeout is 4 h: SWE-Atlas-QnA tasks allow the agent 3 h
# (plus verifier + image pull), the longest of the three benchmarks.

set -uo pipefail

if [ -f /etc/kiro-bench.env ]; then
  set -a; source /etc/kiro-bench.env; set +a
fi
: "${JOBS_QUEUE_URL:?set JOBS_QUEUE_URL}" "${RESULTS_BUCKET:?set RESULTS_BUCKET}"
if [ -z "${KIRO_API_KEYS:-}" ]; then
  : "${KIRO_API_KEY:?set KIRO_API_KEY or KIRO_API_KEYS}"
fi
# RUN_ID comes from each job message; this env value is only a fallback.
RUN_ID="${RUN_ID:-default}"
DEEPSWE_TASKS="${DEEPSWE_TASKS:-/opt/benchmarks-src/deep-swe/tasks}"
REPO_DIR="${REPO_DIR:-/opt/kiro-bench}"
WORKER_CONCURRENCY="${WORKER_CONCURRENCY:-1}"
export KIRO_API_KEY="${KIRO_API_KEY:-}" PYTHONPATH="$REPO_DIR"

# Per-loop key rotation: concurrent trials spread across accounts.
# Shuffle per worker so the fleet doesn't pile onto the first keys: the loop
# index alone would pin every worker to keys[0..CONCURRENCY-1] and leave the
# rest idle (observed in the full run: only 4 of 6 keys were ever used).
mapfile -t _KEYS < <(printf '%s\n' ${KIRO_API_KEYS:-} | sed '/^$/d' | shuf)
if [ "${#_KEYS[@]}" -eq 0 ]; then
  _KEYS=("$KIRO_API_KEY")
fi

log() { echo "[$(date -Is)] $*"; }

# The repo working tree is distributed via S3 (operator uploads it before or
# while workers boot; user_data's sync is best-effort). Wait until it lands.
for attempt in $(seq 1 60); do
  [ -f "$REPO_DIR/adapters/kiro_cli/kiro_common.py" ] && break
  log "repo not present at $REPO_DIR; syncing s3://$RESULTS_BUCKET/repo/ (attempt $attempt)"
  aws s3 sync "s3://$RESULTS_BUCKET/repo/" "$REPO_DIR" 2>/dev/null || true
  sleep 30
done
[ -f "$REPO_DIR/adapters/kiro_cli/kiro_common.py" ] || { log "repo sync failed; exiting"; exit 1; }

run_trial() { # run_trial <run_id> <benchmark> <task> <model> <attempt>
  local run_id="$1" benchmark="$2" task="$3" model="$4" attempt="$5"
  local job_name="$run_id-$benchmark-$task-$model-a$attempt"
  cd "$REPO_DIR"
  # Job names are deterministic, but a stale job dir from a previous try makes
  # the harness "resume" and skip the errored trial instead of re-running it.
  rm -rf "$REPO_DIR/jobs/$job_name"
  case "$benchmark" in
    terminal-bench-2)
      harbor run -d terminal-bench@2.0 -y \
        --agent adapters.kiro_cli.harbor_agent:KiroCliAgent \
        -m "$model" -i "$task" -k 1 -n 1 --job-name "$job_name" ;;
    deep-swe)
      pier run -p "$DEEPSWE_TASKS" \
        --agent-import-path adapters.kiro_cli.pier_agent:PierKiroCliAgent \
        -m "$model" -i "$task" -k 1 -n 1 --job-name "$job_name" ;;
    swe-atlas-qna)
      # Runs on harbor like TB2 (official harness; LLM-judge rubric verifier).
      # Requires OPENAI_API_KEY / OPENAI_API_BASE on the worker for the judge
      # (task.toml passes them to the verifier as EVAL_API_KEY/EVAL_BASE_URL).
      # QnA images ship ENTRYPOINT ["/bin/bash"], which makes compose's
      # keepalive command get sourced by bash (container exits 126) — pull
      # the task image and neutralize the entrypoint first.
      (
        flock 9
        task_dir=$(ls -d ~/.cache/harbor/tasks/packages/"$task"/*/ 2>/dev/null | head -1)
        img=$(awk '/^FROM/{print $2; exit}' "$task_dir/environment/Dockerfile" 2>/dev/null)
        if [ -n "$img" ]; then
          if ! docker image inspect "$img" > /dev/null 2>&1; then
            if [ -n "${GHCR_ECR_PREFIX:-}" ] && [[ "$img" == ghcr.io/* ]]; then
              # Pull through the ECR ghcr pull-through cache (in-region, no
              # ghcr anonymous rate limit) and retag to the original name so
              # compose files hit the local cache. Fall back to a direct pull.
              log "pulling $img via ECR ghcr cache"
              if ! aws ecr get-login-password --region "${AWS_REGION:-us-east-1}" \
                | docker login --username AWS --password-stdin "${GHCR_ECR_PREFIX%%/*}" > /dev/null 2>&1; then
                log "WARNING: ECR docker login failed for ${GHCR_ECR_PREFIX%%/*}"
              fi
              if docker pull "$GHCR_ECR_PREFIX/${img#ghcr.io/}"; then
                docker tag "$GHCR_ECR_PREFIX/${img#ghcr.io/}" "$img"
                docker rmi "$GHCR_ECR_PREFIX/${img#ghcr.io/}" > /dev/null 2>&1 || true
              else
                log "ECR ghcr cache pull failed for $img; direct pull fallback"
                docker pull "$img"
              fi
            else
              docker pull "$img"
            fi
          fi
          if docker image inspect "$img" > /dev/null 2>&1; then
            ep=$(docker inspect "$img" --format '{{json .Config.Entrypoint}}')
            if [ "$ep" != "[]" ] && [ "$ep" != "null" ]; then
              log "neutralizing entrypoint of $img"
              printf 'FROM %s\nENTRYPOINT []\n' "$img" > /tmp/Dockerfile.patch
              docker build -q -t "$img-patched" -f /tmp/Dockerfile.patch /tmp > /dev/null
              docker rmi "$img" > /dev/null 2>&1 || true
              docker tag "$img-patched" "$img"
            fi
          else
            log "WARNING: $img not available locally; compose will pull it at trial time"
          fi
        fi
      ) 9>/tmp/swe-atlas-patch.lock
      harbor run -d scale-ai/swe-atlas-qna -y \
        --agent adapters.kiro_cli.harbor_agent:KiroCliAgent \
        -m "$model" -i "$task" -k 1 -n 1 --job-name "$job_name" ;;
    *) log "unknown benchmark $benchmark"; return 91 ;;
  esac
}

# Extract a normalized trial record from the harness output.
# REQUIRES-VALIDATION on the run host: the exact result.json location/schema
# for harbor and pier jobs (expected: verifier outcome + agent context with
# cost_usd/metadata.kiro_credits/metadata.kiro_time_seconds, as written by
# the adapters' populate_context_post_run).
make_record() { # make_record <run_id> <benchmark> <task> <model> <attempt> <harness_rc> <out-file>
  local run_id="$1" benchmark="$2" task="$3" model="$4" attempt="$5" rc="$6" out="$7"
  local job_name="$run_id-$benchmark-$task-$model-a$attempt"
  python3 - "$REPO_DIR/jobs/$job_name" "$run_id" "$benchmark" "$task" "$model" "$attempt" "$rc" "$out" <<'PY'
import json, sys
from pathlib import Path

job_dir, run_id, benchmark, task, model, attempt, rc, out = (
    Path(sys.argv[1]), *sys.argv[2:7], int(sys.argv[7]), sys.argv[8])
record = {"run_id": run_id, "benchmark": benchmark, "task": task, "model": model,
          "attempt": int(attempt), "status": "error", "credits": None,
          "cost_usd": None, "time_seconds": None, "error_kind": None}
# Newest trial-level result.json under the job dir. The job-level summary at
# <job_dir>/result.json is written last and must be excluded: it has no
# verifier_result and would mask every trial as an infra error.
results = sorted((p for p in job_dir.rglob("result.json") if p.parent != job_dir),
                 key=lambda p: p.stat().st_mtime) if job_dir.is_dir() else []
if results:
    try:
        r = json.loads(results[-1].read_text())
        # harbor trial result.json (validated 2026-07-29 against a real run):
        #   verifier_result.rewards.reward: 1.0/0.0
        #   agent_result.cost_usd, agent_result.metadata.kiro_credits /
        #   kiro_time_seconds. Pier's schema is REQUIRES-VALIDATION.
        rewards = (r.get("verifier_result") or {}).get("rewards") or {}
        reward = rewards.get("reward")
        passed = None if reward is None else float(reward) >= 0.5
        agent = r.get("agent_result") or {}
        meta = agent.get("metadata") or {}
        exception_type = ((r.get("exception_info") or {}).get("exception_type")
                          or "")
        record.update({
            "status": ("passed" if passed is True
                       else "failed" if passed is False else "error"),
            "credits": meta.get("kiro_credits"),
            "cost_usd": agent.get("cost_usd"),
            "time_seconds": meta.get("kiro_time_seconds"),
        })
        if passed is None:
            record["error_kind"] = "infra"
        elif exception_type == "AgentTimeoutError":
            # Harbor still writes verifier reward 0 for an agent timeout. It
            # is an execution error, not evidence that the submitted answer
            # genuinely failed the benchmark.
            record["status"] = "error"
            record["error_kind"] = "timeout"
    except (OSError, json.JSONDecodeError):
        record["error_kind"] = "infra"
elif rc != 0:
    record["error_kind"] = "infra"
# Rate-limit deaths must be retried, not scored: when throttled, kiro-cli
# prints a quota warning and exits abnormally, which the harness records as
# reward 0 (pier NonZeroAgentExitCodeError) or a generic exception. Detect
# the signature in the agent log and reclassify as a retryable error.
if record["status"] in ("failed", "error") and job_dir.is_dir():
    blob = ""
    for t in job_dir.rglob("kiro-cli.txt"):
        try:
            blob += t.read_text(errors="replace")
        except OSError:
            pass
    low = blob.lower()
    if ("quota exceeded" in low or "rate limit reached" in low
            or "throttlingexception" in low):
        record["status"] = "error"
        record["error_kind"] = "rate_limit"
    elif ("failed to generate a response" in low
          or "having trouble responding" in low):
        # Transient kiro backend/streaming failure: the CLI dies before doing
        # any work (no credits), the verifier then scores the empty answer 0.
        # Retryable — must not count as a genuine failure.
        record["status"] = "error"
        record["error_kind"] = "transient_api"
    elif "database is locked" in low:
        # kiro-cli startup failure under concurrency (local sqlite lock).
        record["status"] = "error"
        record["error_kind"] = "db_locked"
if (record["status"] == "failed" and record["credits"] is None):
    # Invariant (supersedes signature whack-a-mole): a failed trial with no
    # credits usually means the agent never finished. BUT some completed runs
    # lose the trailing Credits line (~10% on harbor) — when the log shows
    # substantial agent activity, trust the verifier's 0 as a genuine fail.
    blob2 = ""
    if job_dir.is_dir():
        for t in job_dir.rglob("kiro-cli.txt"):
            try:
                blob2 += t.read_text(errors="replace")
            except OSError:
                pass
    tools = blob2.count("(using tool") + blob2.count("Completed in")
    if not (tools >= 5 or len(blob2) >= 10000):
        record["status"] = "error"
        record["error_kind"] = record["error_kind"] or "no_telemetry"
Path(out).write_text(json.dumps(record, indent=2) + "\n")
PY
}

process_message() { # process_message <message-body> <receipt-handle>
  local body="$1" handle="$2"
  local run_id benchmark task model attempt
  read -r run_id benchmark task model attempt < <(
    python3 -c 'import json,sys; j=json.loads(sys.argv[1]); print(j.get("run_id") or "", j["benchmark"], j["task"], j["model"], j["attempt"])' "$body"
  ) || { log "bad message body: $body"; return 1; }
  run_id="${run_id:-$RUN_ID}"

  local key="$benchmark/$task/$model/attempt-$attempt"
  local tmp; tmp="$(mktemp -d)"
  log "START $run_id/$key"
  run_trial "$run_id" "$benchmark" "$task" "$model" "$attempt" > "$tmp/harness.log" 2>&1
  local rc=$?
  make_record "$run_id" "$benchmark" "$task" "$model" "$attempt" "$rc" "$tmp/record.json"
  aws s3 cp "$tmp/record.json" "s3://$RESULTS_BUCKET/$run_id/trials/$key.json"
  aws s3 cp "$tmp" "s3://$RESULTS_BUCKET/$run_id/raw/$key/" --recursive --quiet
  log "END $run_id/$key rc=$rc status=$(python3 -c 'import json;print(json.load(open("'"$tmp"'/record.json"))["status"])')"
  rm -rf "$tmp"
  aws sqs delete-message --queue-url "$JOBS_QUEUE_URL" --receipt-handle "$handle"
}

worker_loop() { # worker_loop <worker-index>
  local wid="$1"
  local trial_num=0
  log "worker $wid polling $JOBS_QUEUE_URL (${#_KEYS[@]} keys, rotating per trial)"
  while true; do
    local messages
    messages=$(aws sqs receive-message --queue-url "$JOBS_QUEUE_URL" \
      --max-number-of-messages 1 --wait-time-seconds 20 \
      --visibility-timeout 14400 --output json)
    local body handle
    body=$(python3 -c 'import json,sys; m=json.loads(sys.argv[1]).get("Messages",[]); print(m[0]["Body"] if m else "")' "$messages")
    handle=$(python3 -c 'import json,sys; m=json.loads(sys.argv[1]).get("Messages",[]); print(m[0]["ReceiptHandle"] if m else "")' "$messages")
    if [ -z "$body" ]; then
      continue
    fi
    # Rotate the Kiro key per trial (not per loop): each worker cycles through
    # all keys over time, and the shuffled key order staggers workers so the
    # fleet spreads across keys (~slots/keys concurrent per key).
    local key_idx=$(( (trial_num + wid - 1) % ${#_KEYS[@]} ))
    export KIRO_API_KEY="${_KEYS[$key_idx]}"
    trial_num=$((trial_num + 1))
    log "worker $wid trial #$trial_num using key $((key_idx + 1))/${#_KEYS[@]}"
    process_message "$body" "$handle" || log "message processing failed (left for retry/DLQ)"
  done
}

for i in $(seq 1 "$WORKER_CONCURRENCY"); do
  worker_loop "$i" &
done
wait
