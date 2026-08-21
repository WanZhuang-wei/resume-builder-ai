// GET /api/admin/summary — 数据看板汇总
import { json, requireAdmin, cleanupOldData, clampInt } from '../../_admin.js'

export async function onRequestGet(context) {
  if (!(await requireAdmin(context))) return json({ error: '未授权' }, 401)
  await cleanupOldData(context.env)
  const db = context.env.ANALYTICS_DB
  const url = new URL(context.request.url)
  const days = clampInt(url.searchParams.get('days'), 1, 90, 30)
  const since = Date.now() - days * 24 * 60 * 60 * 1000
  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)

  const activeRows = (await db.prepare("SELECT substr(date(ts/1000,'unixepoch','+8 hours'),1,10) AS d, COUNT(DISTINCT device_id) AS n FROM events WHERE ts >= ? GROUP BY d ORDER BY d").bind(since).all()).results
  const newRows = (await db.prepare("SELECT substr(date(first_seen/1000,'unixepoch','+8 hours'),1,10) AS d, COUNT(*) AS n FROM devices WHERE first_seen >= ? GROUP BY d ORDER BY d").bind(since).all()).results
  const eventTotal = (await db.prepare('SELECT COUNT(*) AS n FROM events WHERE ts >= ?').bind(since).first()).n

  async function distinctDevices(name, feature) {
    let sql = 'SELECT COUNT(DISTINCT device_id) AS n FROM events WHERE event_name = ? AND ts >= ?'
    const args = [name, since]
    if (feature) { sql += ' AND feature = ?'; args.push(feature) }
    const row = await db.prepare(sql).bind(...args).first()
    return row ? Number(row.n) : 0
  }
  const funnel = {
    app_open: await distinctDevices('app_open'),
    auto_fill: await distinctDevices('feature_use', 'auto_fill'),
    resume_generate: await distinctDevices('feature_use', 'resume_generate'),
    share_create: await distinctDevices('share_create'),
    share_view: await distinctDevices('share_view'),
    share_ask: await distinctDevices('share_ask'),
  }

  const topFeatures = (await db.prepare("SELECT feature, COUNT(*) AS n FROM events WHERE event_name = 'feature_use' AND ts >= ? AND feature IS NOT NULL GROUP BY feature ORDER BY n DESC LIMIT 10").bind(since).all()).results
  const shareRows = (await db.prepare('SELECT status, COUNT(*) AS n FROM shares GROUP BY status').all()).results
  const shareStats = {}
  for (const r of shareRows) shareStats[r.status] = Number(r.n)

  async function aiStats(from) {
    const row = await db.prepare("SELECT COUNT(*) AS requests, COALESCE(SUM(value),0) AS tokens, SUM(CASE WHEN json_extract(extra,'$.success') = 'false' THEN 1 ELSE 0 END) AS failures, COALESCE(SUM(json_extract(extra,'$.prompt_tokens')),0) AS prompt_tokens, COALESCE(SUM(json_extract(extra,'$.completion_tokens')),0) AS completion_tokens FROM events WHERE event_name = 'ai_request' AND ts >= ?").bind(from).first()
    return {
      requests: Number(row.requests || 0),
      tokens: Number(row.tokens || 0),
      failures: Number(row.failures || 0),
      promptTokens: Number(row.prompt_tokens || 0),
      completionTokens: Number(row.completion_tokens || 0),
    }
  }
  const aiToday = await aiStats(todayStart.getTime())
  const aiRange = await aiStats(since)
  const estimatedCostCny = (aiRange.promptTokens * 2 + aiRange.completionTokens * 8) / 1000000

  return json({
    days,
    dailyActive: activeRows,
    dailyNew: newRows,
    eventTotal: Number(eventTotal || 0),
    funnel,
    topFeatures,
    shareStats,
    aiToday,
    aiRange,
    estimatedCostCny,
  })
}
