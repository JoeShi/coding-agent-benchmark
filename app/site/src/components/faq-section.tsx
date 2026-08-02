"use client";

/**
 * Frequently Asked Questions block — see
 * docs/research/components/run-specs-faq.spec.md §2.
 *
 * Ten single-open items, all closed by default. Reuses the Radix wrappers from
 * `@/components/ui/accordion` (read-only): `Accordion` / `AccordionItem` carry no
 * classes of their own, so the verbatim trigger string below is what shapes the
 * row. Class strings are plain concatenations — never routed through
 * `cn()`/`twMerge`, which silently drops classes the target actually ships.
 *
 * Computed values reproduced verbatim from the target:
 *   header   border-bottom 1px solid rgb(217,217,217) (`border-b border-border`;
 *            `--border: 0 0% 85%` → 0.85 × 255 = 216.75 ≈ 217 — a bare `border-b`
 *            renders BLACK under Tailwind v4 preflight), padding 0 0 12px
 *            (`pb-3`), margin 0 0 24px (`mb-6`).
 *   h2       30px/36px weight 400 serif from the global `h2` rule in
 *            `globals.css`; NO className.
 *   body     max-width 672px centred (`max-w-2xl mx-auto`).
 *   trigger  16px/24px weight 500 rgb(0,0,0), padding 16px 0 8px,
 *            border-bottom 1px solid rgb(217,217,217); closed item height 65
 *            (trigger 49).
 *   icon     lucide `Plus`, a DIRECT child of the trigger `<button>` so the
 *            trigger's `[&[data-state=open]>svg]:rotate-45` matches and turns it
 *            into an ×. No rotation logic here.
 *   answer   14px/20px weight 400 rgb(77,77,77) (`text-neutral-700`;
 *            `--neutral-700: 0 0% 30%` → 0.30 × 255 = 76.5 ≈ 77).
 */

import * as React from "react";
import { Plus } from "lucide-react";

import { FAQ_ITEMS } from "@/data/faq";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

/* -------------------------------------------------------------------------- */
/*                              Verbatim classes                              */
/* -------------------------------------------------------------------------- */

/**
 * The target's verbatim trigger string, passed with `variant="bare"` so
 * `ui/accordion.tsx` contributes no base of its own. The wrapper's default base is
 * MetricAccordion-specific (12px muted text, rgb(231,231,231) rule) and — because
 * Tailwind v4 emits same-property utilities in ALPHABETICAL class order — would
 * beat this string on the cascade no matter where it sat in the attribute. Going
 * bare is what makes the measured 65px closed-item height reachable:
 * 16 (pt) + 24 (line-height at `text-base`) + 8 (pb) + 1 (border) + 16 (mb-4).
 */
const TRIGGER_CLASS =
  "flex flex-1 items-center justify-between py-4 transition-all " +
  "[&[data-state=open]>svg]:rotate-45 text-left font-medium text-base " +
  "border-b border-border pb-2 mb-4 hover:no-underline";

const TRIGGER_ICON_CLASS =
  "h-4 w-4 shrink-0 transition-transform duration-200 text-neutral-600";

/**
 * schema.org `FAQPage`. Measured: it is the THIRD and last child of
 * `section.mt-16` — inside the FAQ section, not a sibling of it. Emitted here
 * rather than from `page.tsx` so that placement is structural.
 */
const FAQ_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_ITEMS.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.plain ?? (typeof item.a === "string" ? item.a : ""),
    },
  })),
};

/* -------------------------------------------------------------------------- */
/*                                 FaqSection                                 */
/* -------------------------------------------------------------------------- */

export function FaqSection(): React.ReactElement {
  return (
    <section className="mt-16">
      <div className="w-full border-b border-border pb-3 mb-6 space-y-2">
        <h2>Frequently Asked Questions</h2>
      </div>
      <div className="w-full max-w-2xl mx-auto">
        <Accordion type="single" collapsible>
          {FAQ_ITEMS.map((item, i) => (
            <AccordionItem key={item.q} value={`faq-${i}`}>
              <AccordionTrigger variant="bare" className={TRIGGER_CLASS}>
                {item.q}
                {/* Direct `svg` child: the trigger's
                    `[&[data-state=open]>svg]:rotate-45` turns this Plus into an
                    ×. Do not add rotation here. */}
                <Plus className={TRIGGER_ICON_CLASS} />
              </AccordionTrigger>
              <AccordionContent>
                <div className="pb-4 pt-0">
                  <p className="text-neutral-700">{item.a}</p>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSON_LD) }}
      />
    </section>
  );
}
