"use client";

/**
 * The five chart sections, driven entirely by `src/data/sections.ts`.
 *
 * Structure is the measured one (docs/research/_sec-bodies.json): every section is
 * `section#id.scroll-mt-24` → [header block, `div.flex.flex-col.gap-8.overflow-hidden`],
 * and that body has exactly ONE child — the tabbed card alone in sections 1–2, or a
 * `div.space-y-6` holding the tabbed card + the `p-8` scatter card in sections 3–5.
 * The measured 24px card→scatter gap comes from `space-y-6`, not from `gap-8`.
 */

import * as React from "react";

import { BenchmarkBarChart } from "@/components/benchmark-bar-chart";
import { ChartCard } from "@/components/chart-card";
import { ChartEmptyState } from "@/components/chart-empty-state";
import { CreatorLegend, QuadrantLegend } from "@/components/chart-legends";
import { ChartPanel, type ChartNote } from "@/components/chart-panel";
import {
  BenchmarkLegend,
  GroupedBenchmarkBarChart,
} from "@/components/grouped-benchmark-bar-chart";
import { ScatterCard } from "@/components/scatter-card";
import { SectionHeader } from "@/components/section-header";
import {
  SECTIONS,
  type BarMetric,
  type ScatterSpec,
  type TabNote,
  type TabSpec,
} from "@/data/sections";
import {
  formatCost,
  formatIndex,
  formatPercent,
  formatTime,
} from "@/lib/leaderboard";
import type { AgentRow } from "@/types/leaderboard";

/** `TabNote.paras` is JSON-serializable; `ChartNote.body` is a node. */
function toChartNotes(notes: TabNote[]): ChartNote[] {
  return notes.map((note) => ({
    title: note.title,
    body: note.paras.map((para) => <p key={para}>{para}</p>),
  }));
}

/**
 * Measured sort order: the index and per-benchmark tabs run descending on the
 * plotted value (higher is better), while cost and execution time run ASCENDING —
 * `_bar-order2.json` has the cheapest agent first on `cost-to-run` and the fastest
 * first on `execution-time`.
 */
function barChart(metric: BarMetric, rows: AgentRow[]): React.ReactElement {
  if (metric === "cost") {
    return (
      <BenchmarkBarChart
        rows={[...rows].sort((a, b) => a.cost_usd - b.cost_usd)}
        valueOf={(row) => row.cost_usd}
        labelOf={(row) => formatCost(row.cost_usd)}
        creatorSuffix
      />
    );
  }

  if (metric === "time") {
    return (
      <BenchmarkBarChart
        rows={[...rows].sort((a, b) => a.time_seconds - b.time_seconds)}
        valueOf={(row) => row.time_seconds}
        labelOf={(row) => formatTime(row.time_seconds)}
        creatorSuffix
      />
    );
  }

  if (metric === "index") {
    return (
      <BenchmarkBarChart
        rows={[...rows].sort((a, b) => b.index - a.index)}
        // Index is a 0–1 fraction; the axis and labels are the 0–100 form.
        valueOf={(row) => row.index * 100}
        labelOf={(row) => String(formatIndex(row.index))}
      />
    );
  }

  // A single benchmark's pass@1. Rows without a score for it are dropped rather
  // than plotted as zero.
  const scoreOf = (row: AgentRow) => row.benchmarks[metric] ?? 0;
  return (
    <BenchmarkBarChart
      rows={rows
        .filter((row) => row.benchmarks[metric] !== undefined)
        .sort((a, b) => scoreOf(b) - scoreOf(a))}
      valueOf={(row) => scoreOf(row) * 100}
      labelOf={(row) => formatPercent(scoreOf(row))}
    />
  );
}

function tabBody(tab: TabSpec, rows: AgentRow[]): React.ReactNode {
  switch (tab.render.kind) {
    case "empty":
      return (
        <ChartEmptyState height={tab.chartHeight} reason={tab.render.reason} />
      );
    case "grouped":
      return <GroupedBenchmarkBarChart rows={rows} />;
    case "bar":
      return barChart(tab.render.metric, rows);
  }
}

/**
 * The panel's legend slot. `undefined` leaves `ChartPanel`'s empty 0-height
 * wrapper in place; each legend brings its own measured root, so a returned node
 * REPLACES that wrapper rather than nesting inside it.
 */
function tabLegend(tab: TabSpec, rows: AgentRow[]): React.ReactNode {
  switch (tab.legend) {
    case "benchmark":
      return <BenchmarkLegend />;
    case "creator":
      return <CreatorLegend rows={rows} />;
    case "none":
      return undefined;
  }
}

/**
 * `xLabel` is the scatter title's `vs. ` suffix — "Total Tokens", "Cost per Task",
 * "Execution Time" — which is exactly what the target prints as the x-axis title.
 */
function scatterCard(spec: ScatterSpec, rows: AgentRow[]): React.ReactElement {
  const xLabel = spec.title.split("vs. ")[1] ?? "";
  const note = spec.note.paras.map((para) => <p key={para}>{para}</p>);
  const isCost = spec.render.kind === "scatter" && spec.render.metric === "cost";

  return (
    <ScatterCard
      title={spec.title}
      caption={spec.caption}
      xLabel={xLabel}
      rows={rows}
      xOf={(row) => (isCost ? row.cost_usd : row.time_seconds)}
      xTickFormat={isCost ? formatCost : formatTime}
      note={note}
      empty={spec.render.kind === "empty" ? spec.render.reason : undefined}
    />
  );
}

export function BenchmarkSections({ rows }: { rows: AgentRow[] }) {
  return (
    <>
      {SECTIONS.map((section) => {
        const card = (
          <ChartCard
            tabs={section.tabs.map((tab) => ({
              value: tab.slug,
              label: tab.label,
            }))}
            param={section.param}
          >
            {(active) => {
              const tab =
                section.tabs.find((candidate) => candidate.slug === active) ??
                section.tabs[0];
              return (
                <ChartPanel
                  title={tab.title}
                  caption={tab.caption}
                  notes={toChartNotes(tab.notes)}
                  legend={tabLegend(tab, rows)}
                  annotation={
                    tab.scatterBody ? <QuadrantLegend /> : undefined
                  }
                  scatterChart={tab.scatterBody}
                  showColorBy={tab.showColorBy}
                  showModelPicker={tab.showModelPicker}
                >
                  {tabBody(tab, rows)}
                </ChartPanel>
              );
            }}
          </ChartCard>
        );

        return (
          <SectionHeader
            key={section.id}
            id={section.id}
            title={section.heading}
            description={section.description}
          >
            {section.scatter ? (
              <div className="space-y-6">
                {card}
                {scatterCard(section.scatter, rows)}
              </div>
            ) : (
              card
            )}
          </SectionHeader>
        );
      })}
    </>
  );
}
