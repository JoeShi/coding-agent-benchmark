"use client";

/**
 * Placeholder for the tabs our run cannot populate — see
 * docs/research/components/chart-panel.spec.md §3.
 *
 * 10 of the 19 tabs need token / turn / percentile / harness telemetry that Kiro
 * CLI does not expose (it reports credits only). Per the product decision the card
 * and all its chrome stay pixel-identical and only the chart area carries a
 * message.
 *
 * No border, no background, no icon: anything else would invent chrome the target
 * does not have. (Tailwind v4 preflight would also render a bare `border` BLACK.)
 */

/**
 * `height` must match the chart this stands in for so section heights stay
 * faithful: 320 for the wide bar charts (the default), 384 for the scatter charts.
 */
export function ChartEmptyState({
  height = 320,
  reason,
}: {
  height?: number;
  reason: string;
}) {
  return (
    <div
      className="flex w-full flex-col items-center justify-center gap-2 text-center"
      style={{ height }}
    >
      <p className="text-sm text-neutral-500">Not measured in this run</p>
      <p className="max-w-[52ch] text-xs text-neutral-400">{reason}</p>
    </div>
  );
}
