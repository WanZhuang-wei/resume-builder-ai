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

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000

export async function createSession(env, username) {
  const token = (globalThis.crypto && typeof crypto.randomUUID === 'function')
    ? crypto.randomUUID()
    : 's' + Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2)
  const expiresAt = Date.now() + SESSION_TTL_MS
  await env.SHARES_KV.put('admin_session:' + token, JSON.stringify({ username, expiresAt }), { expiration: Math.floor(expiresAt / 1000) })
  return { token, expiresAt }
}

export async function getSession(env, token) {
  if (!token) return null
  try {
    const raw = await env.SHARES_KV.get('admin_session:' + token)
    if (!raw) return null
    const s = JSON.parse(raw)
    if (!s || Date.now() > Number(s.expiresAt || 0)) {
      await env.SHARES_KV.delete('admin_session:' + token).catch(() => {})
      return null
    }
    return s
  } catch { return null }
}

export async function deleteSession(env, token) {
  if (!token) return
  try { await env.SHARES_KV.delete('admin_session:' + token) } catch {}
}

export async function checkLoginRate(env, ip, limit, windowSec = 600) {
  if (!env.ANALYTICS_DB) return { allowed: true }
  const device = 'login:' + String(ip || 'unknown').slice(0, 100)
  const bucket = Math.floor(Date.now() / 1000 / windowSec) * windowSec
  try {
    await env.ANALYTICS_DB.prepare('INSERT INTO rate_limits (device_id, bucket, count) VALUES (?,?,1) ON CONFLICT(device_id, bucket) DO UPDATE SET count = count + 1').bind(device, bucket).run()
    const row = await env.ANALYTICS_DB.prepare('SELECT count FROM rate_limits WHERE device_id = ? AND bucket = ?').bind(device, bucket).first()
    return { allowed: Number(row ? row.count : 1) <= limit }
  } catch { return { allowed: true } }
}

export async function requireAdmin(context) {
  const header = context.request.headers.get('Cf-Access-Authenticated-User-Email') || ''
  if (header && header.toLowerCase() === ADMIN_EMAIL.toLowerCase()) return true
  const auth = context.request.headers.get('Authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  return !!(await getSession(context.env, token))
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
