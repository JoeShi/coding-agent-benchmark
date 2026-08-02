"use client";

/**
 * Sticky left-rail section nav — see docs/research/components/scroll-spy-sidebar.spec.md.
 *
 * NOT tabs. All five sections stay mounted; this only scrolls to them and tracks
 * which one is current. Navigation is native (`<a href="#…">` +
 * `html { scroll-behavior: smooth }` + `scroll-mt-24` on the targets) — the click is
 * deliberately NOT intercepted. The scroll listener exists only to decide which item
 * gets `aria-current="location"`.
 *
 * Class strings are VERBATIM from `getComputedStyle()`/DOM inspection of the target
 * and are not routed through `cn()`/`twMerge`.
 *
 * `border-t` here is safe: it resolves against `border-border` from the `@layer base`
 * rule in globals.css, giving the measured `1px solid rgb(217, 217, 217)`. A bare
 * `border-t` on an element outside that rule would render BLACK under Tailwind v4.
 */

import * as React from "react";

/**
 * Labels deliberately differ from the anchor ids (`Performance` → `#coding-agents-index`,
 * `Cost` → `#cost-to-run`). Measured as-is — do not "fix" them to match.
 */
const ITEMS = [
  { label: "Performance", id: "coding-agents-index" },
  { label: "Harness Comparison", id: "harness-comparison" },
  { label: "Token Usage", id: "token-usage" },
  { label: "Cost", id: "cost-to-run" },
  { label: "Execution Time", id: "execution-time" },
] as const;

/** `pt-5 border-t sticky top-24 z-30` ⇒ padding-top 20, top 96, z 30, border 1px. */
const STICKY_CLASS = "pt-5 border-t sticky top-24 z-30";

/**
 * 8×8 SQUARE, not a circle — measured `border-radius: 0px`. `mt-1` optically aligns
 * it with the 16px label line box.
 */
const DOT_CLASS = "h-2 w-2 flex-shrink-0 transition-colors mt-1";

/**
 * `transition-colors` covers colour properties only, so the label's opacity change
 * SNAPS. That is what the target does — do not add `transition-opacity`.
 */
const LABEL_CLASS = "text-xs group-hover:opacity-100 transition-colors";

/** The target sets this inline on the label span, not via a utility class. */
const LABEL_STYLE: React.CSSProperties = { textWrap: "pretty" };

/**
 * A section becomes current once its top reaches 240px below the viewport top.
 *
 * Measured on the target by scrolling monotonically in 10px steps: `#harness-comparison`
 * (top 2020) flips at scrollY 1780 and not at 1770; `#cost-to-run` (top 4460) flips at
 * 4220 and not at 4210 — i.e. 240 ≤ offset < 250. A 100px-step sweep of all four
 * boundaries (flips at 1800 / 2600 / 4300 / 5900 against tops 2020 / 2809 / 4460 / 6107)
 * agrees.
 *
 * NOTE: this replaced an `IntersectionObserver`, which cannot express the rule reliably —
 * the callback receives only the entries that *changed*, so "topmost intersecting" is
 * history-dependent and fired a full step (~100px) early at every boundary.
 */
const ACTIVE_OFFSET = 240;

export function ScrollSpySidebar(): React.ReactElement {
  const [activeId, setActiveId] = React.useState<string>(ITEMS[0].id);

  React.useEffect(() => {
    const sections = ITEMS.map((item) => document.getElementById(item.id)).filter(
      (el): el is HTMLElement => el !== null,
    );
    if (sections.length === 0) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const line = window.scrollY + ACTIVE_OFFSET;
      let current = sections[0].id;
      for (const section of sections) {
        if (section.getBoundingClientRect().top + window.scrollY <= line) {
          current = section.id;
        }
      }
      setActiveId(current);
    };
    const schedule = () => {
      if (frame === 0) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className={STICKY_CLASS}>
      <div className="flex flex-col gap-3">
        {ITEMS.map(({ label, id }) => {
          const active = id === activeId;
          return (
            <a
              key={id}
              href={`#${id}`}
              className="group flex gap-2"
              aria-current={active ? "location" : undefined}
            >
              <span
                className={
                  DOT_CLASS + (active ? " bg-black" : " bg-neutral-500")
                }
              />
              <span
                className={LABEL_CLASS + (active ? "" : " opacity-50")}
                style={LABEL_STYLE}
              >
                {label}
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
