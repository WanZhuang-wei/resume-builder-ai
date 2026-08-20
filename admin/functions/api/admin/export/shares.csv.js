// GET /api/admin/export/shares.csv — 分享列表 CSV 导出
import { requireAdmin } from '../../../_admin.js'

export async function onRequestGet(context) {
  if (!requireAdmin(context)) {
    return new Response(JSON.stringify({ error: '未授权' }), { status: 401, headers: { 'Content-Type': 'application/json; charset=UTF-8' } })
  }
  const db = context.env.ANALYTICS_DB
  const rows = (await db.prepare('SELECT id, status, created_at, expires_at, max_questions, view_count, ask_count FROM shares ORDER BY created_at DESC').all()).results
  const esc = (v) => {
    const s = String(v == null ? '' : v)
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }
  const lines = ['id,status,created_at,expires_at,max_questions,views,asks']
  for (const r of rows) {
    lines.push([r.id, r.status, r.created_at, r.expires_at, r.max_questions, r.view_count, r.ask_count].map(esc).join(','))
  }
  return new Response('﻿' + lines.join('\n'), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=UTF-8',
      'Content-Disposition': 'attachment; filename="shares.csv"',
    },
  })
}
