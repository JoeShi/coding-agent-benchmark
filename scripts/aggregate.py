#!/usr/bin/env python3
"""Aggregate benchmark trial records into scores and cost reports.

Input: a directory of normalized trial-record JSON files (one per trial), as
emitted by the worker (scripts/worker.sh) and mirrored from S3, e.g.:

    aws s3 sync s3://$RESULTS_BUCKET/$RUN_ID/trials results/$RUN_ID/trials
    python3 scripts/aggregate.py results/$RUN_ID/trials \
        --json-out results/$RUN_ID/aggregate.json \
        --markdown-out results/$RUN_ID/report.md

Trial record schema (produced by the worker, one file per trial):

    {
      "run_id": "smoke-20260729",
      "benchmark": "terminal-bench-2" | "deep-swe" | "swe-atlas-qna",
      "task": "task-name",
      "model": "claude-opus-5",
      "attempt": 1,
      "status": "passed" | "failed" | "error",
      "credits": 12.34 | null,
      "cost_usd": 0.4936 | null,
      "time_seconds": 612.0 | null,
      "error_kind": null | "rate_limit" | "usage_limit" | "auth" | "infra" | "timeout"
    }

Scoring (aligned with docs/methodology.md): per benchmark and model, average
binary outcomes over the attempts of each task, then average across tasks so
every task has equal weight (task-normalized pass@1). The composite index is
the simple average of the benchmark scores. Trials with status "error"
(infrastructure/agent failures, not genuine task failures) score 0 — matching
Artificial Analysis ("failed or errored attempts score 0") — and are also
listed separately in the output; re-running a trial overwrites its record
(same deterministic S3 key), after which the real outcome replaces the 0.
"""

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

BENCHMARKS = ["terminal-bench-2", "deep-swe", "swe-atlas-qna"]
# Accept common aliases in trial records.
BENCHMARK_ALIASES = {
    "terminal-bench": "terminal-bench-2",
    "terminal-bench-2": "terminal-bench-2",
    "tb2": "terminal-bench-2",
    "deep-swe": "deep-swe",
    "deepswe": "deep-swe",
    "swe-atlas": "swe-atlas-qna",
    "swe-atlas-qna": "swe-atlas-qna",
    "swe_atlas_qna": "swe-atlas-qna",
}


def load_trials(input_dir: Path) -> list[dict]:
    trials = []
    for path in sorted(input_dir.rglob("*.json")):
        try:
            record = json.loads(path.read_text())
        except (OSError, json.JSONDecodeError) as exc:
            print(f"warn: skipping unreadable record {path}: {exc}", file=sys.stderr)
            continue
        record["_path"] = str(path)
        benchmark = BENCHMARK_ALIASES.get(str(record.get("benchmark", "")).lower())
        if benchmark is None:
            print(f"warn: skipping record with unknown benchmark: {path}", file=sys.stderr)
            continue
        record["benchmark"] = benchmark
        trials.append(record)
    return trials


def aggregate(trials: list[dict]) -> dict:
    # outcomes[model][benchmark][task] = list of 0/1 (error trials excluded)
    outcomes: dict[str, dict[str, dict[str, list[int]]]] = defaultdict(
        lambda: defaultdict(lambda: defaultdict(list))
    )
    stats: dict[str, dict] = defaultdict(
        lambda: {"n_trials": 0, "credits": 0.0, "n_credit_trials": 0,
                 "cost_usd": 0.0, "time_seconds": [], "errors": []}
    )

    for t in trials:
        model = t.get("model") or "auto"
        s = stats[model]
        s["n_trials"] += 1
        if t.get("credits") is not None:
            s["credits"] += t["credits"]
            s["n_credit_trials"] += 1
        if t.get("cost_usd") is not None:
            s["cost_usd"] += t["cost_usd"]
        if t.get("time_seconds") is not None:
            s["time_seconds"].append(t["time_seconds"])
        status = t.get("status")
        if status == "error":
            # Errored attempts score 0 (AA convention) but are tracked for
            # re-runs; a re-run overwrites the trial record in place.
            s["errors"].append(
                {"benchmark": t["benchmark"], "task": t.get("task"),
                 "attempt": t.get("attempt"), "error_kind": t.get("error_kind")}
            )
        if status not in ("passed", "failed", "error"):
            print(f"warn: trial with unknown status {status!r}: {t['_path']}",
                  file=sys.stderr)
            continue
        outcomes[model][t["benchmark"]][t.get("task")].append(1 if status == "passed" else 0)

    models = {}
    for model in sorted(set(list(outcomes) + list(stats))):
        bench_scores = {}
        for bench in BENCHMARKS:
            tasks = outcomes.get(model, {}).get(bench, {})
            if not tasks:
                bench_scores[bench] = None
                continue
            task_scores = {task: sum(v) / len(v) for task, v in sorted(tasks.items())}
            bench_scores[bench] = {
                "pass_at_1": sum(task_scores.values()) / len(task_scores),
                "n_tasks": len(task_scores),
                "tasks": task_scores,
            }
        present = [b["pass_at_1"] for b in bench_scores.values() if b]
        s = stats[model]
        models[model] = {
            "benchmarks": bench_scores,
            "composite_index": (
                sum(present) / len(present) if len(present) == len(BENCHMARKS) else None
            ),
            "composite_index_partial": (
                sum(present) / len(present) if present else None
            ),
            "total_credits": round(s["credits"], 2),
            "total_cost_usd": round(s["cost_usd"], 4),
            "n_trials": s["n_trials"],
            "n_credit_trials": s["n_credit_trials"],
            "credit_coverage": (
                s["n_credit_trials"] / s["n_trials"] if s["n_trials"] else None
            ),
            "n_timed_trials": len(s["time_seconds"]),
            "time_coverage": (
                len(s["time_seconds"]) / s["n_trials"] if s["n_trials"] else None
            ),
            "mean_time_seconds": (
                round(sum(s["time_seconds"]) / len(s["time_seconds"]), 1)
                if s["time_seconds"] else None
            ),
            "n_error_trials": len(s["errors"]),
            "error_trials": s["errors"],
        }
    return {"models": models}


def render_markdown(report: dict, provenance: dict | None = None) -> str:
    lines = [
        "# Benchmark Aggregate Report",
        "",
        "| Model | TB2 pass@1 | DeepSWE pass@1 | SWE-Atlas-QnA pass@1 | Composite | Credits | Cost (USD) | Mean time | Error trials |",
        "|---|---|---|---|---|---|---|---|---|",
    ]
    for model, m in report["models"].items():

        def fmt(bench):
            b = m["benchmarks"][bench]
            return f"{b['pass_at_1']:.3f} ({b['n_tasks']} tasks)" if b else "—"

        composite = m["composite_index"]
        if composite is None and m["composite_index_partial"] is not None:
            composite_str = f"{m['composite_index_partial']:.3f} (partial)"
        elif composite is None:
            composite_str = "—"
        else:
            composite_str = f"{composite:.3f}"
        mean_time = m["mean_time_seconds"]
        lines.append(
            f"| {model} | {fmt('terminal-bench-2')} | {fmt('deep-swe')} | "
            f"{fmt('swe-atlas-qna')} | {composite_str} | {m['total_credits']:.2f} | "
            f"${m['total_cost_usd']:.2f} | "
            f"{f'{mean_time:.0f}s' if mean_time else '—'} | {m['n_error_trials']} |"
        )
    lines += [
        "",
        "Scores are task-normalized pass@1 (3 attempts averaged per task, then",
        "averaged across tasks). Errored trials score 0 (AA convention) and are",
        "listed in the JSON output for re-running; a re-run overwrites the record.",
        "Credits/cost are observed lower bounds and mean time uses only trials with",
        "telemetry. Coverage by model is recorded in the JSON output.",
        "",
    ]
    if provenance:
        agent = provenance.get("agent", {})
        harnesses = provenance.get("harnesses", {})
        datasets = provenance.get("datasets", {})
        judge = provenance.get("judge", {})
        lines += [
            "## Run environment",
            "",
            f"- kiro-cli: {agent.get('kiro_cli_glibc', '?')} (glibc), "
            f"{agent.get('kiro_cli_musl', '?')} (musl fallback) — {agent.get('auth', '')}",
            f"- harnesses: harbor {harnesses.get('harbor', '?')}, pier {harnesses.get('pier', '?')}",
            f"- datasets: {datasets.get('terminal-bench', '?')} / {datasets.get('deep-swe', '?')} / {datasets.get('swe-atlas-qna', '?')}",
            f"- QnA judge: {judge.get('eval_model', '?')} via {judge.get('endpoint', '?')}",
            f"- infra: {provenance.get('infrastructure', {}).get('workers', '?')} in {provenance.get('infrastructure', {}).get('region', '?')}",
            "",
        ]
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("input_dir", type=Path, help="Directory of trial-record JSON files")
    parser.add_argument("--json-out", type=Path, help="Write aggregate JSON here")
    parser.add_argument("--markdown-out", type=Path, help="Write Markdown report here")
    parser.add_argument("--provenance", type=Path,
                        help="provenance.json with run environment details "
                             "(embedded into the Markdown report)")
    args = parser.parse_args()

    trials = load_trials(args.input_dir)
    if not trials:
        print(f"error: no trial records found under {args.input_dir}", file=sys.stderr)
        return 1
    report = aggregate(trials)

    provenance = None
    if args.provenance and args.provenance.exists():
        provenance = json.loads(args.provenance.read_text())

    json_text = json.dumps(report, indent=2) + "\n"
    if args.json_out:
        args.json_out.parent.mkdir(parents=True, exist_ok=True)
        args.json_out.write_text(json_text)
    if args.markdown_out:
        args.markdown_out.parent.mkdir(parents=True, exist_ok=True)
        args.markdown_out.write_text(render_markdown(report, provenance))
    if not args.json_out and not args.markdown_out:
        print(json_text, end="")
    return 0


if __name__ == "__main__":
    sys.exit(main())
