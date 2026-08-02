import React from 'react'

function fmtTime(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

function hoursSince(iso) {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  return (Date.now() - t) / 3600000
}

export default function WorkersTable({ data }) {
  if (!data) return null
  const workers = [...(data.workers || [])].sort(
    (a, b) => new Date(a.launched).getTime() - new Date(b.launched).getTime(),
  )

  return (
    <div className="panel">
      <h2>Workers ({workers.length})</h2>
      {data.error && <div className="error-banner">{data.error}</div>}
      <table>
        <thead>
          <tr>
            <th>实例</th>
            <th>机型</th>
            <th>AZ</th>
            <th>状态</th>
            <th>SSM</th>
            <th>启动时间</th>
            <th>运行时长</th>
          </tr>
        </thead>
        <tbody>
          {workers.map((w) => {
            const hrs = hoursSince(w.launched)
            return (
              <tr key={w.id}>
                <td className="mono">{w.id}</td>
                <td>{w.type}</td>
                <td>{w.az}</td>
                <td className={w.state === 'running' ? 'ok' : 'bad'}>{w.state}</td>
                <td className={w.ssm === 'Online' ? 'ok' : 'dim'}>{w.ssm}</td>
                <td>{fmtTime(w.launched)}</td>
                <td>{hrs != null ? hrs.toFixed(1) + ' h' : '-'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
