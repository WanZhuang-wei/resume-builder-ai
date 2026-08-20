// admin 共享：Access 鉴权 + D1/KV 工具 + 清理
export const ADMIN_EMAIL = '3519543133@qq.com'
export const EXTEND_MS = 30 * 24 * 60 * 60 * 1000
export const EVENT_RETENTION_MS = 90 * 24 * 60 * 60 * 1000

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
  })
}

export function requireAdmin(context) {
  const header = context.request.headers.get('Cf-Access-Authenticated-User-Email') || ''
  if (header && header.toLowerCase() === ADMIN_EMAIL.toLowerCase()) return true
  const envKey = context.env && context.env.ADMIN_API_KEY
  const key = context.request.headers.get('X-Admin-Key') || ''
  return !!(envKey && key && key === envKey)
}

export function extendExpiry(currentMs, now = Date.now(), addMs = EXTEND_MS) {
  const cur = Number.isFinite(Number(currentMs)) ? Number(currentMs) : 0
  return Math.max(now, cur) + addMs
}

export function clampInt(value, min, max, fallback) {
  const n = parseInt(value, 10)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, n))
}

export async function kvGet(env, id) {
  try {
    const raw = await env.SHARES_KV.get('share:' + id)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}
export async function kvPut(env, id, value, expiresAtMs) {
  const options = expiresAtMs ? { expiration: Math.floor(expiresAtMs / 1000) } : undefined
  await env.SHARES_KV.put('share:' + id, JSON.stringify(value), options)
}
export async function kvDelete(env, id) {
  try { await env.SHARES_KV.delete('share:' + id) } catch {}
}

export async function cleanupOldData(env) {
  if (!env.ANALYTICS_DB) return
  const cutoff = Date.now() - EVENT_RETENTION_MS
  try {
    await env.ANALYTICS_DB.batch([
      env.ANALYTICS_DB.prepare('DELETE FROM events WHERE ts < ?').bind(cutoff),
      env.ANALYTICS_DB.prepare('DELETE FROM rate_limits WHERE bucket < ?').bind(Math.floor(cutoff / 1000)),
    ])
  } catch {}
}
