import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { compressData, estimateUrlLength } from '@/utils/compress'

export const useShareStore = defineStore('share', () => {
  const selectedContact = ref({
    showPhone: true,
    showWechat: true,
    showEmail: true
  })
  const selectedSections = ref({
    basicInfo: true,
    workExperiences: true,
    education: true,
    projects: true,
    skills: true,
    certificates: false
  })
  const shareLink = ref('')

  const urlLength = computed(() => {
    if (!shareLink.value) return 0
    return shareLink.value.length
  })

  function generateShareLink(profileData) {
    const shareData = {
      contact: {},
      profile: {}
    }

    if (selectedContact.value.showPhone && profileData.basicInfo?.phone) {
      shareData.contact.phone = profileData.basicInfo.phone
    }
    if (selectedContact.value.showWechat && profileData.basicInfo?.wechat) {
      shareData.contact.wechat = profileData.basicInfo.wechat
    }
    if (selectedContact.value.showEmail && profileData.basicInfo?.email) {
      shareData.contact.email = profileData.basicInfo.email
    }

    if (selectedSections.value.basicInfo && profileData.basicInfo) {
      shareData.profile.basicInfo = {
        name: profileData.basicInfo.name,
        title: profileData.basicInfo.title,
        summary: profileData.basicInfo.summary,
        targetPosition: profileData.basicInfo.targetPosition
      }
    }
    if (selectedSections.value.workExperiences) {
      shareData.profile.workExperiences = profileData.workExperiences || []
    }
    if (selectedSections.value.education) {
      shareData.profile.education = profileData.education || []
    }
    if (selectedSections.value.projects) {
      shareData.profile.projects = profileData.projects || []
    }
    if (selectedSections.value.skills) {
      shareData.profile.skills = profileData.skills || []
    }
    if (selectedSections.value.certificates) {
      shareData.profile.certificates = profileData.certificates || []
    }

    const encoded = compressData(shareData)
    const baseUrl = window.location.origin + window.location.pathname
    shareLink.value = `${baseUrl}#/hr/${encoded}`

    return shareLink.value
  }

  function getUrlWarning() {
    const len = urlLength.value
    if (len > 8000) return '分享链接过长，建议精简展示内容'
    if (len > 4000) return '链接较长，部分浏览器可能受限'
    return ''
  }

  return {
    selectedContact, selectedSections, shareLink, urlLength,
    generateShareLink, getUrlWarning
  }
})
