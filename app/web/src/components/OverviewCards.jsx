import React from 'react'

function fmtNum(n) {
  if (n == null) return '-'
  return Number(n).toLocaleString('en-US')
}

function fmtCredits(n) {
  if (n == null) return '-'
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 })
}

export default function OverviewCards({ overview }) {
  if (!overview) return null
  const { queue = {}, workers = {}, records = {} } = overview
  const passed = records.passed ?? 0
  const failed = records.failed ?? 0
  const error = records.error ?? 0
  const expected = records.expected ?? 0
  const remainder = Math.max(expected - passed - failed - error, 0)
  const pct = (v) => (expected > 0 ? (v / expected) * 100 : 0)

  return (
    <div className="cards">
      <div className="card">
        <h2>队列</h2>
        <div className="kv"><span className="k">等待</span><span>{fmtNum(queue.visible)}</span></div>
        <div className="kv"><span className="k">处理中</span><span>{fmtNum(queue.in_flight)}</span></div>
        <div className="kv"><span className="k">DLQ</span><span>{fmtNum(queue.dlq)}</span></div>
      </div>

      <div className="card">
        <h2>Workers</h2>
        <div className="big">{fmtNum(workers.running)} / {fmtNum(workers.total)}</div>
        <div className="sub">SSM 在线: {fmtNum(workers.ssm_online)}</div>
      </div>

      <div className="card">
        <h2>记录进度</h2>
        <div className="big">
          {fmtNum(records.total)} <span className="dim">/ {fmtNum(expected)}</span>
        </div>
        <div className="progress">
          <div style={{ width: pct(passed) + '%', background: 'var(--green)' }} />
          <div style={{ width: pct(failed) + '%', background: 'var(--red)' }} />
          <div style={{ width: pct(error) + '%', background: 'var(--orange)' }} />
        </div>
        <div className="legend">
          <span><span className="dot" style={{ background: 'var(--green)' }} />通过 {fmtNum(passed)}</span>
          <span><span className="dot" style={{ background: 'var(--red)' }} />失败 {fmtNum(failed)}</span>
          <span><span className="dot" style={{ background: 'var(--orange)' }} />错误 {fmtNum(error)}</span>
          <span><span className="dot" style={{ background: 'var(--gray)' }} />剩余 {fmtNum(remainder)}</span>
          <span>限流 {fmtNum(records.rate_limit)}</span>
        </div>
      </div>

      <div className="card">
        <h2>消耗</h2>
        <div className="big">{fmtCredits(records.credits)} <span className="dim">credits</span></div>
        <div className="sub">${fmtCredits(records.cost_usd)} USD</div>
      </div>
    </div>
  )
}
