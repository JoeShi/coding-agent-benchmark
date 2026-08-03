/**
 * Run Specifications — the monitor's own copy, kept deliberately independent of
 * `components/run-specs-section.tsx` on the index page. That one is a per-agent
 * version table cloned from AA; this one describes the harness/compute
 * environment the fleet actually ran, and the two are edited for different
 * reasons. Content is unchanged from the dashboard it replaces.
 */

import Link from "next/link";

import { Panel } from "@/components/monitor/panel";

const MODELS = [
  "Auto",
  "Claude Opus 5",
  "Claude Sonnet 5",
  "Claude Opus 4.8",
  "Claude Sonnet 4.6",
  "GPT-5.6 Sol",
];

const SPECS: { label: string; value: string; detail: string }[] = [
  {
    label: "Kiro CLI",
    value: "2.15.1",
    detail: "glibc; 2.15.2 musl fallback on older images",
  },
  {
    label: "Agent invocation",
    value: "kiro-cli-chat",
    detail: "headless · trust all tools · default reasoning",
  },
  {
    label: "Harnesses",
    value: "Harbor 0.20.0 · Pier 0.3.0",
    detail: "Harbor: TB2 / QnA · Pier: DeepSWE",
  },
  {
    label: "Compute",
    value: "25 AWS EC2 workers",
    detail: "21× c7i.4xlarge · 4× c7i.8xlarge · us-east-1",
  },
  {
    label: "Concurrency",
    value: "75 concurrent trials",
    detail: "3 worker loops per instance · API key rotated per trial",
  },
  {
    label: "Evaluation scale",
    value: "321 tasks · 5,778 trials",
    detail: "3 benchmarks · 6 variants · 3 attempts per task",
  },
  {
    label: "Datasets",
    value: "TB2 84 · DeepSWE 113 · QnA 124",
    detail: "Artificial Analysis v1.3 evaluated-task scope",
  },
  {
    label: "SWE-Atlas-QnA judge",
    value: "Claude Opus 4.5",
    detail: "Official rubric-based binary pass/fail evaluator",
  },
];

export function RunSpecifications() {
  return (
    <Panel
      title="Run Specifications"
      caption="Agent, harnesses, datasets and compute environment used for the full run."
      actions={
        <Link
          href="/"
          className="text-xs underline underline-offset-2 hover:text-brand-purple transition-colors"
        >
          View Index results
        </Link>
      }
    >
      <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
        {SPECS.map((spec) => (
          <div key={spec.label} className="flex flex-col gap-0.5">
            <span className="text-xs font-medium text-muted-foreground">
              {spec.label}
            </span>
            <strong className="text-sm font-medium">{spec.value}</strong>
            <span className="text-xs text-neutral-500">{spec.detail}</span>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          Model variants
        </span>
        <div className="flex flex-wrap gap-1">
          {MODELS.map((model) => (
            <span
              key={model}
              className="rounded-md bg-brand-blue-light px-2 py-1 text-xs"
            >
              {model}
            </span>
          ))}
        </div>
      </div>

      <p className="mt-6 text-xs text-neutral-500 max-w-[90ch]">
        Executed 2026-07-29 to 2026-08-01. Environment verified identical across
        all 25 workers via SSM; DeepSWE commit{" "}
        <code className="font-mono">e016041a6ccf</code>; cost is Kiro Credits ×
        $0.04.
      </p>
    </Panel>
  );
}
