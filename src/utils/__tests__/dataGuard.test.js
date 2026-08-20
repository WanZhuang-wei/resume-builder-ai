import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import db from '@/db'
import { backupNow, restoreFromBackup, hasBackup, getBackupInfo } from '@/utils/dataGuard'

const TABLES = ['basicInfo', 'workExperiences', 'education', 'projects', 'skills', 'certificates', 'resumes', 'knowledgeBase']

async function clearAll() {
  for (const t of TABLES) await db[t].clear()
}

describe('dataGuard 浏览器备份/恢复', () => {
  beforeEach(async () => {
    await clearAll()
    localStorage.clear()
  })

  it('备份-清空-恢复 完整往返，数据不丢失', async () => {
    await db.basicInfo.add({ name: '张三', title: '前端工程师' })
    await db.workExperiences.add({ company: '云启科技', position: '前端开发', startDate: '2023-01' })
    await db.projects.add({ name: '简历助手', role: '开发' })
    await db.skills.add({ name: 'Vue' })
    await db.certificates.add({ name: 'CET-6' })

    await backupNow()
    expect(hasBackup()).toBe(true)
    const info = getBackupInfo()
    expect(info.counts.basicInfo).toBe(1)
    expect(info.counts.workExperiences).toBe(1)
    expect(info.counts.projects).toBe(1)
    expect(info.counts.skills).toBe(1)

    // 模拟数据丢失/清空
    await clearAll()
    expect(await db.basicInfo.toArray()).toHaveLength(0)

    await restoreFromBackup()
    expect(await db.basicInfo.toArray()).toHaveLength(1)
    expect((await db.basicInfo.toArray())[0].name).toBe('张三')
    expect(await db.workExperiences.toArray()).toHaveLength(1)
    expect(await db.projects.toArray()).toHaveLength(1)
    expect(await db.skills.toArray()).toHaveLength(1)
    expect(await db.certificates.toArray()).toHaveLength(1)
  })

  it('没有任何备份时恢复应报错（不产生副作用）', async () => {
    await db.basicInfo.add({ name: '李四' })
    await expect(restoreFromBackup()).rejects.toThrow()
    // 数据应保持原样，不被清空
    expect(await db.basicInfo.toArray()).toHaveLength(1)
  })

  it('在空数据库上执行 backupNow 会得到空备份（App.vue 已避免此调用）', async () => {
    await backupNow()
    const info = getBackupInfo()
    expect(info).not.toBeNull()
    expect(info.counts.basicInfo).toBe(0)
    expect(info.counts.workExperiences).toBe(0)
  })
})