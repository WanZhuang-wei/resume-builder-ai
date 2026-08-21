// POST /api/admin/shares/:id/:action — 延期 / 撤销 / 删除
import { json, requireAdmin, EXTEND_MS, kvGet, kvPut, kvDelete, extendExpiry } from '../../../../_admin.js'

export async function onRequestPost(context) {
  if (!(await requireAdmin(context))) return json({ error: '未授权' }, 401)
  const id = context.params.id
  const action = context.params.action
  if (!['revoke', 'extend', 'delete'].includes(action)) return json({ error: '无效操作' }, 400)
  const db = context.env.ANALYTICS_DB
  const meta = await db.prepare('SELECT * FROM shares WHERE id = ?').bind(id).first()
  if (!meta) return json({ error: '分享不存在' }, 404)

  if (action === 'revoke') {
    await db.prepare("UPDATE shares SET status = 'revoked' WHERE id = ?").bind(id).run()
    await kvDelete(context.env, id)
    return json({ ok: true, status: 'revoked' })
  }
  if (action === 'delete') {
    await db.prepare('DELETE FROM shares WHERE id = ?').bind(id).run()
    await kvDelete(context.env, id)
    return json({ ok: true, deleted: true })
  }
  // extend
  const next = extendExpiry(meta.expires_at, Date.now(), EXTEND_MS)
  await db.prepare('UPDATE shares SET expires_at = ? WHERE id = ?').bind(next, id).run()
  const payload = await kvGet(context.env, id)
  if (payload) await kvPut(context.env, id, payload, next)
  return json({ ok: true, expiresAt: new Date(next).toISOString() })
}
