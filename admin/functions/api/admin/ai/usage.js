// GET /api/admin/ai/usage — 每日 AI 用量
import { json, requireAdmin, clampInt } from '../../../_admin.js'

export async function onRequestGet(context) {
  if (!requireAdmin(context)) return json({ error: '未授权' }, 401)
  const db = context.env.ANALYTICS_DB
  const days = clampInt(new URL(context.request.url).searchParams.get('days'), 1, 90, 14)
  const since = Date.now() - days * 24 * 60 * 60 * 1000
  const rows = (await db.prepare(
    "SELECT substr(date(ts/1000,'unixepoch','+8 hours'),1,10) AS d, COUNT(*) AS requests, COALESCE(SUM(value),0) AS tokens, SUM(CASE WHEN json_extract(extra,'$.success') = 'false' THEN 1 ELSE 0 END) AS failures, COALESCE(SUM(json_extract(extra,'$.prompt_tokens')),0) AS prompt_tokens, COALESCE(SUM(json_extract(extra,'$.completion_tokens')),0) AS completion_tokens FROM events WHERE event_name = 'ai_request' AND ts >= ? GROUP BY d ORDER BY d"
  ).bind(since).all()).results
  return json({ days, rows })
}
