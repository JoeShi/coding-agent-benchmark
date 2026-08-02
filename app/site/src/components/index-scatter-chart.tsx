"use client";

import * as React from "react";
import {
  Customized,
  ReferenceArea,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
} from "recharts";

import { creatorColor } from "@/lib/leaderboard";
import type { AgentRow } from "@/types/leaderboard";

/* -------------------------------------------------------------------------- */
/* geometry                                                                   */
/* -------------------------------------------------------------------------- */

/** Measured surface height. Width comes from the responsive container (1084 at 2xl). */
const CHART_HEIGHT = 384;

/**
 * `calculateOffset` in recharts 2.15.4 seeds the offset from `margin` and then
 * ADDS each visible axis's own size:
 *
 *   left   = margin.left   + YAxis.width  =  5 + 60 =  65
 *   right  = margin.right                 =  5      =   5
 *   top    = margin.top                   =  5      =   5
 *   bottom = margin.bottom + XAxis.height = 23 + 30 =  53
 *
 * On the measured 1084 x 384 surface that gives the plot rect
 *   x = 65, y = 5, width = 1084 - 65 - 5 = 1014, height = 384 - 5 - 53 = 326
 * which is exactly the measured `<clipPath><rect>`.
 */
const MARGIN = { top: 5, right: 5, bottom: 23, left: 5 };

/** 7 measured X ticks (`0 5M 10M 15M 20M 25M 30M`). */
const X_TICK_COUNT = 7;
/** 11 measured Y ticks (`25 30 35 … 75`). */
const Y_TICK_COUNT = 11;

/** Measured tick text sits 10px off the axis edge (X at y=341, Y at x=55): tickSize 6 + tickMargin 4. */
const TICK_MARGIN = 4;

const TICK_STYLE = { fontSize: 11, fill: "#666" } as const;

/** Both axis titles override the `fill="#808080"` attribute with an inline style. */
const AXIS_TITLE_STYLE: React.CSSProperties = {
  fill: "#000",
  fontSize: 13,
  textAnchor: "middle",
};

const QUADRANT_GOOD_FILL = "rgb(144, 238, 144)";
const QUADRANT_BAD_FILL = "rgb(235, 235, 235)";

const DOT_RADIUS = 6;

/* -------------------------------------------------------------------------- */
/* nice ticks                                                                 */
/* -------------------------------------------------------------------------- */

const NICE_MULTIPLES = [1, 2, 2.5, 5, 10];

/** Kill float noise from `lo + i * step` (e.g. 30.000000000000004). */
const clean = (v: number): number => Number(v.toPrecision(12));

/** Smallest `{1,2,2.5,5,10} x 10^k` that is >= `rough`. */
function niceStep(rough: number): number {
  if (!Number.isFinite(rough) || rough <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const ratio = rough / magnitude;
  const multiple = NICE_MULTIPLES.find((m) => ratio <= m + 1e-9) ?? 10;
  return multiple * magnitude;
}

interface Axis {
  domain: [number, number];
  ticks: number[];
  /** Midpoint of the *domain* — the quadrant split, which is also the pixel midpoint. */
  mid: number;
}

function axisFromBounds(lo: number, step: number, count: number): Axis {
  const hi = clean(lo + step * (count - 1));
  const ticks = Array.from({ length: count }, (_, i) => clean(lo + step * i));
  return { domain: [clean(lo), hi], ticks, mid: clean((lo + hi) / 2) };
}

/**
 * X axis: anchored at 0 (the measured first tick), `count` round steps wide. The
 * middle tick is therefore the domain midpoint and lands on the pixel midpoint.
 */
function xAxisFor(values: number[], count: number): Axis {
  const max = values.length ? Math.max(...values, 0) : 0;
  const step = niceStep(max / (count - 1));
  return axisFromBounds(0, step, count);
}

/**
 * Y axis: `count` round steps centred on the data, the way recharts-scale's
 * `getNiceTickValues` centres a fixed tick count. Index data spanning
 * 30.3 … 66.7 with 11 ticks gives step 5 centred on 50 -> the measured 25 … 75.
 */
function yAxisFor(values: number[], count: number): Axis {
  if (!values.length) return axisFromBounds(0, 1, count);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const step = niceStep((max - min) / (count - 1));
  const centre = Math.round((min + max) / 2 / step) * step;
  let lo = centre - step * Math.floor((count - 1) / 2);
  const span = step * (count - 1);
  // The span is >= the data range by construction, so a single shift always covers it.
  if (lo > min) lo -= Math.ceil((lo - min) / step) * step;
  if (lo + span < max) lo += Math.ceil((max - (lo + span)) / step) * step;
  return axisFromBounds(lo, step, count);
}

/* -------------------------------------------------------------------------- */
/* points                                                                     */
/* -------------------------------------------------------------------------- */

interface ScatterPoint {
  id: string;
  label: string;
  creator: string;
  x: number;
  /** Index on the 0-100 scale the axis is labelled in. */
  y: number;
}

interface DotProps {
  cx?: number;
  cy?: number;
  payload?: ScatterPoint;
}

/** Per-point fill, so `shape` has to be custom. */
const renderDot = ({ cx, cy, payload }: DotProps) => (
  <circle
    cx={cx}
    cy={cy}
    r={DOT_RADIUS}
    fill={creatorColor(payload?.creator ?? "")}
    opacity={1}
    style={{ pointerEvents: "none" }}
  />
);

/* -------------------------------------------------------------------------- */
/* point labels                                                               */
/* -------------------------------------------------------------------------- */

/** Default anchor offset from the dot, in plot coordinates. */
const LABEL_DX = 8;
const LABEL_DY = 8;
/** Rows closer than this vertically are treated as colliding. */
const LABEL_ROW_GAP = 12;
/** Mean advance width of the 11px label face — only used for overlap testing. */
const LABEL_CHAR_WIDTH = 5.6;

const px = (v: number): number => Math.round(v * 100) / 100;

interface PlacedLabel extends ScatterPoint {
  dotX: number;
  dotY: number;
  x: number;
  y: number;
  width: number;
  /** Pushed off its default spot -> draw a leader line back to the dot. */
  moved: boolean;
}

/**
 * Deterministic stand-in for the target's collision solver: default the label
 * below-right of its dot, and while it would land within `LABEL_ROW_GAP` of an
 * already-placed label whose horizontal extent overlaps, push it one row down.
 */
function placeLabels(
  points: ScatterPoint[],
  toPlotX: (v: number) => number,
  toPlotY: (v: number) => number,
): PlacedLabel[] {
  const placed: PlacedLabel[] = [];

  points.forEach((point) => {
    const dotX = toPlotX(point.x);
    const dotY = toPlotY(point.y);
    const width = point.label.length * LABEL_CHAR_WIDTH;
    const x = dotX + LABEL_DX;
    let y = dotY + LABEL_DY;
    let moved = false;

    for (let guard = 0; guard <= points.length; guard += 1) {
      const clash = placed.find(
        (other) =>
          Math.abs(other.y - y) < LABEL_ROW_GAP &&
          x < other.x + other.width &&
          other.x < x + width,
      );
      if (!clash) break;
      y = clash.y + LABEL_ROW_GAP;
      moved = true;
    }

    placed.push({ ...point, dotX, dotY, x, y, width, moved });
  });

  return placed;
}

/** What `<Customized>` hands down out of the chart's props + state. */
interface ChartGeometry {
  points?: ScatterPoint[];
  offset?: { left?: number; top?: number };
  xAxisMap?: Record<string, { scale?: (value: number) => number }>;
  yAxisMap?: Record<string, { scale?: (value: number) => number }>;
}

/**
 * The label layer, rendered through `<Customized>` so it lives in the same SVG
 * surface (and therefore the same coordinate space) as the dots, and can read
 * the live scales — which a separate absolutely-positioned `<svg>` could not do
 * without duplicating the responsive width measurement.
 */
function PointLabelLayer({
  points,
  offset,
  xAxisMap,
  yAxisMap,
}: ChartGeometry) {
  const xScale = xAxisMap?.["0"]?.scale;
  const yScale = yAxisMap?.["0"]?.scale;
  const left = offset?.left ?? 0;
  const top = offset?.top ?? 0;

  if (!points?.length || !xScale || !yScale) return <g />;

  const labels = placeLabels(
    points,
    (v) => xScale(v) - left,
    (v) => yScale(v) - top,
  );

  return (
    <g transform={`translate(${left}, ${top})`} pointerEvents="none" aria-hidden="true">
      {labels.map((entry) => (
        <g key={entry.id} opacity={1}>
          {entry.moved && (
            <line
              x1={px(entry.x)}
              y1={px(entry.y)}
              x2={px(entry.dotX)}
              y2={px(entry.dotY)}
              stroke="rgba(0, 0, 0, 0.2)"
              strokeWidth={1}
            />
          )}
          <text
            x={px(entry.x)}
            y={px(entry.y)}
            fontSize={11}
            fontWeight={400}
            fill="rgba(0, 0, 0, 0.75)"
            dominantBaseline="hanging"
            stroke="white"
            strokeWidth={2}
            strokeLinejoin="round"
            paintOrder="stroke"
          >
            {entry.label}
          </text>
        </g>
      ))}
    </g>
  );
}

/* -------------------------------------------------------------------------- */
/* chart                                                                      */
/* -------------------------------------------------------------------------- */

export interface IndexScatterChartProps {
  rows: AgentRow[];
  /** X value per row (tokens / cost / time). */
  xOf: (row: AgentRow) => number;
  xTickFormat: (value: number) => string;
  xLabel: string;
}

export function IndexScatterChart({
  rows,
  xOf,
  xTickFormat,
  xLabel,
}: IndexScatterChartProps) {
  const points = React.useMemo<ScatterPoint[]>(
    () =>
      rows.map((row) => ({
        id: row.id,
        label: row.label,
        creator: row.creator,
        x: xOf(row),
        y: row.index * 100,
      })),
    [rows, xOf],
  );

  const xAxis = React.useMemo(
    () => xAxisFor(points.map((p) => p.x), X_TICK_COUNT),
    [points],
  );
  const yAxis = React.useMemo(
    () => yAxisFor(points.map((p) => p.y), Y_TICK_COUNT),
    [points],
  );

  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <ScatterChart margin={MARGIN}>
        {/* Declared first: `renderByOrder` keeps child order, so the quadrants
            paint behind the axes, the dots and the label layer. */}
        <ReferenceArea
          x1={xAxis.domain[0]}
          x2={xAxis.mid}
          y1={yAxis.mid}
          y2={yAxis.domain[1]}
          fill={QUADRANT_GOOD_FILL}
          fillOpacity={0.25}
          strokeOpacity={0}
        />
        <ReferenceArea
          x1={xAxis.mid}
          x2={xAxis.domain[1]}
          y1={yAxis.domain[0]}
          y2={yAxis.mid}
          fill={QUADRANT_BAD_FILL}
          fillOpacity={0.25}
          strokeOpacity={0}
        />
        <XAxis
          type="number"
          dataKey="x"
          domain={xAxis.domain}
          ticks={xAxis.ticks}
          tickLine={false}
          axisLine={false}
          tickMargin={TICK_MARGIN}
          tick={TICK_STYLE}
          tickFormatter={xTickFormat}
          label={{
            value: xLabel,
            position: "bottom",
            offset: 13,
            style: AXIS_TITLE_STYLE,
          }}
        />
        <YAxis
          type="number"
          dataKey="y"
          domain={yAxis.domain}
          ticks={yAxis.ticks}
          tickLine={false}
          axisLine={false}
          tickMargin={TICK_MARGIN}
          tick={TICK_STYLE}
          label={{
            value: "Artificial Analysis Coding Agent Index",
            angle: -90,
            position: "insideLeft",
            style: AXIS_TITLE_STYLE,
          }}
        />
        <Scatter data={points} isAnimationActive={false} shape={renderDot} />
        <Customized points={points} component={PointLabelLayer} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}
