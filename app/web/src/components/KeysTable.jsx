import React from 'react'

function toNum(v) {
  if (v == null || v === '-' || v === '') return null
  const n = Number(v)
  return Number.isNaN(n) ? null : n
}

function costToNum(v) {
  if (v == null || v === '-' || v === '') return null
  const n = Number(String(v).replace(/[$,]/g, ''))
  return Number.isNaN(n) ? null : n
}

export default function KeysTable({ data }) {
  if (!data) return null
  const keys = data.keys || []

  let totalUsed = 0
  let totalCost = 0
  for (const k of keys) {
    const used = toNum(k.creditsUsed)
    if (used != null) totalUsed += used
    const cost = costToNum(k.estimatedCost)
    if (cost != null) totalCost += cost
  }

  return (
    <div className="panel">
      <h2>API Keys</h2>
      {data.error && <div className="error-banner">{data.error}</div>}
      <table>
        <thead>
          <tr>
            <th>Key</th>
            <th>邮箱</th>
            <th>Plan</th>
            <th>Credits 用量</th>
            <th>超额</th>
            <th>预估费用</th>
            <th>重置日</th>
            <th>状态</th>
          </tr>
        </thead>
        <tbody>
          {keys.map((k) => {
            const used = toNum(k.creditsUsed)
            const allowance = toNum(k.planAllowance)
            const pct =
              used != null && allowance != null && allowance > 0
                ? Math.min((used / allowance) * 100, 100)
                : null
            return (
              <tr key={k.key}>
                <td className="mono">{k.key}</td>
                <td>{k.email}</td>
                <td>{k.plan}</td>
                <td>
                  <div className="usage">
                    <span>{k.creditsUsed} / {k.planAllowance}</span>
                    {pct != null && (
                      <span className="bar"><div style={{ width: pct + '%' }} /></span>
                    )}
                  </div>
                </td>
                <td>{k.overages}</td>
                <td>{k.estimatedCost}</td>
                <td>{k.nextReset}</td>
                <td className={k.status === 'ok' ? 'ok' : 'bad'}>{k.status}</td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3}>合计 ({keys.length} 个 key)</td>
            <td>{totalUsed.toLocaleString('en-US', { maximumFractionDigits: 2 })}</td>
            <td></td>
            <td>${totalCost.toLocaleString('en-US', { maximumFractionDigits: 2 })}</td>
            <td colSpan={2}></td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
