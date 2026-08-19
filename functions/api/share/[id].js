// GET /api/share/:id — 读取分享数据

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
async function getRecord(env, id) {
  const raw = await env.SHARES_KV.get('share:' + id)
  return raw ? JSON.parse(raw) : null
}
function isExpired(record) {
  const t = new Date(record.createdAt).getTime()
  return Number.isFinite(t) && Date.now() - t > 30 * 24 * 60 * 60 * 1000
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: cors() })
}

export async function onRequestGet(context) {
  const id = context.params.id
  if (!id) return json({ error: '缺少分享 ID' }, 400)
  const record = await getRecord(context.env, id)
  if (!record) return json({ error: '分享链接不存在或已过期' }, 404)
  if (isExpired(record)) return json({ error: '分享链接已过期' }, 404)
  return json(record.data)
}
