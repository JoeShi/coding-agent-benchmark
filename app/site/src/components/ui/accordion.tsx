"use client";

/**
 * Radix Accordion wrappers — see docs/research/components/section-shell.spec.md §5.
 *
 * `AccordionTrigger` / `AccordionContent` carry the target's measured class
 * strings as defaults; `Accordion` / `AccordionItem` carry none (the target's
 * item renders with exactly `class="border-none"`, i.e. no shadcn `border-b`
 * default underneath it). Any caller-supplied `className` is appended with plain
 * string concatenation rather than `cn()`, so nothing verbatim can be dropped.
 *
 * The trigger defaults are *MetricAccordion*-specific (12px muted text, hairline
 * rule), so they are opt-in via `variant`. They must be, because Tailwind v4
 * emits same-property utilities in ALPHABETICAL class order rather than
 * class-attribute order — `.text-base` lands before `.text-xs`, `.font-medium`
 * before `.font-normal`, `.border-border` before `.border-neutral-100`. A baked-in
 * default therefore beats any call-site override no matter where it appears in the
 * attribute, and the FAQ (16px, weight 500, rgb(217,217,217) rule) could only win
 * with `!important`. `variant="bare"` supplies no base at all, so a call site can
 * ship the target's verbatim string and have it apply as measured.
 */

import * as React from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";

/**
 * Measured on the target: 12px/16px, color rgb(120,120,120) (= text-muted-foreground,
 * `--muted-foreground: 0 0% 46.9%` → 0.469 × 255 = 119.6 ≈ 120), padding 6px 0,
 * margin 0 0 8px, border-bottom 1px solid rgb(231,231,231) (= border-neutral-100,
 * `--neutral-100: 0 0% 90.59%` → 0.9059 × 255 = 231.0), height 29
 * (6 + 16 line-height + 6 + 1 border).
 *
 * `[&[data-state=open]>svg]:rotate-45` turns the direct-child `Plus` into an ×;
 * call sites must not add their own rotation.
 */
const ACCORDION_TRIGGER_CLASS =
  "flex flex-1 items-center justify-between [&[data-state=open]>svg]:rotate-45 " +
  "text-xs text-left font-normal text-muted-foreground border-b border-neutral-100 " +
  "py-1.5 mb-2 transition-colors hover:text-foreground hover:no-underline";

/**
 * The target ships shadcn's
 * `data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down`,
 * but those two keyframes live in the target's Tailwind config and `globals.css`
 * is off limits here. Substituted with Radix's own
 * `--radix-accordion-content-height` custom property driving `max-h`, per spec.
 */
const ACCORDION_CONTENT_CLASS =
  "overflow-hidden transition-all duration-300 text-sm " +
  "data-[state=closed]:max-h-0 " +
  "data-[state=open]:max-h-[var(--radix-accordion-content-height)]";

function join(base: string, className?: string) {
  return className ? `${base} ${className}` : base;
}

function Accordion({
  className,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Root>) {
  return <AccordionPrimitive.Root className={className} {...props} />;
}

function AccordionItem({
  className,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Item>) {
  return <AccordionPrimitive.Item className={className} {...props} />;
}

/**
 * Radix nests the trigger inside an `h3` (`AccordionPrimitive.Header`). The
 * header needs `display: flex` for the trigger's `flex-1` to resolve to the full
 * row width, which is what puts the `Plus` on the right edge via
 * `justify-between`.
 */
function AccordionTrigger({
  className,
  children,
  variant = "metric",
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Trigger> & {
  /**
   * `"metric"` applies the measured MetricAccordion trigger styling as a base.
   * `"bare"` applies none, letting the call site own the whole class string.
   */
  variant?: "metric" | "bare";
}) {
  const base = variant === "metric" ? ACCORDION_TRIGGER_CLASS : "";
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        className={base ? join(base, className) : className}
        {...props}
      >
        {children}
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

function AccordionContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content
      className={join(ACCORDION_CONTENT_CLASS, className)}
      {...props}
    >
      {children}
    </AccordionPrimitive.Content>
  );
}

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger };
