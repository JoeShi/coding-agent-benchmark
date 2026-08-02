#!/usr/bin/env python3
"""Monitor a benchmark run: report trial outcomes and detect stalls AND
quality regressions.

Polls the SQS jobs queue (+ DLQ) and the run's trial records in S3, printing
timestamped events:

- TRIAL   a new or updated trial record appeared (passed/failed/error, with
          credits and wall time when present)
- PROGRESS  periodic heartbeat: totals, queue depth, and quality stats —
          passed/failed(no-credits)/error counts
- ALERT   jobs visible but none in flight for --stall-consume minutes
          (workers are down or crash-looping — nothing is being consumed)
- ALERT   jobs in flight but no record change for --stall-trial minutes
          (a trial is stuck — image pull, hung agent, dead worker)
- ALERT   one or more jobs landed in the DLQ (failed twice)
- ALERT   quality: more than --nc-fail-pct percent of the last --window
          records are failed trials with no credits parsed (the signature of
          rate-limit aborts / agent crashes — check agent logs NOW, not later)
- DONE    queue drained, nothing in flight, records settled — run finished

Usage:
    python3 scripts/monitor.py \
        --queue-url https://sqs.us-east-1.amazonaws.com/123/kiro-bench-jobs \
        --dlq-url  https://sqs.us-east-1.amazonaws.com/123/kiro-bench-jobs-dlq \
        --bucket kiro-bench-results-123 --run-id smoke-20260729

Uses the aws CLI (no boto3 needed); AWS creds must allow sqs/s3 reads.
"""

import argparse
import json
import subprocess
import sys
import tempfile
import time
from collections import deque
from datetime import datetime, timezone
from pathlib import Path


def log(kind: str, msg: str) -> None:
    ts = datetime.now(timezone.utc).strftime("%H:%M:%S")
    print(f"[{ts}Z] {kind}: {msg}", flush=True)


def aws_json(*args: str) -> dict:
    out = subprocess.run(["aws", *args, "--output", "json"],
                         capture_output=True, text=True, timeout=60)
    if out.returncode != 0:
        raise RuntimeError(out.stderr.strip() or f"aws {' '.join(args)} failed")
    return json.loads(out.stdout or "{}")


def queue_counts(url: str) -> tuple[int, int]:
    attrs = aws_json(
        "sqs", "get-queue-attributes", "--queue-url", url,
        "--attribute-names", "ApproximateNumberOfMessages",
        "ApproximateNumberOfMessagesNotVisible",
    )["Attributes"]
    return (int(attrs["ApproximateNumberOfMessages"]),
            int(attrs["ApproximateNumberOfMessagesNotVisible"]))


def trial_records(bucket: str, run_id: str, cache_dir: Path) -> dict[str, float]:
    """{s3_key: mtime} via a local sync mirror (bulk download, much faster
    than per-record `aws s3 cp` when thousands of records exist)."""
    out = subprocess.run(
        ["aws", "s3", "sync", f"s3://{bucket}/{run_id}/trials/", str(cache_dir),
         "--quiet"],
        capture_output=True, text=True, timeout=600)
    if out.returncode != 0:
        raise RuntimeError(out.stderr.strip() or "aws s3 sync failed")
    records = {}
    for path in cache_dir.rglob("*.json"):
        key = f"{run_id}/trials/{path.relative_to(cache_dir)}"
        records[key] = path.stat().st_mtime
    return records


def record_json(cache_dir: Path, run_id: str, key: str) -> dict:
    rel = Path(key).relative_to(f"{run_id}/trials")
    try:
        return json.loads((cache_dir / rel).read_text())
    except (OSError, json.JSONDecodeError):
        return {"status": "?"}


def describe(r: dict) -> str:
    bits = [r.get("status", "?"), r.get("benchmark", "?"), r.get("task", "?"),
            r.get("model", "?"), f"attempt-{r.get('attempt', '?')}"]
    if r.get("credits") is not None:
        bits.append(f"credits={r['credits']}")
    if r.get("time_seconds") is not None:
        bits.append(f"time={r['time_seconds']}s")
    if r.get("error_kind"):
        bits.append(f"error_kind={r['error_kind']}")
    return " ".join(str(b) for b in bits)


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--queue-url", required=True)
    p.add_argument("--dlq-url", required=True)
    p.add_argument("--bucket", required=True)
    p.add_argument("--run-id", required=True)
    p.add_argument("--interval", type=int, default=60, help="poll seconds (default 60)")
    p.add_argument("--heartbeat", type=int, default=5,
                   help="print a PROGRESS line every N minutes (default 5; 0 disables)")
    p.add_argument("--stall-consume", type=int, default=10,
                   help="minutes with visible jobs but none in flight before ALERT")
    p.add_argument("--stall-trial", type=int, default=45,
                   help="minutes without any record change while jobs in flight before ALERT")
    p.add_argument("--window", type=int, default=50,
                   help="size of the rolling window for quality metrics (default 50)")
    p.add_argument("--nc-fail-pct", type=float, default=10.0,
                   help="ALERT when no-credits failed trials exceed this %% of the window")
    args = p.parse_args()

    mtimes: dict[str, str] = {}          # key -> last_modified
    outcomes: dict[str, tuple[str, bool, str | None]] = {}  # key -> (status, credits_missing, error_kind)
    window: deque[tuple[str, bool, str | None]] = deque(maxlen=args.window)  # rolling quality
    last_change = time.time()
    last_heartbeat = time.time()
    not_consuming_since: float | None = None
    dlq_alerted = quality_alerted = False

    log("INFO", f"monitoring run {args.run_id} (bucket={args.bucket})")
    cache_dir = Path(tempfile.mkdtemp(prefix=f"monitor-{args.run_id}-"))
    first_poll = True
    while True:
        try:
            visible, in_flight = queue_counts(args.queue_url)
            dlq_visible, _ = queue_counts(args.dlq_url)
            records = trial_records(args.bucket, args.run_id, cache_dir)
        except (RuntimeError, subprocess.TimeoutExpired) as exc:
            log("WARN", f"poll failed: {exc}")
            time.sleep(args.interval)
            continue

        # New or updated trial records.
        for key, mtime in sorted(records.items()):
            if mtimes.get(key) != mtime:
                r = record_json(cache_dir, args.run_id, key)
                if not first_poll:
                    log("TRIAL", describe(r))
                status = r.get("status", "?")
                nc = r.get("credits") is None
                ek = r.get("error_kind")
                outcomes[key] = (status, nc, ek)
                window.append((status, nc, ek))
        if first_poll and records:
            n_err = sum(1 for s, _, _ in outcomes.values() if s == "error")
            n_rl = sum(1 for _, _, e in outcomes.values() if e == "rate_limit")
            n_fail_nc = sum(1 for s, nc, _ in outcomes.values() if s == "failed" and nc)
            log("INFO", f"seeded {len(records)} existing records "
                        f"(error={n_err} of which rate_limit={n_rl}, "
                        f"failed-no-credits={n_fail_nc})")
        first_poll = False
        if records != mtimes:
            last_change = time.time()
            dlq_alerted = False
        mtimes = records

        # Jobs piling up with nothing in flight -> workers not consuming.
        if visible > 0 and in_flight == 0:
            if not_consuming_since is None:
                not_consuming_since = time.time()
            elif time.time() - not_consuming_since > args.stall_consume * 60:
                log("ALERT", f"{visible} job(s) visible but none in flight for "
                             f">{args.stall_consume}min — workers not consuming")
                not_consuming_since = time.time()
        else:
            not_consuming_since = None

        # Jobs in flight but no trial record for a long time -> stuck trial.
        if in_flight > 0 and time.time() - last_change > args.stall_trial * 60:
            log("ALERT", f"{in_flight} job(s) in flight but no trial record for "
                         f">{args.stall_trial}min — trial(s) likely stuck")
            last_change = time.time()

        # DLQ.
        if dlq_visible > 0 and not dlq_alerted:
            log("ALERT", f"{dlq_visible} job(s) in DLQ (failed twice) — needs a look")
            dlq_alerted = True

        # Quality: rate-limit-abort / agent-crash signature over the rolling
        # window. Rate-limit deaths are now classified error/rate_limit (not
        # failed), so watch both shapes; catch a blowout early.
        if len(window) == args.window:
            bad = sum(1 for s, nc, ek in window
                      if (s == "failed" and nc) or (s == "error" and ek == "rate_limit"))
            pct = bad / len(window) * 100
            if pct > args.nc_fail_pct and not quality_alerted:
                log("ALERT", f"quality: {bad}/{len(window)} ({pct:.0f}%) of the last "
                             f"{args.window} trials are rate-limit deaths or failed "
                             f"with no credits — check agent logs for rate limits "
                             f"or agent crashes NOW")
                quality_alerted = True
            elif pct <= args.nc_fail_pct / 2:
                quality_alerted = False

        # Periodic heartbeat.
        if args.heartbeat and time.time() - last_heartbeat > args.heartbeat * 60:
            n_pass = sum(1 for s, _, _ in outcomes.values() if s == "passed")
            n_fail = sum(1 for s, _, _ in outcomes.values() if s == "failed")
            n_fail_nc = sum(1 for s, nc, _ in outcomes.values() if s == "failed" and nc)
            n_err = sum(1 for s, _, _ in outcomes.values() if s == "error")
            n_rl = sum(1 for _, _, e in outcomes.values() if e == "rate_limit")
            log("PROGRESS", f"records={len(mtimes)} queue={visible} in_flight={in_flight} "
                            f"dlq={dlq_visible} | passed={n_pass} failed={n_fail}"
                            f"(no-credits={n_fail_nc}) error={n_err}(rate_limit={n_rl})")
            last_heartbeat = time.time()

        # Done: nothing left to run and records settled for two intervals.
        if visible == 0 and in_flight == 0 and mtimes:
            if time.time() - last_change > 2 * args.interval:
                log("DONE", f"queue drained, {len(mtimes)} trial records total")
                return 0

        time.sleep(args.interval)


if __name__ == "__main__":
    sys.exit(main())
