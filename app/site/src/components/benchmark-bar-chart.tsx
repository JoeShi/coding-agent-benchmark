"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

import { agentLogo, creatorColor, creatorLogo } from "@/lib/leaderboard";
import type { AgentRow } from "@/types/leaderboard";

/**
 * Trailing parenthesised qualifiers of a model name, innermost-last:
 *   "Opus 5 (xhigh)"                 -> { base: "Opus 5",   suffixes: ["(xhigh)"] }
 *   "Fable 5 (max) (with fallback)"  -> { base: "Fable 5",  suffixes: ["(max)", "(with fallback)"] }
 *   "Claude Opus 4.8"                -> { base: "Claude Opus 4.8", suffixes: [] }
 */
const TRAILING_GROUP = /\s*(\([^()]*\))$/;

function splitModel(model: string): { base: string; suffixes: string[] } {
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
 * The base name occupies TWO lines: everything but the last token, then the last
 * token — but only once the name reaches three tokens. Measured across the
 * target's 15 rows, which split exactly here:
 *
 *   "Gemini 3.1 Pro"    -> "Gemini 3.1"   / "Pro"
 *   "DeepSeek V4 Pro"   -> "DeepSeek V4"  / "Pro"
 *   "Composer 2.5 Fast" -> "Composer 2.5" / "Fast"
 *   "Muse Spark 1.1"    -> "Muse Spark"   / "1.1"
 *   "GPT-5.6 Terra"     -> one line
 *
 * Those 15 rows are also consistent with `base.length > 13` and with a pixel
 * threshold near 57.5px (widest unwrapped "GPT-5.6 Terra" = 57.08px, narrowest
 * wrapped "Gemini 3.1 Pro" = 58.29px) — the target offers no row that separates
 * the three. Token count wins because it needs no font metrics (so SSR and the
 * client agree) and because it keeps this repo's four Claude rows consistent:
 * `length > 13` would wrap "Claude Opus 4.8" but leave the 13-char
 * "Claude Opus 5" alone on one 61.95px line, overflowing its 73px band.
 */
function wrapBase(base: string): { line1: string; line2: string } {
  const tokens = base.split(" ");
  if (tokens.length < 3) return { line1: base, line2: "" };
  return { line1: tokens.slice(0, -1).join(" "), line2: tokens[tokens.length - 1] };
}

interface BenchmarkTickProps {
  /** Band centre, supplied by recharts. */
  x?: number;
  /** Supplied by recharts; ignored — the target hard-codes y = 208 (plotBottom 200 + 8). */
  y?: number;
  payload?: { value?: string | number; index?: number };
  /** recharts also passes the flat tick ordinal; used as a fallback. */
  index?: number;
  rows: AgentRow[];
  /** See `BenchmarkBarChartProps.creatorSuffix`. */
  creatorSuffix?: boolean;
}

/**
 * Axis tick: two stacked rows — agent logo + agent name, then creator logo +
 * the model name with each parenthesised suffix on its own greyed line.
 * Structure and attributes mirror the target verbatim.
 */
function BenchmarkTick({
  x = 0,
  payload,
  index,
  rows,
  creatorSuffix,
}: BenchmarkTickProps) {
  const rowIndex = payload?.index ?? index;
  const row =
    (rowIndex === undefined ? undefined : rows[rowIndex]) ??
    rows.find((candidate) => candidate.label === payload?.value);
  if (!row) return <g />;

  const logoA = agentLogo(row.agent);
  const logoB = creatorLogo(row.creator);
  const { base, suffixes } = splitModel(row.model);
  if (creatorSuffix) suffixes.push(`(${row.creator})`);
  const { line1, line2 } = wrapBase(base);

  return (
    <g transform={`translate(${x},208)`} style={{ overflow: "visible" }}>
      <title>{row.label}</title>
      <desc>{`Label for ${row.label}`}</desc>
      <g transform="translate(-60, 8)">
        {logoA && (
          <image
            href={logoA}
            x="28"
            y="-7.5"
            width="13"
            height="13"
            preserveAspectRatio="xMidYMid meet"
          />
        )}
        <text
          x="43"
          y="0"
          fontSize="9px"
          fontWeight="500"
          dominantBaseline="middle"
        >
          {row.agent}
        </text>
        {logoB && (
          <image
            href={logoB}
            x="28"
            y="8.5"
            width="13"
            height="13"
            preserveAspectRatio="xMidYMid meet"
          />
        )}
        <text
          x="43"
          y="16"
          fontSize="9px"
          fontWeight="500"
          dominantBaseline="middle"
        >
          {line1}
          {/* Always emitted, even when empty — the target ships exactly ONE
              non-grey tspan here. An empty tspan is inert (it carries no glyph
              for `dy` to shift), so the greyed suffixes below still begin on
              line 2, as measured: "Opus 5 (xhigh)" puts "(xhigh)" at y 28. */}
          <tspan x="43" dy="12">
            {line2}
          </tspan>
          {suffixes.map((suffix, i) => (
            <tspan
              key={`${suffix}-${i}`}
              x="43"
              dy="12"
              fontSize="9px"
              fill="#737373"
              fontWeight="500"
            >
              {suffix}
            </tspan>
          ))}
        </text>
      </g>
    </g>
  );
}

export interface BenchmarkBarChartProps {
  /** Already sorted and sliced by the caller. */
  rows: AgentRow[];
  /** Bar height accessor. */
  valueOf: (row: AgentRow) => number;
  /** Centred white in-bar label. */
  labelOf: (row: AgentRow) => string;
  /**
   * Append `(creator)` as one more greyed suffix line under the model name.
   * Measured: the cost and execution-time tabs carry it, the score tabs do not.
   */
  creatorSuffix?: boolean;
}

export function BenchmarkBarChart({
  rows,
  valueOf,
  labelOf,
  creatorSuffix,
}: BenchmarkBarChartProps): React.ReactElement {
  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={320}>
        <BarChart
          data={rows}
          /* recharts' calculateOffset adds the XAxis' own height (default 30)
             to margin.bottom, so 90 + 30 = 120 -> clip rect y 24, height 176. */
          margin={{ top: 24, right: 0, bottom: 90, left: 20 }}
          /* bandSize = 1096 / 15 = 73.0667; offset = 12.5% * 73.0667 = 9.1333;
             originalSize = 73.0667 - 2 * 9.1333 = 54.8 -> (>>0) -> 54.
             Bar x = 20 + 9.1333 = 29.1333, step 73.0667 — all as measured. */
          barCategoryGap="12.5%"
        >
          <CartesianGrid vertical={false} stroke="#ccc" strokeDasharray="2 4" />
          <YAxis hide />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            interval={0}
            tick={<BenchmarkTick rows={rows} creatorSuffix={creatorSuffix} />}
          />
          <Bar
            dataKey={(row: AgentRow) => valueOf(row)}
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
          >
            {rows.map((row) => (
              <Cell key={row.id} fill={creatorColor(row.creator)} />
            ))}
            <LabelList
              /* recharts types LabelList's dataKey as DataKey<Record<string, any>>;
                 at runtime it is handed the original row (entry.payload). */
              dataKey={(row: Record<string, unknown>) =>
                labelOf(row as unknown as AgentRow)
              }
              position="center"
              fill="white"
              fontSize={11}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
