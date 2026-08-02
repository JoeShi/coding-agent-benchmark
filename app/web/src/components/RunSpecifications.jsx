import React from 'react'

const MODELS = [
  'Auto',
  'Claude Opus 5',
  'Claude Sonnet 5',
  'Claude Opus 4.8',
  'Claude Sonnet 4.6',
  'GPT-5.6 Sol',
]

function Spec({ label, value, detail }) {
  return (
    <div className="run-spec">
      <span className="run-spec-label">{label}</span>
      <strong>{value}</strong>
      {detail && <span className="run-spec-detail">{detail}</span>}
    </div>
  )
}

export default function RunSpecifications() {
  return (
    <section className="panel run-specifications">
      <div className="run-spec-heading">
        <div>
          <h2>Run Specifications</h2>
          <p>全量测试使用的 agent、harness、数据集和计算环境</p>
        </div>
        <a href="/leaderboard">查看 AA Index 结果</a>
      </div>

      <div className="run-spec-grid">
        <Spec
          label="Kiro CLI"
          value="2.15.1"
          detail="glibc；旧环境使用 2.15.2 musl fallback"
        />
        <Spec
          label="Agent invocation"
          value="kiro-cli-chat"
          detail="headless · trust all tools · default reasoning"
        />
        <Spec
          label="Harnesses"
          value="Harbor 0.20.0 · Pier 0.3.0"
          detail="Harbor: TB2/QnA · Pier: DeepSWE"
        />
        <Spec
          label="Compute"
          value="25 AWS EC2 workers"
          detail="21× c7i.4xlarge · 4× c7i.8xlarge · us-east-1"
        />
        <Spec
          label="Concurrency"
          value="75 concurrent trials"
          detail="3 worker loops/instance · API key rotated per trial"
        />
        <Spec
          label="Evaluation scale"
          value="321 tasks · 5,778 trials"
          detail="3 benchmarks · 6 variants · 3 attempts/task"
        />
        <Spec
          label="Datasets"
          value="TB2 84 · DeepSWE 113 · QnA 124"
          detail="Artificial Analysis v1.3 evaluated-task scope"
        />
        <Spec
          label="SWE-Atlas-QnA judge"
          value="Claude Opus 4.5"
          detail="Official rubric-based binary pass/fail evaluator"
        />
      </div>

      <div className="run-models">
        <span className="run-spec-label">Model variants</span>
        <div>{MODELS.map((model) => <span key={model}>{model}</span>)}</div>
      </div>

      <p className="run-spec-footnote">
        执行周期 2026-07-29 至 2026-08-01。环境信息在全部 25 台 worker 上通过 SSM 核验一致；
        DeepSWE commit <code>e016041a6ccf</code>，成本按 Kiro Credits × $0.04 计算。
      </p>
    </section>
  )
}
