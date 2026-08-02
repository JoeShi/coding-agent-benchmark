const BASE = ''

export async function fetchJSON(path) {
  const res = await fetch(BASE + path)
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} (${path})`)
  }
  return res.json()
}

export const getOverview = () => fetchJSON('/api/overview')
export const getWorkers = () => fetchJSON('/api/workers')
export const getKeys = () => fetchJSON('/api/keys')
export const getBenchmarks = () => fetchJSON('/api/benchmarks')
export const getTasks = (benchmark) =>
  fetchJSON(`/api/tasks?benchmark=${encodeURIComponent(benchmark)}`)
