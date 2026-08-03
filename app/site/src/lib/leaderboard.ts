import raw from "@/data/leaderboard.json";
import type {
  AgentRow,
  Benchmark,
  Leaderboard,
  ScoringMode,
} from "@/types/leaderboard";

export const leaderboard = raw as Leaderboard;

export const benchmarks: Benchmark[] = leaderboard.benchmarks;

/**
 * Trailing parenthesised qualifiers of a model name, innermost-last:
 *   "Opus 5 (xhigh)"                 -> { base: "Opus 5",   suffixes: ["(xhigh)"] }
 *   "Fable 5 (max) (with fallback)"  -> { base: "Fable 5",  suffixes: ["(max)", "(with fallback)"] }
 *   "Claude Opus 4.8"                -> { base: "Claude Opus 4.8", suffixes: [] }
 */
const TRAILING_GROUP = /\s*(\([^()]*\))$/;

export function splitModel(model: string): { base: string; suffixes: string[] } {
  let base = model.trim();
  const suffixes: string[] = [];

  for (;;) {
    const match = TRAILING_GROUP.exec(base);
    if (!match) break;
    suffixes.unshift(match[1]);
    base = base.slice(0, match.index).trimEnd();
  }

  return { base, suffixes };
}

/**
 * AA encodes reasoning effort as a trailing parenthesised token on the model
 * name (`Opus 5 (xhigh)`), mixed in with non-effort qualifiers that use the same
 * syntax (`Fable 5 (max) (with fallback)`) — hence the vocabulary check rather
 * than "take the last group".
 */
const EFFORT_LEVELS = new Set([
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
]);

function effortOf(model: string): string | undefined {
  return splitModel(model)
    .suffixes.map((suffix) => suffix.slice(1, -1).toLowerCase())
    .find((token) => EFFORT_LEVELS.has(token));
}

/**
 * Every kiro-cli variant in this run ran at the CLI default effort, `high`. The
 * exception is `auto`, which picks the underlying model per turn — the effort is
 * not ours to state, so it stays undefined rather than being reported as `high`.
 */
const KIRO_DEFAULT_EFFORT = "high";

/**
 * Flatten Kiro rows (for the given scoring mode) + the AA snapshot into one
 * sortable list. 21 series total: 6 Kiro + 15 AA.
 */
export function getRows(mode: ScoringMode = "official"): AgentRow[] {
  const kiro: AgentRow[] = leaderboard.kiro.map((r) => ({
    id: r.id,
    agent: r.agent,
    model: r.model,
    label: r.label,
    creator: r.creator,
    index: r[mode].index,
    benchmarks: r[mode].benchmarks,
    cost_usd: r.cost_usd,
    time_seconds: r.time_seconds,
    isKiro: true,
    effort: r.id === "auto" ? undefined : KIRO_DEFAULT_EFFORT,
    cost_coverage: r.cost_coverage,
    time_coverage: r.time_coverage,
    n_trials: r.n_trials,
    n_errors: r.n_errors,
  }));

  const aa: AgentRow[] = leaderboard.artificial_analysis.models.map((r) => ({
    id: r.id,
    agent: r.agent,
    model: r.model,
    label: r.label,
    creator: r.creator,
    index: r.index,
    benchmarks: r.benchmarks,
    cost_usd: r.cost_usd,
    time_seconds: r.time_seconds,
    isKiro: false,
    effort: effortOf(r.model),
  }));

  return [...kiro, ...aa].sort((a, b) => b.index - a.index);
}

/**
 * Creator -> brand colour. Read off the target's rendered chart `fill`
 * attributes with getComputedStyle/attribute inspection — do not adjust these
 * by eye. `Kiro` has no counterpart on the target; it takes `--brand-blue`.
 */
export const CREATOR_COLORS: Record<string, string> = {
  Kiro: "#8842fd",
  Anthropic: "#c96442",
  OpenAI: "#111111",
  xAI: "#736CD3",
  "Moonshot AI": "#0C79FE",
  Meta: "#0089F4",
  "Z.ai": "#227EF8",
  Cursor: "#6B7280",
  DeepSeek: "#2745E5",
  Google: "#37A754",
};

export const FALLBACK_COLOR = "#8a8a8a";

export function creatorColor(creator: string): string {
  return CREATOR_COLORS[creator] ?? FALLBACK_COLOR;
}

/**
 * Chart axis ticks render two 16×16 logos: the agent/harness vendor first, then
 * the model creator. Files were downloaded from the target's /img/logos/, except
 * `kiro_small.svg` — AA hosts no Kiro mark, so ours is the official Kiro glyph
 * (NOT the AWS logo; Kiro rows must read as Kiro).
 */
export const AGENT_LOGOS: Record<string, string> = {
  "Kiro CLI": "/img/logos/kiro_small.svg",
  "Claude Code": "/img/logos/anthropic_small.svg",
  Codex: "/img/logos/openai_small.svg",
  "Cursor CLI": "/img/logos/cursor_small.svg",
  "Gemini CLI": "/img/logos/google_small.svg",
  "Grok Build": "/img/logos/spacexai.svg",
  "Kimi Code CLI": "/img/logos/kimi.jpg",
  Opencode: "/img/logos/opencode_small.svg",
};

export const CREATOR_LOGOS: Record<string, string> = {
  Kiro: "/img/logos/kiro_small.svg",
  Anthropic: "/img/logos/anthropic_small.svg",
  OpenAI: "/img/logos/openai_small.svg",
  xAI: "/img/logos/spacexai.svg",
  "Moonshot AI": "/img/logos/kimi.jpg",
  Meta: "/img/logos/meta_small.svg",
  "Z.ai": "/img/logos/zai_small.svg",
  Cursor: "/img/logos/cursor_small.svg",
  DeepSeek: "/img/logos/deepseek_small.svg",
  Google: "/img/logos/google_small.svg",
};

export function agentLogo(agent: string): string | undefined {
  return AGENT_LOGOS[agent];
}

export function creatorLogo(creator: string): string | undefined {
  return CREATOR_LOGOS[creator];
}

/** 0.3653… -> 37 */
export const formatIndex = (v: number): number => Math.round(v * 100);

/** 0.4118… -> "$0.41" */
export const formatCost = (v: number): string => `$${v.toFixed(2)}`;

/** 499.68 -> "8.3m" */
export const formatTime = (v: number): string => `${(v / 60).toFixed(1)}m`;

/** 0.5992… -> "59.9%" */
export const formatPercent = (v: number): string => `${(v * 100).toFixed(1)}%`;
