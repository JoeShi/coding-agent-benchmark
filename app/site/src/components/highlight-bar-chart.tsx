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
 * Innermost tick label style, transcribed from the target's inline styles.
 * `textWrap` / `WebkitLineClamp` are valid in React 19's CSSProperties.
 */
const TICK_TEXT_STYLE: React.CSSProperties = {
  fontSize: 11,
  lineHeight: 1,
  textAlign: "right",
  textWrap: "balance",
  wordBreak: "break-word",
  overflow: "hidden",
  display: "-webkit-box",
  WebkitLineClamp: 3,
  WebkitBoxOrient: "vertical",
};

/** Two-line tick labels (cards 1 and 2) keep their newline. */
const TICK_TEXT_STYLE_MULTILINE: React.CSSProperties = {
  ...TICK_TEXT_STYLE,
  whiteSpace: "pre-line",
};

interface HighlightTickProps {
  /** Band centre, supplied by recharts. */
  x?: number;
  /** Supplied by recharts; ignored — the target hard-codes y = 176. */
  y?: number;
  payload?: { value?: string | number };
  rows: AgentRow[];
  tickLabel: (row: AgentRow) => string;
}

/**
 * Axis tick: two 16x16 logos above a -60deg-rotated, 3-line-clamped label.
 * Structure and inline styles mirror the target exactly.
 */
function HighlightTick({ x = 0, payload, rows, tickLabel }: HighlightTickProps) {
  const row = rows.find((candidate) => candidate.label === payload?.value);
  if (!row) return <g />;

  const label = tickLabel(row);
  const logoA = agentLogo(row.agent);
  const logoB = creatorLogo(row.creator);
  const textStyle = label.includes("\n")
    ? TICK_TEXT_STYLE_MULTILINE
    : TICK_TEXT_STYLE;

  return (
    <g transform={`translate(${x},176)`} style={{ overflow: "visible" }}>
      <g style={{ transform: "translate(-17px, 0px)" }}>
        <svg>
          <title>{label}</title>
          <desc>{`Logo of ${label}`}</desc>
          {logoA && (
            <image
              href={logoA}
              x="0"
              height="16px"
              width="16px"
              preserveAspectRatio="xMidYMid meet"
            />
          )}
          {logoB && (
            <image
              href={logoB}
              x="18"
              height="16px"
              width="16px"
              preserveAspectRatio="xMidYMid meet"
            />
          )}
        </svg>
      </g>
      <g style={{ transform: "translate(-80px, 26px)" }}>
        <foreignObject
          width="80"
          height="11"
          style={{ overflow: "visible", pointerEvents: "none" }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "end",
              transform: "translateY(-50%)",
            }}
          >
            <div
              style={{
                transform: "rotate(-60deg)",
                transformOrigin: "100% 50%",
              }}
            >
              <div style={textStyle}>{label}</div>
            </div>
          </div>
        </foreignObject>
      </g>
    </g>
  );
}

export interface HighlightBarChartProps {
  /** Already sorted and sliced to the top 10. */
  rows: AgentRow[];
  /** Bar height accessor. */
  value: (row: AgentRow) => number;
  /** Centred white in-bar label; recharts hands it the raw value. */
  barLabel: (value: number) => string | number;
  /** Axis tick label; may contain a `\n`. */
  tickLabel: (row: AgentRow) => string;
  /**
   * schema.org `Dataset` for this card. Measured: each highlight card's
   * `div.w-full` has exactly TWO children — the chart wrapper and this script —
   * so it is emitted here rather than by `HighlightsSection`.
   */
  jsonLd?: object;
}

export function HighlightBarChart({
  rows,
  value,
  barLabel,
  tickLabel,
  jsonLd,
}: HighlightBarChartProps) {
  return (
    <div className="w-full">
      <div className="h-60 lg:h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows}
            /* recharts adds the XAxis' own 30px height to the bottom offset,
               so 90 + 30 puts the plot area at y 0 -> 168 as measured. */
            margin={{ top: 0, right: 0, bottom: 90, left: 20 }}
            /* 10 categories over 397px -> band 39.7; 13% gap -> bar width 29. */
            barCategoryGap="13%"
          >
            <CartesianGrid vertical={false} stroke="#ccc" />
            <YAxis hide />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              interval={0}
              tick={(tickProps) => (
                <HighlightTick
                  {...tickProps}
                  rows={rows}
                  tickLabel={tickLabel}
                />
              )}
            />
            <Bar
              dataKey={(row: AgentRow) => value(row)}
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
            >
              {rows.map((row) => (
                <Cell key={row.id} fill={creatorColor(row.creator)} />
              ))}
              <LabelList
                position="center"
                fill="white"
                fontSize={11}
                fontWeight={400}
                formatter={barLabel}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
    </div>
  );
}
