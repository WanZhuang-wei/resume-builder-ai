// GET /api/share/:id ? ???????D1 ???? + KV payload + ?????
import { cors, json, getShare, recordEvent, incrementShareCounters } from '../../_shared.js'

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: cors() })
}

export async function onRequestGet(context) {
  const id = context.params.id
  if (!id) return json({ error: '???? ID' }, 400)
  const share = await getShare(context.env, id)
  if (!share.payload || share.status !== 'ok') return json({ error: '???????????' }, 404)

  const deviceId = String(new URL(context.request.url).searchParams.get('deviceId') || '').slice(0, 100)
  await recordEvent(context.env, { deviceId, eventName: 'share_view', shareId: id, value: 1 })
  await incrementShareCounters(context.env, id, { view: true })
  return json(share.payload.data)
}
