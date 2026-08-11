// GET /api/share/:id — 根据短 ID 读取分享数据

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

async function getRecord(id) {
  if (globalThis.SHARES_KV) {
    return await globalThis.SHARES_KV.get('share:' + id)
  }
  const fallback = globalThis.__shareFallback || {}
  return fallback[id] || null
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() })
}

export async function onRequestGet(context) {
  const id = context.params.id
  if (!id) {
    return jsonResponse({ error: '缺少分享 ID' }, 400)
  }

  const raw = await getRecord(id)
  if (!raw) {
    return jsonResponse({ error: '分享链接不存在或已过期' }, 404)
  }

  try {
    const record = JSON.parse(raw)
    // 30 天过期保护
    const createdAt = new Date(record.createdAt).getTime()
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000
    if (Number.isFinite(createdAt) && Date.now() - createdAt > THIRTY_DAYS) {
      return jsonResponse({ error: '分享链接已过期' }, 404)
    }
    return jsonResponse(record.data)
  } catch {
    return jsonResponse({ error: '分享数据解析失败' }, 500)
  }
}
