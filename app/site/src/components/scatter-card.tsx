"use client";

import * as React from "react";

import { ChartCardHeader, MetricAccordion } from "@/components/chart-card";
import { ChartEmptyState } from "@/components/chart-empty-state";
import { CreatorLegend, QuadrantLegend } from "@/components/chart-legends";
import { ChartWatermark } from "@/components/icons";
import { IndexScatterChart } from "@/components/index-scatter-chart";
import type { AgentRow } from "@/types/leaderboard";

export interface ScatterCardProps {
  /** e.g. "Artificial Analysis Coding Agent Index vs. Total Tokens" */
  title: string;
  caption: React.ReactNode;
  /** e.g. "Total Tokens" */
  xLabel: string;
  rows: AgentRow[];
  xOf: (row: AgentRow) => number;
  xTickFormat: (value: number) => string;
  /** Body of the "How to Read This Chart" accordion. */
  note: React.ReactNode;
  /**
   * When set, the plot area carries a `<ChartEmptyState>` with this reason
   * instead of the scatter — the token-usage card, whose x axis would need token
   * counts Kiro CLI does not report. All surrounding chrome stays as measured.
   */
  empty?: string;
}

export function ScatterCard({
  title,
  caption,
  xLabel,
  rows,
  xOf,
  xTickFormat,
  note,
  empty,
}: ScatterCardProps) {
  return (
    <div className="scroll-mt-24 p-8 border border-border rounded-lg">
      <div className="flex flex-col gap-5 mb-5">
        <ChartCardHeader title={title} caption={caption} />
        <div className="w-full">
          <div className="w-full">
            {/* Measured as present but empty (height 0). */}
            <div className="text-sm text-neutral-500 flex flex-col" />

            <QuadrantLegend />
            <CreatorLegend rows={rows} />

            <div className="relative mt-2 overflow-x-scroll 2xl:overflow-visible">
              <ChartWatermark />
              {empty ? (
                /* 384 = the measured scatter chart height, so the card keeps its
                   height and the section below it does not shift. */
                <ChartEmptyState height={384} reason={empty} />
              ) : (
                <IndexScatterChart
                  rows={rows}
                  xOf={xOf}
                  xTickFormat={xTickFormat}
                  xLabel={xLabel}
                />
              )}
            </div>
          </div>
        </div>
      </div>
      <MetricAccordion title="How to Read This Chart">{note}</MetricAccordion>
    </div>
  );
}
