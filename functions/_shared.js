// ?????D1/KV ????????????TTL?Pages Functions ???????????
export const EVENT_WHITELIST = new Set(['app_open', 'feature_use', 'share_create', 'share_view', 'share_ask', 'ai_request'])
export const FEATURE_WHITELIST = new Set(['auto_fill', 'resume_generate', 'job_analyze', 'job_collect', 'qa'])
export const DEFAULT_TTL_MS = 40 * 24 * 60 * 60 * 1000
export const EXTEND_MS = 30 * 24 * 60 * 60 * 1000
export const LEGACY_TTL_MS = 30 * 24 * 60 * 60 * 1000
export const EVENT_RETENTION_MS = 90 * 24 * 60 * 60 * 1000
export const DEFAULT_MAX_QUESTIONS = 3
export const AI_DAILY_TOKEN_CAP_DEFAULT = 500000

export function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}
export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=UTF-8', ...cors() },
  })
}
export function nowMs() { return Date.now() }
export function rateBucket(now, windowSec = 60) {
  return Math.floor(now / 1000 / windowSec) * windowSec
}
export function extendExpiry(currentMs, now = nowMs(), addMs = EXTEND_MS) {
  const cur = Number.isFinite(Number(currentMs)) ? Number(currentMs) : 0
  return Math.max(now, cur) + addMs
}
export function isShareActive(meta, now = nowMs()) {
  return !!meta && meta.status === 'active' && (!meta.expires_at || now <= Number(meta.expires_at))
}

export function clampInt(value, min, max, fallback) {
  const n = parseInt(value, 10)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, n))
}

// ---------- KV ----------
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

// ---------- D1 ----------
export function hasDb(env) { return !!env.ANALYTICS_DB }
export async function getShareMeta(env, id) {
  if (!hasDb(env)) return null
  try {
    return (await env.ANALYTICS_DB.prepare('SELECT * FROM shares WHERE id = ?').bind(id).first()) || null
  } catch { return null }
}
export async function insertShare(env, { id, fingerprint, expiresAtMs, maxQuestions, manageToken, createdAtMs, sessions }) {
  if (!hasDb(env)) return
  await env.ANALYTICS_DB.prepare(
    'INSERT INTO shares (id, fingerprint, created_at, expires_at, status, max_questions, manage_token, view_count, ask_count, sessions) VALUES (?,?,?,?,?,?,?,0,0,?)'
  ).bind(id, fingerprint || '', createdAtMs, expiresAtMs, 'active', maxQuestions, manageToken, JSON.stringify(sessions || [])).run()
}
export async function findShareByFingerprint(env, fingerprint) {
  if (!hasDb(env) || !fingerprint) return null
  try {
    return (await env.ANALYTICS_DB.prepare(
      "SELECT id, manage_token, created_at, expires_at, max_questions FROM shares WHERE fingerprint = ? AND status = 'active' AND expires_at > ? ORDER BY created_at DESC LIMIT 1"
    ).bind(fingerprint, nowMs()).first()) || null
  } catch { return null }
}
export function parseSessions(meta) {
  if (!meta) return []
  try {
    const arr = JSON.parse(meta.sessions || '[]')
    return Array.isArray(arr) ? arr : []
  } catch { return [] }
}
export async function updateShare(env, id, fields) {
  if (!hasDb(env)) return
  try {
    if (fields.status) await env.ANALYTICS_DB.prepare('UPDATE shares SET status = ? WHERE id = ?').bind(fields.status, id).run()
    if (fields.expiresAtMs) await env.ANALYTICS_DB.prepare('UPDATE shares SET expires_at = ? WHERE id = ?').bind(fields.expiresAtMs, id).run()
    if (fields.sessions !== undefined) {
      await env.ANALYTICS_DB.prepare('UPDATE shares SET sessions = ?, max_questions = ? WHERE id = ?')
        .bind(JSON.stringify(fields.sessions), fields.maxQuestions || DEFAULT_MAX_QUESTIONS, id).run()
    }
  } catch {}
}
export async function deleteShare(env, id) {
  if (hasDb(env)) { try { await env.ANALYTICS_DB.prepare('DELETE FROM shares WHERE id = ?').bind(id).run() } catch {} }
  await kvDelete(env, id)
}
export async function incrementShareCounters(env, id, { view = false, ask = false }) {
  if (!hasDb(env)) return
  const t = nowMs()
  try {
    if (view) await env.ANALYTICS_DB.prepare('UPDATE shares SET view_count = view_count + 1, last_viewed_at = ? WHERE id = ?').bind(t, id).run()
    if (ask) await env.ANALYTICS_DB.prepare('UPDATE shares SET ask_count = ask_count + 1, last_asked_at = ? WHERE id = ?').bind(t, id).run()
  } catch {}
}

// ---------- ?????D1 + KV ??? / ???????? ----------
export async function getShare(env, id) {
  const payload = await kvGet(env, id)
  let meta = await getShareMeta(env, id)
  if (!meta && payload) {
    meta = await migrateLegacy(env, id, payload)
  }
  if (meta) {
    if (meta.status === 'revoked') return { meta, payload, status: 'revoked' }
    if (Number.isFinite(meta.expires_at) && nowMs() > meta.expires_at) return { meta, payload, status: 'expired' }
    if (!payload) return { meta, payload: null, status: 'missing' }
    return { meta, payload, status: 'ok' }
  }
  if (!payload) return { meta: null, payload: null, status: 'missing' }
  const created = new Date(payload.createdAt).getTime()
  if (Number.isFinite(created) && nowMs() - created > LEGACY_TTL_MS) return { meta: null, payload, status: 'expired' }
  return { meta: null, payload, status: 'ok' }
}

export async function migrateLegacy(env, id, payload) {
  if (!hasDb(env)) return null
  const createdAtMs = new Date(payload.createdAt).getTime() || nowMs()
  const sessions = Array.isArray(payload.sessions) ? payload.sessions : []
  const maxQuestions = payload.maxQuestions || DEFAULT_MAX_QUESTIONS
  try {
    await insertShare(env, {
      id,
      fingerprint: '',
      expiresAtMs: createdAtMs + LEGACY_TTL_MS,
      maxQuestions,
      manageToken: payload.manageToken || '',
      createdAtMs,
      sessions,
    })
    return await getShareMeta(env, id)
  } catch { return null }
}

// ---------- ?? ----------
export async function recordEvent(env, { deviceId, eventName, shareId, feature, value, extra, ts }) {
  if (!hasDb(env)) return
  const t = ts || nowMs()
  const device = String(deviceId || '').slice(0, 100)
  if (!EVENT_WHITELIST.has(eventName)) return
  if (feature && !FEATURE_WHITELIST.has(feature)) feature = null
  let extraStr = null
  if (extra) { try { extraStr = JSON.stringify(extra).slice(0, 2000) } catch {} }
  const val = Number.isFinite(Number(value)) ? Number(value) : null
  try {
    await env.ANALYTICS_DB.batch([
      env.ANALYTICS_DB.prepare('INSERT INTO events (ts, device_id, event_name, share_id, feature, value, extra) VALUES (?,?,?,?,?,?,?)')
        .bind(t, device, eventName, shareId || null, feature || null, val, extraStr),
      env.ANALYTICS_DB.prepare('INSERT INTO devices (device_id, first_seen, last_seen) VALUES (?,?,?) ON CONFLICT(device_id) DO UPDATE SET last_seen = excluded.last_seen')
        .bind(device, t, t),
    ])
  } catch {}
}

// ---------- ?? ----------
export async function checkRateLimit(env, deviceId, limit, windowSec = 60) {
  if (!hasDb(env)) return { allowed: true, count: 0 }
  const device = String(deviceId || 'unknown').slice(0, 100)
  const bucket = rateBucket(nowMs(), windowSec)
  try {
    await env.ANALYTICS_DB.prepare('INSERT INTO rate_limits (device_id, bucket, count) VALUES (?,?,1) ON CONFLICT(device_id, bucket) DO UPDATE SET count = count + 1')
      .bind(device, bucket).run()
    const row = await env.ANALYTICS_DB.prepare('SELECT count FROM rate_limits WHERE device_id = ? AND bucket = ?').bind(device, bucket).first()
    const count = row ? Number(row.count) : 1
    return { allowed: count <= limit, count }
  } catch { return { allowed: true, count: 0 } }
}

// ---------- AI ?? ----------
export async function getDailyTokens(env) {
  if (!hasDb(env)) return 0
  const dayStart = new Date()
  dayStart.setUTCHours(0, 0, 0, 0)
  try {
    const row = await env.ANALYTICS_DB.prepare("SELECT COALESCE(SUM(value),0) AS total FROM events WHERE event_name = 'ai_request' AND ts >= ?").bind(dayStart.getTime()).first()
    return row ? Number(row.total) : 0
  } catch { return 0 }
}
export function dailyTokenCap(env) {
  const n = Number(env.AI_DAILY_TOKEN_CAP || AI_DAILY_TOKEN_CAP_DEFAULT)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : AI_DAILY_TOKEN_CAP_DEFAULT
}

// ---------- ???90 ????2 ????? ----------
export async function cleanupOldData(env) {
  if (!hasDb(env)) return
  const cutoff = nowMs() - EVENT_RETENTION_MS
  try {
    await env.ANALYTICS_DB.batch([
      env.ANALYTICS_DB.prepare('DELETE FROM events WHERE ts < ?').bind(cutoff),
      env.ANALYTICS_DB.prepare('DELETE FROM rate_limits WHERE bucket < ?').bind(Math.floor(cutoff / 1000)),
    ])
  } catch {}
}
