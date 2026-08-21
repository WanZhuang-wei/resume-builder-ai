// POST /api/share/:id/ask — HR 提问扣减次数（D1 sessions）
import { cors, json, nowMs, getShare, parseSessions, updateShare, kvPut, incrementShareCounters, recordEvent } from '../../../_shared.js'

export async function onRequestOptions() { return new Response(null, { status: 204, headers: cors() }) }

export async function onRequestPost(context) {
  const id = context.params.id
  if (!id) return json({ error: '缺少分享 ID' }, 400)
  let body
  try { body = await context.request.json() } catch { return json({ error: '请求体无效' }, 400) }
  const hrKey = String(body.hrKey || '')
  if (!hrKey) return json({ error: '缺少访问者标识' }, 400)

  const share = await getShare(context.env, id)
  if (!share.payload && !share.meta) return json({ error: '分享链接不存在' }, 404)
  if (share.status === 'revoked' || share.status === 'expired') return json({ error: '分享链接不存在或已过期' }, 404)

  const sessions = parseSessions(share.meta)
  let session = sessions.find(s => s.hrKey === hrKey)
  if (!session) { session = { hrKey, count: 0, lastAskedAt: null }; sessions.push(session) }
  const max = share.meta ? share.meta.max_questions : (share.payload?.maxQuestions || 3)
  if (session.count >= max) return json({ error: '提问次数已用完', remaining: 0, max }, 429)

  session.count++
  session.lastAskedAt = new Date(nowMs()).toISOString()

  if (share.meta) {
    await updateShare(context.env, id, { sessions, maxQuestions: max })
    await incrementShareCounters(context.env, id, { ask: true })
  } else if (share.payload) {
    share.payload.sessions = sessions
    await kvPut(context.env, id, share.payload)
  }
  await recordEvent(context.env, { deviceId: hrKey, eventName: 'share_ask', shareId: id, value: 1 })
  return json({ remaining: Math.max(0, max - session.count), max })
}
