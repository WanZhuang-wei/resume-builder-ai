import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import db from '@/db'
import { consolidateProfile } from '@/utils/consolidator'
import { clusterDocuments } from '@/utils/document-merger'
import { consolidateWithAI } from '@/utils/consolidate-v2'
import { exportWord } from '@/utils/exportProfiler'
import { useKnowledgeStore } from '@/stores/knowledge'

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

    let clusters = []
    let skipped = 0

    if (knowledgeStore.items.length > 0) {
      const docResult = clusterDocuments(knowledgeStore.items)
      clusters = docResult.clusters
      skipped = docResult.skipped
    }

    // If no clusters from documents or knowledge base is empty, fallback to old method
    // 没有找到重复文档簇 → 不做任何操作
    if (clusters.length === 0 || knowledgeStore.items.length === 0) {
      return { hasChanges: false, summary: [] }
    }

    const aiResult = await consolidateWithAI(clusters, { summaryData: summaryData.value }, {})
    const summary = aiResult.summary || []
    let hasChanges = false
    let writeCount = 0

    // 将 AI 合并结果写入 store
    if (aiResult.workExperiences && aiResult.workExperiences.length > 0) {
      await db.workExperiences.clear()
      await db.workExperiences.bulkAdd(aiResult.workExperiences)
      workExperiences.value = aiResult.workExperiences
      writeCount += aiResult.workExperiences.length
      hasChanges = true
    }
    if (aiResult.projects && aiResult.projects.length > 0) {
      await db.projects.clear()
      await db.projects.bulkAdd(aiResult.projects)
      projects.value = aiResult.projects
      writeCount += aiResult.projects.length
      hasChanges = true
    }

    if (writeCount > 0) summary.push("已更新 " + writeCount + " 条记录")
    if (skipped > 0) summary.push(skipped + " 篇文档因内容过短已跳过")
    if (!hasChanges) summary.push("文档中未发现需要合并的重复内容")

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




