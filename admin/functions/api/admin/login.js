// POST /api/admin/login — 用户名+密码登录（会话 Token 存 KV，7 天有效；IP 限流防爆破）
import { json, createSession, checkLoginRate } from '../../_admin.js'

export async function onRequestPost(context) {
  let body
  try { body = await context.request.json() } catch { return json({ error: '请求体无效' }, 400) }
  const username = String(body.username || '').trim().slice(0, 64)
  const password = String(body.password || '').slice(0, 256)

  const envUser = (context.env && context.env.ADMIN_USERNAME) || 'admin'
  const envPass = context.env && context.env.ADMIN_PASSWORD
  if (!envPass) return json({ error: '管理后台未设置密码，请联系管理员' }, 500)

  const ip = context.request.headers.get('CF-Connecting-IP') || 'unknown'
  const rate = await checkLoginRate(context.env, ip, 10, 600)
  if (!rate.allowed) return json({ error: '尝试次数过多，请 10 分钟后再试' }, 429)

  if (username !== envUser || password !== envPass) return json({ error: '用户名或密码错误' }, 401)

  const session = await createSession(context.env, username)
  return json({ ok: true, token: session.token, expiresAt: new Date(session.expiresAt).toISOString() })
}
