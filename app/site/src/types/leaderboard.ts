/** Shape of `public/data/leaderboard.json` (produced by scripts/build_leaderboard_data.py). */

export type BenchmarkId = "deep-swe" | "terminal-bench-2" | "swe-atlas-qna";

/** Per-benchmark pass@1, keyed by benchmark id. Values are 0–1 fractions. */
export type BenchmarkScores = Partial<Record<BenchmarkId, number>>;

export interface Benchmark {
  id: BenchmarkId;
  label: string;
  tasks: number;
}

export interface ScoreSet {
  /** Coding Agent Index — mean of the per-benchmark pass@1 values, 0–1. */
  index: number;
  benchmarks: BenchmarkScores;
}

/**
 * Two parallel score sets ship per Kiro model:
 * - `official`   — AA-faithful: failed *and* errored attempts score 0.
 * - `normalized` — sensitivity analysis that excludes errored attempts.
 *                  Never present this as the headline number.
 */
export type ScoringMode = "official" | "normalized";

export interface KiroRow {
  id: string;
  agent: "Kiro CLI";
  model: string;
  label: string;
  creator: "Kiro";
  official: ScoreSet;
  normalized: ScoreSet;
  /** Observed Kiro Credits x $0.04, mean per task. */
  cost_usd: number;
  time_seconds: number;
  /** Fraction of trials that reported telemetry (cost/time are means over these only). */
  cost_coverage: number;
  time_coverage: number;
  n_trials: number;
  n_errors: number;
}

export interface AaRow {
  id: string;
  agent: string;
  model: string;
  creator: string;
  label: string;
  index: number;
  benchmarks: BenchmarkScores;
  cost_usd: number;
  time_seconds: number;
}

export interface AaSnapshot {
  source: string;
  retrieved_at: string;
  methodology_version: string;
  scope: string;
  models: AaRow[];
}

export interface LeaderboardNotes {
  official: string;
  normalized: string;
  cost: string;
  telemetry: string;
}

export interface Leaderboard {
  title: string;
  run_id: string;
  generated_at: string;
  methodology_version: string;
  benchmarks: Benchmark[];
  kiro: KiroRow[];
  artificial_analysis: AaSnapshot;
  notes: LeaderboardNotes;
}

/** A Kiro or AA row flattened to one scoring mode — what charts and tables consume. */
export interface AgentRow {
  id: string;
  agent: string;
  model: string;
  label: string;
  creator: string;
  index: number;
  benchmarks: BenchmarkScores;
  cost_usd: number;
  time_seconds: number;
  /** True for the six Kiro rows, which are the highlighted/branded series. */
  isKiro: boolean;
  /**
   * Reasoning-effort setting: `high` / `xhigh` / `max`. Undefined where it does
   * not apply (kiro `auto` routes the model itself) or where the source does not
   * publish one. See `effortOf()`.
   */
  effort?: string;
  /** Kiro rows only. */
  cost_coverage?: number;
  time_coverage?: number;
  n_trials?: number;
  n_errors?: number;
}
