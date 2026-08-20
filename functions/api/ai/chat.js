// POST /api/ai/chat ? ?? DeepSeek ???????? + ?? token ?? + ?????
import { cors, json, checkRateLimit, getDailyTokens, dailyTokenCap, recordEvent, FEATURE_WHITELIST } from '../../_shared.js'

function sanitizeMessages(messages) {
  return (Array.isArray(messages) ? messages : [])
    .slice(0, 30)
    .map(m => ({
      role: ['system', 'user', 'assistant'].includes(m && m.role) ? m.role : 'user',
      content: String((m && m.content) || '').slice(0, 8000),
    }))
    .filter(m => m.content.length > 0)
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: cors() })
}

export async function onRequestPost(context) {
  const apiKey = context.env.DEEPSEEK_API_KEY
  if (!apiKey) return json({ error: '?????? AI ??????????' }, 500)

  let body
  try { body = await context.request.json() } catch { return json({ error: '?????' }, 400) }

  const messages = sanitizeMessages(body.messages)
  if (messages.length === 0) return json({ error: '??????' }, 400)

  const maxTokens = Math.max(1, Math.min(Number(body.maxTokens) || 2000, 8000))
  const temperature = Number.isFinite(Number(body.temperature)) ? Number(body.temperature) : 0.7
  const stream = body.stream === true
  const model = String(body.model || 'deepseek-chat').slice(0, 50)
  const deviceId = String(body.deviceId || '').slice(0, 100)
  const feature = FEATURE_WHITELIST.has(body.feature) ? body.feature : null

  // ??????? 30 ?/??
  const rate = await checkRateLimit(context.env, deviceId || 'anon', 30)
  if (!rate.allowed) return json({ error: '????????????' }, 429)

  // ??????? token ??
  const used = await getDailyTokens(context.env)
  if (used >= dailyTokenCap(context.env)) return json({ error: 'AI ????????????' }, 429)

  const start = Date.now()
  const upstream = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey,
    },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature, stream }),
  })

  if (!upstream.ok) {
    const errText = await upstream.text().catch(() => '')
    await recordEvent(context.env, { deviceId, eventName: 'ai_request', feature, value: 0, extra: { model, success: false, via: 'app-proxy', status: upstream.status, durationMs: Date.now() - start } })
    return json({ error: 'AI ?????' + upstream.status + '???????' + (errText ? '?' + errText.slice(0, 120) : '') }, 502)
  }

  if (stream) {
    await recordEvent(context.env, { deviceId, eventName: 'ai_request', feature, value: 0, extra: { model, success: true, via: 'app-proxy', stream: true, durationMs: Date.now() - start } })
    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        ...cors(),
      },
    })
  }

  const data = await upstream.json()
  const reply = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content
  if (!reply) {
    await recordEvent(context.env, { deviceId, eventName: 'ai_request', feature, value: 0, extra: { model, success: false, via: 'app-proxy', durationMs: Date.now() - start } })
    return json({ error: 'AI ??????????' }, 502)
  }
  const usage = data.usage || {}
  const tokens = Number(usage.total_tokens) || 0
  await recordEvent(context.env, {
    deviceId, eventName: 'ai_request', feature, value: tokens,
    extra: { model, success: true, via: 'app-proxy', stream: false, durationMs: Date.now() - start, prompt_tokens: usage.prompt_tokens || 0, completion_tokens: usage.completion_tokens || 0 },
  })
  return json({ content: reply })
}
