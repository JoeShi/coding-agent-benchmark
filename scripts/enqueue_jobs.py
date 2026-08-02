#!/usr/bin/env python3
"""Enqueue benchmark jobs (benchmark x task x model x attempt) into SQS.

Workers (see infra/templates/user_data.sh.tftpl and scripts/worker.sh) poll
the queue, run one harness trial per message, and upload a normalized trial
record to S3 for scripts/aggregate.py.

Job message body (JSON):

    {"run_id": "smoke-20260729", "benchmark": "terminal-bench-2",
     "task": "build-cython-ext", "model": "claude-opus-5", "attempt": 1}

Usage:
    python3 scripts/enqueue_jobs.py \
        --queue-url https://sqs.us-east-1.amazonaws.com/123/kiro-bench-jobs \
        --run-id smoke-20260729 \
        --tasks scripts/smoke_tasks.json \
        --models auto,claude-opus-5,claude-sonnet-5,gpt-5.6-sol \
        --attempts 3

Requires boto3 and AWS credentials with sqs:SendMessage on the queue.
Use --dry-run to print the messages without sending.
"""

import argparse
import itertools
import json
import sys
from pathlib import Path

# smoke_tasks.json key -> benchmark id used in job messages/trial records.
TASK_KEYS = {
    "terminal_bench_2": "terminal-bench-2",
    "deep_swe": "deep-swe",
    "swe_atlas_qna": "swe-atlas-qna",
}

DEFAULT_MODELS = ["auto", "claude-opus-5", "claude-sonnet-5", "gpt-5.6-sol"]


def build_jobs(tasks_file: Path, run_id: str, models: list[str], attempts: int) -> list[dict]:
    spec = json.loads(tasks_file.read_text())
    jobs = []
    for key, benchmark in TASK_KEYS.items():
        tasks = spec.get(key) or []
        for task, model, attempt in itertools.product(tasks, models, range(1, attempts + 1)):
            jobs.append({
                "run_id": run_id,
                "benchmark": benchmark,
                "task": task,
                "model": model,
                "attempt": attempt,
            })
    return jobs


def send_jobs(queue_url: str, jobs: list[dict]) -> None:
    try:
        import boto3
    except ImportError:
        sys.exit("error: boto3 is required (pip install boto3); or use --dry-run")
    sqs = boto3.client("sqs")
    # SendMessageBatch accepts up to 10 entries per call.
    for offset in range(0, len(jobs), 10):
        batch = jobs[offset:offset + 10]
        response = sqs.send_message_batch(
            QueueUrl=queue_url,
            Entries=[
                {"Id": str(i), "MessageBody": json.dumps(job)}
                for i, job in enumerate(batch)
            ],
        )
        failed = response.get("Failed", [])
        if failed:
            print(f"warn: {len(failed)} messages failed in batch at offset {offset}: "
                  f"{failed}", file=sys.stderr)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--queue-url", help="SQS jobs queue URL (or JOBS_QUEUE_URL env)")
    parser.add_argument("--run-id", required=True, help="Run identifier, e.g. smoke-20260729")
    parser.add_argument("--tasks", type=Path, default=Path("scripts/smoke_tasks.json"),
                        help="Task-list JSON (default: scripts/smoke_tasks.json)")
    parser.add_argument("--models", default=",".join(DEFAULT_MODELS),
                        help=f"Comma-separated model ids (default: {','.join(DEFAULT_MODELS)})")
    parser.add_argument("--attempts", type=int, default=3, help="Attempts per task (default: 3)")
    parser.add_argument("--jobs-file", type=Path,
                        help="JSON list of complete job objects (run_id/benchmark/"
                             "task/model/attempt) to enqueue as-is, e.g. a retry "
                             "list. Overrides --tasks/--models/--attempts; --run-id "
                             "is still required but only used for validation.")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print messages instead of sending")
    args = parser.parse_args()

    import os
    queue_url = args.queue_url or os.environ.get("JOBS_QUEUE_URL")
    if not args.dry_run and not queue_url:
        parser.error("--queue-url or JOBS_QUEUE_URL is required unless --dry-run")

    if args.jobs_file:
        jobs = json.loads(args.jobs_file.read_text())
        if not isinstance(jobs, list):
            parser.error("--jobs-file must contain a JSON list of job objects")
        required = {"run_id", "benchmark", "task", "model", "attempt"}
        seen: set[tuple] = set()
        deduped = []
        for job in jobs:
            missing = required - job.keys()
            if missing:
                parser.error(f"job in --jobs-file missing fields {missing}: {job}")
            if job["run_id"] != args.run_id:
                parser.error(f"job run_id {job['run_id']} != --run-id {args.run_id}")
            job["attempt"] = int(job["attempt"])
            ident = (job["benchmark"], job["task"], job["model"], job["attempt"])
            if ident in seen:
                print(f"warn: duplicate job skipped: {ident}", file=sys.stderr)
                continue
            seen.add(ident)
            deduped.append(job)
        jobs = deduped
    else:
        models = [m.strip() for m in args.models.split(",") if m.strip()]
        jobs = build_jobs(args.tasks, args.run_id, models, args.attempts)
    if not jobs:
        print("error: task list produced zero jobs (empty benchmark sections?)",
              file=sys.stderr)
        return 1

    if args.dry_run:
        for job in jobs:
            print(json.dumps(job))
        print(f"-- {len(jobs)} jobs (dry run, nothing sent)", file=sys.stderr)
        return 0

    send_jobs(queue_url, jobs)
    print(f"enqueued {len(jobs)} jobs to {queue_url}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
