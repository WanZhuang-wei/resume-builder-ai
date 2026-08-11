import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { logAction, getRecentLogs, clearLogs, exportLogs } from '../actionLog.js'

describe('ActionLog', () => {
  beforeEach(() => {
    clearLogs()
  })

  afterEach(() => {
    clearLogs()
  })

  it('should record an action with status and payload', () => {
    const record = logAction('test.action', {
      status: 'success',
      payload: { name: '张三' },
      durationMs: 120,
    })

    expect(record.action).toBe('test.action')
    expect(record.status).toBe('success')
    expect(record.payload.name).toBe('张三')
    expect(record.durationMs).toBe(120)
    expect(record.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('should persist logs to localStorage', () => {
    logAction('test.persist', {
      status: 'failed',
      error: new Error('boom'),
    })

    const saved = JSON.parse(localStorage.getItem('resume_action_logs'))
    expect(saved.length).toBe(1)
    expect(saved[0].action).toBe('test.persist')
    expect(saved[0].error.message).toBe('boom')
  })

  it('should return newest logs first', () => {
    logAction('first')
    logAction('second')

    const logs = getRecentLogs()
    expect(logs[0].action).toBe('second')
    expect(logs[1].action).toBe('first')
  })

  it('should export markdown report', () => {
    logAction('test.markdown', { status: 'success' })

    const md = exportLogs('markdown')
    expect(md).toContain('# 操作日志')
    expect(md).toContain('test.markdown')
  })

  it('should clear all logs', () => {
    logAction('temp')
    clearLogs()

    expect(getRecentLogs().length).toBe(0)
    expect(localStorage.getItem('resume_action_logs')).toBe('[]')
  })
})
