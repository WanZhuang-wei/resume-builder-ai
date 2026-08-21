import { authHeaders, setToken } from './auth'

async function request(path, options) {
  const res = await fetch(path, {
    ...options,
    headers: { ...(options && options.headers), ...authHeaders() },
  })
  if (res.status === 401) {
    // 会话失效/未登录 → 清空本地 token，回到登录页
    setToken('')
    throw new Error('未登录或登录已过期')
  }
  if (!res.ok) {
    const d = await res.json().catch(() => ({}))
    throw new Error(d.error || ('HTTP ' + res.status))
  }
  return res.json()
}

export const api = {
  summary: (days = 30) => request('/api/admin/summary?days=' + days),
  shares: (params = {}) => request('/api/admin/shares?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null)).toString()),
  shareAction: (id, action) => request('/api/admin/shares/' + encodeURIComponent(id) + '/' + encodeURIComponent(action), { method: 'POST' }),
  aiUsage: (days = 14) => request('/api/admin/ai/usage?days=' + days),
}

export const CSV_URL = '/api/admin/export/shares.csv'
