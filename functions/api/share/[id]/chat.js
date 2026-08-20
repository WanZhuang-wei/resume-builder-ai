// POST /api/share/:id/chat ? HR ????? + ???? + DeepSeek ?? + AI ????
import { cors, json, nowMs, getShare, parseSessions, updateShare, kvPut, incrementShareCounters, recordEvent, checkRateLimit, getDailyTokens, dailyTokenCap } from '../../../_shared.js'

export async function onRequestOptions() { return new Response(null, { status: 204, headers: cors() }) }

export async function onRequestPost(context) {
  const id = context.params.id
  if (!id) return json({ error: '???? ID' }, 400)

  const share = await getShare(context.env, id)
  if (!share.payload && !share.meta) return json({ error: '???????' }, 404)
  if (share.status === 'revoked' || share.status === 'expired') return json({ error: '???????????' }, 404)

  let body
  try { body = await context.request.json() } catch { return json({ error: '?????' }, 400) }

  const hrKey = String(body.hrKey || '')
  if (!hrKey) return json({ error: '???????' }, 400)
  const messages = Array.isArray(body.messages) ? body.messages : null
  if (!messages || messages.length === 0) return json({ error: '??????' }, 400)

  const apiKey = context.env.DEEPSEEK_API_KEY
  if (!apiKey) return json({ error: '?????? AI ?????????' }, 500)

  // ??????? 20 ?/??
  const rate = await checkRateLimit(context.env, hrKey, 20)
  if (!rate.allowed) return json({ error: '????????????', remaining: 0 }, 429)

  // ??????? token ??
  const used = await getDailyTokens(context.env)
  if (used >= dailyTokenCap(context.env)) return json({ error: 'AI ????????????', remaining: 0 }, 429)

  // ???????D1 sessions?
  const sessions = parseSessions(share.meta)
  let session = sessions.find(s => s.hrKey === hrKey)
  if (!session) { session = { hrKey, count: 0, lastAskedAt: null }; sessions.push(session) }
  const max = share.meta ? share.meta.max_questions : (share.payload?.maxQuestions || 3)
  if (session.count >= max) return json({ error: '??????????????????', remaining: 0, max }, 429)
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

  // ?? DeepSeek
  const safeMessages = messages.slice(0, 20).map(m => ({
    role: ['system', 'user', 'assistant'].includes(m.role) ? m.role : 'user',
    content: String(m.content || '').slice(0, 8000)
  }))
  const start = nowMs()
  try {
    const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({ model: 'deepseek-chat', messages: safeMessages, max_tokens: 500, temperature: 0.3 })
    })
    if (!resp.ok) {
      const errText = await resp.text().catch(() => '')
      await recordEvent(context.env, { deviceId: hrKey, eventName: 'ai_request', shareId: id, value: 0, extra: { model: 'deepseek-chat', success: false, via: 'share-chat', status: resp.status, durationMs: nowMs() - start } })
      return json({ error: 'AI ?????' + resp.status + '????????' }, 502)
    }
    const data = await resp.json()
    const reply = data.choices?.[0]?.message?.content
    if (!reply) {
      await recordEvent(context.env, { deviceId: hrKey, eventName: 'ai_request', shareId: id, value: 0, extra: { model: 'deepseek-chat', success: false, via: 'share-chat', durationMs: nowMs() - start } })
      return json({ error: 'AI ??????????' }, 502)
    }
    const usage = data.usage || {}
    const tokens = Number(usage.total_tokens) || 0
    await recordEvent(context.env, { deviceId: hrKey, eventName: 'ai_request', shareId: id, value: tokens, extra: { model: 'deepseek-chat', success: true, via: 'share-chat', durationMs: nowMs() - start, prompt_tokens: usage.prompt_tokens || 0, completion_tokens: usage.completion_tokens || 0 } })
    return json({ reply, remaining: Math.max(0, max - session.count), max })
  } catch (e) {
    await recordEvent(context.env, { deviceId: hrKey, eventName: 'ai_request', shareId: id, value: 0, extra: { model: 'deepseek-chat', success: false, via: 'share-chat', durationMs: nowMs() - start } })
    return json({ error: 'AI ????????????' }, 502)
  }
}
