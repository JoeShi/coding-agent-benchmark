# Component spec: `RunSpecsSection` + `FaqSection`

The two blocks that sit in the last `div.container` of `<main>`, after the main
5-section grid. Measured collapsed height 840 (`y 7714`); Run Specifications
expands to a 2848px-tall table.

## Files to create (create ONLY these)

| file | exports |
|---|---|
| `src/components/run-specs-section.tsx` | `RunSpecsSection` |
| `src/components/faq-section.tsx` | `FaqSection`, `FAQ_ITEMS` |

Both `"use client"` (both hold open/closed state).

> Read `app/site/AGENTS.md` first — Next 16 / Tailwind v4 / recharts 2.15.4.
> Tailwind v4 preflight defaults `border-color` to `currentColor`, so **every**
> measured `1px solid rgb(217,217,217)` border must be written with an explicit
> colour: `border-b border-border`, `border-b border-border`, etc. A bare
> `border-b` renders BLACK. (This is the one trap that has bitten every builder
> on this clone.)

Reuse `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent` from
`@/components/ui/accordion` — **read that file, do not edit it.** It is a thin
Radix wrapper with no default classes, so pass the full verbatim class strings
below. Do **not** route them through `cn()`/`twMerge` (it silently drops classes
the target ships); use plain string concatenation.

---

## 1. `RunSpecsSection`

```tsx
export function RunSpecsSection(): React.ReactElement
```

A **self-collapsing** block — NOT a Radix accordion on the target: it is a plain
`<button aria-expanded>` + conditional content, with `data-state="open"|"closed"`
mirrored onto both. Closed by default.

```
div.mt-6                                              data-state={state}
├── button[type=button][aria-expanded][data-state]
│   .mb-4.flex.w-full.cursor-pointer.items-center.justify-between.border-b.border-border.py-2
│   ├── h2#run-specs                                   «Run Specifications»
│   └── <Plus className={"lucide text-neutral-500 transition-transform duration-200" + (open ? " rotate-45" : "")} size={16} />
└── {open && (
      div                                              data-state="open"
      └── div.w-full.overflow-x-auto
          └── table.min-w-full
    )}
```

Measured: button `padding 8px 0`, `margin 0 0 16px`,
`border-bottom 1px solid rgb(217,217,217)`, transparent bg, 16px/24px w400.
`h2#run-specs` is 30px/36px w400 serif with `margin 0` — the global `h2` rule in
`globals.css` supplies family/size, so add **no** font utilities.
The `Plus` is lucide, 16×16, `stroke-width 2`, class
`text-neutral-500 transition-transform duration-200` plus `rotate-45` when open
(that is what turns it into an ×). Do not add your own rotation logic beyond that
conditional class.

Take the collapsed/expanded state in `useState(false)`.

### The table

```
thead.bg-muted            (h 40, one <tr> with no className)
tbody.bg-background       (one <tr> per row, each h 54)
```

`<th>` className — first column only adds `pl-6`:
```
p-3 text-xs font-medium text-muted-foreground pl-6 text-left     ← col 1
p-3 text-xs font-medium text-muted-foreground text-left          ← cols 2..7
```
Computed th: 12px/16px w500 `rgb(120,120,120)`, `padding 12px 12px 12px 24px`
(col 1) / `12px` (rest), height 40.

Headers in order: `Agent Name`, `Model Name`, `Provider`, `Coverage`,
`DeepSWE`, `Terminal-Bench v2`, `SWE-Atlas-QnA`.

`<tr>` className (tbody): `even:bg-muted/50 hover:bg-muted`
(computed: odd rows transparent, even rows `rgba(245,245,245,0.5)`).

`<td>` classNames, per column, verbatim:
```
1 Agent Name   px-3 py-2 text-sm whitespace-nowrap pl-6 text-left font-medium
2 Model Name   px-3 py-2 text-sm whitespace-nowrap text-left
3 Provider     px-3 py-2 text-sm whitespace-nowrap text-left capitalize
4 Coverage     px-3 py-2 text-sm whitespace-nowrap text-left
5,6,7 (bench)  px-3 py-2 text-center text-sm
```
Computed td: 14px/20px w500 `rgb(0,0,0)`, `padding 8px 12px 8px 24px` (col 1),
`whiteSpace nowrap`, row height 54.

Each of the three benchmark cells wraps its content verbatim:
```tsx
<div className="min-w-40 whitespace-nowrap text-left">
  <div>{version}</div>
  <div className="mt-0.5 text-xs text-neutral-500">{`Released ${released}`}</div>
</div>
```

### Rows — our data, not AA's

Build rows from `getRows("official")` in `@/lib/leaderboard` (read it, do not
edit it), sorted **by `agent` then `model`, both ascending** — that is the
target's order (`Claude Code / DeepSeek V4 Pro (high)` first). 21 rows.

| column | value |
|---|---|
| Agent Name | `row.agent` |
| Model Name | `row.model` |
| Provider | `row.creator` |
| Coverage | `"3/3"` (every row in our data has all three benchmarks) |
| DeepSWE / Terminal-Bench v2 / SWE-Atlas-QnA | see below |

For the version cells: our run has no per-benchmark agent version. For the 6
**Kiro** rows (`row.creator === "Kiro"`) emit version `"2.15.4"` and released
`"Unknown"`. For the 15 AA-snapshot rows emit version `"—"` and released
`"Unknown"`. The target itself ships `Released Unknown` for several rows, so this
is in-distribution and needs no new UI.

Keep the values in a tiny local helper inside this file — do **not** add fields
to `leaderboard.ts` or `leaderboard.json`.

---

## 2. `FaqSection`

```tsx
export function FaqSection(): React.ReactElement
export const FAQ_ITEMS: { q: string; a: React.ReactNode }[]
```

```
section.mt-16
├── div.w-full.border-b.border-border.pb-3.mb-6.space-y-2
│   └── h2                                             «Frequently Asked Questions»
└── div.w-full.max-w-2xl.mx-auto                       (672 wide, centred)
    └── <Accordion type="single" collapsible>          ← 10 items, all closed by default
        └── <AccordionItem value={`faq-${i}`}>         (no className)
            ├── <AccordionTrigger>{q}</AccordionTrigger>
            └── <AccordionContent>
                └── div.pb-4.pt-0 > p.text-neutral-700  {a}
```

Header computed: `border-bottom 1px solid rgb(217,217,217)`,
`padding 0 0 12px`, `margin 0 0 24px`. `h2` has **no className** — 30px/36px w400
serif from the global rule.

`AccordionItem` has **no** className here (unlike `MetricAccordion`, which uses
`border-none`). Radix renders the trigger inside `h3.flex`.

Trigger className, verbatim:
```
flex flex-1 items-center justify-between py-4 transition-all [&[data-state=open]>svg]:rotate-45 text-left font-medium text-base border-b border-border pb-2 mb-4 hover:no-underline
```
Computed: 16px/24px w500 `rgb(0,0,0)`, `padding 16px 0 8px`,
`border-bottom 1px solid rgb(217,217,217)`, closed item height 65 (trigger 49).
Its icon is the Radix `Plus` glyph at `h-4 w-4 shrink-0 transition-transform duration-200 text-neutral-600`
— use lucide `Plus` with exactly that className and let the
`[&[data-state=open]>svg]:rotate-45` on the trigger turn it into an ×. **The
`Plus` must be a direct child of the trigger `<button>`** or that selector will
not match.

Content className: whatever `AccordionContent` already applies (it is
`overflow-hidden transition-all duration-300 text-sm` + the max-h pair — matches
the target exactly). Inner wrapper `div.pb-4.pt-0`, paragraph
`p.text-neutral-700` (14px/20px `rgb(77,77,77)` w400).

### The 10 questions, verbatim

1. **What is the Artificial Analysis Coding Agent Index?**
   The Artificial Analysis Coding Agent Index is our composite score for coding-agent performance across the public benchmark suite on this page. It combines DeepSWE, Terminal-Bench v2, and SWE-Atlas-QnA to capture implementation, terminal workflow, repository-understanding, and broader software-engineering performance in a single headline metric.

2. **Which benchmarks are included in the index right now?**
   The current public index includes DeepSWE, Terminal-Bench v2, and SWE-Atlas-QnA. These benchmarks are combined because they stress different parts of the coding-agent workflow rather than repeating the same task format.

3. **What kinds of tasks are these benchmarks actually testing?**
   The public benchmark suite mixes several software engineering task styles. Some tasks are Q&A and repository-understanding tasks that focus on reading a codebase, understanding architecture or behavior, and producing a correct technical answer. Some are implementation and bug-fix tasks that require code changes and are closer to the classic make-a-patch-that-works framing. Some are terminal workflow tasks that test whether the agent can navigate a shell-driven environment, execute tools correctly, and complete a multi-step command-line workflow. All three current benchmarks use binary task outcomes.

4. **How do Q&A-style tasks differ from implementation-style tasks?**
   Q&A-style tasks emphasize repository understanding, code reading, tracing behavior, and producing a correct technical explanation. Implementation-style tasks are closer to shipping a working change: the agent has to understand the task, navigate the repository, edit files correctly, and satisfy an evaluator or test-based outcome under execution constraints. Those are related capabilities, but they are not identical. An agent can be strong at repository reasoning and still be weaker at reliable patch execution, or vice versa, which is one reason the composite index should be interpreted alongside the per-benchmark chart.

5. **How are agents scored on each benchmark?**
   The benchmark page reports task-normalized average pass@1. For each benchmark, we first average the three evaluated attempts for each task, then average those task-level scores so every task has equal weight. All current component outcomes are binary. An attempt can complete cleanly and still score zero when it does not satisfy its verifier. SWE-Atlas-QnA binary pass/fail scoring is aligned with Scale AI's Task Resolve Rate methodology.

6. **How is the overall index weighted?**
   The index is computed from DeepSWE, Terminal-Bench v2, and SWE-Atlas-QnA. For the current Artificial Analysis Coding Agent Index, the public methodology is a simple average across those benchmark scores. Benchmark methodology can evolve as coverage improves, so comparability is best interpreted within the published benchmark suite and its current component set rather than as a timeless absolute score.

7. **What does execution time mean?**
   Execution time on this page refers to average wall-clock task runtime per task, not just raw model latency. It is meant to reflect the user-facing time cost of running the whole agent workflow. That includes time spent reasoning, issuing tool calls, reading and writing files, executing shell steps, and waiting on model responses. So an agent can have a fast underlying model and still be slower overall if its workflow is longer or more tool-heavy.

8. **What does token usage mean, and why does it matter?**
   Token usage is the average observed token consumption per task across the benchmark suite. On this page we break it out into input, cache, and output tokens. Input tokens are the tokens sent into the model, including prompts, instructions, tool context, and task context. Cache tokens are prompt tokens reused through prompt caching when the provider exposes that telemetry. Output tokens are tokens generated by the model in its response. Token usage matters because it often drives cost and can also indicate how much context an agent consumes to get work done, but token efficiency and cost are not identical because providers price token categories differently and caching can materially change the bill.

9. **Why can a higher-index agent still be worse for my use case?**
   A higher index score means stronger performance across the included benchmark mix, but it does not mean the agent is best for every workflow. The index is a balance across benchmark quality, not a direct measure of your specific latency, cost, tooling, or task-type priorities. Real-world choice still depends on whether your workflow looks more like repository Q&A, patching, or terminal execution, and on practical constraints such as IDE integration, model availability, and reliability.

10. **How realistic are these tasks, and what setup was used for each agent?**
    These benchmarks measure coding-agent performance across repositories, tools, multi-step workflows, and evaluator-based outcomes. Results on this page reflect specific evaluated agent variants, not just generic product names: model choice, settings, and execution configuration can materially change outcomes, which is why a single agent family may appear in multiple variants in the results. For more background on benchmark runs, task-level scoring, and methodology, see the coding-agents benchmarking methodology page.
    Then a space and a link, verbatim:
    ```tsx
    <a className="underline hover:text-foreground" href="/methodology/coding-agents-benchmarking">View the coding-agents benchmarking methodology</a>
    ```
    (The target emits `{" "}` between the prose and the anchor — keep that space.)

Item 10's answer must therefore be a `React.ReactNode`, hence the `FAQ_ITEMS`
type above. Export `FAQ_ITEMS` so the page can also emit the JSON-LD later; do
not emit JSON-LD yourself.

## Constraints

- Create only the two files listed.
- Do not touch `globals.css`, `page.tsx`, `layout.tsx`, `icons.tsx`,
  `leaderboard.ts`, `ui/accordion.tsx`, or any existing component.
- Do not create any route files.
- Run `npx tsc --noEmit` from `app/site` and report the result.
