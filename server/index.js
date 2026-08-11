import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3001
const DB_PATH = path.join(__dirname, 'shares.json')
const DEFAULT_MAX_QUESTIONS = 3

// ---------- middleware ----------
app.use(cors())
app.use(express.json({ limit: '5mb' }))

// ---------- DB helpers ----------
function readDB() {
  if (!fs.existsSync(DB_PATH)) return {}
  try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8')) }
  catch { return {} }
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2))
}

function generateId(len = 8) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let id = ''
  for (let i = 0; i < len; i++) {
    id += chars[Math.floor(Math.random() * chars.length)]
  }
  return id
}

function normalizeRecord(record) {
  if (!record) return null
  return {
    ...record,
    manageToken: record.manageToken || null,
    maxQuestions: record.maxQuestions || DEFAULT_MAX_QUESTIONS,
    sessions: Array.isArray(record.sessions) ? record.sessions : []
  }
}

// ---------- auto-cleanup entries older than 30 days ----------
function cleanupExpired() {
  const db = readDB()
  const now = Date.now()
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000
  let removed = 0
  for (const [id, record] of Object.entries(db)) {
    const createdAt = new Date(record.createdAt).getTime()
    if (now - createdAt > THIRTY_DAYS) {
      delete db[id]
      removed++
    }
  }
  if (removed > 0) {
    writeDB(db)
    console.log(`[cleanup] removed ${removed} expired share(s)`)
  }
}

// ---------- API routes ----------
app.post('/api/share', (req, res) => {
  const shareData = req.body
  if (!shareData || !shareData.profile) {
    return res.status(400).json({ error: '\u65e0\u6548\u7684\u5206\u4eab\u6570\u636e' })
  }

  const id = generateId()
  const db = readDB()
  db[id] = {
    data: shareData,
    createdAt: new Date().toISOString(),
    manageToken: generateId(16),
    maxQuestions: DEFAULT_MAX_QUESTIONS,
    sessions: []
  }
  writeDB(db)

  console.log(`[share] created ${id}`)
  res.json({ id, manageToken: db[id].manageToken })
})

app.get('/api/share/:id', (req, res) => {
  cleanupExpired()
  const db = readDB()
  const record = db[req.params.id]
  if (!record) {
    return res.status(404).json({ error: '\u5206\u4eab\u94fe\u63a5\u4e0d\u5b58\u5728\u6216\u5df2\u8fc7\u671f' })
  }
  res.json(record.data)
})

app.get('/api/share/:id/status', (req, res) => {
  const db = readDB()
  const record = normalizeRecord(db[req.params.id])
  if (!record) {
    return res.status(404).json({ error: '\u5206\u4eab\u94fe\u63a5\u4e0d\u5b58\u5728' })
  }
  const hrKey = String(req.query.hrKey || '')
  const session = record.sessions.find(s => s.hrKey === hrKey) || { count: 0 }
  const remaining = Math.max(0, record.maxQuestions - (session.count || 0))
  res.json({ count: session.count || 0, remaining, max: record.maxQuestions })
})

app.post('/api/share/:id/ask', (req, res) => {
  const db = readDB()
  const id = req.params.id
  const record = normalizeRecord(db[id])
  if (!record) {
    return res.status(404).json({ error: '\u5206\u4eab\u94fe\u63a5\u4e0d\u5b58\u5728' })
  }
  const hrKey = String(req.body.hrKey || '')
  if (!hrKey) {
    return res.status(400).json({ error: '\u7f3a\u5c11\u8bbf\u95ee\u8005\u6807\u8bc6' })
  }

  let session = record.sessions.find(s => s.hrKey === hrKey)
  if (!session) {
    session = { hrKey, count: 0, lastAskedAt: null }
    record.sessions.push(session)
  }

  if (session.count >= record.maxQuestions) {
    return res.status(429).json({
      error: '\u63d0\u95ee\u6b21\u6570\u5df2\u7528\u5b8c\uff0c\u8bf7\u8054\u7cfb\u5019\u9009\u4eba\u5237\u65b0\u6b21\u6570',
      remaining: 0,
      max: record.maxQuestions
    })
  }

  session.count += 1
  session.lastAskedAt = new Date().toISOString()
  db[id] = record
  writeDB(db)

  res.json({
    remaining: Math.max(0, record.maxQuestions - session.count),
    max: record.maxQuestions
  })
})

app.get('/api/share/:id/manage', (req, res) => {
  const db = readDB()
  const record = normalizeRecord(db[req.params.id])
  if (!record) {
    return res.status(404).json({ error: '\u5206\u4eab\u94fe\u63a5\u4e0d\u5b58\u5728' })
  }
  if (!record.manageToken || record.manageToken !== String(req.query.token || '')) {
    return res.status(403).json({ error: '\u7ba1\u7406\u53e3\u4ee4\u65e0\u6548' })
  }

  const total = record.sessions.reduce((sum, s) => sum + (s.count || 0), 0)
  res.json({
    id: req.params.id,
    createdAt: record.createdAt,
    maxQuestions: record.maxQuestions,
    totalQuestions: total,
    sessionCount: record.sessions.length,
    sessions: record.sessions.map(s => ({ ...s }))
  })
})

app.post('/api/share/:id/manage', (req, res) => {
  const db = readDB()
  const id = req.params.id
  const record = normalizeRecord(db[id])
  if (!record) {
    return res.status(404).json({ error: '\u5206\u4eab\u94fe\u63a5\u4e0d\u5b58\u5728' })
  }
  const body = req.body || {}
  if (!record.manageToken || record.manageToken !== String(body.token || '')) {
    return res.status(403).json({ error: '\u7ba1\u7406\u53e3\u4ee4\u65e0\u6548' })
  }

  if (body.resetAll === true) {
    record.sessions = []
  } else if (body.resetHrKey) {
    record.sessions = record.sessions.filter(s => s.hrKey !== String(body.resetHrKey))
  }

  if (body.maxQuestions !== undefined) {
    const max = parseInt(body.maxQuestions, 10)
    if (Number.isFinite(max) && max >= 1 && max <= 100) {
      record.maxQuestions = max
    }
  }

  db[id] = record
  writeDB(db)

  const total = record.sessions.reduce((sum, s) => sum + (s.count || 0), 0)
  res.json({
    id,
    maxQuestions: record.maxQuestions,
    totalQuestions: total,
    sessionCount: record.sessions.length,
    sessions: record.sessions.map(s => ({ ...s }))
  })
})

// ---------- serve built frontend in production ----------
const distPath = path.join(__dirname, '..', 'dist')
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath))
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
  console.log('[server] serving static frontend from dist/')
}

app.listen(PORT, () => {
  console.log(`[server] Share server running on http://localhost:${PORT}`)
  cleanupExpired()
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('[server] \u7aef\u53e3 ' + PORT + ' \u5df2\u88ab\u5360\u7528\uff0c\u8bf7\u5173\u95ed\u5176\u4ed6\u7a0b\u5e8f\u540e\u91cd\u8bd5')
    console.error('[server] \u6267\u884c: netstat -ano | findstr :' + PORT + '  \u67e5\u627e\u5360\u7528\u8fdb\u7a0b')
  } else {
    console.error('[server] \u542f\u52a8\u5931\u8d25:', err.message)
  }
  process.exit(1)
})
