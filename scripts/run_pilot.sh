#!/usr/bin/env bash
# Phase 2 pilot runner: Terminal-Bench 2.0 + DeepSWE, kiro-cli models
# {auto, claude-opus-5}, 10 sampled tasks x 3 attempts per model.
#
# Task sample: scripts/pilot_tasks.json (seed 42, identical across models).
# Runs are sequential; each harness run uses -n 3 concurrent trials.
# Detach-safe: launch with  setsid scripts/run_pilot.sh &  and watch logs in
# pilot/logs/ (pilot.log = progress, <run>.log = per-run harness output).

set -u
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEEPSWE_TASKS="${DEEPSWE_TASKS:-$REPO/../benchmarks-src/deep-swe/tasks}"
LOG_DIR="${PILOT_LOG_DIR:-$REPO/../pilot/logs}"
TASKS_JSON="$REPO/scripts/pilot_tasks.json"
mkdir -p "$LOG_DIR"

mapfile -t TB_TASKS < <(python3 -c "import json;print('\n'.join(json.load(open('$TASKS_JSON'))['terminal_bench_2']))")
mapfile -t DS_TASKS < <(python3 -c "import json;print('\n'.join(json.load(open('$TASKS_JSON'))['deep_swe']))")

TB_INCLUDES=(); for t in "${TB_TASKS[@]}"; do TB_INCLUDES+=(-i "$t"); done
DS_INCLUDES=(); for t in "${DS_TASKS[@]}"; do DS_INCLUDES+=(-i "$t"); done

run() { # run <log-name> <command...>
  local name="$1"; shift
  echo "[$(date -Is)] START $name: $*" >> "$LOG_DIR/pilot.log"
  sg docker -c "cd '$REPO' && PYTHONPATH='$REPO' $*" > "$LOG_DIR/$name.log" 2>&1
  echo "[$(date -Is)] END $name rc=$?" >> "$LOG_DIR/pilot.log"
}

for model in auto claude-opus-5; do
  run "tb2-$model" harbor run -d terminal-bench@2.0 \
    --agent adapters.kiro_cli.harbor_agent:KiroCliAgent \
    -m "$model" -k 3 -n 3 "${TB_INCLUDES[@]}" \
    --job-name "pilot-tb2-$model"

  run "deepswe-$model" pier run -p "$DEEPSWE_TASKS" \
    --agent-import-path adapters.kiro_cli.pier_agent:PierKiroCliAgent \
    -m "$model" -k 3 -n 3 "${DS_INCLUDES[@]}" \
    --job-name "pilot-deepswe-$model"
done

echo "[$(date -Is)] PILOT COMPLETE" >> "$LOG_DIR/pilot.log"
