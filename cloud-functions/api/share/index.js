// POST /api/share — 创建一条分享记录，返回 8 位短 ID 和完整链接

const CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789'
const ID_LENGTH = 8

function generateId() {
  let id = ''
  for (let i = 0; i < ID_LENGTH; i++) {
    id += CHARS[Math.floor(Math.random() * CHARS.length)]
  }
  return id
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  }
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=UTF-8', ...corsHeaders() }
  })
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() })
}

export async function onRequestPost(context) {
  let shareData
  try {
    shareData = await context.request.json()
  } catch {
    return jsonResponse({ error: '请求体不是有效的 JSON' }, 400)
  }

  if (!shareData || !shareData.profile) {
    return jsonResponse({ error: '无效的分享数据' }, 400)
  }

  const id = generateId()
  const record = JSON.stringify({
    data: shareData,
    createdAt: new Date().toISOString()
  })

  // 控制台绑定 Namespace 时，Variable Name 填 SHARES_KV
  if (globalThis.SHARES_KV) {
    await globalThis.SHARES_KV.put('share:' + id, record)
  } else {
    // 本地开发或未绑定 KV 时的兜底（进程内内存，重启即失）
    globalThis.__shareFallback = globalThis.__shareFallback || {}
    globalThis.__shareFallback[id] = record
  }

  const origin = new URL(context.request.url).origin
  return jsonResponse({
    id,
    url: origin + '/#/hr/' + id
  })
}
