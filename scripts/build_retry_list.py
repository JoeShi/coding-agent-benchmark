#!/usr/bin/env python3
"""Build an enqueue-compatible retry list from error trial records."""

import argparse
import json
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("trials_dir", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()

    jobs = []
    for path in args.trials_dir.rglob("*.json"):
        record = json.loads(path.read_text())
        if record.get("status") != "error":
            continue
        jobs.append({key: record[key] for key in
                     ("run_id", "benchmark", "task", "model", "attempt")})
    jobs.sort(key=lambda job: (job["benchmark"], job["task"], job["model"],
                               job["attempt"]))
    args.out.write_text(json.dumps(jobs, indent=2) + "\n")
    print(f"wrote {len(jobs)} retry jobs to {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
