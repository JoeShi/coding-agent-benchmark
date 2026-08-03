"use client";

/**
 * Floating nav — see docs/research/components/floating-nav.spec.md.
 *
 * Every class name / CSS value below was captured with `getComputedStyle()` from
 * artificialanalysis.ai and is reproduced verbatim. Two deliberate deviations,
 * both documented in the spec:
 *   1. The six mega-menu panels are out of scope, so the triggers are plain
 *      `<button type="button">` and the sliding indicator is driven by **hover**
 *      instead of `data-state="open"`.
 *   2. The inert `dark` class the target puts on `nav[aria-label="Main"]` is omitted.
 *
 * There is intentionally **no scroll state**: computed styles at scrollY 0 and
 * 4000 are byte-identical on the target, so the nav is a constant floating pill.
 *
 * Third deviation: the target's Log in / search / share / social cluster is gone,
 * and the purple Premium pill is repurposed as the "Task Monitor" link to
 * `/monitor`. Those controls have no backing feature here, whereas the monitor
 * does; the pill keeps the target's exact styling.
 */

import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";
import { Menu } from "lucide-react";
import { AaLogoIcon } from "@/components/icons";

/**
 * The target derives Log in / search / social / menu from one shadcn `Button` cva.
 * Declared once here and concatenated verbatim — deliberately NOT run through
 * `cn()`, because `twMerge` would drop classes the target actually ships (e.g. it
 * removes `inline-flex` from the Log in link because a later `flex` conflicts).
 */
const BTN_BASE =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm transition-colors " +
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring " +
  "disabled:pointer-events-none disabled:opacity-50 " +
  "[&_svg]:pointer-events-none [&_svg]:w-4 [&_svg]:h-4 [&_svg]:shrink-0 rounded-lg leading-none";

const BRAND_PILL_CLASS =
  "flex-shrink-0 flex items-center select-none gap-2 px-3 bg-black rounded-full self-stretch";

/** The target's Premium pill, reused verbatim for the Task Monitor link. */
const MONITOR_CLASS =
  "inline-flex h-9 w-fit flex-none items-center justify-center whitespace-nowrap rounded-lg px-3 " +
  "text-sm text-white transition-colors bg-brand-purple-dark shadow-sm " +
  "hover:bg-brand-purple-dark/90 active:bg-brand-purple-dark/75 focus-visible:outline-none " +
  "focus-visible:ring-2 focus-visible:ring-brand-purple-dark/50 focus-visible:ring-offset-2 " +
  "focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50";

const MENU_CLASS = BTN_BASE + " bg-neutral-100 hover:bg-neutral-200 h-9 w-9";

/** Every pill group shares this; group 0 additionally gets `flex items-center`. */
const GROUP_CLASS =
  "bg-neutral-100 rounded-[1.5rem] [clip-path:inset(0_round_1.5rem)]";

const ITEM_CLASS =
  "inline-flex w-max items-center justify-center rounded-3xl px-3 py-2 text-sm " +
  "transition-colors focus:outline-none disabled:pointer-events-none disabled:opacity-50 " +
  "bg-transparent hover:bg-transparent hover:text-white " +
  "focus-visible:bg-black focus-visible:text-white";

const INDICATOR_CLASS =
  "absolute top-0 bottom-0 rounded-3xl bg-black pointer-events-none -z-[1]";

const INDICATOR_TRANSITION =
  "left 280ms ease-out, width 280ms ease-out, opacity 280ms ease-out";

type NavItem = {
  label: string;
  /** Present → renders a `next/link`; absent → an inert `<button type="button">`. */
  href?: string;
  /** The page's active item — seeds the indicator's resting left/width. */
  active?: boolean;
};

const NAV_GROUPS: { className: string; items: NavItem[] }[] = [
  {
    className: GROUP_CLASS + " flex items-center",
    items: [
      { label: "Models" },
      { label: "Coding Agents", active: true },
      { label: "Speech, Image, Video" },
      { label: "Inference" },
      { label: "Leaderboards" },
      { label: "About" },
    ],
  },
  {
    className: GROUP_CLASS,
    items: [{ label: "AI Trends", href: "/trends" }],
  },
  {
    className: GROUP_CLASS,
    items: [{ label: "Arenas" }],
  },
];

function BrandPill() {
  return (
    <Link href="/" className={BRAND_PILL_CLASS}>
      <AaLogoIcon className="h-4 w-4 text-white" />
      <span className="font-brand-serif text-white hidden sm:block whitespace-nowrap">
        Artificial Analysis
      </span>
    </Link>
  );
}

function MonitorLink() {
  return (
    <Link href="/monitor" className={MONITOR_CLASS}>
      Task Monitor
    </Link>
  );
}

export function SiteNav() {
  /** Shared positioning context for all three indicators. */
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const activeItemRef = useRef<HTMLButtonElement | null>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });
  const [visible, setVisible] = useState(false);

  function measure(element: HTMLElement) {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const wrapperRect = wrapper.getBoundingClientRect();
    const itemRect = element.getBoundingClientRect();
    setIndicator({
      left: itemRect.left - wrapperRect.left,
      width: itemRect.width,
    });
  }

  // Seed the resting left/width from the active item so the indicator is already
  // in the right place before the first hover.
  useLayoutEffect(() => {
    if (activeItemRef.current) measure(activeItemRef.current);
  }, []);

  function handlePointerEnter(event: React.PointerEvent<HTMLElement>) {
    measure(event.currentTarget);
    setVisible(true);
  }

  const indicatorStyle: React.CSSProperties = {
    left: `${indicator.left}px`,
    width: `${indicator.width}px`,
    opacity: visible ? 1 : 0,
    transition: INDICATOR_TRANSITION,
  };

  return (
    <div className="z-50 w-full sticky top-6 -mb-9">
      {/* Mobile bar — brand + Task Monitor + menu only. */}
      <div className="container xl:hidden">
        <div className="flex items-center justify-between gap-2">
          <BrandPill />
          <div className="min-w-0 flex items-center gap-1">
            <div className="flex items-center gap-2">
              <MonitorLink />
            </div>
            <button type="button" className={MENU_CLASS}>
              <Menu />
            </button>
          </div>
        </div>
      </div>

      {/* Desktop pill. */}
      <div className="container hidden xl:block">
        <nav
          aria-label="Main"
          className="relative flex-1 w-full max-w-none z-50 flex items-stretch justify-between"
        >
          <BrandPill />

          <div
            ref={wrapperRef}
            className="flex items-center relative"
            onPointerLeave={() => setVisible(false)}
          >
            <ul className="group flex-1 list-none justify-center flex items-center gap-0">
              {NAV_GROUPS.map((group, groupIndex) => (
                <div key={groupIndex} className={group.className}>
                  {group.items.map((item) => (
                    <li key={item.label} className="z-10">
                      {item.href ? (
                        <Link
                          href={item.href}
                          className={ITEM_CLASS}
                          onPointerEnter={handlePointerEnter}
                        >
                          {item.label}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          ref={
                            item.active
                              ? (node) => {
                                  activeItemRef.current = node;
                                }
                              : undefined
                          }
                          className={ITEM_CLASS}
                          onPointerEnter={handlePointerEnter}
                        >
                          {item.label}
                        </button>
                      )}
                    </li>
                  ))}
                  {/*
                    All three indicators carry identical left/width/opacity; each
                    group's clip-path crops it to that group's rounded rect, which
                    is what makes one black pill appear to travel between groups.
                  */}
                  <div className={INDICATOR_CLASS} style={indicatorStyle} />
                </div>
              ))}
            </ul>
          </div>

          <div className="flex items-center gap-1">
            <div className="flex items-center gap-2">
              <MonitorLink />
            </div>
          </div>
        </nav>
      </div>
    </div>
  );
}
