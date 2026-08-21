import { ref } from 'vue'

const TOKEN_KEY = 'resume_admin_token'

export const token = ref('')
export const authed = ref(false)

function init() {
  try {
    const saved = localStorage.getItem(TOKEN_KEY) || ''
    token.value = saved
    authed.value = !!saved
  } catch {
    token.value = ''
    authed.value = false
  }
}
init()

export function setToken(t) {
  token.value = t || ''
  authed.value = !!t
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {}
}

export async function login(username, password) {
  const res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || ('登录失败（HTTP ' + res.status + '）'))
  setToken(data.token)
  return data
}

export async function logout() {
  const t = token.value
  setToken('')
  if (t) {
    try {
      await fetch('/api/admin/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + t } })
    } catch {}
  }
}

export function authHeaders() {
  return token.value ? { Authorization: 'Bearer ' + token.value } : {}
}
