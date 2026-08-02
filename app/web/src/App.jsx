import React, { useCallback, useEffect, useState } from 'react'
import { getOverview, getWorkers, getKeys, getBenchmarks, getTasks } from './api.js'
import OverviewCards from './components/OverviewCards.jsx'
import RunSpecifications from './components/RunSpecifications.jsx'
import KeysTable from './components/KeysTable.jsx'
import WorkersTable from './components/WorkersTable.jsx'
import BenchmarkPanel from './components/BenchmarkPanel.jsx'

const INTERVALS = [
  { label: '5s', ms: 5000 },
  { label: '15s', ms: 15000 },
  { label: '30s', ms: 30000 },
  { label: '60s', ms: 60000 },
  { label: '暂停', ms: null },
]

export default function App() {
  const [intervalMs, setIntervalMs] = useState(15000)
  const [overview, setOverview] = useState(null)
  const [workers, setWorkers] = useState(null)
  const [keys, setKeys] = useState(null)
  const [benchmarks, setBenchmarks] = useState(null)
  const [tasks, setTasks] = useState(null)
  const [activeBenchmark, setActiveBenchmark] = useState('terminal-bench-2')
  const [lastUpdated, setLastUpdated] = useState(null)
  const [fetchError, setFetchError] = useState(null)

  const refresh = useCallback(async () => {
    try {
      const [ov, wk, ks, bm, tk] = await Promise.all([
        getOverview(),
        getWorkers(),
        getKeys(),
        getBenchmarks(),
        getTasks(activeBenchmark),
      ])
      setOverview(ov)
      setWorkers(wk)
      setKeys(ks)
      setBenchmarks(bm)
      setTasks(tk)
      setLastUpdated(new Date())
      setFetchError(null)
    } catch (err) {
      // keep last good data, just show the error
      setFetchError(err.message || String(err))
    }
  }, [activeBenchmark])

  useEffect(() => {
    refresh()
    if (intervalMs == null) return
    const id = setInterval(refresh, intervalMs)
    return () => clearInterval(id)
  }, [refresh, intervalMs])

  const fmtTime = (d) =>
    d
      ? [d.getHours(), d.getMinutes(), d.getSeconds()]
          .map((n) => String(n).padStart(2, '0'))
          .join(':')
      : '-'

  return (
    <div className="app">
      <div className="toolbar">
        <h1>kiro-bench dashboard</h1>
        {overview?.run_id && <span className="run-id">{overview.run_id}</span>}
        <span className="spacer" />
        <select
          value={String(intervalMs)}
          onChange={(e) =>
            setIntervalMs(e.target.value === 'null' ? null : Number(e.target.value))
          }
        >
          {INTERVALS.map((i) => (
            <option key={i.label} value={String(i.ms)}>
              {i.label}
            </option>
          ))}
        </select>
        <button onClick={refresh}>刷新</button>
        <span className="updated">最后更新 {fmtTime(lastUpdated)}</span>
      </div>

      {fetchError && <div className="error-banner">请求失败: {fetchError}</div>}

      <OverviewCards overview={overview} />
      <RunSpecifications />
      <KeysTable data={keys} />
      <WorkersTable data={workers} />
      <BenchmarkPanel
        benchmarks={benchmarks}
        tasks={tasks}
        activeBenchmark={activeBenchmark}
        onSelectBenchmark={setActiveBenchmark}
      />
    </div>
  )
}
