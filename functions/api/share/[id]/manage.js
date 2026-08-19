// GET /api/share/:id/manage  — 查看管理信息
// POST /api/share/:id/manage — 重置次数 / 修改设置

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
function checkToken(record, token) {
  return record.manageToken && record.manageToken === String(token || '')
}
function buildResponse(record) {
  const sessions = Array.isArray(record.sessions) ? record.sessions : []
  const total = sessions.reduce((sum, s) => sum + (s.count || 0), 0)
  return { id: record.id || '', createdAt: record.createdAt, maxQuestions: record.maxQuestions || 3, totalQuestions: total, sessionCount: sessions.length, sessions: sessions.map(s => ({ ...s })) }
}

export async function onRequestOptions() { return new Response(null, { status: 204, headers: cors() }) }

export async function onRequestGet(context) {
  const id = context.params.id
  if (!id) return json({ error: '缺少分享 ID' }, 400)
  const record = await getRecord(context.env, id)
  if (!record) return json({ error: '分享链接不存在' }, 404)
  if (!checkToken(record, new URL(context.request.url).searchParams.get('token')))
    return json({ error: '管理口令无效' }, 403)
  record.id = id
  return json(buildResponse(record))
}

export async function onRequestPost(context) {
  const id = context.params.id
  if (!id) return json({ error: '缺少分享 ID' }, 400)
  let body
  try { body = await context.request.json() } catch { return json({ error: '请求体无效' }, 400) }
  const record = await getRecord(context.env, id)
  if (!record) return json({ error: '分享链接不存在' }, 404)
  if (!checkToken(record, body.token)) return json({ error: '管理口令无效' }, 403)

  if (body.resetAll === true) record.sessions = []
  else if (body.resetHrKey) record.sessions = (Array.isArray(record.sessions) ? record.sessions : []).filter(s => s.hrKey !== String(body.resetHrKey))

  if (body.maxQuestions !== undefined) {
    const max = parseInt(body.maxQuestions, 10)
    if (Number.isFinite(max) && max >= 1 && max <= 100) record.maxQuestions = max
  }

  await context.env.SHARES_KV.put('share:' + id, JSON.stringify(record))
  record.id = id
  return json(buildResponse(record))
}
