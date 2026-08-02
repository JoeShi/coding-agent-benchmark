# Foundation — design tokens, fonts, assets

Extracted from `artificialanalysis.ai/agents/coding-agents` via `getComputedStyle()` /
`document.styleSheets`. Target uses Tailwind v3-era shadcn conventions; the clone is
**Tailwind v4**, so these must be bridged (see "Tailwind v4 bridging" below).

## Design tokens — 46 CSS custom properties

All values are **HSL triplets** (no `hsl()` wrapper), consumed as `hsl(var(--token))`.

### shadcn base
```
--background            0 0% 100%
--foreground            0 0% 0%
--card                  0 0% 100%
--card-foreground       0 0% 0%
--popover               0 0% 100%
--popover-foreground    0 0% 0%
--muted                 0 0% 96.1%
--muted-foreground      0 0% 46.9%
--accent                0 0% 96.1%
--accent-foreground     0 0% 11.2%
--secondary             0 0% 96.1%
--secondary-foreground  0 0% 11.2%
--destructive           0 84.2% 60.2%
--destructive-foreground 0 0% 98%
--border                0 0% 85%
--input                 0 0% 91.4%
--ring                  0 0% 9%
--radius                0.5rem
```

> Note: there is **no `--primary` / `--primary-foreground`** in `:root`. Don't invent them.

### Neutral ramp
```
--neutral-50   0 0% 98%
--neutral-100  0 0% 90.59%
--neutral-200  0 0% 85%
--neutral-500  0 0% 58%
--neutral-600  0 0% 47%
--neutral-700  0 0% 30%
--neutral-900  0 0% 12%
```

### Brand palette
```
--brand-blue          261.54 98.2% 54.9%     (a violet despite the name)
--brand-blue-light    220 10% 95%
--brand-purple        262.46 97.91% 62.55%
--brand-purple-dark   309.33 63.38% 27.84%
--brand-purple-light  266.36 100% 79.02%
--brand-magenta       289.78 97.12% 72.75%
--brand-plum          307.16 100% 13.14%
--brand-green-dark    172.89 100% 14.9%
--brand-mint          165.79 95% 84.31%
--brand-lime          81 100% 72.55%
--brand-peach         67.5 100% 95.29%
--brand-orange        19.8 100% 60.2%
--brand-yellow        53.07 98.43% 50%
```

### Sidebar tokens (shadcn sidebar block — present but likely unused on this page)
```
--sidebar-background        0 0% 98%
--sidebar-foreground        0 0% 26.1%
--sidebar-primary           0 0% 10%
--sidebar-primary-foreground 0 0% 98%
--sidebar-accent            0 0% 95.9%
--sidebar-accent-foreground 0 0% 10%
--sidebar-border            0 0% 91%
--sidebar-ring              0 0% 59.8%
```

### Observed literal colours (cross-check)
| Where | Value |
|---|---|
| `body` background | `rgb(255, 255, 255)` |
| `body` color | `rgb(0, 0, 0)` |
| sidebar `border-top` | `rgb(217, 217, 217)` = `--border` `0 0% 85%` |
| inactive spy dot | `rgb(148, 148, 148)` = `--neutral-500` `0 0% 58%` |

## Global element styles

```css
html { scroll-behavior: smooth; }
body {
  font-family: suisseIntl, "suisseIntl Fallback", ui-sans-serif, system-ui, sans-serif;
  font-size: 16px;
  line-height: 24px;
  color: rgb(0,0,0);
  background: rgb(255,255,255);
}
```

## Fonts

Two self-hosted families, loaded via `next/font/local` on the target (hence the
`* Fallback` faces with metric overrides). **5 woff2 files**, all `font-display: swap`.

| Family | Weight | File | Loaded on this page |
|---|---|---|---|
| `suisseIntl` | 300 | `/_next/static/media/5fc57f0bdf4f18a4-s.p.woff2` | no |
| `suisseIntl` | 400 | `/_next/static/media/33b0a75b30dd1c81-s.p.woff2` | **yes** |
| `suisseIntl` | 500 | `/_next/static/media/09d69b6d2cb2dadb-s.p.woff2` | **yes** |
| `victorSerifBasic` | 500 | `/_next/static/media/2894d3242f139187-s.p.woff2` | **yes** |
| `victorSerifBasic` | 600 | `/_next/static/media/7ed4844278386875-s.p.woff2` | no |

Base URL for all: `https://artificialanalysis.ai`

### Fallback metric overrides (reproduce these verbatim)
```css
@font-face { font-family: "suisseIntl Fallback"; src: local("Arial");
  size-adjust: 103%;    ascent-override: 95.72%;  descent-override: 30.2%;  line-gap-override: 0%; }
@font-face { font-family: "victorSerifBasic Fallback"; src: local("Arial");
  size-adjust: 97.02%;  ascent-override: 109.16%; descent-override: 25.67%; line-gap-override: 0%; }
```

`next/font/local` generates these automatically when given `adjustFontFallback`, but
pinning them by hand guarantees the same layout shift behaviour.

### Utility class names in use on the target
- `font-brand-sans` → `suisseIntl`
- `font-brand-serif` → `victorSerifBasic` (seen on section `h3` headings, `text-2xl font-brand-serif font-medium`)

### ⚠ Licensing
`suisseIntl` and `victorSerifBasic` are **commercial licensed** typefaces. Fetching
them reproduces AA exactly and is defensible for a local/internal clone, but they must
not be redistributed. If this is ever published, substitute free equivalents and re-run
the Phase 5 visual diff.

## Tailwind v4 bridging

The target's tokens are v3-style bare HSL triplets. Under Tailwind v4 they must be
exposed through `@theme inline` so utilities resolve:

```css
@import "tailwindcss";

:root {
  --background: 0 0% 100%;
  /* … all 46 triplets verbatim … */
}

@theme inline {
  --color-background: hsl(var(--background));
  --color-foreground: hsl(var(--foreground));
  --color-border:     hsl(var(--border));
  --color-neutral-500: hsl(var(--neutral-500));
  --color-brand-purple: hsl(var(--brand-purple));
  /* … etc … */
  --font-brand-sans:  var(--font-suisse-intl);
  --font-brand-serif: var(--font-victor-serif);
  --radius: 0.5rem;
}
```

Keep the raw triplets in `:root` (so `hsl(var(--x) / <alpha>)` still works) **and**
map wrapped values into `@theme inline`.

## Assets

Only one icon link on the page:

| rel | href | sizes | type |
|---|---|---|---|
| `icon` | `https://artificialanalysis.ai/favicon.ico` | 16x16 | image/x-icon |

No apple-touch-icon, no manifest, no OG image discovered via `<link>`.
Inline `<svg>` inventory + raster/video asset enumeration still to be run as part of
the per-section extraction.
