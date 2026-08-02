"use client";

import * as React from "react";

import { HighlightBarChart } from "@/components/highlight-bar-chart";
import {
  formatCost,
  formatIndex,
  formatTime,
  getRows,
} from "@/lib/leaderboard";
import type { AgentRow } from "@/types/leaderboard";

type MetricKey = "index" | "time_seconds" | "cost_usd";

/** Sort a copy of the 21 rows by one metric, drop nulls, keep the top 10. */
function topTen(metric: MetricKey, direction: "asc" | "desc"): AgentRow[] {
  return [...getRows()]
    .filter((row) => row[metric] !== null && row[metric] !== undefined)
    .sort((a, b) =>
      direction === "desc" ? b[metric] - a[metric] : a[metric] - b[metric],
    )
    .slice(0, 10);
}

interface HighlightCard {
  title: string;
  href: string;
  /** Card swatch — NOT the bar colour (bars use the creator's brand colour). */
  swatch: string;
  caption: string;
  rows: AgentRow[];
  value: (row: AgentRow) => number;
  barLabel: (value: number) => string | number;
  tickLabel: (row: AgentRow) => string;
  /** `data[].` key in this card's schema.org `Dataset` — see `datasetFor`. */
  datasetKey: string;
}

/**
 * The `Dataset` JSON-LD each highlight card ships, reproduced field-for-field
 * from the target (three such blocks, one per card, each the second child of the
 * card's `div.w-full`). `name` is the card title, `description` is the caption
 * plus the fixed measurement clause, and `data` mirrors the plotted top-10 —
 * `label` identical to the axis tick, `\n(creator)` included.
 *
 * NOTE: `creator`, `license` and `citation` are the target's own values, kept
 * verbatim for DOM fidelity while the numbers are this repo's Kiro run. That is
 * fine for local fidelity work; re-point all three before publishing anywhere.
 */
function datasetFor(card: HighlightCard): object {
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: card.title,
    creator: {
      "@type": "Organization",
      name: "Artificial Analysis",
      url: "https://artificialanalysis.ai",
    },
    description: `${card.caption} · Evaluation results measured independently by Artificial Analysis`,
    measurementTechnique:
      "Independent test run by Artificial Analysis on dedicated hardware.",
    spatialCoverage: "Worldwide",
    keywords: ["analytics", "llm", "AI", "benchmark", "model", "gpt", "claude"],
    license: "https://artificialanalysis.ai/docs/legal/Terms-of-Use.pdf",
    isAccessibleForFree: true,
    citation:
      "Artificial Analysis (2025). LLM benchmarks dataset. https://artificialanalysis.ai",
    data: card.rows.map((row) => ({
      label: card.tickLabel(row),
      [card.datasetKey]: card.value(row),
    })),
  };
}

export function HighlightsSection() {
  const cards: HighlightCard[] = [
    {
      title: "Coding Agent Index",
      href: "#coding-agents-index",
      swatch: "bg-brand-purple",
      caption:
        "Artificial Analysis Coding Agent Index v1.3 · Higher is better",
      rows: topTen("index", "desc"),
      value: (row) => row.index,
      barLabel: formatIndex,
      tickLabel: (row) => row.label,
      datasetKey: "codingAgentsIndex",
    },
    {
      title: "Time per Task",
      href: "#execution-time",
      swatch: "bg-brand-yellow",
      caption: "Average agent wall time per task · Lower is better",
      rows: topTen("time_seconds", "asc"),
      value: (row) => row.time_seconds,
      barLabel: formatTime,
      tickLabel: (row) => `${row.label}\n(${row.creator})`,
      datasetKey: "codingAgentsMeanAgentWallTimeSec",
    },
    {
      title: "Cost per Task",
      href: "#cost-to-run",
      swatch: "bg-brand-orange",
      caption: "Average API cost per task (USD) · Lower is better",
      rows: topTen("cost_usd", "asc"),
      value: (row) => row.cost_usd,
      barLabel: formatCost,
      tickLabel: (row) => `${row.label}\n(${row.creator})`,
      datasetKey: "codingAgentsMeanCostUsd",
    },
  ];

  return (
    <section className="container mt-8 mb-24">
      <p className="text-sm font-medium border-b border-border pb-3 mb-6">
        Highlights
      </p>
      <div className="mb-16 lg:mb-24">
        <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-3">
          {cards.map((card) => (
            <div
              key={card.title}
              className="border border-border rounded-lg p-4 relative"
            >
              <div className="flex items-baseline gap-2 mb-3">
                <div className={`w-4 h-4 shrink-0 ${card.swatch}`} />
                <h3 className="text-2xl font-brand-serif font-medium">
                  <a href={card.href}>{card.title}</a>
                </h3>
              </div>
              <div className="text-xs text-neutral-500 mb-4">
                {card.caption}
              </div>
              <HighlightBarChart
                rows={card.rows}
                value={card.value}
                barLabel={card.barLabel}
                tickLabel={card.tickLabel}
                jsonLd={datasetFor(card)}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
