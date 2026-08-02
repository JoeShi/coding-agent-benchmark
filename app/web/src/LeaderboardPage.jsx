import React, { useEffect, useMemo, useState } from 'react'
import './leaderboard.css'

const COLORS = {
  Kiro: '#7f4bf3',
  Anthropic: '#d7734f',
  OpenAI: '#1d9a72',
  xAI: '#222222',
  'Moonshot AI': '#f0a128',
  Meta: '#1967d2',
  'Z.ai': '#2e78d3',
  Cursor: '#8d6fe8',
  DeepSeek: '#4569ee',
  Google: '#4285f4',
}

const formatIndex = (value) => Math.round(value * 100)
const formatCost = (value) => `$${value < 1 ? value.toFixed(2) : value.toFixed(2)}`
const formatTime = (value) => `${(value / 60).toFixed(1)}m`

function Mark({ row }) {
  const letters = row.agent
    .split(/\s+/)
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
  return (
    <span className={`lb-mark ${row.isKiro ? 'is-kiro' : ''}`} style={{ '--mark': COLORS[row.creator] }}>
      {letters}
    </span>
  )
}

function MetricChart({ title, subtitle, rows, metric, format, lowerIsBetter = false }) {
  const sorted = [...rows].sort((a, b) =>
    lowerIsBetter ? a[metric] - b[metric] : b[metric] - a[metric],
  )
  const max = Math.max(...sorted.map((row) => row[metric]))
  return (
    <section className="lb-section" id={metric}>
      <div className="lb-section-head">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <span className="lb-count">{sorted.length} agents</span>
      </div>
      <div className="lb-chart" role="list" aria-label={title}>
        {sorted.map((row, index) => (
          <div className={`lb-bar-row ${row.isKiro ? 'is-kiro' : ''}`} role="listitem" key={row.key}>
            <span className="lb-rank">{index + 1}</span>
            <div className="lb-label">
              <Mark row={row} />
              <span>
                <strong>{row.agent}</strong>
                <small>{row.model}</small>
              </span>
            </div>
            <div className="lb-track">
              <span
                className="lb-fill"
                style={{
                  '--bar': COLORS[row.creator],
                  width: `${Math.max(2, (row[metric] / max) * 100)}%`,
                }}
              />
            </div>
            <strong className="lb-value">{format(row[metric])}</strong>
          </div>
        ))}
      </div>
    </section>
  )
}

function CostIndexChart({ rows, mode, costNote }) {
  const [activeKey, setActiveKey] = useState('kiro-gpt-5.6-sol')
  const width = 1000
  const height = 470
  const plot = { left: 72, right: 30, top: 34, bottom: 74 }
  const maxCost = Math.ceil(Math.max(...rows.map((row) => row.cost_usd)))
  const xTicks = [0, 3, 6, 9, 12].filter((tick) => tick <= maxCost)
  const yTicks = [30, 40, 50, 60, 70]
  if (xTicks[xTicks.length - 1] !== maxCost) xTicks.push(maxCost)

  const x = (cost) => plot.left + cost / maxCost * (width - plot.left - plot.right)
  const y = (index) => height - plot.bottom - (index * 100 - 25) / 47 * (height - plot.top - plot.bottom)
  const active = rows.find((row) => row.key === activeKey) || rows[0]

  return (
    <section className="lb-section lb-scatter-section" id="index-vs-cost">
      <div className="lb-section-head">
        <div>
          <h2>Coding Agent Index vs. Cost per Task</h2>
          <p>Lower observed cost is farther left; higher performance is higher on the chart</p>
        </div>
        <span className="lb-count">Most attractive quadrant ↖</span>
      </div>

      <div className="lb-scatter-frame">
        <svg
          className="lb-scatter"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Coding Agent Index versus cost per task"
        >
          <rect
            className="lb-attractive-zone"
            x={plot.left}
            y={plot.top}
            width={x(3) - plot.left}
            height={y(0.6) - plot.top}
          />
          <text className="lb-zone-label" x={plot.left + 12} y={plot.top + 22} textAnchor="start">
            High performance · Low cost
          </text>

          {xTicks.map((tick) => (
            <g key={`x-${tick}`}>
              <line className="lb-grid-line" x1={x(tick)} x2={x(tick)} y1={plot.top} y2={height - plot.bottom} />
              <text className="lb-axis-tick" x={x(tick)} y={height - plot.bottom + 24} textAnchor="middle">${tick}</text>
            </g>
          ))}
          {yTicks.map((tick) => (
            <g key={`y-${tick}`}>
              <line className="lb-grid-line" x1={plot.left} x2={width - plot.right} y1={y(tick / 100)} y2={y(tick / 100)} />
              <text className="lb-axis-tick" x={plot.left - 13} y={y(tick / 100) + 4} textAnchor="end">{tick}</text>
            </g>
          ))}
          <line className="lb-axis-line" x1={plot.left} x2={width - plot.right} y1={height - plot.bottom} y2={height - plot.bottom} />
          <line className="lb-axis-line" x1={plot.left} x2={plot.left} y1={plot.top} y2={height - plot.bottom} />
          <text className="lb-axis-title" x={(plot.left + width - plot.right) / 2} y={height - 18} textAnchor="middle">Cost per Task (USD)</text>
          <text className="lb-axis-title" transform={`translate(18 ${(plot.top + height - plot.bottom) / 2}) rotate(-90)`} textAnchor="middle">Coding Agent Index</text>

          {rows.map((row) => {
            const pointX = x(row.cost_usd)
            const pointY = y(row.index)
            const color = COLORS[row.creator]
            return (
              <g
                className={`lb-scatter-point ${row.isKiro ? 'is-kiro' : ''} ${row.key === active.key ? 'is-active' : ''}`}
                key={row.key}
                tabIndex="0"
                role="button"
                aria-label={`${row.label}: Index ${(row.index * 100).toFixed(1)}, cost ${formatCost(row.cost_usd)}`}
                onMouseEnter={() => setActiveKey(row.key)}
                onFocus={() => setActiveKey(row.key)}
                onClick={() => setActiveKey(row.key)}
              >
                {row.isKiro ? (
                  <rect x={pointX - 7} y={pointY - 7} width="14" height="14" rx="3" fill={color} />
                ) : (
                  <circle cx={pointX} cy={pointY} r="6" fill={color} />
                )}
                <circle className="lb-point-hit" cx={pointX} cy={pointY} r="14" />
                {row.isKiro && (
                  <text
                    className="lb-point-label"
                    x={pointX + 10}
                    y={pointY - 9}
                    textAnchor={pointX > width - 180 ? 'end' : 'start'}
                    dx={pointX > width - 180 ? -20 : 0}
                  >
                    {row.model}
                  </text>
                )}
              </g>
            )
          })}
        </svg>

        <div className="lb-scatter-detail" aria-live="polite">
          <div className="lb-detail-title"><Mark row={active} /><span><strong>{active.agent}</strong><small>{active.model}</small></span></div>
          <dl>
            <div><dt>Index</dt><dd>{(active.index * 100).toFixed(1)}</dd></div>
            <div><dt>Cost / task</dt><dd>{formatCost(active.cost_usd)}</dd></div>
            {active.isKiro && <div><dt>Cost coverage</dt><dd>{(active.cost_coverage * 100).toFixed(1)}%</dd></div>}
          </dl>
        </div>
      </div>

      <div className="lb-scatter-legend">
        <span><i className="kiro" /> Kiro CLI</span>
        <span><i /> Artificial Analysis snapshot</span>
        {mode === 'normalized' && <span className="mode-note">Only Kiro point positions use normalized scores</span>}
      </div>
      <aside className="lb-callout lb-scatter-note"><strong>Cost basis differs.</strong> {costNote}</aside>
    </section>
  )
}

function BenchmarkBreakdown({ rows, benchmarks, mode }) {
  const sorted = [...rows].sort((a, b) => b.index - a.index)
  return (
    <section className="lb-section" id="benchmark-breakdown">
      <div className="lb-section-head">
        <div>
          <h2>Kiro Performance by Benchmark</h2>
          <p>Task-normalized pass@1 · Higher is better</p>
        </div>
        <span className="lb-count">3 attempts per task</span>
      </div>
      <div className="lb-table-wrap">
        <table className="lb-table">
          <thead>
            <tr>
              <th>Model</th>
              {benchmarks.map((benchmark) => (
                <th key={benchmark.id}>{benchmark.label}<small>{benchmark.tasks} tasks</small></th>
              ))}
              <th>Index</th>
              <th>Errors</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={row.key}>
                <td><Mark row={row} /><strong>{row.model}</strong></td>
                {benchmarks.map((benchmark) => (
                  <td key={benchmark.id}>{(row.benchmarks[benchmark.id] * 100).toFixed(1)}</td>
                ))}
                <td><strong>{(row.index * 100).toFixed(1)}</strong></td>
                <td>{row.n_errors}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {mode === 'normalized' && (
        <p className="lb-inline-note">Normalized scores exclude errored attempts. Tasks with no valid attempts are excluded from that benchmark average.</p>
      )}
    </section>
  )
}

export default function LeaderboardPage() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [mode, setMode] = useState('official')

  useEffect(() => {
    document.title = 'Kiro CLI Coding Agent Benchmark'
    document.documentElement.classList.add('leaderboard-document')
    fetch('/data/leaderboard.json')
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load leaderboard data (${response.status})`)
        return response.json()
      })
      .then(setData)
      .catch((err) => setError(err.message))
    return () => document.documentElement.classList.remove('leaderboard-document')
  }, [])

  const rows = useMemo(() => {
    if (!data) return []
    const aa = data.artificial_analysis.models.map((row) => ({
      ...row,
      key: `aa-${row.id}`,
      isKiro: false,
    }))
    const kiro = data.kiro.map((row) => ({
      ...row,
      ...row[mode],
      key: `kiro-${row.id}`,
      isKiro: true,
    }))
    return [...aa, ...kiro]
  }, [data, mode])

  if (error) return <main className="lb-state">{error}</main>
  if (!data) return <main className="lb-state">Loading benchmark results...</main>

  const kiroRows = rows.filter((row) => row.isKiro)
  const topKiro = [...kiroRows].sort((a, b) => b.index - a.index)[0]
  const ranked = [...rows].sort((a, b) => b.index - a.index)
  const topRank = ranked.findIndex((row) => row.key === topKiro.key) + 1

  return (
    <div className="leaderboard-page">
      <header className="lb-nav">
        <a className="lb-brand" href="/leaderboard"><span>K</span> Kiro Benchmarks</a>
        <nav aria-label="Page sections">
          <a href="#index">Performance</a>
          <a href="#cost_usd">Cost</a>
          <a href="#time_seconds">Execution Time</a>
          <a href="#methodology">Methodology</a>
        </nav>
        <a className="lb-dashboard-link" href="/">Operations dashboard</a>
      </header>

      <main className="lb-main">
        <section className="lb-hero">
          <div className="lb-kicker">Independent benchmark report · {data.run_id}</div>
          <h1>Kiro CLI Coding Agent<br />Benchmarks</h1>
          <p className="lb-lede">
            Six model variants tested across the Artificial Analysis Coding Agent Index suite:
            DeepSWE, Terminal-Bench v2, and SWE-Atlas-QnA.
          </p>
          <div className="lb-summary">
            <div><strong>{formatIndex(topKiro.index)}</strong><span>Top Kiro Index</span></div>
            <div><strong>#{topRank}</strong><span>Comparison rank</span></div>
            <div><strong>5,778</strong><span>Evaluated trials</span></div>
            <div><strong>321</strong><span>Unique tasks</span></div>
          </div>
        </section>

        <div className="lb-sticky-tabs">
          <div className="lb-mode" role="group" aria-label="Scoring mode">
            <button className={mode === 'official' ? 'active' : ''} onClick={() => setMode('official')}>Official score</button>
            <button className={mode === 'normalized' ? 'active' : ''} onClick={() => setMode('normalized')}>Exclude errors</button>
          </div>
          <p>{mode === 'official' ? data.notes.official : data.notes.normalized}</p>
        </div>

        <MetricChart
          title="Coding Agent Index"
          subtitle={`Artificial Analysis ${data.methodology_version}: simple average of DeepSWE, Terminal-Bench v2, and SWE-Atlas-QnA · Higher is better`}
          rows={rows}
          metric="index"
          format={formatIndex}
        />

        <CostIndexChart rows={rows} mode={mode} costNote={data.notes.cost} />

        <BenchmarkBreakdown rows={kiroRows} benchmarks={data.benchmarks} mode={mode} />

        <MetricChart
          title="Cost per Task"
          subtitle="Average observed model cost per attempted task (USD) · Lower is better"
          rows={rows}
          metric="cost_usd"
          format={formatCost}
          lowerIsBetter
        />
        <aside className="lb-callout"><strong>Cost basis differs.</strong> {data.notes.cost}</aside>

        <MetricChart
          title="Time per Task"
          subtitle="Average observed agent wall time per task · Lower is better"
          rows={rows}
          metric="time_seconds"
          format={formatTime}
          lowerIsBetter
        />
        <aside className="lb-callout"><strong>Telemetry coverage.</strong> {data.notes.telemetry}</aside>

        <section className="lb-method" id="methodology">
          <div>
            <span className="lb-kicker">Methodology</span>
            <h2>Same public tasks.<br />Same index construction.</h2>
          </div>
          <div className="lb-method-copy">
            <p>Each benchmark score is the mean of task-level pass@1. Every task has three attempts and equal weight. The Coding Agent Index is the simple average of the three benchmark scores.</p>
            <p>The primary view follows Artificial Analysis: failed and errored attempts score zero. “Exclude errors” is a sensitivity analysis for Kiro results only and must not be treated as the official leaderboard score.</p>
            <p>Artificial Analysis comparison data is a dated snapshot of its 15 default chart selections, retrieved {data.artificial_analysis.retrieved_at}. Kiro results were collected independently and are not published by or affiliated with Artificial Analysis.</p>
            <a href={data.artificial_analysis.source} target="_blank" rel="noreferrer">View source leaderboard ↗</a>
          </div>
        </section>
      </main>

      <footer className="lb-footer">
        <span>Kiro CLI benchmark · generated {data.generated_at}</span>
        <span>Artificial Analysis methodology {data.methodology_version}</span>
      </footer>
    </div>
  )
}
