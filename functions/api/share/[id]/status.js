// GET /api/share/:id/status — HR 提问次数状态

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

export async function onRequestGet(context) {
  const id = context.params.id
  if (!id) return json({ error: '缺少分享 ID' }, 400)
  const record = await getRecord(context.env, id)
  if (!record) return json({ error: '分享链接不存在' }, 404)
  const hrKey = String(new URL(context.request.url).searchParams.get('hrKey') || '')
  const sessions = Array.isArray(record.sessions) ? record.sessions : []
  const session = sessions.find(s => s.hrKey === hrKey) || { count: 0 }
  const max = record.maxQuestions || 3
  return json({ count: session.count || 0, remaining: Math.max(0, max - (session.count || 0)), max })
}
