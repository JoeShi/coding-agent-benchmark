#!/usr/bin/env python3
"""Re-derive trial records from harness trial-level result.json files.

Runs on a worker (anywhere with a jobs/ dir). Use after a make_record parsing
bug is fixed: rebuilds the normalized record for every completed trial under
jobs/ and optionally uploads them to S3, overwriting the bad records — no
need to re-run the trials themselves.

    python3 scripts/reparse_records.py --jobs-dir /opt/kiro-bench/jobs
    python3 scripts/reparse_records.py --jobs-dir /opt/kiro-bench/jobs \
        --bucket kiro-bench-results-123 --upload

Job dir names are <run_id>-<benchmark>-<task>-<model>-a<attempt>; the
benchmark tag (-terminal-bench-2- / -deep-swe- / -swe-atlas-qna-) is the
delimiter since task and model names may contain hyphens.
"""

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Optional

BENCH_TAG = re.compile(r"-(terminal-bench-2|deep-swe|swe-atlas-qna)-")

# Model ids contain hyphens, so the task/model boundary is found by suffix-
# matching the known kiro-cli model ids (longest first).
KNOWN_MODELS = ["claude-sonnet-4.6", "claude-opus-4.8", "claude-sonnet-5",
                "claude-opus-5", "gpt-5.6-sol", "auto"]


def parse_job_name(name: str) -> Optional[dict]:
    m = BENCH_TAG.search(name)
    if not m or not re.search(r"-a\d+$", name):
        return None
    run_id = name[:m.start()]
    benchmark = m.group(1)
    rest = name[m.end():]
    task_model, _, attempt = rest.rpartition("-a")
    task = model = None
    for candidate in KNOWN_MODELS:
        suffix = f"-{candidate}"
        if task_model.endswith(suffix):
            task, model = task_model[:-len(suffix)], candidate
            break
    if not run_id or not task or not model or not attempt.isdigit():
        return None
    return {"run_id": run_id, "benchmark": benchmark, "task": task,
            "model": model, "attempt": int(attempt)}


def derive(trial_result: Path, job_dir: Path) -> Optional[dict]:
    """Same parsing as worker.sh make_record; keep in sync."""
    try:
        r = json.loads(trial_result.read_text())
    except (OSError, json.JSONDecodeError):
        return None
    rewards = (r.get("verifier_result") or {}).get("rewards") or {}
    reward = rewards.get("reward")
    passed = None if reward is None else float(reward) >= 0.5
    agent = r.get("agent_result") or {}
    meta = agent.get("metadata") or {}
    exception_type = ((r.get("exception_info") or {}).get("exception_type")
                      or "")
    record = {
        "status": ("passed" if passed is True
                   else "failed" if passed is False else "error"),
        "credits": meta.get("kiro_credits"),
        "cost_usd": agent.get("cost_usd"),
        "time_seconds": meta.get("kiro_time_seconds"),
        "error_kind": "infra" if passed is None else None,
    }
    if exception_type == "AgentTimeoutError":
        # Harbor assigns reward 0 when the agent hits its wall-clock timeout;
        # preserve that as an execution error rather than a benchmark failure.
        record["status"] = "error"
        record["error_kind"] = "timeout"
    # Same rate-limit reclassification as worker.sh make_record: a throttled
    # kiro-cli dies abnormally and the harness scores it 0; it must be
    # retried, not counted as a genuine failure.
    if record["status"] in ("failed", "error"):
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
            # Transient kiro backend/streaming failure; same retryable
            # treatment as rate limits (see worker.sh make_record).
            record["status"] = "error"
            record["error_kind"] = "transient_api"
        elif "database is locked" in low:
            record["status"] = "error"
            record["error_kind"] = "db_locked"
    # Same invariant as worker.sh make_record: a failed trial with no credits
    # usually means the agent never finished — but exempt logs showing
    # substantial agent activity (completed runs that lost the Credits line);
    # their verifier 0 is a genuine fail.
    if record["status"] == "failed" and record["credits"] is None:
        tools = blob.count("(using tool") + blob.count("Completed in")
        if not (tools >= 5 or len(blob) >= 10000):
            record["status"] = "error"
            record["error_kind"] = record["error_kind"] or "no_telemetry"
    return record


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--jobs-dir", type=Path, required=True)
    p.add_argument("--bucket", help="results bucket; required with --upload")
    p.add_argument("--upload", action="store_true",
                   help="upload records to s3://<bucket>/<run_id>/trials/...")
    p.add_argument("--skip-errors", action="store_true",
                   help="do not upload error-status records. Use when re-running "
                        "reparse across several workers: stale failed job dirs on "
                        "other workers must not overwrite good records.")
    p.add_argument("--report-file", type=Path,
                   help="do NOT upload records; write a JSON report of all "
                        "locally-derived records (with result_mtime) to this "
                        "file. Use for multi-worker runs: an external aggregator "
                        "merges reports and keeps the newest record per trial — "
                        "direct --upload from every worker lets stale job dirs "
                        "clobber newer records (last writer wins on the same "
                        "S3 key).")
    args = p.parse_args()
    if args.upload and not args.bucket:
        p.error("--upload requires --bucket")

    n_ok = n_skip = 0
    report = []
    # QnA task names contain a slash ("scale-ai/task-..."), so their job dirs
    # are nested: jobs/<run>-swe-atlas-qna-scale-ai/<task>-<model>-a<n>/.
    # Rejoin parent + child names before parsing.
    candidates = []
    for entry in sorted(args.jobs_dir.iterdir()):
        if not entry.is_dir():
            continue
        if parse_job_name(entry.name):
            candidates.append(entry)
            continue
        for sub in sorted(entry.iterdir()):
            if sub.is_dir() and parse_job_name(f"{entry.name}/{sub.name}"):
                candidates.append(sub)
    for job_dir in candidates:
        name = (job_dir.name if parse_job_name(job_dir.name)
                else f"{job_dir.parent.name}/{job_dir.name}")
        meta = parse_job_name(name)
        if meta is None:
            continue
        trials = sorted((p for p in job_dir.rglob("result.json") if p.parent != job_dir),
                        key=lambda p: p.stat().st_mtime)
        if not trials:
            n_skip += 1  # trial still running or never wrote a result
            continue
        outcome = derive(trials[-1], job_dir)
        if outcome is None:
            n_skip += 1
            continue
        record = {**meta, **outcome}
        key = (f"{meta['run_id']}/trials/{meta['benchmark']}/{meta['task']}/"
               f"{meta['model']}/attempt-{meta['attempt']}.json")
        n_ok += 1
        print(f"{record['status']:7s} {key} credits={record['credits']}")
        if args.report_file:
            report.append({**record, "result_mtime": trials[-1].stat().st_mtime})
        elif args.upload and not (args.skip_errors and record["status"] == "error"):
            payload = json.dumps(record, indent=2) + "\n"
            subprocess.run(["aws", "s3", "cp", "-", f"s3://{args.bucket}/{key}"],
                           input=payload, text=True, check=True)
    if args.report_file:
        args.report_file.write_text(json.dumps(report))
        print(f"report written to {args.report_file}")
    print(f"\n{ n_ok } records derived, {n_skip} job dirs skipped (running/incomplete)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
