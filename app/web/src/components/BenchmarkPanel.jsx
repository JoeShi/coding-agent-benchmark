import React, { useState } from 'react'

const BENCHMARKS = [
  { id: 'terminal-bench-2', label: 'Terminal-Bench 2' },
  { id: 'deep-swe', label: 'DeepSWE' },
  { id: 'swe-atlas-qna', label: 'SWE-Atlas-QnA' },
]

const COUNTS = ['passed', 'failed', 'error', 'missing']
const COUNT_LABELS = { passed: '通过', failed: '失败', error: '错误', missing: '缺失' }
const STATUS_LABELS = { passed: 'passed', failed: 'failed', error: '待重跑', missing: 'missing' }

const FILTERS = [
  { id: 'all', label: '全部' },
  { id: 'incomplete', label: '未完成' },
  { id: 'complete', label: '已完成' },
]

function shortName(name) {
  if (name.length <= 48) return name
  const slash = name.lastIndexOf('/')
  if (slash >= 0 && name.length - slash <= 44) {
    return '…' + name.slice(slash)
  }
  return name.slice(0, 45) + '…'
}

export default function BenchmarkPanel({ benchmarks, tasks, activeBenchmark, onSelectBenchmark }) {
  const [filter, setFilter] = useState('all')

  const summary = benchmarks?.benchmarks?.[activeBenchmark] || {}
  const models = Object.keys(summary)
  const taskList = tasks?.tasks || []
  const filtered = taskList.filter((t) =>
    filter === 'all' ? true : filter === 'complete' ? t.complete : !t.complete,
  )

  return (
    <div className="panel">
      <h2>基准测试</h2>
      <div className="tabs">
        {BENCHMARKS.map((b) => (
          <button
            key={b.id}
            className={b.id === activeBenchmark ? 'active' : ''}
            onClick={() => onSelectBenchmark(b.id)}
          >
            {b.label}
          </button>
        ))}
      </div>

      {benchmarks?.error && <div className="error-banner">{benchmarks.error}</div>}
      {tasks?.error && <div className="error-banner">{tasks.error}</div>}

      <table>
        <thead>
          <tr>
            <th>模型</th>
            {COUNTS.map((c) => <th key={c}>{COUNT_LABELS[c]}</th>)}
          </tr>
        </thead>
        <tbody>
          {models.map((m) => (
            <tr key={m}>
              <td className="mono">{m}</td>
              {COUNTS.map((c) => <td key={c}>{summary[m]?.[c] ?? 0}</td>)}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="filter">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            className={f.id === filter ? 'active' : ''}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
        <span className="dim" style={{ marginLeft: 8, alignSelf: 'center' }}>
          {filtered.length} / {taskList.length} 个任务
        </span>
      </div>

      <div className="matrix">
        <table>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.task}>
                <td className="task-name" title={t.task}>{shortName(t.task)}</td>
                <td>
                  {(t.cells || []).map((c, i) => (
                    <span
                      key={i}
                      className={`cell ${c.status}`}
                       title={`${c.model} attempt-${c.attempt}: ${STATUS_LABELS[c.status] || c.status}${c.error_kind ? ` (${c.error_kind})` : ''}`}
                    />
                  ))}
                  {t.complete && <span className="complete-check">✓</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
