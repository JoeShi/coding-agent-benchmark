#!/usr/bin/env python3
"""Merge per-worker reparse reports into authoritative trial records.

Each worker uploads a report (scripts/reparse_records.py --report-file) to
s3://<bucket>/<run_id>/reparse-reports/<instance-id>.json containing every
record derivable from its LOCAL job dirs, each tagged with the mtime of the
newest trial result.json. Because a retried trial lands on an arbitrary
worker, stale job dirs linger on others; the newest result_mtime identifies
the trial's latest run. This script keeps, per trial key, the record with
the max result_mtime and uploads it as the authoritative trial record.

    .venv/bin/python scripts/merge_reparse_reports.py \
        --bucket kiro-bench-results-178770047227 --run-id full-20260729
"""

import argparse
import json
from concurrent.futures import ThreadPoolExecutor

import boto3


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--bucket", required=True)
    p.add_argument("--run-id", required=True)
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()

    s3 = boto3.client("s3")
    prefix = f"{args.run_id}/reparse-reports/"
    reports = []
    token = None
    while True:
        kw = {"Bucket": args.bucket, "Prefix": prefix}
        if token:
            kw["ContinuationToken"] = token
        page = s3.list_objects_v2(**kw)
        for obj in page.get("Contents", []):
            reports.append(obj["Key"])
        if not page.get("IsTruncated"):
            break
        token = page.get("NextContinuationToken")
    print(f"{len(reports)} worker reports")

    best = {}  # s3 trial key -> record (max result_mtime)
    for key in reports:
        entries = json.loads(s3.get_object(Bucket=args.bucket, Key=key)["Body"].read())
        for e in entries:
            mtime = e.pop("result_mtime")
            tkey = (f"{e['run_id']}/trials/{e['benchmark']}/{e['task']}/"
                    f"{e['model']}/attempt-{e['attempt']}.json")
            if tkey not in best or mtime > best[tkey][0]:
                best[tkey] = (mtime, e)
    print(f"{len(best)} distinct trials")

    from collections import Counter
    c = Counter(e["status"] for _, e in best.values())
    ek = Counter(e.get("error_kind") for _, e in best.values() if e["status"] == "error")
    print("merged status:", dict(c))
    print("merged error kinds:", dict(ek))

    if args.dry_run:
        return

    def put(item):
        tkey, (_, e) = item
        s3.put_object(Bucket=args.bucket, Key=tkey,
                      Body=json.dumps(e, indent=1).encode(),
                      ContentType="application/json")
    with ThreadPoolExecutor(max_workers=16) as pool:
        list(pool.map(put, best.items()))
    print(f"uploaded {len(best)} authoritative records")


if __name__ == "__main__":
    main()
