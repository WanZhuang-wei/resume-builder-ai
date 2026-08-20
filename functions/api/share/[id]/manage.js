// GET/POST /api/share/:id/manage ? ??????????????????????
import { cors, json, nowMs, clampInt, EXTEND_MS, LEGACY_TTL_MS, DEFAULT_MAX_QUESTIONS, getShare, parseSessions, updateShare, kvPut, kvDelete, deleteShare, extendExpiry } from '../../../_shared.js'

function checkToken(share, token) {
  const expected = share.meta?.manage_token || share.payload?.manageToken || ''
  return !!expected && expected === String(token || '')
}

function buildResponse(share, id) {
  const meta = share.meta
  const sessions = parseSessions(meta)
  const total = sessions.reduce((sum, s) => sum + (s.count || 0), 0)
  const createdAt = meta ? new Date(meta.created_at).toISOString() : (share.payload?.createdAt || '')
  const expiresAtMs = meta ? meta.expires_at : null
  const maxQuestions = meta ? meta.max_questions : (share.payload?.maxQuestions || DEFAULT_MAX_QUESTIONS)
  return {
    id,
    createdAt,
    expiresAt: expiresAtMs ? new Date(expiresAtMs).toISOString() : null,
    status: meta ? meta.status : 'active',
    maxQuestions,
    totalQuestions: total,
    sessionCount: sessions.length,
    sessions: sessions.map(s => ({ ...s })),
    viewCount: meta ? meta.view_count : 0,
    askCount: meta ? meta.ask_count : total,
  }
}

export async function onRequestOptions() { return new Response(null, { status: 204, headers: cors() }) }

export async function onRequestGet(context) {
  const id = context.params.id
  if (!id) return json({ error: '???? ID' }, 400)
  const share = await getShare(context.env, id)
  if (!share.payload && !share.meta) return json({ error: '???????' }, 404)
  if (!checkToken(share, new URL(context.request.url).searchParams.get('token'))) return json({ error: '??????' }, 403)
  return json(buildResponse(share, id))
}

export async function onRequestPost(context) {
  const id = context.params.id
  if (!id) return json({ error: '???? ID' }, 400)
  let body
  try { body = await context.request.json() } catch { return json({ error: '?????' }, 400) }
  const share = await getShare(context.env, id)
  if (!share.payload && !share.meta) return json({ error: '???????' }, 404)
  if (!checkToken(share, body.token)) return json({ error: '??????' }, 403)

  const sessions = parseSessions(share.meta)
  let maxQuestions = share.meta ? share.meta.max_questions : (share.payload?.maxQuestions || DEFAULT_MAX_QUESTIONS)

  // ??????
  if (body.action === 'revoke') {
    await updateShare(context.env, id, { status: 'revoked' })
    await kvDelete(context.env, id)
    return json({ ok: true, status: 'revoked' })
  }
  if (body.action === 'delete') {
    await deleteShare(context.env, id)
    return json({ ok: true, deleted: true })
  }
  if (body.action === 'extend') {
    const current = share.meta ? Number(share.meta.expires_at) : (new Date(share.payload?.createdAt).getTime() + LEGACY_TTL_MS)
    const next = extendExpiry(current, nowMs(), EXTEND_MS)
    await updateShare(context.env, id, { expiresAtMs: next })
    if (share.payload) await kvPut(context.env, id, share.payload, next)
    return json({ ok: true, expiresAt: new Date(next).toISOString() })
  }

  // ??/????
  let changed = false
  if (body.resetAll === true) { sessions.splice(0); changed = true }
  else if (body.resetHrKey) {
    const idx = sessions.findIndex(s => s.hrKey === String(body.resetHrKey))
    if (idx >= 0) { sessions.splice(idx, 1); changed = true }
  }
  if (body.maxQuestions !== undefined) {
    const max = clampInt(body.maxQuestions, 1, 100, DEFAULT_MAX_QUESTIONS)
    if (max !== maxQuestions) { maxQuestions = max; changed = true }
  }
  if (changed) {
    if (share.meta) {
      await updateShare(context.env, id, { sessions, maxQuestions })
    } else if (share.payload) {
      share.payload.sessions = sessions
      share.payload.maxQuestions = maxQuestions
      await kvPut(context.env, id, share.payload)
    }
  }
  return json(buildResponse(share, id))
}
