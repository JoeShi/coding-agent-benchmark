#!/usr/bin/env python3
"""Data collectors for the benchmark dashboard (app/server.py).

All AWS access goes through the aws CLI (same pattern as scripts/monitor.py —
no boto3). A background thread refreshes each collector at its own TTL into
an in-memory snapshot; the HTTP handlers only read the snapshot, so browser
polling never amplifies AWS calls.
"""

import importlib.util
import json
import subprocess
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

# The six kiro-cli model variants of the full run.
MODELS = ["auto", "claude-opus-5", "claude-sonnet-5",
          "claude-opus-4.8", "claude-sonnet-4.6", "gpt-5.6-sol"]
ATTEMPTS = 3

TASK_KEYS = {
    "terminal_bench_2": "terminal-bench-2",
    "deep_swe": "deep-swe",
    "swe_atlas_qna": "swe-atlas-qna",
}


def aws_json(*args, timeout=60):
    out = subprocess.run(["aws", *args, "--output", "json"],
                         capture_output=True, text=True, timeout=timeout)
    if out.returncode != 0:
        raise RuntimeError(out.stderr.strip() or f"aws {' '.join(args)} failed")
    return json.loads(out.stdout or "{}")


class Collector:
    def __init__(self, ttl, fn):
        self.ttl = ttl
        self.fn = fn
        self.data = None
        self.error = None
        self.updated_at = 0.0
        self._busy = False

    def maybe_refresh(self, now):
        if self._busy or now - self.updated_at < self.ttl:
            return
        self._busy = True
        try:
            self.data = self.fn()
            self.error = None
        except Exception as exc:  # keep last good snapshot
            self.error = str(exc)
        finally:
            self.updated_at = now
            self._busy = False


def collect_queue(queue_url, dlq_url):
    def attrs(url):
        a = aws_json("sqs", "get-queue-attributes", "--queue-url", url,
                     "--attribute-names", "ApproximateNumberOfMessages",
                     "ApproximateNumberOfMessagesNotVisible")["Attributes"]
        return (int(a["ApproximateNumberOfMessages"]),
                int(a["ApproximateNumberOfMessagesNotVisible"]))

    visible, in_flight = attrs(queue_url)
    dlq_visible, _ = attrs(dlq_url)
    return {"visible": visible, "in_flight": in_flight, "dlq": dlq_visible}


def collect_workers():
    res = aws_json("ec2", "describe-instances", "--filters",
                   "Name=tag:Project,Values=kiro-bench",
                   "Name=instance-state-name,Values=pending,running")
    instances = []
    for r in res.get("Reservations", []):
        for i in r.get("Instances", []):
            instances.append({
                "id": i["InstanceId"],
                "type": i.get("InstanceType"),
                "az": (i.get("Placement") or {}).get("AvailabilityZone"),
                "state": (i.get("State") or {}).get("Name"),
                "launched": i.get("LaunchTime"),
            })
    pings = {}
    try:
        info = aws_json("ssm", "describe-instance-information", "--filters",
                        "Key=tag:Project,Values=kiro-bench")
        for e in info.get("InstanceInformationList", []):
            pings[e["InstanceId"]] = e.get("PingStatus")
    except Exception:
        pass  # SSM visibility is best-effort
    for i in instances:
        i["ssm"] = pings.get(i["id"], "?")
    instances.sort(key=lambda i: i["launched"] or "")
    return {"instances": instances,
            "running": sum(1 for i in instances if i["state"] == "running"),
            "total": len(instances),
            "ssm_online": sum(1 for i in instances if i["ssm"] == "Online")}


def collect_records(bucket, run_id, cache_dir):
    """Mirror trial records via aws s3 sync (incremental after first run) and
    parse them all into a list. Fast enough (~6k small JSONs) per refresh.

    --exact-timestamps is required: a rerun overwrites a record in place and
    "failed" and "passed" are the same length, so plain sync (size + newer-only)
    silently keeps the stale copy."""
    cache_dir.mkdir(parents=True, exist_ok=True)
    out = subprocess.run(
        ["aws", "s3", "sync", f"s3://{bucket}/{run_id}/trials/", str(cache_dir),
         "--exact-timestamps", "--quiet"],
        capture_output=True, text=True, timeout=900)
    if out.returncode != 0:
        raise RuntimeError(out.stderr.strip() or "aws s3 sync failed")
    records = []
    for path in cache_dir.rglob("*.json"):
        try:
            records.append(json.loads(path.read_text()))
        except (OSError, json.JSONDecodeError):
            continue
    return records


def load_expected(tasks_file):
    spec = json.loads(Path(tasks_file).read_text())
    expected = {}
    for key, benchmark in TASK_KEYS.items():
        expected[benchmark] = list(spec.get(key) or [])
    return expected


def summarize_records(records, expected):
    """Everything the API needs, precomputed per refresh."""
    by_bm_model = {bm: {m: {"passed": 0, "failed": 0, "error": 0}
                        for m in MODELS} for bm in expected}
    cell = {bm: {} for bm in expected}  # bm -> (task, model, attempt) -> status
    totals = {"passed": 0, "failed": 0, "error": 0}
    rate_limit = 0
    credits = 0.0
    cost = 0.0
    for r in records:
        bm, model, attempt = r.get("benchmark"), r.get("model"), r.get("attempt")
        status = r.get("status")
        if status in totals:
            totals[status] += 1
        if r.get("error_kind") == "rate_limit":
            rate_limit += 1
        if isinstance(r.get("credits"), (int, float)):
            credits += r["credits"]
        if isinstance(r.get("cost_usd"), (int, float)):
            cost += r["cost_usd"]
        if bm in by_bm_model and model in by_bm_model[bm]:
            if status in by_bm_model[bm][model]:
                by_bm_model[bm][model][status] += 1
            cell[bm][(r.get("task"), model, attempt)] = {
                "status": status,
                "error_kind": r.get("error_kind"),
            }

    tasks = {}
    for bm, task_list in expected.items():
        rows = []
        for task in task_list:
            cells = []
            counts = {"passed": 0, "failed": 0, "error": 0, "missing": 0}
            for m in MODELS:
                for a in range(1, ATTEMPTS + 1):
                    record = cell[bm].get((task, m, a))
                    s = (record or {}).get("status") or "missing"
                    counts[s if s in counts else "missing"] += 1
                    cells.append({"model": m, "attempt": a, "status": s,
                                  "error_kind": (record or {}).get("error_kind")})
            rows.append({"task": task, "counts": counts,
                         "complete": counts["error"] == 0 and counts["missing"] == 0,
                         "cells": cells})
        tasks[bm] = rows

    for bm, task_list in expected.items():
        for m in MODELS:
            have = sum(by_bm_model[bm][m].values())
            by_bm_model[bm][m]["missing"] = len(task_list) * ATTEMPTS - have

    return {
        "records": {"total": len(records), "rate_limit": rate_limit,
                    "credits": round(credits, 2), "cost_usd": round(cost, 2),
                    **totals},
        "benchmarks": by_bm_model,
        "tasks": tasks,
        "expected": sum(len(t) for t in expected.values()) * len(MODELS) * ATTEMPTS,
    }


def _load_usage_module():
    spec = importlib.util.spec_from_file_location(
        "kiro_account_usage", REPO_ROOT / "scripts" / "kiro_account_usage.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def load_keys(secret_id, pat_file):
    """Key list: Secrets Manager (fleet source of truth), pat file fallback."""
    try:
        out = aws_json("secretsmanager", "get-secret-value",
                       "--secret-id", secret_id)
        keys = json.loads(out["SecretString"]).get("keys") or []
        if keys:
            return keys, f"secretsmanager:{secret_id}"
    except Exception:
        pass
    path = Path(pat_file)
    if path.is_file():
        keys = [l.strip() for l in path.read_text().splitlines()
                if l.strip() and not l.strip().startswith("#")]
        return keys, f"file:{path}"
    return [], "none"


def collect_key_usage(secret_id, pat_file):
    keys, source = load_keys(secret_id, pat_file)
    if not keys:
        return {"keys": [], "source": source, "error": "no keys found"}
    usage = _load_usage_module()
    with ThreadPoolExecutor(max_workers=min(len(keys), 8)) as pool:
        records = list(pool.map(
            lambda k: usage.build_record(k, ["us-east-1"], 30), keys))
    # build_record reports a network failure inside the record instead of
    # raising, which would swap the whole table for "request failed" rows on a
    # single blip. Raise so the Collector keeps the last good snapshot and only
    # surfaces the message as an error note.
    if all(str(r["status"]).startswith("request failed") for r in records):
        raise RuntimeError(records[0]["status"])
    return {"keys": records, "source": source}


class Snapshot:
    """Background-refreshing snapshot of all collectors."""

    def __init__(self, cfg):
        self.cfg = cfg
        self._lock = threading.Lock()
        self._expected = load_expected(cfg.tasks_file)
        cache_dir = REPO_ROOT / "app" / ".cache" / cfg.run_id
        self.collectors = {
            "queue": Collector(15, lambda: collect_queue(cfg.queue_url, cfg.dlq_url)),
            "workers": Collector(30, collect_workers),
            "records": Collector(45, lambda: summarize_records(
                collect_records(cfg.bucket, cfg.run_id, cache_dir),
                self._expected)),
            "keys": Collector(120, lambda: collect_key_usage(
                cfg.keys_secret_id, cfg.pat_file)),
        }
        self._stop = threading.Event()
        self._thread = None

    def _loop(self):
        while not self._stop.is_set():
            now = time.time()
            for c in self.collectors.values():
                try:
                    c.maybe_refresh(now)
                except Exception:
                    pass
            self._stop.wait(5)

    def start(self):
        # Fully async: the first records sync can take minutes (thousands of
        # objects); the HTTP API must answer immediately with partial data.
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()

    def stop(self):
        self._stop.set()

    def view(self):
        def pack(name):
            c = self.collectors[name]
            return {"data": c.data, "error": c.error, "updated_at": c.updated_at}

        return {name: pack(name) for name in self.collectors}
