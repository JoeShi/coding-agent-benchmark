# Component spec — Hero Section

**Target file:** `app/site/src/components/hero-section.tsx`
**Export:** `export function HeroSection()`
**Directive:** `"use client"` (the aside card has one Radix tooltip).

All CSS below is `getComputedStyle()` output at viewport **1440**. Do not estimate.
**Mobile/responsive is out of scope for this clone** — only 1440 must be correct. Still copy the
responsive class names verbatim where listed (they cost nothing and keep the markup auditable),
but do not invent or verify any breakpoint behaviour.

## INTERACTION MODEL

Essentially **static**. Three things move:
1. Link hover — the intro prose wrapper carries `[&_a]:underline [&_a:hover]:text-brand-purple [&_a]:transition-colors`.
2. One Radix **tooltip** on a dotted-underline span in the aside card.
3. The category tab row's underline indicator is positioned by JS but its computed
   `transition` is `left ease-out, width ease-out` — i.e. **duration 0s, no animation**. Each tab is
   a real page link, so the indicator is effectively static under the active tab. Compute it once in
   a `useLayoutEffect`; do **not** add hover/click handlers.

## Structure

```
section.bg-brand-blue-light.pt-32.pb-0                          box [0,0,1425,608]
└── div.container                                               [0,128,1425,480]
    ├── div.grid.grid-cols-12.gap-4.mb-10                       [20,128,1385,404]
    │   ├── div.col-span-12.lg:col-span-9.lg:pr-24              [20,128,1035,404]
    │   │   ├── h1.text-4xl.mb-4.max-w-[36ch].lg:max-w-[40ch]   [20,128,863,40]
    │   │   └── div (intro prose, classes below)                [20,184,666,96]
    │   └── div.col-span-12.lg:col-span-3                       [1071,128,334,404]
    │       └── div.flex.flex-col.gap-5                         (gap 20px)
    │           ├── div.flex.justify-end.overflow-x-auto        [1071,128,334,36]
    │           └── div (index card, classes below)             [1071,184,334,348]
    └── div.flex.min-w-0.overflow-x-auto                        [20,572,1385,36]
```

Section computed: `background rgb(241,242,244)` (= `bg-brand-blue-light`), `padding: 128px 0 0`, height 608.
Grid computed: 12 equal `100.75px` columns, `gap 16px`, `margin-bottom 40px`.

## Left column

**h1** — text verbatim: `Artificial Analysis Coding Agent Benchmarks`
Computed: `font-size 36px`, `line-height 40px`, `font-weight 400`, `color rgb(0,0,0)`,
`margin-bottom 16px`, `max-width 863.438px`, family `victorSerifBasic…serif`.
The serif family and weight come from the **global `h1,h2` base rule already in `globals.css`** —
do not add `font-brand-serif`; `text-4xl mb-4 max-w-[36ch] lg:max-w-[40ch]` is the complete class list.

**Intro prose** — wrapper classes verbatim:
`text-sm space-y-4 [&_a]:underline [&_a:hover]:text-brand-purple [&_a]:transition-colors max-w-[72ch]`
Computed: `font-size 14px`, `line-height 20px`, `max-width 665.93px`, `color rgb(0,0,0)`.
Two `<p>` children, text verbatim:
1. `We measure real-world performance of coding agents on software engineering tasks, including cost, token usage, and execution time. We compare how performance changes across agents, models, and execution settings.`
2. `To compare language models see our ` + `<a className="underline underline-offset-2" href="/models">model benchmarks</a>` + `.`

## Right column — page subnav

`div.flex.justify-end.overflow-x-auto` → one `nav`:
`nav[aria-label="Coding agents pages"]` classes verbatim:
`bg-neutral-100 rounded-lg p-1 gap-1 h-9 inline-flex flex-wrap`
Computed: `bg rgb(231,231,231)`, `border-radius 8px`, `padding 4px`, `gap 4px`, height 36, width 304.41, right-aligned (x 1100.59).

Three `<a>` children. Declare the shared base once:
```ts
const SUBNAV_BASE =
  "inline-flex items-center justify-center whitespace-nowrap transition-colors " +
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring " +
  "disabled:pointer-events-none disabled:opacity-50 " +
  "[&_svg]:pointer-events-none [&_svg]:shrink-0 h-7 p-2 text-xs rounded-md " +
  "[&_svg]:w-3 [&_svg]:h-3 gap-1";
```
- **active** item adds: `bg-black text-white hover:bg-neutral-700`
- **inactive** items add: `hover:no-underline hover:bg-neutral-200`

| label | href | lucide icon | width |
|---|---|---|---|
| `Benchmarks` (**active**) | `/agents/coding-agents` | `ChartNoAxesColumnIncreasing` | 101.63 |
| `Comparisons` | `/agents/coding-agents/comparisons` | `Columns2` | 106.32 |
| `Features` | `/agents/coding` | `Code` | 80.47 |

Icon element order is **icon then label**. Render icons bare (`<Code />`) — sizing comes from the
`[&_svg]:w-3 [&_svg]:h-3` arbitrary variants. The two non-active hrefs have no page in this clone; keep
them verbatim anyway.

## Right column — index card

`div.bg-background.p-4.text-xs.text-neutral-700.space-y-3`
Computed: `bg rgb(255,255,255)`, `padding 16px`, `font-size 12px`, `line-height 16px`,
`color rgb(77,77,77)`, `border-radius 0`, `box-shadow none`. Children in order:

1. `<h2 className="text-lg">Artificial Analysis Coding Agent Index</h2>` — computed 18px/28px, weight 400,
   `color rgb(77,77,77)` (inherited), serif via the global base rule.
2. `<p>Composite index of 3 benchmarks:</p>`
3. `<ul className="list-disc pl-4 space-y-2">` — `list-style-type: disc`, `padding-left 16px`. Three `<li>`,
   each with exactly three children: a `<span>` name, a `<div className="text-neutral-400 mt-0.5">` sub-line
   (`color rgb(163,163,163)`, `margin-top 2px`), and a `<div className="mt-0.5">` holding
   `<a className="text-neutral-500 underline underline-offset-2" href=… >` (`color rgb(148,148,148)`).

   | name | sub-line | source link |
   |---|---|---|
   | `DeepSWE` | `Software engineering tasks, 113 tasks` | `By Datacurve` → `https://deepswe.datacurve.ai/` |
   | `Terminal-Bench v2` | `Agentic terminal use, 84 tasks` **(tooltip, see below)** | `By Laude Institute` → `https://www.tbench.ai/benchmarks/terminal-bench-2` |
   | `SWE-Atlas-QnA` | `Technical Q&A, 124 tasks` | `By Scale AI` → `https://labs.scale.com/leaderboard/sweatlas-qna` |

   Row 2's sub-line text is wrapped in a tooltip trigger `span` with classes verbatim
   `cursor-help decoration-dotted underline underline-offset-2` (computed `text-decoration: underline dotted`,
   `cursor: help`). Use the existing `@/components/ui/tooltip` primitive:
   ```tsx
   <TooltipProvider>
     <Tooltip>
       <TooltipTrigger asChild>
         <span className="cursor-help decoration-dotted underline underline-offset-2">
           Agentic terminal use, 84 tasks
         </span>
       </TooltipTrigger>
       <TooltipContent className="max-w-xs">
         84 of 89 tasks; 5 excluded for environment compatibility.
       </TooltipContent>
     </Tooltip>
   </TooltipProvider>
   ```
   Tooltip body text and the extra `max-w-xs` class are both verbatim from the target.
4. A final `<p>`: `Each benchmark score averages pass@1 across three attempts per task. The Index gives equal weight to its 3 benchmark components.` then a space, then
   `<a className="underline underline-offset-2" href="/methodology/coding-agents-benchmarking">See methodology for scoring details and version history.</a>`

## Category tab row

Nesting is redundant in the target but copy it verbatim — the widths depend on it:
```
div.flex.min-w-0.overflow-x-auto                                     [20,572,1385,36]
└── div.flex.items-center.gap-4.min-w-0                              [20,572,959.78,36]
    └── div.min-w-0.flex.overflow-x-auto
        └── div
            └── div.overflow-x-auto.w-full
                └── div[role="tablist"] (classes below)              [20,572,959.78,36]
```
Tablist classes verbatim: `snap-x relative inline-flex w-full items-center justify-start rounded-none bg-transparent p-0`
Computed: `display inline-flex`, `padding 0`, `background transparent`, height 36.

Seven `button[role="tab"]`, classes verbatim (identical on every tab):
```
snap-center relative inline-flex flex-1 items-center justify-center whitespace-nowrap
rounded-none !bg-transparent px-4 py-2 text-sm text-neutral-500 shadow-none transition-colors
disabled:pointer-events-none disabled:opacity-50 data-[state=active]:text-foreground
[&[data-state=active]_svg]:text-foreground min-w-0 lg:flex-none
```
Set `data-state="active"` on tab 0 and `data-state="inactive"` on the rest (the styling hooks off it).
Each button contains exactly `<a className="inline-flex items-center gap-2" href={href}><Icon className="flex-none" />{label}</a>`.
Icons are lucide, rendered at 16×16 (`width="16" height="16"` on the target — pass `size={16}` or rely on the default 24 being overridden; the target emits 16, so pass `size={16}`).

| # | label | href | lucide icon | width |
|---|---|---|---|---|
| 0 | `Coding Agents` **(active)** | `/agents/coding-agents` | `Code` | 151.92 |
| 1 | `General Work` | `/agents` | `Briefcase` | 143.02 |
| 2 | `Chatbots` | `/agents/chatbots` | `Bot` | 115.35 |
| 3 | `Presentations` | `/agents/presentations` | `Presentation` | 145.35 |
| 4 | `OCR` | `/agents/ocr` | `ScanText` | 86.74 |
| 5 | `Data Analysis` | `/agents/data` | `Database` | 142.44 |
| 6 | `Customer Support` | `/agents/customer-support` | `Headset` | 174.96 |

**Underline indicator** — the tablist's last child:
`div.absolute.pointer-events-none.border-b.border-black.bottom-0`
Inline style on the target, verbatim:
`left: 10px; width: 132px; transition: left ease-out, width ease-out; transform: translateZ(0px); will-change: transform, width, left; backface-visibility: hidden;`
Measured box `[30,607,132,1]` with the tablist at x 20 and tab 0 at `[20,572,151.92,36]` — i.e.
**`left = activeTab.offsetLeft + 10`, `width = activeTab.offsetWidth − 20`**. Derive it in a
`useLayoutEffect` from a ref on the active button (so the 20px inset survives any font-metric drift)
rather than hard-coding 10/132. Keep the `transition` string verbatim even though its duration is 0s.

## Acceptance

- `npx tsc --noEmit` passes.
- Create **only** `app/site/src/components/hero-section.tsx`. Do not touch any other file.
- At 1440: section is 608px tall with a `rgb(241,242,244)` background; h1 baseline block at y=128;
  index card at x≈1071 y=184, 334×348 on white; tab row at y=572 with a 1px black underline spanning
  x 30→162 under `Coding Agents`.
- Hovering the dotted `Agentic terminal use, 84 tasks` text shows the tooltip after the default delay.
