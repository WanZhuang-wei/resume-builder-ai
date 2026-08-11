import db from '@/db'
import { compressData, decompressData } from '@/utils/compress'

const BACKUP_KEY = 'resume_data_backup_v1'

function backupPayload(backup) {
  return {
    ...backup,
    knowledgeBase: (backup.knowledgeBase || []).map(item => ({
      ...item,
      originalText: (item.originalText || '').slice(0, 2000),
      aiSummary: (item.aiSummary || '').slice(0, 2000),
    })),
  }
}

export function hasBackup() {
  try {
    return !!localStorage.getItem(BACKUP_KEY)
  } catch {
    return false
  }
}

export function getBackupInfo() {
  try {
    const data = decompressData(localStorage.getItem(BACKUP_KEY))
    if (!data || !data.exportedAt) return null
    return {
      exportedAt: data.exportedAt,
      counts: {
        basicInfo: data.basicInfo?.length || 0,
        workExperiences: data.workExperiences?.length || 0,
        education: data.education?.length || 0,
        projects: data.projects?.length || 0,
        skills: data.skills?.length || 0,
        certificates: data.certificates?.length || 0,
        resumes: data.resumes?.length || 0,
        knowledgeBase: data.knowledgeBase?.length || 0,
      },
    }
  } catch {
    return null
  }
}

export async function backupNow() {
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    basicInfo: await db.basicInfo.toArray(),
    workExperiences: await db.workExperiences.toArray(),
    education: await db.education.toArray(),
    projects: await db.projects.toArray(),
    skills: await db.skills.toArray(),
    certificates: await db.certificates.toArray(),
    resumes: await db.resumes.toArray(),
    knowledgeBase: await db.knowledgeBase.toArray(),
  }
  try {
    localStorage.setItem(BACKUP_KEY, compressData(backupPayload(data)))
  } catch {
    const small = backupPayload(data)
    small.knowledgeBase = (small.knowledgeBase || []).map(item => ({
      ...item,
      originalText: '',
      aiSummary: (item.aiSummary || '').slice(0, 800),
    }))
    localStorage.setItem(BACKUP_KEY, compressData(small))
  }
  return data
}

export async function restoreFromBackup() {
  const raw = localStorage.getItem(BACKUP_KEY)
  const data = decompressData(raw)
  if (!data) throw new Error('浏览器中没有找到可用的本地备份')

  const tables = ['basicInfo', 'workExperiences', 'education', 'projects', 'skills', 'certificates', 'resumes', 'knowledgeBase']
  for (const name of tables) {
    await db[name].clear()
    if (Array.isArray(data[name]) && data[name].length) {
      await db[name].bulkAdd(data[name])
    }
  }
  return data
}
