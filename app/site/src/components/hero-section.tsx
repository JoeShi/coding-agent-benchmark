"use client";

import * as React from "react";
import {
  Bot,
  Briefcase,
  ChartNoAxesColumnIncreasing,
  Code,
  Columns2,
  Database,
  Headset,
  Presentation,
  ScanText,
} from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const SUBNAV_BASE =
  "inline-flex items-center justify-center whitespace-nowrap transition-colors " +
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring " +
  "disabled:pointer-events-none disabled:opacity-50 " +
  "[&_svg]:pointer-events-none [&_svg]:shrink-0 h-7 p-2 text-xs rounded-md " +
  "[&_svg]:w-3 [&_svg]:h-3 gap-1";

const CATEGORY_TABS = [
  { label: "Coding Agents", href: "/agents/coding-agents", Icon: Code },
  { label: "General Work", href: "/agents", Icon: Briefcase },
  { label: "Chatbots", href: "/agents/chatbots", Icon: Bot },
  { label: "Presentations", href: "/agents/presentations", Icon: Presentation },
  { label: "OCR", href: "/agents/ocr", Icon: ScanText },
  { label: "Data Analysis", href: "/agents/data", Icon: Database },
  { label: "Customer Support", href: "/agents/customer-support", Icon: Headset },
];

export function HeroSection() {
  const activeTabRef = React.useRef<HTMLButtonElement>(null);
  const [indicatorStyle, setIndicatorStyle] = React.useState<React.CSSProperties>({
    left: 0,
    width: 0,
  });

  React.useLayoutEffect(() => {
    const activeTab = activeTabRef.current;
    if (!activeTab) return;
    setIndicatorStyle({
      left: activeTab.offsetLeft + 10,
      width: activeTab.offsetWidth - 20,
    });
  }, []);

  return (
    <section className="bg-brand-blue-light pt-32 pb-0">
      <div className="container">
        <div className="grid grid-cols-12 gap-4 mb-10">
          <div className="col-span-12 lg:col-span-9 lg:pr-24">
            <h1 className="text-4xl mb-4 max-w-[36ch] lg:max-w-[40ch]">
              Artificial Analysis Coding Agent Benchmarks
            </h1>
            <div className="text-sm space-y-4 [&_a]:underline [&_a:hover]:text-brand-purple [&_a]:transition-colors max-w-[72ch]">
              <p>
                We measure real-world performance of coding agents on software
                engineering tasks, including cost, token usage, and execution
                time. We compare how performance changes across agents,
                models, and execution settings.
              </p>
              <p>
                To compare language models see our{" "}
                <a className="underline underline-offset-2" href="/models">
                  model benchmarks
                </a>
                .
              </p>
            </div>
          </div>
          <div className="col-span-12 lg:col-span-3">
            <div className="flex flex-col gap-5">
              <div className="flex justify-end overflow-x-auto">
                <nav
                  aria-label="Coding agents pages"
                  className="bg-neutral-100 rounded-lg p-1 gap-1 h-9 inline-flex flex-wrap"
                >
                  <a
                    className={`${SUBNAV_BASE} bg-black text-white hover:bg-neutral-700`}
                    href="/agents/coding-agents"
                  >
                    <ChartNoAxesColumnIncreasing />
                    Benchmarks
                  </a>
                  <a
                    className={`${SUBNAV_BASE} hover:no-underline hover:bg-neutral-200`}
                    href="/agents/coding-agents/comparisons"
                  >
                    <Columns2 />
                    Comparisons
                  </a>
                  <a
                    className={`${SUBNAV_BASE} hover:no-underline hover:bg-neutral-200`}
                    href="/agents/coding"
                  >
                    <Code />
                    Features
                  </a>
                </nav>
              </div>
              <div className="bg-background p-4 text-xs text-neutral-700 space-y-3">
                <h2 className="text-lg">
                  Artificial Analysis Coding Agent Index
                </h2>
                <p>Composite index of 3 benchmarks:</p>
                <ul className="list-disc pl-4 space-y-2">
                  <li>
                    <span>DeepSWE</span>
                    <div className="text-neutral-400 mt-0.5">
                      Software engineering tasks, 113 tasks
                    </div>
                    <div className="mt-0.5">
                      <a
                        className="text-neutral-500 underline underline-offset-2"
                        href="https://deepswe.datacurve.ai/"
                      >
                        By Datacurve
                      </a>
                    </div>
                  </li>
                  <li>
                    <span>Terminal-Bench v2</span>
                    <div className="text-neutral-400 mt-0.5">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help decoration-dotted underline underline-offset-2">
                              Agentic terminal use, 84 tasks
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            84 of 89 tasks; 5 excluded for environment
                            compatibility.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <div className="mt-0.5">
                      <a
                        className="text-neutral-500 underline underline-offset-2"
                        href="https://www.tbench.ai/benchmarks/terminal-bench-2"
                      >
                        By Laude Institute
                      </a>
                    </div>
                  </li>
                  <li>
                    <span>SWE-Atlas-QnA</span>
                    <div className="text-neutral-400 mt-0.5">
                      Technical Q&A, 124 tasks
                    </div>
                    <div className="mt-0.5">
                      <a
                        className="text-neutral-500 underline underline-offset-2"
                        href="https://labs.scale.com/leaderboard/sweatlas-qna"
                      >
                        By Scale AI
                      </a>
                    </div>
                  </li>
                </ul>
                <p>
                  Each benchmark score averages pass@1 across three attempts
                  per task. The Index gives equal weight to its 3 benchmark
                  components.{" "}
                  <a
                    className="underline underline-offset-2"
                    href="/methodology/coding-agents-benchmarking"
                  >
                    See methodology for scoring details and version history.
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex min-w-0 overflow-x-auto">
          <div className="flex items-center gap-4 min-w-0">
            <div className="min-w-0 flex overflow-x-auto">
              <div>
                <div className="overflow-x-auto w-full">
                  <div
                    role="tablist"
                    className="snap-x relative inline-flex w-full items-center justify-start rounded-none bg-transparent p-0"
                  >
                    {CATEGORY_TABS.map(({ label, href, Icon }, index) => {
                      const isActive = index === 0;
                      return (
                        <button
                          key={label}
                          ref={isActive ? activeTabRef : undefined}
                          role="tab"
                          data-state={isActive ? "active" : "inactive"}
                          className="snap-center relative inline-flex flex-1 items-center justify-center whitespace-nowrap rounded-none !bg-transparent px-4 py-2 text-sm text-neutral-500 shadow-none transition-colors disabled:pointer-events-none disabled:opacity-50 data-[state=active]:text-foreground [&[data-state=active]_svg]:text-foreground min-w-0 lg:flex-none"
                        >
                          <a
                            className="inline-flex items-center gap-2"
                            href={href}
                          >
                            <Icon className="flex-none" size={16} />
                            {label}
                          </a>
                        </button>
                      );
                    })}
                    <div
                      className="absolute pointer-events-none border-b border-black bottom-0"
                      style={{
                        left: indicatorStyle.left,
                        width: indicatorStyle.width,
                        transition: "left ease-out, width ease-out",
                        transform: "translateZ(0px)",
                        willChange: "transform, width, left",
                        backfaceVisibility: "hidden",
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
