# Page Topology — artificialanalysis.ai/agents/coding-agents

Extraction basis: Chrome DevTools MCP, `emulate` viewport `1440x900x2`.
**`document.documentElement.clientWidth = 1425`** — every px value in these docs is
measured against a 1425px content width (1440 minus scrollbar). Do not re-derive
against 1440.

Full-page reference: `docs/design-references/aa-desktop-1440-full.png`
(2850×18780 @2x = 1425×9390 CSS px).

## Stack detected on target

| Aspect | Finding |
|---|---|
| Framework | Next.js (App Router) |
| CSS | Tailwind (v3-era shadcn conventions) |
| Design tokens | HSL **triplets** in CSS vars, consumed as `hsl(var(--token))` |
| Charts | **Recharts** — proven by `span#recharts_measurement_span` in DOM |
| Smooth scroll lib | **None.** No Lenis, no Locomotive. Native `html{scroll-behavior:smooth}` |
| Fonts | `suisseIntl` (sans), `victorSerifBasic` (serif); self-hosted woff2; fallback Arial |

Clone stack deliberately differs: Next 16.2.12 + **Tailwind v4**, so the v3-style HSL
triplet tokens must be bridged into `@theme inline` (see FOUNDATION notes in
`docs/research/BEHAVIORS.md`).

## Layer model

Three stacking layers, outermost first:

1. **Floating nav** — `sticky top-6 -mb-9`, dark pill, horizontally centered.
   The negative bottom margin is what lets page content slide *under* it.
2. **Floating share button** — fixed, bottom-right.
3. **Flow content** — single scroll column, no scroll-snap, no parallax.

The content column measures **6427px** tall (below hero, above footer) and is
paired with a **sticky sidebar** (`sticky top-24`).

## Section order (top → bottom)

| # | Working name | Anchor id | Notes |
|---|---|---|---|
| 1 | Floating nav | — | constant; **zero** scroll-state change (verified) |
| 2 | Hero | — | copy block + index summary card + tab row |
| 3 | Highlights | — | 3 cards |
| 4 | Coding Agents Index | `#coding-agents-index` | primary chart section |
| 5 | Harness Comparison | `#harness-comparison` | |
| 6 | Token Usage | `#token-usage` | |
| 7 | Cost to Run | `#cost-to-run` | |
| 8 | Execution Time | `#execution-time` | |
| 9 | Run Specifications | — | spec/detail block |
| 10 | FAQ | — | accordion |
| 11 | Footer | — | |

Sections 4–8 are the five scroll-spy targets. Each carries `scroll-mt-24` to clear
the sticky nav on anchor jump.

## Interaction model of the main content area

**Sticky scroll-spy — NOT tabs.** This is the single most important finding; building
it as a click-to-switch tab set would be a full rewrite, not a CSS tweak.

Evidence:
- Sidebar items are `<a href="#…">`, not buttons.
- Active item carries `aria-current="location"`.
- Sidebar container is `sticky top-24`; every target `<section>` has `scroll-mt-24`.
- `html { scroll-behavior: smooth }`.
- Active state sampled at `scrollY` 0 / 679 / 2112 / 3887 → advanced through the five
  anchors on its own, with no clicks issued.

All five sections are **always mounted and always visible**; the sidebar only reflects
which one the viewport is currently over.

## Data binding for the clone

Per user decision: **AA appearance, Kiro data.** Charts render
`app/web/public/data/leaderboard.json`, not AA's own numbers.

Shape (see `docs/research/BEHAVIORS.md` for the mode semantics):

```
{ title, run_id, generated_at, methodology_version,
  benchmarks: [{id,label,tasks}]                     // deep-swe 113, terminal-bench-2, swe-atlas-qna
  kiro: [ 6 × { id, agent:'Kiro CLI', model, label, creator:'Kiro',
                official:{index, benchmarks:{…}},
                normalized:{index, benchmarks:{…}},
                cost_usd, time_seconds,
                cost_coverage, time_coverage, n_trials } ],
  artificial_analysis: { source, retrieved_at, methodology_version, scope,
                         models: [ 15 × { id, agent, model, creator, label,
                                          index, benchmarks:{…},
                                          cost_usd, time_seconds } ] },
  notes: { official, normalized, cost, telemetry } }
```

21 series total (6 Kiro + 15 AA snapshot). Kiro rows are the highlighted/branded ones.
