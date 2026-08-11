/**
 * 可保存操作日志
 * 记录关键动作的时间、页面、参数摘要、状态、错误与耗时，
 * 环形保留最近 200 条并持久化到 localStorage，支持导出 JSON/Markdown。
 */
const STORAGE_KEY = 'resume_action_logs'
const MAX_LOGS = 200

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

let logs = readStored()
let seq = logs.reduce((max, item) => Math.max(max, item.id || 0), 0)

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs))
  } catch {
    // localStorage 不可用或已满时只保留内存日志
  }
}

function safeString(value, max = 500) {
  if (value === null || value === undefined) return ''
  const text = typeof value === 'string' ? value : String(value)
  return text.length <= max ? text : text.slice(0, max) + '...'
}

function summarize(value, depth = 0) {
  if (value === null || value === undefined) return value
  if (typeof value === 'string') {
    return value.length > 120 ? value.slice(0, 120) + '...' : value
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (Array.isArray(value)) {
    if (depth > 2) return `[Array(${value.length})]`
    return value.slice(0, 8).map((item) => summarize(item, depth + 1))
  }
  if (typeof value === 'object') {
    if (depth > 2) return '{...}'
    const out = {}
    for (const [key, item] of Object.entries(value)) {
      out[key] = summarize(item, depth + 1)
    }
    return out
  }
  return String(value)
}

function normalizeError(error) {
  if (!error) return undefined
  if (typeof error === 'string') return { message: safeString(error, 500) }
  return {
    name: error.name || '',
    message: safeString(error.message || String(error), 500),
    code: error.code || undefined,
    stack: error.stack ? safeString(error.stack, 1200) : undefined,
  }
}

export function logAction(action, { status = 'started', payload, error, durationMs, page, meta } = {}) {
  seq += 1
  const record = {
    id: seq,
    ts: new Date().toISOString(),
    action,
    status,
    page: page || (typeof window !== 'undefined' ? window.location.hash : '') || '',
    payload: summarize(payload),
    error: normalizeError(error),
    durationMs: durationMs == null ? undefined : Math.round(durationMs),
    origin: typeof window !== 'undefined' ? window.location.origin : '',
    meta: meta ? summarize(meta) : undefined,
  }
  logs.push(record)
  if (logs.length > MAX_LOGS) logs = logs.slice(-MAX_LOGS)
  persist()
  return record
}

export function getRecentLogs(limit = 200) {
  return logs.slice(-limit).reverse()
}

export function clearLogs() {
  logs = []
  seq = 0
  persist()
}

export function exportLogs(format = 'json') {
  if (format === 'markdown') {
    const lines = [
      '# 操作日志',
      '',
      `导出时间: ${new Date().toISOString()}`,
      '',
      '| 时间 | 页面 | 动作 | 状态 | 耗时(ms) | 错误 |',
      '|------|------|------|------|----------|------|',
    ]
    for (const item of getRecentLogs(200)) {
      const error = (item.error && item.error.message) || ''
      lines.push(`| ${item.ts} | ${item.page || ''} | ${item.action} | ${item.status} | ${item.durationMs ?? ''} | ${error} |`)
    }
    return lines.join('\n')
  }
  return JSON.stringify({ exportedAt: new Date().toISOString(), count: logs.length, logs }, null, 2)
}

export function installGlobalErrorHandlers() {
  if (typeof window === 'undefined') return
  window.addEventListener('error', (event) => {
    logAction('global.error', {
      status: 'failed',
      payload: {
        message: event.message,
        source: event.filename,
        line: event.lineno,
        column: event.colno,
      },
      error: event.error,
    })
  })
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    logAction('global.unhandledrejection', {
      status: 'failed',
      payload: { reason: safeString(reason, 300) },
      error: reason instanceof Error ? reason : undefined,
    })
  })
}
