import { defineStore } from 'pinia'
import { ref } from 'vue'
import db from '@/db'

export const useKnowledgeStore = defineStore('knowledge', () => {
  const items = ref([])
  const loaded = ref(false)

  async function loadAll() {
    items.value = await db.knowledgeBase.toArray()
    loaded.value = true
  }

  async function addItem(data) {
    const now = new Date().toISOString()
    const record = {
      title: data.title || '未命名文档',
      sourceType: data.sourceType || 'unknown',
      fileType: data.fileType || '',
      originalText: data.originalText || '',
      aiSummary: data.aiSummary || '',
      extractedData: data.extractedData || null,
      tags: data.tags || [],
      createdAt: now
    }
    const id = await db.knowledgeBase.add(record)
    items.value.push({ ...record, id })
    return id
  }

  async function updateItem(id, data) {
    await db.knowledgeBase.update(id, data)
    const idx = items.value.findIndex(i => i.id === id)
    if (idx >= 0) Object.assign(items.value[idx], data)
  }

  async function deleteItem(id) {
    await db.knowledgeBase.delete(id)
    items.value = items.value.filter(item => item.id !== id)
  }

  async function clearAll() {
    await db.knowledgeBase.clear()
    items.value = []
  }

  function getSummaryContext() {
    if (items.value.length === 0) return ''
    return items.value.map((item, i) => {
      return `[知识库文档 ${i+1}] ${item.title}\n${item.aiSummary || item.originalText.slice(0, 500)}`
    }).join('\n\n')
  }

  /** 从缓存中重新提取数据并自动填入个人资料 */
  async function reapplyToProfile(id, profileStore) {
    const item = items.value.find(i => i.id === id)
    if (!item || !item.extractedData) throw new Error('该文档没有缓存的提取数据')

    const data = item.extractedData
    let successCount = 0
    let failCount = 0

    try {
      if (data.basicInfo?.name) {
        const existing = profileStore.basicInfo || {}
        const cleanInfo = {}
        for (const key of ['name','phone','wechat','email','title','summary','targetPosition']) {
          if (data.basicInfo[key] != null && data.basicInfo[key] !== '') cleanInfo[key] = data.basicInfo[key]
        }
        if (cleanInfo.name) { await profileStore.saveBasicInfo({ ...existing, ...cleanInfo }); successCount++ }
      }
    } catch (e) { console.warn(e); failCount++ }

    try {
      if (data.workExperiences?.length) {
        for (const exp of data.workExperiences) {
          if (exp.company) await profileStore.addWorkExperience({
            company: exp.company, position: exp.position || '', startDate: exp.startDate || '',
            endDate: exp.endDate || '', description: exp.description || '',
            achievements: exp.achievements || '', tags: exp.tags || [], type: exp.type || 'fulltime'
          })
        }
        successCount++
      }
    } catch (e) { console.warn(e); failCount++ }

    try {
      if (data.education?.length) {
        for (const edu of data.education) {
          if (edu.school) await profileStore.addEducation({
            school: edu.school, major: edu.major || '', degree: edu.degree || '',
            startDate: edu.startDate || '', endDate: edu.endDate || '', gpa: edu.gpa || ''
          })
        }
        successCount++
      }
    } catch (e) { console.warn(e); failCount++ }

    try {
      if (data.projects?.length) {
        for (const proj of data.projects) {
          if (proj.name) await profileStore.addProject({
            name: proj.name, role: proj.role || '', techStack: proj.techStack || '',
            description: proj.description || '', highlights: proj.highlights || '', link: proj.link || ''
          })
        }
        successCount++
      }
    } catch (e) { console.warn(e); failCount++ }

    try {
      if (data.skills?.length) {
        for (const skill of data.skills) {
          if (skill.name) await profileStore.addSkill({
            name: skill.name, category: skill.category || '其他', proficiency: 3
          })
        }
        successCount++
      }
    } catch (e) { console.warn(e); failCount++ }

    try {
      if (data.certificates?.length) {
        for (const cert of data.certificates) {
          if (cert.name) await profileStore.addCertificate({
            name: cert.name, issuer: cert.issuer || '', date: cert.date || ''
          })
        }
        successCount++
      }
    } catch (e) { console.warn(e); failCount++ }

    await profileStore.loadAll()
    return { successCount, failCount }
  }

  return { items, loaded, loadAll, addItem, updateItem, deleteItem, clearAll, getSummaryContext, reapplyToProfile }
})
