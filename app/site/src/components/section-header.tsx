"use client";

/**
 * Section shell header — see docs/research/components/section-shell.spec.md §1.
 *
 * Renders the `<section>` element itself plus its header block; `children` is the
 * section body.
 *
 * Computed values reproduced verbatim from the target:
 *   header  padding 20px 0 0 (`pt-5`), margin 0 0 32px (`mb-8`), gap 16px (`gap-4`),
 *           border-top 1px solid rgb(217,217,217) (`border-t border-border`;
 *           `--border: 0 0% 85%` → 0.85 × 255 = 216.75 ≈ 217).
 *   h2      30px/36px weight 400 serif — supplied by the global `h2` rule in
 *           `globals.css`, so NO font utilities are added here.
 *   p       16px/24px (`text-base`), max-width 634.219px (what `60ch` yields in
 *           suisseIntl at 16px: 634.219 / 60 = 10.5703px per `ch`).
 */

import * as React from "react";

export function SectionHeader({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="flex flex-col gap-4 mb-8 pt-5 border-t border-border">
        {/* Scroll-spy sentinel: 1×1, invisible, inert. */}
        <div className="h-px w-px opacity-0 pointer-events-none" />
        {/* 36px tall row that holds ONLY the h2. */}
        <div className="flex items-start justify-between gap-4">
          <h2 className="flex items-baseline gap-3 flex-wrap">
            {/* 20×20 swatch. */}
            <span className="w-5 h-5 bg-black" />
            <span>{title}</span>
          </h2>
        </div>
        <p className="text-base max-w-[60ch]">{description}</p>
      </div>
      <div className="flex flex-col gap-8 overflow-hidden">{children}</div>
    </section>
  );
}
