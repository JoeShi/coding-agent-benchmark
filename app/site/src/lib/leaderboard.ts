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
