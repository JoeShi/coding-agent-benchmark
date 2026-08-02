"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

import { agentLogo, creatorLogo } from "@/lib/leaderboard";
import type { AgentRow, BenchmarkId } from "@/types/leaderboard";

/**
 * The three component benchmarks, in the DOM order of both the legend chips and
 * the three `<Bar>`s. Colours read off the target's legend chips and bar `fill`
 * attributes — do not adjust by eye.
 */
export const BENCHMARK_SERIES: {
  id: BenchmarkId;
  label: string;
  color: string;
}[] = [
  { id: "deep-swe", label: "DeepSWE", color: "#2563eb" }, // rgb(37, 99, 235)
  { id: "terminal-bench-2", label: "Terminal-Bench v2", color: "#14b8a6" }, // rgb(20, 184, 166)
  { id: "swe-atlas-qna", label: "SWE-Atlas-QnA", color: "#f59e0b" }, // rgb(245, 158, 11)
];

/**
 * Static colour key above the chart (wrapper measured 1115.5 x 24). The target's
 * chips are `<button>`s but carry no handler; `type="button"` is added so React
 * does not default them to submit.
 */
export function BenchmarkLegend(): React.ReactElement {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-sm flex flex-wrap items-center">
        {BENCHMARK_SERIES.map(({ label, color }) => (
          <button
            key={label}
            type="button"
            data-state="closed"
            className="flex items-center gap-1 px-1.5 py-0.5"
            style={{ backgroundColor: "transparent" }}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

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

interface BenchmarkTickProps {
  /** Band centre, supplied by recharts. */
  x?: number;
  /** Supplied by recharts; ignored — the target hard-codes y = 208 (plotBottom 200 + 8). */
  y?: number;
  payload?: { value?: string | number; index?: number };
  /** recharts also passes the flat tick ordinal; used as a fallback. */
  index?: number;
  rows: AgentRow[];
}

/**
 * Axis tick: two stacked rows — agent logo + agent name, then creator logo +
 * the model name with each parenthesised suffix on its own greyed line.
 *
 * Byte-identical to the tick in `benchmark-bar-chart.tsx` (verified by diffing
 * this tab's `recharts-zIndex-layer_2000` dump against that spec). It is
 * *duplicated* here on purpose: that module does not export the tick and must
 * not be edited.
 */
function BenchmarkTick({ x = 0, payload, index, rows }: BenchmarkTickProps) {
  const rowIndex = payload?.index ?? index;
  const row =
    (rowIndex === undefined ? undefined : rows[rowIndex]) ??
    rows.find((candidate) => candidate.label === payload?.value);
  if (!row) return <g />;

  const logoA = agentLogo(row.agent);
  const logoB = creatorLogo(row.creator);
  const { base, suffixes } = splitModel(row.model);

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
          {base}
          {suffixes.map((suffix, i) => (
            <React.Fragment key={`${suffix}-${i}`}>
              <tspan x="43" dy="12" />
              <tspan
                x="43"
                dy="12"
                fontSize="9px"
                fill="#737373"
                fontWeight="500"
              >
                {suffix}
              </tspan>
            </React.Fragment>
          ))}
        </text>
      </g>
    </g>
  );
}

/** Props recharts hands a `LabelList` `content` renderer (via `Label`). */
interface ValueLabelProps {
  x?: string | number;
  y?: string | number;
  value?: number | string | (number | string)[];
}

/**
 * `LabelList` never emits a `transform`, so the rotated value labels need a
 * custom `content`. The anchor is the bar top-left shifted by (+5, -4); the
 * rotation pivots on that same anchor. Measured verbatim off the target.
 */
function RotatedValueLabel({
  x,
  y,
  value,
}: ValueLabelProps): React.ReactElement | null {
  const raw = Array.isArray(value) ? value[value.length - 1] : value;
  const numeric = Number(raw);
  if (x === undefined || y === undefined || Number.isNaN(numeric)) return null;

  const anchorX = Number(x) + 5;
  const anchorY = Number(y) - 4;

  return (
    <text
      x={anchorX}
      y={anchorY}
      fontSize="10"
      textAnchor="start"
      dominantBaseline="middle"
      transform={`rotate(-60, ${anchorX}, ${anchorY})`}
      opacity="1"
      fill="rgb(0, 0, 0)"
    >
      {Math.round(numeric)}
    </text>
  );
}

/** One recharts datum per agent row: the tick key plus the three series keys. */
type GroupedDatum = { label: string } & Record<BenchmarkId, number>;

export interface GroupedBenchmarkBarChartProps {
  /** Already sorted and sliced by the caller (15 on the target). */
  rows: AgentRow[];
}

export function GroupedBenchmarkBarChart({
  rows,
}: GroupedBenchmarkBarChartProps): React.ReactElement {
  /* Scores are 0-1 fractions plotted on a 0-100 axis. */
  const data: GroupedDatum[] = rows.map((row) => {
    const datum = { label: row.label } as GroupedDatum;
    for (const { id } of BENCHMARK_SERIES) {
      datum[id] = (row.benchmarks[id] ?? 0) * 100;
    }
    return datum;
  });

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={320}>
        <BarChart
          data={data}
          /* recharts' calculateOffset adds the visible XAxis' own height
             (default 30) to margin.bottom, so 90 + 30 = 120 -> clip rect
             y 40, height 160; plot area x in [20, 1116], y in [40, 200]. */
          margin={{ top: 40, right: 0, bottom: 90, left: 20 }}
          /* bandSize = 1096 / 15 = 73.0667; offset = 10% * 73.0667 = 7.3067
             (recharts' own default, passed explicitly to pin it);
             originalSize = (73.0667 - 2 * 7.3067 - 2 * 2) / 3 = 18.1511,
             then `>>= 0` -> 18. Bar x = 20 + 7.3067 = 27.3067, then
             +(18 + 2) per series -> 47.3067 / 67.3067; group step 73.0667. */
          barCategoryGap="10%"
          barGap={2}
        >
          <CartesianGrid vertical={false} stroke="#ccc" strokeDasharray="2 4" />
          <YAxis hide domain={[0, 100]} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            interval={0}
            tick={<BenchmarkTick rows={rows} />}
          />
          {BENCHMARK_SERIES.map(({ id, color }) => (
            <Bar
              key={id}
              dataKey={id}
              fill={color}
              radius={[2, 2, 0, 0]}
              isAnimationActive={false}
            >
              <LabelList dataKey={id} content={RotatedValueLabel} />
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
