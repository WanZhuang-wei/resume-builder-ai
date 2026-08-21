// POST /api/share/:id/chat — HR 提问：限流 + 次数扣减 + DeepSeek 代理 + AI 用量记录
import { cors, json, nowMs, getShare, parseSessions, updateShare, kvPut, incrementShareCounters, recordEvent, checkRateLimit, getDailyTokens, dailyTokenCap } from '../../../_shared.js'

export async function onRequestOptions() { return new Response(null, { status: 204, headers: cors() }) }

export async function onRequestPost(context) {
  const id = context.params.id
  if (!id) return json({ error: '缺少分享 ID' }, 400)

  const share = await getShare(context.env, id)
  if (!share.payload && !share.meta) return json({ error: '分享链接不存在' }, 404)
  if (share.status === 'revoked' || share.status === 'expired') return json({ error: '分享链接不存在或已过期' }, 404)

  let body
  try { body = await context.request.json() } catch { return json({ error: '请求体无效' }, 400) }

  const hrKey = String(body.hrKey || '')
  if (!hrKey) return json({ error: '缺少访问者标识' }, 400)
  const messages = Array.isArray(body.messages) ? body.messages : null
  if (!messages || messages.length === 0) return json({ error: '缺少对话内容' }, 400)

  const apiKey = context.env.DEEPSEEK_API_KEY
  if (!apiKey) return json({ error: '服务器未配置 AI 密钥，请联系候选人' }, 500)

  // 防滥用：每设备 20 次/分钟
  const rate = await checkRateLimit(context.env, hrKey, 20)
  if (!rate.allowed) return json({ error: '操作过于频繁，请稍后再试', remaining: 0 }, 429)

  // 成本护栏：每日 token 上限
  const used = await getDailyTokens(context.env)
  if (used >= dailyTokenCap(context.env)) return json({ error: 'AI 服务当前繁忙，请稍后再试', remaining: 0 }, 429)

  // 扣减提问次数（D1 sessions）
  const sessions = parseSessions(share.meta)
  let session = sessions.find(s => s.hrKey === hrKey)
  if (!session) { session = { hrKey, count: 0, lastAskedAt: null }; sessions.push(session) }
  const max = share.meta ? share.meta.max_questions : (share.payload?.maxQuestions || 3)
  if (session.count >= max) return json({ error: '提问次数已用完，请联系候选人刷新次数', remaining: 0, max }, 429)
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

  // 调用 DeepSeek
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
      return json({ error: 'AI 服务错误（' + resp.status + '），请联系候选人' }, 502)
    }
    const data = await resp.json()
    const reply = data.choices?.[0]?.message?.content
    if (!reply) {
      await recordEvent(context.env, { deviceId: hrKey, eventName: 'ai_request', shareId: id, value: 0, extra: { model: 'deepseek-chat', success: false, via: 'share-chat', durationMs: nowMs() - start } })
      return json({ error: 'AI 返回内容为空，请重试' }, 502)
    }
    const usage = data.usage || {}
    const tokens = Number(usage.total_tokens) || 0
    await recordEvent(context.env, { deviceId: hrKey, eventName: 'ai_request', shareId: id, value: tokens, extra: { model: 'deepseek-chat', success: true, via: 'share-chat', durationMs: nowMs() - start, prompt_tokens: usage.prompt_tokens || 0, completion_tokens: usage.completion_tokens || 0 } })
    return json({ reply, remaining: Math.max(0, max - session.count), max })
  } catch (e) {
    await recordEvent(context.env, { deviceId: hrKey, eventName: 'ai_request', shareId: id, value: 0, extra: { model: 'deepseek-chat', success: false, via: 'share-chat', durationMs: nowMs() - start } })
    return json({ error: 'AI 服务调用失败，请稍后重试' }, 502)
  }
}
