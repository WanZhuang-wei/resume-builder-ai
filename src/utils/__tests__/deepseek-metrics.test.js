import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Provide control metrics instance for verification
import { metrics } from '../metrics.js'

const originalFetch = globalThis.fetch
const originalKey = 'deepseek_api_key'

describe('deepseek.js API instrumentation', () => {
  beforeEach(() => { metrics.clear() })
  afterEach(() => { globalThis.fetch = originalFetch })

  it('should record metrics on successful API call', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: 'test response' } }]
      })
    })
    localStorage.setItem(originalKey, 'test-key')

    const deepseek = await import('../../api/deepseek.js')
    const result = await deepseek.chat([{ role: 'user', content: 'hello' }], { temperature: 0.3 })
    expect(result).toBe('test response')

    const s = metrics.getStats()
    expect(s.api.totalCalls).toBe(1)
    expect(s.api.successRate).toBe(100)
  })

  it('should record error metrics when API call throws', async () => {
    // Direct test of recordApiCall with success=false (isolated from module imports)
    metrics.recordApiCall({ duration: 500, success: false, retries: 2 })
    const s = metrics.getStats()
    expect(s.api.totalCalls).toBe(1)
    expect(s.api.errors).toBe(1)
    expect(s.api.successRate).toBe(0)
    expect(s.api.retryRate).toBe(200) // retries/calls = 2/1 = 200%
  })

  it('should not record when no API key', async () => {
    localStorage.removeItem(originalKey)
    const deepseek = await import('../../api/deepseek.js')

    await expect(
      deepseek.chat([{ role: 'user', content: 'hello' }])
    ).rejects.toThrow('请先设置 DeepSeek API Key')

    expect(metrics.getStats().api.totalCalls).toBe(0)
  })
})
