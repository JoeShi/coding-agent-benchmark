#!/usr/bin/env python3
"""Build the static Kiro + Artificial Analysis leaderboard data artifact."""

import argparse
import json
import math
from collections import defaultdict
from pathlib import Path

BENCHMARKS = ("terminal-bench-2", "deep-swe", "swe-atlas-qna")
EXPECTED_TASKS = {"terminal-bench-2": 84, "deep-swe": 113, "swe-atlas-qna": 124}
EXPECTED_MODELS = {
    "auto",
    "claude-opus-5",
    "claude-sonnet-5",
    "claude-opus-4.8",
    "claude-sonnet-4.6",
    "gpt-5.6-sol",
}
DISPLAY_NAMES = {
    "auto": "Auto",
    "claude-opus-5": "Claude Opus 5",
    "claude-sonnet-5": "Claude Sonnet 5",
    "claude-opus-4.8": "Claude Opus 4.8",
    "claude-sonnet-4.6": "Claude Sonnet 4.6",
    "gpt-5.6-sol": "GPT-5.6 Sol",
}


def load_records(root: Path) -> list[dict]:
    records = []
    for path in sorted(root.rglob("*.json")):
        record = json.loads(path.read_text())
        if record.get("benchmark") in BENCHMARKS:
            records.append(record)
    return records


def score(records: list[dict], exclude_errors: bool) -> tuple[dict, dict]:
    outcomes = defaultdict(lambda: defaultdict(lambda: defaultdict(list)))
    errors = defaultdict(int)
    for record in records:
        model = record.get("model") or "auto"
        if record.get("status") == "error":
            errors[model] += 1
            if exclude_errors:
                continue
        outcomes[model][record["benchmark"]][record["task"]].append(
            1 if record.get("status") == "passed" else 0
        )

    result = {}
    for model in EXPECTED_MODELS:
        benchmarks = {}
        for benchmark in BENCHMARKS:
            tasks = outcomes[model][benchmark]
            task_scores = [sum(values) / len(values) for values in tasks.values() if values]
            benchmarks[benchmark] = sum(task_scores) / len(task_scores)
            if not exclude_errors and len(task_scores) != EXPECTED_TASKS[benchmark]:
                raise ValueError(
                    f"{model}/{benchmark}: expected {EXPECTED_TASKS[benchmark]} tasks, "
                    f"found {len(task_scores)}"
                )
        result[model] = {
            "index": sum(benchmarks.values()) / len(BENCHMARKS),
            "benchmarks": benchmarks,
        }
    return result, errors


def observed_metrics(records: list[dict]) -> dict:
    grouped = defaultdict(list)
    for record in records:
        grouped[record.get("model") or "auto"].append(record)
    metrics = {}
    for model, rows in grouped.items():
        costs = [row["cost_usd"] for row in rows if row.get("cost_usd") is not None]
        times = [row["time_seconds"] for row in rows if row.get("time_seconds") is not None]
        metrics[model] = {
            "cost_usd": sum(costs) / len(costs),
            "time_seconds": sum(times) / len(times),
            "cost_coverage": len(costs) / len(rows),
            "time_coverage": len(times) / len(rows),
            "n_trials": len(rows),
        }
    return metrics


def verify_official(scores: dict, aggregate_path: Path) -> None:
    aggregate = json.loads(aggregate_path.read_text())["models"]
    for model in EXPECTED_MODELS:
        actual = scores[model]["index"]
        expected = aggregate[model]["composite_index"]
        if not math.isclose(actual, expected, rel_tol=0, abs_tol=1e-12):
            raise ValueError(f"official score mismatch for {model}: {actual} != {expected}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("trials", type=Path)
    parser.add_argument("--aa-data", type=Path, required=True)
    parser.add_argument("--aggregate", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()

    records = load_records(args.trials)
    models = {record.get("model") or "auto" for record in records}
    if models != EXPECTED_MODELS:
        raise ValueError(f"expected models {sorted(EXPECTED_MODELS)}, found {sorted(models)}")

    official, errors = score(records, exclude_errors=False)
    normalized, _ = score(records, exclude_errors=True)
    verify_official(official, args.aggregate)
    metrics = observed_metrics(records)

    kiro = []
    for model in sorted(EXPECTED_MODELS):
        kiro.append({
            "id": model,
            "agent": "Kiro CLI",
            "model": DISPLAY_NAMES[model],
            "label": f"Kiro CLI - {DISPLAY_NAMES[model]}",
            "creator": "Kiro",
            "official": official[model],
            "normalized": normalized[model],
            "cost_usd": metrics[model]["cost_usd"],
            "time_seconds": metrics[model]["time_seconds"],
            "cost_coverage": metrics[model]["cost_coverage"],
            "time_coverage": metrics[model]["time_coverage"],
            "n_trials": metrics[model]["n_trials"],
            "n_errors": errors[model],
        })

    aa = json.loads(args.aa_data.read_text())
    output = {
        "title": "Kiro CLI Coding Agent Benchmark",
        "run_id": "full-20260729",
        "generated_at": "2026-08-02",
        "methodology_version": aa["methodology_version"],
        "benchmarks": [
            {"id": "deep-swe", "label": "DeepSWE", "tasks": 113},
            {"id": "terminal-bench-2", "label": "Terminal-Bench v2", "tasks": 84},
            {"id": "swe-atlas-qna", "label": "SWE-Atlas-QnA", "tasks": 124},
        ],
        "kiro": kiro,
        "artificial_analysis": aa,
        "notes": {
            "official": "Failed and errored attempts score 0, matching Artificial Analysis.",
            "normalized": "Kiro-only sensitivity analysis: errored attempts are excluded within each task before task and benchmark averages are calculated.",
            "cost": "Kiro cost is observed Kiro Credits x $0.04 per trial; AA cost uses pay-per-token API pricing. These bases are not directly equivalent.",
            "telemetry": "Kiro cost and time exclude trials without telemetry. Cost is an observed lower-bound estimate; most three-hour timeouts are absent from mean time.",
        },
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(output, indent=2) + "\n")
    print(f"wrote {args.out} ({len(records)} trials, official scores verified)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
