// ????????? ID + ???????????????
const DEVICE_KEY = 'resume_device_id'
const QUEUE_KEY = 'resume_tracker_queue'
const EVENT_WHITELIST = ['app_open', 'feature_use', 'share_create', 'share_view', 'share_ask', 'ai_request']
const FLUSH_SIZE = 5
const FLUSH_MS = 5000

let enabled = false
let queue = []
let timer = null

function loadQueue() {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.slice(0, 100) : []
  } catch {
    return []
  }
}

function saveQueue() {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-100)))
  } catch {
    // localStorage ??????
  }
}

export function getDeviceId() {
  try {
    let id = localStorage.getItem(DEVICE_KEY)
    if (!id) {
      id = (globalThis.crypto && typeof crypto.randomUUID === 'function')
        ? crypto.randomUUID()
        : 'd' + Math.random().toString(36).slice(2) + Date.now().toString(36)
      localStorage.setItem(DEVICE_KEY, id)
    }
    return id
  } catch {
    return ''
  }
}

export function setEnabled(value) {
  enabled = !!value
}

export function isEnabled() {
  return enabled
}

export function getQueue() {
  return [...queue]
}

export function track(name, opts = {}) {
  if (!enabled) return
  if (!EVENT_WHITELIST.includes(name)) return
  queue.push({
    name,
    shareId: opts.shareId || null,
    feature: opts.feature || null,
    value: Number.isFinite(opts.value) ? opts.value : null,
    extra: opts.extra || null,
  })
  saveQueue()
  scheduleFlush()
}

function scheduleFlush() {
  if (queue.length >= FLUSH_SIZE) {
    flush()
    return
  }
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => { timer = null; flush() }, FLUSH_MS)
}

export function flush() {
  if (timer) { clearTimeout(timer); timer = null }
  if (!enabled) {
    queue = []
    saveQueue()
    return
  }
  if (queue.length === 0) return
  const batch = queue
  queue = []
  saveQueue()
  const payload = JSON.stringify({ deviceId: getDeviceId(), events: batch })
  try {
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const sent = navigator.sendBeacon('/api/events', new Blob([payload], { type: 'application/json' }))
      if (sent) return
    }
    fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {})
  } catch {
    // ?????????
  }
}

export function installAutoFlush() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush()
  })
  window.addEventListener('pagehide', () => flush())
}
