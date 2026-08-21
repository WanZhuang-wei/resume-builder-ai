// GET /api/share/:id/status — HR 提问次数状态
import { cors, json, getShare, parseSessions } from '../../../_shared.js'

export async function onRequestOptions() { return new Response(null, { status: 204, headers: cors() }) }

export async function onRequestGet(context) {
  const id = context.params.id
  if (!id) return json({ error: '缺少分享 ID' }, 400)
  const share = await getShare(context.env, id)
  if (!share.payload && !share.meta) return json({ error: '分享链接不存在' }, 404)
  const hrKey = String(new URL(context.request.url).searchParams.get('hrKey') || '')
  const sessions = parseSessions(share.meta)
  const session = sessions.find(s => s.hrKey === hrKey) || { count: 0 }
  const max = share.meta ? share.meta.max_questions : (share.payload?.maxQuestions || 3)
  return json({ count: session.count || 0, remaining: Math.max(0, max - (session.count || 0)), max })
}
