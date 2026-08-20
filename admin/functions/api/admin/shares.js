// GET /api/admin/shares — 分享列表（分页/状态/搜索）
import { json, requireAdmin, clampInt } from '../../_admin.js'

export async function onRequestGet(context) {
  if (!requireAdmin(context)) return json({ error: '未授权' }, 401)
  const db = context.env.ANALYTICS_DB
  const url = new URL(context.request.url)
  const page = clampInt(url.searchParams.get('page'), 1, 10000, 1)
  const pageSize = clampInt(url.searchParams.get('pageSize'), 1, 100, 20)
  const status = String(url.searchParams.get('status') || 'all').slice(0, 20)
  const q = String(url.searchParams.get('q') || '').trim().slice(0, 64)

  const where = ['1=1']
  const args = []
  if (status && status !== 'all') { where.push('status = ?'); args.push(status) }
  if (q) { where.push('id LIKE ?'); args.push('%' + q + '%') }
  const whereSql = where.join(' AND ')

  const total = (await db.prepare('SELECT COUNT(*) AS n FROM shares WHERE ' + whereSql).bind(...args).first()).n
  const items = (await db.prepare(
    'SELECT id, fingerprint, created_at, expires_at, status, max_questions, view_count, ask_count, last_viewed_at, last_asked_at FROM shares WHERE ' + whereSql + ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).bind(...args, pageSize, (page - 1) * pageSize).all()).results

  return json({ total: Number(total || 0), page, pageSize, items })
}
