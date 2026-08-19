// POST /api/share/:id/chat — HR 提问：服务器端代理调用 DeepSeek（key 只存服务器）

function cors() {
  return { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=UTF-8', ...cors() } })
}
async function getRecord(env, id) {
  const raw = await env.SHARES_KV.get('share:' + id)
  return raw ? JSON.parse(raw) : null
}

export async function onRequestOptions() { return new Response(null, { status: 204, headers: cors() }) }

export async function onRequestPost(context) {
  const id = context.params.id
  if (!id) return json({ error: '缺少分享 ID' }, 400)

  const record = await getRecord(context.env, id)
  if (!record) return json({ error: '分享链接不存在' }, 404)

  let body
  try { body = await context.request.json() } catch { return json({ error: '请求体无效' }, 400) }

  const hrKey = String(body.hrKey || '')
  if (!hrKey) return json({ error: '缺少访问者标识' }, 400)

  const messages = Array.isArray(body.messages) ? body.messages : null
  if (!messages || messages.length === 0) return json({ error: '缺少对话内容' }, 400)

  const apiKey = context.env.DEEPSEEK_API_KEY
  if (!apiKey) return json({ error: '服务器未配置 AI 密钥，请联系候选人' }, 500)

  // ---- 扣减提问次数（与 ask 接口语义一致） ----
  const sessions = Array.isArray(record.sessions) ? record.sessions : []
  let session = sessions.find(s => s.hrKey === hrKey)
  if (!session) { session = { hrKey, count: 0, lastAskedAt: null }; sessions.push(session) }
  const max = record.maxQuestions || 3
  if (session.count >= max) return json({ error: '提问次数已用完，请联系候选人刷新次数', remaining: 0, max }, 429)
  session.count++
  session.lastAskedAt = new Date().toISOString()
  record.sessions = sessions
  await context.env.SHARES_KV.put('share:' + id, JSON.stringify(record))

  // ---- 调用 DeepSeek ----
  const safeMessages = messages.slice(0, 20).map(m => ({
    role: ['system', 'user', 'assistant'].includes(m.role) ? m.role : 'user',
    content: String(m.content || '').slice(0, 8000)
  }))

  try {
    const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: safeMessages,
        max_tokens: 500,
        temperature: 0.3
      })
    })
    if (!resp.ok) {
      const errText = await resp.text().catch(() => '')
      return json({ error: 'AI 服务错误（' + resp.status + '），请联系候选人' }, 502)
    }
    const data = await resp.json()
    const reply = data.choices?.[0]?.message?.content
    if (!reply) return json({ error: 'AI 返回内容为空，请重试' }, 502)
    return json({ reply, remaining: Math.max(0, max - session.count), max })
  } catch (e) {
    return json({ error: 'AI 服务调用失败，请稍后重试' }, 502)
  }
}