// POST /api/share — 创建/复用分享记录（稳定链接 + 40 天 TTL + 生命周期管理）
import { cors, json, nowMs, clampInt, DEFAULT_TTL_MS, DEFAULT_MAX_QUESTIONS, insertShare, findShareByFingerprint, updateShare, kvPut, recordEvent } from '../../_shared.js'

const CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789'
const ID_LENGTH = 8
const TOKEN_LENGTH = 16

function generateId(len) {
  let id = ''
  for (let i = 0; i < len; i++) id += CHARS[Math.floor(Math.random() * CHARS.length)]
  return id
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: cors() })
}

export async function onRequestPost(context) {
  let body
  try { body = await context.request.json() } catch { return json({ error: '请求体不是有效的 JSON' }, 400) }
  if (!body?.profile) return json({ error: '无效的分享数据' }, 400)

  const now = nowMs()
  const deviceId = String(body.deviceId || '').slice(0, 100)
  const fingerprint = String(body.fingerprint || '').slice(0, 128)
  const forceNew = body.forceNew === true
  const maxQuestions = clampInt(body.maxQuestions, 1, 100, DEFAULT_MAX_QUESTIONS)
  const shareData = {
    profile: body.profile,
    contact: body.contact && typeof body.contact === 'object' ? body.contact : {},
  }
  const origin = new URL(context.request.url).origin

  // 稳定链接：同指纹 + active + 未过期 → 复用同一 id（顺带续期 40 天）
  if (!forceNew && fingerprint) {
    const existing = await findShareByFingerprint(context.env, fingerprint)
    if (existing) {
      const expiresAtMs = now + DEFAULT_TTL_MS
      const payload = {
        data: shareData,
        createdAt: new Date(existing.created_at).toISOString(),
        manageToken: existing.manage_token,
        maxQuestions: existing.max_questions || maxQuestions,
      }
      await kvPut(context.env, existing.id, payload, expiresAtMs)
      await updateShare(context.env, existing.id, { expiresAtMs })
      await recordEvent(context.env, { deviceId, eventName: 'share_create', shareId: existing.id, value: 1, extra: { reused: true } })
      return json({ id: existing.id, manageToken: existing.manage_token, url: origin + '/#/hr/' + existing.id, reused: true })
    }
  }

  const id = generateId(ID_LENGTH)
  const manageToken = generateId(TOKEN_LENGTH)
  const expiresAtMs = now + DEFAULT_TTL_MS
  const payload = { data: shareData, createdAt: new Date(now).toISOString(), manageToken, maxQuestions }
  await insertShare(context.env, { id, fingerprint, expiresAtMs, maxQuestions, manageToken, createdAtMs: now, sessions: [] })
  await kvPut(context.env, id, payload, expiresAtMs)
  await recordEvent(context.env, { deviceId, eventName: 'share_create', shareId: id, value: 1 })
  return json({ id, manageToken, url: origin + '/#/hr/' + id, reused: false })
}
