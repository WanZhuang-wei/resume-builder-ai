// POST /api/share — 创建分享记录

const CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789'
const ID_LENGTH = 8
const TOKEN_LENGTH = 16
const DEFAULT_MAX_QUESTIONS = 3

function generateId(len = ID_LENGTH) {
  let id = ''
  for (let i = 0; i < len; i++) id += CHARS[Math.floor(Math.random() * CHARS.length)]
  return id
}

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

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: cors() })
}

export async function onRequestPost(context) {
  let shareData
  try { shareData = await context.request.json() } catch {
    return json({ error: '请求体不是有效的 JSON' }, 400)
  }
  if (!shareData?.profile) return json({ error: '无效的分享数据' }, 400)

  const id = generateId()
  const manageToken = generateId(TOKEN_LENGTH)
  const record = {
    data: shareData,
    createdAt: new Date().toISOString(),
    manageToken,
    maxQuestions: DEFAULT_MAX_QUESTIONS,
    sessions: [],
  }

  await context.env.SHARES_KV.put('share:' + id, JSON.stringify(record))

  const origin = new URL(context.request.url).origin
  return json({ id, manageToken, url: origin + '/#/hr/' + id })
}
