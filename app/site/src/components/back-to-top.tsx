"use client";

/**
 * Floating back-to-top button — see docs/research/components/back-to-top.spec.md.
 *
 * The ONLY `position: fixed` element on the target page (verified by sweeping every
 * visible element at scrollY 1200: exactly one hit).
 *
 * Class strings are reproduced VERBATIM from the target's `outerHTML` and are
 * deliberately NOT run through `cn()`/`twMerge` — a merge pass is free to drop
 * classes the target actually ships.
 *
 * The bare `border` is intentional and safe here: `border-neutral-300` supplies the
 * colour (measured `1px solid rgb(212, 212, 212)`). Without a colour class a bare
 * `border` would render BLACK under Tailwind v4 preflight.
 */

import * as React from "react";
import { ArrowUp } from "lucide-react";

/** Measured by bisection: hidden at scrollY 400, shown at 420 ⇒ strict `>`. */
const SHOW_AFTER = 400;

const BASE_CLASS =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm " +
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring " +
  "disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none " +
  "[&_svg]:w-4 [&_svg]:h-4 [&_svg]:shrink-0 leading-none border text-black " +
  "hover:border-neutral-700 fixed bottom-6 right-6 z-50 h-10 w-10 rounded-full " +
  "shadow-lg transition-all duration-300 bg-background hover:bg-neutral-100 " +
  "border-neutral-300";

const SHOWN_CLASS = "translate-y-0 opacity-100";
const HIDDEN_CLASS = "translate-y-4 opacity-0 pointer-events-none";

export function BackToTop(): React.ReactElement {
  const [shown, setShown] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setShown(window.scrollY > SHOW_AFTER);
    // Run once: a reload can restore a mid-page scroll position without firing an
    // initial scroll event.
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      type="button"
      aria-label="Back to top"
      // Measured: never unmounted — at scrollY 0 it is still visible with
      // opacity 0, which is what preserves the 300ms fade in both directions.
      className={BASE_CLASS + " " + (shown ? SHOWN_CLASS : HIDDEN_CLASS)}
      // `html { scroll-behavior: smooth }` (globals.css) animates this on its own;
      // passing an explicit `behavior` would override the target's own setting.
      onClick={() => window.scrollTo({ top: 0 })}
    >
      {/* Renders 16×16, not 20×20: the button's `[&_svg]:h-4` compiles to a
          descendant selector that out-specifies this `h-5`. Both are kept so the
          markup matches the target. */}
      <ArrowUp className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}
