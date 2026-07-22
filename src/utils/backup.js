import db from '@/db'

export async function exportAllData() {
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
    shareConfigs: await db.shareConfigs.toArray(),
    knowledgeBase: await db.knowledgeBase.toArray()
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `简历备份_${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)

  return data
}

export async function importData(jsonData) {
  if (!jsonData.version) throw new Error('无效的备份文件格式')

  await Promise.all([
    db.basicInfo.clear(),
    db.workExperiences.clear(),
    db.education.clear(),
    db.projects.clear(),
    db.skills.clear(),
    db.certificates.clear(),
    db.resumes.clear(),
    db.shareConfigs.clear(),
    db.knowledgeBase.clear()
  ])

  if (jsonData.basicInfo?.length) await db.basicInfo.bulkAdd(jsonData.basicInfo)
  if (jsonData.workExperiences?.length) await db.workExperiences.bulkAdd(jsonData.workExperiences)
  if (jsonData.education?.length) await db.education.bulkAdd(jsonData.education)
  if (jsonData.projects?.length) await db.projects.bulkAdd(jsonData.projects)
  if (jsonData.skills?.length) await db.skills.bulkAdd(jsonData.skills)
  if (jsonData.certificates?.length) await db.certificates.bulkAdd(jsonData.certificates)
  if (jsonData.resumes?.length) await db.resumes.bulkAdd(jsonData.resumes)
  if (jsonData.shareConfigs?.length) await db.shareConfigs.bulkAdd(jsonData.shareConfigs)
  if (jsonData.knowledgeBase?.length) await db.knowledgeBase.bulkAdd(jsonData.knowledgeBase)

  return true
}

export function downloadFile(content, filename, type = 'application/json') {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsText(file)
  })
}
