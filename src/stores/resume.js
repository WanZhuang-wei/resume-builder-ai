import { defineStore } from 'pinia'
import { ref } from 'vue'
import db from '@/db'
import { generateResume } from '@/api/deepseek'

export const useResumeStore = defineStore('resume', () => {
  const savedResumes = ref([])
  const generating = ref(false)
  const currentContent = ref('')

  async function loadSaved() {
    savedResumes.value = await db.resumes.toArray()
  }

  async function generate(profileData, company, position, jobDescription, templateText) {
    generating.value = true
    try {
      const content = await generateResume(profileData, company, position, jobDescription, templateText)
      currentContent.value = content
      return content
    } finally {
      generating.value = false
    }
  }

  async function saveCurrent(targetCompany, targetPosition, jobDescription) {
    const entry = {
      targetCompany,
      targetPosition,
      content: currentContent.value,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    const id = await db.resumes.add(entry)
    savedResumes.value.push({ ...entry, id })
    return id
  }

  async function deleteResume(id) {
    await db.resumes.delete(id)
    savedResumes.value = savedResumes.value.filter(r => r.id !== id)
  }

  function setContent(content) {
    currentContent.value = content
  }

  return {
    savedResumes, generating, currentContent,
    loadSaved, generate, saveCurrent, deleteResume, setContent
  }
})
