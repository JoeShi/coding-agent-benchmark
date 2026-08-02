# Behaviors — artificialanalysis.ai/agents/coding-agents

Behavior bible for the clone. Every component spec must be checked against this file.
Measurement basis: `1440x900x2` emulation, `clientWidth = 1425`.

## Global

| Behavior | Finding |
|---|---|
| Smooth scroll | Native `html { scroll-behavior: smooth }`. **No** Lenis / Locomotive / custom scroll container. |
| Scroll snap | None anywhere. |
| Parallax | None. |
| Page-level theme shift | None — single light theme throughout. |
| Custom scrollbar | Not applied to the page body. |

## Floating nav — verified NON-reactive

Positioned `sticky top-6 -mb-9`, dark pill, horizontally centered. The `-mb-9`
negative margin pulls following content up so it scrolls *beneath* the pill.

Sampled computed styles at **scrollY 0, 679, 2112, 3887**. Result: **no change** to
any of `background-color`, `box-shadow`, `backdrop-filter`, `height`, `padding`,
`transform`, `opacity`.

> Do **not** build a scroll-triggered nav state. There isn't one. This was explicitly
> probed because it is the most commonly-assumed phantom behavior on this kind of page.

## Sticky scroll-spy (sections 4–8)

**INTERACTION MODEL: scroll-driven anchor spy.** Not tabs, not clicks.

Mechanism:
- Sidebar: `sticky top-24`, items are `<a href="#…">`.
- Active item: `aria-current="location"`.
- Targets: each `<section id="…">` has `scroll-mt-24`.
- Navigation: native smooth scroll via anchor href.

Anchors in order: `#coding-agents-index`, `#harness-comparison`, `#token-usage`,
`#cost-to-run`, `#execution-time`.

Content column height below hero / above footer: **6427px**.

All five sections stay mounted and visible simultaneously. Clicking a sidebar item
smooth-scrolls; it does not swap content.

**Clone implementation:** `IntersectionObserver` to drive the `aria-current` state,
plus plain `<a href="#…">` for navigation. Do not intercept the click.

## Hero tab row

The hero contains a tab row (Radix Tabs is installed for this). Tabs here **do** swap
visible content — this is the one genuinely click-driven region.

> Per Guiding Principle 7, each tab must be clicked and its content extracted
> separately before the hero builder is dispatched. Record per-tab card data and the
> transition (opacity/fade) in the hero spec file.

## Scoring-mode control (clone-specific, data-driven)

`leaderboard.json` ships two parallel score sets per Kiro model:

- `official` — AA-faithful: failed **and** errored attempts score 0.
- `normalized` — sensitivity analysis, excludes errored attempts. Kiro rows only.
  Tasks with no valid attempts drop out of that benchmark average.

The old imitation (`app/web/src/LeaderboardPage.jsx`) exposed this as a two-button
toggle with `mode` state. Preserve that capability in the clone, and keep the
`notes.official` / `notes.normalized` caption swap. `normalized` must never be
presented as the headline leaderboard number.

## Responsive — sweep complete

Measured at 1440 (`clientWidth` 1425), 768 (`753`), 390 (`390`).

Two breakpoints matter, and they are **different from each other**:

| Breakpoint | What changes |
|---|---|
| **`lg` = 1024px** | scroll-spy sidebar appears; card grid 1 col → 3 cols |
| **`xl` = 1280px** | dark nav pill replaces the compact mobile bar |

So between 1024 and 1280 the page shows the sidebar **and** the mobile bar together.

### Nav — two separate DOM subtrees, not one responsive element

Both live inside the same sticky wrapper `div.z-50.w-full.sticky.top-6.-mb-9`:

- `div.container.hidden.xl:block` → desktop dark pill (**≥1280 only**)
- `div.container.xl:hidden` → compact bar (**<1280**)

The compact bar at 390 is `flex items-center justify-between gap-2`, height **36px**,
transparent background, containing:

| Control | Box @390 |
|---|---|
| `a[aria-label="Log in"]` "Log in" | x 227, y 24, 63×36 |
| `button` "K" | x 294, y 24, 36×36 |
| `button` (icon, no label — menu) | x 334, y 24, 36×36 |

Left group is `div.min-w-0.flex.items-center.gap-1` (229px wide, holds the brand).

`.container` = `padding: 0 20px`, `max-width: none`.

### Sidebar

Holder is `div.hidden.lg:block.col-span-2` → `display:none` below 1024px. There is
**no** mobile drawer or accordion replacement; it simply vanishes.

### Card grid

`div.grid.gap-4.sm:grid-cols-1.lg:grid-cols-3`, `gap: 16px`, 3 children.

| Width | Columns | Grid width |
|---|---|---|
| 390 | 1 (`350px`) | 350 |
| 753 | 1 (`713px`) | 713 |
| 1425 | 3 | — |

> Each card's `<h3 class="text-2xl font-brand-serif font-medium">` **contains the section
> anchor link** (`a[href="#coding-agents-index"]` etc.). These card headings are a second
> set of anchor links, distinct from the sidebar spy items — don't conflate them.

### Page heights
| Width | `scrollHeight` |
|---|---|
| 390 | 11716 |
| 1425 | ~9390 (content grid 6427) |

## Formatters (carry over from the existing imitation)

```js
formatIndex = v => Math.round(v * 100)          // 0.3653… → 37
formatCost  = v => `$${v.toFixed(2)}`
formatTime  = v => `${(v / 60).toFixed(1)}m`
```

## Creator → brand colour map

Reused from `app/web/src/LeaderboardPage.jsx`; re-verify against the live AA palette
during chart extraction before treating as final.

| Creator | Hex |
|---|---|
| Kiro | `#7f4bf3` |
| Anthropic | `#d7734f` |
| OpenAI | `#1d9a72` |
| xAI | `#222222` |
| Moonshot AI | `#f0a128` |
| Meta | `#1967d2` |
| Z.ai | `#2e78d3` |
| Cursor | `#8d6fe8` |
| DeepSeek | `#4569ee` |
| Google | `#4285f4` |

## Fonts — licensing flag

`suisseIntl` and `victorSerifBasic` are **commercial, licensed** typefaces. Downloading
the 5 woff2 files reproduces AA pixel-for-pixel and is defensible for a local/internal
clone, but they must not be redistributed. If this clone is ever published, swap to
free equivalents (e.g. Inter for the sans, a free transitional serif) and re-run the
visual QA diff.
