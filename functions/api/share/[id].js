// GET /api/share/:id — 读取分享数据（D1 状态校验 + KV payload + 浏览事件）
import { cors, json, getShare, recordEvent, incrementShareCounters } from '../../_shared.js'

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: cors() })
}

export async function onRequestGet(context) {
  const id = context.params.id
  if (!id) return json({ error: '缺少分享 ID' }, 400)
  const share = await getShare(context.env, id)
  if (!share.payload || share.status !== 'ok') return json({ error: '分享链接不存在或已过期' }, 404)

  const deviceId = String(new URL(context.request.url).searchParams.get('deviceId') || '').slice(0, 100)
  await recordEvent(context.env, { deviceId, eventName: 'share_view', shareId: id, value: 1 })
  await incrementShareCounters(context.env, id, { view: true })
  return json(share.payload.data)
}
