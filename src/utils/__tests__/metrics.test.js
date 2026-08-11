import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { metrics } from '../metrics.js'

describe('MetricsCollector', () => {
  beforeEach(() => {
    metrics.clear()
  })

  afterEach(() => {
    const keys = Object.keys(localStorage)
    for (const key of keys) {
      if (key.startsWith('resume_metrics_')) {
        localStorage.removeItem(key)
      }
    }
  })

  it('should initialize with all counters at zero', () => {
    const report = metrics.generateReport()
    expect(report.metrics.api.totalCalls).toBe(0)
    expect(report.metrics.parse.totalCalls).toBe(0)
    expect(report.metrics.generation.totalGenerated).toBe(0)
    expect(report.metrics.perf.routeTransitionCount).toBe(0)
  })

  it('should record API calls correctly', () => {
    metrics.recordApiCall({ duration: 1000, firstToken: 200, success: true })
    metrics.recordApiCall({ duration: 2000, firstToken: 350, success: true })
    metrics.recordApiCall({ duration: 0, firstToken: null, success: false, retries: 2 })

    const report = metrics.generateReport()
    expect(report.metrics.api.totalCalls).toBe(3)
    expect(report.metrics.api.successRate).toBeCloseTo(66.67, 1)
    expect(report.metrics.api.avgLatency).toBeCloseTo(1000, 0)
    expect(report.metrics.api.avgFirstToken).toBeCloseTo(275, 0)
  })

  it('should record parse operations with format distribution', () => {
    metrics.recordParse({ format: 'pdf', duration: 500, success: true })
    metrics.recordParse({ format: 'docx', duration: 300, success: true })
    metrics.recordParse({ format: 'pdf', duration: 0, success: false })

    const report = metrics.generateReport()
    expect(report.metrics.parse.totalCalls).toBe(3)
    expect(report.metrics.parse.successRate).toBeCloseTo(66.67, 1)
    expect(report.metrics.parse.formatDistribution).toEqual({ pdf: 2, docx: 1 })
    expect(report.metrics.parse.avgDuration).toBeCloseTo(266.67, 1)
  })

  it('should record generation events with edit tracking', () => {
    metrics.recordGeneration({ matchScore: 85, userEdited: false })
    metrics.recordGeneration({ matchScore: 72, userEdited: true })
    metrics.recordGeneration({ userEdited: true })

    const report = metrics.generateReport()
    expect(report.metrics.generation.totalGenerated).toBe(3)
    expect(report.metrics.generation.avgMatchScore).toBeCloseTo(78.5, 1)
    expect(report.metrics.generation.userEditRate).toBeCloseTo(66.67, 1)
  })

  it('should record route transitions', () => {
    metrics.recordRouteTransition({ from: '/dashboard', to: '/profile', duration: 150 })
    metrics.recordRouteTransition({ from: '/profile', to: '/resume', duration: 200 })

    const report = metrics.generateReport()
    expect(report.metrics.perf.routeTransitionCount).toBe(2)
  })

  it('should persist data to localStorage', () => {
    metrics.recordApiCall({ duration: 500, firstToken: 100, success: true })
    metrics.persist()

    const key = Object.keys(localStorage).find(k => k.startsWith('resume_metrics_') && !k.startsWith('resume_metrics_history'))
    expect(key).toBeTruthy()

    const saved = JSON.parse(localStorage.getItem(key))
    expect(saved.api.calls).toBe(1)
    expect(saved.api.firstTokenLatency).toEqual([100])
  })

  it('should restore data after clear and load', () => {
    metrics.recordApiCall({ duration: 500, success: true })
    metrics.persist()

    const beforeReport = metrics.generateReport()
    expect(beforeReport.metrics.api.totalCalls).toBe(1)

    metrics.clear()
    expect(metrics.generateReport().metrics.api.totalCalls).toBe(0)

    metrics.loadPersisted()
    expect(metrics.generateReport().metrics.api.totalCalls).toBe(1)
  })

  it('should handle empty calls gracefully (default params)', () => {
    expect(() => metrics.recordApiCall()).not.toThrow()
    expect(() => metrics.recordParse()).not.toThrow()
    expect(() => metrics.recordGeneration()).not.toThrow()
    expect(() => metrics.recordRouteTransition()).not.toThrow()

    const report = metrics.generateReport()
    expect(report.metrics.api.totalCalls).toBe(1)
    expect(report.metrics.parse.totalCalls).toBe(1)
    expect(report.metrics.generation.totalGenerated).toBe(1)
    expect(report.metrics.perf.routeTransitionCount).toBe(1)
  })

  it('should generate report with timestamp', () => {
    const report = metrics.generateReport()
    expect(report).toHaveProperty('timestamp')
    expect(report).toHaveProperty('metrics')
    expect(typeof report.timestamp).toBe('string')
    expect(report.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  })

  it('should clean up old keys on persist (keep last 7 days)', () => {
    const oldKey = 'resume_metrics_2020-01-01'
    const recentKey = 'resume_metrics_2999-01-01'
    localStorage.setItem(oldKey, '{"api":{"calls":1}}')
    localStorage.setItem(recentKey, '{"api":{"calls":1}}')

    metrics.recordApiCall({ duration: 100, success: true })
    metrics.persist()

    // old key should be removed
    expect(localStorage.getItem(oldKey)).toBeNull()
    // recent key should still exist
    expect(localStorage.getItem(recentKey)).toBeTruthy()
  })

  it('should handle loadPersisted with no saved data gracefully', () => {
    metrics.clear()
    const result = metrics.loadPersisted(new Date('1990-01-01'))
    expect(result).toBe(false)
  })
})

