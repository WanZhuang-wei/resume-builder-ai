import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import db from '@/db'
import { consolidateProfile } from '@/utils/consolidator'
import { clusterDocuments } from '@/utils/document-merger'
import { groupProfileEntries, mergeEntryGroups } from '@/utils/consolidate-v2'
import { exportWord } from '@/utils/exportProfiler'
import { useKnowledgeStore } from '@/stores/knowledge'
import { backupNow } from '@/utils/dataGuard'

function toSafeRecord(entry) {
  try {
    const cleaned = JSON.parse(JSON.stringify(entry))
    if (!cleaned || typeof cleaned !== 'object' || Array.isArray(cleaned)) return null
    delete cleaned._source
    return cleaned
  } catch {
    return null
  }
}

export const useProfileStore = defineStore('profile', () => {
  const basicInfo = ref(null)
  const workExperiences = ref([])
  const education = ref([])
  const projects = ref([])
  const skills = ref([])
  const certificates = ref([])
  const loaded = ref(false)

  const completeness = computed(() => {
    let score = 0
    const total = 6
    if (basicInfo.value?.name) score++
    if (workExperiences.value.length > 0) score++
    if (education.value.length > 0) score++
    if (projects.value.length > 0) score++
    if (skills.value.length > 0) score++
    if (certificates.value.length > 0) score++
    return Math.round((score / total) * 100)
  })

  const summaryData = computed(() => ({
    basicInfo: basicInfo.value,
    workExperiences: workExperiences.value,
    education: education.value,
    projects: projects.value,
    skills: skills.value,
    certificates: certificates.value
  }))

  async function loadAll() {
    basicInfo.value = (await db.basicInfo.toArray())[0] || null
    workExperiences.value = await db.workExperiences.toArray()
    education.value = await db.education.toArray()
    projects.value = await db.projects.toArray()
    skills.value = await db.skills.toArray()
    certificates.value = await db.certificates.toArray()
    loaded.value = true
  }

  // Basic Info
  async function saveBasicInfo(info) {
    await db.basicInfo.clear()
    await db.basicInfo.add(info)
    basicInfo.value = info
  }

  // Work Experiences
  async function addWorkExperience(exp) {
    const id = await db.workExperiences.add(exp)
    workExperiences.value.push({ ...exp, id })
  }

  async function updateWorkExperience(id, exp) {
    await db.workExperiences.update(id, exp)
    const idx = workExperiences.value.findIndex(e => e.id === id)
    if (idx >= 0) workExperiences.value[idx] = { ...exp, id }
  }

  async function deleteWorkExperience(id) {
    await db.workExperiences.delete(id)
    workExperiences.value = workExperiences.value.filter(e => e.id !== id)
  }

  // Education
  async function addEducation(edu) {
    const id = await db.education.add(edu)
    education.value.push({ ...edu, id })
  }

  async function updateEducation(id, edu) {
    await db.education.update(id, edu)
    const idx = education.value.findIndex(e => e.id === id)
    if (idx >= 0) education.value[idx] = { ...edu, id }
  }

  async function deleteEducation(id) {
    await db.education.delete(id)
    education.value = education.value.filter(e => e.id !== id)
  }

  // Projects
  async function addProject(proj) {
    const id = await db.projects.add(proj)
    projects.value.push({ ...proj, id })
  }

  async function updateProject(id, proj) {
    await db.projects.update(id, proj)
    const idx = projects.value.findIndex(p => p.id === id)
    if (idx >= 0) projects.value[idx] = { ...proj, id }
  }

  async function deleteProject(id) {
    await db.projects.delete(id)
    projects.value = projects.value.filter(p => p.id !== id)
  }

  // Skills
  async function addSkill(skill) {
    const id = await db.skills.add(skill)
    skills.value.push({ ...skill, id })
  }

  async function updateSkill(id, skill) {
    await db.skills.update(id, skill)
    const idx = skills.value.findIndex(s => s.id === id)
    if (idx >= 0) skills.value[idx] = { ...skill, id }
  }

  async function deleteSkill(id) {
    await db.skills.delete(id)
    skills.value = skills.value.filter(s => s.id !== id)
  }

  // Certificates
  async function addCertificate(cert) {
    const id = await db.certificates.add(cert)
    certificates.value.push({ ...cert, id })
  }

  async function updateCertificate(id, cert) {
    await db.certificates.update(id, cert)
    const idx = certificates.value.findIndex(c => c.id === id)
    if (idx >= 0) certificates.value[idx] = { ...cert, id }
  }

  async function deleteCertificate(id) {
    await db.certificates.delete(id)
    certificates.value = certificates.value.filter(c => c.id !== id)
  }

  async function consolidateAll() {
    const result = consolidateProfile({
      workExperiences: workExperiences.value,
      projects: projects.value,
      skills: skills.value,
      certificates: certificates.value,
      education: education.value
    })

    if (!result.hasChanges) return result

    // 更新工作经历
    await db.workExperiences.clear()
    await db.workExperiences.bulkAdd(result.workExperiences)
    workExperiences.value = result.workExperiences

    // 更新项目
    await db.projects.clear()
    await db.projects.bulkAdd(result.projects)
    projects.value = result.projects

    // 更新技能
    await db.skills.clear()
    await db.skills.bulkAdd(result.skills)
    skills.value = result.skills

    // 更新证书
    await db.certificates.clear()
    await db.certificates.bulkAdd(result.certificates)
    certificates.value = result.certificates

    // 更新教育
    await db.education.clear()
    await db.education.bulkAdd(result.education)
    education.value = result.education

    return result
  }
    async function consolidateWithKnowledge() {
      const knowledgeStore = useKnowledgeStore()
      if (!knowledgeStore.loaded) await knowledgeStore.loadAll()
      try {
        await backupNow()
      } catch (e) {
        // backup failure should not block consolidation
      }

      const candidates = {
        workExperiences: [],
        projects: [],
        skills: [],
        certificates: [],
        education: []
      }
      for (const item of knowledgeStore.items) {
        const data = item.extractedData
        if (!data) continue
        if (Array.isArray(data.workExperiences)) candidates.workExperiences.push(...data.workExperiences.map(e => ({ ...e, _source: 'doc:' + item.id })))
        if (Array.isArray(data.projects)) candidates.projects.push(...data.projects.map(p => ({ ...p, _source: 'doc:' + item.id })))
        if (Array.isArray(data.skills)) candidates.skills.push(...data.skills.map(s => ({ ...s, _source: 'doc:' + item.id })))
        if (Array.isArray(data.certificates)) candidates.certificates.push(...data.certificates.map(c => ({ ...c, _source: 'doc:' + item.id })))
        if (Array.isArray(data.education)) candidates.education.push(...data.education.map(e => ({ ...e, _source: 'doc:' + item.id })))
      }

      const totalCandidates = Object.values(candidates).reduce((sum, arr) => sum + arr.length, 0)
      if (totalCandidates === 0 && knowledgeStore.items.length === 0) {
        return { hasChanges: false, summary: ['\u77e5\u8bc6\u5e93\u4e3a\u7a7a\uff0c\u65e0\u6587\u6863\u53ef\u6574\u7406'] }
      }
      if (totalCandidates === 0) {
        return { hasChanges: false, summary: ['\u77e5\u8bc6\u5e93\u6587\u6863\u6ca1\u6709\u53ef\u63d0\u53d6\u7684\u7b80\u5386\u6761\u76ee'] }
      }

      const current = {
        workExperiences: workExperiences.value.map(e => ({ ...e, _source: 'existing' })),
        projects: projects.value.map(p => ({ ...p, _source: 'existing' })),
        skills: skills.value.map(s => ({ ...s, _source: 'existing' })),
        certificates: certificates.value.map(c => ({ ...c, _source: 'existing' })),
        education: education.value.map(e => ({ ...e, _source: 'existing' }))
      }

      const kindOrder = ['workExperiences', 'projects', 'skills', 'certificates', 'education']
      const kindLabels = {
        workExperiences: '\u5de5\u4f5c\u7ecf\u5386',
        projects: '\u9879\u76ee',
        skills: '\u6280\u80fd',
        certificates: '\u8bc1\u4e66',
        education: '\u6559\u80b2\u80cc\u666f'
      }
      const dbTables = {
        workExperiences: db.workExperiences,
        projects: db.projects,
        skills: db.skills,
        certificates: db.certificates,
        education: db.education
      }
      const refs = {
        workExperiences: workExperiences,
        projects: projects,
        skills: skills,
        certificates: certificates,
        education: education
      }

      const summary = []
      let hasChanges = false

      for (const kind of kindOrder) {
        const all = [...current[kind], ...candidates[kind]]
        if (all.length === 0) continue

        const groups = groupProfileEntries(all, kind)
        const mergeable = groups.filter(g => g.length > 1)
        let finalEntries
        let kindMerged = 0
        if (mergeable.length > 0) {
          const result = await mergeEntryGroups(groups, kind, { maxGroups: 8 })
          finalEntries = result.entries
          kindMerged = result.mergedCount
          summary.push(...result.summary)
        } else {
          finalEntries = all
        }

        const cleanEntries = finalEntries.map(toSafeRecord).filter(Boolean)
        if (finalEntries.length > 0 && cleanEntries.length === 0) {
          summary.push('\u300c' + kindLabels[kind] + '\u300d\u6570\u636e\u683c\u5f0f\u5f02\u5e38\uff0c\u5df2\u8df3\u8fc7')
          continue
        }
        const originalCount = current[kind].length
        const changed = kindMerged > 0 || cleanEntries.length !== originalCount
        if (!changed) continue

        await dbTables[kind].clear()
        await dbTables[kind].bulkAdd(cleanEntries)
        refs[kind].value = cleanEntries
        hasChanges = true
        if (cleanEntries.length > originalCount) {
          summary.push('\u5df2\u8865\u5145 ' + (cleanEntries.length - originalCount) + ' \u6761' + kindLabels[kind])
        }
      }

      if (!hasChanges) summary.push('\u672a\u53d1\u73b0\u9700\u8981\u6574\u7406\u7684\u91cd\u590d\u6216\u53ef\u8865\u5145\u6761\u76ee')
      return { hasChanges: hasChanges, summary: summary }
    }

  function exportData(format) {
    const data = {
      basicInfo: basicInfo.value,
      workExperiences: workExperiences.value,
      education: education.value,
      projects: projects.value,
      skills: skills.value,
      certificates: certificates.value
    }
    if (format === "word") {
      exportWord(data)
    }
  }
  return {
    basicInfo, workExperiences, education, projects, skills, certificates,
    loaded, completeness, summaryData,
    consolidateAll,
    consolidateWithKnowledge,
    exportData,
    loadAll,
    saveBasicInfo,
    addWorkExperience, updateWorkExperience, deleteWorkExperience,
    addEducation, updateEducation, deleteEducation,
    addProject, updateProject, deleteProject,
    addSkill, updateSkill, deleteSkill,
    addCertificate, updateCertificate, deleteCertificate
  }
})





