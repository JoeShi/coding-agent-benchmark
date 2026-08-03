/**
 * Panel shell for the Task Monitor, matching the tabbed chart cards on the index
 * page: `border border-border rounded-lg` with a `bg-neutral-50` header strip and
 * a `p-4` body. The dashboard's own dark `.panel` is not reused.
 */

import * as React from "react";

export const TH_CLASS = "p-3 text-xs font-medium text-muted-foreground text-left";
export const TD_CLASS = "px-3 py-2 text-sm whitespace-nowrap";
export const TR_CLASS = "even:bg-muted/50 hover:bg-muted";

/** Same 32×32 chrome as `ChartCardHeader`'s icon buttons. */
export const CONTROL_CLASS =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm " +
  "transition-colors focus-visible:outline-none focus-visible:ring-1 " +
  "focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 " +
  "rounded-lg leading-none border border-neutral-100 bg-white text-black " +
  "hover:border-neutral-700 h-8 px-3";

export function Panel({
  title,
  caption,
  actions,
  children,
}: {
  title: string;
  caption?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-border rounded-lg">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border bg-neutral-50 px-4 py-3 rounded-t-lg">
        <div className="flex flex-col gap-1">
          <h3 className="text-xl font-brand-serif">{title}</h3>
          {caption && (
            <p className="text-xs text-neutral-500 max-w-[80ch]">{caption}</p>
          )}
        </div>
        {actions}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

/** Failed-fetch / partial-data notice. Orange, matching the `error` status. */
export function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 rounded-md border border-brand-orange/40 bg-brand-orange/10 px-3 py-2 text-xs text-neutral-700">
      {children}
    </div>
  );
}

/** Horizontal scroller for the wide tables. */
export function TableScroll({ children }: { children: React.ReactNode }) {
  return <div className="w-full overflow-x-auto">{children}</div>;
}
