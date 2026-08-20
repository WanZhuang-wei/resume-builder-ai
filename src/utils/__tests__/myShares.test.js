import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import db from '@/db'
import { useMySharesStore } from '@/stores/myShares'

describe('myShares 本机分享列表', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    await db.myShares.clear()
  })

  it('upsert 新增记录并可读取', async () => {
    const store = useMySharesStore()
    await store.upsert({ shareId: 'abc123', manageToken: 'tok', createdAt: 1, expiresAt: 2, link: 'https://x/#/hr/abc123', fingerprint: 'fp', status: 'active' })
    expect(store.items).toHaveLength(1)
    expect(store.items[0].shareId).toBe('abc123')
  })

  it('upsert 同 shareId 更新而非重复', async () => {
    const store = useMySharesStore()
    await store.upsert({ shareId: 'abc123', manageToken: 'tok1', createdAt: 1, expiresAt: 2, link: 'l', fingerprint: 'fp', status: 'active' })
    await store.upsert({ shareId: 'abc123', manageToken: 'tok2', createdAt: 1, expiresAt: 3, link: 'l', fingerprint: 'fp', status: 'active' })
    expect(store.items).toHaveLength(1)
    expect(store.items[0].manageToken).toBe('tok2')
    expect(store.items[0].expiresAt).toBe(3)
  })

  it('updateOne 修改状态', async () => {
    const store = useMySharesStore()
    await store.upsert({ shareId: 'abc123', manageToken: 'tok', createdAt: 1, expiresAt: 2, link: 'l', fingerprint: 'fp', status: 'active' })
    await store.updateOne('abc123', { status: 'revoked' })
    expect(store.items[0].status).toBe('revoked')
  })

  it('remove 删除记录', async () => {
    const store = useMySharesStore()
    await store.upsert({ shareId: 'abc123', manageToken: 'tok', createdAt: 1, expiresAt: 2, link: 'l', fingerprint: 'fp', status: 'active' })
    await store.remove('abc123')
    expect(store.items).toHaveLength(0)
  })
})
