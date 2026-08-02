"use client";

/**
 * Radix Tabs wrappers — see docs/research/components/section-shell.spec.md §2.
 *
 * These parts carry **no default classes of their own**: every call site supplies
 * the target's verbatim class string. `className` is therefore forwarded
 * unchanged and deliberately NOT routed through `cn()`/`twMerge` — the measured
 * strings contain intentional intra-string conflicts that the target actually
 * ships (`p-1` + `!p-0`, `rounded-lg` + `!rounded-none`, `bg-brand-blue-light` +
 * `!bg-transparent`, `h-9` + `!h-auto`), and a merge pass is free to collapse
 * them. With nothing to merge against, `cn()` would add only risk.
 */

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root className={className} {...props} />;
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List className={className} {...props} />;
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return <TabsPrimitive.Trigger className={className} {...props} />;
}

/**
 * `forceMount` is removed from the public type: the target keeps only the active
 * panel in the DOM, so Radix's default unmount-on-inactive behaviour is load
 * bearing and must not be opted out of. Radix still supplies `data-state`.
 */
function TabsContent({
  className,
  ...props
}: Omit<React.ComponentProps<typeof TabsPrimitive.Content>, "forceMount">) {
  return <TabsPrimitive.Content className={className} {...props} />;
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
