// POST /api/share/:id/ask — HR 提问扣减次数

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
  let body
  try { body = await context.request.json() } catch { return json({ error: '请求体无效' }, 400) }
  const hrKey = String(body.hrKey || '')
  if (!hrKey) return json({ error: '缺少访问者标识' }, 400)

  const record = await getRecord(context.env, id)
  if (!record) return json({ error: '分享链接不存在' }, 404)

  const sessions = Array.isArray(record.sessions) ? record.sessions : []
  let session = sessions.find(s => s.hrKey === hrKey)
  if (!session) { session = { hrKey, count: 0, lastAskedAt: null }; sessions.push(session) }

  const max = record.maxQuestions || 3
  if (session.count >= max) return json({ error: '提问次数已用完', remaining: 0, max }, 429)

  session.count++
  session.lastAskedAt = new Date().toISOString()
  record.sessions = sessions
  await context.env.SHARES_KV.put('share:' + id, JSON.stringify(record))

  return json({ remaining: Math.max(0, max - session.count), max })
}
