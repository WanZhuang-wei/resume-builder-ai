// POST /api/admin/logout — 注销当前会话
import { json, deleteSession } from '../../_admin.js'

export async function onRequestPost(context) {
  const auth = context.request.headers.get('Authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  await deleteSession(context.env, token)
  return json({ ok: true })
}
