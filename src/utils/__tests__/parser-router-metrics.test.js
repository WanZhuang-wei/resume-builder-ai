import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { metrics } from '../metrics.js'

describe('parser.js parseDocument instrumentation', () => {
  let OriginalFileReader
  const mockContent = 'Hello World Test Content for parsing'

  beforeEach(() => {
    metrics.clear()
    OriginalFileReader = globalThis.FileReader
  })

  afterEach(() => {
    globalThis.FileReader = OriginalFileReader
  })

  it('should record metrics when parsing a txt file', async () => {
    class MockFileReader {
      constructor() {
        this.onload = null
        this.onerror = null
        this.result = ''
      }
      readAsText() {
        this.result = mockContent
        setTimeout(() => this.onload({ target: { result: mockContent } }), 5)
      }
      readAsArrayBuffer() {
        const enc = new TextEncoder()
        this.result = enc.encode(mockContent).buffer
        setTimeout(() => this.onload({ target: { result: enc.encode(mockContent).buffer } }), 5)
      }
    }
    globalThis.FileReader = MockFileReader

    const parser = await import('../parser.js')
    const result = await parser.parseDocument({ name: 'my-resume.txt' })

    expect(result.text).toBe(mockContent)

    const s = metrics.getStats()
    expect(s.parse.totalCalls).toBe(1)
    expect(s.parse.successRate).toBe(100)
    expect(s.parse.formatDistribution).toEqual({ txt: 1 })
  })

  it('should record parse error metrics on unknown format', async () => {
    const parser = await import('../parser.js')

    await expect(parser.parseDocument({ name: 'test.xyz' })).rejects.toThrow('不支持的文件格式')

    const s = metrics.getStats()
    expect(s.parse.totalCalls).toBe(1)
    expect(s.parse.errors).toBe(1)
    expect(s.parse.successRate).toBe(0)
  })

  it('should record route transitions via metrics method', () => {
    metrics.recordRouteTransition({ from: '/dashboard', to: '/profile', duration: 150 })
    metrics.recordRouteTransition({ from: '/profile', to: '/resume', duration: 200 })

    const s = metrics.getStats()
    expect(s.perf.routeTransitionCount).toBe(2)
  })
})
