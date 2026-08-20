// POST /api/ai/chat — 通用 DeepSeek 服务器代理（key 只存服务器端，前端无需配置）
// 支持普通对话与流式（SSE）两种模式，供主应用 AI 简历生成 / 自动填写 / 岗位分析 / 智能问答使用

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=UTF-8', ...cors() },
  })
}
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
  if (!apiKey) return json({ error: '服务器未配置 AI 密钥，请联系管理员在设置中配置' }, 500)

  let body
  try { body = await context.request.json() } catch { return json({ error: '请求体无效' }, 400) }

  const messages = sanitizeMessages(body.messages)
  if (messages.length === 0) return json({ error: '缺少对话内容' }, 400)

  const maxTokens = Math.max(1, Math.min(Number(body.maxTokens) || 2000, 8000))
  const temperature = Number.isFinite(Number(body.temperature)) ? Number(body.temperature) : 0.7
  const stream = body.stream === true
  const model = String(body.model || 'deepseek-chat').slice(0, 50)

  const upstream = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
      stream,
    }),
  })

  if (!upstream.ok) {
    const errText = await upstream.text().catch(() => '')
    return json({ error: 'AI 服务错误（' + upstream.status + '），请稍后重试' + (errText ? '：' + errText.slice(0, 120) : '') }, 502)
  }

  if (stream) {
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
  if (!reply) return json({ error: 'AI 返回内容为空，请重试' }, 502)
  return json({ content: reply })
}