#!/usr/bin/env python3
"""Freeze the Task Monitor's live state into a static JSON artifact.

`app/server.py` exists to hold one shared, TTL-refreshed snapshot of the fleet
so that browser polling never amplifies AWS calls. Once a run is finished
there is nothing left to poll -- the queue is drained, the fleet is torn down
and the trial records are settled -- so keeping a daemon alive to re-read
constants is pointless. This script runs the same collectors once and writes
their output in exactly the shapes the five `/api/*` endpoints return:

    python3 scripts/build_monitor_snapshot.py            # defaults to full-20260729
    python3 scripts/build_monitor_snapshot.py --run-id <id> --out <path>

`/monitor` reads the result (`app/site/public/data/monitor.json`) by default and
only talks to `app/server.py` when you switch it to Live -- start the daemon
again for the next run in flight.

Each section is collected independently: a failing SQS/EC2/Secrets Manager call
records its message in that section's `error` field (same as the API does) and
the rest of the snapshot is still written.

Unlike the API, which only ever answers on localhost, this file is committed to
a public repo -- so the key table's account identity is stripped on the way out
(see `anonymize_keys`).
"""

import argparse
import datetime
import importlib.util
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUT = REPO_ROOT / "app" / "site" / "public" / "data" / "monitor.json"


def load_collectors():
    """Import app/collectors.py by path (it is not an installed package)."""
    spec = importlib.util.spec_from_file_location(
        "collectors", REPO_ROOT / "app" / "collectors.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def anonymize_keys(keys):
    """Replace each row's masked key and account email with a row label.

    The credit figures are the point of the table; the identity columns are not,
    and this artifact is public. Row order still matches the live view.
    """
    for i, row in enumerate(keys.get("keys") or [], 1):
        row["key"] = f"account-{i:02d}"
        row["email"] = "-"
    return keys


def attempt(fn):
    """(data, error) -- never raises, so one dead API can't lose the rest."""
    try:
        return fn(), None
    except Exception as exc:
        print(f"warn: {exc}", file=sys.stderr)
        return None, str(exc)


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--run-id", default="full-20260729")
    p.add_argument("--bucket", default="kiro-bench-results-178770047227")
    p.add_argument("--queue-url",
                   default="https://sqs.us-east-1.amazonaws.com/178770047227/kiro-bench-jobs")
    p.add_argument("--dlq-url",
                   default="https://sqs.us-east-1.amazonaws.com/178770047227/kiro-bench-jobs-dlq")
    p.add_argument("--tasks-file", default=str(REPO_ROOT / "scripts" / "full_tasks.json"))
    p.add_argument("--keys-secret-id", default="kiro-bench/kiro-api-keys")
    p.add_argument("--pat-file", default=str(REPO_ROOT / "kiro-pats.txt"))
    p.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = p.parse_args()

    c = load_collectors()
    expected = c.load_expected(args.tasks_file)
    cache_dir = REPO_ROOT / "app" / ".cache" / args.run_id

    print(f"collecting {args.run_id} ...", file=sys.stderr)
    queue, queue_err = attempt(
        lambda: c.collect_queue(args.queue_url, args.dlq_url))
    workers, workers_err = attempt(c.collect_workers)
    records, records_err = attempt(lambda: c.summarize_records(
        c.collect_records(args.bucket, args.run_id, cache_dir), expected))
    keys, keys_err = attempt(lambda: c.collect_key_usage(
        args.keys_secret_id, args.pat_file))

    records = records or {}
    keys = anonymize_keys(keys) if keys else keys
    snapshot = {
        "generated_at": datetime.datetime.now(datetime.timezone.utc)
                                .isoformat(timespec="seconds"),
        "run_id": args.run_id,
        # /api/overview, minus the live-only `ts`/`stale`/`updated_at` fields.
        "overview": {
            "run_id": args.run_id,
            "queue": queue or {},
            "workers": {k: (workers or {}).get(k)
                        for k in ("running", "total", "ssm_online")},
            "records": {**records.get("records", {}),
                        "expected": records.get("expected")},
        },
        "workers": {"workers": (workers or {}).get("instances", []),
                    "error": workers_err},
        "keys": {**(keys or {"keys": []}), "error": keys_err},
        "benchmarks": {"benchmarks": records.get("benchmarks", {}),
                       "models": c.MODELS, "error": records_err},
        # One /api/tasks response per benchmark, keyed by benchmark id.
        "tasks": {bm: {"benchmark": bm, "tasks": rows, "error": records_err}
                  for bm, rows in (records.get("tasks") or {}).items()},
        "errors": {"queue": queue_err, "workers": workers_err,
                   "records": records_err, "keys": keys_err},
    }

    args.out.parent.mkdir(parents=True, exist_ok=True)
    # Minified: the task matrix is 321 tasks x 18 cells and the browser fetches
    # this file, so bytes matter more than readability here.
    args.out.write_text(json.dumps(snapshot, separators=(",", ":")) + "\n")
    rec = snapshot["overview"]["records"]
    print(f"wrote {args.out} ({args.out.stat().st_size / 1024:.0f} KB) — "
          f"{rec.get('total')} records: passed {rec.get('passed')} / "
          f"failed {rec.get('failed')} / error {rec.get('error')}; "
          f"{len(snapshot['keys'].get('keys') or [])} keys, "
          f"{len(snapshot['workers']['workers'])} workers", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
