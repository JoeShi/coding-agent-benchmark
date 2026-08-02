"use client";

/**
 * Chart card shell — see docs/research/components/section-shell.spec.md §3–§5.
 *
 * Every class string below was captured with `getComputedStyle()` from
 * artificialanalysis.ai and is reproduced VERBATIM. They are deliberately NOT run
 * through `cn()`/`twMerge`: several of them conflict with themselves on purpose
 * (`p-1` + `!p-0`, `rounded-lg` + `!rounded-none`, `px-3` + `pl-6 pr-6`,
 * `bg-brand-blue-light` + `!bg-transparent`) and a merge pass is free to collapse
 * classes the target actually ships. Plain concatenation only.
 *
 * `light-scrollbar` and `hide-during-screenshot` are the target's own non-Tailwind
 * utility classes. They are not defined in this repo's `globals.css` (which is off
 * limits), so they render inert here — kept for DOM fidelity.
 *
 * Nothing in this file is interactive beyond the tabs and the "Color by" toggle:
 * the copy-link / download / combobox / settings controls are decorative.
 */

import * as React from "react";
import {
  ChevronsUpDown,
  ImageDown,
  Info,
  Link2,
  Plus,
  SlidersHorizontal,
  Table,
} from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/* -------------------------------------------------------------------------- */
/*                          verbatim class strings                            */
/* -------------------------------------------------------------------------- */

const TABLIST_CLASS =
  "h-9 rounded-lg bg-brand-blue-light p-1 text-neutral-500 relative min-w-full !bg-transparent !p-0 !rounded-none !border-0 !shadow-none !h-auto justify-start inline-flex items-center";

const TAB_TRIGGER_CLASS =
  "justify-center rounded px-3 font-medium ring-offset-background data-[state=active]:bg-background data-[state=active]:text-foreground inline-flex items-center whitespace-nowrap text-sm gap-2 text-neutral-700 data-[state=active]:!text-black z-10 !rounded-none pl-6 pr-6 py-2 !bg-transparent data-[state=active]:!bg-transparent data-[state=active]:!shadow-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

/** Computed: background rgb(231,231,231) (`bg-neutral-100`), border-radius 4px. */
const TAB_INDICATOR_CLASS =
  "absolute bg-neutral-100 pointer-events-none rounded ease-out";

const TAB_PANEL_CLASS =
  "mt-0 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 p-4";

/** 32×32 icon button; shared by the 3 header actions and the settings button. */
const ICON_BUTTON_CLASS =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:w-4 [&_svg]:h-4 [&_svg]:shrink-0 rounded-lg leading-none border border-neutral-100 bg-white text-black hover:border-neutral-700 h-8 w-8";

/** "Color by" radio: h-8 inside the group's p-0.5 ⇒ group height 2 + 32 + 2 = 36. */
const COLOR_BY_RADIO_CLASS =
  "inline-flex items-center justify-center gap-2 font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:w-4 [&_svg]:h-4 [&_svg]:shrink-0 bg-transparent hover:bg-accent hover:text-accent-foreground min-w-9 h-8 rounded border border-neutral-100 px-2 text-xs shadow-none data-[state=on]:bg-background data-[state=on]:text-foreground sm:px-3";

const COMBOBOX_CLASS =
  "inline-flex items-center gap-2 whitespace-nowrap text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:w-4 [&_svg]:h-4 [&_svg]:shrink-0 rounded-lg leading-none border border-neutral-100 bg-brand-blue-light text-black hover:border-neutral-700 h-8 px-3 py-2 w-full justify-between";

/* -------------------------------------------------------------------------- */
/*                                 ChartCard                                  */
/* -------------------------------------------------------------------------- */

/**
 * The trigger's `pl-6 pr-6` is 24px of padding the indicator sits inside, hence
 * the measured ±12: `left = offsetLeft + 12`, `width = offsetWidth − 24`.
 * Cross-check from the spec: tab «Index» `offsetWidth` 84.02 → 84.02 − 24 = 60.02
 * (matches the measured indicator width), and tablist x 261 → indicator x 273
 * (261 + 12 = 273).
 */
const INDICATOR_INSET = 12;

/** Only `left`/`width` are dynamic; the rest is captured verbatim. */
function indicatorStyle(left: number, width: number): React.CSSProperties {
  return {
    left: `${left}px`,
    width: `${width}px`,
    height: "36px",
    top: "0px",
    transitionProperty: "left, width, height, top",
    transitionDuration: "280ms",
    transitionTimingFunction: "cubic-bezier(0.33, 1, 0.68, 1)",
    transform: "translateZ(0px)",
    willChange: "left, width, height, top",
    backfaceVisibility: "hidden",
  };
}

export function ChartCard({
  tabs,
  defaultValue,
  param,
  children,
}: {
  tabs: { value: string; label: string }[];
  defaultValue?: string;
  /**
   * Query-param name this card mirrors its active tab into. Measured on the
   * target: `replaceState` (four tab clicks left `history.length` unchanged),
   * one param per section accumulating independently, and the param is written
   * even when the DEFAULT tab is re-selected.
   */
  param?: string;
  /** Panel body for the active tab. */
  children: (active: string) => React.ReactNode;
}) {
  const [active, setActive] = React.useState(
    defaultValue ?? tabs[0]?.value ?? "",
  );
  const triggerRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const [indicator, setIndicator] = React.useState({ left: 0, width: 0 });

  // Deep-link restore. Post-mount, never during render: the server has no query
  // string, so reading it inline would hydrate-mismatch.
  React.useEffect(() => {
    if (!param) return;
    const wanted = new URLSearchParams(window.location.search).get(param);
    if (wanted && tabs.some((t) => t.value === wanted)) setActive(wanted);
  }, [param, tabs]);

  function selectTab(value: string) {
    setActive(value);
    if (!param) return;
    const url = new URL(window.location.href);
    url.searchParams.set(param, value);
    window.history.replaceState(null, "", url);
  }

  React.useLayoutEffect(() => {
    const node = triggerRefs.current[tabs.findIndex((t) => t.value === active)];
    if (!node) return;
    const left = node.offsetLeft + INDICATOR_INSET;
    const width = node.offsetWidth - INDICATOR_INSET * 2;
    // Preserve identity when unchanged so a fresh `tabs` array each render can't
    // spin this effect into a re-render loop.
    setIndicator((prev) =>
      prev.left === left && prev.width === width ? prev : { left, width },
    );
  }, [active, tabs]);

  return (
    <Tabs
      value={active}
      onValueChange={selectTab}
      className="scroll-mt-24 border border-border rounded-lg"
    >
      {/* h 61 = py-3 (12 + 12) + tablist 36 + border-b 1. */}
      <div className="w-full overflow-x-auto border-b border-border py-3 bg-neutral-50 px-1 light-scrollbar rounded-t-lg">
        <TabsList className={TABLIST_CLASS}>
          {tabs.map((tab, index) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              ref={(node) => {
                triggerRefs.current[index] = node;
              }}
              className={TAB_TRIGGER_CLASS}
            >
              {tab.label}
            </TabsTrigger>
          ))}
          {/* Sliding indicator — must stay the LAST child of the tablist. */}
          <div
            className={TAB_INDICATOR_CLASS}
            style={indicatorStyle(indicator.left, indicator.width)}
          />
        </TabsList>
      </div>
      {/* Radix unmounts inactive panels (no `forceMount`), so exactly one
          `[role=tabpanel][data-state=active]` exists, as measured. */}
      {tabs.map((tab) => (
        <TabsContent
          key={tab.value}
          value={tab.value}
          className={TAB_PANEL_CLASS}
        >
          {tab.value === active ? children(tab.value) : null}
        </TabsContent>
      ))}
    </Tabs>
  );
}

/* -------------------------------------------------------------------------- */
/*                              ChartCardHeader                               */
/* -------------------------------------------------------------------------- */

/** In DOM order; decorative in this clone, so no `onClick`. */
const HEADER_ACTIONS = [
  { label: "Copy link to this section", Icon: Link2 },
  { label: "Download chart as image", Icon: ImageDown },
  { label: "Download data", Icon: Table },
] as const;

const COLOR_BY_OPTIONS = ["Model", "Agent"] as const;

/**
 * The controls row — identical in the tabbed cards and the `p-8` scatter cards.
 * Three measured variants (spec §4 / §4a):
 *
 *   showColorBy   showModelPicker   header height   seen on
 *   true          true              112             `index` and 12 other tabs
 *   false         true               72             the 3 multi-series tabs
 *   false         false              72             all 4 `harness-comparison` tabs
 *
 * The 112 → 72 delta is exactly the "Color by" toggle plus its `lg:flex-col`
 * wrapper. The third variant is also 72, but driven by the *left* column instead
 * (h3 28 + gap 4 + caption `min-h-[2.5rem]` 40), since its right column is only
 * the 32px icon-button row. Caption is 12px/16px rgb(148,148,148)
 * (`text-neutral-500`; `--neutral-500: 0 0% 58%` → 0.58 × 255 = 147.9 ≈ 148).
 */
export function ChartCardHeader({
  title,
  caption,
  showColorBy = true,
  showModelPicker = true,
  modelCount = "21 of 21 models",
}: {
  title: string;
  caption: React.ReactNode;
  showColorBy?: boolean;
  showModelPicker?: boolean;
  modelCount?: string;
}) {
  const [colorBy, setColorBy] =
    React.useState<(typeof COLOR_BY_OPTIONS)[number]>("Model");

  /* Combobox + settings — both non-functional in this clone. Identical markup in
     both variants, so it is hoisted rather than duplicated. */
  const comboboxRow = (
    <div className="flex gap-1">
      <div className="w-auto min-w-[11rem] sm:w-[280px]">
        {/*
          `role=combobox` is what the target ships, so it is kept. The
          role also wants `aria-controls`, but there is no listbox in
          this clone to point it at and a dangling idref is worse than
          none — hence one standing `jsx-a11y/role-has-required-aria-props`
          warning here (warning only, not an error).
        */}
        <button
          type="button"
          role="combobox"
          aria-expanded={false}
          data-state="closed"
          className={COMBOBOX_CLASS}
        >
          <span className="truncate">{modelCount}</span>
          <ChevronsUpDown className="h-4 w-4" />
        </button>
      </div>
      <button
        type="button"
        aria-label="Open chart display settings"
        className={ICON_BUTTON_CLASS + " relative"}
      >
        <SlidersHorizontal className="w-4 h-4" />
        <span className="absolute -top-1.5 -right-1.5 rounded-full bg-brand-purple-dark px-[4px] py-[3px] text-[7px] leading-none text-white">
          NEW
        </span>
      </button>
    </div>
  );

  return (
    <div className="grid grid-cols-12 gap-6 xl:gap-12">
      <div className="col-span-12 sm:col-span-7 xl:col-span-8 flex flex-col gap-1">
        {/* 20px/28px weight 400. */}
        <h3 className="text-xl font-brand-serif">
          <span>{title}</span>
        </h3>
        <div className="text-xs text-neutral-500 inline-flex items-baseline gap-0 max-w-[60ch]">
          <span style={{ textWrap: "pretty" }}>
            <span className="block min-h-[2.5rem]">{caption}</span>
          </span>
        </div>
      </div>

      <div className="col-span-12 sm:col-span-5 xl:col-span-4 flex flex-col gap-2">
        <div className="flex items-center justify-end gap-1 hide-during-screenshot">
          {HEADER_ACTIONS.map(({ label, Icon }) => (
            <button
              key={label}
              type="button"
              aria-label={label}
              className={ICON_BUTTON_CLASS}
            >
              <Icon />
            </button>
          ))}
        </div>

        {/* Measured on all 4 harness-comparison tabs: this whole row is absent
            from the DOM (comboboxCount 0), not merely hidden. */}
        {showModelPicker && (
          <div className="flex flex-wrap justify-end gap-1 hide-during-screenshot">
            {showColorBy ? (
              <div className="flex items-center justify-end gap-1 lg:flex-col lg:items-end lg:gap-2 lg:-mt-1">
                {/* "Color by" toggle — local state only; it does not drive the chart. */}
                <div className="flex items-center gap-1">
                  <span className="hidden whitespace-nowrap text-xs text-neutral-600 sm:inline">
                    Color by
                  </span>
                  <div
                    role="group"
                    style={{ outline: "none" }}
                    className="flex items-center justify-center gap-1 rounded bg-brand-blue-light p-0.5"
                  >
                    {COLOR_BY_OPTIONS.map((option) => (
                      <button
                        key={option}
                        type="button"
                        role="radio"
                        aria-checked={colorBy === option}
                        data-state={colorBy === option ? "on" : "off"}
                        onClick={() => setColorBy(option)}
                        className={COLOR_BY_RADIO_CLASS}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>

                {comboboxRow}
              </div>
            ) : (
              /* Measured on `benchmark-score-by-eval`: the `lg:flex-col` wrapper
                 and the «Color by» span + `div[role=group]` are gone entirely,
                 leaving the combobox + settings pair as the row's only child (box
                 1072,1455,316,32 ⇒ header height 72 instead of 112). */
              comboboxRow
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                              MetricAccordion                               */
/* -------------------------------------------------------------------------- */

/**
 * Single-item accordion, closed by default. Children are `<p>` elements supplied
 * by the call site (12px/16px via the `text-xs` wrapper).
 */
export function MetricAccordion({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Accordion type="single" collapsible className="w-full text-sm">
      <AccordionItem value="x" className="border-none">
        <AccordionTrigger>
          <div className="flex items-center gap-1">
            <Info className="h-3 w-3 shrink-0" />
            <span>{title}</span>
          </div>
          {/* Direct `svg` child: the trigger's `[&[data-state=open]>svg]:rotate-45`
              turns this Plus into an ×. Do not add rotation here. */}
          <Plus className="h-4 w-4 shrink-0 transition-transform duration-200 text-neutral-600" />
        </AccordionTrigger>
        <AccordionContent>
          <div className="pt-0 hide-during-screenshot text-xs [&_a]:underline pb-2">
            <div className="space-y-2">{children}</div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
