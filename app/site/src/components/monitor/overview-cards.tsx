/**
 * Four summary cards: queue depth, worker fleet, record progress, spend. Same
 * numbers as the dark dashboard's `OverviewCards`, restyled onto the AA tokens.
 */

import * as React from "react";

import {
  fmtDecimal,
  fmtNum,
  STATUS_BG,
  type Overview,
} from "@/lib/monitor";

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border rounded-lg p-4 flex flex-col gap-2">
      <span className="text-xs font-medium text-muted-foreground">{title}</span>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between text-sm">
      <span className="text-neutral-500">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function LegendItem({
  swatch,
  children,
}: {
  swatch?: string;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {swatch && <span className={`h-2 w-2 ${swatch}`} />}
      {children}
    </span>
  );
}

export function OverviewCards({ overview }: { overview: Overview | null }) {
  if (!overview) return null;

  const queue = overview.queue ?? {};
  const workers = overview.workers ?? {};
  const records = overview.records ?? {};

  const passed = records.passed ?? 0;
  const failed = records.failed ?? 0;
  const error = records.error ?? 0;
  const expected = records.expected ?? 0;
  const remainder = Math.max(expected - passed - failed - error, 0);
  const pct = (v: number) => (expected > 0 ? (v / expected) * 100 : 0);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card title="Queue">
        <Row label="Waiting" value={fmtNum(queue.visible)} />
        <Row label="In flight" value={fmtNum(queue.in_flight)} />
        <Row label="DLQ" value={fmtNum(queue.dlq)} />
      </Card>

      <Card title="Workers">
        <div className="text-3xl font-brand-serif">
          {fmtNum(workers.running)}
          <span className="text-neutral-500"> / {fmtNum(workers.total)}</span>
        </div>
        <span className="text-xs text-neutral-500">
          SSM online: {fmtNum(workers.ssm_online)}
        </span>
      </Card>

      <Card title="Record progress">
        <div className="text-3xl font-brand-serif">
          {fmtNum(records.total)}
          <span className="text-neutral-500"> / {fmtNum(expected)}</span>
        </div>
        <div className="flex h-2 w-full overflow-hidden rounded-full bg-neutral-200">
          <div
            className={STATUS_BG.passed}
            style={{ width: `${pct(passed)}%` }}
          />
          <div
            className={STATUS_BG.failed}
            style={{ width: `${pct(failed)}%` }}
          />
          <div className={STATUS_BG.error} style={{ width: `${pct(error)}%` }} />
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-500">
          <LegendItem swatch={STATUS_BG.passed}>
            Passed {fmtNum(passed)}
          </LegendItem>
          <LegendItem swatch={STATUS_BG.failed}>
            Failed {fmtNum(failed)}
          </LegendItem>
          <LegendItem swatch={STATUS_BG.error}>
            Errors {fmtNum(error)}
          </LegendItem>
          <LegendItem swatch="bg-neutral-200">
            Remaining {fmtNum(remainder)}
          </LegendItem>
          <LegendItem>Rate limited {fmtNum(records.rate_limit)}</LegendItem>
        </div>
      </Card>

      <Card title="Consumption">
        <div className="text-3xl font-brand-serif">
          {fmtDecimal(records.credits)}
          <span className="text-neutral-500 text-base"> credits</span>
        </div>
        <span className="text-xs text-neutral-500">
          ${fmtDecimal(records.cost_usd)} USD
        </span>
      </Card>
    </div>
  );
}
