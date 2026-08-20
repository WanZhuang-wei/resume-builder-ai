// POST /api/events ? ??????????????????????
import { cors, json, EVENT_WHITELIST, FEATURE_WHITELIST, recordEvent, checkRateLimit } from '../_shared.js'

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: cors() })
}

export async function onRequestPost(context) {
  let body
  try { body = await context.request.json() } catch { return json({ error: '?????' }, 400) }
  const deviceId = String(body.deviceId || '').slice(0, 100)
  const events = Array.isArray(body.events) ? body.events.slice(0, 20) : []
  if (events.length === 0) return json({ error: '????' }, 400)

  const rate = await checkRateLimit(context.env, deviceId || 'anon', 300)
  if (!rate.allowed) return json({ error: '????????' }, 429)

  let inserted = 0
  for (const ev of events) {
    const name = String(ev.name || '')
    if (!EVENT_WHITELIST.has(name)) continue
    const feature = FEATURE_WHITELIST.has(ev.feature) ? ev.feature : null
    const shareId = String(ev.shareId || '').slice(0, 32) || null
    await recordEvent(context.env, { deviceId, eventName: name, shareId, feature, value: ev.value, extra: ev.extra })
    inserted++
  }
  return json({ ok: true, inserted })
}
