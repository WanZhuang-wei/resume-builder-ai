import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getDeviceId, setEnabled, isEnabled, track, flush, getQueue } from '@/utils/tracker'

const QUEUE_KEY = 'resume_tracker_queue'
const DEVICE_KEY = 'resume_device_id'

describe('tracker 匿名埋点', () => {
  beforeEach(() => {
    // 清空模块级队列（关闭状态下的 flush 会清空），避免跨用例残留
    setEnabled(false)
    flush()
    localStorage.clear()
    setEnabled(true)
    // 禁用 sendBeacon，确保测试走 fetch 分支
    try {
      Object.defineProperty(window.navigator, 'sendBeacon', { value: undefined, configurable: true })
    } catch {}
  })
  afterEach(() => {
    setEnabled(false)
    localStorage.clear()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('设备 ID 稳定且匿名', () => {
    const id1 = getDeviceId()
    const id2 = getDeviceId()
    expect(id1).toBe(id2)
    expect(id1.length).toBeGreaterThan(8)
  })

  it('未启用时不入队', () => {
    setEnabled(false)
    track('app_open')
    expect(getQueue()).toHaveLength(0)
  })

  it('只接受白名单事件', () => {
    track('app_open')
    track('feature_use', { feature: 'qa' })
    track('not_allowed_event')
    expect(getQueue().map(e => e.name)).toEqual(['app_open', 'feature_use'])
  })

  it('队列满 5 条自动上报并清空', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, inserted: 5 }) })
    vi.stubGlobal('fetch', fetchMock)
    track('app_open')
    track('app_open')
    track('app_open')
    track('app_open')
    track('app_open')
    await new Promise(r => setTimeout(r, 0))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.events).toHaveLength(5)
    expect(body.deviceId).toBe(getDeviceId())
    expect(getQueue()).toHaveLength(0)
  })

  it('flush 手动上报', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, inserted: 1 }) })
    vi.stubGlobal('fetch', fetchMock)
    track('feature_use', { feature: 'auto_fill', value: 1 })
    await flush()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
