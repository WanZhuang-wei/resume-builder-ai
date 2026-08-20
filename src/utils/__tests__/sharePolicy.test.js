import { describe, it, expect } from 'vitest'
import { rateBucket, extendExpiry, isShareActive, parseSessions } from '../../../functions/_shared.js'

describe('分享生命周期策略（与后端一致）', () => {
  it('rateBucket 按 60 秒窗口分桶', () => {
    const now = 1750000020000 // 对齐到分钟边界
    expect(rateBucket(now, 60) % 60).toBe(0)
    expect(rateBucket(now, 60)).toBe(rateBucket(now + 59000, 60))
    expect(rateBucket(now, 60)).not.toBe(rateBucket(now + 61000, 60))
  })

  it('extendExpiry 从当前时间/到期时间中较晚者顺延 30 天', () => {
    const now = 1750000000000
    const add = 30 * 24 * 60 * 60 * 1000
    // 已过期 → 从 now 顺延
    expect(extendExpiry(now - 10000, now, add)).toBe(now + add)
    // 未过期 → 从到期时间顺延
    expect(extendExpiry(now + 50000, now, add)).toBe(now + 50000 + add)
  })

  it('isShareActive 判断状态与到期', () => {
    const now = 1750000000000
    expect(isShareActive({ status: 'active', expires_at: now + 1000 }, now)).toBe(true)
    expect(isShareActive({ status: 'revoked', expires_at: now + 1000 }, now)).toBe(false)
    expect(isShareActive({ status: 'active', expires_at: now - 1 }, now)).toBe(false)
    expect(isShareActive(null, now)).toBe(false)
  })

  it('parseSessions 解析容错', () => {
    expect(parseSessions({ sessions: '[{"hrKey":"a","count":1}]' })).toHaveLength(1)
    expect(parseSessions({ sessions: 'bad' })).toEqual([])
    expect(parseSessions(null)).toEqual([])
  })
})
