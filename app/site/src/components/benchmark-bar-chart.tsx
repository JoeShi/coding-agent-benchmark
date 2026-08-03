"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  agentLogo,
  creatorColor,
  creatorLogo,
  splitModel,
} from "@/lib/leaderboard";
import type { AgentRow } from "@/types/leaderboard";

/**
 * DEVIATION FROM THE TARGET (deliberate). AA plots 15 series; we plot 21, and the
 * target's tick — logo + text laid out left-to-right from x −32, so 48–77px wide —
 * overlaps once the band drops below ~77px. Measured with 21 rows at innerWidth
 * 1309: bandStep 46.43px, 20 of 21 ticks overlapping, worst case 30.85px.
 *
 * Widening the plot cannot fix it on a 1440 viewport: even deleting the sidebar
 * outright only takes the band from 52.19px to ~62.3px. So the tick is rebuilt
 * CENTRED and hard-wrapped instead — logos on their own row, then agent name and
 * model name wrapped to `MAX_CHARS`.
 *
 * `MAX_CHARS = 10` caps a line at 49.9px, measured via `getComputedTextLength()`
 * on the widest 10-char line in this data ("Muse Spark"); the worst case is
 * 4.94px/char ("Composer 2.5"). That clears the 51.48px band this page renders at
 * innerWidth 1309, and so also the ~56.75px band at 1440.
 */
const LOGO_SIZE = 13;
const LOGO_GAP = 3;
const LINE_HEIGHT = 12;
const MAX_CHARS = 10;

/**
 * Agent logo then creator logo, deduplicated. The target pairs each logo with its
 * own line of text, so it can show `anthropic_small.svg` twice for Claude Code +
 * Anthropic; side by side on one centred row, the repeat reads as a bug.
 */
function logosFor(row: AgentRow): string[] {
  const logos = [agentLogo(row.agent), creatorLogo(row.creator)].filter(
    (logo): logo is string => Boolean(logo),
  );
  return [...new Set(logos)];
}

/**
 * Greedy word wrap on a character budget. Deterministic (no font metrics), so SSR
 * and the client agree; tokens are never broken, so a single long token — only
 * "(with fallback)" in the current data — is allowed to overflow its band rather
 * than being split into "(with" / "fallback)".
 */
function wrapText(text: string): string[] {
  const lines: string[] = [];
  let current = "";

  for (const word of text.split(" ").filter(Boolean)) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && candidate.length > MAX_CHARS) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);

  return lines.length > 0 ? lines : [text];
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
 * Axis tick, centred on the band: a row holding the agent logo and the creator
 * logo, then the agent name and the model name wrapped to `MAX_CHARS`, then each
 * parenthesised suffix on its own greyed line.
 *
 * The `<title>` carries agent / model / effort so hovering the LABEL gets the
 * same information as hovering the bar (the recharts tooltip only covers the plot
 * area, which the axis sits below).
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

  const logos = logosFor(row);
  const logosWidth =
    logos.length * LOGO_SIZE + Math.max(logos.length - 1, 0) * LOGO_GAP;

  const { base, suffixes } = splitModel(row.model);
  /* AA encodes effort into the model name, so its rows already carry `(max)` /
     `(xhigh)` / `(high)`; Kiro's names don't, so the suffix is synthesized from
     `row.effort` instead of being left blank. `auto` has no effort — it picks the
     model per turn — so it gets no parenthesis at all. */
  if (
    row.effort &&
    !suffixes.some((suffix) => suffix.slice(1, -1).toLowerCase() === row.effort)
  ) {
    suffixes.push(`(${row.effort})`);
  }
  if (creatorSuffix) suffixes.push(`(${row.creator})`);

  const lines: { text: string; grey?: boolean }[] = [
    ...wrapText(row.agent).map((text) => ({ text })),
    ...wrapText(base).map((text) => ({ text })),
    ...suffixes.map((text) => ({ text, grey: true })),
  ];

  return (
    <g transform={`translate(${x},208)`} style={{ overflow: "visible" }}>
      <title>{`${row.agent} — ${row.model}${
        row.effort ? ` · effort ${row.effort}` : ""
      }`}</title>
      <desc>{`Label for ${row.label}`}</desc>
      <g transform="translate(0, 8)">
        {logos.map((logo, i) => (
          <image
            key={`${logo}-${i}`}
            href={logo}
            x={-logosWidth / 2 + i * (LOGO_SIZE + LOGO_GAP)}
            y={-LOGO_SIZE / 2}
            width={LOGO_SIZE}
            height={LOGO_SIZE}
            preserveAspectRatio="xMidYMid meet"
          />
        ))}
        <text
          x="0"
          y={LINE_HEIGHT + 4}
          textAnchor="middle"
          fontSize="9px"
          fontWeight="500"
          dominantBaseline="middle"
        >
          {lines.map((line, i) => (
            <tspan
              key={`${line.text}-${i}`}
              x="0"
              dy={i === 0 ? 0 : LINE_HEIGHT}
              fill={line.grey ? "#737373" : undefined}
              /* 8px, not the target's 9px: suffixes are never wrapped (splitting
                 "(with fallback)" mid-phrase reads worse than a wide line), and at
                 9px the two 13–15 char ones — "(with fallback)", "(Moonshot AI)" —
                 are the only lines left that exceed the band. */
              fontSize={line.grey ? "8px" : undefined}
            >
              {line.text}
            </tspan>
          ))}
        </text>
      </g>
    </g>
  );
}

/** Hover card: agent, model, effort, and the plotted value. */
function TooltipCard({
  row,
  value,
  valueLabel,
}: {
  row: AgentRow;
  value: string;
  valueLabel: string;
}): React.ReactElement {
  const { base, suffixes } = splitModel(row.model);
  const modelSuffixes = suffixes.filter(
    (suffix) => suffix.slice(1, -1).toLowerCase() !== row.effort,
  );

  return (
    <div className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs shadow-md">
      <div className="flex items-center gap-1.5 font-medium">
        {logosFor(row).map((logo, i) => (
          <svg
            key={`${logo}-${i}`}
            width={LOGO_SIZE}
            height={LOGO_SIZE}
            aria-hidden="true"
          >
            <image
              href={logo}
              width={LOGO_SIZE}
              height={LOGO_SIZE}
              preserveAspectRatio="xMidYMid meet"
            />
          </svg>
        ))}
        {row.agent}
      </div>
      <dl className="mt-1.5 grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5">
        <dt className="text-neutral-500">Model</dt>
        <dd>{[base, ...modelSuffixes].join(" ")}</dd>
        <dt className="text-neutral-500">Effort</dt>
        <dd>{row.effort ?? "n/a (router)"}</dd>
        <dt className="text-neutral-500">{valueLabel}</dt>
        <dd className="font-medium">{value}</dd>
      </dl>
    </div>
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
  /** Row label for the plotted value inside the hover card. */
  valueLabel?: string;
}

export function BenchmarkBarChart({
  rows,
  valueOf,
  labelOf,
  creatorSuffix,
  valueLabel = "Value",
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
          {/* Not on the target — added because 21 ticks can no longer show the
              full agent/model/effort triple at band width. `cursor` highlights
              the whole band so anywhere in the column works, not just the bar. */}
          <Tooltip
            isAnimationActive={false}
            cursor={{ fill: "rgba(0, 0, 0, 0.04)" }}
            content={({ active, payload }) => {
              const row = payload?.[0]?.payload as AgentRow | undefined;
              if (!active || !row) return null;
              return (
                <TooltipCard
                  row={row}
                  value={labelOf(row)}
                  valueLabel={valueLabel}
                />
              );
            }}
          />
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
